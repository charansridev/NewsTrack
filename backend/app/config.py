from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://vikram@/newstrack"

    @property
    def sync_database_url(self) -> str:
        # Render provides `postgres://`, but SQLAlchemy with psycopg3 needs `postgresql+psycopg://`
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    # Two independent JWT systems — never share a secret between them.
    user_jwt_secret: str = "change-me-user-secret"
    driver_jwt_secret: str = "change-me-driver-secret"
    jwt_algorithm: str = "HS256"

    user_access_token_ttl: int = 3600
    driver_access_token_ttl: int = 3600
    user_refresh_token_ttl: int = 604800

    # Background-job thresholds (minutes)
    stale_status_threshold_min: int = 60
    missed_delivery_grace_min: int = 30

    # If True, users in a Hub-type org may also create products (sub-batches).
    # Default OFF — only Administrators and Press-org users create products.
    allow_hub_product_creation: bool = False

    # Periodic background-job scheduler (delay/missed/escalation sweeps).
    enable_background_jobs: bool = True
    background_job_interval_sec: int = 60

    # CORS allowed origins for the browser frontend (comma-separated in .env).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
