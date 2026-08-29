"""Task CRUD, scoped to the authenticated user.

    GET    /tasks              list, filterable by date / category / status
    POST   /tasks              create a manual task (template_id is always null)
    PATCH  /tasks/{id}         partial update
    DELETE /tasks/{id}         remove
"""

from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, CurrentUserSynced, DbSession
from app.models.category import Category
from app.models.enums import TaskStatus
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _get_category_or_400(db: DbSession, category_id: int) -> Category:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown category_id {category_id}",
        )
    return category


async def _get_owned_task(db: DbSession, task_id: int, user_id: int) -> Task:
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.category))
        .where(Task.id == task_id, Task.user_id == user_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    user: CurrentUserSynced,
    db: DbSession,
    on_date: Annotated[
        date | None, Query(alias="date", description="exact scheduled_date")
    ] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    category_id: int | None = None,
    task_status: Annotated[TaskStatus | None, Query(alias="status")] = None,
) -> list[Task]:
    stmt = (
        select(Task)
        .options(selectinload(Task.category))
        .where(Task.user_id == user.id)
    )
    if on_date is not None:
        stmt = stmt.where(Task.scheduled_date == on_date)
    if date_from is not None:
        stmt = stmt.where(Task.scheduled_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Task.scheduled_date <= date_to)
    if category_id is not None:
        stmt = stmt.where(Task.category_id == category_id)
    if task_status is not None:
        stmt = stmt.where(Task.status == task_status)

    stmt = stmt.order_by(
        Task.scheduled_date.asc(),
        Task.scheduled_start.asc().nullslast(),
        Task.id.asc(),
    )
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate, user: CurrentUser, db: DbSession
) -> Task:
    await _get_category_or_400(db, payload.category_id)

    task = Task(
        user_id=user.id,
        template_id=None,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        scheduled_date=payload.scheduled_date,
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        completed_at=(
            datetime.now(timezone.utc)
            if payload.status == TaskStatus.done
            else None
        ),
    )
    db.add(task)
    await db.commit()
    return await _get_owned_task(db, task.id, user.id)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int, payload: TaskUpdate, user: CurrentUser, db: DbSession
) -> Task:
    task = await _get_owned_task(db, task_id, user.id)
    data = payload.model_dump(exclude_unset=True)

    if "category_id" in data and data["category_id"] is not None:
        await _get_category_or_400(db, data["category_id"])

    if "status" in data and data["status"] is not None:
        new_status: TaskStatus = data["status"]
        if new_status == TaskStatus.done and task.completed_at is None:
            task.completed_at = datetime.now(timezone.utc)
        elif new_status != TaskStatus.done:
            task.completed_at = None

    # Explicit null is allowed only for the nullable columns.
    non_nullable = {"title", "category_id", "scheduled_date", "status"}
    for field, value in data.items():
        if value is None and field in non_nullable:
            continue
        setattr(task, field, value)

    if (
        task.scheduled_start is not None
        and task.scheduled_end is not None
        and task.scheduled_end < task.scheduled_start
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="scheduled_end must not be before scheduled_start",
        )

    await db.commit()
    return await _get_owned_task(db, task.id, user.id)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, user: CurrentUser, db: DbSession) -> None:
    task = await _get_owned_task(db, task_id, user.id)
    await db.delete(task)
    await db.commit()
