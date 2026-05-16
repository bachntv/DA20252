from sqlalchemy import Column, String, DateTime
from models.base import Base
from datetime import datetime
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class ListeningHistory(Base):
    __tablename__ = "listening_history"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    track_id = Column(String, nullable=False, index=True)
    source = Column(String, nullable=True)
    played_at = Column(DateTime, nullable=False, default=datetime.utcnow)

