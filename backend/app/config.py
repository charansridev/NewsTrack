from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://vikram@/newstrack"

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
