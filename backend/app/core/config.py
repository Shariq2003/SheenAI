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
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS",
    )

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
