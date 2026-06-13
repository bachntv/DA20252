import React, { useEffect, useState } from "react";
import { FaEdit, FaEye, FaMusic, FaTrash, FaUpload } from "react-icons/fa";
import { authFetch } from "../utils/authFetch";
import "../styles/MainContent/ArtistStudio.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const STATUS_LABELS = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Needs changes",
};

const ArtistStudio = () => {
  const [uploads, setUploads] = useState([]);
  const [stats, setStats] = useState({
    uploaded_songs: 0,
    pending_songs: 0,
    approved_songs: 0,
    rejected_songs: 0,
    play_count: 0,
    purchase_count: 0,
  });
  const [formData, setFormData] = useState({
    title: "",
    artistName: "",
    albumName: "Singles",
    genre: "independent",
    lyrics: "",
  });
  const [audioFile, setAudioFile] = useState(null);
  const [coverImage, setCoverImage] = useState(null);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [expandedTrackId, setExpandedTrackId] = useState(null);
  const [deletingTrackId, setDeletingTrackId] = useState(null);

  const fetchUploads = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/music/artist/uploads`);
      const data = await res.json();
      setUploads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch artist uploads", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/music/artist/stats`);
      const data = await res.json();
      setStats(data || {});
    } catch (err) {
      console.error("Failed to fetch artist stats", err);
    }
  };

  useEffect(() => {
    fetchUploads();
    fetchStats();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!audioFile && !editingTrack) {
      setStatus("Choose an MP3 or WAV file before uploading.");
      return;
    }

    const payload = new FormData();
    payload.append("title", formData.title);
    payload.append("artist_name", formData.artistName);
    payload.append("album_name", formData.albumName);
    payload.append("genre", formData.genre);
    payload.append("lyrics", formData.lyrics);
    if (audioFile) payload.append("audio_file", audioFile);
    if (coverImage) payload.append("cover_image", coverImage);

    setIsSubmitting(true);
    setStatus("");
    try {
      const res = await authFetch(
        editingTrack
          ? `${API_BASE}/api/music/artist/uploads/${editingTrack.id}`
          : `${API_BASE}/api/music/artist/uploads`,
        {
        method: editingTrack ? "PUT" : "POST",
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      setStatus(data.message || "Song sent for approval.");
      setFormData({ title: "", artistName: "", albumName: "Singles", genre: "independent", lyrics: "" });
      setAudioFile(null);
      setCoverImage(null);
      setEditingTrack(null);
      event.target.reset();
      fetchUploads();
      fetchStats();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginEdit = (item) => {
    setEditingTrack(item);
    setFormData({
      title: item.title || "",
      artistName: item.artist || "",
      albumName: item.album || "Singles",
      genre: item.genre || "independent",
      lyrics: item.lyrics || "",
    });
    setAudioFile(null);
    setCoverImage(null);
    setStatus("Update the details and resubmit this song for review.");
  };

  const cancelEdit = () => {
    setEditingTrack(null);
    setFormData({ title: "", artistName: "", albumName: "Singles", genre: "independent", lyrics: "" });
    setAudioFile(null);
    setCoverImage(null);
    setStatus("");
  };

  const deleteUpload = async (item) => {
    const confirmed = window.confirm(
      `Delete "${item.title}" permanently? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingTrackId(item.id);
    setStatus("");
    try {
      const res = await authFetch(`${API_BASE}/api/music/artist/uploads/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not delete this song.");

      if (editingTrack?.id === item.id) {
        setEditingTrack(null);
        setFormData({ title: "", artistName: "", albumName: "Singles", genre: "independent", lyrics: "" });
        setAudioFile(null);
        setCoverImage(null);
      }
      setExpandedTrackId((current) => (current === item.id ? null : current));
      setStatus(data.message || "Song deleted successfully.");
      await Promise.all([fetchUploads(), fetchStats()]);
    } catch (err) {
      setStatus(err.message || "Could not delete this song.");
    } finally {
      setDeletingTrackId(null);
    }
  };

  return (
    <div className="artist-studio">
      <section className="artist-studio-header">
        <div>
          <h1>Artist Studio</h1>
          <p>Upload original tracks for admin review before they appear in the public catalog.</p>
        </div>
        <FaMusic />
      </section>

      <section className="artist-stats-grid">
        <div><span>Uploaded songs</span><strong>{stats.uploaded_songs || 0}</strong></div>
        <div><span>Pending</span><strong>{stats.pending_songs || 0}</strong></div>
        <div><span>Approved</span><strong>{stats.approved_songs || 0}</strong></div>
        <div><span>Needs changes</span><strong>{stats.rejected_songs || 0}</strong></div>
        <div><span>Plays</span><strong>{stats.play_count || 0}</strong></div>
        <div><span>Downloads sold</span><strong>{stats.purchase_count || 0}</strong></div>
      </section>

      <section className="artist-upload-panel">
        <div className="artist-panel-heading">
          <h2>{editingTrack ? "Edit & Resubmit Song" : "Upload Song"}</h2>
          {editingTrack && <button type="button" onClick={cancelEdit}>Cancel</button>}
        </div>
        <form onSubmit={submitUpload} className="artist-upload-form">
          <input name="title" value={formData.title} onChange={handleChange} placeholder="Song title" required />
          <input name="artistName" value={formData.artistName} onChange={handleChange} placeholder="Artist name" required />
          <input name="albumName" value={formData.albumName} onChange={handleChange} placeholder="Album or single name" />
          <input name="genre" value={formData.genre} onChange={handleChange} placeholder="Genre" />
          <textarea name="lyrics" value={formData.lyrics} onChange={handleChange} placeholder="Lyrics" />
          <label className="artist-file-input">
            Audio file
            <input type="file" accept="audio/mpeg,audio/mp3,audio/wav" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} required={!editingTrack} />
          </label>
          <label className="artist-file-input">
            Cover image
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCoverImage(e.target.files?.[0] || null)} />
          </label>
          <button type="submit" disabled={isSubmitting}>
            <FaUpload />
            {isSubmitting ? "Sending..." : editingTrack ? "Resubmit for Approval" : "Submit for Approval"}
          </button>
        </form>
        {status && <p className="artist-upload-status">{status}</p>}
      </section>

      <section className="artist-upload-panel">
        <h2>My Uploads</h2>
        <div className="artist-upload-list">
          {uploads.length === 0 ? (
            <div className="artist-empty">No uploaded songs yet.</div>
          ) : (
            uploads.map((item) => (
              <div className="artist-upload-row" key={item.id}>
                <div className="artist-upload-summary">
                  <strong>{item.title}</strong>
                  <span>{item.artist} - {item.album}</span>
                  <small>{item.play_count || 0} plays - {item.purchase_count || 0} downloads sold</small>
                  {item.rejection_reason && <small className="artist-rejection-reason">Reason: {item.rejection_reason}</small>}
                </div>
                <div className="artist-upload-actions">
                  <span className={`upload-status upload-status--${item.approval_status}`}>
                    {STATUS_LABELS[item.approval_status] || "Pending review"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTrackId((current) => (current === item.id ? null : item.id))
                    }
                  >
                    <FaEye />
                    {expandedTrackId === item.id ? "Hide Details" : "View Details"}
                  </button>
                  <button type="button" onClick={() => beginEdit(item)}>
                    <FaEdit />
                    Edit & Resubmit
                  </button>
                  <button
                    type="button"
                    className="artist-delete-button"
                    disabled={deletingTrackId === item.id}
                    onClick={() => deleteUpload(item)}
                  >
                    <FaTrash />
                    {deletingTrackId === item.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
                {expandedTrackId === item.id && (
                  <div className="artist-track-details">
                    <div className="artist-track-facts">
                      <span><strong>Genre:</strong> {item.genre || "Unknown"}</span>
                      <span><strong>Plays:</strong> {item.play_count || 0}</span>
                      <span><strong>Downloads:</strong> {item.purchase_count || 0}</span>
                    </div>
                    <section>
                      <h3>Audio</h3>
                      {item.audio_url ? (
                        <audio controls preload="metadata" src={item.audio_url}>
                          Your browser does not support audio playback.
                        </audio>
                      ) : (
                        <p>No audio file is available.</p>
                      )}
                    </section>
                    <section>
                      <h3>Lyrics</h3>
                      <pre>{item.lyrics?.trim() || "No lyrics were submitted."}</pre>
                    </section>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default ArtistStudio;
