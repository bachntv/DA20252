import React, { useState } from "react";
import Select from "react-select";
import { useNavigate } from "react-router-dom";
import "../styles/SignUp/SignUp.css";
import { components } from 'react-select';


const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const DropdownIndicator = (props) => {
  const { menuIsOpen } = props.selectProps;
  return (
    <components.DropdownIndicator {...props}>
      <span
        style={{
          display: "inline-block",
          transform: menuIsOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.3s ease",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M7 10l5 5 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    </components.DropdownIndicator>
  );
};

const Signup = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    birthdate: "",
    gender: "",
    agree: false
  });

  const genderOptions = [
    { value: "", label: "Select gender (optional)", isDisabled: true },
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    { value: "nonbinary", label: "Non-binary" },
    { value: "prefer-not", label: "Prefer not to say" },
  ];

  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password, username, birthdate, gender, agree } = formData;

    if (!email || !password || !username || !birthdate) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!agree) {
      setError("You must accept the terms and conditions.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username, birthdate, gender })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Signup failed.");
      }

      const result = await response.json();
      console.log("Signup successful:", result);
      alert("Signup successful!");
      navigate("/signin");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="spotify-signup">
      <div className="signup-container">
        <h1>Sign up for free to start listening</h1>

        {/* Consistent layout space for error */}
        <p className={`error-text ${error ? "revealed" : ""}`}>
          {error || " "}
        </p>

        <form onSubmit={handleSubmit}>
          <input type="text" name="username" placeholder="Username" value={formData.username} onChange={handleChange} required />
          <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
          <input type="date" name="birthdate" placeholder="Date of Birth" value={formData.birthdate} onChange={handleChange} required />

          <Select
            options={genderOptions}
            classNamePrefix="react-select"
            defaultValue={genderOptions[0]}
            components={{ DropdownIndicator }}
            isSearchable={false}
            onChange={(selectedOption) =>
              setFormData({ ...formData, gender: selectedOption.value })
            }
            isOptionDisabled={(option) => option.isDisabled}
            styles={{
              control: (base) => ({
                ...base,
                backgroundColor: "#2a2a2a",
                borderRadius: "6px",
                border: "none",
                boxShadow: "none",
                width: "90%",
                margin: "20px auto 0 auto",
                fontSize: "15px",
                color: "white",
                cursor: "pointer",
              }),
              indicatorSeparator: () => ({ display: "none" }),
              dropdownIndicator: (base) => ({
                ...base,
                color: "#ccc",
              }),
              singleValue: (base) => ({
                ...base,
                color: "white",
              }),
              option: (base, state) => ({
                ...base,
                padding: "12px 20px",
                backgroundColor: state.isSelected
                  ? "#7a7878"
                  : state.isFocused
                  ? "#333"
                  : "transparent",
                borderRadius: "10px",
                color: "white",
                fontWeight: "bold",
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: "#181818",
                borderRadius: "10px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                padding: "4px 0",
                marginTop: "8px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "90%",
                zIndex: 99,
              }),
              menuList: (base) => ({
                ...base,
                padding: 0,
                maxHeight: "200px",
                overflowY: "auto",
              }),
            }}
          />

          <label className="checkbox-label">
            <input type="checkbox" name="agree" checked={formData.agree} onChange={handleChange} />
            <p>I agree to the Terms and Conditions</p>
          </label>

          <button type="submit" className="signup-btn">Sign Up</button>
        </form>

        <hr className="divider" />
        <p style={{ color: "white" }}>
          Already have an account?{" "}
          <a href="/signin" className="signup-link">Sign in here</a>
        </p>
      </div>
    </div>
  );
};

export default Signup;