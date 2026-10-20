from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.services.auth_service import AuthService
from app.routers import (
    health_router,
    auth_router,
    users_router,
    phrases_router,
    history_router,
    recognition_router,
    translation_router,
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe, non-destructive database and seed initialization
    init_db()
    AuthService.ensure_demo_user()
    logger.info(
        "Backend configuration: registration email=%s, secret key=%s",
        "ready" if settings.SMTP_HOST and settings.SMTP_USER else "incomplete",
        "ready"
        if settings.SECRET_KEY != "signvaani-dev-secret-key-change-in-production"
        and len(settings.SECRET_KEY) >= 32
        else "insecure or missing",
    )
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SignVaani Assistive Communication Backend API",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers under /api
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(users_router, prefix=settings.API_PREFIX)
app.include_router(phrases_router, prefix=settings.API_PREFIX)
app.include_router(history_router, prefix=settings.API_PREFIX)
app.include_router(recognition_router, prefix=settings.API_PREFIX)
app.include_router(translation_router, prefix=settings.API_PREFIX)

@app.get("/")
def read_root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
    }
