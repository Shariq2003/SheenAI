"""Pydantic request/response schemas."""

from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from app.schemas.category import CategoryOut
from app.schemas.recurring import (
    RecurringTemplateCreate,
    RecurringTemplateOut,
)
from app.schemas.stats import (
    CompletionStats,
    StatsResponse,
    StreaksStats,
    TimeBreakdownStats,
)
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate

__all__ = [
    "LoginRequest",
    "SignupRequest",
    "TokenResponse",
    "UserOut",
    "CategoryOut",
    "RecurringTemplateCreate",
    "RecurringTemplateOut",
    "TaskCreate",
    "TaskOut",
    "TaskUpdate",
    "CompletionStats",
    "StatsResponse",
    "StreaksStats",
    "TimeBreakdownStats",
]
