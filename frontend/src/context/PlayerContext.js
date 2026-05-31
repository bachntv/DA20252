import React, { createContext, useState, useContext } from "react";
import { useEffect } from "react";

const PlayerContext = createContext();

export const usePlayer = () => useContext(PlayerContext);

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

export const PlayerProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [history, setHistory] = useState([]);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");

  const getTrackName = (song) => song?.track_name || song?.title || "";

  const fetchSongUrl = async (song) => {
    if (song?.mp3_url) return song.mp3_url;
    const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(getTrackName(song))}`);
    const data = await res.json();
    return data.url;
  };

  const playSong = (song, remainingQueue = []) => {
    if (currentSong) {
      setHistory((prev) => [...prev, currentSong]); 
    }
    setCurrentSong(song);
    setQueue(remainingQueue);
    setIsPlaying(true);
  };

  const stop = () => {
    setIsPlaying(false);
  };

  const nextSong = async () => {
    if (!currentSong && queue.length === 0) {
      setIsPlaying(false);
      return;
    }

    if (repeatMode === "one" && currentSong) {
      try {
        const mp3Url = await fetchSongUrl(currentSong);
        setCurrentSong({ ...currentSong, mp3_url: mp3Url });
        setIsPlaying(true);
      } catch (err) {
        console.error("Error repeating current song", err);
      }
      return;
    }

    if (queue.length === 0) {
      if (repeatMode === "all" && history.length > 0) {
        const repeatedQueue = currentSong ? [...history, currentSong] : [...history];
        const [nextRepeat, ...restRepeat] = repeatedQueue;

        try {
          const mp3Url = await fetchSongUrl(nextRepeat);
          setCurrentSong({ ...nextRepeat, mp3_url: mp3Url });
          setQueue(restRepeat);
          setHistory([]);
          setIsPlaying(true);
        } catch (err) {
          console.error("Error restarting repeated queue", err);
        }
        return;
      }

      setIsPlaying(false);
      return;
    }

    const nextIndex = isShuffleEnabled ? Math.floor(Math.random() * queue.length) : 0;
    const next = queue[nextIndex];
    const rest = queue.filter((_, index) => index !== nextIndex);

    if (currentSong) {
      setHistory((prev) => [...prev, currentSong]);
    }

    try {
      const mp3Url = await fetchSongUrl(next);
      const enrichedNext = { ...next, mp3_url: mp3Url };

      setCurrentSong(enrichedNext);
      setQueue(rest);
      setIsPlaying(true);
    } catch (err) {
      console.error("Error fetching next song URL", err);
    }
  };

  const prevSong = async () => {
    if (history.length === 0) {
      console.log("No previous song to play.");
      return;
    }

    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1); 
    const newQueue = currentSong ? [currentSong, ...queue] : queue;

    try {
      const mp3Url = await fetchSongUrl(previous);
      const enrichedPrev = { ...previous, mp3_url: mp3Url };

      setCurrentSong(enrichedPrev);
      setQueue(newQueue);
      setHistory(newHistory);
      setIsPlaying(true);
    } catch (err) {
      console.error("Error fetching previous song URL", err);
    }
  };

  const removeFromQueue = (trackId) => {
    setQueue(prevQueue => prevQueue.filter(track => track.id !== trackId));
  };

  const toggleShuffle = () => {
    setIsShuffleEnabled((prev) => !prev);
  };

  const cycleRepeatMode = () => {
    setRepeatMode((current) => {
      if (current === "off") return "all";
      if (current === "all") return "one";
      return "off";
    });
  };

  useEffect(() => {
  console.log("Current song in context:", currentSong);
}, [currentSong]);

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        queue,
        history,
        isPlaying,
        playSong,
        setQueue,
        stop,
        nextSong,
        prevSong,
        removeFromQueue,
        isShuffleEnabled,
        repeatMode,
        toggleShuffle,
        cycleRepeatMode,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
