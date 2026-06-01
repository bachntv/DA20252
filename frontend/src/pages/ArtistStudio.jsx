import React, { useEffect, useState } from "react";
import { FaMusic, FaUpload } from "react-icons/fa";
import { authFetch } from "../utils/authFetch";
import "../styles/MainContent/ArtistStudio.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const ArtistStudio = () => {
  const [uploads, setUploads] = useState([]);
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

  const fetchUploads = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/music/artist/uploads`);
      const data = await res.json();
      setUploads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch artist uploads", err);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!audioFile) {
      setStatus("Choose an MP3 or WAV file before uploading.");
      return;
    }

    const payload = new FormData();
    payload.append("title", formData.title);
    payload.append("artist_name", formData.artistName);
    payload.append("album_name", formData.albumName);
    payload.append("genre", formData.genre);
    payload.append("lyrics", formData.lyrics);
    payload.append("audio_file", audioFile);
    if (coverImage) payload.append("cover_image", coverImage);

    setIsSubmitting(true);
    setStatus("");
    try {
      const res = await authFetch(`${API_BASE}/api/music/artist/uploads`, {
        method: "POST",
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      setStatus(data.message || "Song uploaded for approval.");
      setFormData({ title: "", artistName: "", albumName: "Singles", genre: "independent", lyrics: "" });
      setAudioFile(null);
      setCoverImage(null);
      event.target.reset();
      fetchUploads();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsSubmitting(false);
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

      <section className="artist-upload-panel">
        <h2>Upload Song</h2>
        <form onSubmit={submitUpload} className="artist-upload-form">
          <input name="title" value={formData.title} onChange={handleChange} placeholder="Song title" required />
          <input name="artistName" value={formData.artistName} onChange={handleChange} placeholder="Artist name" required />
          <input name="albumName" value={formData.albumName} onChange={handleChange} placeholder="Album or single name" />
          <input name="genre" value={formData.genre} onChange={handleChange} placeholder="Genre" />
          <textarea name="lyrics" value={formData.lyrics} onChange={handleChange} placeholder="Lyrics" />
          <label className="artist-file-input">
            Audio file
            <input type="file" accept="audio/mpeg,audio/mp3,audio/wav" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} required />
          </label>
          <label className="artist-file-input">
            Cover image
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCoverImage(e.target.files?.[0] || null)} />
          </label>
          <button type="submit" disabled={isSubmitting}>
            <FaUpload />
            {isSubmitting ? "Uploading..." : "Submit for Approval"}
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
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.artist} - {item.album}</span>
                </div>
                <span className={`upload-status upload-status--${item.approval_status}`}>
                  {item.approval_status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default ArtistStudio;
