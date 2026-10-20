import uuid
import sqlite3
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.database import get_db

def format_history_row(row: Any) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "userEmail": row["user_email"],
        "text": row["text"],
        "translation": row["translation"],
        "language": row["language"],
        "confidence": float(row["confidence"]),
        "source": row["source"],
        "createdAt": row["created_at"],
    }

def _resolve_user_email(conn, requested_email: str) -> str:
    clean = (requested_email or "").strip().lower()
    cur = conn.cursor()
    if clean:
        cur.execute("SELECT email FROM users WHERE email = ? LIMIT 1;", (clean,))
        if cur.fetchone():
            return clean
    cur.execute("SELECT email FROM users WHERE email = 'demo@signvaani.com' LIMIT 1;")
    if cur.fetchone():
        return "demo@signvaani.com"
    cur.execute("SELECT email FROM users LIMIT 1;")
    row = cur.fetchone()
    if row:
        return row["email"]
    from app.services.auth_service import AuthService
    AuthService.ensure_demo_user()
    return "demo@signvaani.com"

class HistoryService:
    @staticmethod
    def list_history(user_email: str = "") -> List[Dict[str, Any]]:
        clean_email = user_email.strip().lower()
        with get_db() as conn:
            cur = conn.cursor()
            if clean_email:
                cur.execute("""
                    SELECT * FROM history_items
                    WHERE user_email = ?
                    ORDER BY created_at DESC;
                """, (clean_email,))
            else:
                cur.execute("SELECT * FROM history_items ORDER BY created_at DESC;")
            rows = cur.fetchall()
            return [format_history_row(r) for r in rows]

    @staticmethod
    def create_history_item(
        user_email: str,
        text: str,
        translation: str,
        language: str,
        confidence: float = 100.0,
        source: str = "recognition",
        item_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        clean_email = user_email.strip().lower()
        hid = item_id or f"hist_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        with get_db() as conn:
            resolved_email = _resolve_user_email(conn, clean_email)
            cur = conn.cursor()
            try:
                cur.execute("""
                    INSERT INTO history_items (
                        id, user_email, text, translation, language, confidence, source, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    hid, resolved_email, text.strip(), translation.strip(),
                    language, confidence, source, now
                ))
                if cur.rowcount != 1:
                    raise RuntimeError("History item insert did not create exactly one record.")
            except sqlite3.IntegrityError:
                existing = conn.execute(
                    "SELECT * FROM history_items WHERE id = ?;",
                    (hid,),
                ).fetchone()
                if (
                    existing is None
                    or existing["user_email"] != resolved_email
                    or existing["text"] != text.strip()
                    or existing["translation"] != translation.strip()
                    or existing["language"] != language
                    or float(existing["confidence"]) != float(confidence)
                    or existing["source"] != source
                ):
                    raise
                return format_history_row(existing)

            row = conn.execute(
                "SELECT * FROM history_items WHERE id = ?;",
                (hid,),
            ).fetchone()

        return format_history_row(row)

    @staticmethod
    def delete_history_item(item_id: str, user_email: str = "") -> bool:
        clean_email = user_email.strip().lower()
        with get_db() as conn:
            cur = conn.cursor()
            if clean_email:
                cur.execute("DELETE FROM history_items WHERE id = ? AND (user_email = ? OR user_email = '');", (item_id, clean_email))
            else:
                cur.execute("DELETE FROM history_items WHERE id = ?;", (item_id,))
            return cur.rowcount > 0

    @staticmethod
    def clear_history(user_email: str = "") -> bool:
        clean_email = user_email.strip().lower()
        with get_db() as conn:
            cur = conn.cursor()
            if clean_email:
                cur.execute("DELETE FROM history_items WHERE user_email = ? OR user_email = '';", (clean_email,))
            else:
                cur.execute("DELETE FROM history_items;")
            return True
