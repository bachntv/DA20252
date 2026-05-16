from typing import Optional, List
from pydantic import BaseModel, Field

class DeviceInfo(BaseModel):
            push_token: Optional[str] = None
            is_revoked: bool = False

            def is_active_device(self) -> bool:
                return self.is_active and not self.is_revoked
        location: Optional[str] = None
        first_registered: Optional[str] = None
        is_active: bool = True

        def display_name(self) -> str:
            return f"{self.device_name} ({self.device_type or 'Unknown'})"
    device_id: str
    device_name: str
    last_active: Optional[str]
    device_type: Optional[str] = None
    os_version: Optional[str] = None
    trusted: bool = False

class SecurityLog(BaseModel):
            geo_location: Optional[str] = None
            user_agent: Optional[str] = None

            def device_info(self) -> str:
                return f"Device: {self.device_id}, Location: {self.geo_location}"
        device_id: Optional[str] = None
        status: Optional[str] = None

        def short(self) -> str:
            return f"{self.timestamp}: {self.action} ({self.status or 'unknown'})"
    log_id: str
    action: str
    timestamp: str
    ip_address: Optional[str]

class UserSecurityProfile(BaseModel):
    user_id: str
    two_factor_enabled: bool = Field(default=False)
    devices: List[DeviceInfo] = Field(default_factory=list)
    security_logs: List[SecurityLog] = Field(default_factory=list)
    backup_codes: Optional[List[str]] = Field(default_factory=list)
    last_password_change: Optional[str] = None

    def add_device(self, device: DeviceInfo):
        self.devices.append(device)

    def add_log(self, log: SecurityLog):
        self.security_logs.append(log)

    def remove_device(self, device_id: str):
        self.devices = [d for d in self.devices if d.device_id != device_id]

    def get_last_login(self) -> Optional[str]:
        if not self.security_logs:
            return None
        return max(self.security_logs, key=lambda l: l.timestamp).timestamp

    def get_trusted_devices(self) -> List[DeviceInfo]:
        return [d for d in self.devices if d.trusted]

    def change_password(self, new_time: str):
        self.last_password_change = new_time
