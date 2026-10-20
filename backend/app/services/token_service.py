"""
Secure Token Generation and Authentication Dependencies
Uses HMAC-SHA256 signature verification over JSON Web Tokens (or secure tokens)
to authenticate users and prevent unauthorized access or ID impersonation.
"""

import hmac
import hashlib
import base64
import json
import time
from typing import Optional
from fastapi import Header, HTTPException, status
from app.config import settings

def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def _b64decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding and padding < 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)

def create_access_token(email: str, expires_in_seconds: Optional[int] = None) -> str:
    """
    Creates a secure, signed URL-safe authentication token containing user email and expiration.
    """
    if expires_in_seconds is None:
        expires_in_seconds = settings.TOKEN_EXPIRE_HOURS * 3600

    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": email.strip().lower(),
        "iat": now,
        "exp": now + expires_in_seconds,
    }

    header_bytes = _b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_bytes = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_bytes}.{payload_bytes}"

    signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256
    ).digest()
    sig_bytes = _b64encode(signature)

    return f"{signing_input}.{sig_bytes}"

def verify_access_token(token: str) -> Optional[str]:
    """
    Verifies token signature and expiry.
    Returns user email if valid, or None if invalid or expired.
    """
    if not token or "." not in token:
        return None

    parts = token.strip().split(".")
    if len(parts) != 3:
        return None

    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}"

    expected_sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256
    ).digest()

    try:
        actual_sig = _b64decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_json = json.loads(_b64decode(payload_b64).decode("utf-8"))
        exp = payload_json.get("exp", 0)
        if int(time.time()) > exp:
            return None

        email = payload_json.get("sub")
        return email.lower() if email else None
    except Exception:
        return None

def get_current_user_email(authorization: Optional[str] = Header(None)) -> str:
    """
    FastAPI dependency requiring a valid Bearer token.
    Prevents a user from accessing or modifying another user's data by changing a client-side query param.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    email = verify_access_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return email

def get_optional_user_email(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """
    FastAPI dependency that returns user email if valid token is provided, or None if not.
    """
    if not authorization:
        return None

    parts = authorization.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return verify_access_token(parts[1])
    return None
