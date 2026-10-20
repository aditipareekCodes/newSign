from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class SavedPhrase:
    id: str
    user_email: str
    original_text: str
    translations_json: str
    original_language: str = "English"
    selected_language: str = "English"
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
