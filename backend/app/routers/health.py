from fastapi import APIRouter
from app.config import settings
from app.database import get_db
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    db_status = "connected"
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1;")
            cur.fetchone()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        database=db_status,
    )
