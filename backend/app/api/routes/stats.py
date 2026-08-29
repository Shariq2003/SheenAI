"""Analytics endpoints.

`GET /stats` is what the dashboard calls — one request, everything. The three
sub-endpoints wrap the same service functions and exist for debugging.
"""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserSynced, DbSession
from app.schemas.stats import (
    CompletionStats,
    StatsResponse,
    StreaksStats,
    TimeBreakdownStats,
)
from app.services import stats as stats_service

router = APIRouter(prefix="/stats", tags=["stats"])

Granularity = Literal["day", "week"]
DateFrom = Annotated[date | None, Query()]
DateTo = Annotated[date | None, Query()]


@router.get("", response_model=StatsResponse)
async def get_stats(
    user: CurrentUserSynced,
    db: DbSession,
    date_from: DateFrom = None,
    date_to: DateTo = None,
    granularity: Granularity = "day",
) -> StatsResponse:
    return await stats_service.compute_all(
        db, user.id, date_from, date_to, granularity
    )


@router.get("/streaks", response_model=StreaksStats)
async def get_streaks(user: CurrentUserSynced, db: DbSession) -> StreaksStats:
    return await stats_service.compute_streaks(db, user.id)


@router.get("/time-breakdown", response_model=TimeBreakdownStats)
async def get_time_breakdown(
    user: CurrentUserSynced,
    db: DbSession,
    date_from: DateFrom = None,
    date_to: DateTo = None,
) -> TimeBreakdownStats:
    start, end = stats_service.resolve_window(date_from, date_to)
    return await stats_service.compute_time_breakdown(db, user.id, start, end)


@router.get("/completion", response_model=CompletionStats)
async def get_completion(
    user: CurrentUserSynced,
    db: DbSession,
    date_from: DateFrom = None,
    date_to: DateTo = None,
    granularity: Granularity = "day",
) -> CompletionStats:
    start, end = stats_service.resolve_window(date_from, date_to)
    return await stats_service.compute_completion(
        db, user.id, start, end, granularity
    )
