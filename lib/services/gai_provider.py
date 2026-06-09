from lib.core.config import AppConfig
from lib.services.node_runner import NodeRunner
from lib.services.worker_http_client import WorkerHttpClient


class GaiProviderService:
    def __init__(self):
        self.runner = WorkerHttpClient() if AppConfig.GAI_USE_PERSISTENT_WORKER else NodeRunner()

    def chat(self, prompt: str, file_path: str | None = None) -> dict:
        if AppConfig.GAI_USE_PERSISTENT_WORKER:
            return self.runner.chat(prompt, file_path)
        # Fallback runner doesn't easily support files via CLI input payload
        return self.runner.run_gai(prompt)
