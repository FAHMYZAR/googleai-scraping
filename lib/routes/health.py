from fastapi import APIRouter

from lib.core.config import AppConfig


router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    return {
        "success": True,
        "service": AppConfig.APP_NAME,
        "status": "ok",
    }
