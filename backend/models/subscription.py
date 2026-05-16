from sqlalchemy import Column, String, Boolean, DateTime
from models.base import Base
from datetime import datetime
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    plan_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="active")
    auto_renew = Column(Boolean, nullable=False, default=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

