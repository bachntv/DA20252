from sqlalchemy import Column, String, Integer, Boolean
from models.base import Base

class Artist(Base):
    __tablename__ = "artists"

    id = Column(String, primary_key=True)
    name = Column(String)
    followers = Column(Integer)
    image_url = Column(String)
    is_active = Column(Boolean, nullable=False, default=True)
    owner_user_id = Column(String, nullable=True)
