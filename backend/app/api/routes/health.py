"""Health-check endpoints.

`/health` is a cheap liveness probe (no I/O). `/health/db` additionally
verifies the Postgres connection, which is useful right after deploy and when
debugging the connection string.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import ping_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "environment": settings.environment}


@router.get("/health/db")
async def health_db() -> JSONResponse:
    try:
        ok = await ping_db()
    except Exception as exc:  # pragma: no cover - surface the driver error text
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "unreachable", "detail": str(exc)},
        )
    status_code = 200 if ok else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if ok else "error", "database": "connected" if ok else "error"},
    )
