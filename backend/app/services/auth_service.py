import hashlib
import hmac
import secrets
import json
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from app.config import settings
from app.database import get_db
from app.services.email_service import send_otp_email

REGISTRATION_OTP_TTL_SECONDS = 300
REGISTRATION_TOKEN_TTL_SECONDS = 600
REGISTRATION_OTP_MAX_ATTEMPTS = 5
REGISTRATION_OTP_EMAIL_LIMIT_PER_HOUR = 5
REGISTRATION_OTP_IP_LIMIT_PER_HOUR = 20
REGISTRATION_CHALLENGE_RETENTION_SECONDS = 24 * 60 * 60
DEFAULT_SECRET_KEY = "signvaani-dev-secret-key-change-in-production"


class RegistrationOtpUnavailableError(Exception):
    pass


class RegistrationOtpRateLimitError(Exception):
    pass


def _registration_secret() -> bytes:
    if settings.SECRET_KEY == DEFAULT_SECRET_KEY or len(settings.SECRET_KEY) < 32:
        raise RegistrationOtpUnavailableError(
            "Registration verification requires a configured SECRET_KEY of at least 32 characters."
        )
    return settings.SECRET_KEY.encode("utf-8")


def _registration_otp_hash(email: str, challenge_id: str, code: str) -> str:
    message = f"registration-otp:{email}:{challenge_id}:{code}".encode("utf-8")
    return hmac.new(_registration_secret(), message, hashlib.sha256).hexdigest()


def _registration_ip_hash(client_ip: str) -> str:
    return hmac.new(
        _registration_secret(),
        f"registration-ip:{client_ip}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with 100,000 iterations and unique 16-byte salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        bytes.fromhex(salt),
        100000
    ).hex()
    return f"{salt}${key}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify password against stored salt$hash in constant time."""
    try:
        if "$" not in stored_hash:
            return False
        salt, key = stored_hash.split("$", 1)
        computed = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            bytes.fromhex(salt),
            100000
        ).hex()
        return hmac.compare_digest(computed, key)
    except Exception:
        return False

def format_user_dict(row: Any) -> Dict[str, Any]:
    """Format SQLite row into StoredUser compatible dictionary."""
    try:
        preferred_voices = json.loads(row["preferred_voices_json"])
    except Exception:
        preferred_voices = {"English": "", "Hindi": "", "Marathi": ""}

    try:
        voice_selections = json.loads(row["voice_selections_json"])
    except Exception:
        voice_selections = {
            "English": {"female": "", "male": ""},
            "Hindi": {"female": "", "male": ""},
            "Marathi": {"female": "", "male": ""},
        }

    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"] or "",
        "gender": row["gender"] or "",
        "preferredLanguage": row["preferred_language"],
        "speechBehaviour": row["speech_behaviour"],
        "speechRate": float(row["speech_rate"]),
        "showConfidence": bool(row["show_confidence"]),
        "voiceGender": row["voice_gender"],
        "preferredVoices": preferred_voices,
        "voiceSelections": voice_selections,
        "theme": row["theme"],
    }

class AuthService:
    @staticmethod
    def get_by_email(email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = ? LIMIT 1;", (clean_email,))
            row = cur.fetchone()
            if row:
                return format_user_dict(row)
            return None

    @staticmethod
    def register(name: str, email: str, phone: str, password: str) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        now = datetime.now(timezone.utc).isoformat()
        user_id = f"usr_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        pwd_hash = hash_password(password)

        default_voices = json.dumps({"English": "", "Hindi": "", "Marathi": ""})
        default_selections = json.dumps({
            "English": {"female": "", "male": ""},
            "Hindi": {"female": "", "male": ""},
            "Marathi": {"female": "", "male": ""},
        })

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO users (
                    id, name, email, phone, gender, password_hash,
                    preferred_language, speech_behaviour, speech_rate, show_confidence,
                    voice_gender, preferred_voices_json, voice_selections_json, theme,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                user_id, name.strip(), clean_email, phone.strip(), "", pwd_hash,
                "English", "confirm", 1.0, 1,
                "female", default_voices, default_selections, "system",
                now, now
            ))

        return AuthService.get_by_email(clean_email)  # type: ignore

    @staticmethod
    def request_registration_otp(email: str, client_ip: str) -> None:
        clean_email = email.strip().lower()
        now = time.time()

        if not settings.SMTP_HOST or not settings.SMTP_USER:
            raise RegistrationOtpUnavailableError(
                "Registration email delivery is not configured. Configure the backend SMTP settings and try again."
            )

        ip_hash = _registration_ip_hash(client_ip)
        challenge_id = secrets.token_urlsafe(18)
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        otp_hash = _registration_otp_hash(clean_email, challenge_id, otp_code)

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM registration_verifications WHERE created_at < ?;",
                (now - REGISTRATION_CHALLENGE_RETENTION_SECONDS,),
            )

            cur.execute(
                """
                SELECT COUNT(*) FROM registration_verifications
                WHERE email = ? AND created_at > ?;
                """,
                (clean_email, now - 3600),
            )
            if cur.fetchone()[0] >= REGISTRATION_OTP_EMAIL_LIMIT_PER_HOUR:
                raise RegistrationOtpRateLimitError(
                    "Too many verification requests for this email. Please try again later."
                )

            cur.execute(
                """
                SELECT COUNT(*) FROM registration_verifications
                WHERE request_ip_hash = ? AND created_at > ?;
                """,
                (ip_hash, now - 3600),
            )
            if cur.fetchone()[0] >= REGISTRATION_OTP_IP_LIMIT_PER_HOUR:
                raise RegistrationOtpRateLimitError(
                    "Too many verification requests from this network. Please try again later."
                )

            cur.execute("SELECT 1 FROM users WHERE email = ? LIMIT 1;", (clean_email,))
            if cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO registration_verifications (
                        id, email, otp_hash, request_ip_hash, status, attempts,
                        expires_at, created_at
                    ) VALUES (?, ?, ?, ?, 'ineligible', 0, ?, ?);
                    """,
                    (
                        challenge_id,
                        clean_email,
                        otp_hash,
                        ip_hash,
                        now + REGISTRATION_OTP_TTL_SECONDS,
                        now,
                    ),
                )
                return

            cur.execute(
                """
                UPDATE registration_verifications
                SET status = 'superseded'
                WHERE email = ? AND status IN ('pending', 'sent', 'verified');
                """,
                (clean_email,),
            )
            cur.execute(
                """
                INSERT INTO registration_verifications (
                    id, email, otp_hash, request_ip_hash, status, attempts,
                    expires_at, created_at
                ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?);
                """,
                (
                    challenge_id,
                    clean_email,
                    otp_hash,
                    ip_hash,
                    now + REGISTRATION_OTP_TTL_SECONDS,
                    now,
                ),
            )

        if send_otp_email(clean_email, otp_code, "registration"):
            with get_db() as conn:
                conn.execute(
                    """
                    UPDATE registration_verifications
                    SET status = 'sent'
                    WHERE id = ? AND status = 'pending';
                    """,
                    (challenge_id,),
                )
            return

        with get_db() as conn:
            conn.execute(
                """
                UPDATE registration_verifications
                SET status = 'delivery_failed'
                WHERE id = ? AND status = 'pending';
                """,
                (challenge_id,),
            )
        raise RegistrationOtpUnavailableError(
            "The registration verification email could not be delivered. Check SMTP configuration and try again."
        )

    @staticmethod
    def verify_registration_otp(email: str, code: str) -> Tuple[Optional[str], str]:
        clean_email = email.strip().lower()
        now = time.time()
        token = secrets.token_urlsafe(32)
        token_hash = _token_hash(token)
        failure_message = "Verification code is invalid, expired, or has already been used."

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, otp_hash, attempts
                FROM registration_verifications
                WHERE email = ? AND status = 'sent' AND expires_at > ?
                ORDER BY created_at DESC LIMIT 1;
                """,
                (clean_email, now),
            )
            challenge = cur.fetchone()
            if challenge is None:
                return None, failure_message

            if challenge["attempts"] >= REGISTRATION_OTP_MAX_ATTEMPTS:
                cur.execute(
                    "UPDATE registration_verifications SET status = 'locked' WHERE id = ?;",
                    (challenge["id"],),
                )
                return None, failure_message

            expected_hash = _registration_otp_hash(clean_email, challenge["id"], code)
            if not hmac.compare_digest(expected_hash, challenge["otp_hash"]):
                cur.execute(
                    """
                    UPDATE registration_verifications
                    SET attempts = attempts + 1,
                        status = CASE
                            WHEN attempts + 1 >= ? THEN 'locked'
                            ELSE status
                        END
                    WHERE id = ? AND status = 'sent' AND expires_at > ?;
                    """,
                    (REGISTRATION_OTP_MAX_ATTEMPTS, challenge["id"], now),
                )
                return None, failure_message

            cur.execute(
                """
                UPDATE registration_verifications
                SET status = 'verified', registration_token_hash = ?,
                    token_expires_at = ?, verified_at = ?
                WHERE id = ? AND status = 'sent' AND attempts < ?
                    AND expires_at > ?;
                """,
                (
                    token_hash,
                    now + REGISTRATION_TOKEN_TTL_SECONDS,
                    now,
                    challenge["id"],
                    REGISTRATION_OTP_MAX_ATTEMPTS,
                    now,
                ),
            )
            if cur.rowcount != 1:
                return None, failure_message

        return token, "Email verified."

    @staticmethod
    def register_verified(
        name: str,
        email: str,
        phone: str,
        password: str,
        registration_token: str,
    ) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        now = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()
        user_id = f"usr_{int(now * 1000)}"
        pwd_hash = hash_password(password)
        default_voices = json.dumps({"English": "", "Hindi": "", "Marathi": ""})
        default_selections = json.dumps({
            "English": {"female": "", "male": ""},
            "Hindi": {"female": "", "male": ""},
            "Marathi": {"female": "", "male": ""},
        })

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE registration_verifications
                SET status = 'consumed', consumed_at = ?
                WHERE email = ? AND registration_token_hash = ?
                    AND status = 'verified' AND consumed_at IS NULL
                    AND token_expires_at > ?;
                """,
                (now, clean_email, _token_hash(registration_token), now),
            )
            if cur.rowcount != 1:
                return None

            cur.execute(
                """
                INSERT INTO users (
                    id, name, email, phone, gender, password_hash,
                    preferred_language, speech_behaviour, speech_rate, show_confidence,
                    voice_gender, preferred_voices_json, voice_selections_json, theme,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    user_id, name.strip(), clean_email, phone.strip(), "", pwd_hash,
                    "English", "confirm", 1.0, 1, "female",
                    default_voices, default_selections, "system", now_iso, now_iso,
                ),
            )
            cur.execute("SELECT * FROM users WHERE email = ? LIMIT 1;", (clean_email,))
            user = cur.fetchone()
            return format_user_dict(user) if user else None

    @staticmethod
    def authenticate(email: str, password: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = ? LIMIT 1;", (clean_email,))
            row = cur.fetchone()
            if not row:
                return None
            if not verify_password(password, row["password_hash"]):
                return None
            return format_user_dict(row)

    @staticmethod
    def update_profile(email: str, name: Optional[str] = None, phone: Optional[str] = None, gender: Optional[str] = None) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        now = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = ? LIMIT 1;", (clean_email,))
            row = cur.fetchone()
            if not row:
                return None

            new_name = name.strip() if name is not None else row["name"]
            new_phone = phone.strip() if phone is not None else row["phone"]
            new_gender = gender.strip() if gender is not None else row["gender"]

            cur.execute("""
                UPDATE users
                SET name = ?, phone = ?, gender = ?, updated_at = ?
                WHERE email = ?;
            """, (new_name, new_phone, new_gender, now, clean_email))

        return AuthService.get_by_email(clean_email)

    @staticmethod
    def update_preferences(email: str, prefs: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        now = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = ? LIMIT 1;", (clean_email,))
            row = cur.fetchone()
            if not row:
                return None

            pref_lang = prefs.get("preferredLanguage", row["preferred_language"])
            speech_beh = prefs.get("speechBehaviour", row["speech_behaviour"])
            speech_rate = prefs.get("speechRate", row["speech_rate"])
            show_conf = 1 if prefs.get("showConfidence", bool(row["show_confidence"])) else 0
            voice_gen = prefs.get("voiceGender", row["voice_gender"])
            theme = prefs.get("theme", row["theme"])

            pref_voices_str = row["preferred_voices_json"]
            if "preferredVoices" in prefs and prefs["preferredVoices"] is not None:
                pref_voices_str = json.dumps(prefs["preferredVoices"])

            voice_sel_str = row["voice_selections_json"]
            if "voiceSelections" in prefs and prefs["voiceSelections"] is not None:
                voice_sel_str = json.dumps(prefs["voiceSelections"])

            cur.execute("""
                UPDATE users
                SET preferred_language = ?, speech_behaviour = ?, speech_rate = ?,
                    show_confidence = ?, voice_gender = ?, preferred_voices_json = ?,
                    voice_selections_json = ?, theme = ?, updated_at = ?
                WHERE email = ?;
            """, (
                pref_lang, speech_beh, speech_rate, show_conf, voice_gen,
                pref_voices_str, voice_sel_str, theme, now, clean_email
            ))

        return AuthService.get_by_email(clean_email)

    @staticmethod
    def change_password(email: str, old_password: str, new_password: str) -> Tuple[bool, str]:
        clean_email = email.strip().lower()
        now = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = ? LIMIT 1;", (clean_email,))
            row = cur.fetchone()
            if not row:
                return False, "User not found."
            if not verify_password(old_password, row["password_hash"]):
                return False, "Current password is incorrect."

            new_hash = hash_password(new_password)
            cur.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?;", (new_hash, now, clean_email))
            return True, "Password updated successfully."

    @staticmethod
    def find_by_identifier(identifier: str) -> Optional[Dict[str, Any]]:
        """Finds user by email or sanitized digits of phone number."""
        clean = identifier.strip().lower()
        clean_digits = "".join(ch for ch in clean if ch.isdigit())
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = ? LIMIT 1;", (clean,))
            row = cur.fetchone()
            if row:
                return format_user_dict(row)

            if len(clean_digits) >= 10:
                cur.execute("SELECT * FROM users;")
                for r in cur.fetchall():
                    phone_digits = "".join(ch for ch in (r["phone"] or "") if ch.isdigit())
                    if phone_digits and phone_digits.endswith(clean_digits[-10:]):
                        return format_user_dict(r)
        return None

    @staticmethod
    def create_otp(identifier: str) -> Tuple[bool, str, str, Optional[str]]:
        """
        Creates a cryptographically secure 6-digit OTP with 5-minute expiry.
        Dispatches code via configured SMTP gateway.
        Never returns plaintext OTP code in response payload.
        """
        user = AuthService.find_by_identifier(identifier)
        if not user:
            return False, "failed", "No account found matching this email or phone.", None

        otp_code = f"{secrets.randbelow(900000) + 100000}"
        reset_id = f"rst_{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc).isoformat()
        expires_at = datetime.now(timezone.utc).timestamp() + 300.0  # 5 minutes

        with get_db() as conn:
            cur = conn.cursor()
            # Invalidate older pending OTPs for this email
            cur.execute("UPDATE password_resets SET used = 1 WHERE user_email = ? AND used = 0;", (user["email"],))
            cur.execute("""
                INSERT INTO password_resets (id, user_email, otp_code, reset_token, expires_at, used, created_at)
                VALUES (?, ?, ?, ?, ?, 0, ?);
            """, (reset_id, user["email"], otp_code, "", expires_at, now))

        smtp_sent = send_otp_email(user["email"], otp_code, "password_reset")

        if smtp_sent:
            return True, "delivered", f"Verification code sent to {user['email']}.", None
        else:
            return (
                True,
                "unconfigured",
                "Email delivery service (SMTP) is not configured in this environment.",
                None,
            )

    @staticmethod
    def verify_otp(identifier: str, code: str) -> Tuple[bool, Optional[str], str]:
        """Verifies OTP code and generates a short-lived reset token."""
        user = AuthService.find_by_identifier(identifier)
        if not user:
            return False, None, "Account not found."

        current_time = datetime.now(timezone.utc).timestamp()
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM password_resets
                WHERE user_email = ? AND used = 0 AND expires_at > ?
                ORDER BY created_at DESC LIMIT 1;
            """, (user["email"], current_time))
            record = cur.fetchone()

            if not record:
                return False, None, "Verification code has expired or was not requested. Please request a new code."

            if record["otp_code"] != code.strip():
                return False, None, "Incorrect verification code. Please check and try again."

            # Mark OTP as used and issue a signed reset token (10 minutes)
            reset_token = f"tok_{secrets.token_urlsafe(32)}"
            cur.execute("UPDATE password_resets SET used = 1, reset_token = ? WHERE id = ?;", (reset_token, record["id"]))
            return True, reset_token, "Verification successful."

    @staticmethod
    def reset_password_with_token(reset_token: str, new_password: str) -> Tuple[bool, str]:
        """Resets user password using verified reset token."""
        now = datetime.now(timezone.utc).isoformat()
        current_time = datetime.now(timezone.utc).timestamp()
        with get_db() as conn:
            cur = conn.cursor()
            # Token valid within 10 minutes of creation
            cur.execute("""
                SELECT * FROM password_resets
                WHERE reset_token = ? AND expires_at > ?
                LIMIT 1;
            """, (reset_token.strip(), current_time - 300))  # within extra 5 min grace
            record = cur.fetchone()

            if not record:
                return False, "Invalid or expired reset token. Please restart the password reset flow."

            user_email = record["user_email"]
            new_hash = hash_password(new_password)
            cur.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?;", (new_hash, now, user_email))
            # Invalidate reset token
            cur.execute("UPDATE password_resets SET reset_token = '' WHERE id = ?;", (record["id"],))
            return True, "Password has been successfully updated."

    @staticmethod
    def ensure_demo_user() -> None:
        """Seed the demo user if not present so existing login works out-of-the-box."""
        demo_email = "demo@signvaani.com"
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE email = ? LIMIT 1;", (demo_email,))
            if not cur.fetchone():
                now = datetime.now(timezone.utc).isoformat()
                user_id = "user_demo_1"
                pwd_hash = hash_password("SignVaani@123")
                default_voices = json.dumps({"English": "", "Hindi": "", "Marathi": ""})
                default_selections = json.dumps({
                    "English": {"female": "", "male": ""},
                    "Hindi": {"female": "", "male": ""},
                    "Marathi": {"female": "", "male": ""},
                })
                cur.execute("""
                    INSERT INTO users (
                        id, name, email, phone, gender, password_hash,
                        preferred_language, speech_behaviour, speech_rate, show_confidence,
                        voice_gender, preferred_voices_json, voice_selections_json, theme,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    user_id, "Arjun Verma", demo_email, "+91 98765 43210", "Male", pwd_hash,
                    "English", "confirm", 1.0, 1,
                    "female", default_voices, default_selections, "light",
                    now, now
                ))
