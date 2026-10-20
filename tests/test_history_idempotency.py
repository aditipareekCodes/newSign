from contextlib import contextmanager
from pathlib import Path
import sqlite3
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services import history_service


@pytest.fixture
def history_db(monkeypatch):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE users (email TEXT PRIMARY KEY);
        INSERT INTO users (email) VALUES ('demo@signvaani.com');
        CREATE TABLE history_items (
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
        """
    )

    @contextmanager
    def isolated_get_db():
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise

    monkeypatch.setattr(history_service, "get_db", isolated_get_db)
    yield connection
    connection.close()


def test_retried_history_create_is_idempotent(history_db):
    fields = {
        "user_email": "demo@signvaani.com",
        "text": "WATER",
        "translation": "water",
        "language": "English",
        "confidence": 82.0,
        "source": "recognition",
        "item_id": "hist-retry-01",
    }

    first = history_service.HistoryService.create_history_item(**fields)
    retried = history_service.HistoryService.create_history_item(**fields)

    assert retried == first
    assert history_db.execute("SELECT COUNT(*) FROM history_items").fetchone()[0] == 1


def test_conflicting_history_payload_does_not_hide_primary_key_violation():
    fields = {
        "user_email": "demo@signvaani.com",
        "text": "WATER",
        "translation": "water",
        "language": "English",
        "confidence": 82.0,
        "source": "recognition",
        "item_id": "hist-conflict-01",
    }

    history_service.HistoryService.create_history_item(**fields)
    with pytest.raises(sqlite3.IntegrityError, match="UNIQUE constraint failed"):
        history_service.HistoryService.create_history_item(
            **{**fields, "text": "HELP", "translation": "help"}
        )
