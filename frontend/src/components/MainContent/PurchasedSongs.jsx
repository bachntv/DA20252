import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlay } from "react-icons/fa";
import { authFetch } from "../../utils/authFetch";
import { usePlayer } from "../../context/PlayerContext";
import { createTrackArtwork, getTrackArtwork } from "../../utils/artwork";
import "../../styles/MainContent/SearchPage.css";
import "../../styles/MainContent/PurchasedSongs.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const PurchasedSongs = () => {
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user/purchases`);
        const data = await res.json();
        setTracks(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch purchased songs", err);
        setTracks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPurchases();
  }, []);

  const playPurchasedSong = async (track) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(track.title)}`);
      const data = await res.json();
      playSong({
        id: track.id,
        track_name: track.title,
        artist_name: track.artist,
        artist_id: track.artist_id,
        album: track.album,
        album_id: track.album_id,
        image_url: track.cover_url,
        duration: track.duration,
        mp3_url: data.url,
      });
    } catch (err) {
      console.error("Failed to play purchased song", err);
    }
  };

  return (
    <div className="search-results-page purchased-page">
      <div className="purchased-hero">
        <span>Library</span>
        <h1>Purchased Songs</h1>
        <p>{tracks.length} owned tracks</p>
      </div>

      {isLoading ? (
        <div className="skeleton-table">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton-row shimmer" key={i}></div>
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <div className="search-placeholder">
          <p>No purchased songs yet.</p>
        </div>
      ) : (
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-number">#</th>
              <th className="col-title">Title</th>
              <th className="col-album">Album</th>
              <th className="col-duration">Duration</th>
              <th className="col-date">Purchased</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, index) => {
              const isCurrent = currentSong?.id === track.id;
              return (
                <tr key={track.id} className={isCurrent && isPlaying ? "playing" : ""}>
                  <td className="col-number">
                    <div className="row-number-wrapper">
                      <span className="track-number">{index + 1}</span>
                      <FaPlay className="play-icon-row" onClick={() => playPurchasedSong(track)} />
                    </div>
                  </td>
                  <td className="track-title-cell col-date">
                    <img
                      src={getTrackArtwork(track)}
                      alt={track.title}
                      className="track-image"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = createTrackArtwork(track);
                      }}
                    />
                    <div className="track-info">
                      <p className="track-title">{track.title}</p>
                      <span className="track-artist">{track.artist}</span>
                    </div>
                  </td>
                  <td className="col-album">
                    <button className="album-link" onClick={() => navigate(`/album/${track.album_id}`)}>
                      {track.album}
                    </button>
                  </td>
                  <td className="col-duration">{track.duration}</td>
                  <td className="col-date">
                    {track.purchased_at ? new Date(track.purchased_at).toLocaleDateString() : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PurchasedSongs;
