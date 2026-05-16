from sqlalchemy import Column, Integer, String, Boolean
from models.base import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Plan(Base):
    __tablename__ = "plans"

    id = Column(String, primary_key=True, default=generate_uuid)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    price_monthly = Column(Integer, nullable=False, default=0)
    description = Column(String, nullable=True)
    max_playlists = Column(Integer, nullable=False, default=3)
    emotion_recommendations = Column(Boolean, nullable=False, default=False)
    high_quality_audio = Column(Boolean, nullable=False, default=False)

