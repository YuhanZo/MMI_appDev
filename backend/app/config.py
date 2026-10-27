from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor paths to backend/, not the directory uvicorn happens to be started from.
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore", str_strip_whitespace=True)

    # SQLite by default so the app runs with no local server.
    # Postgres: postgresql+psycopg://user:pass@localhost:5432/career_assistant
    database_url: str = f"sqlite:///{BACKEND_DIR / 'dev.db'}"

    cors_origins: str = "http://localhost:5173"

    # mock: canned responses from mock_data.py, no key needed (default).
    # live: real Aivana MMI calls, which need a key and base URL.
    aivana_mode: Literal["mock", "live"] = "mock"
    aivana_api_key: str = ""
    aivana_base_url: str = ""

    # mock: canned jobs from mock_data.py, no key needed (default).
    # jsearch: real listings from the JSearch API, which needs a key.
    job_api_mode: Literal["mock", "jsearch"] = "mock"
    jsearch_api_key: str = ""

    @model_validator(mode="after")
    def _modes_need_credentials(self) -> "Settings":
        # Fail at startup with a clear message rather than on the first request.
        if self.aivana_mode == "live" and not (self.aivana_api_key and self.aivana_base_url):
            raise ValueError("AIVANA_MODE=live needs AIVANA_API_KEY and AIVANA_BASE_URL in backend/.env")
        if self.job_api_mode == "jsearch" and not self.jsearch_api_key:
            raise ValueError("JOB_API_MODE=jsearch needs JSEARCH_API_KEY in backend/.env")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
