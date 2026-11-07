from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./app.db"
    jwt_secret: str = "dev-only-change-me"
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "*"
    admin_username: str = ""
    admin_email: str = ""
    admin_password: str = ""
    admin_name: str = "Supervisor"


settings = Settings()
