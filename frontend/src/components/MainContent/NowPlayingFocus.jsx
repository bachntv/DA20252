import React, { useEffect, useState } from "react";
import "../../styles/MainContent/NowPlayingFocus.css";
import { createArtistArtwork, createTrackArtwork, getArtistArtwork, getTrackArtwork } from "../../utils/artwork";
import { jwtDecode } from "jwt-decode";
import { authFetch } from "../../utils/authFetch";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const formatNumber = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(number);
};

const NowPlayingFocus = ({ mode, currentSong, artistInfo, onClose }) => {
  const [lyrics, setLyrics] = useState("");
  const [lyricsDraft, setLyricsDraft] = useState("");
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isSavingLyrics, setIsSavingLyrics] = useState(false);
  const [lyricsError, setLyricsError] = useState("");
  const token = localStorage.getItem("token");
  const roles = token ? jwtDecode(token)?.roles || [] : [];
  const canEditLyrics = roles.includes("artist");
  const isLyricsEditMode = mode === "lyricsEdit" && canEditLyrics;

  useEffect(() => {
    if (!["lyrics", "lyricsEdit"].includes(mode) || !currentSong?.id) return;

    const fetchLyrics = async () => {
      setIsLoadingLyrics(true);
      setLyricsError("");
      try {
        const res = await fetch(`${API_BASE}/api/social/tracks/${currentSong.id}/lyrics`);
        const data = await res.json();
        setLyrics(data.lyrics || "");
        setLyricsDraft(data.lyrics || "");
      } catch (err) {
        setLyrics("");
        setLyricsDraft("");
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    fetchLyrics();
  }, [mode, currentSong?.id]);

  const saveLyrics = async () => {
    if (!currentSong?.id || !canEditLyrics || isSavingLyrics) return;
    setIsSavingLyrics(true);
    setLyricsError("");
    try {
      const res = await authFetch(`${API_BASE}/api/social/tracks/${currentSong.id}/lyrics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: lyricsDraft }),
      });
      if (!res.ok) {
        throw new Error("Could not save lyrics");
      }
      const data = await res.json();
      setLyrics(data.lyrics || "");
      setLyricsDraft(data.lyrics || "");
      window.dispatchEvent(new Event("lyricsUpdated"));
    } catch (err) {
      setLyricsError("Lyrics could not be saved.");
    } finally {
      setIsSavingLyrics(false);
    }
  };

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
      {isLyricsEditMode ? (
        <div className="focus-lyrics-editor">
          <textarea
            value={lyricsDraft}
            onChange={(e) => setLyricsDraft(e.target.value)}
            placeholder="Add lyrics for this song"
            disabled={isLoadingLyrics || isSavingLyrics}
          />
          <div className="focus-lyrics-actions">
            {lyricsError && <span>{lyricsError}</span>}
            <button onClick={saveLyrics} disabled={isLoadingLyrics || isSavingLyrics}>
              {isSavingLyrics ? "Saving..." : "Save Lyrics"}
            </button>
          </div>
        </div>
      ) : (
        <pre className="focus-lyrics">
          {isLoadingLyrics ? "Loading lyrics..." : lyrics || "No lyrics added yet."}
        </pre>
      )}
    </section>
  );
};

export default NowPlayingFocus;
