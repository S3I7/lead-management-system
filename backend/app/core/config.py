import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Writathon Lead Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "writathon_super_secret_jwt_key_2026_secured")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./writathon.db")
    
    # Upload storage
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25MB
    
    # Frontend URL for link generation
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Reminder schedule in days
    REMINDER_DAYS_CONFIG: list[int] = [3, 7, 14]
    
    # Payment gateway options
    PAYMENT_GATEWAY_PROVIDER: str = os.getenv("PAYMENT_GATEWAY_PROVIDER", "RAZORPAY")
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
