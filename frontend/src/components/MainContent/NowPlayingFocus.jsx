import React, { useEffect, useState } from "react";
import "../../styles/MainContent/NowPlayingFocus.css";
import { createArtistArtwork, createTrackArtwork, getArtistArtwork, getTrackArtwork } from "../../utils/artwork";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const formatNumber = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(number);
};

const NowPlayingFocus = ({ mode, currentSong, artistInfo, onClose }) => {
  const [lyrics, setLyrics] = useState("");
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  useEffect(() => {
    if (mode !== "lyrics" || !currentSong?.id) return;

    const fetchLyrics = async () => {
      setIsLoadingLyrics(true);
      try {
        const res = await fetch(`${API_BASE}/api/social/tracks/${currentSong.id}/lyrics`);
        const data = await res.json();
        setLyrics(data.lyrics || "");
      } catch (err) {
        setLyrics("");
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    fetchLyrics();
  }, [mode, currentSong?.id]);

  if (!currentSong) {
    return (
      <section className="now-playing-focus">
        <button className="focus-close-button" onClick={onClose}>Close</button>
        <p className="focus-empty">Choose a song first.</p>
      </section>
    );
  }

  if (mode === "artist" && artistInfo) {
    return (
      <section className="now-playing-focus artist-focus">
        <button className="focus-close-button" onClick={onClose}>Close</button>
        <div className="focus-artist-header">
          <img
            src={getArtistArtwork(artistInfo)}
            alt={artistInfo.name}
            onError={(e) => { e.target.onerror = null; e.target.src = createArtistArtwork(artistInfo); }}
          />
          <div>
            <span className="focus-label">About the artist</span>
            <h1>{artistInfo.name}</h1>
            <p>{formatNumber(artistInfo.monthly_listeners || artistInfo.followers)} monthly listeners</p>
          </div>
        </div>
        <p className="focus-description">{artistInfo.description || "No artist description available yet."}</p>
      </section>
    );
  }

  return (
    <section className="now-playing-focus lyrics-focus">
      <button className="focus-close-button" onClick={onClose}>Close</button>
      <div className="focus-song-header">
        <img
          src={getTrackArtwork(currentSong)}
          alt={currentSong.track_name || currentSong.title}
          onError={(e) => { e.target.onerror = null; e.target.src = createTrackArtwork(currentSong); }}
        />
        <div>
          <span className="focus-label">Lyrics</span>
          <h1>{currentSong.track_name || currentSong.title}</h1>
          <p>{currentSong.artist_name || currentSong.artist}</p>
        </div>
      </div>
      <pre className="focus-lyrics">
        {isLoadingLyrics ? "Loading lyrics..." : lyrics || "No lyrics added yet."}
      </pre>
    </section>
  );
};

export default NowPlayingFocus;
