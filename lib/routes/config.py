import base64
import json
import pickle

from fastapi import APIRouter, Body, Depends, HTTPException

from lib.core.auth import require_api_key
from lib.core.config import AppConfig


router = APIRouter(prefix="/config", tags=["configuration"])


@router.post("/google/cookies")
def update_google_cookies(
    cookies: list | dict = Body(...),
    token: str = Depends(require_api_key),
):
    """Update file cookies.json secara dinamis di runtime container."""
    try:
        AppConfig.GAI_COOKIES_PATH.write_text(json.dumps(cookies, indent=2), encoding="utf-8")
        
        import requests
        if AppConfig.GAI_USE_PERSISTENT_WORKER:
            try:
                requests.post(f"http://{AppConfig.GAI_WORKER_HOST}:{AppConfig.GAI_WORKER_PORT}/reset", timeout=5)
            except Exception:
                pass
                
        return {"success": True, "message": "Google cookies updated and worker reset triggered"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/moodle/session")
def update_moodle_session(
    cookies_pkl_base64: str = Body(..., embed=True),
    token: str = Depends(require_api_key),
):
    """Update file moodle_uaa_cookies.pkl secara dinamis via Base64 string."""
    try:
        raw_data = base64.b64decode(cookies_pkl_base64)
        test_obj = pickle.loads(raw_data)
        if not isinstance(test_obj, dict):
            raise ValueError("PKL data tidak berisi object dictionary")
            
        AppConfig.COOKIE_FILE.write_bytes(raw_data)
        return {"success": True, "message": "Moodle session PKL updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 PKL data: {e}")


@router.post("/moodle/validate")
def validate_moodle_session(token: str = Depends(require_api_key)):
    """Validasi session moodle aktif (pastikan tidak diredirect ke login)."""
    try:
        from lib.services.moodle_tasks import MoodleTasksService
        svc = MoodleTasksService()
        svc.moodle.get_sesskey()
        return {"success": True, "message": "Session Moodle valid"}
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        return {"success": False, "message": str(e)}
