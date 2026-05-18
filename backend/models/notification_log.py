from sqlalchemy import Column, String, DateTime, Boolean
from models.base import Base
from datetime import datetime
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    channel = Column(String, nullable=False, default="internal")
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    status = Column(String, nullable=False, default="created")
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
