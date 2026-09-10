"""Sends transactional email via Gmail SMTP — a dedicated Gmail account +
App Password (Google Account > Security > App Passwords, needs 2-Step
Verification on). Used only for the self-serve "forgot password" reset
code; no third-party email API or domain verification needed."""
from __future__ import annotations

import smtplib
from email.mime.text import MIMEText

from ..config import get_settings


def send_email(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.gmail_smtp_enabled:
        raise RuntimeError("Gmail SMTP is not configured (GMAIL_SMTP_USER / GMAIL_SMTP_APP_PASSWORD)")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.gmail_smtp_user
    msg["To"] = to

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(settings.gmail_smtp_user, settings.gmail_smtp_app_password)
        server.sendmail(settings.gmail_smtp_user, [to], msg.as_string())
