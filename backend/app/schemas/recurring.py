"""Recurring-template request/response schemas."""

import datetime as _dt

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import PrayerSlot
from app.schemas.category import CategoryOut


class RecurringTemplateCreate(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=200)
    scheduled_start: _dt.time
    scheduled_end: _dt.time
    # Weekday ints, Monday=0 .. Sunday=6. None/empty => every day.
    days: list[int] | None = None
    prayer_slot: PrayerSlot | None = None
    active: bool = True

    @field_validator("days")
    @classmethod
    def _valid_days(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return None
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("days must be integers 0 (Mon) .. 6 (Sun)")
        return sorted(set(v))

    @model_validator(mode="after")
    def _check_time_order(self) -> "RecurringTemplateCreate":
        if self.scheduled_end < self.scheduled_start:
            raise ValueError("scheduled_end must not be before scheduled_start")
        return self


class RecurringTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    title: str
    scheduled_start: _dt.time
    scheduled_end: _dt.time
    days: list[int]  # always expanded (every-day => [0..6])
    prayer_slot: PrayerSlot | None
    active: bool
    category: CategoryOut
