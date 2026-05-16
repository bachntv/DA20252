import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../styles/MainContent/SearchPage.css";
import { FaPlay, FaHeart, FaRegHeart } from "react-icons/fa";
import { usePlayer } from "../../context/PlayerContext";
import { jwtDecode } from "jwt-decode";
import SkeletonLoader from "../SkeletonLoader";
import { authFetch } from '../../utils/authFetch';
import { updateLastPlayed } from '../../utils/lastPlayed';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const AlbumPage = () => {
  const { albumId } = useParams();
  const navigate = useNavigate(); 
  const [album, setAlbum] = useState(null);
  const [likedTrackIds, setLikedTrackIds] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [hoveredTrackId, setHoveredTrackId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isAdded, setIsAdded] = useState(false);
  const menuRefs = useRef({});
  const token = localStorage.getItem("token");
  const userId = token ? jwtDecode(token)?.sub : null;

  const { currentSong, isPlaying, playSong, stop, queue, setQueue } = usePlayer();

  const isCurrentAlbumPlaying = album?.tracks?.some((track) => track.id === currentSong?.id) && isPlaying;

  const fetchMp3Url = async (title) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(title)}`);
      const data = await res.json();
      return data.url;
    } catch (err) {
      console.error("Failed to fetch MP3 URL:", err);
      return null;
    }
  };

  const playSongFrom = async (trackId) => {
    const index = album.tracks.findIndex((t) => t.id === trackId);
    if (index === -1) return;
    
    const song = album.tracks[index];
    const rest = album.tracks.slice(index + 1);
    const mp3Url = await fetchMp3Url(song.track_name);
    
    if (!mp3Url) return;
    
    const enrichedSong = { ...song, mp3_url: mp3Url };
    playSong(enrichedSong, rest);

    // Update last played if album is in user's library
    if (isAdded && token) {
      await updateLastPlayed(album.id, token);
    }
  };

  const addToQueue = async (trackId) => {
    const track = album.tracks.find((t) => t.id === trackId);
    if (!track) return;

    try {
      const mp3Url = await fetchMp3Url(track.track_name);
      if (!mp3Url) return;
      
      const enriched = { ...track, mp3_url: mp3Url };

      if (!isPlaying) {
        playSong(enriched, []);
        if (isAdded && token) {
          await updateLastPlayed(album.id, token);
        }
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
      await authFetch(`${API_BASE}/api/music/user/liked_track?track_id=${trackId}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setLikedTrackIds((prev) =>
        isLiked ? [...prev, trackId] : prev.filter((id) => id !== trackId)
      );
    }
  };

  const addAlbum = async () => {
    const albumType = (album.artist_id?.split(", ").length || 0) > 1 ? "composite" : "single";
  
    try {
      await authFetch(`${API_BASE}/api/music/add_to_library/${album.id}?type=${albumType}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAdded(true);
      console.log("Album added to library as:", albumType);
      window.dispatchEvent(new Event('albumUpdated'));
    } catch (err) {
      console.error(`Error while adding to user library: ${err}`);
    }
  };

  const removeAlbum = async () => {
    try {
      await authFetch(`${API_BASE}/api/music/remove_from_library/${album.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAdded(false);
      console.log("Album removed from library");
      window.dispatchEvent(new Event('albumUpdated'));
    } catch (err) {
      console.error(`Error while removing album from library: ${err}`);
    }
  };

  // Fetch album data
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [albumRes, songRes] = await Promise.all([
          fetch(`${API_BASE}/api/music/album/${albumId}`),
          fetch(`${API_BASE}/api/music/album/${albumId}/songs`),
        ]);
        const albumData = await albumRes.json();
        const tracks = await songRes.json();

        const formatted = tracks.map((t) => ({
          id: t.id,
          track_name: t.title,
          artist_name: t.artist,
          album: t.album,
          album_id: t.album_id,
          duration: t.duration,
          image_url: t.cover_url,
        }));

        setAlbum({
          id: albumId,
          name: albumData.name,
          image: albumData.cover_image_url,
          artist: albumData.artist_name,
          artist_id: albumData.artist_id,
          tracks: formatted,
        });
      } catch (err) {
        console.error("Failed to fetch album data:", err);
      }
    };

    fetchAll();
  }, [albumId]);

  // Fetch liked tracks
  useEffect(() => {
    const fetchLikedTracks = async () => {
      if (!userId) return;
      try {
        const res = await authFetch(`${API_BASE}/api/music/user/liked_track_ids`);
        const data = await res.json();
        setLikedTrackIds(data);
      } catch (err) {
        console.error("Failed to fetch liked songs", err);
      }
    };

    fetchLikedTracks();
  }, [userId]);

  // Fetch user playlists and check if album is added
  useEffect(() => {
    const fetchUserPlaylists = async () => {
      if (!userId || !album?.id) return;
      
      try {
        const res = await authFetch(`${API_BASE}/api/music/user_playlist`);
        const data = await res.json();
        
        setIsAdded(data.some(item => item.id === album.id));
        const filtered = data.filter((pl) => pl.name !== "Liked Songs" && pl.type === "playlist");
        setUserPlaylists(filtered);
      } catch (err) {
        console.error("Failed to fetch user playlists", err);
      }
    };
  
    fetchUserPlaylists();

    // Add event listener for playlist updates
    const handlePlaylistUpdate = () => {
      fetchUserPlaylists();
    };
    window.addEventListener('playlistUpdated', handlePlaylistUpdate);
    return () => window.removeEventListener('playlistUpdated', handlePlaylistUpdate);
  }, [userId, album]);

  // Handle clicking outside menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId && menuRefs.current[openMenuId] && !menuRefs.current[openMenuId].contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  if (!album) return <SkeletonLoader/>;

  return (
    <div className="playlist-page">
      <div className="playlist-header">
        <img 
          src={album.image || "/default_cover.png"} 
          alt={album.name} 
          className="playlist-cover" 
          onError={(e) => { e.target.onerror = null; e.target.src = "/default_cover.png"; }}
        />
        <div className="playlist-info">
          <span className="playlist-label">Album</span>
          <h1>{album.name}</h1>
          <p>
            <button 
              className="artist-link"
              onClick={() => navigate(`/artist/${album.artist_id}`)}
            >
              {album.artist}
            </button> • {album.tracks.length} songs
          </p>
          <button
            className="add-button"
            onClick={isAdded ? removeAlbum : addAlbum}
          >
            {isAdded ? "Remove" : "Add +"}
          </button>
        </div>
      </div>

      <button
        className="play-button"
        onClick={async () => {
          if (isCurrentAlbumPlaying) {
            stop();
          } else {
            await playSongFrom(album.tracks[0].id);
          }
        }}
      >
        <span className="play-icon">
          {isCurrentAlbumPlaying ? <i className="fas fa-pause" /> : <i className="fas fa-play" />}
        </span>
      </button>

      <table className="track-table">
        <thead>
          <tr>
            <th className="col-number">#</th>
            <th className="col-title">Title</th>
            <th className="col-album">Album</th>
            <th className="col-duration">Duration</th>
            <th className="col-like"></th>
            <th className="col-option"></th>
          </tr>
        </thead>
        <tbody>
          {album.tracks.map((track, i) => {
            const isCurrent = currentSong?.id === track.id;
            const isLiked = likedTrackIds.includes(track.id);
            return (
              <tr key={track.id} className={isCurrent && isPlaying ? "playing" : "track-row"}>
                <td className="col-number">
                  <div className="row-number-wrapper">
                    {isCurrent && isPlaying ? (
                      <div className="playing-bars">
                        <span className="bar bar1"></span>
                        <span className="bar bar2"></span>
                        <span className="bar bar3"></span>
                      </div>
                    ) : (
                      <>
                        <span className="track-number">{i + 1}</span>
                        <FaPlay className="play-icon-row" onClick={() => playSongFrom(track.id)} />
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
                      <button 
                        className="artist-link"
                        onClick={() => navigate(`/artist/${album.artist_id}`)}
                      >
                        {track.artist_name}
                      </button>
                    </span>
                  </div>
                </td>
                <td className="col-album">{track.album}</td>
                <td className="col-duration">{track.duration}</td>
                <td className="col-like">
                  <button className="add-btn" onClick={() => toggleLike(track.id)}>
                    {isLiked ? <FaHeart color="#b09601" /> : <FaRegHeart />}
                  </button>
                </td>
                <td className="track-options col-option">
                  <div className="options-wrapper" ref={(el) => (menuRefs.current[track.id] = el)}>
                    <button className="options-button" onClick={() => setOpenMenuId(track.id)}>
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
                              {userPlaylists.filter((pl) => pl.type === "playlist").map((pl) => (
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AlbumPage;