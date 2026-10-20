from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.phrases import router as phrases_router
from app.routers.history import router as history_router
from app.routers.recognition import router as recognition_router
from app.routers.translation import router as translation_router

__all__ = [
    "health_router",
    "auth_router",
    "users_router",
    "phrases_router",
    "history_router",
    "recognition_router",
    "translation_router",
]
