import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaCheck, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../utils/authFetch";
import "../styles/MainContent/AdminSongs.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const STATUS_LABELS = {
  all: "All",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const AdminSongs = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(false);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/music/admin/songs?status=${statusFilter}`);
      const data = await res.json();
      setSongs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load admin songs", err);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, [statusFilter]);

  const reviewSong = async (trackId, status) => {
    let rejectionReason = "";
    if (status === "rejected") {
      rejectionReason = window.prompt("Tell the artist what needs to change before resubmitting.") || "";
      if (!rejectionReason.trim()) return;
    }

    await authFetch(`${API_BASE}/api/music/artist/uploads/${trackId}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejection_reason: rejectionReason }),
    });
    fetchSongs();
  };

  const pendingCount = songs.filter((song) => song.approval_status === "pending").length;

  return (
    <div className="admin-songs-page">
      <header className="admin-songs-header">
        <button type="button" onClick={() => navigate("/database")} className="admin-back-button">
          <FaArrowLeft />
          Database
        </button>
        <div>
          <h1>Song Review</h1>
          <p>Approve artist uploads and manage which songs are visible to listeners.</p>
        </div>
      </header>

      <section className="admin-songs-toolbar">
        <div className="admin-song-stat">
          <span>Pending in this view</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="admin-song-filters">
          {["pending", "all", "approved", "rejected"].map((status) => (
            <button
              type="button"
              key={status}
              className={statusFilter === status ? "active" : ""}
              onClick={() => setStatusFilter(status)}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </section>

      <section className="admin-song-list">
        {loading ? (
          <div className="admin-song-empty">Loading songs...</div>
        ) : songs.length === 0 ? (
          <div className="admin-song-empty">No songs found for this filter.</div>
        ) : (
          songs.map((song) => (
            <article className="admin-song-row" key={song.id}>
              <img src={song.cover_url || "/default_cover.png"} alt={song.title} />
              <div className="admin-song-main">
                <strong>{song.title}</strong>
                <span>{song.artist} - {song.album}</span>
                <small>
                  {song.genre || "No genre"} {song.uploaded_by ? `- uploaded by ${song.uploaded_by}` : "- catalog song"}
                </small>
              </div>
              <div className="admin-song-state">
                <span className={`admin-song-pill admin-song-pill--${song.approval_status}`}>
                  {STATUS_LABELS[song.approval_status] || "Pending"}
                </span>
                <small>{song.is_active ? "Visible" : "Hidden"}</small>
                {song.rejection_reason && <small className="admin-song-reason">{song.rejection_reason}</small>}
              </div>
              <div className="admin-song-actions">
                <button type="button" onClick={() => reviewSong(song.id, "approved")} title="Approve song">
                  <FaCheck />
                  Approve
                </button>
                <button type="button" onClick={() => reviewSong(song.id, "rejected")} title="Reject song">
                  <FaTimes />
                  Reject
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};

export default AdminSongs;
