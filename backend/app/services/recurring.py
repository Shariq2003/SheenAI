"""Recurring routine: default templates + daily task generation.

Flow (no background worker for now):
  * On signup, and on the first authenticated request of each local day
    (see `app.api.deps.get_current_user_synced`), we call `ensure_daily_setup`.
  * It makes sure the user has their default recurring templates, then
    materializes today's tasks for every active template whose weekday matches.

Generation is idempotent: it skips templates that already have a task for the
date, and the `uq_tasks_user_date_template` constraint + ON CONFLICT DO NOTHING
cover the concurrent-request race.
"""

from datetime import date, time

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_local
from app.models.category import Category
from app.models.enums import TaskStatus
from app.models.recurring_template import RecurringTemplate
from app.models.task import Task

WEEKDAYS = [0, 1, 2, 3, 4]  # Mon-Fri

# Default routine seeded per user. Prayer times are sensible placeholders — the
# user edits their own templates once the templates screen exists. `days=None`
# means every day.
DEFAULT_TEMPLATES: list[dict] = [
    {"category": "Gym", "title": "Gym", "start": time(7, 0), "end": time(8, 15),
     "days": None, "prayer_slot": None},
    {"category": "Office", "title": "Office", "start": time(10, 0), "end": time(19, 0),
     "days": WEEKDAYS, "prayer_slot": None},
    {"category": "Prayer", "title": "Fajr", "start": time(5, 0), "end": time(5, 20),
     "days": None, "prayer_slot": "fajr"},
    {"category": "Prayer", "title": "Dhuhr", "start": time(13, 15), "end": time(13, 35),
     "days": None, "prayer_slot": "dhuhr"},
    {"category": "Prayer", "title": "Asr", "start": time(16, 45), "end": time(17, 5),
     "days": None, "prayer_slot": "asr"},
    {"category": "Prayer", "title": "Maghrib", "start": time(18, 45), "end": time(19, 5),
     "days": None, "prayer_slot": "maghrib"},
    {"category": "Prayer", "title": "Isha", "start": time(20, 15), "end": time(20, 35),
     "days": None, "prayer_slot": "isha"},
]


async def _category_ids(db: AsyncSession) -> dict[str, int]:
    rows = (await db.execute(select(Category.name, Category.id))).all()
    return {name: cid for name, cid in rows}


async def ensure_default_templates(
    db: AsyncSession, user_id: int
) -> list[RecurringTemplate]:
    """Create the default recurring templates for a user, once.

    If the user already has any template, this is a no-op and returns [].
    """
    has_any = (
        await db.execute(
            select(RecurringTemplate.id)
            .where(RecurringTemplate.user_id == user_id)
            .limit(1)
        )
    ).first()
    if has_any:
        return []

    cat_ids = await _category_ids(db)
    created: list[RecurringTemplate] = []
    for spec in DEFAULT_TEMPLATES:
        tpl = RecurringTemplate(
            user_id=user_id,
            category_id=cat_ids[spec["category"]],
            title=spec["title"],
            scheduled_start=spec["start"],
            scheduled_end=spec["end"],
            prayer_slot=spec["prayer_slot"],
            active=True,
        )
        tpl.days = spec["days"]  # list[int] | None -> CSV column
        db.add(tpl)
        created.append(tpl)
    await db.flush()
    return created


async def generate_tasks_for_date(
    db: AsyncSession, user_id: int, target_date: date
) -> int:
    """Materialize tasks for every active template that runs on `target_date`.

    Returns the number of tasks actually inserted.
    """
    templates = (
        await db.execute(
            select(RecurringTemplate).where(
                RecurringTemplate.user_id == user_id,
                RecurringTemplate.active.is_(True),
            )
        )
    ).scalars().all()
    if not templates:
        return 0

    already = set(
        (
            await db.execute(
                select(Task.template_id).where(
                    Task.user_id == user_id,
                    Task.scheduled_date == target_date,
                    Task.template_id.is_not(None),
                )
            )
        ).scalars()
    )

    rows = [
        {
            "user_id": user_id,
            "category_id": tpl.category_id,
            "template_id": tpl.id,
            "title": tpl.title,
            "status": TaskStatus.pending,
            "scheduled_date": target_date,
            "scheduled_start": tpl.scheduled_start,
            "scheduled_end": tpl.scheduled_end,
        }
        for tpl in templates
        if tpl.id not in already and tpl.runs_on(target_date)
    ]
    if not rows:
        return 0

    stmt = pg_insert(Task).values(rows).on_conflict_do_nothing(
        constraint="uq_tasks_user_date_template"
    )
    result = await db.execute(stmt)
    return result.rowcount or 0


async def ensure_daily_setup(
    db: AsyncSession, user_id: int, target_date: date | None = None
) -> int:
    """Templates + today's tasks for a user. Commits. Returns tasks created."""
    await ensure_default_templates(db, user_id)
    created = await generate_tasks_for_date(
        db, user_id, target_date or today_local()
    )
    await db.commit()
    return created
