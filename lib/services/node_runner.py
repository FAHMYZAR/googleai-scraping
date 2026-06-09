import json
import subprocess
from pathlib import Path

from lib.core.config import AppConfig


class NodeRunnerError(Exception):
    pass


class NodeRunner:
    def __init__(self):
        self.worker = Path(__file__).resolve().parent / "worker" / "call_gai.mjs"

    def run_gai(self, message: str) -> dict:
        payload = {
            "message": message,
            "cookies": str(AppConfig.GAI_COOKIES_PATH),
            "hl": AppConfig.GAI_LANG,
            "timeout": AppConfig.GAI_TIMEOUT,
        }
        try:
            process = subprocess.run(
                [AppConfig.NODE_BIN, str(self.worker)],
                input=json.dumps(payload),
                capture_output=True,
                text=True,
                timeout=max(30, AppConfig.GAI_TIMEOUT // 1000 + 15),
                cwd=str(self.worker.parent),
            )
        except subprocess.TimeoutExpired as error:
            raise NodeRunnerError("Node worker timeout") from error
        except Exception as error:
            raise NodeRunnerError(str(error)) from error

        stdout = (process.stdout or "").strip()
        stderr = (process.stderr or "").strip()

        if process.returncode != 0:
            raise NodeRunnerError(stderr or stdout or f"Node worker failed: {process.returncode}")

        try:
            return json.loads(stdout)
        except json.JSONDecodeError as error:
            raise NodeRunnerError(f"Invalid JSON from node worker: {stdout[:500]}") from error
