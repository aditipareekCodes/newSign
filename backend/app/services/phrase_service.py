import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.database import get_db

DEFAULT_BUILTIN_PHRASES = [
    {
        "id": "p1",
        "originalText": "I need water.",
        "originalLanguage": "English",
        "translations": {
            "English": "I need water.",
            "Hindi": "मुझे पानी चाहिए।",
            "Marathi": "मला पाणी हवे आहे.",
        },
        "selectedLanguage": "English",
    },
    {
        "id": "p2",
        "originalText": "Please call my family.",
        "originalLanguage": "English",
        "translations": {
            "English": "Please call my family.",
            "Hindi": "कृपया मेरे परिवार को बुलाओ।",
            "Marathi": "कृपया माझ्या कुटुंबाला बोलवा.",
        },
        "selectedLanguage": "English",
    },
    {
        "id": "p3",
        "originalText": "I want to go home.",
        "originalLanguage": "English",
        "translations": {
            "English": "I want to go home.",
            "Hindi": "मैं घर जाना चाहता हूँ।",
            "Marathi": "मला घरी जायचे आहे.",
        },
        "selectedLanguage": "English",
    },
    {
        "id": "p4",
        "originalText": "Thank you.",
        "originalLanguage": "English",
        "translations": {
            "English": "Thank you.",
            "Hindi": "धन्यवाद।",
            "Marathi": "धन्यवाद.",
        },
        "selectedLanguage": "English",
    },
]

def format_phrase_row(row: Any) -> Dict[str, Any]:
    try:
        translations = json.loads(row["translations_json"])
    except Exception:
        translations = {
            "English": row["original_text"],
            "Hindi": row["original_text"],
            "Marathi": row["original_text"],
        }

    return {
        "id": row["id"],
        "userEmail": row["user_email"],
        "originalText": row["original_text"],
        "originalLanguage": row["original_language"],
        "translations": translations,
        "selectedLanguage": row["selected_language"],
        "createdAt": row["created_at"],
    }

class PhraseService:
    @staticmethod
    def list_phrases(user_email: str = "") -> List[Dict[str, Any]]:
        clean_email = user_email.strip().lower()
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM saved_phrases
                WHERE user_email = ? OR user_email = ''
                ORDER BY created_at DESC;
            """, (clean_email,))
            rows = cur.fetchall()
            if not rows and clean_email:
                # Seed default phrases for user
                PhraseService.seed_defaults(clean_email)
                cur.execute("""
                    SELECT * FROM saved_phrases
                    WHERE user_email = ?
                    ORDER BY created_at DESC;
                """, (clean_email,))
                rows = cur.fetchall()

            return [format_phrase_row(r) for r in rows]

    @staticmethod
    def create_phrase(
        user_email: str,
        original_text: str,
        translations: Dict[str, str],
        original_language: str = "English",
        selected_language: str = "English",
        phrase_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        clean_email = user_email.strip().lower()
        pid = phrase_id or f"phr_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        trans_json = json.dumps(translations)

        with get_db() as conn:
            from app.services.history_service import _resolve_user_email
            resolved_email = _resolve_user_email(conn, clean_email)
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO saved_phrases (
                    id, user_email, original_text, original_language,
                    translations_json, selected_language, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (
                pid, resolved_email, original_text.strip(), original_language,
                trans_json, selected_language, now
            ))

        return {
            "id": pid,
            "userEmail": clean_email,
            "originalText": original_text.strip(),
            "originalLanguage": original_language,
            "translations": translations,
            "selectedLanguage": selected_language,
            "createdAt": now,
        }

    @staticmethod
    def update_phrase(
        phrase_id: str,
        user_email: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        clean_email = user_email.strip().lower()
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM saved_phrases WHERE id = ? AND (user_email = ? OR user_email = '') LIMIT 1;", (phrase_id, clean_email))
            row = cur.fetchone()
            if not row:
                return None

            orig_text = updates.get("originalText", row["original_text"])
            orig_lang = updates.get("originalLanguage", row["original_language"])
            sel_lang = updates.get("selectedLanguage", row["selected_language"])

            trans_json = row["translations_json"]
            if "translations" in updates and updates["translations"]:
                trans_json = json.dumps(updates["translations"])

            cur.execute("""
                UPDATE saved_phrases
                SET original_text = ?, original_language = ?, translations_json = ?, selected_language = ?
                WHERE id = ?;
            """, (orig_text, orig_lang, trans_json, sel_lang, phrase_id))

            cur.execute("SELECT * FROM saved_phrases WHERE id = ?;", (phrase_id,))
            updated_row = cur.fetchone()
            return format_phrase_row(updated_row) if updated_row else None

    @staticmethod
    def delete_phrase(phrase_id: str, user_email: str = "") -> bool:
        clean_email = user_email.strip().lower()
        with get_db() as conn:
            cur = conn.cursor()
            if clean_email:
                cur.execute("DELETE FROM saved_phrases WHERE id = ? AND (user_email = ? OR user_email = '');", (phrase_id, clean_email))
            else:
                cur.execute("DELETE FROM saved_phrases WHERE id = ?;", (phrase_id,))
            return cur.rowcount > 0

    @staticmethod
    def seed_defaults(user_email: str) -> None:
        clean_email = user_email.strip().lower()
        now = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            cur = conn.cursor()
            for p in DEFAULT_BUILTIN_PHRASES:
                pid = f"{p['id']}_{clean_email.replace('@', '_').replace('.', '_')}"
                cur.execute("""
                    INSERT OR IGNORE INTO saved_phrases (
                        id, user_email, original_text, original_language,
                        translations_json, selected_language, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?);
                """, (
                    pid, clean_email, p["originalText"], p["originalLanguage"],
                    json.dumps(p["translations"]), p["selectedLanguage"], now
                ))
