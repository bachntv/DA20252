import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom"; // ✅ Add useNavigate
import "../../styles/MainContent/SearchPage.css";
import { FaPlay, FaHeart, FaRegHeart } from "react-icons/fa";
import { usePlayer } from "../../context/PlayerContext";
import "../../styles/MainContent/PlaylistPage.css";
import { jwtDecode } from "jwt-decode";
import { authFetch } from '../../utils/authFetch';
import {
  createAlbumArtwork,
  createArtistArtwork,
  createTrackArtwork,
  getAlbumArtwork,
  getArtistArtwork,
  getTrackArtwork,
} from "../../utils/artwork";


const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const SearchPage = () => {
  const navigate = useNavigate(); // ✅ Add navigate hook
  const token = localStorage.getItem("token");
  const [userId, setUserId] = useState(null);
  const menuRefs = useRef({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { queue, setQueue, playSong, currentSong, isPlaying } = usePlayer();
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [hoveredTrackId, setHoveredTrackId] = useState(null);

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserId(decoded.sub); // Adjust according to your JWT payload
      } catch (e) {
        console.error("Invalid token", e);
      }
    }
  }, [token]);

  useEffect(() => {
    console.log("queue", queue);


  }, [queue]);

  const [params] = useSearchParams();
  const query = params.get("query") || "";
  const filterBy = params.get("filter_by") || "track";
  const resultsParam = params.get("results");
  const browseMode = params.get("browse") || "";
  const showBrowse = browseMode === "1";
  const showBrowseCategory = Boolean(browseMode && browseMode !== "1");
  const browseCategories = [
    { title: "Songs", subtitle: "Find tracks to play now", color: "#d64f6f", path: "/search?browse=songs" },
    { title: "Albums", subtitle: "Explore records and releases", color: "#2f80ed", path: "/search?query=a&filter_by=album" },
    { title: "Artists", subtitle: "Search singers and bands", color: "#1f9d75", path: "/search?query=a&filter_by=artist" },
    { title: "Mood", subtitle: "Music for how you feel", color: "#8b5cf6", path: "/search?browse=mood" },
    { title: "Podcasts", subtitle: "Talk, stories, and shows", color: "#e0792f", path: "/search?browse=podcasts" },
    { title: "Charts", subtitle: "Popular music right now", color: "#0f8b8d", path: "/search?browse=charts" },
    { title: "Playlists", subtitle: "Collections for every moment", color: "#c2417a", path: "/search?browse=playlists" },
    { title: "New Releases", subtitle: "Fresh songs and albums", color: "#b7791f", path: "/search?query=a&filter_by=album" },
    { title: "Chill", subtitle: "Easy listening and calm tracks", color: "#457b9d", path: "/search?browse=chill" },
    { title: "Workout", subtitle: "Energy for movement", color: "#d9480f", path: "/search?browse=workout" },
    { title: "Focus", subtitle: "Stay locked in", color: "#52616b", path: "/search?browse=focus" },
  ];
  const browseBannerMeta = {
    songs: { title: "Songs", subtitle: "Tracks ready to play now.", color: "#d64f6f" },
    mood: { title: "Mood", subtitle: "Choose from Happy, Chill, Sad, Focus, Angry, and Lonely.", color: "#8b5cf6" },
    charts: { title: "Charts", subtitle: "The most popular music in the catalog.", color: "#0f8b8d" },
    podcasts: { title: "Podcasts", subtitle: "Long-form tracks and episodes over five minutes.", color: "#e0792f" },
    playlists: { title: "Playlists", subtitle: "Playlist starters and radio-style collections.", color: "#c2417a" },
    chill: { title: "Chill", subtitle: "Easy listening, acoustic, and relaxed tracks.", color: "#457b9d" },
    workout: { title: "Workout", subtitle: "High-energy tracks for movement.", color: "#d9480f" },
    focus: { title: "Focus", subtitle: "Calm music for studying and concentration.", color: "#52616b" },
  };
  const [browseRows, setBrowseRows] = useState([]);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);

  const parseEmotionResults = () => {
    if (!resultsParam) return null;
    try {
      const decodedResults = decodeURIComponent(resultsParam);
      const parsedResults = JSON.parse(decodedResults);
      if (parsedResults.reply) {
        const jsonStr = parsedResults.reply.replace(/```json\n|\n```/g, '');
        return JSON.parse(jsonStr);
      }
      return null;
    } catch (err) {
      console.error("Failed to parse emotion results:", err);
      return null;
    }
  };

useEffect(() => {
  const fetchEmotionResults = async () => {
    if (filterBy === "emotion" && resultsParam) {
      try {
        const decodedResults = decodeURIComponent(resultsParam);
        const parsedResults = JSON.parse(decodedResults);

        if (parsedResults.reply) {
          const jsonStr = parsedResults.reply.replace(/```json\n|\n```/g, '');
          const mood = JSON.parse(jsonStr).mood;
          console.log("Mood:", mood);

          const res = await authFetch(`${API_BASE}/api/music/recommendations/emotion/${mood}`);
          const data = await res.json();

          setResults(data);
          console.log("Emotion results:", data);
        }
      } catch (err) {
        console.error("Lỗi khi fetch emotion results:", err);
      }
    }
  };

  fetchEmotionResults(); 
}, [query]); 


  // const handleKeyDown = async (e) => {
  //   if (e.key === 'Enter' && filterBy === "emotion") {
  //     const decodedResults = decodeURIComponent(resultsParam);
  //     const parsedResults = JSON.parse(decodedResults);
  //     const jsonStr = parsedResults.reply.replace(/```json\n|\n```/g, '');
  //     const res = authFetch.get(`http://localhost:8000/api/music/recommendations/emotion/${JSON.parse(jsonStr).mood}`);
  //     const data = res.json();
  //     setResults(data);
  //     console.log("Emotion results:", data);
  //   }
  // };

  const addToQueue = async (trackId) => {
    const track = results.find((t) => t.id === trackId);
    if (!track) return;
  
    try {
      // Fetch mp3_url for the track
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(track.title)}`);
      const data = await res.json();
      const enrichedTrack = {
        id: track.id,
        track_name: track.title,
        artist_name: track.artist,
        album: track.album,
        image_url: track.cover_url,
        duration: track.duration,
        mp3_url: data.url,
      };
  
      // If no song is playing, play immediately
      if (!isPlaying) {
        playSong(enrichedTrack, []);
      } else {
        // Else, add to end of queue
        setQueue([...queue, enrichedTrack]);
      }
    } catch (err) {
      console.error("Failed to add to queue", err);
    } finally {
      setOpenMenuId(null);
    }
  };
  
  const addToPlaylist = async (trackId, playlistId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await authFetch(`${API_BASE}/api/music/user/add_track_to_playlist`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          track_id: trackId,
          playlist_id: playlistId,
        }),
      });
  
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to add to playlist");
      }
  
      console.log("Track added to playlist successfully");
    } catch (err) {
      console.error("Error adding track to playlist:", err);
    } finally {
      setOpenMenuId(null);
    }
  };

  const [results, setResults] = useState([]);
  const [likedTrackIds, setLikedTrackIds] = useState([]);

  useEffect(() => {
    const trimmedQuery = query.trim();
  
    if (!trimmedQuery) {
      setResults([]);
      setIsLoading(false);
      return;
    }
  
    const fetchResults = async () => {
      setIsLoading(true);
  
      try {
        const res = await fetch(`${API_BASE}/api/music/search?query=${encodeURIComponent(query)}&filter_by=${filterBy}`);
        const data = await res.json();
  
        if (Array.isArray(data)) {
          setResults(data);
        } else {
          console.warn("Unexpected response", data);
          setResults([]);
        }
      } catch (err) {
        console.error("Search failed", err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchResults();
  }, [query, filterBy]);

  useEffect(() => {
      const handleClickOutside = (e) => {
        if (
          openMenuId &&
          menuRefs.current[openMenuId] &&
          !menuRefs.current[openMenuId].contains(e.target)
        ) {
          setOpenMenuId(null);
        }
      };
    
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [openMenuId]);

  useEffect(() => {
    const fetchLikedTracks = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user/liked_track_ids`);
        const data = await res.json();
        setLikedTrackIds(data);
      } catch (err) {
        console.error("Failed to fetch liked songs", err);
      }
    };

    if (userId) fetchLikedTracks();
  }, [userId]);

  useEffect(() => {
    const fetchUserPlaylists = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user_playlist`);
        const data = await res.json();
        // Exclude "Liked Songs" and filter to only include playlists
        const filtered = data.filter((pl) => pl.name !== "Liked Songs" && pl.type === "playlist");
        setUserPlaylists(filtered);
      } catch (err) {
        console.error("Failed to fetch user playlists", err);
      }
    };
  
    if (userId) fetchUserPlaylists();

    // Add event listener for playlist updates
    const handlePlaylistUpdate = () => {
      fetchUserPlaylists();
    };
    window.addEventListener('playlistUpdated', handlePlaylistUpdate);
    return () => window.removeEventListener('playlistUpdated', handlePlaylistUpdate);
  }, [userId]);

  const toggleLike = async (trackId) => {
    const isLiked = likedTrackIds.includes(trackId);
    setLikedTrackIds((prev) =>
      isLiked ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  
    try {
      const method = isLiked ? "DELETE" : "POST";
      await authFetch(`${API_BASE}/api/music/user/liked_track?track_id=${trackId}`, {
        method: method,
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error("Toggle failed, reverting state");
      // Revert back
      setLikedTrackIds((prev) =>
        isLiked ? [...prev, trackId] : prev.filter(id => id !== trackId)
      );
    }
  };
  // const appendSuggestionsIfNeeded = async () => {
  //   if (!currentSong || queue.length === 0) return;

  //   const isLastSong = queue.length === 1 && currentSong.id === queue[0].id;
  //   if (!isLastSong) return;

  //   try {
  //     const res = await fetch(`http://localhost:8000/api/music/related/${currentSong.id}`);
  //     const related = await res.json();

  //     const enriched = await Promise.all(related.map(async (track) => {
  //       const urlRes = await fetch(`http://localhost:8000/api/music/mp3url/${encodeURIComponent(track.track_name)}`);
  //       const urlData = await urlRes.json();
  //       return { ...track, mp3_url: urlData.url };
  //     }));

  //     const validTracks = enriched.filter(Boolean);
  //     setQueue((prev) => [...prev, ...validTracks]);
  //   } catch (err) {
  //     console.error("Failed to fetch related songs:", err);
  //   }
  // };

  // useEffect(() => {
  //   appendSuggestionsIfNeeded();
  // });

  const getDurationSeconds = (duration = "") => {
    const parts = String(duration).split(":").map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const podcastDurationOverrides = {
    comedy: "49:00",
  };

  const getPodcastDurationOverride = (track = {}) => {
    const title = String(track.title || track.track_name || "").trim().toLowerCase();
    return podcastDurationOverrides[title];
  };

  const normalizeBrowseTrack = (track = {}) => {
    const durationOverride = getPodcastDurationOverride(track);
    return {
      id: track.id,
      title: track.title || track.track_name || "Untitled",
      subtitle: track.artist || track.artist_name || "Unknown Artist",
      artist: track.artist || track.artist_name || "Unknown Artist",
      artist_id: track.artist_id,
      album: track.album,
      album_id: track.album_id,
      duration: durationOverride || track.duration,
      cover_url: track.cover_url || track.image_url || track.image,
      type: "track",
      isPodcastOverride: Boolean(durationOverride),
    };
  };

  const uniqueTracks = (tracks) => {
    const seen = new Set();
    return tracks.filter((track) => {
      const key = track.id || `${track.title}-${track.subtitle}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const fetchSearchTracks = async (term, limit = 12) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/search?query=${encodeURIComponent(term)}&filter_by=track`);
      const data = await res.json();
      return Array.isArray(data) ? uniqueTracks(data.map(normalizeBrowseTrack)).slice(0, limit) : [];
    } catch (err) {
      console.error(`Failed to fetch browse tracks for ${term}:`, err);
      return [];
    }
  };

  const fetchChartTracks = async (chartId) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/charts/${chartId}`);
      const data = await res.json();
      return Array.isArray(data.tracks) ? data.tracks.map(normalizeBrowseTrack) : [];
    } catch (err) {
      console.error(`Failed to fetch chart ${chartId}:`, err);
      return [];
    }
  };

  const buildBrowseRows = async (mode) => {
    if (mode === "mood") {
      const moodQueries = [
        ["Happy", "happy"],
        ["Chill", "chill"],
        ["Sad", "sad"],
        ["Focus", "focus"],
        ["Angry", "angry"],
        ["Lonely", "lonely"],
      ];
      const rows = await Promise.all(
        moodQueries.map(async ([title, term]) => ({
          title,
          items: await fetchSearchTracks(term, 10),
        }))
      );
      return rows;
    }

    if (mode === "charts") {
      const [globalTracks, vietnamTracks] = await Promise.all([
        fetchChartTracks("top-songs-global"),
        fetchChartTracks("top-songs-vietnam"),
      ]);
      return [
        { title: "Top Songs - Global", items: globalTracks.slice(0, 12), action: "/chart/top-songs-global" },
        { title: "Top Songs - Vietnam", items: vietnamTracks.slice(0, 12), action: "/chart/top-songs-vietnam" },
      ];
    }

    if (mode === "podcasts") {
      const [globalTracks, vietnamTracks, comedyTracks, talkTracks, storyTracks, allTracks] = await Promise.all([
        fetchChartTracks("top-songs-global"),
        fetchChartTracks("top-songs-vietnam"),
        fetchSearchTracks("comedy", 20),
        fetchSearchTracks("talk", 20),
        fetchSearchTracks("story", 20),
        fetchSearchTracks("a", 40),
      ]);
      const longTracks = uniqueTracks([
        ...comedyTracks,
        ...talkTracks,
        ...storyTracks,
        ...globalTracks,
        ...vietnamTracks,
        ...allTracks,
      ]).filter((track) => track.isPodcastOverride || getDurationSeconds(track.duration) > 300);
      return [
        { title: "Podcasts and Long Plays", items: longTracks.slice(0, 12) },
        { title: "More Episodes", items: longTracks.slice(12, 24) },
      ];
    }

    const modeQueries = {
      songs: [["Popular Songs", "love"], ["Fresh Picks", "new"], ["Easy Listening", "chill"]],
      playlists: [["Playlist Starters", "playlist"], ["For Your Library", "mix"], ["Radio Picks", "radio"]],
      chill: [["Chill", "chill"], ["Acoustic", "acoustic"], ["Relax", "relax"]],
      workout: [["Workout", "workout"], ["Energy", "energy"], ["Dance", "dance"]],
      focus: [["Focus", "focus"], ["Study", "study"], ["Calm", "calm"]],
    };

    const rows = await Promise.all(
      (modeQueries[mode] || modeQueries.songs).map(async ([title, term]) => ({
        title,
        items: await fetchSearchTracks(term, 10),
      }))
    );
    return rows;
  };

  useEffect(() => {
    if (!showBrowseCategory) {
      setBrowseRows([]);
      return;
    }

    let isCancelled = false;

    const fetchBrowseCategory = async () => {
      setIsBrowseLoading(true);
      const rows = await buildBrowseRows(browseMode);
      const visibleRows = rows.filter((row) => row.items.length > 0);
      if (!isCancelled) {
        setBrowseRows(visibleRows);
        setIsBrowseLoading(false);
      }
    };

    fetchBrowseCategory();

    return () => {
      isCancelled = true;
    };
  }, [browseMode, showBrowseCategory]);

  const playBrowseTrack = async (track) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(track.title)}`);
      const data = await res.json();
      playSong({
        id: track.id,
        track_name: track.title,
        artist_name: track.artist,
        album: track.album,
        image_url: track.cover_url,
        duration: track.duration,
        mp3_url: data.url,
      });
    } catch (err) {
      console.error("Failed to play browse track:", err);
    }
  };

  const browseTitle = {
    songs: "Songs",
    mood: "Mood",
    charts: "Charts",
    podcasts: "Podcasts",
    playlists: "Playlists",
    chill: "Chill",
    workout: "Workout",
    focus: "Focus",
  }[browseMode] || "Browse";
  const browseBanner = browseBannerMeta[browseMode] || {
    title: browseTitle,
    subtitle: "Explore music from this category.",
    color: "#52616b",
  };

  return (
    <div className="search-results-page">
      <div className="results-container">
        {showBrowse ? (
          <div className="browse-section">
            <div className="browse-header">
              <h1>Browse all</h1>
            </div>
            <div className="browse-grid">
              {browseCategories.map((category) => (
                <button
                  key={category.title}
                  className="browse-card"
                  style={{ backgroundColor: category.color }}
                  type="button"
                  onClick={() => navigate(category.path)}
                >
                  <span className="browse-card-title">{category.title}</span>
                  <span className="browse-card-subtitle">{category.subtitle}</span>
                </button>
              ))}
            </div>
          </div>
        ) : showBrowseCategory ? (
          <div className="browse-section">
            <div className="browse-category-banner" style={{ backgroundColor: browseBanner.color }}>
              <span className="browse-banner-label">Browse</span>
              <h1>{browseBanner.title}</h1>
              <p>{browseBanner.subtitle}</p>
            </div>
            {isBrowseLoading ? (
              <div className="skeleton-table">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className="skeleton-row shimmer" key={i}></div>
                ))}
              </div>
            ) : browseRows.length > 0 ? (
              <div className="browse-row-stack">
                {browseRows.map((row) => (
                  <section className="browse-track-row" key={row.title}>
                    <div className="browse-row-header">
                      <h2>{row.title}</h2>
                      {row.action && (
                        <button type="button" onClick={() => navigate(row.action)}>
                          Show all
                        </button>
                      )}
                    </div>
                    <div className="browse-track-strip">
                      {row.items.map((track) => (
                        <button
                          className="browse-track-card"
                          key={track.id || `${row.title}-${track.title}`}
                          type="button"
                          onClick={() => playBrowseTrack(track)}
                        >
                          <img
                            src={getTrackArtwork(track)}
                            alt={track.title}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = createTrackArtwork(track);
                            }}
                          />
                          <span className="browse-track-title">{track.title}</span>
                          <span className="browse-track-artist">{track.subtitle}</span>
                          {track.duration && <span className="browse-track-duration">{track.duration}</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="search-placeholder">
                <p>No music found for this category yet.</p>
              </div>
            )}
          </div>
        ) : !params.get("query")?.trim() ? (
        <div className="search-placeholder">
          <p>Please enter a keyword in the search box 🔍</p>
        </div>
        ): isLoading ? (
          <div className="skeleton-table">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="skeleton-row shimmer" key={i}></div>
            ))}
          </div>
        ) : filterBy === "emotion" ? (
          <div className="emotion-results">
            {(() => {
              const emotionData = parseEmotionResults();
              if (!emotionData) {
                return <div className="no-results">No emotion analysis available</div>;
              }
              return (
                <>
                  <div className="emotion-response">
                    <div className="emotion-intro">{emotionData.intro}</div>
                    <div className="emotion-mood">
                      <span className="mood-label">Detected Mood:</span>
                      <span className="mood-value">{emotionData.mood}</span>
                    </div>
                  </div>
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
                      {results.map((track, i) => {
                        const isLiked = likedTrackIds.includes(track.id);
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
                                    <FaPlay
                                      className="play-icon-row"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(track.title)}`);
                                          const data = await res.json();
                                          const enriched = {
                                            id: track.id,
                                            track_name: track.title,
                                            artist_name: track.artist,
                                            album: track.album,
                                            image_url: track.cover_url,
                                            duration: track.duration,
                                            mp3_url: data.url,
                                          };
                                          playSong(enriched);
                                        } catch (err) {
                                          console.error("Failed to fetch mp3_url:", err);
                                        }
                                      }}
                                    />
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="track-title-cell col-date">
                              <img 
                                src={getTrackArtwork(track)}
                                alt={track.title} 
                                className="track-image" 
                                onError={(e) => { e.target.onerror = null; e.target.src = createTrackArtwork(track); }}
                              />
                              <div className="track-info">
                                <p className="track-title">{track.title}</p>
                                <span className="track-artist">
                                  {(track.artist?.split(", ") || []).map((name, idx) => {
                                    const ids = track.artist_id?.split(", ");
                                    const artistId = ids?.[idx];
                                    return (
                                      <React.Fragment key={idx}>
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
                                        {idx < track.artist.split(", ").length - 1 && ", "}
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
                                        <div className="playlist-options" onMouseEnter={() => setHoveredTrackId(track.id)}>
                                          {userPlaylists
                                          .filter((pl) => pl.type === "playlist")
                                          .map((pl) => (
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
                </>
              );
            })()}
          </div>
        ) : filterBy === "track" ? (
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
              {results.map((track, i) => {
                const isLiked = likedTrackIds.includes(track.id);
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
                            <FaPlay
                              className="play-icon-row"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(track.title)}`);
                                  const data = await res.json();
                                  const enriched = {
                                    id: track.id,
                                    track_name: track.title,
                                    artist_name: track.artist,
                                    album: track.album,
                                    image_url: track.cover_url,
                                    duration: track.duration,
                                    mp3_url: data.url,
                                  };
                                  playSong(enriched);
                                } catch (err) {
                                  console.error("Failed to fetch mp3_url:", err);
                                }
                              }}
                            />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="track-title-cell col-date">
                      <img 
                        src={getTrackArtwork(track)}
                        alt={track.title} 
                        className="track-image" 
                        onError={(e) => { e.target.onerror = null; e.target.src = createTrackArtwork(track); }}
                      />
                      <div className="track-info">
                        <p className="track-title">{track.title}</p>
                        <span className="track-artist">
                          {(track.artist?.split(", ") || []).map((name, idx) => {
                            const ids = track.artist_id?.split(", ");
                            const artistId = ids?.[idx];
                            return (
                              <React.Fragment key={idx}>
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
                                {idx < track.artist.split(", ").length - 1 && ", "}
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
                                <div className="playlist-options" onMouseEnter={() => setHoveredTrackId(track.id)}>
                                  {userPlaylists
                                  .filter((pl) => pl.type === "playlist")
                                  .map((pl) => (
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
        ) : filterBy === "album" ? (
          <div className="album-grid">
            {results.map((album, index) => {
              const albumTitle = album.name || album.album || album.title || "Untitled Album";
              const artistNames = album.artist_name || album.artist || "";
              const artistIds = album.artist_id ? String(album.artist_id).split(", ") : [];
              return (
              <div key={album.id || `${albumTitle}-${index}`} className="album-card">
                <img 
                  src={getAlbumArtwork(album)}
                  alt={albumTitle} 
                  className="album-cover" 
                  onClick={() => album.id && navigate(`/album/${album.id}`)}
                  style={{cursor: 'pointer'}}
                  onError={(e) => { e.target.onerror = null; e.target.src = createAlbumArtwork(album); }}
                />
                <span className="album-title">
                  <button 
                    onClick={() => album.id && navigate(`/album/${album.id}`)}
                  >
                    {albumTitle}
                  </button>
                </span>
                <span className="album-artist">
                   {(artistNames ? artistNames.split(", ") : []).map((name, i) => (
                    <React.Fragment key={i}>
                      <button 
                        onClick={() => artistIds[i] && navigate(`/artist/${artistIds[i]}`)}
                      >
                        {name}
                      </button>
                      {i < artistNames.split(", ").length - 1 && ", "}
                    </React.Fragment>
                  ))}
                </span>
              </div>
            );
            })}
          </div>
        ) : (
          <div className="artist-grid">
            {results.map((artist) => (
              <div key={artist.id} className="artist-card">
                <img 
                  src={getArtistArtwork(artist)}
                  alt={artist.name} 
                  className="artist-cover" 
                  onClick={() => navigate(`/artist/${artist.id}`)}
                  style={{cursor: 'pointer'}}
                  onError={(e) => { e.target.onerror = null; e.target.src = createArtistArtwork(artist); }}
                />
                <span className="artist-name">
                  <button 
                    onClick={() => navigate(`/artist/${artist.id}`)}
                  >
                    {artist.name}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
