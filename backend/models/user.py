from sqlalchemy import Column, Integer, String, Date, Boolean
from models.base import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    birthdate = Column(Date, nullable=False)
    gender = Column(String, nullable=True)
    roles = Column(String, nullable=False, default="user")
    account_type = Column(String, nullable=False, default="free")
    profile_picture_url = Column(String, nullable=True)
    cover_photo_url = Column(String, nullable=True)
    profile_background_color = Column(String, nullable=False, default="#1877f2")
    is_active = Column(Boolean, nullable=False, default=True)
    is_muted = Column(Boolean, nullable=False, default=False)
