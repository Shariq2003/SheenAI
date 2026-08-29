"""Top-level API router.

Sub-routers are added here as each build step lands them (auth, tasks,
recurring-templates, stats). For now it only wires up the health checks.
"""

from fastapi import APIRouter

from app.api.routes import auth, categories, health, stats, tasks

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(tasks.router)
api_router.include_router(stats.router)
