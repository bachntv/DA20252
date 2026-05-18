from sqlalchemy.orm import Session

from models.notification_log import NotificationLog


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
    return notification
