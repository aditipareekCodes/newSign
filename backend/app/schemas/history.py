from pydantic import BaseModel, Field
from typing import Optional, Literal

class HistoryItemCreate(BaseModel):
    id: Optional[str] = None
    text: str = Field(..., min_length=1)
    translation: str = Field(..., min_length=1)
    language: Literal["English", "Hindi", "Marathi"]
    confidence: float = 100.0
    source: Literal["recognition", "saved_phrase", "emergency_phrase"] = "recognition"
    userEmail: Optional[str] = ""

class HistoryItemResponse(BaseModel):
    id: str
    text: str
    translation: str
    language: str
    confidence: float
    source: str
    createdAt: str
    userEmail: str
