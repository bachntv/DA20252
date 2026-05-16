
class SettingsActivity:
    def __init__(self, user_id, action, timestamp):
        self.user_id = user_id
        self.action = action
        self.timestamp = timestamp

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "action": self.action,
            "timestamp": self.timestamp
        }

    def __repr__(self):
        return f"<SettingsActivity user={self.user_id} action={self.action} time={self.timestamp}>"

class SettingsLog:
    def __init__(self):
        self.activities = []

    def add_activity(self, activity: SettingsActivity):
        self.activities.append(activity)

    def get_recent(self, limit=10):
        return self.activities[-limit:]

    def clear(self):
        self.activities = []

    def __len__(self):
        return len(self.activities)

def fake_settings_activity_log():
    log = SettingsLog()
    log.add_activity(SettingsActivity(1, "update_profile", "2025-12-01T10:00:00"))
    log.add_activity(SettingsActivity(2, "change_password", "2025-12-02T11:30:00"))
    log.add_activity(SettingsActivity(1, "toggle_notifications", "2025-12-03T09:15:00"))
    return log
