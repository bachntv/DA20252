import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaBan, FaCamera, FaPaperPlane, FaPhotoVideo, FaPlus, FaUserCheck, FaUserPlus, FaVolumeMute } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [storyDraft, setStoryDraft] = useState("");
  const [storyType, setStoryType] = useState("story");
  const [storyMedia, setStoryMedia] = useState(null);
  const [isBannerEditorOpen, setIsBannerEditorOpen] = useState(false);
  const [activeStatList, setActiveStatList] = useState(null);
  const [activeProfileTab, setActiveProfileTab] = useState(() => {
    const requestedTab = new URLSearchParams(location.search).get("tab");
    return requestedTab === "message" ? "posts" : requestedTab || "posts";
  });

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

  const updateLocalUser = (user) => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new Event("profileUpdated"));
    }
  };

  const handleCoverPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await authFetch(`${API_BASE}/api/user/me/cover-photo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      updateLocalUser(data.user);
      setProfile((current) => current ? { ...current, cover_photo_url: data.cover_photo_url } : current);
    } catch (err) {
      console.error("Failed to update cover photo", err);
    } finally {
      event.target.value = "";
    }
  };

  const createProfilePost = async () => {
    if (!postDraft.trim() && !postMedia) return;

    try {
      if (postMedia) {
        const formData = new FormData();
        formData.append("content", postDraft);
        formData.append("media", postMedia);
        await authFetch(`${API_BASE}/api/social/posts/photo`, { method: "POST", body: formData });
      } else {
        await authFetch(`${API_BASE}/api/social/posts`, {
          method: "POST",
          body: JSON.stringify({ content: postDraft }),
        });
      }
      setPostDraft("");
      setPostMedia(null);
      fetchProfile();
    } catch (err) {
      console.error("Failed to post from profile", err);
    }
  };

  const createProfileStory = async () => {
    if (!storyDraft.trim() && !storyMedia) return;

    try {
      const formData = new FormData();
      formData.append("content", storyDraft);
      formData.append("story_type", storyType);
      if (storyMedia) formData.append("media", storyMedia);
      await authFetch(`${API_BASE}/api/social/stories/photo`, { method: "POST", body: formData });
      setStoryDraft("");
      setStoryMedia(null);
      setStoryType("story");
    } catch (err) {
      console.error("Failed to create story from profile", err);
    }
  };

  const toggleMute = async () => {
    if (!profile || profile.is_self) return;
    try {
      await authFetch(`${API_BASE}/api/social/users/${profile.id}/mute`, {
        method: profile.is_muted ? "DELETE" : "POST",
      });
      fetchProfile();
    } catch (err) {
      console.error("Failed to update mute state", err);
    }
  };

  const toggleBlock = async () => {
    if (!profile || profile.is_self) return;
    try {
      await authFetch(`${API_BASE}/api/social/users/${profile.id}/block`, {
        method: profile.is_blocked ? "DELETE" : "POST",
      });
      fetchProfile();
    } catch (err) {
      console.error("Failed to update block state", err);
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

  const statItems = [
    { key: "posts", label: "Posts", value: profile.stats.posts },
    { key: "owned_songs", label: "Songs owned", value: profile.stats.owned_songs },
    { key: "followers", label: "Followers", value: profile.stats.followers },
    { key: "following", label: "Following", value: profile.stats.following },
    { key: "friends", label: "Friends", value: profile.stats.friends },
  ];
  const activeStat = statItems.find((item) => item.key === activeStatList);
  const activeListItems = activeStat ? profile.profile_lists?.[activeStat.key] || [] : [];

  const renderStatListItem = (item) => {
    if (["followers", "following", "friends"].includes(activeStatList)) {
      return (
        <button className="profile-stat-list-row" key={item.id} onClick={() => { setActiveStatList(null); navigate(`/profile/${item.id}`); }}>
          <UserAvatar user={item} className="profile-stat-avatar" />
          <div>
            <strong>{item.username}</strong>
            <span>{item.roles?.includes("artist") ? "Artist account" : "Music listener"}</span>
          </div>
        </button>
      );
    }

    if (activeStatList === "owned_songs") {
      return (
        <div className="profile-stat-list-row" key={item.id}>
          {item.cover_url ? <img src={item.cover_url} alt={item.title} /> : <div className="profile-stat-art">{item.title?.[0]?.toUpperCase() || "S"}</div>}
          <div>
            <strong>{item.title}</strong>
            <span>{item.artist || "Owned song"}</span>
          </div>
        </div>
      );
    }

    if (activeStatList === "playlists") {
      return (
        <div className="profile-stat-list-row" key={item.id}>
          {item.cover_image_url ? <img src={item.cover_image_url} alt={item.name} /> : <div className="profile-stat-art">{item.name?.[0]?.toUpperCase() || "P"}</div>}
          <div>
            <strong>{item.name}</strong>
            <span>{item.track_count} songs</span>
          </div>
        </div>
      );
    }

    return (
      <div className="profile-stat-list-row" key={item.id}>
        <div className="profile-stat-art">{item.content?.[0]?.toUpperCase() || "P"}</div>
        <div>
          <strong>{item.content || "Post"}</strong>
          <span>{new Date(item.created_at).toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="user-profile-page">
      <button className="profile-back-button" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>

      <section className="profile-hero">
        <div
          className="profile-cover"
          style={{
            backgroundImage: profile.cover_photo_url ? `url(${profile.cover_photo_url})` : undefined,
          }}
        >
          {profile.is_self && (
            <div className="profile-cover-actions">
              <button className="edit-banner-button" onClick={() => setIsBannerEditorOpen((current) => !current)}>
                <FaCamera /> Edit banner
              </button>
              {isBannerEditorOpen && (
                <div className="banner-editor-menu">
                  <label>
                    <FaPhotoVideo /> Change photo
                    <input type="file" accept="image/*" onChange={handleCoverPhoto} />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
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
            <div className="profile-action-row">
              <button className="profile-follow-button" onClick={toggleFollow}>
                {profile.is_following ? <FaUserCheck /> : <FaUserPlus />}
                {profile.is_following ? "Following" : "Follow"}
              </button>
              <button className="profile-follow-button" onClick={toggleMute}>
                <FaVolumeMute /> {profile.is_muted ? "Unmute" : "Mute"}
              </button>
              <button className="profile-follow-button danger" onClick={toggleBlock}>
                <FaBan /> {profile.is_blocked ? "Unblock" : "Block"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="profile-tabs">
        <button className={activeProfileTab === "posts" ? "active" : ""} onClick={() => setActiveProfileTab("posts")}>Posts</button>
        <button className={activeProfileTab === "playlists" ? "active" : ""} onClick={() => setActiveProfileTab("playlists")}>Playlists</button>
        {profile.is_self ? (
          <>
            <button className={activeProfileTab === "create" ? "active" : ""} onClick={() => setActiveProfileTab("create")}>Create</button>
          </>
        ) : (
          null
        )}
      </section>

      {profile.is_self && activeProfileTab === "create" && (
        <section className="profile-tools">
          <div className="profile-composer-card">
            <h2>Create post</h2>
            <textarea value={postDraft} onChange={(event) => setPostDraft(event.target.value)} placeholder="What's on your mind?" />
            <div className="profile-tool-actions">
              <label><FaPhotoVideo /> Photo/video<input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(event) => setPostMedia(event.target.files?.[0] || null)} /></label>
              <button onClick={createProfilePost}><FaPaperPlane /> Post</button>
            </div>
          </div>
          <div className="profile-composer-card">
            <h2>Create story or reel</h2>
            <textarea value={storyDraft} onChange={(event) => setStoryDraft(event.target.value)} placeholder="Share a story or reel" />
            <div className="story-type-row">
              <button className={storyType === "story" ? "active" : ""} onClick={() => setStoryType("story")}>Story</button>
              <button className={storyType === "reel" ? "active" : ""} onClick={() => setStoryType("reel")}>Reel</button>
            </div>
            <div className="profile-tool-actions">
              <label><FaPlus /> Media<input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(event) => setStoryMedia(event.target.files?.[0] || null)} /></label>
              <button onClick={createProfileStory}><FaPaperPlane /> Share</button>
            </div>
          </div>
        </section>
      )}

      {activeProfileTab === "playlists" && (
        <section className="profile-playlists">
          <h2>Playlists</h2>
          {profile.playlists.length === 0 ? (
            <p className="profile-empty">No playlists yet.</p>
          ) : (
            <div className="profile-playlist-grid">
              {profile.playlists.map((playlist) => (
                <article className="profile-playlist-card" key={playlist.id}>
                  {playlist.cover_image_url ? <img src={playlist.cover_image_url} alt={playlist.name} /> : <div>{playlist.name[0]?.toUpperCase()}</div>}
                  <strong>{playlist.name}</strong>
                  <span>{playlist.track_count} songs</span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="profile-stats">
        {statItems.map((item) => (
          <button key={item.key} onClick={() => setActiveStatList(item.key)}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </section>

      {activeProfileTab === "posts" && (
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
      )}

      {activeStat && (
        <section
          className="profile-stat-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveStatList(null);
          }}
        >
          <div className="profile-stat-modal">
            <header>
              <div>
                <h2>{activeStat.label}</h2>
                <span>{activeStat.value} total</span>
              </div>
              <button onClick={() => setActiveStatList(null)}>Close</button>
            </header>
            <div className="profile-stat-list">
              {activeListItems.length === 0 ? (
                <p className="profile-empty">Nothing to show yet.</p>
              ) : (
                activeListItems.map(renderStatListItem)
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default UserProfile;
