from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PlaylistResponse(BaseModel):
    id: str
    name: Optional[str]
    owner_name: str
    type: str
    cover_image_url: Optional[str]
    description: Optional[str]
    created_at: datetime
    last_played: Optional[datetime]

    class Config:
        orm_mode = True