from fastapi import APIRouter, Body, HTTPException, Request
from typing import Dict
from backend.schemas.settings_advanced import (
    UserSettingsUpdateRequest, UserSettingsResponse,
    UserNotificationSettings, UserPrivacySettings,
    UserThemeSettings, UserLanguageSettings, UserSecuritySettings
)

router = APIRouter()

_db: Dict[str, UserSettingsResponse] = {}

# ---------------------------
# Helpers
# ---------------------------

def get_user_or_404(user_id: str) -> UserSettingsResponse:
    if user_id not in _db:
        raise HTTPException(status_code=404, detail="User not found")
    return _db[user_id]

def reset_section(user_id: str, section: str, model_cls):
    user = get_user_or_404(user_id)
    setattr(user, section, model_cls())
    return {"detail": f"{section.capitalize()} reset to default"}

# ---------------------------
# Main settings
# ---------------------------

@router.get("/settings/advanced/{user_id}", response_model=UserSettingsResponse)
def get_advanced_settings(user_id: str):
    if user_id not in _db:
        _db[user_id] = UserSettingsResponse(
            user_id=user_id,
            notifications=UserNotificationSettings(),
            privacy=UserPrivacySettings(),
            theme=UserThemeSettings(),
            language=UserLanguageSettings(),
            security=UserSecuritySettings()
        )
    return _db[user_id]


@router.put("/settings/advanced/{user_id}", response_model=UserSettingsResponse)
def update_advanced_settings(user_id: str, req: UserSettingsUpdateRequest):
    user = get_user_or_404(user_id)

    if req.notifications:
        user.notifications = req.notifications
    if req.privacy:
        user.privacy = req.privacy
    if req.theme:
        user.theme = req.theme
    if req.language:
        user.language = req.language
    if req.security:
        user.security = req.security

    return user

# ---------------------------
# Export / Import
# ---------------------------

@router.get("/settings/advanced/{user_id}/export")
def export_settings(user_id: str):
    return get_user_or_404(user_id).model_dump()

@router.post("/settings/advanced/{user_id}/import")
async def import_settings(user_id: str, request: Request):
    user = get_user_or_404(user_id)
    data = await request.json()

    for section in ["notifications", "privacy", "theme", "language", "security"]:
        if section in data:
            setattr(user, section, data[section])

    return {"detail": "Settings imported"}

@router.post("/settings/advanced/{user_id}/reset")
def reset_all_settings(user_id: str):
    user = get_user_or_404(user_id)
    user.notifications = UserNotificationSettings()
    user.privacy = UserPrivacySettings()
    user.theme = UserThemeSettings()
    user.language = UserLanguageSettings()
    user.security = UserSecuritySettings()
    return {"detail": "All settings reset to default"}

# ---------------------------
# Notification bulk toggle
# ---------------------------

@router.post("/settings/advanced/{user_id}/notifications/toggle")
def toggle_notifications(user_id: str, enable: bool = True):
    user = get_user_or_404(user_id)
    for field in user.notifications.model_fields:
        setattr(user.notifications, field, enable)
    return user.notifications

# ---------------------------
# Individual GET
# ---------------------------

@router.get("/settings/advanced/{user_id}/theme", response_model=UserThemeSettings)
def get_theme(user_id: str):
    return get_user_or_404(user_id).theme

@router.get("/settings/advanced/{user_id}/language", response_model=UserLanguageSettings)
def get_language(user_id: str):
    return get_user_or_404(user_id).language

@router.get("/settings/advanced/{user_id}/security", response_model=UserSecuritySettings)
def get_security(user_id: str):
    return get_user_or_404(user_id).security

# ---------------------------
# PATCH (partial update)
# ---------------------------

@router.patch("/settings/advanced/{user_id}/theme", response_model=UserThemeSettings)
def patch_theme(user_id: str, theme_patch: dict = Body(...)):
    user = get_user_or_404(user_id)
    user.theme = user.theme.model_copy(update=theme_patch)
    return user.theme

# ---------------------------
# PUT (Replace)
# ---------------------------
@router.delete("/settings/advanced/{user_id}/theme")
def delete_theme(user_id: str):
    return reset_section(user_id, "theme", UserThemeSettings)

@router.delete("/settings/advanced/{user_id}/language")
def delete_language(user_id: str):
    return reset_section(user_id, "language", UserLanguageSettings)

@router.delete("/settings/advanced/{user_id}/security")
def delete_security(user_id: str):
    return reset_section(user_id, "security", UserSecuritySettings)
