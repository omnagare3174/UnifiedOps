"""
UnifiedOps v2 — FastAPI server (composition root).

Layout:
    server/
      server.py          <- this file: wires services + routers
      services/
        influx_pool.py   <- shared ThreadPoolExecutor + WsHub
        alert_monitor.py <- 5s polling, /ws/alerts broadcaster
        health_check.py  <- 10s polling, /ws/listener-health broadcaster
        dashboard.py     <- on-demand REST aggregator
      routers/
        dashboard.py     <- /api/dashboard/* (snapshot, total, severity, ...)
        alerts.py        <- /api/alerts/recent
        health.py        <- /api/health/{listeners,pipeline,websocket}
        websocket.py     <- /ws/alerts, /ws/listener-health

The React bundle is served from `HITRACK_UI_DIST` (a path the systemd
unit file sets per VM). Browsers no longer talk to InfluxDB directly —
everything goes through this process.

Python 3.9+ compatible.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Optional

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Services
from services.influx_pool            import InfluxPool, WsHub
from services.alert_monitor          import AlertMonitor, VENDOR_BUCKETS
from services.health_check           import HealthCheckMonitor, HEARTBEAT_PIPELINES
from services.dashboard              import DashboardService
from services.dashboard_broadcaster  import DashboardBroadcaster

# Routers
from routers import dashboard as dashboard_router
from routers import alerts    as alerts_router
from routers import health    as health_router
from routers import websocket as ws_router


# ---------------------------------------------------------------------------
# Config — every knob is overridable via the systemd EnvironmentFile.
# ---------------------------------------------------------------------------
SERVICE_NAME    = "unifiedops-ui"
SERVICE_VERSION = "2.0.0"

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = Path(os.environ.get("HITRACK_UI_DIST", str(ROOT_DIR / "frontend" / "dist")))

LISTEN_HOST = os.environ.get("HITRACK_UI_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("HITRACK_UI_PORT", "8001"))

THREAD_POOL_WORKERS = max(8, int(os.environ.get("HITRACK_THREAD_WORKERS", "64")))

TLS_CERT         = os.environ.get("HITRACK_UI_TLS_CERT") or None
TLS_KEY          = os.environ.get("HITRACK_UI_TLS_KEY") or None
TLS_KEY_PASSWORD = os.environ.get("HITRACK_UI_TLS_KEY_PASSWORD") or None

CORS_ORIGINS = [
    o.strip() for o in os.environ.get("HITRACK_CORS_ORIGINS", "*").split(",") if o.strip()
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
log = logging.getLogger("unifiedops.server")


# ---------------------------------------------------------------------------
# Singletons set during lifespan
# ---------------------------------------------------------------------------
_executor:        Optional[ThreadPoolExecutor]    = None
_influx_pool:     Optional[InfluxPool]            = None
_alerts_hub:      Optional[WsHub]                 = None
_health_hub:      Optional[WsHub]                 = None
_alert_monitor:   Optional[AlertMonitor]          = None
_health_monitor:  Optional[HealthCheckMonitor]    = None
_dashboard:       Optional[DashboardService]      = None
_dashboard_bc:    Optional[DashboardBroadcaster]  = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _executor, _influx_pool, _alerts_hub, _health_hub
    global _alert_monitor, _health_monitor, _dashboard, _dashboard_bc

    _executor = ThreadPoolExecutor(
        max_workers=THREAD_POOL_WORKERS,
        thread_name_prefix="unifiedops-influx",
    )
    loop = asyncio.get_running_loop()
    loop.set_default_executor(_executor)

    _influx_pool    = InfluxPool(_executor)
    _alerts_hub     = WsHub("alerts")
    _health_hub     = WsHub("listener-health")
    _alert_monitor  = AlertMonitor(_influx_pool, _alerts_hub)
    _health_monitor = HealthCheckMonitor(_influx_pool, _health_hub, alert_monitor=_alert_monitor)
    _dashboard      = DashboardService(_influx_pool)
    _dashboard_bc   = DashboardBroadcaster(_dashboard)

    await _alert_monitor.start()
    await _health_monitor.start()
    await _dashboard_bc.start()

    # Wire the routers — each gets ONLY the dependencies it needs.
    dashboard_router.configure(_dashboard)
    alerts_router.configure(_alert_monitor)
    health_router.configure(
        _alert_monitor, _health_monitor,
        lambda: _alerts_hub.size() if _alerts_hub else 0,
        lambda: _health_hub.size() if _health_hub else 0,
    )
    ws_router.configure(
        _alerts_hub, _health_hub, _alert_monitor, _health_monitor, _dashboard_bc,
    )

    log.info("UI bundle directory : %s (exists=%s)", DIST_DIR, DIST_DIR.exists())
    log.info("AlertMonitor buckets: %d (vendor x site)", len(VENDOR_BUCKETS))
    log.info("HealthCheck   sites : %d", len(HEARTBEAT_PIPELINES))
    log.info("Threadpool workers : %d", THREAD_POOL_WORKERS)
    log.info("Listening on http://%s:%s", LISTEN_HOST, LISTEN_PORT)

    try:
        yield
    finally:
        if _dashboard_bc is not None:
            await _dashboard_bc.stop()
        if _alert_monitor is not None:
            await _alert_monitor.stop()
        if _health_monitor is not None:
            await _health_monitor.stop()
        if _influx_pool is not None:
            _influx_pool.close()
        if _executor is not None:
            _executor.shutdown(wait=False, cancel_futures=True)
        _dashboard_bc = None
        _alert_monitor = None
        _health_monitor = None
        _influx_pool = None
        _executor = None


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="UnifiedOps UI",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount routers — order doesn't matter for /api routes but does matter
# for the SPA fallback below, which must be last.
app.include_router(dashboard_router.router)
app.include_router(alerts_router.router)
app.include_router(health_router.router)
app.include_router(ws_router.router)


@app.get("/healthz", include_in_schema=False)
async def healthz(request: Request) -> Dict[str, Any]:
    return {
        "ok":           True,
        "service":      SERVICE_NAME,
        "version":      SERVICE_VERSION,
        "dist_present": DIST_DIR.exists(),
        "ws":           {
            "alerts":          _alerts_hub.size() if _alerts_hub else 0,
            "listener_health": _health_hub.size() if _health_hub else 0,
        },
    }


# ---------------------------------------------------------------------------
# Static SPA bundle — MUST be the last route.
# ---------------------------------------------------------------------------
if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str) -> Response:
    if not DIST_DIR.exists():
        return Response(
            content=(
                "Frontend bundle not built.\n"
                "Expected dist dir at: {0}\n"
                "Set HITRACK_UI_DIST in the env file, or run:\n"
                "  cd frontend && npm ci && npm run build\n".format(DIST_DIR)
            ),
            status_code=503,
            media_type="text/plain",
        )
    no_store = {"Cache-Control": "no-store, max-age=0"}
    candidate = (DIST_DIR / full_path) if full_path else (DIST_DIR / "index.html")
    if candidate.is_file():
        headers = no_store if candidate.suffix.lower() in {".html", ""} else None
        return FileResponse(candidate, headers=headers)
    return FileResponse(DIST_DIR / "index.html", headers=no_store)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    kwargs: Dict[str, Any] = dict(
        host=LISTEN_HOST,
        port=LISTEN_PORT,
        reload=False,
        log_level="info",
    )
    if TLS_CERT and TLS_KEY:
        kwargs["ssl_certfile"] = TLS_CERT
        kwargs["ssl_keyfile"]  = TLS_KEY
        if TLS_KEY_PASSWORD:
            kwargs["ssl_keyfile_password"] = TLS_KEY_PASSWORD
        log.info("TLS cert=%s key=%s", TLS_CERT, TLS_KEY)
    log.info(
        "Starting %s://%s:%s",
        "https" if (TLS_CERT and TLS_KEY) else "http",
        LISTEN_HOST, LISTEN_PORT,
    )
    uvicorn.run("server:app", **kwargs)
