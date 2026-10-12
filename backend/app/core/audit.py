from typing import Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import AuditLog, User


def audit(db: Session, user: Optional[User], action: str, entity_type: str, entity_id: Optional[int],
          changes: Optional[dict[str, Any]] = None) -> None:
    """Adds an audit row to the caller's transaction, so it commits (or rolls back) with the change it describes."""
    db.add(AuditLog(user_id=user.id if user else None, action=action, entity_type=entity_type,
                    entity_id=entity_id, changes=_jsonable(changes)))


def diff(obj: Any, new_values: dict[str, Any]) -> dict[str, list]:
    """{"field": [old, new]} for the fields that actually change."""
    return {k: [getattr(obj, k), v] for k, v in new_values.items() if getattr(obj, k) != v}


def _jsonable(v: Any) -> Any:
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    return getattr(v, "value", None) or str(v)  # enums -> value, dates/decimals -> str
