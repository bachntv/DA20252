import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import SidebarLeft from "../components/SidebarLeft";
import RightContent from "../components/RightContent";
import MusicPlayer from "../components/MusicPlayer";
import NowPlayingFocus from "../components/MainContent/NowPlayingFocus";
import { usePlayer } from "../context/PlayerContext";
import { FaTimes, FaUsers } from "react-icons/fa";
import { jwtDecode } from "jwt-decode";
import "../styles/MainContent/Home.css";
import { authFetch } from '../utils/authFetch';


const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const Home = () => {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const userId = token ? jwtDecode(token)?.sub : null;
  const username = user?.username || "Guest";

  const [likedTrackIds, setLikedTrackIds] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [focusView, setFocusView] = useState(null);
  const [isSocialMinimized, setIsSocialMinimized] = useState(() => localStorage.getItem("socialFeedMinimized") === "true");
  const {
    currentSong,
    isPlaying,
    playSong,
    stop,
    nextSong,
    prevSong,
    isShuffleEnabled,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();
  const [lastTrackedSongId, setLastTrackedSongId] = useState(null);

  // Fetch liked tracks
  useEffect(() => {
    const fetchLikedTracks = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user/liked_track_ids`);
        const data = await res.json();
        setLikedTrackIds(data);
      } catch (err) {
        console.error("Failed to fetch liked tracks:", err);
      }
    };

    if (userId) fetchLikedTracks();
  }, [userId]);

  // Fetch user's custom playlists (excluding 'Liked Songs')
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user_playlist`);
        const data = await res.json();
        const customPlaylists = data.filter((pl) => pl.name !== "Liked Songs");
        setUserPlaylists(customPlaylists);
      } catch (err) {
        console.error("Failed to fetch playlists:", err);
      }
    };

    if (userId) fetchPlaylists();

    // Add event listener for playlist updates
    const handlePlaylistUpdate = () => {
      fetchPlaylists();
    };
    window.addEventListener('playlistUpdated', handlePlaylistUpdate);
    return () => window.removeEventListener('playlistUpdated', handlePlaylistUpdate);
  }, [userId]);

  const handleToggleLike = async () => {
    if (!currentSong || !userId) return;
    const isLiked = likedTrackIds.includes(currentSong.id);
    const method = isLiked ? "DELETE" : "POST";

    try {
      await authFetch(`${API_BASE}/api/music/user/liked_track?track_id=${currentSong.id}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });

      setLikedTrackIds((prev) =>
        isLiked ? prev.filter((id) => id !== currentSong.id) : [...prev, currentSong.id]
      );
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const handleAddTrackToPlaylist = async (trackId, playlistId) => {
    try {
      await authFetch(`${API_BASE}/api/music/user/add_track_to_playlist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ track_id: trackId, playlist_id: playlistId }),
      });

      console.log("Track added to playlist");
    } catch (err) {
      console.error("Failed to add track to playlist:", err);
    }
  };

  const toggleLyricsView = () => {
    if (!currentSong) return;
    setFocusView((current) => (current === "lyrics" ? null : "lyrics"));
    setIsQueueVisible(false);
  };

  const openArtistPage = (artistInfo) => {
    if (!artistInfo?.id) return;
    setFocusView(null);
    setIsQueueVisible(false);
    navigate(`/artist/${artistInfo.id}`);
  };

  useEffect(() => {
    if (!currentSong?.id || !token) return;
    if (lastTrackedSongId === currentSong.id) return;

    const recordListening = async () => {
      try {
        await authFetch(`${API_BASE}/api/music/user/listening-history`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            track_id: currentSong.id,
            source: "music_player",
          }),
        });
        setLastTrackedSongId(currentSong.id);
      } catch (err) {
        console.error("Failed to record listening history:", err);
      }
    };

    recordListening();
  }, [currentSong, token, lastTrackedSongId]);

  useEffect(() => {
    const syncSocialMinimized = () => {
      setIsSocialMinimized(localStorage.getItem("socialFeedMinimized") === "true");
    };
    window.addEventListener("socialFeedMinimized", syncSocialMinimized);
    window.addEventListener("storage", syncSocialMinimized);
    return () => {
      window.removeEventListener("socialFeedMinimized", syncSocialMinimized);
      window.removeEventListener("storage", syncSocialMinimized);
    };
  }, []);

  const reopenSocialFeed = () => {
    localStorage.removeItem("socialFeedMinimized");
    setIsSocialMinimized(false);
    navigate("/social");
  };

  const dismissSocialMinimized = (event) => {
    event.stopPropagation();
    localStorage.removeItem("socialFeedMinimized");
    setIsSocialMinimized(false);
  };

  return (
    <div className="home">
      <Navbar username={username} />

      <div className="home-content">
        <SidebarLeft />
        <div className="main-outlet">
          {focusView ? (
            <NowPlayingFocus
              mode={focusView}
              currentSong={currentSong}
              onClose={() => setFocusView(null)}
            />
          ) : (
            <Outlet />
          )}
        </div>
        <RightContent 
          currentSong={currentSong} 
          isQueueVisible={isQueueVisible}
          onShowLyrics={() => setFocusView("lyrics")}
          onEditLyrics={() => setFocusView("lyricsEdit")}
          onOpenArtistPage={openArtistPage}
        />
      </div>

      <MusicPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlayPause={() => {
          if (isPlaying) stop();
          else playSong(currentSong);
        }}
        onNext={nextSong}
        onPrev={prevSong}
        likedTrackIds={likedTrackIds}
        userPlaylists={userPlaylists}
        onToggleLike={handleToggleLike}
        onAddTrackToPlaylist={handleAddTrackToPlaylist}
        onToggleFullscreen={() => alert("Fullscreen not implemented")}
        onToggleQueue={() => {
          setIsQueueVisible(!isQueueVisible);
          setFocusView(null);
        }}
        isQueueVisible={isQueueVisible}
        onToggleLyrics={toggleLyricsView}
        isLyricsVisible={focusView === "lyrics"}
        isShuffleEnabled={isShuffleEnabled}
        repeatMode={repeatMode}
        onToggleShuffle={toggleShuffle}
        onCycleRepeat={cycleRepeatMode}
      />
      {isSocialMinimized && (
        <div className="social-minimized-pill" onClick={reopenSocialFeed} role="button" tabIndex={0} title="Open social feed">
          <FaUsers />
          <span>Social</span>
          <b>minimized</b>
          <button onClick={dismissSocialMinimized} title="Dismiss social feed">
            <FaTimes />
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
