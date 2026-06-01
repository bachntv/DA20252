from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from models.base import Base


def generate_uuid():
    return str(uuid.uuid4())


class SongPurchase(Base):
    __tablename__ = "song_purchases"
    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_song_purchase_user_track"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=False, index=True)
    track_id = Column(String, nullable=False, index=True)
    amount = Column(Integer, nullable=False, default=15000)
    currency = Column(String, nullable=False, default="VND")
    status = Column(String, nullable=False, default="owned")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
