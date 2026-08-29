"""Shared FastAPI dependencies."""

from datetime import date
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.time import today_local
from app.models.user import User
from app.services.recurring import ensure_daily_setup

# Reads the "Authorization: Bearer <token>" header. Swagger shows an Authorize
# box where you paste the raw token returned by /auth/login.
# auto_error=False so a *missing* header yields our own 401 (not FastAPI's
# default 403), matching the response for an invalid token.
bearer_scheme = HTTPBearer(auto_error=False)

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None:
        raise _credentials_exc
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise _credentials_exc

    user = await db.get(User, user_id)
    if user is None:
        raise _credentials_exc
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


# --- Daily recurring-task generation on first request of the local day ---
# Process-local guard so we hit the DB for generation at most once per user per
# day per worker. It's a cache, not a lock: if generation fails we don't record
# the date and the next request retries; the DB unique constraint keeps
# concurrent workers from double-inserting.
_daily_generated: dict[int, date] = {}


async def get_current_user_synced(
    user: CurrentUser, db: DbSession
) -> User:
    today = today_local()
    if _daily_generated.get(user.id) != today:
        await ensure_daily_setup(db, user.id, today)
        _daily_generated[user.id] = today
    return user


CurrentUserSynced = Annotated[User, Depends(get_current_user_synced)]


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()
