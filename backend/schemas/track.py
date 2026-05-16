from pydantic import BaseModel
from typing import Optional

class TrackResponse(BaseModel):
    id: str
    title: str
    artist_id: str
    artist: str
    album_id: str
    album: str
    duration: str
    cover_url: Optional[str] = None
    date_added: Optional[str] = None

    class Config:
        orm_mode = True