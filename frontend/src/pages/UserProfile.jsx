import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaCamera, FaChevronLeft, FaChevronRight, FaGlobeAmericas, FaLock, FaPaperPlane, FaPhotoVideo, FaPlay, FaPlus, FaUserCheck, FaUserFriends, FaUserPlus } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import SocialPostCard from "../components/SocialPostCard";
import { authFetch } from "../utils/authFetch";
import { createTrackArtwork, getTrackArtwork } from "../utils/artwork";
import "../styles/UserProfile.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const getInitial = (name) => (name || "U").charAt(0).toUpperCase();

const AUDIENCE_OPTIONS = [
  { value: "public", label: "Public", icon: <FaGlobeAmericas /> },
  { value: "friends", label: "Friends", icon: <FaUserFriends /> },
  { value: "private", label: "Only me", icon: <FaLock /> },
];

const UserAvatar = ({ user, className = "", story, onStoryClick }) => {
  const ringClass = story ? ` profile-story-ring ${story.is_seen ? "seen" : "unseen"}` : "";
  const avatar = user?.profile_picture_url ? (
    <img className={`profile-avatar-image ${className}`} src={user.profile_picture_url} alt={user.username} />
  ) : (
    <div className={`profile-avatar-fallback ${className}`}>{getInitial(user?.username)}</div>
  );

  if (!story) return avatar;

  return (
    <button className={`profile-avatar-story-button${ringClass}`} onClick={onStoryClick} title="Open story">
      {avatar}
    </button>
  );
};

const UserProfile = () => {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [postAudience, setPostAudience] = useState("public");
  const [storyDraft, setStoryDraft] = useState("");
  const [storyType, setStoryType] = useState("story");
  const [storyMedia, setStoryMedia] = useState(null);
  const [storyAudience, setStoryAudience] = useState("public");
  const [isBannerEditorOpen, setIsBannerEditorOpen] = useState(false);
  const [activeStatList, setActiveStatList] = useState(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [activeProfileTab, setActiveProfileTab] = useState(() => {
    const requestedTab = new URLSearchParams(location.search).get("tab");
    return requestedTab === "message" ? "posts" : requestedTab || "posts";
  });

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, postsRes] = await Promise.all([
        authFetch(`${API_BASE}/api/user/profile/${userId}`),
        authFetch(`${API_BASE}/api/social/users/${userId}/posts`),
      ]);
      const [profileData, postsData] = await Promise.all([profileRes.json(), postsRes.json()]);
      setProfile(profileData);
      setProfilePosts(Array.isArray(postsData) ? postsData : []);
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
      if (data.user && data.user.id === profile?.id) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("authUser", JSON.stringify(data.user));
      }
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
    if (user && user.id === profile?.id) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("authUser", JSON.stringify(user));
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
        formData.append("audience", postAudience);
        await authFetch(`${API_BASE}/api/social/posts/photo`, { method: "POST", body: formData });
      } else {
        await authFetch(`${API_BASE}/api/social/posts`, {
          method: "POST",
          body: JSON.stringify({ content: postDraft, audience: postAudience }),
        });
      }
      setPostDraft("");
      setPostMedia(null);
      setPostAudience("public");
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
      formData.append("audience", storyAudience);
      if (storyMedia) formData.append("media", storyMedia);
      await authFetch(`${API_BASE}/api/social/stories/photo`, { method: "POST", body: formData });
      setStoryDraft("");
      setStoryMedia(null);
      setStoryType("story");
      setStoryAudience("public");
      fetchProfile();
    } catch (err) {
      console.error("Failed to create story from profile", err);
    }
  };

  const markProfileStorySeen = useCallback(async (story) => {
    if (!story || story.story_type !== "story" || story.is_seen) return;
    try {
      await authFetch(`${API_BASE}/api/social/stories/${story.id}/view`, { method: "POST" });
      setProfile((current) => current ? {
        ...current,
        stories: (current.stories || []).map((item) => item.id === story.id ? { ...item, is_seen: true } : item),
      } : current);
    } catch (err) {
      console.error("Failed to mark profile story as seen", err);
    }
  }, []);

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

  const openPostAuthor = (author, event) => {
    event?.stopPropagation();
    if (author?.id) navigate(`/profile/${author.id}`);
  };

  const shareProfilePost = async (post) => {
    const content = window.prompt("Add a message to this shared post:", "Shared a post");
    if (content === null) return;

    try {
      await authFetch(`${API_BASE}/api/social/posts/${post.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      fetchProfile();
    } catch (err) {
      console.error("Failed to share profile post", err);
    }
  };

  const renderPostTrack = (track) => {
    if (!track) return null;
    return (
      <div className="social-track static-track">
        <img
          src={getTrackArtwork(track)}
          alt={track.title}
          onError={(event) => {
            event.target.onerror = null;
            event.target.src = createTrackArtwork(track);
          }}
        />
        <div>
          <p>{track.title}</p>
          <span>{track.duration || "Song"}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="user-profile-page"><div className="profile-empty">Loading profile...</div></div>;
  }

  if (!profile) {
    return <div className="user-profile-page"><div className="profile-empty">Profile not found.</div></div>;
  }

  const profileStories = profile.stories || [];
  const profileStoryItems = profileStories.filter((item) => item.story_type === "story");
  const profileReelItems = profileStories.filter((item) => item.story_type === "reel");
  const storyRingItem = profileStoryItems.find((item) => !item.is_seen) || profileStoryItems[0];
  const activeStory = activeStoryIndex !== null ? profileStories[activeStoryIndex] : null;

  const openProfileStory = (story) => {
    const index = profileStories.findIndex((item) => item.id === story.id);
    if (index >= 0) {
      setActiveStoryIndex(index);
      markProfileStorySeen(profileStories[index]);
    }
  };

  const moveProfileStory = (direction) => {
    setActiveStoryIndex((current) => {
      if (current === null || profileStories.length === 0) return current;
      const next = (current + direction + profileStories.length) % profileStories.length;
      markProfileStorySeen(profileStories[next]);
      return next;
    });
  };

  const renderStoryMedia = (story) => {
    if (!story) return null;
    const mediaUrl = story.media_url || story.image_url;
    if (!mediaUrl) {
      return <div className="profile-story-text-only">{story.content || "Story"}</div>;
    }
    if (story.media_type === "video") {
      return <video src={mediaUrl} controls autoPlay={story.story_type === "story"} />;
    }
    return <img src={mediaUrl} alt={story.story_type === "reel" ? "Profile reel" : "Profile story"} />;
  };

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
            <UserAvatar user={profile} story={storyRingItem} onStoryClick={() => openProfileStory(storyRingItem)} />
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
            </div>
          )}
        </div>
      </section>

      {(profileStoryItems.length > 0 || profileReelItems.length > 0) && (
        <section className="profile-media-strip">
          {profileStoryItems.length > 0 && (
            <div className="profile-media-group">
              <h2>Stories</h2>
              <div className="profile-media-row">
                {profileStoryItems.map((story) => (
                  <button className={`profile-media-card ${story.is_seen ? "seen" : "unseen"}`} key={story.id} onClick={() => openProfileStory(story)}>
                    <span>{renderStoryMedia(story)}</span>
                    <strong>{story.content || "Story"}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}
          {profileReelItems.length > 0 && (
            <div className="profile-media-group">
              <h2>Reels</h2>
              <div className="profile-media-row">
                {profileReelItems.map((reel) => (
                  <button className="profile-media-card reel" key={reel.id} onClick={() => openProfileStory(reel)}>
                    <span>{renderStoryMedia(reel)}<i><FaPlay /></i></span>
                    <strong>{reel.content || "Reel"}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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
            <select className="profile-audience-select" value={postAudience} onChange={(event) => setPostAudience(event.target.value)}>
              {AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
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
            <select className="profile-audience-select" value={storyAudience} onChange={(event) => setStoryAudience(event.target.value)}>
              {AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
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
                <button
                  className="profile-playlist-card"
                  key={playlist.id}
                  onClick={() => navigate(`/playlist/${playlist.id}`)}
                  type="button"
                  aria-label={`Open playlist ${playlist.name}`}
                >
                  <span className="profile-playlist-cover">
                    {playlist.cover_image_url ? <img src={playlist.cover_image_url} alt={playlist.name} /> : <i>{playlist.name[0]?.toUpperCase()}</i>}
                    <b className="profile-playlist-play"><FaPlay /></b>
                  </span>
                  <strong>{playlist.name}</strong>
                  <small>{playlist.track_count} songs · Open playlist</small>
                </button>
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
          {profilePosts.length === 0 ? (
            <p className="profile-empty">No posts yet.</p>
          ) : (
            profilePosts.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                onPostChange={(nextPost) => setProfilePosts((current) => current.map((item) => item.id === nextPost.id ? nextPost : item))}
                onPostDelete={(postId) => {
                  setProfilePosts((current) => current.filter((item) => item.id !== postId));
                  setProfile((current) => current ? {
                    ...current,
                    stats: { ...current.stats, posts: Math.max(0, current.stats.posts - 1) },
                  } : current);
                }}
                onOpenProfile={openPostAuthor}
                onShare={shareProfilePost}
                renderTrack={renderPostTrack}
              />
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

      {activeStory && (
        <section
          className="profile-story-viewer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveStoryIndex(null);
          }}
        >
          <div className="profile-story-viewer">
            <header>
              <div>
                <strong>{activeStory.story_type === "reel" ? "Reel" : "Story"}</strong>
                <span>{new Date(activeStory.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => setActiveStoryIndex(null)}>Close</button>
            </header>
            <div className="profile-story-viewer-media">
              {renderStoryMedia(activeStory)}
            </div>
            {activeStory.content && <p>{activeStory.content}</p>}
            {profileStories.length > 1 && (
              <>
                <button className="profile-story-nav previous" onClick={() => moveProfileStory(-1)}><FaChevronLeft /></button>
                <button className="profile-story-nav next" onClick={() => moveProfileStory(1)}><FaChevronRight /></button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default UserProfile;
