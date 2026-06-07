"""
Alert scraper.

Queries all 11 per-vendor / per-site InfluxDB buckets and returns a merged,
time-sorted list of recent alerts in the shape expected by the React
dashboard (`RecentAlert`). This replaces the in-browser `buildLiveAlert()`
simulator that previously synthesized fake alerts every 9 seconds.

Each listener writes to its own bucket — e.g. `Hitachi_CDVL_Bucket`,
`NetApp_SIFY_Bucket`, etc. — with vendor-specific measurements
(`modular_storage`, `enterprise_storage`, `netapp_event`, `dell_event`,
brocade switch measurements, ...). This scraper normalizes the heterogeneous
tag/field layouts into a single uniform JSON shape:

    {
        time:        "2026-05-31 02:18:50",
        ts:          1780...,         // epoch ms
        severity:    "warning",       // lower-cased, one of the 5 canonical values
        storageName: "VSP_5500_30260-BCP",
        ip:          "10.225.39.253",
        event:       "I/O pool threshold reached",
        category:    "performance",
        location:    "BCP",           // CDVL | BCP | SIFY
        vendor:      "hitachi",       // hitachi | brocade | netapp | dell
    }
"""
from __future__ import annotations

import asyncio
import csv
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

log = logging.getLogger("hi-track-ui.alert_scraper")


# ---------------------------------------------------------------------------
# Bucket topology — matches the dev launcher scripts at dev/run-listener-*.ps1
# ---------------------------------------------------------------------------
VENDOR_BUCKETS: List[Dict[str, str]] = [
    # ---- Hitachi ---------------------------------------------------------
    {
        "site":   "CDVL", "vendor": "hitachi",
        "url":    os.environ.get("HITRACK_BUCKET_HITACHI_CDVL_URL",    "http://127.0.0.1:8086"),
        "token":  os.environ.get("HITRACK_BUCKET_HITACHI_CDVL_TOKEN",  "unifiedops-dev-token-cdvl"),
        "org":    os.environ.get("HITRACK_BUCKET_HITACHI_CDVL_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_HITACHI_CDVL_BUCKET", "Hitachi_CDVL_Bucket"),
    },
    {
        "site":   "BCP",  "vendor": "hitachi",
        "url":    os.environ.get("HITRACK_BUCKET_HITACHI_BCP_URL",    "http://127.0.0.1:8087"),
        "token":  os.environ.get("HITRACK_BUCKET_HITACHI_BCP_TOKEN",  "unifiedops-dev-token-bcp"),
        "org":    os.environ.get("HITRACK_BUCKET_HITACHI_BCP_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_HITACHI_BCP_BUCKET", "Hitachi_BCP_Bucket"),
    },
    {
        "site":   "SIFY", "vendor": "hitachi",
        "url":    os.environ.get("HITRACK_BUCKET_HITACHI_SIFY_URL",    "http://127.0.0.1:8088"),
        "token":  os.environ.get("HITRACK_BUCKET_HITACHI_SIFY_TOKEN",  "unifiedops-dev-token-sify"),
        "org":    os.environ.get("HITRACK_BUCKET_HITACHI_SIFY_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_HITACHI_SIFY_BUCKET", "Hitachi_SIFY_Bucket"),
    },
    # ---- Brocade ---------------------------------------------------------
    {
        "site":   "CDVL", "vendor": "brocade",
        "url":    os.environ.get("HITRACK_BUCKET_BROCADE_CDVL_URL",    "http://127.0.0.1:8186"),
        "token":  os.environ.get("HITRACK_BUCKET_BROCADE_CDVL_TOKEN",  "unifiedops-dev-token-brocade-cdvl"),
        "org":    os.environ.get("HITRACK_BUCKET_BROCADE_CDVL_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_BROCADE_CDVL_BUCKET", "Brocade_CDVL_Bucket"),
    },
    {
        "site":   "BCP",  "vendor": "brocade",
        "url":    os.environ.get("HITRACK_BUCKET_BROCADE_BCP_URL",    "http://127.0.0.1:8187"),
        "token":  os.environ.get("HITRACK_BUCKET_BROCADE_BCP_TOKEN",  "unifiedops-dev-token-brocade-bcp"),
        "org":    os.environ.get("HITRACK_BUCKET_BROCADE_BCP_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_BROCADE_BCP_BUCKET", "Brocade_BCP_Bucket"),
    },
    # ---- NetApp ----------------------------------------------------------
    {
        "site":   "CDVL", "vendor": "netapp",
        "url":    os.environ.get("HITRACK_BUCKET_NETAPP_CDVL_URL",    "http://127.0.0.1:8286"),
        "token":  os.environ.get("HITRACK_BUCKET_NETAPP_CDVL_TOKEN",  "unifiedops-dev-token-netapp-cdvl"),
        "org":    os.environ.get("HITRACK_BUCKET_NETAPP_CDVL_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_NETAPP_CDVL_BUCKET", "NetApp_CDVL_Bucket"),
    },
    {
        "site":   "BCP",  "vendor": "netapp",
        "url":    os.environ.get("HITRACK_BUCKET_NETAPP_BCP_URL",    "http://127.0.0.1:8287"),
        "token":  os.environ.get("HITRACK_BUCKET_NETAPP_BCP_TOKEN",  "unifiedops-dev-token-netapp-bcp"),
        "org":    os.environ.get("HITRACK_BUCKET_NETAPP_BCP_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_NETAPP_BCP_BUCKET", "NetApp_BCP_Bucket"),
    },
    {
        "site":   "SIFY", "vendor": "netapp",
        "url":    os.environ.get("HITRACK_BUCKET_NETAPP_SIFY_URL",    "http://127.0.0.1:8288"),
        "token":  os.environ.get("HITRACK_BUCKET_NETAPP_SIFY_TOKEN",  "unifiedops-dev-token-netapp-sify"),
        "org":    os.environ.get("HITRACK_BUCKET_NETAPP_SIFY_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_NETAPP_SIFY_BUCKET", "NetApp_SIFY_Bucket"),
    },
    # ---- Dell ------------------------------------------------------------
    {
        "site":   "CDVL", "vendor": "dell",
        "url":    os.environ.get("HITRACK_BUCKET_DELL_CDVL_URL",    "http://127.0.0.1:8386"),
        "token":  os.environ.get("HITRACK_BUCKET_DELL_CDVL_TOKEN",  "unifiedops-dev-token-dell-cdvl"),
        "org":    os.environ.get("HITRACK_BUCKET_DELL_CDVL_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_DELL_CDVL_BUCKET", "Dell_CDVL_Bucket"),
    },
    {
        "site":   "BCP",  "vendor": "dell",
        "url":    os.environ.get("HITRACK_BUCKET_DELL_BCP_URL",    "http://127.0.0.1:8387"),
        "token":  os.environ.get("HITRACK_BUCKET_DELL_BCP_TOKEN",  "unifiedops-dev-token-dell-bcp"),
        "org":    os.environ.get("HITRACK_BUCKET_DELL_BCP_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_DELL_BCP_BUCKET", "Dell_BCP_Bucket"),
    },
    {
        "site":   "SIFY", "vendor": "dell",
        "url":    os.environ.get("HITRACK_BUCKET_DELL_SIFY_URL",    "http://127.0.0.1:8388"),
        "token":  os.environ.get("HITRACK_BUCKET_DELL_SIFY_TOKEN",  "unifiedops-dev-token-dell-sify"),
        "org":    os.environ.get("HITRACK_BUCKET_DELL_SIFY_ORG",    "HDFC"),
        "bucket": os.environ.get("HITRACK_BUCKET_DELL_SIFY_BUCKET", "Dell_SIFY_Bucket"),
    },
]

# Defaults — overridable via env (frontend may pass `limit` via query string).
DEFAULT_LIMIT_PER_BUCKET = max(20, int(os.environ.get("HITRACK_ALERTS_PER_BUCKET", "50")))
DEFAULT_LOOKBACK_S       = max(60, int(os.environ.get("HITRACK_ALERTS_LOOKBACK_S", "21600")))  # 6h
REQUEST_TIMEOUT_S        = max(1.0, float(os.environ.get("HITRACK_ALERTS_HTTP_TIMEOUT", "3.0")))


_VALID_SEVERITIES = ("critical", "error", "warning", "notice", "informational")


def _normalize_severity(raw: str) -> str:
    """Normalize incoming severity tag to one of the 5 canonical UI values."""
    if not raw:
        return "informational"
    s = raw.strip().lower()
    if s in _VALID_SEVERITIES:
        return s
    # Common variations
    if s in ("crit", "fatal", "alert", "emergency"):
        return "critical"
    if s in ("err", "failure", "failed"):
        return "error"
    if s in ("warn",):
        return "warning"
    if s in ("info", "infomational"):
        return "informational"
    if s in ("note",):
        return "notice"
    # Fallback — unknown labels become notice so they don't fake critical
    return "notice"


def _flux_recent(bucket: str, lookback_s: int, limit: int) -> str:
    """Pull the most-recent `limit` `message`-bearing rows.

    We filter to common message field names so the resulting CSV has one row
    per logical alert (not one row per field), then keep both tag columns
    and `_value` (the message body). All vendors use one of these field
    names, so a single query works across the heterogenous schemas:

        Hitachi  -> field `message`
        Brocade  -> field `message`
        NetApp   -> field `preview`
        Dell     -> field `preview`
    """
    return (
        f'from(bucket: "{bucket}")\n'
        f'  |> range(start: -{lookback_s}s)\n'
        f'  |> filter(fn: (r) => r._measurement != "syslog_listener_heartbeat")\n'
        f'  |> filter(fn: (r) => r._field == "message" or r._field == "preview" or r._field == "raw_message")\n'
        f'  |> sort(columns: ["_time"], desc: true)\n'
        f'  |> limit(n: {limit})\n'
    )


def _parse_csv(text: str) -> List[Dict[str, str]]:
    """Parse Flux annotated-CSV. Same logic as PipelineMonitor; kept local
    so this module can be reused in isolation."""
    rows: List[Dict[str, str]] = []
    header: List[str] = []
    for raw in text.splitlines():
        if not raw:
            header = []
            continue
        if raw.startswith("#"):
            header = []
            continue
        cells = next(csv.reader([raw]), None)
        if cells is None:
            continue
        if not header:
            header = cells
            continue
        if len(cells) != len(header):
            continue
        row: Dict[str, str] = {}
        for h, v in zip(header, cells):
            if not h or h in ("result", "table"):
                continue
            row[h] = v
        rows.append(row)
    return rows


def _row_to_alert(row: Dict[str, str], site: str, vendor: str) -> Optional[Dict[str, Any]]:
    """Map a Flux CSV row into the dashboard `RecentAlert` shape.

    Tag presence varies by vendor:
        - Hitachi rows have `array_name`
        - Brocade rows have `switch_name`
        - NetApp / Dell rows have `array_name`
        - Hostname is a field on most rows
    """
    time_iso = row.get("_time")
    if not time_iso:
        return None

    try:
        dt = datetime.fromisoformat(time_iso.replace("Z", "+00:00"))
    except Exception:
        return None
    ts_ms = int(dt.timestamp() * 1000)
    local_dt = dt.astimezone()
    time_str = local_dt.strftime("%Y-%m-%d %H:%M:%S")

    storage_name = (
        row.get("array_name")
        or row.get("switch_name")
        or row.get("hostname")
        or row.get("source_ip", "-")
    )
    if storage_name in ("", "unknown", "-"):
        storage_name = row.get("source_ip", "-")

    # `_value` carries the message text (we filtered to message-bearing fields).
    event_text = (
        row.get("_value")
        or row.get("message")
        or row.get("preview")
        or row.get("raw_message")
        or "-"
    )
    # Trim hugely long syslog bodies so the table stays usable.
    if len(event_text) > 300:
        event_text = event_text[:297] + "..."

    return {
        "time":        time_str,
        "ts":          ts_ms,
        "severity":    _normalize_severity(row.get("severity", "")),
        "storageName": storage_name,
        "ip":          row.get("source_ip", "-"),
        "event":       event_text,
        "category":    row.get("trap_category") or "other",
        "location":    site,
        "vendor":      vendor,
    }


async def _fetch_bucket(
    client: httpx.AsyncClient,
    cfg: Dict[str, str],
    lookback_s: int,
    limit: int,
) -> Tuple[List[Dict[str, Any]], bool, Optional[str]]:
    """Fetch + normalize alerts from one bucket. Returns (alerts, ok, error)."""
    if not cfg.get("token"):
        return [], False, "no token configured"

    url = cfg["url"].rstrip("/") + "/api/v2/query"
    headers = {
        "Authorization": f"Token {cfg['token']}",
        "Accept":        "application/csv",
        "Content-Type":  "application/vnd.flux",
    }
    params = {"org": cfg["org"]}
    flux = _flux_recent(cfg["bucket"], lookback_s, limit)

    try:
        resp = await client.post(
            url, params=params, headers=headers, content=flux,
            timeout=httpx.Timeout(REQUEST_TIMEOUT_S),
        )
        resp.raise_for_status()
    except httpx.ConnectError as exc:
        return [], False, f"connect refused: {exc!s}"
    except (httpx.ConnectTimeout, httpx.ReadTimeout):
        return [], False, "timeout"
    except httpx.HTTPStatusError as exc:
        return [], False, f"HTTP {exc.response.status_code}"
    except Exception as exc:
        return [], False, f"{type(exc).__name__}: {exc}"

    alerts: List[Dict[str, Any]] = []
    for row in _parse_csv(resp.text):
        a = _row_to_alert(row, cfg["site"], cfg["vendor"])
        if a is not None:
            alerts.append(a)
    return alerts, True, None


class AlertScraper:
    """Stateless multi-bucket alert query helper.

    The dashboard polls `/api/alerts/recent` every few seconds and we
    fan-out one Flux query per bucket in parallel. There is no in-memory
    cursor — each call covers the full lookback window — so the response
    is always self-contained.
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def recent(
        self,
        limit: int = 200,
        lookback_s: int = DEFAULT_LOOKBACK_S,
        per_bucket: int = DEFAULT_LIMIT_PER_BUCKET,
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        results = await asyncio.gather(*[
            _fetch_bucket(self._client, cfg, lookback_s, per_bucket)
            for cfg in VENDOR_BUCKETS
        ])

        merged: List[Dict[str, Any]] = []
        bucket_status: List[Dict[str, Any]] = []
        ok_count = 0
        for cfg, (alerts, ok, err) in zip(VENDOR_BUCKETS, results):
            bucket_status.append({
                "site":   cfg["site"],
                "vendor": cfg["vendor"],
                "bucket": cfg["bucket"],
                "ok":     ok,
                "count":  len(alerts),
                "error":  err,
            })
            if ok:
                ok_count += 1
            merged.extend(alerts)

        # Sort newest-first and cap.
        merged.sort(key=lambda a: a["ts"], reverse=True)
        merged = merged[:limit]

        return {
            "ok":             ok_count > 0,
            "as_of":          time.time(),
            "lookback_s":     lookback_s,
            "buckets_total":  len(VENDOR_BUCKETS),
            "buckets_ok":     ok_count,
            "limit":          limit,
            "count":          len(merged),
            "elapsed_ms":     int((time.perf_counter() - t0) * 1000),
            "alerts":         merged,
            "bucket_status":  bucket_status,
        }
