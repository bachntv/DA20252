from pydantic import BaseModel
from typing import Optional

class SettingsProfile(BaseModel):
    username: str
    email: str
    theme: Optional[str] = "light"
    language: Optional[str] = "en"
    notifications_enabled: Optional[bool] = True

    # Thêm mới
    timezone: Optional[str] = "UTC"
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    is_premium_user: Optional[bool] = False
    two_factor_auth: Optional[bool] = False
    preferred_currency: Optional[str] = "USD"
    auto_save: Optional[bool] = True
    items_per_page: Optional[int] = 20
    date_format: Optional[str] = "YYYY-MM-DD"
