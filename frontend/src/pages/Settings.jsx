import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import "../styles/MainContent/Settings.css";
import { authFetch } from "../utils/authFetch";

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:8001") + "/api/user";
const tabs = ["Account", "Security", "Billing"];

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("Account");
  const [formData, setFormData] = useState({});
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });
  const [billing, setBilling] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  // Fixed: Added empty dependency array to prevent infinite re-renders
  useEffect(() => {
    authFetch(`${API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => setFormData(data))
      .catch(err => console.error("Failed to load user:", err));
  }, [token]); // ← Added empty dependency array here

  const loadBilling = () => {
    setBillingLoading(true);
    authFetch(`${API_BASE}/billing`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => setBilling(data))
      .catch(err => console.error("Failed to load billing:", err))
      .finally(() => setBillingLoading(false));
  };

  useEffect(() => {
    if (activeTab === "Billing") {
      loadBilling();
    }
  }, [activeTab, token]);

  const handleChange = (e, field) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleAccountSubmit = (e) => {
    e.preventDefault();
    authFetch(`${API_BASE}/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    })
      .then(res => res.json())
      .then(() => alert("✅ Profile updated"))
      .catch(() => alert("❌ Failed to update"));
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    authFetch(`${API_BASE}/me/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(passwordForm),
    })
      .then(res => {
        if (!res.ok) throw new Error("Incorrect current password");
        return res.json();
      })
      .then(() => {
        alert("🔒 Password changed");
        setPasswordForm({ current_password: "", new_password: "" });
      })
      .catch((err) => alert(err.message));
  };

  const handleSubscribe = (planCode) => {
    authFetch(`${API_BASE}/billing/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan_code: planCode, payment_method: "manual" }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to change plan");
        const existingUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...existingUser, account_type: data.account_type }));
        alert(`✅ ${data.message}`);
        loadBilling();
      })
      .catch((err) => alert(err.message));
  };

  const handleDowngrade = () => {
    authFetch(`${API_BASE}/billing/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to downgrade plan");
        const existingUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...existingUser, account_type: data.account_type }));
        alert(`✅ ${data.message}`);
        loadBilling();
      })
      .catch((err) => alert(err.message));
  };

  return (
    <div className="settings-container">
      <aside className="settings-sidebar">
        <button className="home-button" onClick={() => navigate("/")}>
          <FaArrowLeft style={{ marginRight: "6px" }} />
          Back to Home
        </button>
        <h2>⚙ Settings</h2>
        <ul>
          {tabs.map((tab) => (
            <li
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </li>
          ))}
        </ul>
      </aside>

      <main className="settings-content">
        <h1>{activeTab} Settings</h1>

        {activeTab === "Account" && (
        <form onSubmit={handleAccountSubmit} className="section form-section">
            <label>
            Username:
            <input
                type="text"
                value={formData.username || ""}
                onChange={(e) => handleChange(e, "username")}
            />
            </label>

            <label>
            Email:
            <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleChange(e, "email")}
            />
            </label>

            <label>
            Gender:
            <select
                value={formData.gender || ""}
                onChange={(e) => handleChange(e, "gender")}
            >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
            </select>
            </label>

            <label>
            Birthdate:
            <input
                type="date"
                value={formData.birthdate || ""}
                onChange={(e) => handleChange(e, "birthdate")}
            />
            </label>

            <button type="submit" className="primary-button">Save Changes</button>
        </form>
        )}

        {activeTab === "Security" && (
          <form onSubmit={handlePasswordChange} className="section form-section">
            <label>
              Current Password:
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
              />
            </label>

            <label>
              New Password:
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              />
            </label>

            <button type="submit" className="primary-button">Change Password</button>
          </form>
        )}

        {activeTab === "Billing" && (
          <div className="section form-section">
            {billingLoading && <p>Loading billing information...</p>}

            {!billingLoading && billing?.current_plan && (
              <>
                <div style={{ marginBottom: "24px" }}>
                  <h3>Current Plan</h3>
                  <p><strong>{billing.current_plan.plan.name}</strong></p>
                  <p>{billing.current_plan.plan.description}</p>
                  <p>Price: {billing.current_plan.plan.price_monthly.toLocaleString("vi-VN")} VND / month</p>
                  <p>Playlist limit: {billing.current_plan.plan.max_playlists}</p>
                  <p>Emotion recommendations: {billing.current_plan.plan.emotion_recommendations ? "Enabled" : "Premium only"}</p>
                  {billing.current_plan.plan.code !== "free" && (
                    <button type="button" className="primary-button" onClick={handleDowngrade}>
                      Downgrade to Free
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <h3>Available Plans</h3>
                  {billing.available_plans.map((plan) => (
                    <div
                      key={plan.code}
                      style={{
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "12px",
                        padding: "16px",
                        marginBottom: "12px",
                      }}
                    >
                      <p><strong>{plan.name}</strong></p>
                      <p>{plan.description}</p>
                      <p>{plan.price_monthly.toLocaleString("vi-VN")} VND / month</p>
                      <p>Playlist limit: {plan.max_playlists}</p>
                      <p>Emotion recommendations: {plan.emotion_recommendations ? "Included" : "Not included"}</p>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={billing.current_plan.plan.code === plan.code}
                        onClick={() => handleSubscribe(plan.code)}
                      >
                        {billing.current_plan.plan.code === plan.code ? "Current Plan" : `Choose ${plan.name}`}
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <h3>Recent Payments</h3>
                  {billing.recent_payments.length === 0 ? (
                    <p>No payments yet.</p>
                  ) : (
                    billing.recent_payments.map((payment) => (
                      <div
                        key={payment.id}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.15)",
                          padding: "10px 0",
                        }}
                      >
                        <p>
                          <strong>{payment.amount.toLocaleString("vi-VN")} {payment.currency}</strong> - {payment.status}
                        </p>
                        <p>Method: {payment.provider}</p>
                        <p>{payment.note}</p>
                        <p>{payment.created_at}</p>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default SettingsPage;
