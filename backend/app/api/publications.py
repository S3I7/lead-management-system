from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import (
    StorySubmission, StoryStatus, Publication, PublicationStatus, User
)
from app.schemas.all_schemas import PublicationUpdate, PublicationOut
from app.api.deps import require_staff_or_admin

router = APIRouter(prefix="/publications", tags=["Publications"])

@router.put("/{story_id}", response_model=PublicationOut)
def update_publication_status(
    story_id: int,
    payload: PublicationUpdate,
    db: Session = Depends(get_db),
    publisher: User = Depends(require_staff_or_admin)
):
    story = db.query(StorySubmission).filter(StorySubmission.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story submission not found.")

    publication = db.query(Publication).filter(Publication.story_id == story_id).first()
    now = datetime.now(timezone.utc)

    if not publication:
        publication = Publication(
            story_id=story_id,
            publisher_id=publisher.id,
            publication_status=payload.publication_status,
            publication_url=payload.publication_url,
            publication_notes=payload.publication_notes,
            published_at=now if payload.publication_status == PublicationStatus.PUBLISHED else None
        )
        db.add(publication)
    else:
        publication.publisher_id = publisher.id
        publication.publication_status = payload.publication_status
        if payload.publication_url is not None:
            publication.publication_url = payload.publication_url
        if payload.publication_notes is not None:
            publication.publication_notes = payload.publication_notes
        if payload.publication_status == PublicationStatus.PUBLISHED and not publication.published_at:
            publication.published_at = now

    if payload.publication_status == PublicationStatus.PUBLISHED:
        story.status = StoryStatus.PUBLISHED

    db.commit()
    db.refresh(publication)

    return {
        "id": publication.id,
        "story_id": publication.story_id,
        "publisher_id": publication.publisher_id,
        "publisher_name": publisher.full_name,
        "publication_status": publication.publication_status,
        "publication_url": publication.publication_url,
        "publication_notes": publication.publication_notes,
        "published_at": publication.published_at,
        "created_at": publication.created_at
    }
