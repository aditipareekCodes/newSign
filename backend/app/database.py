import sqlite3
import os
from contextlib import contextmanager
from typing import Generator
from app.config import settings

def get_connection() -> sqlite3.Connection:
    """Create a new SQLite connection with foreign keys and dict-like row access."""
    db_path = settings.database_path
    
    # Ensure parent directory exists if database path has directories
    parent_dir = os.path.dirname(db_path)
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)
        
    conn = sqlite3.connect(db_path, check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for database transactions."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db() -> None:
    """Non-destructive table initialization using CREATE TABLE IF NOT EXISTS."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT DEFAULT '',
                gender TEXT DEFAULT '',
                password_hash TEXT NOT NULL,
                preferred_language TEXT DEFAULT 'English',
                speech_behaviour TEXT DEFAULT 'confirm',
                speech_rate REAL DEFAULT 1.0,
                show_confidence INTEGER DEFAULT 1,
                voice_gender TEXT DEFAULT 'female',
                preferred_voices_json TEXT DEFAULT '{"English":"","Hindi":"","Marathi":""}',
                voice_selections_json TEXT DEFAULT '{"English":{"female":"","male":""},"Hindi":{"female":"","male":""},"Marathi":{"female":"","male":""}}',
                theme TEXT DEFAULT 'system',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")

        # 2. Saved Phrases Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS saved_phrases (
                id TEXT PRIMARY KEY,
                user_email TEXT NOT NULL,
                original_text TEXT NOT NULL,
                original_language TEXT DEFAULT 'English',
                translations_json TEXT NOT NULL,
                selected_language TEXT DEFAULT 'English',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_phrases_email ON saved_phrases(user_email);")

        # 3. History Items Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS history_items (
                id TEXT PRIMARY KEY,
                user_email TEXT NOT NULL,
                text TEXT NOT NULL,
                translation TEXT NOT NULL,
                language TEXT NOT NULL,
                confidence REAL DEFAULT 100.0,
                source TEXT DEFAULT 'recognition',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_email ON history_items(user_email);")

        # 4. Password Resets & OTP Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_resets (
                id TEXT PRIMARY KEY,
                user_email TEXT NOT NULL,
                otp_code TEXT NOT NULL,
                reset_token TEXT,
                expires_at REAL NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_resets_email ON password_resets(user_email);")

        # Registration OTP challenges are separate from password-reset records.
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS registration_verifications (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                otp_hash TEXT NOT NULL,
                request_ip_hash TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'sent',
                attempts INTEGER NOT NULL DEFAULT 0,
                expires_at REAL NOT NULL,
                registration_token_hash TEXT,
                token_expires_at REAL,
                created_at REAL NOT NULL,
                verified_at REAL,
                consumed_at REAL
            );
        """)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_registration_email_created "
            "ON registration_verifications(email, created_at);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_registration_ip_created "
            "ON registration_verifications(request_ip_hash, created_at);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_registration_created "
            "ON registration_verifications(created_at);"
        )
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_token_hash "
            "ON registration_verifications(registration_token_hash) "
            "WHERE registration_token_hash IS NOT NULL;"
        )
