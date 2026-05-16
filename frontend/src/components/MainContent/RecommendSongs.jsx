import React, { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import "../../styles/MainContent/RecommendSongs.css";
import { usePlayer } from "../../context/PlayerContext";
import { authFetch } from '../../utils/authFetch';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const RecommendSongs = ({ title }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { queue, setQueue, playSong } = usePlayer();

  const fetchMp3Url = async (trackName) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(trackName)}`);
      const data = await res.json();
      return data.url;
    } catch (err) {
      console.error("Lỗi lấy mp3:", err);
      return null;
    }
  };

  const handlePlaySong = async (trackId) => {
    const index = songs.findIndex((t) => t.id === trackId);
    if (index === -1) return;

    const current = songs[index];
    const restTracks = songs.slice(index + 1);

    try {
      const mp3Url = await fetchMp3Url(current.title);
      const enrichedCurrent = {
        ...current,
        mp3_url: mp3Url,
        track_name: current.title,
      };

      const rest = await Promise.all(
        restTracks.map(async (t) => {
          return {
            ...t,
            track_name: t.title,
          };
        })
      );

      playSong(enrichedCurrent, rest);
    } catch (err) {
      console.error("Error:", err);
    }
  };


  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const userId = jwtDecode(token).sub;

    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await authFetch(`${API_BASE}/api/music/recommendations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        console.log("Recommendations:", data);
        setSongs(data);
      } catch (err) {
        console.error(err);
        setError("Oops! Unable to load recommendations");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  return (
    <div className="recommend-section">
      <h3 className="recommend-title">{title}</h3>

      {loading && <p style={{ color: "#aaa" }}>🎧 Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        songs.length > 0 ? (
          <div className="scroll-container">
            {songs.map((item, index) => (
              <div
                key={index}
                className="music-card"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => handlePlaySong(item.id)}
                title="Click to play this song"
              >
                <img
                  src={item.cover_url || "/default_cover.png"}
                  alt={item.title}
                  onError={(e) => { e.target.onerror = null; e.target.src = "/default_cover.png"; }}
                />
                <p className="title">{item.title}</p>
                <p className="subtitle">{item.artist}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#ccc" }}>No recommendations available. Try searching for some songs 🎵</p>
        )
      )}

    </div>
  );
};

export default RecommendSongs;
