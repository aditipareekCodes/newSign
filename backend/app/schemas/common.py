from pydantic import BaseModel
from typing import Optional, Any

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    database: str

class MessageResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
