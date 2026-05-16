import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../styles/MainContent/PlaylistPage.css";
import { formatDistanceToNow } from "date-fns";
import { FaPlay } from "react-icons/fa";
import { usePlayer } from "../../context/PlayerContext";
import { authFetch } from '../../utils/authFetch';
import { updateLastPlayed } from '../../utils/lastPlayed';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const PlaylistPage = () => {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditDropdown, setShowEditDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editFields, setEditFields] = useState({
    name: "",
    description: "",
    cover: null
  });
  
  const { currentSong, isPlaying, queue, playSong, setQueue, stop } = usePlayer();
  const editDropdownRef = useRef(null);
  const menuRefs = useRef({});
  const token = localStorage.getItem("token");

  const isCurrentPlaylistPlaying = playlist?.tracks?.some((track) => track.id === currentSong?.id) && isPlaying;

  const fetchMp3Url = async (trackName) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(trackName)}`);
      const data = await res.json();
      return data.url;
    } catch (err) {
      console.error("Failed to fetch MP3 URL:", err);
      return null;
    }
  };

  const playSongFrom = async (trackId) => {
    const index = playlist.tracks.findIndex((t) => t.id === trackId);
    if (index === -1) return;

    const track = playlist.tracks[index];
    const rest = playlist.tracks.slice(index + 1);
    const mp3Url = await fetchMp3Url(track.track_name);
    
    if (!mp3Url) return;
    
    const enrichedTrack = { ...track, mp3_url: mp3Url };
    playSong(enrichedTrack, rest);

    // Update last played for playlist
    if (token) {
      await updateLastPlayed(playlistId, token);
    }
  };

  const addToQueue = async (trackId) => {
    try {
      const track = playlist.tracks.find((t) => t.id === trackId);
      if (!track) return;

      const mp3Url = await fetchMp3Url(track.track_name);
      if (!mp3Url) return;
      
      const enrichedTrack = { ...track, mp3_url: mp3Url };

      if (!isPlaying) {
        playSong(enrichedTrack, []);
        if (token) {
          await updateLastPlayed(playlistId, token);
        }
      } else {
        setQueue([...queue, enrichedTrack]);
      }
    } catch (err) {
      console.error("Failed to add to queue:", err);
    } finally {
      setOpenMenuId(null);
    }
  };

  const removeFromPlaylist = async (trackId) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/music/playlist/${playlistId}/remove_track?track_id=${trackId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) throw new Error("Failed to remove track");

      setPlaylist((prev) => ({
        ...prev,
        tracks: prev.tracks.filter((track) => track.id !== trackId),
      }));
    } catch (err) {
      console.error("Failed to remove from playlist:", err);
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleDeletePlaylist = async () => {
    try {
      await authFetch(`${API_BASE}/api/music/user_playlist/${playlistId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new Event("playlistUpdated"));
      navigate("/");
    } catch (err) {
      console.error("Failed to delete playlist:", err);
    }
  };

  const handleUpdatePlaylist = async () => {
    const formData = new FormData();
    if (editFields.name) formData.append("name", editFields.name);
    if (editFields.description) formData.append("description", editFields.description);
    if (editFields.cover) formData.append("cover_image", editFields.cover);

    try {
      await fetch(`${API_BASE}/api/music/playlist/${playlistId}/edit`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      setShowEditModal(false);
      fetchPlaylist();
      window.dispatchEvent(new Event("playlistUpdated"));
    } catch (err) {
      console.error("Failed to update playlist:", err);
    }
  };

  const fetchPlaylist = async () => {
    try {
      const [playlistRes, songRes] = await Promise.all([
        fetch(`${API_BASE}/api/music/playlist/${playlistId}`),
        fetch(`${API_BASE}/api/music/playlist/${playlistId}/songs`)
      ]);
      
      const playlistData = await playlistRes.json();
      const songData = await songRes.json();

      const formattedTracks = Array.isArray(songData)
        ? songData.map((song) => ({
            id: song.id,
            track_name: song.title,
            artist_id: song.artist_id,
            artist_name: song.artist,
            album_id: song.album_id,
            album: song.album,
            duration: song.duration,
            image_url: song.cover_url,
            date_added: formatDistanceToNow(new Date(song.date_added), { addSuffix: true })
          }))
        : [];

      setPlaylist({
        id: playlistData.id,
        name: playlistData.name,
        owner: playlistData.owner_name,
        image: playlistData.cover_image_url,
        description: playlistData.description || "Your favorite songs all in one place.",
        tracks: formattedTracks,
      });

      setEditFields({
        name: playlistData.name || "",
        description: playlistData.description || "",
        cover: null
      });
    } catch (err) {
      console.error("Failed to fetch playlist or songs:", err);
    }
  };

  // Handle clicking outside menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId && menuRefs.current[openMenuId] && !menuRefs.current[openMenuId].contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editDropdownRef.current && !editDropdownRef.current.contains(event.target)) {
        setShowEditDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  if (!playlist) {
    return (
      <div className="playlist-loading">
        <div className="skeleton-header">
          <div className="skeleton-image shimmer"></div>
          <div className="skeleton-info">
            <div className="skeleton-line title shimmer"></div>
            <div className="skeleton-line subtitle shimmer"></div>
            <div className="skeleton-line description shimmer"></div>
          </div>
        </div>
        <div className="skeleton-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="skeleton-row shimmer" key={i}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-page">
      <div className="playlist-header">
        <img 
          src={playlist.image || "/default_cover.png"} 
          alt={playlist.name} 
          className="playlist-cover" 
          onError={(e) => { e.target.onerror = null; e.target.src = "/default_cover.png"; }}
        />
        <div className="playlist-info">
          <span className="playlist-label">Playlist</span>
          <h1>{playlist.name}</h1>
          <p>{playlist.owner} • {playlist.tracks.length} songs</p>
          <p className="playlist-description">{playlist.description}</p>
          {playlist.name !== "Liked Songs" && (
            <div className="edit-dropdown" ref={editDropdownRef}>
              <button
                className="edit-btn"
                onClick={() => setShowEditDropdown((prev) => !prev)}
              >
                Edit Playlist
              </button>

              {showEditDropdown && (
                <div className={`dropdown-menu ${showEditDropdown ? "show" : ""}`}>
                  <button onClick={() => {
                    setShowEditModal(true);
                    setShowEditDropdown(false);
                  }}>
                    Edit Info
                  </button>
                  <button onClick={() => {
                    setShowDeleteModal(true);
                    setShowEditDropdown(false);
                  }}>
                    Delete Playlist
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        className="play-button"
        onClick={async () => {
          if (isCurrentPlaylistPlaying) {
            stop();
          } else {
            const firstTrack = playlist.tracks[0];
            if (firstTrack) {
              const mp3Url = await fetchMp3Url(firstTrack.track_name);
              if (mp3Url) {
                const enrichedFirst = { ...firstTrack, mp3_url: mp3Url };
                const rest = playlist.tracks.slice(1);
                playSong(enrichedFirst, rest);

                if (token) {
                  await updateLastPlayed(playlistId, token);
                }
              }
            }
          }
        }}
      >
        <span className="play-icon">
          {isCurrentPlaylistPlaying ? <i className="fas fa-pause" /> : <i className="fas fa-play" />}
        </span>
      </button>

      <table className="track-table">
        <thead>
          <tr>
            <th className="col-number">#</th>
            <th className="col-title">Title</th>
            <th className="col-album">Album</th>
            <th className="col-date">Date added</th>
            <th className="col-duration">Duration</th>
            <th className="col-option"></th>
          </tr>
        </thead>
        <tbody>
          {playlist.tracks.map((track, i) => {
            const isCurrent = currentSong?.id === track.id;
            return (
              <tr key={track.id} className={isCurrent && isPlaying ? "playing" : ""}>
                <td className="col-number">
                  <div className="row-number-wrapper">
                    {currentSong?.id === track.id && isPlaying ? (
                      <div className="playing-bars">
                        <span className="bar bar1"></span>
                        <span className="bar bar2"></span>
                        <span className="bar bar3"></span>
                      </div>
                    ) : (
                      <>
                        <span className="track-number">{i + 1}</span>
                        <FaPlay
                          className="play-icon-row"
                          onClick={() => playSongFrom(track.id)}
                        />
                      </>
                    )}
                  </div>
                </td>
                <td className="track-title-cell col-date">
                  <img 
                    src={track.image_url || "/default_cover.png"} 
                    alt={track.track_name} 
                    className="track-image" 
                    onError={(e) => { e.target.onerror = null; e.target.src = "/default_cover.png"; }}
                  />
                  <div className="track-info">
                    <p className="track-title">{track.track_name}</p>
                    <span className="track-artist">
                      {(track.artist_name?.split(", ") || []).map((name, i) => {
                        const ids = track.artist_id?.split(", ");
                        const artistId = ids?.[i];

                        return (
                          <React.Fragment key={i}>
                            {artistId ? (
                              <button 
                                className="artist-link"
                                onClick={() => navigate(`/artist/${artistId}`)}
                              >
                                {name}
                              </button>
                            ) : (
                              name
                            )}
                            {i < track.artist_name.split(", ").length - 1 && ", "}
                          </React.Fragment>
                        );
                      })}
                    </span>
                  </div>
                </td>
                <td className="col-album">
                  <button 
                    className="album-link"
                    onClick={() => navigate(`/album/${track.album_id}`)}
                  >
                    {track.album}
                  </button>
                </td>
                <td className="col-date">{track.date_added}</td>
                <td className="col-duration">{track.duration}</td>
                <td className="track-options col-option">
                  <div className="options-wrapper" ref={(el) => (menuRefs.current[track.id] = el)}>
                    <button className="options-button" onClick={() => setOpenMenuId(track.id)}>
                      &#x22EE;
                    </button>
                    {openMenuId === track.id && (
                      <div className="options-menu show">
                        <button onClick={() => addToQueue(track.id)}>Add to Queue</button>
                        <button onClick={() => removeFromPlaylist(track.id)}>Remove from Playlist</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showDeleteModal && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h3>Delete Playlist</h3>
            <p>Are you sure you want to delete "{playlist?.name}"?</p>
            <div className="delete-modal-buttons">
              <button 
                className="delete-button"
                onClick={() => {
                  handleDeletePlaylist();
                  setShowDeleteModal(false);
                }}
              >
                Delete
              </button>
              <button 
                className="cancel-button"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="edit-playlist-modal">
          <div className="modal-content">
            <h3>Edit Playlist</h3>
            <input
              type="text"
              value={editFields.name}
              onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
              placeholder="New playlist name"
            />
            <textarea
              value={editFields.description}
              onChange={(e) => setEditFields({ ...editFields, description: e.target.value })}
              placeholder="New description"
            />
            <label className="custom-file-upload">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditFields({ ...editFields, cover: e.target.files[0] })}
              />
              Upload Cover Image
            </label>
            <button onClick={handleUpdatePlaylist}>Save</button>
            <button onClick={() => setShowEditModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistPage;