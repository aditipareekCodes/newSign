from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status, Depends
from app.schemas.history import HistoryItemCreate, HistoryItemResponse
from app.schemas.common import MessageResponse
from app.services.history_service import HistoryService
from app.services.token_service import get_optional_user_email

router = APIRouter(prefix="/history", tags=["Recognition History"])

@router.get("", response_model=List[HistoryItemResponse])
def get_history(
    user_email: str = Query("", description="User email for scoped history"),
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    effective_email = auth_email if auth_email else user_email
    return HistoryService.list_history(effective_email)

@router.post("", response_model=HistoryItemResponse, status_code=status.HTTP_201_CREATED)
def create_history_entry(
    payload: HistoryItemCreate,
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    effective_email = auth_email if auth_email else (payload.userEmail or "")
    created = HistoryService.create_history_item(
        user_email=effective_email,
        text=payload.text,
        translation=payload.translation,
        language=payload.language,
        confidence=payload.confidence,
        source=payload.source,
        item_id=payload.id,
    )
    return created

@router.delete("/{history_id}", response_model=MessageResponse)
def delete_history_entry(
    history_id: str,
    user_email: str = Query("", description="User email"),
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    effective_email = auth_email if auth_email else user_email
    deleted = HistoryService.delete_history_item(history_id, effective_email)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History item not found or already deleted."
        )
    return MessageResponse(success=True, message="History item deleted.")

@router.delete("", response_model=MessageResponse)
def clear_history_log(
    user_email: str = Query("", description="User email"),
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    effective_email = auth_email if auth_email else user_email
    HistoryService.clear_history(effective_email)
    return MessageResponse(success=True, message="History log cleared.")
