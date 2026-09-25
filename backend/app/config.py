from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite by default so the app runs with no local server.
    # Postgres: postgresql+psycopg://user:pass@localhost:5432/career_assistant
    database_url: str = "sqlite:///./dev.db"

    cors_origins: str = "http://localhost:5173"

    # Not used yet -- the Aivana calls are still mocked.
    aivana_api_key: str = ""
    aivana_base_url: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
