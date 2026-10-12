import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, engine, Base, get_db
from app.seed import seed_database
from app.services.reminder_scheduler import ReminderSchedulerService

from app.api.auth import router as auth_router
from app.api.writathons import router as writathons_router
from app.api.leads import router as leads_router
from app.api.submissions import router as submissions_router
from app.api.plagiarism import router as plagiarism_router
from app.api.reviews import router as reviews_router
from app.api.payments import router as payments_router
from app.api.publications import router as publications_router
from app.api.emails import router as emails_router
from app.api.dashboard import router as dashboard_router
from app.api.scheduler import router as scheduler_router
from app.api.students import router as students_router
from app.api.users import router as users_router
from app.api.audit import router as audit_router
from app.models.entities import Student, Lead
from sqlalchemy.schema import CreateIndex

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app")
logging.getLogger("httpx").setLevel(logging.WARNING)


def ensure_constraints():
    """create_all only builds indexes for new tables; add the uniqueness indexes to databases created earlier."""
    for table in (Student.__table__, Lead.__table__):
        for idx in table.indexes:
            if idx.unique:
                try:  # IF NOT EXISTS: the inspector behind checkfirst can't see SQLite expression indexes
                    with engine.begin() as conn:
                        conn.execute(CreateIndex(idx, if_not_exists=True))
                except Exception:
                    logger.exception("Could not create unique index %s: remove duplicate rows, then restart", idx.name)

async def periodic_reminder_task():
    """Background worker that periodically triggers the scheduled reminder job."""
    while True:
        try:
            await asyncio.sleep(3600)  # runs every hour
            db = SessionLocal()
            try:
                ReminderSchedulerService.process_pending_reminders(db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Reminder job failed")
            await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables & run seeder
    Base.metadata.create_all(bind=engine)
    ensure_constraints()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    task = asyncio.create_task(periodic_reminder_task())
    yield
    # Shutdown
    task.cancel()

app = FastAPI(
    title="Writathon Lead Management System (CRM)",
    description="Dedicated Lead Journey & Editorial Publication Management for Writathons",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=False,  # auth is a bearer header, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Total-Count"],
)

# API routers
api_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_prefix)
app.include_router(writathons_router, prefix=api_prefix)
app.include_router(leads_router, prefix=api_prefix)
app.include_router(submissions_router, prefix=api_prefix)
app.include_router(plagiarism_router, prefix=api_prefix)
app.include_router(reviews_router, prefix=api_prefix)
app.include_router(payments_router, prefix=api_prefix)
app.include_router(publications_router, prefix=api_prefix)
app.include_router(emails_router, prefix=api_prefix)
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(scheduler_router, prefix=api_prefix)
app.include_router(students_router, prefix=api_prefix)
app.include_router(users_router, prefix=api_prefix)
app.include_router(audit_router, prefix=api_prefix)

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "service": "Writathon CRM Backend",
        "version": "1.0.0"
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to Writathon Lead Management System API",
        "docs_url": "/docs",
        "version": "1.0.0"
    }
