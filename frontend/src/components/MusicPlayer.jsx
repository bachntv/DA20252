import React, { useEffect, useRef, useState } from "react";
import {
  FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaVolumeMute,
  FaExpand, FaPlus, FaHeart, FaRegHeart, FaList
} from "react-icons/fa";
import "../styles/MusicPlayer.css";

const formatTime = (seconds) => {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const MusicPlayer = ({
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  onToggleFullscreen,
  onToggleLike,
  likedTrackIds = [],
  userPlaylists = [],
  onAddTrackToPlaylist,
  onToggleQueue,
  isQueueVisible
}) => {
  const audioRef = useRef(null);
  const playlistRef = useRef(null);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(100);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPlaylistOptions, setShowPlaylistOptions] = useState(false);

  const isLiked = currentSong && likedTrackIds.includes(currentSong.id);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (playlistRef.current && !playlistRef.current.contains(e.target)) {
        setShowPlaylistOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.play().catch(console.error);
      else audioRef.current.pause();
    }
  }, [isPlaying, currentSong]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration);
      setProgress((audio.currentTime / audio.duration) * 100);
    }
  };

  const handleProgressClick = (e) => {
    const bar = e.target.getBoundingClientRect();
    const percentage = (e.clientX - bar.left) / bar.width;
    audioRef.current.currentTime = duration * percentage;
  };

  const handleVolumeClick = () => {
    if (isMuted) {
      // Unmute: restore previous volume
      setVolume(previousVolume);
      setIsMuted(false);
    } else {
      // Mute: store current volume and set to 0
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  return (
    <div className="music-player">
      <audio
        ref={audioRef}
        src={currentSong?.mp3_url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={onNext}
      />

      <div className="player-left">
        <img
          className="song-cover"
          src={currentSong?.image_url || currentSong?.cover_url || "/default_cover.png"}
          alt="cover"
        />
        <div className="song-info">
          <p className="title">{currentSong?.track_name || currentSong?.title || "No song playing"}</p>
          <p className="artist">{currentSong?.artist_name || currentSong?.artist || ""}</p>
        </div>

        <div className="playlist-dropdown-wrapper" ref={playlistRef}>
          <button className="icon-button" onClick={() => setShowPlaylistOptions((prev) => !prev)}>
            <FaPlus />
          </button>
          {showPlaylistOptions && (
            <div className="playlist-options-dropdown">
              {userPlaylists
              .filter((pl) => pl.type === "playlist")
              .map((pl) => (
                <div
                  key={pl.id}
                  className="playlist-option-item"
                  onClick={() => {
                    onAddTrackToPlaylist(currentSong.id, pl.id);
                    setShowPlaylistOptions(false);
                  }}
                >
                  {pl.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="icon-button" onClick={() => onToggleLike(currentSong?.id)}>
          {isLiked ? <FaHeart color="#b09601" /> : <FaRegHeart />}
        </button>
      </div>

      <div className="player-center">
        <div className="controls">
          <button className="icon-button" onClick={onPrev} aria-label="Previous" title="Previous">
            <FaStepBackward />
          </button>
          <button className="play-button" onClick={onPlayPause}>
            {isPlaying ? <FaPause /> : <FaPlay />}
          </button>
          <button className="icon-button" onClick={onNext} aria-label="Next" title="Next">
            <FaStepForward />
          </button>
        </div>
        <div className="progress-container">
          <span className="time">{formatTime(currentTime)}</span>
          <div className="progress-bar" onClick={handleProgressClick}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <div className="progress-thumb" />
          </div>
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <div className="volume-control">
          <button className="icon-button" onClick={handleVolumeClick}>
            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            className="volume-slider"
            onChange={(e) => {
              const newVolume = parseInt(e.target.value);
              setVolume(newVolume);
              if (newVolume > 0) {
                setIsMuted(false);
              }
            }}
            style={{
              background: `linear-gradient(to right, #b09601 0%, #b09601 ${volume}%, #444 ${volume}%, #444 100%)`,
            }}
          />
        </div>
        <button 
          className={`icon-button ${isQueueVisible ? 'active' : ''}`} 
          onClick={onToggleQueue}
          title="Queue"
        >
          <FaList />
        </button>
        {/* <button className="icon-button" onClick={onToggleFullscreen}>
          <FaExpand />
        </button> */}
      </div>
    </div>
  );
};

export default MusicPlayer;