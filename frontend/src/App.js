import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "./context/PlayerContext";

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

function App() {
  return (
    <PlayerProvider>
      <Router>
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
            element={<ProtectedRoute><AdminCrud /></ProtectedRoute>}
          />
          <Route
            path="/admin/songs"
            element={<ProtectedRoute><AdminSongs /></ProtectedRoute>}
          />
          <Route
            path="/admin/moderation"
            element={<ProtectedRoute><AdminModeration /></ProtectedRoute>}
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
