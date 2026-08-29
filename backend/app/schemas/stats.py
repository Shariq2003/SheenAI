"""Stats response schemas.

The dashboard calls **one** endpoint — `GET /stats` — which returns
`StatsResponse` (streaks + time breakdown + completion together). The three
`/stats/*` sub-endpoints exist for debugging and return these same nested
models individually.
"""

from datetime import date

from pydantic import BaseModel


# --- Streaks ---------------------------------------------------------------
class CategoryStreak(BaseModel):
    category_id: int
    category: str
    current_streak: int
    best_streak: int
    last_done_date: date | None


class StreaksStats(BaseModel):
    as_of: date
    by_category: list[CategoryStreak]


# --- Time breakdown -----------------------------------------------------
class CategoryTime(BaseModel):
    category_id: int
    category: str
    color: str
    scheduled_minutes: int
    completed_minutes: int
    task_count: int


class TimeBreakdownStats(BaseModel):
    date_from: date
    date_to: date
    total_scheduled_minutes: int
    total_completed_minutes: int
    by_category: list[CategoryTime]


# --- Completion --------------------------------------------------------
class CompletionBucket(BaseModel):
    period_start: date
    total: int
    done: int
    missed: int
    pending: int
    in_progress: int
    completion_rate: float  # done / total, 0.0 when total == 0


class CompletionStats(BaseModel):
    granularity: str  # "day" | "week"
    date_from: date
    date_to: date
    overall_total: int
    overall_done: int
    overall_completion_rate: float
    buckets: list[CompletionBucket]


# --- Combined --------------------------------------------------------------
class StatsResponse(BaseModel):
    streaks: StreaksStats
    time_breakdown: TimeBreakdownStats
    completion: CompletionStats
