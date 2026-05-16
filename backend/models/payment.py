from sqlalchemy import Column, String, Integer, DateTime
from models.base import Base
from datetime import datetime
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    subscription_id = Column(String, nullable=True, index=True)
    plan_id = Column(String, nullable=True, index=True)
    amount = Column(Integer, nullable=False, default=0)
    currency = Column(String, nullable=False, default="VND")
    provider = Column(String, nullable=False, default="manual")
    status = Column(String, nullable=False, default="paid")
    note = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

