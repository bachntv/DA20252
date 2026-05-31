from pydantic import BaseModel
from typing import Optional

class ArtistResponse(BaseModel):
    id: str
    name: str
    profile_image_url: Optional[str]
    followers: Optional[int] = 0
    monthly_listeners: Optional[int] = 0
    track_count: Optional[int] = 0
    description: Optional[str] = None
