from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "component_a"
    DATABASE_URL: str

    # Spotify API
    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    REDIRECT_URI: str = ""

    # Encryption (futura mitigacion en reposo)
    ENCRYPTION_KEY: str = ""

    # Local auth (JWT de la aplicacion)
    JWT_SECRET_KEY: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    LOCAL_AUTH_DEFAULT_AGE: int = 18

    # App / integration settings
    FRONTEND_APP_URL: str = "http://localhost:5173"
    INTERNAL_SERVICE_TOKEN: str = ""
    FITBEAT_INTERNAL_SECRET: str = ""

    @property
    def effective_internal_secret(self) -> str:
        """Returns FITBEAT_INTERNAL_SECRET with fallback to INTERNAL_SERVICE_TOKEN."""
        return self.FITBEAT_INTERNAL_SECRET or self.INTERNAL_SERVICE_TOKEN

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
