import pickle
import re

import requests

from lib.core.config import AppConfig


class MoodleSessionService:
    def __init__(self):
        self.base_url = AppConfig.MOODLE_BASE
        self.cookie_file = AppConfig.COOKIE_FILE
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
        self._load_cookies()

    def _load_cookies(self):
        if not self.cookie_file.exists():
            raise FileNotFoundError(f"Cookie file not found: {self.cookie_file}")

        with open(self.cookie_file, "rb") as file:
            cookies = pickle.load(file)

        for name, value in cookies.items():
            self.session.cookies.set(name, value, domain="elearning.almaata.ac.id")

    def save_cookies(self, cookies: dict):
        with open(self.cookie_file, "wb") as file:
            pickle.dump(cookies, file)

    def get(self, url: str, **kwargs):
        full_url = url if url.startswith("http") else f"{self.base_url}{url}"
        return self.session.get(full_url, **kwargs)

    def post(self, url: str, **kwargs):
        full_url = url if url.startswith("http") else f"{self.base_url}{url}"
        return self.session.post(full_url, **kwargs)

    def get_sesskey(self):
        response = self.get("/my/", timeout=15, allow_redirects=True)
        final_url = str(response.url).lower()

        if any(key in final_url for key in ["login", "/index.php", "forgot_password", "logout"]):
            raise ValueError("Session Moodle invalid atau diarahkan ke login.")

        match = re.search(r'"sesskey":"(\w+)"', response.text) or re.search(r'sesskey=(\w+)', response.text)
        if not match:
            raise ValueError("Sesskey not found. Cookie may be expired.")
        return match.group(1)
