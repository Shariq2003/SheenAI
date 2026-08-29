"""Task model — the core row.

Two ways a task comes to exist:
  1. Auto-generated each day from an active RecurringTemplate (template_id set).
     Build step 4 implements the generation logic.
  2. Added directly by the user — DSA topics, side-project items, one-offs
     (template_id is null).
"""

import datetime as _dt

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import TaskStatus

task_status_enum = SAEnum(TaskStatus, name="task_status", native_enum=True)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id"), index=True, nullable=False
    )
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("recurring_templates.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        task_status_enum,
        nullable=False,
        default=TaskStatus.pending,
        server_default=TaskStatus.pending.value,
    )

    scheduled_date: Mapped[_dt.date] = mapped_column(Date, nullable=False, index=True)
    scheduled_start: Mapped[_dt.time | None] = mapped_column(Time, nullable=True)
    scheduled_end: Mapped[_dt.time | None] = mapped_column(Time, nullable=True)

    completed_at: Mapped[_dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[_dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="tasks")  # noqa: F821
    category: Mapped["Category"] = relationship(back_populates="tasks")  # noqa: F821
    template: Mapped["RecurringTemplate | None"] = relationship(  # noqa: F821
        back_populates="tasks"
    )

    __table_args__ = (
        # One generated task per template per user per day. Postgres treats NULLs
        # as distinct, so manually-added tasks (template_id IS NULL) never
        # collide — this only de-dupes recurring generation, including races.
        UniqueConstraint(
            "user_id",
            "scheduled_date",
            "template_id",
            name="uq_tasks_user_date_template",
        ),
        # Common list view: a user's tasks on a given day.
        Index("ix_tasks_user_date", "user_id", "scheduled_date"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Task id={self.id} title={self.title!r} "
            f"date={self.scheduled_date} status={self.status.value}>"
        )
