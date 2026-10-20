import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        extra="allow",
    )

    PROJECT_NAME: str = "SignVaani Backend"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./signvaani.db")
    
    # CORS Origins allowed to communicate with backend
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # Security (for hashing and token foundation)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "signvaani-dev-secret-key-change-in-production")
    TOKEN_EXPIRE_HOURS: int = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))

    # External Translation API (Optional)
    TRANSLATION_API_URL: str = os.getenv("TRANSLATION_API_URL", "")
    TRANSLATION_API_KEY: str = os.getenv("TRANSLATION_API_KEY", "")

    # SMTP Configuration (Optional - for actual email delivery)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "noreply@signvaani.com")

    @property
    def database_path(self) -> str:
        # Normalize sqlite:/// path to local file path
        url = self.DATABASE_URL
        if url.startswith("sqlite:///"):
            path_str = url.replace("sqlite:///", "")
        elif url.startswith("sqlite://"):
            path_str = url.replace("sqlite://", "")
        else:
            path_str = url

        p = Path(path_str)
        if not p.is_absolute():
            backend_dir = Path(__file__).resolve().parent.parent
            return str((backend_dir / p).resolve())
        return str(p)

settings = Settings()
