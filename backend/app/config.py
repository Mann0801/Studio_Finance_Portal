"""Application settings, loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    studio_name: str = "Your Studio Name"
    cors_origins: str = "http://localhost:5173"
    timezone: str = "Asia/Kolkata"
    # Public URL of the student portal — used in WhatsApp/email reminder links.
    student_portal_url: str = "http://localhost:5173"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # Public anon/publishable key. Login now runs on the frontend via Supabase
    # directly, so this is currently unused server-side; kept for compatibility.
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""

    # Admin
    admin_email: str = ""
    admin_password: str = ""
    admin_jwt_secret: str = ""

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # Email (Resend) — empty api key disables sending. Unused (kept for
    # compatibility); the "forgot password" email actually sends via Gmail
    # SMTP below, since it avoids needing a verified sending domain.
    resend_api_key: str = ""
    reminder_from_email: str = ""

    # Gmail SMTP — for a self-serve "forgot password" reset-code email
    # (dedicated Gmail account + an App Password). Built 2026-09-10 then
    # PAUSED: Render's free tier blocks outbound SMTP entirely, so sending
    # hangs/fails there even with valid credentials — needs either a paid
    # Render plan or an HTTP-based email API (e.g. Resend, needs a verified
    # domain) before this can go live. The values stay here unused so
    # re-enabling later is just re-adding the router, not re-doing setup.
    gmail_smtp_user: str = ""
    gmail_smtp_app_password: str = ""

    # Sentry error monitoring — empty DSN disables it (e.g. local dev)
    sentry_dsn: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def email_enabled(self) -> bool:
        return bool(self.resend_api_key and self.reminder_from_email)

    @property
    def gmail_smtp_enabled(self) -> bool:
        return bool(self.gmail_smtp_user and self.gmail_smtp_app_password)


@lru_cache
def get_settings() -> Settings:
    return Settings()
