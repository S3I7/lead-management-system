import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import SessionLocal, engine, Base
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
        except Exception as e:
            await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables & run seeder
    Base.metadata.create_all(bind=engine)
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Writathon CRM Backend", "version": "1.0.0"}

@app.get("/")
def root():
    return {
        "message": "Welcome to Writathon Lead Management System API",
        "docs_url": "/docs",
        "version": "1.0.0"
    }
