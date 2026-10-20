import logging
import ssl
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def send_otp_email(recipient: str, code: str, purpose: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        return False

    try:
        message = MIMEText(
            f"Your SignVaani verification code is: {code}\n\nValid for 5 minutes."
        )
        message["Subject"] = (
            "SignVaani Registration Verification"
            if purpose == "registration"
            else "SignVaani Verification Code"
        )
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = recipient

        is_ssl = settings.SMTP_PORT == 465
        smtp_client = (
            smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=5,
                context=ssl.create_default_context(),
            )
            if is_ssl
            else smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5)
        )
        with smtp_client as server:
            if not is_ssl:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            if settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)
        return True
    except Exception:
        logger.exception("Failed to deliver %s OTP email.", purpose)
        return False
