"""SheenAI backend entrypoint.

Run locally with:
    uvicorn app.main:app --reload --port 8000

Interactive docs at http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core import keepalive
from app.core.config import settings
from app.core.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: begin the keep-alive self-ping (no-op unless a target URL is set).
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
