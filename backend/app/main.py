"""SheenAI backend entrypoint.

Run locally with:
    uvicorn app.main:app --reload --port 8000

Interactive docs at http://localhost:8000/docs
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core import keepalive
from app.core.config import settings
from app.core.database import engine

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: log the effective CORS config so a 400 on preflight is easy to
    # diagnose from the deploy logs, then begin the keep-alive self-ping.
    log.info(
        "CORS allow_origins=%s allow_origin_regex=%r",
        settings.cors_origins_list,
        settings.cors_origin_regex or None,
    )
    keepalive.start(app)
    yield
    # Shutdown: stop the keep-alive task and release the connection pool.
    await keepalive.stop(app)
    await engine.dispose()


app = FastAPI(
    title="SheenAI API",
    description="Personal schedule & task tracker — routine, tasks, and logic-based stats.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {
        "name": "SheenAI API",
        "version": app.version,
        "docs": "/docs",
        "health": "/health",
    }
