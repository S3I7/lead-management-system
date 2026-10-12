from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.entities import AuditLog
from app.schemas.all_schemas import AuditLogOut
from app.api.deps import require_admin

router = APIRouter(prefix="/audit", tags=["Audit History"])


@router.get("", response_model=List[AuditLogOut])
def list_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    """Read-only: there is deliberately no endpoint that edits or deletes audit rows."""
    q = db.query(AuditLog).options(selectinload(AuditLog.user))
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.filter(AuditLog.entity_id == entity_id)
    if action:
        q = q.filter(AuditLog.action == action)
    if user_id is not None:
        q = q.filter(AuditLog.user_id == user_id)
    rows = q.order_by(desc(AuditLog.id)).offset(skip).limit(limit).all()
    return [{**AuditLogOut.model_validate(r).model_dump(), "user_name": r.user.full_name if r.user else None} for r in rows]
