from sqlalchemy.orm import Session
from sqlalchemy import text

from models.notification_log import NotificationLog

MAX_NOTIFICATIONS_PER_USER = 100


def log_notification(
    db: Session,
    *,
    user_id: str | None,
    event_type: str,
    title: str,
    message: str,
    channel: str = "internal",
    status: str = "created",
):
    notification = NotificationLog(
        user_id=user_id,
        event_type=event_type,
        channel=channel,
        title=title,
        message=message,
        status=status,
    )
    db.add(notification)
    db.flush()
    db.execute(text("""
        DELETE FROM notification_logs
        WHERE user_id IS NOT DISTINCT FROM :user_id
          AND id NOT IN (
            SELECT id
            FROM notification_logs
            WHERE user_id IS NOT DISTINCT FROM :user_id
            ORDER BY created_at DESC
            LIMIT :limit
          )
    """), {"user_id": user_id, "limit": MAX_NOTIFICATIONS_PER_USER})
    return notification
