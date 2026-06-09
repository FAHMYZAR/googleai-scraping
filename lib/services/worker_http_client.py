import requests

from lib.core.config import AppConfig


class WorkerHttpClientError(Exception):
    pass


class WorkerHttpClient:
    def __init__(self):
        self.base_url = f"http://{AppConfig.GAI_WORKER_HOST}:{AppConfig.GAI_WORKER_PORT}"

    def health(self):
        response = requests.get(f"{self.base_url}/health", timeout=10)
        try:
            response.raise_for_status()
            return response.json()
        except Exception:
            from json import JSONDecodeError
            try:
                err = response.json()
            except (ValueError, JSONDecodeError):
                err = {"ok": False, "error": response.text[:500] or f"HTTP {response.status_code}"}
            raise WorkerHttpClientError("Node worker: " + str(err.get("error", str(err)))) from None

    def chat(self, message: str, file_path: str | None = None) -> dict:
        response = requests.post(
            f"{self.base_url}/chat",
            json={"message": message, "file": file_path},
            timeout=max(30, AppConfig.GAI_TIMEOUT // 1000 + 20),
        )
        try:
            response.raise_for_status()
            return response.json()
        except Exception:
            from json import JSONDecodeError
            try:
                err = response.json()
            except (ValueError, JSONDecodeError):
                err = {"ok": False, "error": response.text[:500] or f"HTTP {response.status_code}"}
            raise WorkerHttpClientError("Node worker: " + str(err.get("error", str(err)))) from None

    def reset(self) -> dict:
        response = requests.post(f"{self.base_url}/reset", timeout=15)
        try:
            response.raise_for_status()
            return response.json()
        except Exception:
            from json import JSONDecodeError
            try:
                err = response.json()
            except (ValueError, JSONDecodeError):
                err = {"ok": False, "error": response.text[:500] or f"HTTP {response.status_code}"}
            raise WorkerHttpClientError("Node worker: " + str(err.get("error", str(err)))) from None
