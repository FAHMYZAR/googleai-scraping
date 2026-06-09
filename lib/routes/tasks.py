from fastapi import APIRouter, Depends, HTTPException

from lib.core.auth import require_api_key
from lib.services.moodle_tasks import MoodleTasksService


router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tugas")
def get_tugas(token: str = Depends(require_api_key)):
    """Mendapatkan daftar tugas Moodle Semester 4 beserta status submissionnya."""
    try:
        service = MoodleTasksService()
        return service.get_all_tasks()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
