import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { PlayerProvider } from "./context/PlayerContext";
import Navbar from "./components/Navbar";
import { authFetch } from "./utils/authFetch";

import Signin from "./pages/Signin";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import MainContent from "./components/MainContent/MainContent";
import PlaylistPage from "./components/MainContent/PlaylistPage";
import AlbumPage from "./components/MainContent/AlbumPage";
import ArtistPage from "./components/MainContent/ArtistPage";
import ChartPage from "./components/MainContent/ChartPage";
import SearchPage from "./components/MainContent/SearchPage";
import SocialFeed from "./components/MainContent/SocialFeed";
import PurchasedSongs from "./components/MainContent/PurchasedSongs";
import ArtistStudio from "./pages/ArtistStudio";
import AdminCrud from "./pages/AdminCrud";
import AdminSongs from "./pages/AdminSongs";
import AdminModeration from "./pages/AdminModeration";
import SettingsPage from "./pages/Settings";
import PremiumPage from "./pages/Premium";
import UserProfile from "./pages/UserProfile";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const AppChrome = () => {
  const location = useLocation();
  const readStoredUser = (fallbackUser = {}) => {
    try {
      const token = localStorage.getItem("token");
      const tokenUserId = token ? jwtDecode(token)?.sub : null;
      const authUser = JSON.parse(localStorage.getItem("authUser") || "{}");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!tokenUserId) return {};
      if (tokenUserId && authUser?.id === tokenUserId) return authUser;
      if (tokenUserId && user?.id === tokenUserId) return user;
      if (tokenUserId && fallbackUser?.id === tokenUserId) return fallbackUser;
      if (tokenUserId) return { id: tokenUserId };
      return {};
    } catch (err) {
      return {};
    }
  };
  const [storedUser, setStoredUser] = useState(() => readStoredUser());

  useEffect(() => {
    const syncProfile = () => {
      setStoredUser((current) => readStoredUser(current));
    };
    window.addEventListener("authUpdated", syncProfile);
    window.addEventListener("profileUpdated", syncProfile);
    window.addEventListener("storage", syncProfile);
    return () => {
      window.removeEventListener("authUpdated", syncProfile);
      window.removeEventListener("profileUpdated", syncProfile);
      window.removeEventListener("storage", syncProfile);
    };
  }, []);

  useEffect(() => {
    setStoredUser((current) => readStoredUser(current));
  }, [location.pathname]);

  useEffect(() => {
    if (["/signin", "/signup"].includes(location.pathname)) return;
    if (!storedUser?.id || storedUser?.username) return;

    let cancelled = false;
    const hydrateLoggedInUser = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/user/profile/${storedUser.id}`);
        if (!res.ok) return;
        const profile = await res.json();
        const nextUser = {
          id: profile.id,
          username: profile.username,
          roles: profile.roles,
          account_type: profile.account_type,
          profile_picture_url: profile.profile_picture_url,
          cover_photo_url: profile.cover_photo_url,
          profile_background_color: profile.profile_background_color,
        };
        if (!cancelled) {
          localStorage.setItem("authUser", JSON.stringify(nextUser));
          localStorage.setItem("user", JSON.stringify(nextUser));
          setStoredUser(nextUser);
        }
      } catch (err) {
        console.error("Failed to load navbar account", err);
      }
    };

    hydrateLoggedInUser();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, storedUser?.id, storedUser?.username]);

  if (["/signin", "/signup"].includes(location.pathname)) return null;

  return (
    <>
      <Navbar
        username={storedUser?.username || "Guest"}
        profilePicture={storedUser?.profile_picture_url}
        userId={storedUser?.id}
      />
      <div className="navbar-spacer" aria-hidden="true" />
    </>
  );
};

function App() {
  return (
    <PlayerProvider>
      <Router>
        <AppChrome />
        <Routes>
          {/* Public */}
          <Route path="/signin" element={<Signin />} />
          <Route path="/signup" element={<Signup />} />

          {/* Main layout opens for guests; account-only pages stay protected. */}
          <Route path="/" element={<Home />}>
            <Route index element={<MainContent />} />
            <Route path="playlist/:playlistId" element={<PlaylistPage />} />
            <Route path="album/:albumId" element={<AlbumPage />} />
            <Route path="artist/:artistId" element={<ArtistPage />} />
            <Route path="chart/:chartId" element={<ChartPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="purchased" element={<ProtectedRoute><PurchasedSongs /></ProtectedRoute>} />
            <Route path="artist-studio" element={<ProtectedRoute><ArtistStudio /></ProtectedRoute>} />
          </Route>

          <Route path="/social" element={<SocialFeed />} />

          {/* ✅ Full-page route for /database, still protected */}
          <Route
            path="/database"
            element={<ProtectedRoute requireRole="admin"><AdminCrud /></ProtectedRoute>}
          />
          <Route
            path="/admin/songs"
            element={<ProtectedRoute requireRole="admin"><AdminSongs /></ProtectedRoute>}
          />
          <Route
            path="/admin/moderation"
            element={<ProtectedRoute requireRole="admin"><AdminModeration /></ProtectedRoute>}
          />

          <Route
            path="/setting"
            element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
          />
          <Route
            path="/profile/:userId"
            element={<ProtectedRoute><UserProfile /></ProtectedRoute>}
          />

          <Route path="/premium" element={<PremiumPage />} />
        </Routes>
      </Router>
    </PlayerProvider>
  );
}

export default App;
