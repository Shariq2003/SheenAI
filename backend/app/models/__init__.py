"""ORM models.

Importing every model here means a single `import app.models` populates
`Base.metadata` with all tables — which is what Alembic's env.py relies on for
autogenerate.
"""

from app.core.database import Base
from app.models.category import Category
from app.models.enums import PrayerSlot, TaskStatus
from app.models.recurring_template import RecurringTemplate
from app.models.task import Task
from app.models.user import User

__all__ = [
    "Base",
    "Category",
    "PrayerSlot",
    "TaskStatus",
    "RecurringTemplate",
    "Task",
    "User",
]
