import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Writathon Lead Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str  # required: set in env or backend/.env, the app refuses to start without it
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # one working day; deactivated users are also rejected on every request
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./writathon.db")
    
    # Upload storage
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25MB
    
    # Frontend URL for link generation
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    # Comma-separated origins allowed to call the API from a browser
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Outgoing email. While SMTP_HOST is empty, emails are logged as PENDING (not delivered).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_STARTTLS: bool = True

    # Requests per minute per client IP on public/sensitive endpoints; 0 disables (tests only)
    RATE_LIMIT_PER_MINUTE: int = 20
    
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
