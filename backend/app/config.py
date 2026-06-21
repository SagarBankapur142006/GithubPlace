from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://ideora:ideora@localhost:5432/ideora"
    sync_database_url: str = "postgresql://ideora:ideora@localhost:5432/ideora"
    use_sqlite: bool = False  # set true for local dev without Postgres
    sqlite_path: str = "./ideora_new.db"

    github_token: str = ""
    github_api_base: str = "https://api.github.com"
    github_client_id: str = ""
    github_client_secret: str = ""

    ai_provider: str = "openai"  # openai | gemini
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_currency: str = "INR"

    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    crawl_cooldown_hours: int = 24
    fulfillment_storage_path: str = "./fulfillment_packages"

    cookie_secure: bool = False
    cookie_name: str = "ideora_session"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.use_sqlite:
        path = s.sqlite_path.replace("\\", "/")
        return Settings(
            **{
                **s.model_dump(),
                "database_url": f"sqlite+aiosqlite:///{path}",
                "sync_database_url": f"sqlite:///{path}",
            }
        )
    return s
