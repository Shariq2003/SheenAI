"""Authentication routes: signup, login, and the current-user probe."""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import (
    CurrentUserSynced,
    DbSession,
    get_user_by_email,
)
from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from app.services.recurring import ensure_daily_setup

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_for(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserOut.model_validate(user),
    )


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def signup(payload: SignupRequest, db: DbSession) -> TokenResponse:
    if await get_user_by_email(db, payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    # Seed this user's default templates and materialize today's tasks.
    await ensure_daily_setup(db, user.id)
    return _token_for(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    user = await get_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    await ensure_daily_setup(db, user.id)
    return _token_for(user)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUserSynced) -> UserOut:
    return UserOut.model_validate(current_user)
