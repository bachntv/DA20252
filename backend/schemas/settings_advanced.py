from pydantic import BaseModel, Field
from typing import Optional, List, Dict


# ============================
# Notification Settings
# ============================
class UserNotificationSettings(BaseModel):
    app_updates: bool = Field(default=True)
    event_reminders: bool = Field(default=False)
    sound_alerts: bool = Field(default=True)
    notification_schedule: Optional[str] = Field(default=None)

    email_notifications: bool = Field(default=True)
    push_notifications: bool = Field(default=True)
    sms_notifications: bool = Field(default=False)
    newsletter_subscribed: bool = Field(default=False)
    marketing_notifications: bool = Field(default=False)
    product_updates: bool = Field(default=True)
    weekly_summary: bool = Field(default=True)

    def summary(self) -> str:
        return (
            f"Email: {self.email_notifications}, "
            f"Push: {self.push_notifications}, "
            f"SMS: {self.sms_notifications}"
        )


# ============================
# Privacy Settings
# ============================
class UserPrivacySettings(BaseModel):
    allow_message_requests: bool = Field(default=True)
    hide_activity_status: bool = Field(default=False)
    ad_personalization: bool = Field(default=False)
    privacy_level: str = Field(default="standard")

    profile_visible: bool = Field(default=True)
    search_engine_index: bool = Field(default=False)
    allow_friend_requests: bool = Field(default=True)
    blocked_users: List[str] = Field(default_factory=list)
    allow_tagging: bool = Field(default=True)
    show_online_status: bool = Field(default=True)
    data_sharing: bool = Field(default=False)

    def is_private(self) -> bool:
        return (
            not self.profile_visible
            or not self.allow_friend_requests
            or self.hide_activity_status
        )


# ============================
# Theme / UI Settings
# ============================
class UserThemeSettings(BaseModel):
    accent_color: Optional[str] = Field(default="#007bff")
    border_radius: int = Field(default=4)
    compact_mode: bool = Field(default=False)
    transition_speed: str = Field(default="normal")

    theme: str = Field(default="light")
    font_size: str = Field(default="medium")
    high_contrast: bool = Field(default=False)
    background_image: Optional[str] = Field(default=None)
    custom_palette: Dict[str, str] = Field(default_factory=dict)
    animation_enabled: bool = Field(default=True)

    def palette_summary(self) -> str:
        return f"Palette keys: {list(self.custom_palette.keys())}, Accent: {self.accent_color}"

    def is_dark_mode(self) -> bool:
        return self.theme.lower() == "dark"


# ============================
# Language Settings
# ============================
class UserLanguageSettings(BaseModel):
    spellcheck_enabled: bool = Field(default=True)
    auto_translate: bool = Field(default=False)
    preferred_voice: Optional[str] = Field(default=None)

    language: str = Field(default="en")
    region: Optional[str] = Field(default=None)
    fallback_languages: List[str] = Field(default_factory=list)
    date_format: str = Field(default="YYYY-MM-DD")
    time_format: str = Field(default="24h")

    def language_summary(self) -> str:
        return (
            f"Lang: {self.language}, Region: {self.region}, "
            f"Fallback: {self.fallback_languages}"
        )


# ============================
# Security Settings
# ============================
class UserSecuritySettings(BaseModel):
    biometric_enabled: bool = Field(default=False)
    login_history_limit: int = Field(default=10)
    suspicious_activity_alerts: bool = Field(default=True)

    two_factor_enabled: bool = Field(default=False)
    login_alerts: bool = Field(default=True)
    devices: List[str] = Field(default_factory=list)
    backup_codes_enabled: bool = Field(default=False)
    password_expiry_days: int = Field(default=90)
    security_questions: List[str] = Field(default_factory=list)

    def security_level(self) -> str:
        if self.biometric_enabled and self.two_factor_enabled:
            return "high"
        if self.two_factor_enabled:
            return "medium"
        return "low"

    def is_strong_security(self) -> bool:
        return (
            self.two_factor_enabled
            and self.backup_codes_enabled
            and self.password_expiry_days <= 90
        )


# ============================
# Update Request (PATCH)
# ============================
class UserSettingsUpdateRequest(BaseModel):
    notifications: Optional[UserNotificationSettings]
    privacy: Optional[UserPrivacySettings]
    theme: Optional[UserThemeSettings]
    language: Optional[UserLanguageSettings]
    security: Optional[UserSecuritySettings]


# ============================
# Full Response Object
# ============================
class UserSettingsResponse(BaseModel):
    user_id: str
    notifications: UserNotificationSettings
    privacy: UserPrivacySettings
    theme: UserThemeSettings
    language: UserLanguageSettings
    security: UserSecuritySettings
