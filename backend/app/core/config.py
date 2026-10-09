import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Writathon Lead Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str  # required: set in env or backend/.env, the app refuses to start without it
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
    # HMAC-SHA256 key the gateway signs webhooks with; webhooks are refused while unset
    PAYMENT_WEBHOOK_SECRET: str = ""

    # Demo mode: seeds demo users/leads, enables mock checkout. Never enable in production.
    DEMO_MODE: bool = False
    # First admin created on startup when no admin exists
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
