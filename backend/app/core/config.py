import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "QuantLens AI"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database URL - fallback to SQLite if PostgreSQL is not configured
    DATABASE_URL: str = "sqlite:///./quantlens.db"

    # Finnhub API (free tier: 60 calls/min, register at https://finnhub.io)
    FINNHUB_API_KEY: str = ""

    # CORS — comma-separated list of allowed origins
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"

    # Allow reading from .env file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
