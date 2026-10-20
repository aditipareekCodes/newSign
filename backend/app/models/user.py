from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class User:
    id: str
    name: str
    email: str
    password_hash: str
    phone: Optional[str] = ""
    gender: Optional[str] = ""
    preferred_language: str = "English"
    speech_behaviour: str = "confirm"
    speech_rate: float = 1.0
    show_confidence: bool = True
    voice_gender: str = "female"
    preferred_voices_json: str = '{"English":"","Hindi":"","Marathi":""}'
    voice_selections_json: str = '{"English":{"female":"","male":""},"Hindi":{"female":"","male":""},"Marathi":{"female":"","male":""}}'
    theme: str = "system"
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
