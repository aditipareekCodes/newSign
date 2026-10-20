from fastapi import APIRouter, HTTPException, Query, status, Depends
from typing import Optional
from app.schemas.user import (
    UserProfileUpdateRequest,
    UserPreferencesUpdateRequest,
    PasswordChangeRequest,
    UserResponse,
)
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService
from app.services.token_service import get_current_user_email, get_optional_user_email

router = APIRouter(prefix="/users", tags=["Users & Preferences"])

@router.get("/profile", response_model=UserResponse)
def get_user_profile(
    email: Optional[str] = Query(None, description="User email"),
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    target_email = auth_email or (email.strip().lower() if email else None)
    if not target_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email identifier or authentication required."
        )

    # Protect against accessing another user's profile if authenticated
    if auth_email and email and auth_email.lower() != email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view another user's profile."
        )

    user = AuthService.get_by_email(target_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return user

@router.put("/profile", response_model=UserResponse)
def update_user_profile(
    payload: UserProfileUpdateRequest,
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    target_email = auth_email or payload.email.strip().lower()
    if auth_email and auth_email.lower() != payload.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify another user's profile."
        )

    user = AuthService.update_profile(
        email=target_email,
        name=payload.name,
        phone=payload.phone,
        gender=payload.gender
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return user

@router.put("/preferences", response_model=UserResponse)
def update_user_preferences(
    payload: UserPreferencesUpdateRequest,
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    updates = payload.model_dump(exclude_unset=True)
    body_email = updates.pop("email").strip().lower()
    target_email = auth_email or body_email

    if auth_email and auth_email.lower() != body_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify another user's preferences."
        )

    user = AuthService.update_preferences(target_email, updates)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return user

@router.put("/password", response_model=MessageResponse)
def change_user_password(
    payload: PasswordChangeRequest,
    auth_email: Optional[str] = Depends(get_optional_user_email),
):
    target_email = auth_email or payload.email.strip().lower()
    if auth_email and auth_email.lower() != payload.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify another user's password."
        )

    success, msg = AuthService.change_password(
        email=target_email,
        old_password=payload.currentPassword,
        new_password=payload.newPassword
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )
    return MessageResponse(success=True, message=msg)
