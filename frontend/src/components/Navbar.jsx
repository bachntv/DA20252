import React, { useState, useRef, useEffect, useCallback } from "react";
import "../styles/Navbar.css";
import { FaBell, FaChevronDown, FaCompass, FaHome, FaMusic, FaUsers } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; 
import { authFetch } from "../utils/authFetch";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const Navbar = ({ username, profilePicture, userId }) => {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const isAuthenticated = Boolean(token);
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchType, setSearchType] = useState("Track");
  const [searchTerm, setSearchTerm] = useState("");
  const [roles, setRoles] = useState([]); 

  const menuRef = useRef();
  const notificationRef = useRef();
  const dropdownRef = useRef();
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : "";

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const userRoles = decoded.roles || [];
        setRoles(Array.isArray(userRoles) ? userRoles : [userRoles]);
      } catch (err) {
        console.error("Invalid token", err);
      }
    }
  }, [token]);

  useEffect(() => {
    if (!location.pathname.includes("/search")) {
      setSearchTerm("");
    }
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      if (notificationRef.current && !notificationRef.current.contains(e.target)) setShowNotifications(false);
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchType === "Emotion") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm.trim()) return;

    debounceRef.current = setTimeout(() => {
      navigate(`/search?query=${encodeURIComponent(searchTerm)}&filter_by=${searchType.toLowerCase()}`);
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, searchType, navigate]);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("user");
    fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  const handleDropdownClick = (type) => {
    setSearchType(type);
    setShowDropdown(false);
  };

  const handleEmotionSearch = async (query) => {
    try {
      const formData = new FormData();
      formData.append('prompt', query);

      const res = await authFetch(`${API_BASE}/api/music/ask`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to get emotion recommendations");
      }

      const data = await res.json();
      navigate(`/search?query=${encodeURIComponent(query)}&filter_by=emotion&results=${encodeURIComponent(JSON.stringify(data))}`);
    } catch (err) {
      console.error("Failed to get emotion-based recommendations:", err);
      alert(err.message || "Failed to get emotion-based recommendations");
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/social/notifications`);
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60000);
    return () => clearInterval(timer);
  }, [fetchNotifications, isAuthenticated]);

  const openNotifications = async () => {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }

    const next = !showNotifications;
    setShowNotifications(next);
    if (next) {
      await fetchNotifications();
      await authFetch(`${API_BASE}/api/social/notifications/read`, { method: "POST" });
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    }
  };

  const handleEmotionClick = (type) => {
    setShowDropdown(false);
    setSearchType(type);
  };

  const openBrowse = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchTerm("");
    setShowDropdown(false);
    navigate("/search?browse=1");
  };

  return (
    <header className="navbar">
      <div className="nav-left">
  <img src="/my-logo.png" alt="App Logo" className="app-logo" />
  <button className="home-b" onClick={() => navigate("/")}>
    <FaHome />
  </button>
  <button className="home-b" onClick={() => navigate("/social")} title="Social Feed">
    <FaUsers />
  </button>
</div>


      <div className="nav-center">
        <div className="search-group">
          <input
            type="text"
            className="search-input"
            placeholder={
              searchType === "Emotion"
                ? "How are you feeling today?"
                : "What do you want to play?"
            }
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (searchType !== "Emotion") {
                navigate(`/search?query=${encodeURIComponent(e.target.value)}&filter_by=${searchType.toLowerCase()}`);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchType === "Emotion") {
                e.preventDefault();
                handleEmotionSearch(searchTerm);
              }
            }}
          />
          <div className="search-filter-wrapper" ref={dropdownRef}>
            <div
              className={`search-filter-button ${showDropdown ? "open" : ""}`}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              Search by {searchType} <FaChevronDown className="arrow-icon" />
            </div>
            <div className={`search-filter-dropdown ${showDropdown ? "show" : ""}`}>
              {["Track", "Artist", "Album", "Emotion"].map((type) => (
                <div
                  key={type}
                  className="dropdown-item"
                  onClick={() =>
                    type === "Emotion"
                      ? handleEmotionClick(type)
                      : handleDropdownClick(type)
                  }
                >
                  {type}
                </div>
              ))}
            </div>
          </div>
          <button
            className={`browse-button ${location.pathname.includes("/search") && location.search.includes("browse=") ? "active" : ""}`}
            type="button"
            onClick={openBrowse}
          >
            <FaCompass />
            Browse
          </button>
        </div>
      </div>

      <div className="nav-right">
        <button className="premium-nav-link" type="button" onClick={() => navigate("/premium")}>
          Premium
        </button>
        {isAuthenticated && (
        <div className="notification-wrapper" ref={notificationRef}>
          <button className="notification-button" onClick={openNotifications} title="Notifications">
            <FaBell />
            {notifications.some((item) => !item.is_read) && <span className="notification-dot" />}
          </button>
          <div className={`notification-menu ${showNotifications ? "show" : ""}`}>
            <h4>Notifications</h4>
            {notifications.length === 0 ? (
              <p className="notification-empty">No notifications</p>
            ) : (
              notifications.map((item) => (
                <div className="notification-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                </div>
              ))
            )}
          </div>
        </div>
        )}
        <div
          className="profile-wrapper"
          ref={menuRef}
          onClick={() => setShowMenu(!showMenu)}
        >
          {profilePicture ? (
            <img src={profilePicture} alt="Profile" className="profile-pic" />
          ) : isAuthenticated && username ? (
            <div className="profile-initial">{getInitial(username)}</div>
          ) : (
            <button className="login-pill" type="button">Log in</button>
          )}
          <div className={`dropdown-menu ${showMenu ? "show" : ""}`}>
            {isAuthenticated ? (
              <>
                <div className="account-name">{username}</div>
                {userId && <button className="button" onClick={() => navigate(`/profile/${userId}`)}>Profile</button>}
                <button className="button" onClick={() => navigate("/setting")}>Setting</button>
                {roles.includes("artist") && (
                  <button className="button" onClick={() => navigate("/artist-studio")}>
                    <FaMusic /> Artist Studio
                  </button>
                )}
                {roles.includes("admin") && (
                  <>
                    <button className="button" onClick={() => navigate("/admin/songs")}>Song Review</button>
                    <button className="button" onClick={() => navigate("/admin/moderation")}>Moderation</button>
                    <button className="button" onClick={() => navigate("/database")}>Database</button>
                  </>
                )}
                <button className="button" onClick={handleSignOut}>Log Out</button>
              </>
            ) : (
              <>
                <button className="button" onClick={() => navigate("/signin")}>Log In</button>
                <button className="button" onClick={() => navigate("/signup")}>Sign Up</button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
