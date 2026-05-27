import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCheck, FaCrown } from "react-icons/fa";
import "../styles/MainContent/Premium.css";
import { authFetch } from "../utils/authFetch";

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:8001") + "/api/user";

const fallbackPlans = [
  {
    code: "free",
    name: "Free",
    price_monthly: 0,
    description: "Basic listening with a small personal library.",
    max_playlists: 3,
    emotion_recommendations: false,
    high_quality_audio: false,
  },
  {
    code: "premium",
    name: "Premium",
    price_monthly: 99000,
    description: "More playlists, emotion recommendations, and better listening quality.",
    max_playlists: 50,
    emotion_recommendations: true,
    high_quality_audio: true,
  },
];

const formatPrice = (price) =>
  price === 0 ? "Free" : `${price.toLocaleString("vi-VN")} VND`;

const PremiumPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");

  const plans = billing?.available_plans?.length ? billing.available_plans : fallbackPlans;
  const currentCode = billing?.current_plan?.plan?.code;
  const pendingPayment = billing?.recent_payments?.find((payment) => payment.status === "pending");

  const loadBilling = useCallback(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    authFetch(`${API_BASE}/billing`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setBilling(data))
      .catch((err) => {
        console.error("Failed to load premium plans:", err);
        setMessage("Could not load your current billing status.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const choosePlan = (planCode) => {
    if (!token) {
      localStorage.setItem("redirectAfterLogin", "/premium");
      navigate("/signin?redirect=%2Fpremium");
      return;
    }

    if (action || planCode === currentCode) return;
    setAction(`choose-${planCode}`);
    setMessage("");

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
        if (!res.ok) throw new Error(data.detail || "Failed to choose plan");
        const existingUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...existingUser, account_type: data.account_type }));
        setMessage(data.message);
        loadBilling();
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setAction(""));
  };

  const confirmPayment = (paymentId) => {
    if (!token || action) return;
    setAction(`confirm-${paymentId}`);
    setMessage("");

    authFetch(`${API_BASE}/billing/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ payment_id: paymentId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to confirm payment");
        const existingUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...existingUser, account_type: data.account_type }));
        setMessage(data.message);
        loadBilling();
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setAction(""));
  };

  return (
    <main className="premium-page">
      <button className="premium-back" type="button" onClick={() => navigate("/")}>
        <FaArrowLeft />
        Back
      </button>

      <section className="premium-hero">
        <div>
          <div className="premium-kicker">
            <FaCrown />
            Premium
          </div>
          <h1>Choose how you listen</h1>
          <p>Upgrade for larger playlists, emotion-based recommendations, and higher quality audio.</p>
        </div>
        {billing?.current_plan && (
          <div className="current-plan-pill">
            Current plan: <strong>{billing.current_plan.plan.name}</strong>
          </div>
        )}
      </section>

      {loading && <p className="premium-status">Loading plans...</p>}
      {message && <div className="premium-message">{message}</div>}

      {pendingPayment && (
        <section className="pending-payment">
          <div>
            <h2>Payment Pending</h2>
            <p>Confirm payment to activate your selected plan.</p>
          </div>
          <button
            type="button"
            className="premium-primary"
            disabled={!!action}
            onClick={() => confirmPayment(pendingPayment.id)}
          >
            {action === `confirm-${pendingPayment.id}` ? "Confirming..." : `Confirm ${formatPrice(pendingPayment.amount)}`}
          </button>
        </section>
      )}

      <section className="premium-plans">
        {plans.map((plan) => {
          const isCurrent = currentCode === plan.code;
          const isPremium = plan.code === "premium";
          return (
            <article className={`premium-plan ${isPremium ? "highlighted" : ""}`} key={plan.code}>
              <div className="plan-topline">
                <h2>{plan.name}</h2>
                {isPremium && <span>Best value</span>}
              </div>
              <p className="plan-description">{plan.description}</p>
              <div className="plan-price">
                {formatPrice(plan.price_monthly)}
                {plan.price_monthly > 0 && <span>/ month</span>}
              </div>
              <ul>
                <li><FaCheck /> Up to {plan.max_playlists} playlists</li>
                <li><FaCheck /> {plan.emotion_recommendations ? "Emotion recommendations" : "Basic recommendations"}</li>
                <li><FaCheck /> {plan.high_quality_audio ? "High quality audio" : "Standard audio quality"}</li>
              </ul>
              <button
                type="button"
                className={isPremium ? "premium-primary" : "premium-secondary"}
                disabled={isCurrent || !!action}
                onClick={() => choosePlan(plan.code)}
              >
                {action === `choose-${plan.code}`
                  ? "Submitting..."
                  : isCurrent
                    ? "Current Plan"
                    : plan.price_monthly > 0
                      ? "Buy Premium"
                      : "Choose Free"}
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
};

export default PremiumPage;
