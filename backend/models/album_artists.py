from sqlalchemy import Column, String
from models.base import Base

class AlbumArtist(Base):
    __tablename__ = "album_artists"

    album_id = Column(String, primary_key=True)
    artist_id = Column(String, primary_key=True)
