from sqlalchemy import Column, String, DateTime
from models.base import Base
from datetime import datetime
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    details = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

