"""Application configuration.

Loads settings from environment variables (and a local .env file in development)
using pydantic-settings. The one value every part of the app needs is the
database connection string; everything else has a sane default for local dev.
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Core ---
    environment: str = Field(default="development", alias="ENVIRONMENT")

    # IANA name used to decide what "today" is for recurring-task generation
    # and stats day/week bucketing. The routine (gym at 07:00, 5 prayers) is
    # local, so this should be the user's zone, not the server's UTC.
    timezone: str = Field(default="Asia/Kolkata", alias="TIMEZONE")

    # --- Database ---
    # Accepts the plain postgresql:// or postgres:// URL that Supabase/Neon hand
    # out; normalized to the async driver form in the validator below.
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/sheenai",
        alias="DATABASE_URL",
    )

    # --- Auth (used from step 3) ---
    secret_key: str = Field(default="change-me-in-production", alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(
        default=10080, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    jwt_algorithm: str = "HS256"

    # --- CORS ---
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173, https://sheenai.onrender.com",
        alias="CORS_ORIGINS",
    )

    # --- Keep-alive (defeats Render free-tier spin-down after 15 min idle) ---
    # An in-process task pings the app's own /health every interval. It uses
    # KEEPALIVE_URL if set, otherwise RENDER_EXTERNAL_URL (Render injects this
    # automatically). With neither set (local dev) the task never starts.
    keepalive_url: str = Field(default="", alias="KEEPALIVE_URL")
    render_external_url: str = Field(default="", alias="RENDER_EXTERNAL_URL")
    keepalive_interval_seconds: int = Field(
        default=600, alias="KEEPALIVE_INTERVAL_SECONDS"
    )

    @property
    def self_ping_url(self) -> str | None:
        """Absolute URL of the health endpoint to self-ping, or None to disable."""
        base = (self.keepalive_url or self.render_external_url).strip().rstrip("/")
        return f"{base}/health" if base else None

    @field_validator("database_url")
    @classmethod
    def _normalize_async_driver(cls, v: str) -> str:
        """Rewrite the connection string to use the asyncpg driver.

        Supabase/Neon/Render all expose `postgresql://` (or the legacy
        `postgres://`). SQLAlchemy's async engine needs the driver spelled out.
        """
        if v.startswith("postgresql+asyncpg://"):
            return v
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so the .env file is parsed once per process."""
    return Settings()


settings = get_settings()
