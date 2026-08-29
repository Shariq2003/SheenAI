"""Top-level API router.

Sub-routers are added here as each build step lands them (auth, tasks,
recurring-templates, stats). For now it only wires up the health checks.
"""

from fastapi import APIRouter

from app.api.routes import health

api_router = APIRouter()
api_router.include_router(health.router)
