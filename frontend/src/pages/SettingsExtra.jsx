import React, { useState, useCallback, useMemo } from "react";
import "../styles/MainContent/SettingsExtra.css";

function SettingsExtra() {
  const [tab, setTab] = useState("General");

  const [form, setForm] = useState({
    name: "",
    email: "",
    theme: "light",
    language: "en",
    notifications: true,
    privacy: "standard",
    security: "medium",
    twoFactor: false,
    backupCodes: false,
    accentColor: "#007bff",
  });

  const updateField = useCallback(
    (field, value) => setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  /* -------------------------
      Field Renderers 
  ------------------------- */
  const GeneralFields = () => (
    <>
      <input
        value={form.name}
        onChange={(e) => updateField("name", e.target.value)}
        placeholder="Name"
      />
      <input
        value={form.email}
        onChange={(e) => updateField("email", e.target.value)}
        placeholder="Email"
      />
      <select
        value={form.language}
        onChange={(e) => updateField("language", e.target.value)}
      >
        <option value="en">English</option>
        <option value="vi">Vietnamese</option>
        <option value="jp">Japanese</option>
      </select>
    </>
  );

  const ThemeFields = () => (
    <>
      <select
        value={form.theme}
        onChange={(e) => updateField("theme", e.target.value)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>

      <input
        type="color"
        value={form.accentColor}
        onChange={(e) => updateField("accentColor", e.target.value)}
      />
    </>
  );

  const SecurityFields = () => (
    <>
      <select
        value={form.security}
        onChange={(e) => updateField("security", e.target.value)}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>

      <label>
        <input
          type="checkbox"
          checked={form.twoFactor}
          onChange={(e) => updateField("twoFactor", e.target.checked)}
        />
        Enable 2FA
      </label>

      <label>
        <input
          type="checkbox"
          checked={form.backupCodes}
          onChange={(e) => updateField("backupCodes", e.target.checked)}
        />
        Enable Backup Codes
      </label>
    </>
  );

  const AdvancedFields = () => (
    <>
      <select
        value={form.privacy}
        onChange={(e) => updateField("privacy", e.target.value)}
      >
        <option value="standard">Standard</option>
        <option value="private">Private</option>
        <option value="public">Public</option>
      </select>

      <label>
        <input
          type="checkbox"
          checked={form.notifications}
          onChange={(e) => updateField("notifications", e.target.checked)}
        />
        Enable Notifications
      </label>
    </>
  );

  const renderFields = () => {
    switch (tab) {
      case "General":
        return <GeneralFields />;
      case "Theme":
        return <ThemeFields />;
      case "Security":
        return <SecurityFields />;
      case "Advanced":
        return <AdvancedFields />;
      default:
        return null;
    }
  };

  /* -------------------------
      Create 12 Sections 
  ------------------------- */
  const sections = useMemo(() => Array.from({ length: 12 }), []);

  return (
    <div className="settings-extra-root">
      {sections.map((_, i) => (
        <div className="settings-extra-section" key={i}>
          <div className="settings-extra-tabs">
            {["General", "Security", "Theme", "Advanced"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t} {i + 1}
              </button>
            ))}
          </div>

          <form className="settings-extra-form">
            {renderFields()}
            <button type="button" onClick={() => console.log("Saved:", form)}>
              Save
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}

export default SettingsExtra;
