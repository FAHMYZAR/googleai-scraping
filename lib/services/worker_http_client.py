import requests

from lib.core.config import AppConfig


class WorkerHttpClientError(Exception):
    pass


class WorkerHttpClient:
    def __init__(self):
        self.base_url = f"http://{AppConfig.GAI_WORKER_HOST}:{AppConfig.GAI_WORKER_PORT}"

    def health(self):
        response = requests.get(f"{self.base_url}/health", timeout=10)
        response.raise_for_status()
        return response.json()

    def chat(self, message: str, file_path: str | None = None) -> dict:
        response = requests.post(
            f"{self.base_url}/chat",
            json={"message": message, "file": file_path},
            timeout=max(30, AppConfig.GAI_TIMEOUT // 1000 + 20),
        )
        response.raise_for_status()
        return response.json()

    def reset(self) -> dict:
        response = requests.post(f"{self.base_url}/reset", timeout=15)
        response.raise_for_status()
        return response.json()
