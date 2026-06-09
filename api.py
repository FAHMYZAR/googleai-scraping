import os
import sys
import time
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from dotenv import load_dotenv

load_dotenv()

from lib.core.router_loader import include_all_routes
from lib.core.config import AppConfig

worker_process = None


def check_and_install_chromium():
    if sys.platform.startswith("linux"):
        try:
            subprocess.run(["google-chrome", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

        try:
            subprocess.run(["chromium-browser", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
            
        try:
            subprocess.run(["chromium", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

        print("Chromium belum terinstall di Linux. Mencoba install...")
        try:
            subprocess.run(["sudo", "apt-get", "update"], check=False)
            subprocess.run(["sudo", "apt-get", "install", "-y", "chromium-browser"], check=False)
        except Exception as e:
            print("Gagal auto-install chromium:", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global worker_process
    
    # 1. Check Chromium on Linux
    check_and_install_chromium()
    
    # 2. Auto-start Node worker
    if AppConfig.GAI_USE_PERSISTENT_WORKER:
        worker_script = AppConfig.APP_DIR / "lib" / "services" / "worker" / "server.mjs"
        env = os.environ.copy()
        env["COOKIES_PATH"] = str(AppConfig.GAI_COOKIES_PATH)
        env["GAI_WORKER_PORT"] = str(AppConfig.GAI_WORKER_PORT)
        
        print(f"Memulai Node worker di port {AppConfig.GAI_WORKER_PORT}...")
        worker_process = subprocess.Popen(
            [AppConfig.NODE_BIN, str(worker_script)],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT
        )
        
        # Wait until worker is healthy
        import requests
        for _ in range(10):
            try:
                resp = requests.get(f"http://127.0.0.1:{AppConfig.GAI_WORKER_PORT}/health", timeout=2)
                if resp.status_code == 200:
                    print("Node worker GAI siap!")
                    break
            except Exception:
                pass
            time.sleep(1)

    yield
    
    # Cleanup on shutdown
    if worker_process:
        print("Mematikan Node worker...")
        worker_process.terminate()
        try:
            worker_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            worker_process.kill()

app = FastAPI(
    title="api-fahmyzzx",
    version="1.0.0",
    docs_url=None,  # disable default docs to override
    lifespan=lifespan
)

include_all_routes(app)

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Swagger UI",
        swagger_favicon_url="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐻</text></svg>"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=9876, reload=True)
