import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaPlay } from "react-icons/fa";
import { usePlayer } from "../../context/PlayerContext";
import { createTrackArtwork, getTrackArtwork } from "../../utils/artwork";
import "../../styles/MainContent/PlaylistPage.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const ChartPage = () => {
  const { chartId } = useParams();
  const navigate = useNavigate();
  const [chart, setChart] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRefs = useRef({});
  const { currentSong, isPlaying, queue, playSong, setQueue, stop } = usePlayer();

  const isCurrentChartPlaying = chart?.tracks?.some((track) => track.id === currentSong?.id) && isPlaying;

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
    const index = chart.tracks.findIndex((track) => track.id === trackId);
    if (index === -1) return;

    const track = chart.tracks[index];
    const rest = chart.tracks.slice(index + 1);
    const mp3Url = await fetchMp3Url(track.track_name);
    if (!mp3Url) return;

    playSong({ ...track, mp3_url: mp3Url }, rest);
  };

  const addToQueue = async (trackId) => {
    const track = chart.tracks.find((item) => item.id === trackId);
    if (!track) return;

    try {
      const mp3Url = await fetchMp3Url(track.track_name);
      if (!mp3Url) return;

      const enriched = { ...track, mp3_url: mp3Url };
      if (!isPlaying) {
        playSong(enriched, []);
      } else {
        setQueue([...queue, enriched]);
      }
    } catch (err) {
      console.error("Failed to add chart track to queue:", err);
    } finally {
      setOpenMenuId(null);
    }
  };

  useEffect(() => {
    const fetchChart = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/music/charts/${chartId}`);
        const data = await res.json();
        const tracks = Array.isArray(data.tracks)
          ? data.tracks.map((track) => ({
              id: track.id,
              track_name: track.title,
              artist_id: track.artist_id,
              artist_name: track.artist,
              album_id: track.album_id,
              album: track.album,
              duration: track.duration,
              image_url: track.cover_url,
            }))
          : [];

        setChart({
          id: data.id,
          name: data.title,
          description: data.description,
          image: data.cover_url,
          tracks,
        });
      } catch (err) {
        console.error("Failed to fetch chart:", err);
      }
    };

    fetchChart();
  }, [chartId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId && menuRefs.current[openMenuId] && !menuRefs.current[openMenuId].contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  if (!chart) {
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
      </div>
    );
  }

  return (
    <div className="playlist-page">
      <div className="playlist-header">
        <img
          src={chart.image || "/default_cover.png"}
          alt={chart.name}
          className="playlist-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/default_cover.png";
          }}
        />
        <div className="playlist-info">
          <span className="playlist-label">Chart</span>
          <h1>{chart.name}</h1>
          <p>{chart.tracks.length} songs</p>
          <p className="playlist-description">{chart.description}</p>
        </div>
      </div>

      <button
        className="play-button"
        onClick={async () => {
          if (isCurrentChartPlaying) {
            stop();
            return;
          }
          if (chart.tracks[0]) await playSongFrom(chart.tracks[0].id);
        }}
      >
        <span className="play-icon">
          {isCurrentChartPlaying ? <i className="fas fa-pause" /> : <i className="fas fa-play" />}
        </span>
      </button>

      <table className="track-table">
        <thead>
          <tr>
            <th className="col-number">#</th>
            <th className="col-title">Title</th>
            <th className="col-album">Album</th>
            <th className="col-duration">Duration</th>
            <th className="col-option"></th>
          </tr>
        </thead>
        <tbody>
          {chart.tracks.map((track, i) => {
            const isCurrent = currentSong?.id === track.id;
            return (
              <tr key={track.id} className={isCurrent && isPlaying ? "playing" : ""}>
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
                    src={getTrackArtwork(track)}
                    alt={track.track_name}
                    className="track-image"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = createTrackArtwork(track);
                    }}
                  />
                  <div className="track-info">
                    <p className="track-title">{track.track_name}</p>
                    <span className="track-artist">
                      {(track.artist_name?.split(", ") || []).map((name, index) => {
                        const artistId = track.artist_id?.split(", ")?.[index];
                        return (
                          <React.Fragment key={`${track.id}-${name}`}>
                            {artistId ? (
                              <button className="artist-link" onClick={() => navigate(`/artist/${artistId}`)}>
                                {name}
                              </button>
                            ) : (
                              name
                            )}
                            {index < track.artist_name.split(", ").length - 1 && ", "}
                          </React.Fragment>
                        );
                      })}
                    </span>
                  </div>
                </td>
                <td className="col-album">
                  <button className="album-link" onClick={() => navigate(`/album/${track.album_id}`)}>
                    {track.album}
                  </button>
                </td>
                <td className="col-duration">{track.duration}</td>
                <td className="track-options col-option">
                  <div className="options-wrapper" ref={(el) => (menuRefs.current[track.id] = el)}>
                    <button className="options-button" onClick={() => setOpenMenuId(track.id)}>
                      &#x22EE;
                    </button>
                    {openMenuId === track.id && (
                      <div className="options-menu show">
                        <button onClick={() => addToQueue(track.id)}>Add to Queue</button>
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

export default ChartPage;
