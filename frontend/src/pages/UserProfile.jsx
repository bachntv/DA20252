import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaCamera, FaUserCheck, FaUserPlus } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { authFetch } from "../utils/authFetch";
import "../styles/UserProfile.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const getInitial = (name) => (name || "U").charAt(0).toUpperCase();

const UserAvatar = ({ user, className = "" }) => (
  user?.profile_picture_url ? (
    <img className={`profile-avatar-image ${className}`} src={user.profile_picture_url} alt={user.username} />
  ) : (
    <div className={`profile-avatar-fallback ${className}`}>{getInitial(user?.username)}</div>
  )
);

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/user/profile/${userId}`);
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleProfilePicture = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await authFetch(`${API_BASE}/api/user/me/profile-picture`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      setProfile((current) => current ? { ...current, profile_picture_url: data.profile_picture_url } : current);
      window.dispatchEvent(new Event("profileUpdated"));
    } catch (err) {
      console.error("Failed to update profile picture", err);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const toggleFollow = async () => {
    if (!profile || profile.is_self) return;
    try {
      await authFetch(`${API_BASE}/api/social/users/${profile.id}/follow`, {
        method: profile.is_following ? "DELETE" : "POST",
      });
      fetchProfile();
    } catch (err) {
      console.error("Failed to update follow state", err);
    }
  };

  if (loading) {
    return <div className="user-profile-page"><div className="profile-empty">Loading profile...</div></div>;
  }

  if (!profile) {
    return <div className="user-profile-page"><div className="profile-empty">Profile not found.</div></div>;
  }

  return (
    <div className="user-profile-page">
      <button className="profile-back-button" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>

      <section className="profile-hero">
        <div className="profile-cover" />
        <div className="profile-main-row">
          <div className="profile-avatar-wrap">
            <UserAvatar user={profile} />
            {profile.is_self && (
              <label className="profile-picture-button" title="Change profile picture">
                <FaCamera />
                <input type="file" accept="image/*" onChange={handleProfilePicture} disabled={uploading} />
              </label>
            )}
          </div>
          <div className="profile-title">
            <h1>{profile.username}</h1>
            <p>{profile.roles?.includes("artist") ? "Artist account" : "Music listener"}</p>
          </div>
          {!profile.is_self && (
            <button className="profile-follow-button" onClick={toggleFollow}>
              {profile.is_following ? <FaUserCheck /> : <FaUserPlus />}
              {profile.is_following ? "Following" : "Follow"}
            </button>
          )}
        </div>
      </section>

      <section className="profile-stats">
        <div><strong>{profile.stats.posts}</strong><span>Posts</span></div>
        <div><strong>{profile.stats.followers}</strong><span>Followers</span></div>
        <div><strong>{profile.stats.following}</strong><span>Following</span></div>
        <div><strong>{profile.stats.friends}</strong><span>Friends</span></div>
      </section>

      <section className="profile-posts">
        <h2>Recent posts</h2>
        {profile.recent_posts.length === 0 ? (
          <p className="profile-empty">No posts yet.</p>
        ) : (
          profile.recent_posts.map((post) => (
            <article className="profile-post-card" key={post.id}>
              <p>{post.content}</p>
              {post.media_type === "video" && post.media_url ? (
                <video src={post.media_url} controls />
              ) : (post.media_url || post.image_url) && (
                <img src={post.media_url || post.image_url} alt="Profile post" />
              )}
              <span>{new Date(post.created_at).toLocaleString()}</span>
            </article>
          ))
        )}
      </section>
    </div>
  );
};

export default UserProfile;
