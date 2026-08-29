"""Local-time helpers.

"Today" everywhere in the app means today in `settings.timezone`, not the
server's UTC. Windows ships no zoneinfo database, so `tzdata` is a dependency.
"""

from datetime import date, datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

from app.core.config import settings


@lru_cache
def app_tz() -> ZoneInfo:
    return ZoneInfo(settings.timezone)


def now_local() -> datetime:
    return datetime.now(app_tz())


def today_local() -> date:
    return now_local().date()
