from pydantic import BaseModel
from typing import Optional

class AlbumResponse(BaseModel):
    id: str
    name: str
    cover_image_url: Optional[str]
    release_date: Optional[str]
    artist_name: str
    artist_id: str