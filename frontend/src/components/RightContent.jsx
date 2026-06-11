import React, { useEffect, useState, useRef } from "react";
import "../styles/RightContent.css";
import { usePlayer } from "../context/PlayerContext";
import { FaPaperPlane, FaTimes } from "react-icons/fa";
import { jwtDecode } from "jwt-decode";
import { authFetch } from '../utils/authFetch';
import { createTrackArtwork, getTrackArtwork } from "../utils/artwork";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const formatNumber = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(number);
};

const getPrimaryArtistId = (song) => {
  const artistId = song?.artist_id || song?.artistId;
  return artistId ? String(artistId).split(", ")[0] : null;
};

const RightContent = ({ currentSong, isQueueVisible, onShowLyrics, onEditLyrics, onOpenArtistPage }) => {
  const [relatedSongs, setRelatedSongs] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [hoveredTrackId, setHoveredTrackId] = useState(null);
  const menuRefs = useRef({});
  const token = localStorage.getItem("token");
  const userId = token ? jwtDecode(token)?.sub : null;
  const roles = token ? jwtDecode(token)?.roles || [] : [];
  const canEditLyrics = roles.includes("artist");
  const { playSong, queue, setQueue, isPlaying, removeFromQueue } = usePlayer();
  const [lyrics, setLyrics] = useState("");
  const [artistInfo, setArtistInfo] = useState(null);
  const [isArtistFollowed, setIsArtistFollowed] = useState(false);
  const [purchaseState, setPurchaseState] = useState({ owned: false, amount: 15000, currency: "VND" });
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [shareState, setShareState] = useState("idle");

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
  }, [currentSong, isQueueVisible]);

  useEffect(() => {
    if (!currentSong?.id) return;

    const fetchLyrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/social/tracks/${currentSong.id}/lyrics`);
        const data = await res.json();
        setLyrics(data.lyrics || "");
      } catch (err) {
        setLyrics("");
      }
    };

    fetchLyrics();
    window.addEventListener("lyricsUpdated", fetchLyrics);
    return () => window.removeEventListener("lyricsUpdated", fetchLyrics);
  }, [currentSong?.id]);

  useEffect(() => {
    if (!currentSong?.id || !userId) {
      setPurchaseState({ owned: false, amount: 15000, currency: "VND" });
      return;
    }

    const fetchPurchaseState = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user/purchases/${currentSong.id}`);
        const data = await res.json();
        setPurchaseState({
          owned: Boolean(data.owned),
          amount: data.amount || 15000,
          currency: data.currency || "VND",
        });
      } catch (err) {
        setPurchaseState({ owned: false, amount: 15000, currency: "VND" });
      }
    };

    fetchPurchaseState();
  }, [currentSong?.id, userId]);

  useEffect(() => {
    const artistId = getPrimaryArtistId(currentSong);
    if (!artistId || isQueueVisible) {
      setArtistInfo(null);
      return;
    }

    const fetchArtistInfo = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/music/artist/${artistId}`);
        const data = await res.json();
        setArtistInfo(data);
      } catch (err) {
        setArtistInfo(null);
      }
    };

    fetchArtistInfo();
  }, [currentSong, isQueueVisible]);

  useEffect(() => {
    const artistId = getPrimaryArtistId(currentSong);
    if (!userId || !artistId) return;

    const fetchFollowState = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user_playlist`);
        const data = await res.json();
        setIsArtistFollowed(data.some((item) => item.id === artistId && item.type === "artist"));
      } catch (err) {
        setIsArtistFollowed(false);
      }
    };

    fetchFollowState();
    window.addEventListener("artistUpdated", fetchFollowState);
    return () => window.removeEventListener("artistUpdated", fetchFollowState);
  }, [currentSong, userId]);

  const toggleArtistFollow = async () => {
    const artistId = getPrimaryArtistId(currentSong);
    if (!artistId || !userId) return;

    try {
      if (isArtistFollowed) {
        await authFetch(`${API_BASE}/api/music/remove_from_library/${artistId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsArtistFollowed(false);
      } else {
        await authFetch(`${API_BASE}/api/music/add_to_library/${artistId}?type=artist`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsArtistFollowed(true);
      }
      window.dispatchEvent(new Event("artistUpdated"));
    } catch (err) {
      console.error("Failed to update artist follow state", err);
    }
  };

  const purchaseCurrentSong = async () => {
    if (!currentSong?.id || !userId || isPurchasing) return;
    setIsPurchasing(true);
    try {
      const res = await authFetch(`${API_BASE}/api/music/user/purchases/${currentSong.id}`, {
        method: "POST",
      });
      const data = await res.json();
      setPurchaseState({
        owned: Boolean(data.owned),
        amount: data.track?.amount || purchaseState.amount,
        currency: data.track?.currency || purchaseState.currency,
      });
      window.dispatchEvent(new Event("purchaseUpdated"));
    } catch (err) {
      console.error("Failed to purchase song", err);
    } finally {
      setIsPurchasing(false);
    }
  };

  const shareCurrentSong = async () => {
    if (!currentSong?.id || !userId || shareState === "sharing") return;

    const title = currentSong.track_name || currentSong.title || "this song";
    const artist = currentSong.artist_name || currentSong.artist;
    const content = artist ? `Listening to "${title}" by ${artist}` : `Listening to "${title}"`;

    setShareState("sharing");
    try {
      await authFetch(`${API_BASE}/api/social/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, track_id: currentSong.id }),
      });
      setShareState("shared");
      window.dispatchEvent(new Event("socialFeedUpdated"));
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch (err) {
      console.error("Failed to share current song", err);
      setShareState("error");
      window.setTimeout(() => setShareState("idle"), 2400);
    }
  };

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

  if (!currentSong) return null;

  const renderQueueList = () => (
    <div className="right-content-cover queue-view">
      <div className="overlay-content">
        <h4>Queue</h4>
        {queue.length > 0 ? (
          queue.slice(0, 10).map((track, index) => (
            <div key={`${track.id}-${index}`} className="video-card">
              <img
                src={getTrackArtwork(track)}
                alt={track.title}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = createTrackArtwork(track);
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
        src={getTrackArtwork(currentSong)}
        alt={currentSong.track_name || currentSong.title}
        onError={(e) => { e.target.onerror = null; e.target.src = createTrackArtwork(currentSong); }}
      />
      <div className="overlay-content">
        <h1 className="song-title">{currentSong.track_name || currentSong.title}</h1>
        <p className="song-artist">{currentSong.artist_name || currentSong.artist}</p>
        <div className="song-actions">
          <button
            className={`share-song-button ${shareState === "shared" ? "shared" : ""}`}
            onClick={shareCurrentSong}
            disabled={!userId || shareState === "sharing"}
            title={!userId ? "Log in to share songs" : "Share song on social feed"}
          >
            <FaPaperPlane />
            {shareState === "sharing"
              ? "Sharing..."
              : shareState === "shared"
                ? "Shared"
                : shareState === "error"
                  ? "Try Again"
                  : "Share to Feed"}
          </button>
        </div>
        <div className="purchase-section">
          <div>
            <span className="purchase-label">Offline download ownership</span>
            <strong>{purchaseState.amount.toLocaleString("vi-VN")} {purchaseState.currency}</strong>
            <small>Streaming stays available. Buying unlocks download access.</small>
          </div>
          <button
            className={`purchase-button ${purchaseState.owned ? "owned" : ""}`}
            onClick={purchaseCurrentSong}
            disabled={!userId || purchaseState.owned || isPurchasing}
            title={!userId ? "Log in to buy downloads" : purchaseState.owned ? "Download unlocked" : "Buy to download offline"}
          >
            {purchaseState.owned ? "Download Unlocked" : isPurchasing ? "Buying..." : "Buy to Download"}
          </button>
        </div>

        <div className="related-section">
          <div className="lyrics-section">
            <div className="lyrics-header">
              <h4>Lyrics</h4>
              <div className="lyrics-actions">
                <button onClick={onShowLyrics}>Open</button>
                {canEditLyrics && <button onClick={onEditLyrics}>Edit</button>}
              </div>
            </div>
            <p className="lyrics-text">{lyrics || "No lyrics added yet."}</p>
          </div>
          {artistInfo && (
            <section
              className="artist-about-section"
              onClick={() => onOpenArtistPage?.(artistInfo)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onOpenArtistPage?.(artistInfo);
              }}
            >
              <div className="artist-about-header">
                <img
                  src={artistInfo.profile_image_url || "/default_cover.png"}
                  alt={artistInfo.name}
                  onError={(e) => { e.target.onerror = null; e.target.src = "/default_cover.png"; }}
                />
                <div>
                  <h4>About the artist</h4>
                  <p>{artistInfo.name}</p>
                </div>
              </div>
              <button
                className="artist-follow-button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleArtistFollow();
                }}
                disabled={!userId}
              >
                {isArtistFollowed ? "Following" : "Follow"}
              </button>
              <p className="artist-listeners">
                {formatNumber(artistInfo.monthly_listeners || artistInfo.followers)} monthly listeners
              </p>
              <button
                className="artist-description-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenArtistPage?.(artistInfo);
                }}
              >
                {artistInfo.description || "No artist description available yet."}
              </button>
            </section>
          )}
          <h4>Related Music</h4>
          {relatedSongs.length > 0 ? (
            relatedSongs.map((track) => (
              <div key={track.id} className="video-card">
                <img
                  src={getTrackArtwork(track)}
                  alt={track.title}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = createTrackArtwork(track);
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
