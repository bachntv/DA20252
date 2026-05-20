import React from "react";
import { useNavigate } from 'react-router-dom';
import "../../styles/SectionScroller.css";
import { createAlbumArtwork, createArtistArtwork, createTrackArtwork } from "../../utils/artwork";

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

  return "/default_cover.png";
};

const SectionScroller = ({ title, items }) => {
  const navigate = useNavigate();
  return (
    <div className="section-scroller">
      <h3>{title}</h3>
      <div className="card-row">
        {items.map((item, index) => (
          <div
          className="music-card"
          key={index}
          onClick={() => {
            if (item.type === "track") {
              return;
            }
            const type = (item.type === "single" || item.type === "composite") ? "album" : item.type;
            navigate(`/${type}/${item.id}`);
          }}
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
