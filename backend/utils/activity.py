from sqlalchemy.orm import Session
from models.activity_log import ActivityLog


def log_activity(
    db: Session,
    user_id: str,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: str | None = None,
):
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
