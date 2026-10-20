import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, Literal

class VoiceGenderSelection(BaseModel):
    female: str = ""
    male: str = ""

class VoiceSelectionsSchema(BaseModel):
    English: VoiceGenderSelection = Field(default_factory=VoiceGenderSelection)
    Hindi: VoiceGenderSelection = Field(default_factory=VoiceGenderSelection)
    Marathi: VoiceGenderSelection = Field(default_factory=VoiceGenderSelection)

def validate_email_format(v: str) -> str:
    cleaned = v.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
        raise ValueError("Invalid email format")
    return cleaned

class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    email: str = Field(...)
    phone: Optional[str] = ""
    password: str = Field(..., min_length=6, max_length=128)
    registration_token: str = Field(..., min_length=32, max_length=128)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class UserLoginRequest(BaseModel):
    email: str = Field(...)
    password: str = Field(...)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class UserProfileUpdateRequest(BaseModel):
    email: str = Field(...)
    name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class UserPreferencesUpdateRequest(BaseModel):
    email: str = Field(...)
    preferredLanguage: Optional[Literal["English", "Hindi", "Marathi"]] = None
    speechBehaviour: Optional[Literal["auto", "confirm"]] = None
    speechRate: Optional[float] = None
    showConfidence: Optional[bool] = None
    voiceGender: Optional[Literal["female", "male"]] = None
    preferredVoices: Optional[Dict[str, str]] = None
    voiceSelections: Optional[Dict[str, Dict[str, str]]] = None
    theme: Optional[Literal["light", "dark", "system"]] = None

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class PasswordChangeRequest(BaseModel):
    email: str = Field(...)
    currentPassword: str
    newPassword: str = Field(..., min_length=6)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    gender: str
    preferredLanguage: str
    speechBehaviour: str
    speechRate: float
    showConfidence: bool
    voiceGender: str
    preferredVoices: Dict[str, str]
    voiceSelections: Dict[str, Dict[str, str]]
    theme: str

class AuthTokenResponse(BaseModel):
    user: UserResponse
    token: str
    token_type: str = "bearer"

class ForgotPasswordRequest(BaseModel):
    identifier: str


class RegistrationOtpRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)


class RegistrationOtpResponse(BaseModel):
    success: bool
    message: str


class RegistrationOtpVerifyRequest(BaseModel):
    email: str
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)


class RegistrationOtpVerifyResponse(BaseModel):
    registration_token: str
    expires_in: int
    message: str


class ForgotPasswordResponse(BaseModel):
    success: bool
    delivery_status: str  # "delivered" or "unconfigured"
    message: str
    dev_code: Optional[str] = None

class VerifyOtpRequest(BaseModel):
    identifier: str
    code: str

class VerifyOtpResponse(BaseModel):
    success: bool
    reset_token: Optional[str] = None
    message: str

class ResetPasswordWithTokenRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=8)
