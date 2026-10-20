from pydantic import BaseModel, Field
from typing import Optional, Literal

class PhraseTranslationsSchema(BaseModel):
    English: str
    Hindi: str
    Marathi: str

class SavedPhraseCreate(BaseModel):
    id: Optional[str] = None
    originalText: str = Field(..., min_length=1)
    originalLanguage: Literal["English", "Hindi", "Marathi"] = "English"
    translations: PhraseTranslationsSchema
    selectedLanguage: Optional[Literal["English", "Hindi", "Marathi"]] = "English"
    userEmail: Optional[str] = ""

class SavedPhraseUpdate(BaseModel):
    originalText: Optional[str] = None
    originalLanguage: Optional[Literal["English", "Hindi", "Marathi"]] = None
    translations: Optional[PhraseTranslationsSchema] = None
    selectedLanguage: Optional[Literal["English", "Hindi", "Marathi"]] = None

class SavedPhraseResponse(BaseModel):
    id: str
    originalText: str
    originalLanguage: str
    translations: PhraseTranslationsSchema
    selectedLanguage: str
    createdAt: str
    userEmail: str
