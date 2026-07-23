from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MONGODB_URL: str = (
        "mongodb://root:password123@localhost:27017/my_app?authSource=admin"
    )
    MONGODB_DB: str = "my_app"
    
    # JWT Settings
    SECRET_KEY: str = "your-super-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION_NAME: str = "documents"
    QDRANT_EMBEDDING_SIZE: int = 1536

    # OpenAI
    OPENAI_API_KEY: str | None = None
    EMBEDDING_MODEL: str | None = None
    AI_MODEL: str | None = None

    # MinIO
    MINIO_ENDPOINT: str | None = None
    MINIO_ACCESS_KEY: str | None = None
    MINIO_SECRET_KEY: str | None = None
    MINIO_BUCKET: str | None = None
    MINIO_SECURE: bool = False

    # Tavily
    TAVILY_API_KEY: str | None = None

    LANGSMITH_TRACING: str | None = None 
    LANGSMITH_API_KEY: str | None = None
    LANGSMITH_PROJECT: str = "New python AI"
    LANGSMITH_ENDPOINT: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# ---------------------------------------------------------------------------
# LangSmith Auto-Export
# The newer langsmith SDK (>= 0.1.x) reads LANGSMITH_* directly from os.environ.
# pydantic-settings loads .env into the Settings object but does NOT propagate
# values to os.environ — so we must do it explicitly here, before any
# langchain/langgraph module is imported.
# ---------------------------------------------------------------------------
import os
if settings.LANGSMITH_API_KEY and settings.LANGSMITH_TRACING == "true":
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_API_KEY"] = settings.LANGSMITH_API_KEY
    os.environ["LANGSMITH_PROJECT"] = settings.LANGSMITH_PROJECT
    os.environ["LANGSMITH_ENDPOINT"] = settings.LANGSMITH_ENDPOINT or "https://api.smith.langchain.com"

