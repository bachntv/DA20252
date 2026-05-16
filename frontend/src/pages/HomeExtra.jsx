import React, { useEffect, useState, useCallback, useMemo } from "react";
import Navbar from "../components/Navbar";
import SidebarLeft from "../components/SidebarLeft";
import RightContent from "../components/RightContent";
import MusicPlayer from "../components/MusicPlayer";
import { usePlayer } from "../context/PlayerContext";
import { jwtDecode } from "jwt-decode";
import "../styles/MainContent/HomeExtra.css";
import { authFetch } from "../utils/authFetch";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

function HomeExtra() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const userId = token ? jwtDecode(token)?.sub : null;

  const username = user?.username || "Guest";

  const [likedTrackIds, setLikedTrackIds] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [isQueueVisible, setIsQueueVisible] = useState(false);

  const {
    currentSong,
    isPlaying,
    playSong,
    stop,
    nextSong,
    prevSong
  } = usePlayer();

  /* -------------------------
      Fetch Liked Tracks
  -------------------------- */
  const fetchLikedTracks = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/music/user/liked_track_ids`);
      const data = await res.json();
      setLikedTrackIds(data);
    } catch (err) {
      console.error("Failed to fetch liked tracks:", err);
    }
  }, []);

  useEffect(() => {
    if (userId) fetchLikedTracks();
  }, [userId, fetchLikedTracks]);


  /* -------------------------
      Fetch Playlists
  -------------------------- */
  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/music/user_playlist`);
      const data = await res.json();
      const customPlaylists = data.filter((pl) => pl.name !== "Liked Songs");
      setUserPlaylists(customPlaylists);
    } catch (err) {
      console.error("Failed to fetch playlists:", err);
    }
  }, []);

  useEffect(() => {
    if (userId) fetchPlaylists();

    const handlePlaylistUpdate = () => fetchPlaylists();
    window.addEventListener("playlistUpdated", handlePlaylistUpdate);

    return () =>
      window.removeEventListener("playlistUpdated", handlePlaylistUpdate);
  }, [userId, fetchPlaylists]);


  /* -------------------------
      Toggle Like Track
  -------------------------- */
  const handleToggleLike = async () => {
    if (!currentSong || !userId) return;

    const isLiked = likedTrackIds.includes(currentSong.id);
    const method = isLiked ? "DELETE" : "POST";

    try {
      await authFetch(
        `${API_BASE}/api/music/user/liked_track?track_id=${currentSong.id}`,
        {
          method,
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setLikedTrackIds((prev) =>
        isLiked
          ? prev.filter((id) => id !== currentSong.id)
          : [...prev, currentSong.id]
      );
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  /* -------------------------
      Add Track to Playlist
  -------------------------- */
  const handleAddTrackToPlaylist = async (trackId, playlistId) => {
    try {
      await authFetch(`${API_BASE}/api/music/user/add_track_to_playlist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ track_id: trackId, playlist_id: playlistId })
      });
      console.log("Track added to playlist");
    } catch (err) {
      console.error("Failed to add track to playlist:", err);
    }
  };

  /* -------------------------
      Render Sections  (12)
  -------------------------- */
  const sections = useMemo(() => Array.from({ length: 12 }), []);

  return (
    <div className="home-extra-root">
      {sections.map((_, i) => (
        <div className="home-extra-section" key={i}>
          <Navbar username={username} />

          <div className="home-extra-content">
            <SidebarLeft />

            <div className="main-outlet">Section {i + 1}</div>

            <RightContent
              currentSong={currentSong}
              isQueueVisible={isQueueVisible}
            />
          </div>

          <MusicPlayer
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlayPause={() =>
              isPlaying ? stop() : playSong(currentSong)
            }
            onNext={nextSong}
            onPrev={prevSong}
            likedTrackIds={likedTrackIds}
            userPlaylists={userPlaylists}
            onToggleLike={handleToggleLike}
            onAddTrackToPlaylist={handleAddTrackToPlaylist}
            onToggleFullscreen={() => alert("Fullscreen not implemented")}
            onToggleQueue={() => setIsQueueVisible(!isQueueVisible)}
            isQueueVisible={isQueueVisible}
          />
        </div>
      ))}
    </div>
  );
}

export default HomeExtra;
