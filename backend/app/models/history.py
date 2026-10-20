from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class HistoryItem:
    id: str
    user_email: str
    text: str
    translation: str
    language: str
    confidence: float = 100.0
    source: str = "recognition"
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
