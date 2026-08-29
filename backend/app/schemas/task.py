"""Task request/response schemas."""

from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import TaskStatus
from app.schemas.category import CategoryOut


class TaskCreate(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus = TaskStatus.pending
    scheduled_date: date
    scheduled_start: time | None = None
    scheduled_end: time | None = None

    @model_validator(mode="after")
    def _check_time_order(self) -> "TaskCreate":
        s, e = self.scheduled_start, self.scheduled_end
        if s is not None and e is not None and e < s:
            raise ValueError("scheduled_end must not be before scheduled_start")
        return self


class TaskUpdate(BaseModel):
    """All fields optional. Unset fields are left untouched; explicit null
    clears the column (for the nullable ones)."""

    category_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus | None = None
    scheduled_date: date | None = None
    scheduled_start: time | None = None
    scheduled_end: time | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    template_id: int | None
    title: str
    description: str | None
    status: TaskStatus
    scheduled_date: date
    scheduled_start: time | None
    scheduled_end: time | None
    completed_at: datetime | None
    created_at: datetime
    category: CategoryOut

    @property
    def is_recurring(self) -> bool:  # pragma: no cover - convenience only
        return self.template_id is not None
