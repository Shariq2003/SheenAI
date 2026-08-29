"""Recurring templates, scoped to the authenticated user.

    GET  /recurring-templates     list the user's templates
    POST /recurring-templates     create one (and materialize today's task if
                                   it runs today)
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.core.time import today_local
from app.models.category import Category
from app.models.recurring_template import RecurringTemplate
from app.schemas.recurring import RecurringTemplateCreate, RecurringTemplateOut
from app.services.recurring import generate_tasks_for_date

router = APIRouter(prefix="/recurring-templates", tags=["recurring-templates"])


@router.get("", response_model=list[RecurringTemplateOut])
async def list_templates(
    user: CurrentUser, db: DbSession
) -> list[RecurringTemplate]:
    result = await db.execute(
        select(RecurringTemplate)
        .options(selectinload(RecurringTemplate.category))
        .where(RecurringTemplate.user_id == user.id)
        .order_by(RecurringTemplate.scheduled_start, RecurringTemplate.id)
    )
    return list(result.scalars().all())


@router.post(
    "", response_model=RecurringTemplateOut, status_code=status.HTTP_201_CREATED
)
async def create_template(
    payload: RecurringTemplateCreate, user: CurrentUser, db: DbSession
) -> RecurringTemplate:
    if await db.get(Category, payload.category_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown category_id {payload.category_id}",
        )

    template = RecurringTemplate(
        user_id=user.id,
        category_id=payload.category_id,
        title=payload.title,
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        prayer_slot=payload.prayer_slot,
        active=payload.active,
    )
    template.days = payload.days  # list[int] | None -> CSV column
    db.add(template)
    await db.commit()

    # If it's active and runs today, make today's task show up immediately.
    if template.active:
        await generate_tasks_for_date(db, user.id, today_local())
        await db.commit()

    return await _reload(db, template.id, user.id)


async def _reload(db: DbSession, tpl_id: int, user_id: int) -> RecurringTemplate:
    result = await db.execute(
        select(RecurringTemplate)
        .options(selectinload(RecurringTemplate.category))
        .where(
            RecurringTemplate.id == tpl_id,
            RecurringTemplate.user_id == user_id,
        )
    )
    return result.scalar_one()
