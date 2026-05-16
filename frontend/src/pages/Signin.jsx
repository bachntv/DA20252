import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom"; //  Added useLocation
import "../styles/SignIn/SignIn.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const SignIn = () => {
  console.log(API_BASE);
  const [formData, setFormData] = useState({
    identifier: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation(); // ✅ Get current location

  // Check for redirect parameter and handle existing token
  useEffect(() => {
    // Check URL for redirect parameter
    const params = new URLSearchParams(location.search);
    const redirectPath = params.get('redirect');
    
    // If redirect parameter exists, store it
    if (redirectPath) {
      localStorage.setItem('redirectAfterLogin', redirectPath);
      console.log("Will redirect to:", redirectPath, "after login");
    }
    
    // If token exists, redirect appropriately
    const token = localStorage.getItem("token");
    if (token) {
      // Get saved redirect path or fall back to home
      const savedRedirect = localStorage.getItem('redirectAfterLogin') || "/";
      localStorage.removeItem('redirectAfterLogin'); // Clear after using
      navigate(savedRedirect);
    }
  }, [navigate, location]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Sign in failed");
      }

      const userData = await response.json();
      localStorage.setItem("token", userData.access_token);
      localStorage.setItem("user", JSON.stringify(userData.user));

      console.log("Signed in user:", userData);
      alert(`Welcome, ${userData.user.username}!`);

      // Handle redirect after successful login
      setTimeout(() => {
        // Get saved redirect path or fall back to home
        const redirectPath = localStorage.getItem('redirectAfterLogin') || "/";
        localStorage.removeItem('redirectAfterLogin'); // Clear after using
        navigate(redirectPath);
      }, 200);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="spotify-signin">
      <div className="signin-container">
        <h1>Sign In to Your Account</h1>

        <p className={`error-text ${error ? "revealed" : ""}`}>{error || " "}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="identifier"
            placeholder="Username or Email"
            value={formData.identifier}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <hr className="divider" />
        <p style={{ color: "white" }}>
          Don't have an account?{" "}
          <a href="/signup" className="signup-link">Sign up here</a>
        </p>
      </div>
    </div>
  );
};

export default SignIn;