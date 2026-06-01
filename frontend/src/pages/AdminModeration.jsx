import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaBan, FaEye, FaEyeSlash, FaUndo } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../utils/authFetch";
import "../styles/MainContent/AdminModeration.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const AdminModeration = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [tab, setTab] = useState("users");
  const [loading, setLoading] = useState(false);

  const fetchModeration = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/music/admin/moderation`);
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
      setArtists(Array.isArray(data.artists) ? data.artists : []);
      setAlbums(Array.isArray(data.albums) ? data.albums : []);
    } catch (err) {
      console.error("Failed to fetch moderation data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModeration();
  }, []);

  const moderateUser = async (userId, action) => {
    await authFetch(`${API_BASE}/api/music/admin/users/${userId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchModeration();
  };

  const moderateArtist = async (artistId, action) => {
    await authFetch(`${API_BASE}/api/music/admin/artists/${artistId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchModeration();
  };

  const moderateAlbum = async (albumId, action) => {
    await authFetch(`${API_BASE}/api/music/admin/albums/${albumId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchModeration();
  };

  const albumsByArtist = albums.reduce((groups, album) => {
    const artistName = album.artist_names || "Unknown Artist";
    if (!groups[artistName]) groups[artistName] = [];
    groups[artistName].push(album);
    return groups;
  }, {});

  return (
    <div className="admin-moderation-page">
      <header className="admin-moderation-header">
        <button type="button" onClick={() => navigate("/database")}>
          <FaArrowLeft />
          Database
        </button>
        <div>
          <h1>User & Artist Moderation</h1>
          <p>Mute social activity, disable accounts, and hide artists from the catalog.</p>
        </div>
      </header>

      <div className="moderation-tabs">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Users</button>
        <button className={tab === "artists" ? "active" : ""} onClick={() => setTab("artists")}>Artists</button>
        <button className={tab === "albums" ? "active" : ""} onClick={() => setTab("albums")}>Albums</button>
      </div>

      {loading ? (
        <div className="moderation-empty">Loading...</div>
      ) : tab === "users" ? (
        <section className="moderation-list">
          {users.map((user) => (
            <article className="moderation-row" key={user.id}>
              <div>
                <strong>{user.username}</strong>
                <span>{user.email}</span>
                <small>{user.roles} - {user.account_type}</small>
              </div>
              <div className="moderation-statuses">
                <span className={user.is_active ? "status-good" : "status-danger"}>{user.is_active ? "Active" : "Kicked"}</span>
                <span className={user.is_muted ? "status-warn" : "status-good"}>{user.is_muted ? "Muted" : "Can post"}</span>
              </div>
              <div className="moderation-actions">
                <button onClick={() => moderateUser(user.id, user.is_muted ? "unmute" : "mute")}>
                  {user.is_muted ? <FaUndo /> : <FaBan />}
                  {user.is_muted ? "Unmute" : "Mute"}
                </button>
                <button onClick={() => moderateUser(user.id, user.is_active ? "kick" : "restore")}>
                  {user.is_active ? <FaEyeSlash /> : <FaEye />}
                  {user.is_active ? "Kick" : "Restore"}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : tab === "artists" ? (
        <section className="moderation-list">
          {artists.map((artist) => (
            <article className="moderation-row" key={artist.id}>
              <img src={artist.image_url || "/default_cover.png"} alt={artist.name} />
              <div>
                <strong>{artist.name}</strong>
                <span>{artist.followers} followers</span>
                <small>{artist.owner_user_id ? "Artist account linked" : "Catalog artist"}</small>
              </div>
              <div className="moderation-statuses">
                <span className={artist.is_active ? "status-good" : "status-danger"}>{artist.is_active ? "Visible" : "Hidden"}</span>
              </div>
              <div className="moderation-actions">
                <button onClick={() => moderateArtist(artist.id, artist.is_active ? "hide" : "show")}>
                  {artist.is_active ? <FaEyeSlash /> : <FaEye />}
                  {artist.is_active ? "Hide" : "Show"}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="moderation-list">
          {Object.entries(albumsByArtist).map(([artistName, artistAlbums]) => (
            <section className="moderation-group" key={artistName}>
              <div className="moderation-group-header">
                <strong>{artistName}</strong>
                <span>{artistAlbums.length} album{artistAlbums.length === 1 ? "" : "s"}</span>
              </div>
              {artistAlbums.map((album) => (
                <article className="moderation-row" key={album.id}>
                  <img src={album.image_url || "/default_cover.png"} alt={album.name} />
                  <div>
                    <strong>{album.name}</strong>
                    <span>{album.type || "Album"}</span>
                    <small>{album.release_date || "No release date"}</small>
                  </div>
                  <div className="moderation-statuses">
                    <span className={album.is_active ? "status-good" : "status-danger"}>{album.is_active ? "Visible" : "Hidden"}</span>
                  </div>
                  <div className="moderation-actions">
                    <button onClick={() => moderateAlbum(album.id, album.is_active ? "hide" : "show")}>
                      {album.is_active ? <FaEyeSlash /> : <FaEye />}
                      {album.is_active ? "Hide" : "Show"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </section>
      )}
    </div>
  );
};

export default AdminModeration;
