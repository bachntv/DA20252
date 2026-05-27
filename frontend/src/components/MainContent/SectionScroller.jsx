import React from "react";
import { useNavigate } from 'react-router-dom';
import "../../styles/SectionScroller.css";
import { createAlbumArtwork, createArtistArtwork, createTrackArtwork, getArtworkPalette } from "../../utils/artwork";
import { usePlayer } from "../../context/PlayerContext";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const svgDataUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const createChartArtwork = (item = {}) => {
  const [primary, secondary, text] = getArtworkPalette(item.id || item.title);
  const title = item.title || "Top Songs";
  const [lineOne, lineTwo = "Chart"] = title.replace(" - ", "|").split("|");

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="chartBg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${primary}"/>
          <stop offset="100%" stop-color="${secondary}"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" rx="28" fill="url(#chartBg)"/>
      <circle cx="338" cy="64" r="86" fill="#fff" opacity="0.16"/>
      <circle cx="62" cy="342" r="128" fill="#000" opacity="0.14"/>
      <rect x="46" y="52" width="92" height="12" rx="6" fill="${text}" opacity="0.75"/>
      <text x="44" y="184" fill="${text}" font-family="Arial, sans-serif" font-size="54" font-weight="900">${lineOne}</text>
      <text x="44" y="244" fill="${text}" font-family="Arial, sans-serif" font-size="48" font-weight="900">${lineTwo}</text>
      <text x="46" y="328" fill="${text}" opacity="0.78" font-family="Arial, sans-serif" font-size="22" font-weight="800">FEATURED CHART</text>
    </svg>
  `);
};

const getSectionArtwork = (item) => {
  if (item.image || item.cover_url || item.image_url) {
    return item.image || item.cover_url || item.image_url;
  }

  if (item.type === "artist") {
    return createArtistArtwork({ id: item.id, name: item.title });
  }

  if (item.type === "single" || item.type === "composite" || item.type === "album") {
    return createAlbumArtwork({ id: item.id, name: item.title, artist_name: item.subtitle });
  }

  if (item.type === "track") {
    return createTrackArtwork({ id: item.id, title: item.title, artist: item.subtitle });
  }

  if (item.type === "radio" || item.type === "chart") {
    if (item.type === "chart") {
      return createChartArtwork(item);
    }
    return createTrackArtwork({ id: item.id, title: item.title, artist: item.subtitle });
  }

  return "/default_cover.png";
};

const SectionScroller = ({ title, items, variant }) => {
  const navigate = useNavigate();
  const { playSong } = usePlayer();

  const playTrack = async (item) => {
    try {
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(item.title)}`);
      const data = await res.json();
      playSong({
        id: item.id,
        track_name: item.title,
        artist_name: item.artist || item.subtitle,
        image_url: item.image || item.cover_url,
        mp3_url: data.url,
      });
    } catch (err) {
      console.error("Failed to play chart track:", err);
    }
  };

  const openItem = (item) => {
    if (item.type === "track") {
      playTrack(item);
      return;
    }

    if (item.type === "chart") {
      navigate(`/chart/${item.id}`);
      return;
    }

    if (item.type === "radio") {
      return;
    }

    const type = (item.type === "single" || item.type === "composite") ? "album" : item.type;
    navigate(`/${type}/${item.id}`);
  };

  return (
    <div className="section-scroller">
      <h3>{title}</h3>
      <div className="card-row">
        {items.map((item, index) => (
          <div
          className={`music-card ${variant === "artist" || item.type === "artist" ? "artist-card-shape" : ""}`}
          key={index}
          onClick={() => openItem(item)}
        >
        
            <img 
              src={getSectionArtwork(item)}
              alt={item.title} 
              onError={(e) => { e.target.onerror = null; e.target.src = getSectionArtwork({ ...item, image: null, cover_url: null, image_url: null }); }}
            />
            <p className="title">{item.title}</p>
            <p className="subtitle">{item.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectionScroller;
