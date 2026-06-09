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

    # Redis cache for JWT token validation
    REDIS_URL: str = "redis://localhost:6379/0"

    # Local auth (JWT de la aplicacion)
    JWT_SECRET_KEY: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    LOCAL_AUTH_DEFAULT_AGE: int = 18

    # Spotify API URLs — override with mock for performance/integration tests
    SPOTIFY_AUTH_URL: str = "https://accounts.spotify.com/authorize"
    SPOTIFY_TOKEN_URL: str = "https://accounts.spotify.com/api/token"
    SPOTIFY_ME_URL: str = "https://api.spotify.com/v1/me"
    SPOTIFY_NOW_PLAYING_URL: str = "https://api.spotify.com/v1/me/player/currently-playing"

    # App / integration settings
    FRONTEND_APP_URL: str = "http://localhost:5173"
    INTERNAL_SERVICE_TOKEN: str = ""
    FITBEAT_INTERNAL_SECRET: str = ""

    # Service Discovery — Consul
    CONSUL_ADDR: str = ""           # e.g. "consul:8500"  (empty = discovery disabled)
    INSTANCE_HOST: str = ""         # Docker hostname of this container, e.g. "fb_users_ms_1"
    INSTANCE_ID: str = ""           # Unique ID for this replica, e.g. "user-service-1"
    SERVICE_PORT: int = 8000

    @property
    def effective_internal_secret(self) -> str:
        """Returns FITBEAT_INTERNAL_SECRET with fallback to INTERNAL_SERVICE_TOKEN."""
        return self.FITBEAT_INTERNAL_SECRET or self.INTERNAL_SERVICE_TOKEN

    @property
    def redis_url(self) -> str:
        """Returns Redis connection URL from environment."""
        return self.REDIS_URL

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
