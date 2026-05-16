import React, { useEffect, useState, useRef } from "react";
import "../styles/RightContent.css";
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { usePlayer } from "../context/PlayerContext";
import { FaTimes } from "react-icons/fa";
import { jwtDecode } from "jwt-decode";
import { authFetch } from '../utils/authFetch';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const RightContent = ({ currentSong, isQueueVisible }) => {
  const [relatedSongs, setRelatedSongs] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [hoveredTrackId, setHoveredTrackId] = useState(null);
  const menuRefs = useRef({});
  const token = localStorage.getItem("token");
  const userId = token ? jwtDecode(token)?.sub : null;
  const { playSong, queue, setQueue, isPlaying, removeFromQueue } = usePlayer();
  const [likedTrackIds, setLikedTrackIds] = useState([]);

  const fetchMp3Url = async (trackName) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(trackName)}`);
      const data = await res.json();
      return data.url;
    } catch (err) {
      return null;
    }
  };

  const playSongFrom = async (trackId) => {
    const track = relatedSongs.find((t) => t.id === trackId);
    if (!track) return;

    const rest = relatedSongs.filter((t) => t.id !== trackId);

    try {
      const mp3Url = await fetchMp3Url(track.title);
      const enrichedTrack = { ...track, mp3_url: mp3Url };

      playSong(enrichedTrack, rest);
    } catch (err) {
      console.error("Lỗi khi play song:", err);
    }
  };

  useEffect(() => {
    if (!currentSong?.id || isQueueVisible) return;

    const fetchRelated = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/music/related/${currentSong.id}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setRelatedSongs(data);
        } else {
          setRelatedSongs([]);
        }
      } catch (err) {
        setRelatedSongs([]);
      }
    };

    fetchRelated();
  }, [currentSong]);

  useEffect(() => {
    const fetchUserPlaylists = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user_playlist`);
        const data = await res.json();
        const filtered = data.filter((pl) => pl.name !== "Liked Songs" && pl.type === "playlist");
        setUserPlaylists(filtered);
      } catch (err) {
        console.error("Failed to fetch user playlists", err);
      }
    };

    if (userId) fetchUserPlaylists();

    // Add event listener for playlist updates
    const handlePlaylistUpdate = () => {
      fetchUserPlaylists();
    };
    window.addEventListener('playlistUpdated', handlePlaylistUpdate);
    return () => window.removeEventListener('playlistUpdated', handlePlaylistUpdate);
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        openMenuId &&
        menuRefs.current[openMenuId] &&
        !menuRefs.current[openMenuId].contains(e.target)
      ) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const addToQueue = async (trackId) => {
    const track = relatedSongs.find((t) => t.id === trackId);
    if (!track) return;

    try {
      const mp3Url = await fetchMp3Url(track.title);
      const enriched = { ...track, mp3_url: mp3Url };

      if (!isPlaying) {
        playSong(enriched, []);
      } else {
        setQueue([...queue, enriched]);
      }
    } catch (err) {
      console.error("Add to queue failed", err);
    } finally {
      setOpenMenuId(null);
    }
  };

  const addToPlaylist = async (trackId, playlistId) => {
    try {
      await authFetch(`${API_BASE}/api/music/user/add_track_to_playlist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ track_id: trackId, playlist_id: playlistId }),
      });
    } catch (err) {
      console.error("Add to playlist failed", err);
    } finally {
      setOpenMenuId(null);
    }
  };

  const toggleLike = async (trackId) => {
    const isLiked = likedTrackIds.includes(trackId);
    setLikedTrackIds((prev) =>
      isLiked ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );

    try {
      const method = isLiked ? "DELETE" : "POST";
      await authFetch(`${API_BASE}/api/music/user/liked_track`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setLikedTrackIds((prev) =>
        isLiked ? [...prev, trackId] : prev.filter((id) => id !== trackId)
      );
    }
  };

  useEffect(() => {
    if (!userId) return;
    authFetch(`${API_BASE}/api/music/user/liked_track`)
      .then((res) => res.json())
      .then(setLikedTrackIds)
      .catch(console.error);
  }, [userId]);

  if (!currentSong) return null;

  const renderQueueList = () => (
    <div className="right-content-cover queue-view">
      <div className="overlay-content">
        <h4>Queue</h4>
        {queue.length > 0 ? (
          queue.slice(0, 10).map((track, index) => (
            <div key={`${track.id}-${index}`} className="video-card">
              <img
                src={track.cover_url || track.image_url || "/default_cover.png"}
                alt={track.title}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/default_cover.png";
                }}
              />
              <div className="track-info">
                <p
                  className="track-title"
                  onClick={() => playSongFrom(track.id)}
                  title="Click to play this song"
                >
                  {track.title || track.track_name}
                </p>
                <span className="track-artist">{track.artist || track.artist_name}</span>
              </div>
              <button 
                className="remove-from-queue"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromQueue(track.id);
                }}
                title="Remove from queue"
              >
                <FaTimes />
              </button>
            </div>
          ))
        ) : (
          <p>Queue is empty.</p>
        )}
      </div>
    </div>
  );

  const renderCurrentSongWithRelated = () => (
    <aside className="right-content-cover">
      <img
        className="cover-image"
        src={currentSong.image_url || currentSong.cover_url || "/default_cover.png"}
        alt={currentSong.track_name || currentSong.title}
        onError={(e) => { e.target.onerror = null; e.target.src = "/default_cover.png"; }}
      />
      <div className="overlay-content">
        <h1 className="song-title">{currentSong.track_name || currentSong.title}</h1>
        <p className="song-artist">{currentSong.artist_name || currentSong.artist}</p>

        <div className="related-section">
          <h4>Related Music</h4>
          {relatedSongs.length > 0 ? (
            relatedSongs.map((track) => (
              <div key={track.id} className="video-card">
                <img
                  src={track.cover_url || "/default_cover.png"}
                  alt={track.title}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/default_cover.png";
                  }}
                />
                <div className="track-info">
                  <p
                    className="track-title"
                    onClick={() => playSongFrom(track.id)}
                    title="Click to play this song"
                  >
                    {track.title}
                  </p>
                  <span className="track-artist">{track.artist}</span>
                </div>
                <div className="options-wrapper" ref={(el) => (menuRefs.current[track.id] = el)}>
                  <button 
                    className="options-button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(track.id);
                    }}
                  >
                    &#x22EE;
                  </button>
                  {openMenuId === track.id && (
                    <div className="options-menu show">
                      <button onClick={() => addToQueue(track.id)}>Add to Queue</button>
                      <div 
                        className="playlist-submenu"
                        onMouseEnter={() => setHoveredTrackId(track.id)}
                        onMouseLeave={() => setHoveredTrackId(null)}
                      >
                        <button>Add to Playlist</button>
                        {hoveredTrackId === track.id && userPlaylists.length > 0 && (
                          <div className="playlist-options">
                            {userPlaylists.map((pl) => (
                              <div
                                key={pl.id}
                                className="playlist-item"
                                onClick={() => addToPlaylist(track.id, pl.id)}
                              >
                                {pl.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p>No related songs found.</p>
          )}
        </div>
      </div>
    </aside>
  );

  return isQueueVisible ? renderQueueList() : renderCurrentSongWithRelated();
};

export default RightContent;
