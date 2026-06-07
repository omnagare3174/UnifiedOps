"""
Listener health monitor.

Polls the per-site heartbeat InfluxDB buckets every N seconds, reads the
latest `syslog_listener_heartbeat` point per (site, oem, listener) tuple,
and flips a listener to "down" if its newest heartbeat is older than the
configured threshold (default 90 s).

State transitions (up -> down) are accumulated into `down_events` so the
FastAPI handlers + WebSocket hub can emit a one-shot modal alert the
first time each listener is observed down; the per-listener `state`
remains "down" until the listener resumes heartbeating, at which point
the modal-trigger key changes and the next outage is treated as a fresh
event.

Public surface:

    monitor = ListenerHealthMonitor(httpx_client)
    await monitor.start()
    ...
    snapshot = monitor.snapshot()   # {as_of, listeners:[...], down_events:[...]}
    await monitor.stop()
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

import httpx

log = logging.getLogger("hi-track-ui.listener_health")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
HEARTBEAT_PIPELINES: Dict[str, Dict[str, str]] = {
    "CDVL": {
        "url":    os.environ.get("HITRACK_HEARTBEAT_CDVL_URL",    "http://127.0.0.1:8486"),
        "token":  os.environ.get("HITRACK_HEARTBEAT_CDVL_TOKEN",  "unifiedops-dev-token-heartbeat-cdvl"),
        "org":    os.environ.get("HITRACK_HEARTBEAT_CDVL_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_HEARTBEAT_CDVL_BUCKET", "CDVL_Heartbeat_Bucket"),
    },
    "BCP": {
        "url":    os.environ.get("HITRACK_HEARTBEAT_BCP_URL",    "http://127.0.0.1:8487"),
        "token":  os.environ.get("HITRACK_HEARTBEAT_BCP_TOKEN",  "unifiedops-dev-token-heartbeat-bcp"),
        "org":    os.environ.get("HITRACK_HEARTBEAT_BCP_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_HEARTBEAT_BCP_BUCKET", "BCP_Heartbeat_Bucket"),
    },
    "SIFY": {
        "url":    os.environ.get("HITRACK_HEARTBEAT_SIFY_URL",    "http://127.0.0.1:8488"),
        "token":  os.environ.get("HITRACK_HEARTBEAT_SIFY_TOKEN",  "unifiedops-dev-token-heartbeat-sify"),
        "org":    os.environ.get("HITRACK_HEARTBEAT_SIFY_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_HEARTBEAT_SIFY_BUCKET", "SIFY_Heartbeat_Bucket"),
    },
}

# Expected listener composition per site (matches the v2 topology).
SITE_LISTENERS: Dict[str, List[Tuple[str, str]]] = {
    "CDVL": [("Hitachi", "hitachi-cdvl"),
             ("Brocade", "brocade-cdvl"),
             ("NetApp",  "netapp-cdvl"),
             ("Dell",    "dell-cdvl")],
    "BCP":  [("Hitachi", "hitachi-bcp"),
             ("Brocade", "brocade-bcp"),
             ("NetApp",  "netapp-bcp"),
             ("Dell",    "dell-bcp")],
    "SIFY": [("Hitachi", "hitachi-sify"),
             # Brocade not deployed on SIFY per topology
             ("NetApp",  "netapp-sify"),
             ("Dell",    "dell-sify")],
}

POLL_INTERVAL_S = max(2,  int(os.environ.get("HITRACK_LISTENER_POLL_SECS",     "4")))
DOWN_THRESHOLD_S = max(10, int(os.environ.get("HITRACK_LISTENER_DOWN_THRESHOLD_S", "20")))
LOOKBACK_WINDOW  = max(2 * DOWN_THRESHOLD_S, 300)


def _flux_latest_heartbeat(bucket: str, window_s: int) -> str:
    """Latest hb_seq per (site, oem, listener) within the lookback window."""
    return (
        f'from(bucket: "{bucket}")\n'
        f'  |> range(start: -{window_s}s)\n'
        f'  |> filter(fn: (r) => r._measurement == "syslog_listener_heartbeat" '
        f'and r._field == "hb_seq")\n'
        f'  |> last()\n'
        f'  |> keep(columns: ["site", "oem", "listener", "_time", "_value"])'
    )


def _flux_latest_msg_count(bucket: str, window_s: int) -> str:
    """Latest msg_count per (site, oem, listener) — secondary lookup."""
    return (
        f'from(bucket: "{bucket}")\n'
        f'  |> range(start: -{window_s}s)\n'
        f'  |> filter(fn: (r) => r._measurement == "syslog_listener_heartbeat" '
        f'and r._field == "msg_count")\n'
        f'  |> last()\n'
        f'  |> keep(columns: ["site", "oem", "listener", "_value"])'
    )


def _parse_csv_rows(text: str) -> List[Dict[str, str]]:
    """Parse Influx CSV result (annotated or simple)."""
    rows: List[Dict[str, str]] = []
    if not text:
        return rows
    header: List[str] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.startswith("#"):
            continue
        cells = line.split(",")
        if not header:
            header = [c.strip() for c in cells]
            continue
        if len(cells) != len(header):
            continue
        row = {header[i]: cells[i].strip() for i in range(len(header))}
        rows.append(row)
    return rows


class ListenerHealthMonitor:
    """Background async loop that maintains in-memory listener state."""

    def __init__(self, client: httpx.AsyncClient):
        self._client = client
        self._task: Optional[asyncio.Task[None]] = None
        self._stop = asyncio.Event()
        # listener_id -> dict (full per-listener snapshot)
        self._state: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
        # listener_id -> event {key, listener, site, oem, listener_name, down_since}
        # `key` rotates each time the listener flips up->down so the frontend
        # can show the modal exactly once per outage.
        self._down_events: Dict[str, Dict[str, Any]] = {}
        # site -> {reachable, last_check, last_ok, error, event_key}
        # We track per-site heartbeat-store reachability separately so the UI
        # can distinguish "listener stopped heartbeating" from "InfluxDB /
        # heartbeat infrastructure is down" (which makes it impossible to
        # determine listener state at all).
        self._site_health: Dict[str, Dict[str, Any]] = {
            site: {
                "reachable":  None,   # None until first probe completes
                "last_check": None,
                "last_ok":    None,
                "error":      None,
                "event_key":  None,
            }
            for site in HEARTBEAT_PIPELINES
        }
        self._infra_events: Dict[str, Dict[str, Any]] = {}
        self._init_state()

    def _init_state(self) -> None:
        for site, listeners in SITE_LISTENERS.items():
            for oem, name in listeners:
                lid = f"{site}:{oem}"
                self._state[lid] = {
                    "id":          lid,
                    "site":        site,
                    "oem":         oem,
                    "listener":    name,
                    "state":       "unknown",
                    "last_seen":   None,
                    "down_since":  None,
                    "msg_count":   0,
                    "hb_seq":      0,
                    "event_key":   None,
                }

    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name="listener-health-monitor")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._stop.set()
        try:
            await asyncio.wait_for(self._task, timeout=3.0)
        except asyncio.TimeoutError:
            self._task.cancel()
        self._task = None

    async def _run(self) -> None:
        log.info("Listener health monitor started (poll=%ds, down>%ds)",
                 POLL_INTERVAL_S, DOWN_THRESHOLD_S)
        while not self._stop.is_set():
            try:
                await self._tick()
            except Exception as exc:
                log.warning("listener-health tick failed: %s", exc)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=POLL_INTERVAL_S)
            except asyncio.TimeoutError:
                continue

    async def _tick(self) -> None:
        # Query each per-site heartbeat bucket in parallel.
        now = time.time()
        results = await asyncio.gather(*[
            self._fetch_site(site)
            for site in HEARTBEAT_PIPELINES
        ], return_exceptions=True)

        # 1) Update per-site reachability state + raise/clear infra events.
        site_data_map: Dict[str, Dict[str, Dict[str, Any]]] = {}
        for site, result in zip(HEARTBEAT_PIPELINES.keys(), results):
            sh = self._site_health[site]
            sh["last_check"] = now

            if isinstance(result, Exception):
                ok, err, data = False, f"{type(result).__name__}: {result}", {}
            else:
                data, ok, err = result

            prev_reachable = sh["reachable"]
            sh["reachable"] = ok
            sh["error"]     = err
            if ok:
                sh["last_ok"] = now
                if prev_reachable is False and sh["event_key"]:
                    self._infra_events.pop(site, None)
                    log.info("Heartbeat store for site %s recovered", site)
                    sh["event_key"] = None
            else:
                # Site unreachable. Emit a new infra event the first time we
                # observe this outage (transition reachable->unreachable, or
                # first ever probe).
                if prev_reachable is True or sh["event_key"] is None:
                    sh["event_key"] = f"infra:{site}@{int(now)}"
                    self._infra_events[site] = {
                        "key":   sh["event_key"],
                        "site":  site,
                        "since": now,
                        "error": err or "unreachable",
                    }
                    log.warning("Heartbeat store for site %s unreachable: %s",
                                site, err)

            site_data_map[site] = data if ok else {}

        # 2) Merge per-listener heartbeat data (only from reachable sites).
        for site, data in site_data_map.items():
            for lid, payload in data.items():
                row = self._state.get(lid)
                if row is None:
                    # Listener observed in Influx but not in expected list — track it.
                    self._state[lid] = {
                        "id":         lid,
                        "site":       payload.get("site", ""),
                        "oem":        payload.get("oem", ""),
                        "listener":   payload.get("listener", ""),
                        "state":      "unknown",
                        "last_seen":  None,
                        "down_since": None,
                        "msg_count":  0,
                        "hb_seq":     0,
                        "event_key":  None,
                    }
                    row = self._state[lid]
                last_seen = payload.get("last_seen")
                if last_seen is not None:
                    row["last_seen"] = last_seen
                    row["msg_count"] = payload.get("msg_count", row.get("msg_count", 0))
                    row["hb_seq"]    = payload.get("hb_seq",    row.get("hb_seq",    0))
                    row["listener"]  = payload.get("listener",  row.get("listener", ""))

        # 3) Walk every expected listener and compute its state.
        for lid, row in self._state.items():
            site = row["site"]
            sh   = self._site_health.get(site, {})
            prev_state = row["state"]

            # If the heartbeat store for this listener's site is unreachable,
            # we genuinely cannot tell whether the listener process is alive
            # or not. Surface "infra_down" instead of "down" and withdraw any
            # pending listener-down event so the user sees only ONE clear
            # diagnostic ("Heartbeat store unreachable") rather than a flood
            # of misleading "listener not running" warnings.
            if sh.get("reachable") is False:
                row["state"] = "infra_down"
                row["age_s"] = (now - row["last_seen"]) if row.get("last_seen") else None
                if lid in self._down_events:
                    self._down_events.pop(lid, None)
                row["down_since"] = None
                row["event_key"]  = None
                continue

            # Site reachable (or status unknown on cold start) — compute
            # listener up/down purely from heartbeat freshness.
            last = row.get("last_seen")
            if last is None:
                # No heartbeat seen in the lookback window.
                row["state"] = "down" if prev_state in ("down", "up", "infra_down") else "unknown"
                age = None
            else:
                age = now - last
                row["state"] = "down" if age > DOWN_THRESHOLD_S else "up"
            row["age_s"] = age

            # State transitions ----------------------------------------------
            if row["state"] == "down" and prev_state != "down":
                row["down_since"] = now
                row["event_key"]  = f"{lid}@{int(now)}"
                self._down_events[lid] = {
                    "key":      row["event_key"],
                    "id":       lid,
                    "site":     row["site"],
                    "oem":      row["oem"],
                    "listener": row["listener"],
                    "down_since": now,
                    "raised_at":  now,
                    "age_s":      age,
                }
                log.warning("listener DOWN  site=%s oem=%s listener=%s age=%s",
                            row["site"], row["oem"], row["listener"],
                            "?" if age is None else f"{age:.0f}s")
            elif row["state"] == "up":
                if prev_state == "down":
                    log.info("listener UP    site=%s oem=%s listener=%s",
                             row["site"], row["oem"], row["listener"])
                row["down_since"] = None
                row["event_key"]  = None
                self._down_events.pop(lid, None)

    async def _fetch_site(
        self, site: str
    ) -> Tuple[Dict[str, Dict[str, Any]], bool, Optional[str]]:
        """Fetch heartbeat data for one site. Returns (data, ok, error_msg).

        `ok=False` means the heartbeat InfluxDB for this site is unreachable
        or returned an unexpected status — used by `_tick` to mark the site
        as infrastructure-down rather than misclassifying its listeners as
        "down" because of stale heartbeat data.
        """
        cfg = HEARTBEAT_PIPELINES[site]
        url   = cfg["url"].rstrip("/") + "/api/v2/query"
        params = {"org": cfg["org"]}
        headers = {
            "Authorization": f"Token {cfg['token']}",
            "Accept":        "application/csv",
            "Content-Type":  "application/vnd.flux",
        }
        out: Dict[str, Dict[str, Any]] = {}

        # latest hb_seq + _time per listener
        try:
            resp = await self._client.post(
                url, params=params, headers=headers,
                content=_flux_latest_heartbeat(cfg["bucket"], LOOKBACK_WINDOW),
                timeout=httpx.Timeout(3.0),
            )
            resp.raise_for_status()
        except httpx.ConnectError as exc:
            return out, False, f"connect refused: {exc!s}"
        except httpx.ConnectTimeout:
            return out, False, "connect timeout"
        except httpx.ReadTimeout:
            return out, False, "read timeout"
        except httpx.HTTPStatusError as exc:
            return out, False, f"HTTP {exc.response.status_code}"
        except Exception as exc:
            log.warning("listener-health: %s hb_seq query failed: %s", site, exc)
            return out, False, f"{type(exc).__name__}: {exc}"

        for row in _parse_csv_rows(resp.text):
            site_tag = row.get("site") or site
            oem      = row.get("oem")
            listener = row.get("listener")
            time_iso = row.get("_time")
            value    = row.get("_value")
            if not (oem and listener and time_iso):
                continue
            try:
                from datetime import datetime
                # Influx ISO with 'Z'
                ts = datetime.fromisoformat(time_iso.replace("Z", "+00:00")).timestamp()
            except Exception:
                continue
            lid = f"{site_tag}:{oem}"
            out[lid] = {
                "site":       site_tag,
                "oem":        oem,
                "listener":   listener,
                "last_seen":  ts,
                "hb_seq":     int(value) if value and value.lstrip("-").isdigit() else 0,
            }

        # msg_count enrichment — best effort, doesn't affect reachability
        try:
            resp2 = await self._client.post(
                url, params=params, headers=headers,
                content=_flux_latest_msg_count(cfg["bucket"], LOOKBACK_WINDOW),
                timeout=httpx.Timeout(3.0),
            )
            resp2.raise_for_status()
            for row in _parse_csv_rows(resp2.text):
                site_tag = row.get("site") or site
                oem      = row.get("oem")
                value    = row.get("_value")
                if not (oem and value):
                    continue
                lid = f"{site_tag}:{oem}"
                if lid in out:
                    out[lid]["msg_count"] = int(value) if value.lstrip("-").isdigit() else 0
        except Exception:
            pass

        return out, True, None

    # ---- public read APIs ----

    def snapshot(self) -> Dict[str, Any]:
        listeners = []
        for row in self._state.values():
            listeners.append({
                "id":         row["id"],
                "site":       row["site"],
                "oem":        row["oem"],
                "listener":   row["listener"],
                "state":      row["state"],
                "last_seen":  row.get("last_seen"),
                "age_s":      row.get("age_s"),
                "down_since": row.get("down_since"),
                "msg_count":  row.get("msg_count", 0),
                "hb_seq":     row.get("hb_seq", 0),
                "event_key":  row.get("event_key"),
            })
        # Sort: down first (newest down on top), then unknown, then up.
        listeners.sort(key=lambda r: (
            {"down": 0, "unknown": 1, "up": 2}.get(r["state"], 3),
            -(r.get("down_since") or 0),
            r["site"], r["oem"],
        ))
        down_events = sorted(
            self._down_events.values(),
            key=lambda e: e.get("raised_at", 0),
        )
        return {
            "ok":            True,
            "as_of":         time.time(),
            "poll_interval": POLL_INTERVAL_S,
            "down_threshold_s": DOWN_THRESHOLD_S,
            "listeners":     listeners,
            "down_events":   down_events,
        }
