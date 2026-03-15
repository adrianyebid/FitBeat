from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "component_a"
    DATABASE_URL: str
    
    # Spotify API (Deben coincidir con tu .env)
    SPOTIFY_CLIENT_ID: str
    SPOTIFY_CLIENT_SECRET: str
    REDIRECT_URI: str 

    # Encryption (opcional — para futura mitigación CWE-312)
    ENCRYPTION_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

settings = Settings()