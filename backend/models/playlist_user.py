from sqlalchemy import Column, String, DateTime
from models.base import Base
from datetime import datetime
from zoneinfo import ZoneInfo

class PlaylistUser(Base):

    __tablename__="playlist_user"

    playlist_id = Column(String, primary_key=True)
    user_id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(ZoneInfo("Asia/Bangkok")).replace(tzinfo=None))
    last_played = Column(DateTime, nullable=True)