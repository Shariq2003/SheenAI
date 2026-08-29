"""RecurringTemplate model — a rule that spawns a daily task.

Examples the app seeds/creates per user:
  - Gym, daily 07:00-08:15
  - Office, Mon-Fri 10:00-19:00
  - 5 prayer slots (Fajr..Isha), daily, each with `prayer_slot` set

`days_of_week` is stored as a comma-separated list of weekday ints using
Python's convention (Monday=0 .. Sunday=6), e.g. "0,1,2,3,4" for weekdays.
Use the `days` property to read/write it as a list.
"""

from sqlalchemy import Boolean, ForeignKey, String, Time, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PrayerSlot

import datetime as _dt


class RecurringTemplate(Base):
    __tablename__ = "recurring_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    scheduled_start: Mapped[_dt.time] = mapped_column(Time, nullable=False)
    scheduled_end: Mapped[_dt.time] = mapped_column(Time, nullable=False)
    # Comma-separated weekday ints (Mon=0..Sun=6). "" / null => every day.
    days_of_week: Mapped[str | None] = mapped_column(String(20), nullable=True)
    prayer_slot: Mapped[PrayerSlot | None] = mapped_column(
        String(10), nullable=True
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )

    user: Mapped["User"] = relationship(back_populates="recurring_templates")  # noqa: F821
    category: Mapped["Category"] = relationship(  # noqa: F821
        back_populates="recurring_templates"
    )
    tasks: Mapped[list["Task"]] = relationship(back_populates="template")  # noqa: F821

    # --- days_of_week helpers ---
    @property
    def days(self) -> list[int]:
        if not self.days_of_week:
            return list(range(7))
        return [int(p) for p in self.days_of_week.split(",") if p != ""]

    @days.setter
    def days(self, value: list[int] | None) -> None:
        if not value:
            self.days_of_week = None
        else:
            self.days_of_week = ",".join(str(int(d)) for d in sorted(set(value)))

    def runs_on(self, day: _dt.date) -> bool:
        return self.active and day.weekday() in self.days

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RecurringTemplate id={self.id} title={self.title!r} active={self.active}>"
