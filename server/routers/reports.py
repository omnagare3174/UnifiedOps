from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Query, Response
from services.reports import ReportService

log = logging.getLogger("unifiedops.router.reports")
router = APIRouter(prefix="/api/reports", tags=["Reports"])

_svc: Optional[ReportService] = None

def configure(svc: ReportService) -> None:
    global _svc
    _svc = svc

@router.get("/download")
async def download_report(
    range: str = Query("1d", description="Time range, e.g. 6h, 1d, 7d"),
    site: Optional[List[str]] = Query(None, description="Filter by sites (e.g. CDVL, BCP)"),
    vendor: Optional[List[str]] = Query(None, description="Filter by vendor (e.g. hitachi, brocade)"),
    format: str = Query("csv", description="Format: csv, xlsx, pdf"),
) -> Response:
    if _svc is None:
        return Response(status_code=503, content="ReportService not configured")
        
    content, media_type, ext = await _svc.get_multi_format_report(
        range_key=range,
        sites=site,
        vendors=vendor,
        fmt=format
    )
    
    filename = f"unifiedops_alerts_{range}.{ext}"
    
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
