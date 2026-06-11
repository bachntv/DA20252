from sqlalchemy import Column, String, Integer, Float, Boolean
from models.base import Base

class Song(Base):
    __tablename__ = "songs"

    track_id = Column(String, primary_key=True)
    track_name = Column(String)
    popularity = Column(Integer)
    duration_ms = Column(Integer)
    explicit = Column(Boolean)
    danceability = Column(Float)
    energy = Column(Float)
    key = Column(Integer)
    loudness = Column(Float)
    mode = Column(Integer)
    speechiness = Column(Float)
    acousticness = Column(Float)
    instrumentalness = Column(Float)
    liveness = Column(Float)
    valence = Column(Float)
    tempo = Column(Float)
    time_signature = Column(Integer)
    track_genre = Column(String)
    artist_id = Column(String, primary_key=True)
    album_id = Column(String)
    track_image_url = Column(String)
    lyrics = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    audio_url = Column(String, nullable=True)
    approval_status = Column(String, nullable=False, default="approved")
    uploaded_by_user_id = Column(String, nullable=True)
    rejection_reason = Column(String, nullable=True)
