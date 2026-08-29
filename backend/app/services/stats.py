"""Logic-based analytics — no LLM. Pure SQL aggregation + a Python date walk.

  * streaks         — consecutive-day walk per category over done tasks
  * time_breakdown  — SUM(scheduled_end - scheduled_start) grouped by category
  * completion      — done/total grouped by day or ISO week

All three are combined by `compute_all` and served from a single `GET /stats`.
"""

from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today_local
from app.schemas.stats import (
    CategoryStreak,
    CategoryTime,
    CompletionBucket,
    CompletionStats,
    StatsResponse,
    StreaksStats,
    TimeBreakdownStats,
)

DEFAULT_WINDOW_DAYS = 30
_ONE_DAY = timedelta(days=1)


# --- Streaks -------------------------------------------------------------
async def compute_streaks(
    db: AsyncSession, user_id: int, as_of: date | None = None
) -> StreaksStats:
    as_of = as_of or today_local()

    rows = (
        await db.execute(
            text(
                """
                SELECT c.id AS category_id, c.name AS category,
                       t.scheduled_date AS d
                FROM categories c
                LEFT JOIN tasks t
                  ON t.category_id = c.id
                 AND t.user_id = :uid
                 AND t.status = 'done'
                 AND t.scheduled_date <= :as_of
                ORDER BY c.id, d
                """
            ),
            {"uid": user_id, "as_of": as_of},
        )
    ).all()

    # category_id -> (name, set[date])
    per_cat: dict[int, tuple[str, set[date]]] = {}
    for category_id, category, d in rows:
        name, days = per_cat.setdefault(category_id, (category, set()))
        if d is not None:
            days.add(d)

    out: list[CategoryStreak] = []
    for category_id, (name, days) in per_cat.items():
        if not days:
            out.append(
                CategoryStreak(
                    category_id=category_id,
                    category=name,
                    current_streak=0,
                    best_streak=0,
                    last_done_date=None,
                )
            )
            continue

        ordered = sorted(days)

        # best: longest run of consecutive calendar days
        best = run = 1
        for prev, cur in zip(ordered, ordered[1:]):
            run = run + 1 if cur - prev == _ONE_DAY else 1
            best = max(best, run)

        # current: walk back from today, or from yesterday if today isn't done
        # yet (grace so an unbroken streak still shows mid-day)
        if as_of in days:
            anchor = as_of
        elif (as_of - _ONE_DAY) in days:
            anchor = as_of - _ONE_DAY
        else:
            anchor = None

        current = 0
        if anchor is not None:
            cur = anchor
            while cur in days:
                current += 1
                cur -= _ONE_DAY

        out.append(
            CategoryStreak(
                category_id=category_id,
                category=name,
                current_streak=current,
                best_streak=best,
                last_done_date=ordered[-1],
            )
        )

    out.sort(key=lambda s: s.category_id)
    return StreaksStats(as_of=as_of, by_category=out)


# --- Time breakdown ---------------------------------------------------
async def compute_time_breakdown(
    db: AsyncSession,
    user_id: int,
    date_from: date,
    date_to: date,
    category_id: int | None = None,
) -> TimeBreakdownStats:
    params: dict = {"uid": user_id, "df": date_from, "dt": date_to}
    cat_filter = ""
    if category_id is not None:
        cat_filter = "WHERE c.id = :cid"
        params["cid"] = category_id
    rows = (
        await db.execute(
            text(
                f"""
                SELECT
                  c.id AS category_id,
                  c.name AS category,
                  c.color AS color,
                  COALESCE(SUM(
                    EXTRACT(EPOCH FROM (t.scheduled_end - t.scheduled_start)) / 60
                  ) FILTER (
                    WHERE t.scheduled_start IS NOT NULL
                      AND t.scheduled_end IS NOT NULL
                  ), 0) AS scheduled_minutes,
                  COALESCE(SUM(
                    EXTRACT(EPOCH FROM (t.scheduled_end - t.scheduled_start)) / 60
                  ) FILTER (
                    WHERE t.scheduled_start IS NOT NULL
                      AND t.scheduled_end IS NOT NULL
                      AND t.status = 'done'
                  ), 0) AS completed_minutes,
                  COUNT(t.id) AS task_count
                FROM categories c
                LEFT JOIN tasks t
                  ON t.category_id = c.id
                 AND t.user_id = :uid
                 AND t.scheduled_date BETWEEN :df AND :dt
                {cat_filter}
                GROUP BY c.id, c.name, c.color
                ORDER BY c.id
                """
            ),
            params,
        )
    ).all()

    by_category = [
        CategoryTime(
            category_id=r.category_id,
            category=r.category,
            color=r.color,
            scheduled_minutes=round(r.scheduled_minutes),
            completed_minutes=round(r.completed_minutes),
            task_count=r.task_count,
        )
        for r in rows
    ]
    return TimeBreakdownStats(
        date_from=date_from,
        date_to=date_to,
        total_scheduled_minutes=sum(c.scheduled_minutes for c in by_category),
        total_completed_minutes=sum(c.completed_minutes for c in by_category),
        by_category=by_category,
    )


# --- Completion -----------------------------------------------------------
def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())  # Monday


async def compute_completion(
    db: AsyncSession,
    user_id: int,
    date_from: date,
    date_to: date,
    granularity: str = "day",
    category_id: int | None = None,
) -> CompletionStats:
    if granularity not in ("day", "week"):
        raise ValueError("granularity must be 'day' or 'week'")

    period_sql = (
        "t.scheduled_date"
        if granularity == "day"
        else "date_trunc('week', t.scheduled_date)::date"
    )
    params: dict = {"uid": user_id, "df": date_from, "dt": date_to}
    cat_filter = ""
    if category_id is not None:
        cat_filter = "AND t.category_id = :cid"
        params["cid"] = category_id
    rows = (
        await db.execute(
            text(
                f"""
                SELECT
                  {period_sql} AS period_start,
                  COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE t.status = 'done') AS done,
                  COUNT(*) FILTER (WHERE t.status = 'missed') AS missed,
                  COUNT(*) FILTER (WHERE t.status = 'pending') AS pending,
                  COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress
                FROM tasks t
                WHERE t.user_id = :uid
                  AND t.scheduled_date BETWEEN :df AND :dt
                  {cat_filter}
                GROUP BY period_start
                ORDER BY period_start
                """
            ),
            params,
        )
    ).all()

    found = {r.period_start: r for r in rows}

    # dense series so charts have no gaps
    periods: list[date] = []
    if granularity == "day":
        cur = date_from
        while cur <= date_to:
            periods.append(cur)
            cur += _ONE_DAY
    else:
        cur = _week_start(date_from)
        last = _week_start(date_to)
        while cur <= last:
            periods.append(cur)
            cur += timedelta(days=7)

    buckets: list[CompletionBucket] = []
    for p in periods:
        r = found.get(p)
        total = r.total if r else 0
        done = r.done if r else 0
        buckets.append(
            CompletionBucket(
                period_start=p,
                total=total,
                done=done,
                missed=r.missed if r else 0,
                pending=r.pending if r else 0,
                in_progress=r.in_progress if r else 0,
                completion_rate=round(done / total, 4) if total else 0.0,
            )
        )

    overall_total = sum(b.total for b in buckets)
    overall_done = sum(b.done for b in buckets)
    return CompletionStats(
        granularity=granularity,
        date_from=date_from,
        date_to=date_to,
        overall_total=overall_total,
        overall_done=overall_done,
        overall_completion_rate=(
            round(overall_done / overall_total, 4) if overall_total else 0.0
        ),
        buckets=buckets,
    )


# --- Combined ----------------------------------------------------------
def resolve_window(
    date_from: date | None, date_to: date | None
) -> tuple[date, date]:
    end = date_to or today_local()
    start = date_from or (end - timedelta(days=DEFAULT_WINDOW_DAYS - 1))
    if start > end:
        start, end = end, start
    return start, end


async def compute_all(
    db: AsyncSession,
    user_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    granularity: str = "day",
    category_id: int | None = None,
) -> StatsResponse:
    start, end = resolve_window(date_from, date_to)
    return StatsResponse(
        streaks=await compute_streaks(db, user_id, today_local()),
        time_breakdown=await compute_time_breakdown(
            db, user_id, start, end, category_id
        ),
        completion=await compute_completion(
            db, user_id, start, end, granularity, category_id
        ),
    )
