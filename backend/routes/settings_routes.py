from fastapi import APIRouter
from backend.schemas.settings_profile import SettingsProfile

router = APIRouter()

@router.get("/api/settings/profile", response_model=SettingsProfile)
def get_settings_profile():
    return SettingsProfile(
        username="demo_user",
        email="demo@example.com",
        theme="dark",
        language="en",
        notifications_enabled=True
    )
