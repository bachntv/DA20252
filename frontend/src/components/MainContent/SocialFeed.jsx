import React, { useCallback, useEffect, useState } from "react";
import { FaComment, FaHeart, FaRegHeart, FaRetweet, FaUserPlus, FaUserCheck } from "react-icons/fa";
import { authFetch } from "../../utils/authFetch";
import { usePlayer } from "../../context/PlayerContext";
import { createTrackArtwork, getTrackArtwork } from "../../utils/artwork";
import "../../styles/MainContent/SocialFeed.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const SocialFeed = () => {
  const { currentSong } = usePlayer();
  const [scope, setScope] = useState("all");
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [attachSong, setAttachSong] = useState(true);
  const [comments, setComments] = useState({});
  const [shareText, setShareText] = useState({});
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/social/feed?scope=${scope}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch social feed", err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/social/users?q=${encodeURIComponent(userQuery)}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  }, [userQuery]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const createPost = async () => {
    if (!content.trim()) return;
    const payload = {
      content,
      track_id: attachSong && currentSong?.id ? currentSong.id : null,
    };

    try {
      await authFetch(`${API_BASE}/api/social/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setContent("");
      fetchFeed();
    } catch (err) {
      console.error("Failed to create post", err);
    }
  };

  const toggleLike = async (postId) => {
    try {
      const res = await authFetch(`${API_BASE}/api/social/posts/${postId}/like`, { method: "POST" });
      const data = await res.json();
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
    } catch (err) {
      console.error("Failed to like post", err);
    }
  };

  const addComment = async (postId) => {
    const value = comments[postId]?.trim();
    if (!value) return;
    try {
      const res = await authFetch(`${API_BASE}/api/social/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });
      const post = await res.json();
      setPosts((prev) => prev.map((item) => (item.id === postId ? post : item)));
      setComments((prev) => ({ ...prev, [postId]: "" }));
    } catch (err) {
      console.error("Failed to comment", err);
    }
  };

  const sharePost = async (postId) => {
    try {
      const res = await authFetch(`${API_BASE}/api/social/posts/${postId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: shareText[postId] || "Shared a post" }),
      });
      const post = await res.json();
      setPosts((prev) => [post, ...prev]);
      setShareText((prev) => ({ ...prev, [postId]: "" }));
    } catch (err) {
      console.error("Failed to share post", err);
    }
  };

  const toggleFollow = async (user) => {
    try {
      await authFetch(`${API_BASE}/api/social/users/${user.id}/follow`, {
        method: user.is_following ? "DELETE" : "POST",
      });
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, is_following: !item.is_following } : item
        )
      );
      fetchFeed();
    } catch (err) {
      console.error("Failed to follow user", err);
    }
  };

  const renderTrack = (track) => {
    if (!track) return null;
    return (
      <div className="social-track">
        <img
          src={getTrackArtwork(track)}
          alt={track.title}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = createTrackArtwork(track);
          }}
        />
        <div>
          <p>{track.title}</p>
          <span>{track.duration}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="social-page">
      <section className="social-feed">
        <div className="social-topbar">
          <h2>Social Feed</h2>
          <div className="scope-toggle">
            <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>All</button>
            <button className={scope === "following" ? "active" : ""} onClick={() => setScope("following")}>Following</button>
          </div>
        </div>

        <div className="composer">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share what you are listening to..."
          />
          <div className="composer-actions">
            <label>
              <input
                type="checkbox"
                checked={attachSong}
                onChange={(e) => setAttachSong(e.target.checked)}
              />
              Attach current song
            </label>
            <button onClick={createPost}>Post</button>
          </div>
          {attachSong && currentSong && renderTrack({
            id: currentSong.id,
            title: currentSong.track_name || currentSong.title,
            cover_url: currentSong.cover_url || currentSong.image_url,
            duration: currentSong.duration,
          })}
        </div>

        {loading ? (
          <div className="social-empty">Loading feed...</div>
        ) : posts.length === 0 ? (
          <div className="social-empty">No posts yet.</div>
        ) : (
          posts.map((post) => (
            <article className="post-card" key={post.id}>
              <div className="post-header">
                <div className="post-avatar">{post.author.username?.[0]?.toUpperCase()}</div>
                <div>
                  <strong>{post.author.username}</strong>
                  <span>{new Date(post.created_at).toLocaleString()}</span>
                </div>
              </div>
              {post.shared_post_id && <div className="shared-label">Shared post</div>}
              <p className="post-content">{post.content}</p>
              {renderTrack(post.track)}

              <div className="post-actions">
                <button className={post.is_liked ? "active" : ""} onClick={() => toggleLike(post.id)}>
                  {post.is_liked ? <FaHeart /> : <FaRegHeart />} {post.like_count}
                </button>
                <button>
                  <FaComment /> {post.comment_count}
                </button>
                <button onClick={() => sharePost(post.id)}>
                  <FaRetweet /> {post.share_count}
                </button>
              </div>

              <div className="share-row">
                <input
                  value={shareText[post.id] || ""}
                  onChange={(e) => setShareText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  placeholder="Add a note before sharing"
                />
              </div>

              <div className="comments">
                {post.comments.map((comment) => (
                  <div className="comment" key={comment.id}>
                    <strong>{comment.author.username}</strong>
                    <span>{comment.content}</span>
                  </div>
                ))}
                <div className="comment-input">
                  <input
                    value={comments[post.id] || ""}
                    onChange={(e) => setComments((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addComment(post.id);
                    }}
                    placeholder="Write a comment"
                  />
                  <button onClick={() => addComment(post.id)}>Send</button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <aside className="follow-panel">
        <h3>Find people</h3>
        <input
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Search users"
        />
        <div className="user-list">
          {users.map((user) => (
            <div className="user-row" key={user.id}>
              <div className="post-avatar">{user.username?.[0]?.toUpperCase()}</div>
              <span>{user.username}</span>
              <button onClick={() => toggleFollow(user)}>
                {user.is_following ? <FaUserCheck /> : <FaUserPlus />}
                {user.is_following ? "Following" : "Follow"}
              </button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default SocialFeed;
