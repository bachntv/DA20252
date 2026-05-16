from sqlalchemy import Column, String, Boolean
from models.base import Base

class Album(Base):
    __tablename__ = "albums"

    id = Column(String, primary_key=True)
    name = Column(String)
    release_date = Column(String)
    image_url = Column(String)
    type = Column(String)
    is_active = Column(Boolean, nullable=False, default=True)
