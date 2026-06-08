"""Application settings, loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    studio_name: str = "Your Studio Name"
    cors_origins: str = "http://localhost:5173"
    timezone: str = "Asia/Kolkata"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Admin
    admin_email: str = ""
    admin_password: str = ""
    admin_jwt_secret: str = ""

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # Email (Resend) — empty api key disables sending
    resend_api_key: str = ""
    reminder_from_email: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def email_enabled(self) -> bool:
        return bool(self.resend_api_key and self.reminder_from_email)


@lru_cache
def get_settings() -> Settings:
    return Settings()
