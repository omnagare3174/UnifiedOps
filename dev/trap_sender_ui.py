#!/usr/bin/env python3
"""
=============================================================================
  UnifiedOps - Dev trap-sender UI  (FastAPI)
=============================================================================

A tiny on-demand trap sender UI for the dev environment. Lets you craft
and fire one Hitachi GUM/SVP syslog packet at a time (or short bursts)
against the running per-location listeners - without needing a real
storage array.

Built on top of the catalogue + helpers in `dev/trap_sender.py`, so the
UI uses the exact same packet builder + IP maps + SIM reference codes
as the CLI.

Run:
    pip install fastapi "uvicorn[standard]" httpx websockets
    python dev/trap_sender_ui.py
    -> open http://127.0.0.1:7700/

Env overrides:
    UNIFIEDOPS_TRAP_UI_HOST   default: 127.0.0.1
    UNIFIEDOPS_TRAP_UI_PORT   default: 7700

NOT FOR PRODUCTION. This deliberately accepts arbitrary --target host:port
values from the browser (only sensible because the dev box is a single
operator workstation).
"""
from __future__ import annotations

import asyncio
import os
import socket
import sys
import time
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Pull the catalogue + helpers straight from the CLI tool so there is
# exactly one source of truth for refcodes / IPs / packet shape.
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import trap_sender  # noqa: E402  (same folder)


HOST = os.environ.get("UNIFIEDOPS_TRAP_UI_HOST", "127.0.0.1")
PORT = int(os.environ.get("UNIFIEDOPS_TRAP_UI_PORT", "7700"))

HISTORY: Deque[Dict[str, Any]] = deque(maxlen=200)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SendRequest(BaseModel):
    vendor: str = Field("Hitachi", description="Hitachi / Brocade / NetApp / Dell")
    location: str = Field(..., description="CDVL / BCP / SIFY (Brocade has only CDVL + BCP)")
    source_ip: Optional[str] = Field(
        None,
        description="Specific source IP from the vendor+location pool, or empty for random.",
    )
    refcode: Optional[str] = Field(
        None,
        description="Vendor-specific ref code; empty = pick from catalogue (or random when random=True).",
    )
    severity: Optional[str] = Field(
        None,
        description="Acute / Serious / Moderate / Service / Info; empty = catalogue default.",
    )
    text: Optional[str] = Field(None, description="Override message text.")
    count: int = Field(1, ge=1, le=500)
    interval: float = Field(0.0, ge=0.0, le=10.0)
    target: Optional[str] = Field(
        None,
        description='Override "host:port"; empty = per-vendor-location default.',
    )
    use_gum: bool = Field(True, description="Hitachi only: True = GUM envelope; False = SVP.")
    rfc5424: bool = Field(True, description="Hitachi only: True = RFC5424; False = RFC3164.")
    random_pick: bool = Field(False, description="If True, pick a random catalogue entry per packet.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="UnifiedOps Dev Trap Sender",
    version="1.0.0-dev",
    docs_url="/api/docs",
)


@app.get("/api/vendors")
def get_vendors() -> List[Dict[str, Any]]:
    """List all supported vendors with the locations each is deployed at."""
    return [
        {"vendor": v, "locations": list(trap_sender.VENDOR_TARGETS.get(v, {}).keys())}
        for v in trap_sender.VENDORS
    ]


@app.get("/api/catalog")
def get_catalog(vendor: str = "Hitachi") -> List[Dict[str, str]]:
    catalogue = trap_sender.VENDOR_CATALOGUES.get(vendor)
    if catalogue is None:
        raise HTTPException(400, f"Unknown vendor: {vendor!r}")
    return [
        {"severity": sev, "refcode": code, "text": text}
        for sev, code, text in catalogue
    ]


@app.get("/api/locations")
def get_locations(vendor: str = "Hitachi") -> Dict[str, Any]:
    """List of locations a vendor is deployed at, plus their IP pool + default target."""
    if vendor not in trap_sender.VENDOR_TARGETS:
        raise HTTPException(400, f"Unknown vendor: {vendor!r}")
    targets   = trap_sender.VENDOR_TARGETS[vendor]
    ip_map    = trap_sender.VENDOR_STORAGE_IPS.get(vendor, {})
    return {
        loc: {
            "ips": [
                {"ip": ip, "array": name}
                for ip, name in ip_map.get(loc, {}).items()
            ],
            "default_target": target,
        }
        for loc, target in targets.items()
    }


@app.get("/api/severities")
def get_severities() -> List[str]:
    return trap_sender.VALID_SEVERITIES


@app.get("/api/history")
def get_history(limit: int = 50) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 200))
    return list(HISTORY)[-limit:][::-1]


@app.post("/api/send")
def post_send(req: SendRequest) -> Dict[str, Any]:
    vendor = req.vendor or "Hitachi"
    if vendor not in trap_sender.VENDOR_TARGETS:
        raise HTTPException(400, f"Unknown vendor: {vendor!r}")
    if req.location not in trap_sender.VENDOR_TARGETS[vendor]:
        raise HTTPException(
            400,
            f"{vendor} is not deployed at {req.location!r} "
            f"(valid: {list(trap_sender.VENDOR_TARGETS[vendor].keys())})",
        )

    target_str = req.target or trap_sender.VENDOR_TARGETS[vendor][req.location]
    try:
        host, port = trap_sender.parse_target(target_str)
    except Exception as e:
        raise HTTPException(400, f"Bad target: {e}") from e

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sent_records: List[Dict[str, Any]] = []
    errors: List[str] = []

    try:
        for i in range(req.count):
            try:
                refcode = "" if req.random_pick else (req.refcode or "")
                sev, code, text = trap_sender.pick_catalogue_entry_for_vendor(
                    vendor, refcode,
                )

                severity = req.severity or sev
                if severity not in trap_sender.VALID_SEVERITIES:
                    errors.append(
                        f"packet {i+1}: invalid severity {severity!r}; using {sev}"
                    )
                    severity = sev

                message = req.text or text

                source_ip, array_name = trap_sender.pick_source_ip_for_vendor(
                    vendor, req.location, req.source_ip or "",
                )

                import random
                seq = 100000 + random.randint(0, 99999)

                packet = trap_sender.build_packet_for_vendor(
                    vendor,
                    source_ip=source_ip,
                    array_name=array_name,
                    severity=severity,
                    refcode=code,
                    text=message,
                    seq=seq,
                    use_gum_envelope=req.use_gum,
                    rfc5424=req.rfc5424,
                )
                sock.sendto(packet, (host, port))

                rec = {
                    "ts":           time.strftime("%Y-%m-%d %H:%M:%S"),
                    "vendor":       vendor,
                    "location":     req.location,
                    "target":       f"{host}:{port}",
                    "source_ip":    source_ip,
                    "array_name":   array_name,
                    "severity":     severity,
                    "refcode":      code,
                    "text":         message,
                    "envelope":     (
                        ("GUM" if req.use_gum else "SVP") if vendor == "Hitachi" else "—"
                    ),
                    "format":       (
                        ("RFC5424" if req.rfc5424 else "RFC3164")
                        if vendor == "Hitachi"
                        else "RFC5424"
                    ),
                    "packet":       packet.decode("utf-8", errors="replace"),
                }
                HISTORY.append(rec)
                sent_records.append(rec)

                if req.interval and i < req.count - 1:
                    time.sleep(req.interval)
            except Exception as e:
                errors.append(f"packet {i+1}: {type(e).__name__}: {e}")
    finally:
        sock.close()

    return {
        "ok":     not errors,
        "sent":   len(sent_records),
        "errors": errors,
        "records": sent_records,
    }


# ---------------------------------------------------------------------------
# Static UI (last so /api/* routes resolve first)
# ---------------------------------------------------------------------------

STATIC_DIR = HERE / "static"

# Path to the new React-19 + Vite build (trap-sender/dist). When present
# this is preferred over the legacy static HTML so the operator only ever
# sees the new "no auto-fire, explicit Send / Schedule" UI.
REACT_DIST = HERE.parent / "trap-sender" / "dist"


@app.get("/")
def root() -> FileResponse:
    if (REACT_DIST / "index.html").is_file():
        return FileResponse(REACT_DIST / "index.html")
    return FileResponse(STATIC_DIR / "trap-sender.html")


@app.get("/healthz")
def healthz() -> Dict[str, Any]:
    return {
        "ok": True,
        "service":         "unifiedops-dev-trap-sender-ui",
        "version":         "2.0.0-dev",
        "vendors":         trap_sender.VENDORS,
        "vendor_targets":  trap_sender.VENDOR_TARGETS,
        "catalogue_sizes": {
            v: len(trap_sender.VENDOR_CATALOGUES.get(v, []))
            for v in trap_sender.VENDORS
        },
    }


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Mount the React-19 Vite asset directory (chunked JS + CSS produced
# by `npm run build` inside ../trap-sender/). When this directory does
# not exist we silently fall back to the legacy static HTML.
if (REACT_DIST / "assets").is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(REACT_DIST / "assets")),
        name="trap-sender-assets",
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"==> UnifiedOps dev trap-sender UI -> http://{HOST}:{PORT}/")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
