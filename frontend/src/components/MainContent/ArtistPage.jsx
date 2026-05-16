import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaPlay, FaHeart, FaRegHeart } from "react-icons/fa";
import { usePlayer } from "../../context/PlayerContext";
import { jwtDecode } from "jwt-decode";
import "../../styles/MainContent/PlaylistPage.css";
import SkeletonLoader from "../SkeletonLoader";
import { authFetch } from '../../utils/authFetch';
import { updateLastPlayed } from '../../utils/lastPlayed';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const ArtistPage = () => {
  const { artistId } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [likedTrackIds, setLikedTrackIds] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [hoveredTrackId, setHoveredTrackId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isAdded, setIsAdded] = useState(false);
  const menuRefs = useRef({});
  const token = localStorage.getItem("token");
  const userId = token ? jwtDecode(token)?.sub : null;

  const { currentSong, isPlaying, playSong, stop, queue, setQueue } = usePlayer();

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
    const index = artist.tracks.findIndex((t) => t.id === trackId);
    if (index === -1) return;

    const first = artist.tracks[index];
    const rest = artist.tracks.slice(index + 1);
    const mp3Url = await fetchMp3Url(first.track_name);
    
    if (!mp3Url) return;
    
    playSong({ ...first, mp3_url: mp3Url }, rest);

    // Update last played if artist is in user's library
    if (isAdded && token) {
      await updateLastPlayed(artist.id, token);
    }
  };

  const addToQueue = async (trackId) => {
    const track = artist.tracks.find((t) => t.id === trackId);
    if (!track) return;

    try {
      const mp3Url = await fetchMp3Url(track.track_name);
      if (!mp3Url) return;
      
      const enriched = { ...track, mp3_url: mp3Url };

      if (!isPlaying) {
        playSong(enriched, []);
        if (isAdded && token) {
          await updateLastPlayed(artist.id, token);
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

  const addArtist = async () => {
    try {
      await authFetch(`${API_BASE}/api/music/add_to_library/${artist.id}?type=artist`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAdded(true);
      console.log("Artist added to library");
      window.dispatchEvent(new Event('artistUpdated')); 
    } catch (err) {
      console.error(`Error while adding to user library: ${err}`);
    }
  };
    
  const removeArtist = async () => {
    try {
      await authFetch(`${API_BASE}/api/music/remove_from_library/${artist.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAdded(false);
      console.log("Artist removed from library");
      window.dispatchEvent(new Event('artistUpdated')); 
    } catch (err) {
      console.error(`Error while removing artist from library: ${err}`);
    }
  };

  // Fetch artist data
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [artistInfoRes, songsRes] = await Promise.all([
          fetch(`${API_BASE}/api/music/artist/${artistId}`),
          fetch(`${API_BASE}/api/music/artist/${artistId}/songs`),
        ]);
        const artistData = await artistInfoRes.json();
        const tracks = await songsRes.json();

        const formatted = tracks.map((t) => ({
          id: t.id,
          track_name: t.title,
          artist_name: t.artist,
          album: t.album,
          album_id: t.album_id,
          duration: t.duration,
          image_url: t.cover_url,
        }));

        setArtist({
          id: artistId,
          name: artistData.name,
          image: artistData.profile_image_url,
          tracks: formatted,
        });
      } catch (err) {
        console.error("Failed to fetch artist data:", err);
      }
    };

    fetchAll();
  }, [artistId]);

  // Fetch liked tracks
  useEffect(() => {
    if (!userId) return;
    authFetch(`${API_BASE}/api/music/user/liked_track_ids`)
      .then((res) => res.json())
      .then(setLikedTrackIds)
      .catch(console.error);
  }, [userId]);

  // Fetch user playlists and check if artist is added
  useEffect(() => {
    if (!userId || !artist) return;
    authFetch(`${API_BASE}/api/music/user_playlist`)
      .then((res) => res.json())
      .then((data) => {
        const filtered = data.filter((pl) => pl.name !== "Liked Songs" && pl.type === "playlist");
        setUserPlaylists(filtered);
        
        // Check if artist is added to library
        const isInLibrary = data.some(item => item.id === artist.id);
        setIsAdded(isInLibrary);
      })
      .catch(console.error);

    // Add event listener for playlist updates
    const handlePlaylistUpdate = () => {
      authFetch(`${API_BASE}/api/music/user_playlist`)
        .then((res) => res.json())
        .then((data) => {
          const filtered = data.filter((pl) => pl.name !== "Liked Songs" && pl.type === "playlist");
          setUserPlaylists(filtered);
          
          // Check if artist is added to library
          const isInLibrary = data.some(item => item.id === artist.id);
          setIsAdded(isInLibrary);
        })
        .catch(console.error);
    };
    window.addEventListener('playlistUpdated', handlePlaylistUpdate);
    return () => window.removeEventListener('playlistUpdated', handlePlaylistUpdate);
  }, [userId, artist]);

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

  if (!artist) return <SkeletonLoader/>;

  const isCurrentArtistPlaying = artist.tracks.some((t) => t.id === currentSong?.id) && isPlaying;

  return (
    <div className="playlist-page">
      <div className="playlist-header">
        <img 
          src={artist.image || "/default_cover.png"} 
          alt={artist.name} 
          className="playlist-cover" 
          onError={(e) => { e.target.onerror = null; e.target.src = "/default_cover.png"; }}
        />
        <div className="playlist-info">
          <span className="playlist-label">Artist</span>
          <h1>{artist.name}</h1>
          <p>{artist.tracks.length} songs</p>
          <button className="add-button" onClick={isAdded ? removeArtist : addArtist}>
            {isAdded ? "Remove" : "Add +"}
          </button>
        </div>
      </div>

      <button
        className="play-button"
        onClick={async () => {
          if (isCurrentArtistPlaying) {
            stop();
          } else {
            await playSongFrom(artist.tracks[0].id);
          }
        }}
      >
        <span className="play-icon">
          {isCurrentArtistPlaying ? <i className="fas fa-pause" /> : <i className="fas fa-play" />}
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
          {artist.tracks.map((track, i) => {
            const isLiked = likedTrackIds.includes(track.id);
            const isCurrent = currentSong?.id === track.id;
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
                    <span className="track-artist">{track.artist_name}</span>
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

export default ArtistPage;