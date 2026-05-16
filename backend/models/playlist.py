from sqlalchemy import Column, String, Boolean, Text, DateTime
from models.base import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cover_image_url = Column(String, nullable=True)
    # is_public = Column(Boolean, default=True)
    # last_played = Column(DateTime, nullable=True)
    # owner_id = Column(String, nullable=True)  # Not in DB schema, use playlist_user table instead
    """
    - type 'single' or 'composite' for album
    - type 'playlist' for user's playlists
    - type 'artist' if you add artist to your library
    """