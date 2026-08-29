"""initial schema: users, categories, recurring_templates, tasks

Revision ID: 20260829_0001
Revises:
Create Date: 2026-08-29

Hand-written (no live DB was available at scaffold time) to match the ORM
models in app/models/ exactly. Verify with `alembic check` once a database
is reachable.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260829_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

task_status = sa.Enum(
    "pending", "in_progress", "done", "missed", name="task_status"
)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "color", sa.String(length=9), nullable=False, server_default="#64748b"
        ),
        sa.Column(
            "is_recurring_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.UniqueConstraint("name", name="uq_categories_name"),
    )

    op.create_table(
        "recurring_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("scheduled_start", sa.Time(), nullable=False),
        sa.Column("scheduled_end", sa.Time(), nullable=False),
        sa.Column("days_of_week", sa.String(length=20), nullable=True),
        sa.Column("prayer_slot", sa.String(length=10), nullable=True),
        sa.Column(
            "active", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
    )
    op.create_index(
        "ix_recurring_templates_user_id", "recurring_templates", ["user_id"]
    )
    op.create_index(
        "ix_recurring_templates_category_id",
        "recurring_templates",
        ["category_id"],
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            task_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("scheduled_start", sa.Time(), nullable=True),
        sa.Column("scheduled_end", sa.Time(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(
            ["template_id"], ["recurring_templates.id"], ondelete="SET NULL"
        ),
    )
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])
    op.create_index("ix_tasks_category_id", "tasks", ["category_id"])
    op.create_index("ix_tasks_template_id", "tasks", ["template_id"])
    op.create_index("ix_tasks_scheduled_date", "tasks", ["scheduled_date"])
    op.create_index("ix_tasks_user_date", "tasks", ["user_id", "scheduled_date"])
    op.create_index(
        "ix_tasks_user_date_template",
        "tasks",
        ["user_id", "scheduled_date", "template_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_user_date_template", table_name="tasks")
    op.drop_index("ix_tasks_user_date", table_name="tasks")
    op.drop_index("ix_tasks_scheduled_date", table_name="tasks")
    op.drop_index("ix_tasks_template_id", table_name="tasks")
    op.drop_index("ix_tasks_category_id", table_name="tasks")
    op.drop_index("ix_tasks_user_id", table_name="tasks")
    op.drop_table("tasks")

    op.drop_index(
        "ix_recurring_templates_category_id", table_name="recurring_templates"
    )
    op.drop_index(
        "ix_recurring_templates_user_id", table_name="recurring_templates"
    )
    op.drop_table("recurring_templates")

    op.drop_table("categories")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    task_status.drop(op.get_bind(), checkfirst=True)
