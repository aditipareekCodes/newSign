from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status, Depends
from app.schemas.phrase import (
    SavedPhraseCreate,
    SavedPhraseUpdate,
    SavedPhraseResponse,
)
from app.schemas.common import MessageResponse
from app.services.phrase_service import PhraseService
from app.services.token_service import get_optional_user_email

router = APIRouter(prefix="/phrases", tags=["Saved Phrases"])

@router.get("", response_model=List[SavedPhraseResponse])
def get_phrases(
    user_email: str = Query("", description="User email for scoped phrases"),
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    # Enforce authenticated user if token present to prevent viewing other users' private phrases
    effective_email = auth_email if auth_email else user_email
    return PhraseService.list_phrases(effective_email)

@router.post("", response_model=SavedPhraseResponse, status_code=status.HTTP_201_CREATED)
def create_phrase(
    payload: SavedPhraseCreate,
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    effective_email = auth_email if auth_email else (payload.userEmail or "")
    created = PhraseService.create_phrase(
        user_email=effective_email,
        original_text=payload.originalText,
        translations=payload.translations.model_dump(),
        original_language=payload.originalLanguage,
        selected_language=payload.selectedLanguage or "English",
        phrase_id=payload.id,
    )
    return created

@router.put("/{phrase_id}", response_model=SavedPhraseResponse)
def update_phrase(
    phrase_id: str,
    payload: SavedPhraseUpdate,
    user_email: str = Query("", description="User email"),
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    effective_email = auth_email if auth_email else user_email
    updates = payload.model_dump(exclude_unset=True)
    if "translations" in updates and updates["translations"] is not None:
        updates["translations"] = payload.translations.model_dump()  # type: ignore

    updated = PhraseService.update_phrase(phrase_id, effective_email, updates)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phrase not found or you do not have permission to edit it."
        )
    return updated

@router.delete("/{phrase_id}", response_model=MessageResponse)
def delete_phrase(
    phrase_id: str,
    user_email: str = Query("", description="User email"),
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    effective_email = auth_email if auth_email else user_email
    deleted = PhraseService.delete_phrase(phrase_id, effective_email)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phrase not found, already deleted, or unauthorized."
        )
    return MessageResponse(success=True, message="Phrase deleted successfully.")
