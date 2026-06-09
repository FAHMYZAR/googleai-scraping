from fastapi import APIRouter, HTTPException

from lib.services.moodle_tasks import MoodleTasksService


router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tugas")
def get_tugas():
    try:
        service = MoodleTasksService()
        return service.get_all_tasks()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
