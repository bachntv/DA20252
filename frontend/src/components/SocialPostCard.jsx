import React, { useState } from "react";
import {
  FaComment,
  FaEdit,
  FaHeart,
  FaPaperPlane,
  FaRegHeart,
  FaSave,
  FaTimes,
  FaTrash,
} from "react-icons/fa";
import { authFetch } from "../utils/authFetch";
import "../styles/MainContent/SocialFeed.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const getInitial = (name) => (name || "U").charAt(0).toUpperCase();

const SocialPostCard = ({
  post,
  onPostChange,
  onPostDelete,
  onOpenProfile,
  onShare,
  renderTrack,
}) => {
  const [commentDraft, setCommentDraft] = useState("");
  const [editingPost, setEditingPost] = useState(false);
  const [editingPostContent, setEditingPostContent] = useState(post.content || "");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");

  const updatePost = (nextPost) => {
    if (nextPost) onPostChange?.(nextPost);
  };

  const toggleLike = async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/social/posts/${post.id}/like`, { method: "POST" });
      const data = await res.json();
      updatePost(data.post);
    } catch (err) {
      console.error("Failed to like post", err);
    }
  };

  const addComment = async () => {
    const content = commentDraft.trim();
    if (!content) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      updatePost(await res.json());
      setCommentDraft("");
    } catch (err) {
      console.error("Failed to comment", err);
    }
  };

  const savePost = async () => {
    const content = editingPostContent.trim();
    if (!content) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      updatePost(await res.json());
      setEditingPost(false);
    } catch (err) {
      console.error("Failed to edit post", err);
    }
  };

  const deletePost = async () => {
    if (!window.confirm("Delete this post?")) return;

    try {
      await authFetch(`${API_BASE}/api/social/posts/${post.id}`, { method: "DELETE" });
      onPostDelete?.(post.id);
    } catch (err) {
      console.error("Failed to delete post", err);
    }
  };

  const saveComment = async (commentId) => {
    const content = editingCommentContent.trim();
    if (!content) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      updatePost(await res.json());
      setEditingCommentId(null);
      setEditingCommentContent("");
    } catch (err) {
      console.error("Failed to edit comment", err);
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/comments/${commentId}`, { method: "DELETE" });
      updatePost(await res.json());
    } catch (err) {
      console.error("Failed to delete comment", err);
    }
  };

  const openProfile = (user, event) => {
    onOpenProfile?.(user, event);
  };

  const avatar = post.author?.profile_picture_url ? (
    <img className="post-avatar avatar-image" src={post.author.profile_picture_url} alt={post.author.username} />
  ) : (
    <div className="post-avatar">{getInitial(post.author?.username)}</div>
  );

  return (
    <article className="post-card">
      <div className="post-header">
        <div className="post-author">
          <button className="avatar-link" onClick={(event) => openProfile(post.author, event)} type="button">
            {avatar}
          </button>
          <div>
            <strong className="profile-name-link" onClick={(event) => openProfile(post.author, event)}>
              {post.author?.username || "Unknown user"}
            </strong>
            <span>
              {new Date(post.created_at).toLocaleString()} ·{" "}
              {post.audience === "friends" ? "Friends" : post.audience === "only_me" || post.audience === "private" ? "Only me" : "Public"}
            </span>
          </div>
        </div>
        {post.is_owner && (
          <div className="owner-actions">
            {editingPost ? (
              <>
                <button onClick={savePost} title="Save post"><FaSave /></button>
                <button onClick={() => setEditingPost(false)} title="Cancel"><FaTimes /></button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditingPostContent(post.content || "");
                    setEditingPost(true);
                  }}
                  title="Edit post"
                >
                  <FaEdit />
                </button>
                <button onClick={deletePost} title="Delete post"><FaTrash /></button>
              </>
            )}
          </div>
        )}
      </div>

      {post.shared_post_id && <div className="shared-label">Shared post</div>}
      {editingPost ? (
        <textarea
          className="post-edit-input"
          value={editingPostContent}
          onChange={(event) => setEditingPostContent(event.target.value)}
        />
      ) : (
        <p className="post-content">{post.content}</p>
      )}

      {post.media_type === "video" && post.media_url ? (
        <video className="post-photo post-video" src={post.media_url} controls />
      ) : (post.media_url || post.image_url) && (
        <img className="post-photo" src={post.media_url || post.image_url} alt="Shared post" />
      )}
      {renderTrack?.(post.track)}

      <div className="post-actions">
        <button className={post.is_liked ? "active" : ""} onClick={toggleLike}>
          {post.is_liked ? <FaHeart /> : <FaRegHeart />} Like {post.like_count || 0}
        </button>
        <button onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}>
          <FaComment /> Comment {post.comment_count || 0}
        </button>
        <button onClick={() => onShare?.(post)}>
          <FaPaperPlane /> Share {post.share_count || 0}
        </button>
      </div>

      <div className="comments">
        {(post.comments || []).map((comment) => (
          <div className="comment" key={comment.id}>
            <div className="comment-body">
              <strong className="profile-name-link" onClick={(event) => openProfile(comment.author, event)}>
                {comment.author?.username || "Unknown user"}
              </strong>
              {editingCommentId === comment.id ? (
                <input
                  value={editingCommentContent}
                  onChange={(event) => setEditingCommentContent(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveComment(comment.id);
                    if (event.key === "Escape") setEditingCommentId(null);
                  }}
                />
              ) : (
                <span>{comment.content}</span>
              )}
            </div>
            {comment.is_owner && (
              <div className="comment-actions">
                {editingCommentId === comment.id ? (
                  <>
                    <button onClick={() => saveComment(comment.id)} title="Save comment"><FaSave /></button>
                    <button onClick={() => setEditingCommentId(null)} title="Cancel"><FaTimes /></button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditingCommentContent(comment.content);
                      }}
                      title="Edit comment"
                    >
                      <FaEdit />
                    </button>
                    <button onClick={() => deleteComment(comment.id)} title="Delete comment"><FaTrash /></button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="comment-input">
          <input
            id={`comment-${post.id}`}
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addComment();
            }}
            placeholder="Write a comment"
          />
          <button onClick={addComment}>Send</button>
        </div>
      </div>
    </article>
  );
};

export default SocialPostCard;
