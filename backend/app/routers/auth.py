import sqlite3
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.schemas.common import MessageResponse
from app.schemas.user import (
    AuthTokenResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    RegistrationOtpRequest,
    RegistrationOtpResponse,
    RegistrationOtpVerifyRequest,
    RegistrationOtpVerifyResponse,
    ResetPasswordWithTokenRequest,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services.auth_service import (
    AuthService,
    REGISTRATION_TOKEN_TTL_SECONDS,
    RegistrationOtpRateLimitError,
    RegistrationOtpUnavailableError,
)
from app.services.token_service import create_access_token, get_current_user_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegisterRequest):
    try:
        user = AuthService.register_verified(
            name=payload.name,
            email=payload.email,
            phone=payload.phone or "",
            password=payload.password,
            registration_token=payload.registration_token,
        )
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A valid, unused registration verification token is required for this email address.",
        )
    token = create_access_token(user["email"])
    return AuthTokenResponse(user=user, token=token, token_type="bearer")


@router.post(
    "/register/request-otp",
    response_model=RegistrationOtpResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def request_registration_otp(payload: RegistrationOtpRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    try:
        AuthService.request_registration_otp(payload.email, client_ip)
    except RegistrationOtpRateLimitError as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(error),
        )
    except RegistrationOtpUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        )

    return RegistrationOtpResponse(
        success=True,
        message="If this email can be registered, a verification code will be sent shortly.",
    )


@router.post(
    "/register/verify-otp",
    response_model=RegistrationOtpVerifyResponse,
)
def verify_registration_otp(payload: RegistrationOtpVerifyRequest):
    registration_token, message = AuthService.verify_registration_otp(
        payload.email,
        payload.code,
    )
    if not registration_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return RegistrationOtpVerifyResponse(
        registration_token=registration_token,
        expires_in=REGISTRATION_TOKEN_TTL_SECONDS,
        message=message,
    )


@router.post("/login", response_model=AuthTokenResponse)
def login_user(payload: UserLoginRequest):
    user = AuthService.authenticate(payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please try again.",
        )
    token = create_access_token(user["email"])
    return AuthTokenResponse(user=user, token=token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_current_authenticated_user(current_email: str = Depends(get_current_user_email)):
    user = AuthService.get_by_email(current_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )
    return user


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest):
    ok, delivery_status, message, _ = AuthService.create_otp(payload.identifier)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
    return ForgotPasswordResponse(
        success=True,
        delivery_status=delivery_status,
        message=message,
        dev_code=None,
    )


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp(payload: VerifyOtpRequest):
    ok, reset_token, message = AuthService.verify_otp(payload.identifier, payload.code)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return VerifyOtpResponse(success=True, reset_token=reset_token, message=message)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordWithTokenRequest):
    ok, message = AuthService.reset_password_with_token(
        payload.reset_token,
        payload.new_password,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return MessageResponse(success=True, message=message)
