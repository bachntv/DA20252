import React, { useEffect, useState } from "react";
import SectionScroller from "./SectionScroller";
import RecommendSongs from "./RecommendSongs";
import "../../styles/MainContent/MainContent.css";
import { jwtDecode } from "jwt-decode";
import { authFetch } from '../../utils/authFetch';


const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const MainContent = () => {
  const [playlists, setPlaylists] = useState([]);
  const [savedAlbums, setSavedAlbums] = useState([]);
  const [likedArtists, setLikedArtists] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const token = localStorage.getItem("token");
  const userId = token ? jwtDecode(token).sub : null;

  useEffect(() => {
    if (!userId) return;

    const fetchPlaylists = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user_playlist`);
        const data = await res.json();

        // Separate data by type
        const formatted = await Promise.all(data.map(async (item) => {
          try {
            let image = item.cover_image_url;
            let title = item.name;

            if (item.type === "artist") {
              const res = await fetch(`${API_BASE}/api/music/artist/${item.id}`);
              const data = await res.json();
              image = data.profile_image_url;
              title = data.name;
            } else if (item.type === "single" || item.type === "composite") {
              const res = await fetch(`${API_BASE}/api/music/album/${item.id}`);
              const data = await res.json();
              image = data.cover_image_url;
              title = data.name;
            }

            return {
              id: item.id,
              title: title,
              subtitle: item.owner_name || "",
              image: image,
              type: item.type,
              created_at: item.created_at,
            };
          } catch (err) {
            console.error("Failed to fetch user library:", err);
            return null;
          }
        }));


        setPlaylists(formatted.filter((item) => item.type === "playlist"));
        setSavedAlbums(formatted.filter((item) => item.type === "single" || item.type === "composite"));
        setLikedArtists(formatted.filter((item) => item.type === "artist"));
      } catch (err) {
        console.error("Failed to fetch playlists:", err);
      }
    };

    fetchPlaylists();

    const handlePlaylistUpdate = () => {
      fetchPlaylists();
    };
    window.addEventListener('playlistUpdated', handlePlaylistUpdate);
    return () => window.removeEventListener('playlistUpdated', handlePlaylistUpdate);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const fetchListeningHistory = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/music/user/listening-history`);
        const data = await res.json();
        setRecentHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch listening history:", err);
      }
    };

    fetchListeningHistory();
  }, [userId]);

  return (
    <div className="main-content">
      {recentHistory.length > 0 && <SectionScroller title="Recent Listening" items={recentHistory} />}
      {playlists.length > 0 && <SectionScroller title="Your Playlists" items={playlists} />}
      {savedAlbums.length > 0 && <SectionScroller title="Albums You Saved" items={savedAlbums} />}
      {likedArtists.length > 0 && <SectionScroller title="Artists You Like" items={likedArtists} />}
      <RecommendSongs title="You May Like" />
    </div>
  );
};

export default MainContent;
