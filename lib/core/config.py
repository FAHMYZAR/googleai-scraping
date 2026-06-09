import os
from pathlib import Path


class AppConfig:
    APP_NAME = "api-fahmyzzx"
    APP_DIR = Path(__file__).resolve().parents[2]
    MOODLE_BASE = "https://elearning.almaata.ac.id"
    PROJECT_ROOT = Path(__file__).resolve().parents[3]
    COOKIE_FILE = APP_DIR / "moodle_uaa_cookies.pkl"
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", "9876"))
    PROVIDER_API_KEY = os.getenv("PROVIDER_API_KEY", "sk-gai-local-secret")
    MODEL_ID = os.getenv("MODEL_ID", "google-ai-mode")
    NODE_BIN = os.getenv("NODE_BIN", "node")
    GAI_TIMEOUT = int(os.getenv("GAI_TIMEOUT", "90000"))
    GAI_LANG = os.getenv("GAI_LANG", "id")
    
    _cp = os.getenv("COOKIES_PATH", str(APP_DIR / "cookies.json"))
    GAI_COOKIES_PATH = Path(_cp) if Path(_cp).is_absolute() else APP_DIR / _cp

    GAI_WORKER_HOST = os.getenv("GAI_WORKER_HOST", "127.0.0.1")
    GAI_WORKER_PORT = int(os.getenv("GAI_WORKER_PORT", "9879"))
    GAI_USE_PERSISTENT_WORKER = os.getenv("GAI_USE_PERSISTENT_WORKER", "true").lower() == "true"
