from pydantic import BaseModel
from typing import Optional

class ArtistResponse(BaseModel):
    id: str
    name: str
    profile_image_url: Optional[str]