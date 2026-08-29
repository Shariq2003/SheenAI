"""replace tasks composite index with a unique constraint (recurring de-dupe)

Revision ID: 20260829_0002
Revises: 20260829_0001
Create Date: 2026-08-29

Enforces "one generated task per template per user per day" at the DB level so
recurring generation is idempotent even under concurrent requests. NULL
template_id rows (manual tasks) are unaffected — Postgres treats NULLs as
distinct in a unique index.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260829_0002"
down_revision: str | None = "20260829_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_tasks_user_date_template", table_name="tasks")
    op.create_unique_constraint(
        "uq_tasks_user_date_template",
        "tasks",
        ["user_id", "scheduled_date", "template_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_tasks_user_date_template", "tasks", type_="unique"
    )
    op.create_index(
        "ix_tasks_user_date_template",
        "tasks",
        ["user_id", "scheduled_date", "template_id"],
    )
