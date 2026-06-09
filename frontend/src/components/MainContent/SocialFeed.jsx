import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCamera,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaComment,
  FaEdit,
  FaHeart,
  FaMusic,
  FaPaperPlane,
  FaPlus,
  FaRegHeart,
  FaRetweet,
  FaSave,
  FaSearch,
  FaTimes,
  FaTrash,
  FaUserCheck,
  FaUserFriends,
  FaUserPlus,
} from "react-icons/fa";
import { authFetch } from "../../utils/authFetch";
import { usePlayer } from "../../context/PlayerContext";
import { useNavigate } from "react-router-dom";
import MusicPlayer from "../MusicPlayer";
import { createTrackArtwork, getTrackArtwork } from "../../utils/artwork";
import "../../styles/MainContent/SocialFeed.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch (err) {
    return {};
  }
};

const SocialFeed = () => {
  const user = getStoredUser();
  const username = user?.username || "You";
  const navigate = useNavigate();
  const {
    currentSong,
    isPlaying,
    playSong,
    stop,
    nextSong,
    prevSong,
    isShuffleEnabled,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();
  const [scope, setScope] = useState("all");
  const [activeSection, setActiveSection] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [friends, setFriends] = useState({ friends: [], incoming_requests: [], outgoing_requests: [], suggestions: [] });
  const [threads, setThreads] = useState([]);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [content, setContent] = useState("");
  const [attachSong, setAttachSong] = useState(true);
  const [postMediaFile, setPostMediaFile] = useState(null);
  const [postMediaPreview, setPostMediaPreview] = useState("");
  const [postMediaType, setPostMediaType] = useState("");
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState("");
  const [storyMediaType, setStoryMediaType] = useState("");
  const [storyContent, setStoryContent] = useState("");
  const [selectedStoryTrack, setSelectedStoryTrack] = useState(null);
  const [storySongQuery, setStorySongQuery] = useState("");
  const [storySongResults, setStorySongResults] = useState([]);
  const [storyType, setStoryType] = useState("story");
  const [isStoryCreatorOpen, setIsStoryCreatorOpen] = useState(false);
  const [storyCreatorStep, setStoryCreatorStep] = useState("type");
  const [comments, setComments] = useState({});
  const [shareDialogPost, setShareDialogPost] = useState(null);
  const [shareDialogType, setShareDialogType] = useState("post");
  const [shareMode, setShareMode] = useState("feed");
  const [shareFriendId, setShareFriendId] = useState("");
  const [shareDraft, setShareDraft] = useState("");
  const [reelState, setReelState] = useState({});
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingPostContent, setEditingPostContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [likedTrackIds, setLikedTrackIds] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);

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

  const fetchStories = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/social/stories`);
      const data = await res.json();
      setStories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch stories", err);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/social/friends`);
      const data = await res.json();
      setFriends({
        friends: data.friends || [],
        incoming_requests: data.incoming_requests || [],
        outgoing_requests: data.outgoing_requests || [],
        suggestions: data.suggestions || [],
      });
    } catch (err) {
      console.error("Failed to fetch friends", err);
    }
  }, []);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/social/messages/threads`);
      const data = await res.json();
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/social/users?q=${encodeURIComponent(userQuery)}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  }, [userQuery]);

  const fetchLikedTracks = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/music/user/liked_track_ids`);
      const data = await res.json();
      setLikedTrackIds(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch liked tracks", err);
    }
  }, []);

  const fetchUserPlaylists = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/music/user_playlist`);
      const data = await res.json();
      setUserPlaylists(Array.isArray(data) ? data.filter((playlist) => playlist.name !== "Liked Songs") : []);
    } catch (err) {
      console.error("Failed to fetch playlists", err);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    fetchStories();
    fetchFriends();
    fetchThreads();
    fetchLikedTracks();
    fetchUserPlaylists();
  }, [fetchStories, fetchFriends, fetchThreads, fetchLikedTracks, fetchUserPlaylists]);

  useEffect(() => {
    window.addEventListener("socialFeedUpdated", fetchFeed);
    return () => window.removeEventListener("socialFeedUpdated", fetchFeed);
  }, [fetchFeed]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    if (!postMediaFile) {
      setPostMediaPreview("");
      setPostMediaType("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(postMediaFile);
    setPostMediaPreview(previewUrl);
    setPostMediaType(postMediaFile.type.startsWith("video/") ? "video" : "image");
    return () => URL.revokeObjectURL(previewUrl);
  }, [postMediaFile]);

  useEffect(() => {
    if (!storyFile) {
      setStoryPreview("");
      setStoryMediaType("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(storyFile);
    setStoryPreview(previewUrl);
    setStoryMediaType(storyFile.type.startsWith("video/") ? "video" : "image");
    return () => URL.revokeObjectURL(previewUrl);
  }, [storyFile]);

  const refreshSocial = () => {
    fetchFeed();
    fetchStories();
    fetchFriends();
    fetchThreads();
    fetchUsers();
  };

  const createPost = async () => {
    if (!content.trim() && !postMediaFile) return;
    const trackId = attachSong && currentSong?.id ? currentSong.id : null;

    try {
      if (postMediaFile) {
        const formData = new FormData();
        formData.append("content", content);
        if (trackId) formData.append("track_id", trackId);
        formData.append("media", postMediaFile);

        await authFetch(`${API_BASE}/api/social/posts/photo`, {
          method: "POST",
          body: formData,
        });
      } else {
        await authFetch(`${API_BASE}/api/social/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, track_id: trackId }),
        });
      }
      setContent("");
      setPostMediaFile(null);
      refreshSocial();
    } catch (err) {
      console.error("Failed to create post", err);
    }
  };

  const createStory = async () => {
    const trackId = selectedStoryTrack?.id || null;
    if (!storyContent.trim() && !storyFile && !trackId) return;

    try {
      const formData = new FormData();
      formData.append("content", storyContent);
      formData.append("story_type", storyType);
      if (trackId) formData.append("track_id", trackId);
      if (storyFile) formData.append("media", storyFile);
      await authFetch(`${API_BASE}/api/social/stories/photo`, {
        method: "POST",
        body: formData,
      });
      setStoryContent("");
      setStoryFile(null);
      setStoryMediaType("");
      setSelectedStoryTrack(null);
      setStorySongQuery("");
      setStorySongResults([]);
      setStoryType("story");
      setIsStoryCreatorOpen(false);
      setStoryCreatorStep("type");
      fetchStories();
    } catch (err) {
      console.error("Failed to create story", err);
    }
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) return;
    setPostMediaFile(file);
  };

  const handleStoryPhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) return;
    setStoryFile(file);
  };

  const closeStoryCreator = () => {
    setIsStoryCreatorOpen(false);
    setStoryCreatorStep("type");
    setStoryContent("");
    setStoryFile(null);
    setStoryMediaType("");
    setSelectedStoryTrack(null);
    setStorySongQuery("");
    setStorySongResults([]);
    setStoryType("story");
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

  const savePost = async (postId) => {
    const value = editingPostContent.trim();
    if (!value) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });
      const post = await res.json();
      setPosts((prev) => prev.map((item) => (item.id === postId ? post : item)));
      setEditingPostId(null);
      setEditingPostContent("");
    } catch (err) {
      console.error("Failed to edit post", err);
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;

    try {
      await authFetch(`${API_BASE}/api/social/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((item) => item.id !== postId));
    } catch (err) {
      console.error("Failed to delete post", err);
    }
  };

  const saveComment = async (postId, commentId) => {
    const value = editingCommentContent.trim();
    if (!value) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });
      const post = await res.json();
      setPosts((prev) => prev.map((item) => (item.id === postId ? post : item)));
      setEditingCommentId(null);
      setEditingCommentContent("");
    } catch (err) {
      console.error("Failed to edit comment", err);
    }
  };

  const deleteComment = async (postId, commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/comments/${commentId}`, { method: "DELETE" });
      const post = await res.json();
      setPosts((prev) => prev.map((item) => (item.id === postId ? post : item)));
    } catch (err) {
      console.error("Failed to delete comment", err);
    }
  };

  const openShareDialog = (item, type = "post") => {
    setShareDialogPost(item);
    setShareDialogType(type);
    setShareMode("feed");
    setShareFriendId("");
    setShareDraft("");
  };

  const closeShareDialog = () => {
    setShareDialogPost(null);
    setShareDialogType("post");
    setShareMode("feed");
    setShareFriendId("");
    setShareDraft("");
  };

  const sharePost = async () => {
    if (!shareDialogPost?.id) return;

    try {
      if (shareMode === "friend") {
        if (!shareFriendId) return;
        const targetFriend = friends.friends.find((friend) => String(friend.id) === String(shareFriendId));
        const label = shareDialogType === "reel" ? "reel" : "post";
        await authFetch(`${API_BASE}/api/social/messages/${shareFriendId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `${shareDraft.trim() ? `${shareDraft.trim()}\n` : ""}Shared a ${label} from ${shareDialogPost.author?.username || "Social"}.`,
          }),
        });
        if (targetFriend) await openChat(targetFriend);
        closeShareDialog();
        fetchThreads();
        return;
      }

      if (shareDialogType === "reel") {
        const res = await authFetch(`${API_BASE}/api/social/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: shareDraft.trim() || `Shared ${shareDialogPost.author?.username || "someone"}'s reel`,
            track_id: shareDialogPost.track?.id || shareDialogPost.track?.track_id || null,
          }),
        });
        const post = await res.json();
        setPosts((prev) => [post, ...prev]);
        closeShareDialog();
        setActiveSection("feed");
        return;
      }

      const res = await authFetch(`${API_BASE}/api/social/posts/${shareDialogPost.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: shareDraft.trim() || "Shared a post" }),
      });
      const post = await res.json();
      setPosts((prev) => [post, ...prev]);
      closeShareDialog();
      fetchThreads();
    } catch (err) {
      console.error("Failed to share post", err);
    }
  };

  const openFeed = () => {
    setActiveSection("feed");
    fetchFeed();
  };

  const openReels = () => {
    setActiveSection("reels");
    fetchStories();
  };

  const toggleReelLike = (reelId) => {
    setReelState((current) => {
      const reel = current[reelId] || { liked: false, likeCount: 0, comments: [] };
      return {
        ...current,
        [reelId]: {
          ...reel,
          liked: !reel.liked,
          likeCount: Math.max(0, reel.likeCount + (reel.liked ? -1 : 1)),
        },
      };
    });
  };

  const addReelComment = (reelId) => {
    const value = comments[`reel-${reelId}`]?.trim();
    if (!value) return;
    setReelState((current) => {
      const reel = current[reelId] || { liked: false, likeCount: 0, comments: [] };
      return {
        ...current,
        [reelId]: {
          ...reel,
          comments: [...reel.comments, { id: `${Date.now()}`, author: username, content: value }],
        },
      };
    });
    setComments((prev) => ({ ...prev, [`reel-${reelId}`]: "" }));
  };

  const toggleFollow = async (user) => {
    try {
      await authFetch(`${API_BASE}/api/social/users/${user.id}/follow`, {
        method: user.is_following ? "DELETE" : "POST",
      });
      refreshSocial();
    } catch (err) {
      console.error("Failed to follow user", err);
    }
  };

  const requestFriend = async (userId) => {
    try {
      await authFetch(`${API_BASE}/api/social/friends/requests/${userId}`, { method: "POST" });
      refreshSocial();
    } catch (err) {
      console.error("Failed to add friend", err);
    }
  };

  const acceptFriend = async (requestId) => {
    try {
      await authFetch(`${API_BASE}/api/social/friends/requests/${requestId}/accept`, { method: "PUT" });
      refreshSocial();
    } catch (err) {
      console.error("Failed to accept friend request", err);
    }
  };

  const removeFriendRequest = async (requestId) => {
    try {
      await authFetch(`${API_BASE}/api/social/friends/requests/${requestId}`, { method: "DELETE" });
      refreshSocial();
    } catch (err) {
      console.error("Failed to remove friend request", err);
    }
  };

  const openChat = async (user) => {
    if (!user?.id) return;
    setActiveChatUser(user);
    try {
      const res = await authFetch(`${API_BASE}/api/social/messages/${user.id}`);
      const data = await res.json();
      setMessages(data.messages || []);
      fetchThreads();
    } catch (err) {
      console.error("Failed to open chat", err);
    }
  };

  const sendMessage = async () => {
    const value = messageDraft.trim();
    if (!value || !activeChatUser?.id) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/messages/${activeChatUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });
      const message = await res.json();
      setMessages((prev) => [...prev, message]);
      setMessageDraft("");
      fetchThreads();
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleToggleLike = async () => {
    if (!currentSong?.id) return;
    const isLiked = likedTrackIds.includes(currentSong.id);

    try {
      await authFetch(`${API_BASE}/api/music/user/liked_track?track_id=${currentSong.id}`, {
        method: isLiked ? "DELETE" : "POST",
      });
      setLikedTrackIds((prev) => (isLiked ? prev.filter((id) => id !== currentSong.id) : [...prev, currentSong.id]));
    } catch (err) {
      console.error("Failed to toggle like", err);
    }
  };

  const handleAddTrackToPlaylist = async (trackId, playlistId) => {
    try {
      await authFetch(`${API_BASE}/api/music/user/add_track_to_playlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: trackId, playlist_id: playlistId }),
      });
    } catch (err) {
      console.error("Failed to add track to playlist", err);
    }
  };

  const playTrack = useCallback(async (track) => {
    if (!track?.id && !track?.title) return;

    const title = track.track_name || track.title;
    try {
      const res = await fetch(`${API_BASE}/api/music/mp3url/${encodeURIComponent(title)}`);
      const data = await res.json();
      playSong({
        ...track,
        id: track.id || track.track_id,
        track_name: title,
        title,
        artist: track.artist || track.artist_name || "Shared song",
        mp3_url: data.url,
      });
    } catch (err) {
      console.error("Failed to play shared song", err);
    }
  }, [playSong]);

  const renderTrack = (track) => {
    if (!track) return null;
    return (
      <button className="social-track playable-track" onClick={() => playTrack(track)} title="Play this song">
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
          <span>{track.duration || "Song"} · Click to play</span>
        </div>
      </button>
    );
  };

  const renderStaticTrack = (track) => {
    if (!track) return null;
    return (
      <div className="social-track static-track">
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
          <span>{track.duration || "Song"}</span>
        </div>
      </div>
    );
  };

  const renderFriendButton = (user) => {
    const friendship = user.friendship || { status: "none" };
    if (friendship.status === "friends") {
      return <button className="quiet-action"><FaUserCheck /> Friends</button>;
    }
    if (friendship.status === "incoming") {
      return <button onClick={() => acceptFriend(friendship.request_id)}><FaCheck /> Accept</button>;
    }
    if (friendship.status === "outgoing") {
      return <button className="quiet-action" onClick={() => removeFriendRequest(friendship.request_id)}><FaTimes /> Sent</button>;
    }
    return <button onClick={() => requestFriend(user.id)}><FaUserPlus /> Add</button>;
  };

  const currentTrack = useMemo(() => (
    currentSong
      ? {
          id: currentSong.id,
          title: currentSong.track_name || currentSong.title,
          cover_url: currentSong.cover_url || currentSong.image_url,
          duration: currentSong.duration,
          artist: currentSong.artist || currentSong.artist_name,
        }
      : null
  ), [currentSong]);

  const normalizeTrack = (track) => {
    if (!track) return null;
    return {
      ...track,
      id: track.id || track.track_id,
      title: track.title || track.track_name,
      artist: track.artist || track.artist_name,
      cover_url: track.cover_url || track.image_url,
    };
  };

  const storySongOptions = [
    ...(currentTrack ? [{ ...currentTrack, isCurrent: true }] : []),
    ...storySongResults
      .map(normalizeTrack)
      .filter(Boolean)
      .filter((track) => !currentTrack || String(track.id) !== String(currentTrack.id)),
  ];

  useEffect(() => {
    if (!isStoryCreatorOpen || storyCreatorStep !== "edit") return;
    setSelectedStoryTrack((current) => current || currentTrack);
  }, [currentTrack, isStoryCreatorOpen, storyCreatorStep]);

  useEffect(() => {
    if (!isStoryCreatorOpen || storyCreatorStep !== "edit") return undefined;
    const query = storySongQuery.trim();
    if (!query) {
      setStorySongResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/music/search?query=${encodeURIComponent(query)}&filter_by=track`);
        const data = await res.json();
        setStorySongResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to search story songs", err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isStoryCreatorOpen, storyCreatorStep, storySongQuery]);

  const activeStory = activeStoryIndex === null ? null : stories[activeStoryIndex];
  const activeStoryMediaType = activeStory?.media_type || (activeStory?.image_url ? "image" : null);
  const activeStoryMediaUrl = activeStory?.media_url || activeStory?.image_url;

  const closeStoryViewer = () => {
    setActiveStoryIndex(null);
    setStoryProgress(0);
  };

  const showNextStory = useCallback(() => {
    setStoryProgress(0);
    setActiveStoryIndex((current) => {
      if (current === null) return null;
      const nextIndex = current + 1;
      return nextIndex < stories.length ? nextIndex : null;
    });
  }, [stories.length]);

  const showPreviousStory = () => {
    setStoryProgress(0);
    setActiveStoryIndex((current) => {
      if (current === null) return null;
      return Math.max(0, current - 1);
    });
  };

  const openStoryViewer = (index) => {
    setStoryProgress(0);
    setActiveStoryIndex(index);
  };

  const renderUserAvatar = (profileUser, className = "post-avatar") => {
    if (profileUser?.profile_picture_url) {
      return <img className={`${className} avatar-image`} src={profileUser.profile_picture_url} alt={profileUser.username} />;
    }
    return <div className={className}>{profileUser?.username?.[0]?.toUpperCase() || "U"}</div>;
  };

  const openUserProfile = (profileUser, event) => {
    event?.stopPropagation();
    if (profileUser?.id) navigate(`/profile/${profileUser.id}`);
  };

  const reels = stories.filter((story) => story.story_type === "reel");

  useEffect(() => {
    if (!activeStory || activeStoryMediaType === "video") return undefined;
    if (activeStory.track) playTrack(activeStory.track);

    const durationMs = 8000;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const nextProgress = Math.min(100, ((Date.now() - startedAt) / durationMs) * 100);
      setStoryProgress(nextProgress);
      if (nextProgress >= 100) showNextStory();
    }, 100);

    return () => clearInterval(timer);
  }, [activeStory, activeStoryMediaType, playTrack, showNextStory]);

  return (
    <div className="social-route-shell">
      <div
        className="social-page facebook-shell"
        onMouseDown={(event) => event.stopPropagation()}
      >
      <aside className="social-left-rail">
        <div className="social-rail-title">
          <h2>Social</h2>
        </div>
        <button className={`rail-item ${activeSection === "feed" ? "active" : ""}`} onClick={openFeed}>
          <FaUserFriends /> Feed
        </button>
        <button className={`rail-item ${activeSection === "reels" ? "active" : ""}`} onClick={openReels}>
          <FaCamera /> Reels
        </button>
        <div className="rail-card">
          <span>Now playing</span>
          {currentTrack ? renderStaticTrack(currentTrack) : <p>No song selected.</p>}
        </div>
      </aside>

      <main className="social-feed">
        <div className="social-topbar">
          <div>
            <h2>{activeSection === "reels" ? "Reels" : "Home"}</h2>
            <p>{activeSection === "reels" ? "Scroll reels, react, comment, share, and play the songs people used." : "Posts, songs, friends, and stories from your circle."}</p>
          </div>
          {activeSection === "feed" && (
            <div className="scope-toggle">
              <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>All</button>
              <button className={scope === "following" ? "active" : ""} onClick={() => setScope("following")}>Following</button>
            </div>
          )}
        </div>

        {activeSection === "reels" ? (
          <section className="reels-page">
            {reels.length === 0 ? (
              <div className="social-empty">No reels yet.</div>
            ) : (
              reels.map((reel) => {
                const reelMeta = reelState[reel.id] || { liked: false, likeCount: 0, comments: [] };
                const reelMediaType = reel.media_type || (reel.image_url ? "image" : null);
                const reelMediaUrl = reel.media_url || reel.image_url;
                return (
                  <article className="reel-card" key={reel.id}>
                    <div className="reel-stage">
                      {reelMediaType === "video" && reelMediaUrl ? (
                        <video src={reelMediaUrl} controls playsInline />
                      ) : reelMediaUrl ? (
                        <img src={reelMediaUrl} alt="Reel" />
                      ) : (
                        <div className="story-viewer-empty">{reel.author.username?.[0]?.toUpperCase()}</div>
                      )}
                      <div className="reel-overlay">
                        <div className="post-author">
                          {renderUserAvatar(reel.author, "post-avatar")}
                          <div>
                            <strong className="profile-name-link" onClick={(event) => openUserProfile(reel.author, event)}>
                              {reel.author.username}
                            </strong>
                            <span>{reel.content || "Shared a reel"}</span>
                          </div>
                        </div>
                        {reel.track && (
                          <button className="reel-song" type="button" onClick={() => playTrack(reel.track)}>
                            <FaMusic />
                            <span>{reel.track.title || reel.track.track_name}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="reel-actions">
                      <button className={reelMeta.liked ? "active" : ""} onClick={() => toggleReelLike(reel.id)}>
                        {reelMeta.liked ? <FaHeart /> : <FaRegHeart />} Like {reelMeta.likeCount}
                      </button>
                      <button onClick={() => setComments((prev) => ({ ...prev, [`reel-${reel.id}-open`]: !prev[`reel-${reel.id}-open`] }))}>
                        <FaComment /> Comment {reelMeta.comments.length}
                      </button>
                      <button onClick={() => openShareDialog(reel, "reel")}>
                        <FaRetweet /> Share
                      </button>
                    </div>
                    {comments[`reel-${reel.id}-open`] && (
                      <div className="reel-comments">
                        {reelMeta.comments.map((comment) => (
                          <div className="comment-body" key={comment.id}>
                            <strong>{comment.author}</strong>
                            <span>{comment.content}</span>
                          </div>
                        ))}
                        <div className="comment-input">
                          <input
                            value={comments[`reel-${reel.id}`] || ""}
                            onChange={(event) => setComments((prev) => ({ ...prev, [`reel-${reel.id}`]: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") addReelComment(reel.id);
                            }}
                            placeholder="Write a comment"
                          />
                          <button onClick={() => addReelComment(reel.id)}>Send</button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        ) : (
          <>
        <section className="stories-card">
          <div className="story-tray">
            <article className="story-tile create-story-tile">
              <div className="create-story-media">
                {renderUserAvatar(user, "create-story-avatar")}
              </div>
              <button className="create-story-plus" title="Create story" onClick={() => setIsStoryCreatorOpen(true)}>
                <FaPlus />
              </button>
              <div className="create-story-controls">
                <strong>Create story</strong>
              </div>
            </article>
            {stories.map((story, index) => (
              <button className="story-tile story-view-button" key={story.id} onClick={() => openStoryViewer(index)} type="button">
                {story.media_type === "video" && story.media_url ? (
                  <video src={story.media_url} muted playsInline />
                ) : story.media_url || story.image_url ? (
                  <img src={story.media_url || story.image_url} alt="Story" />
                ) : (
                  <div className="story-gradient" />
                )}
                <div className="story-type-badge">{story.story_type === "reel" ? "Reel" : "Story"}</div>
                <span onClick={(event) => openUserProfile(story.author, event)}>
                  {renderUserAvatar(story.author, "story-owner-avatar")}
                </span>
                <div className="story-overlay">
                  <strong>{story.author.username}</strong>
                  <span>{story.content || story.track?.title || "Shared a story"}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="composer">
          <div className="composer-title">What are you thinking today?</div>
          <div className="composer-prompt-row">
            {renderUserAvatar(user, "post-avatar")}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`What's on your mind, ${username}?`}
            />
          </div>
          <div className="composer-actions">
            <div className="composer-options">
              <label className="composer-pill">
                <input
                  type="checkbox"
                  checked={attachSong}
                  onChange={(e) => setAttachSong(e.target.checked)}
                />
                <FaMusic /> Current song
              </label>
              <label className="composer-pill photo-picker">
                <FaCamera />
                Photo/video
                <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={handlePhotoChange} />
              </label>
            </div>
            <button className="composer-post-button" onClick={createPost} disabled={!content.trim() && !postMediaFile}>Post</button>
          </div>
          {postMediaPreview && (
            <div className="composer-photo-preview">
              {postMediaType === "video" ? (
                <video src={postMediaPreview} controls />
              ) : (
                <img src={postMediaPreview} alt="Selected upload preview" />
              )}
              <button onClick={() => setPostMediaFile(null)} title="Remove media">
                <FaTimes />
              </button>
            </div>
          )}
          {attachSong && currentTrack && renderTrack(currentTrack)}
        </section>

        {loading ? (
          <div className="social-empty">Loading feed...</div>
        ) : posts.length === 0 ? (
          <div className="social-empty">No posts yet.</div>
        ) : (
          posts.map((post) => (
            <article className="post-card" key={post.id}>
              <div className="post-header">
                <div className="post-author">
                  <button className="avatar-link" onClick={(event) => openUserProfile(post.author, event)} type="button">
                    {renderUserAvatar(post.author, "post-avatar")}
                  </button>
                  <div>
                      <strong className="profile-name-link" onClick={(event) => openUserProfile(post.author, event)}>{post.author.username}</strong>
                    <span>{new Date(post.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {post.is_owner && (
                  <div className="owner-actions">
                    {editingPostId === post.id ? (
                      <>
                        <button onClick={() => savePost(post.id)} title="Save post"><FaSave /></button>
                        <button onClick={() => setEditingPostId(null)} title="Cancel"><FaTimes /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingPostId(post.id); setEditingPostContent(post.content); }} title="Edit post"><FaEdit /></button>
                        <button onClick={() => deletePost(post.id)} title="Delete post"><FaTrash /></button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {post.shared_post_id && <div className="shared-label">Shared post</div>}
              {editingPostId === post.id ? (
                <textarea
                  className="post-edit-input"
                  value={editingPostContent}
                  onChange={(e) => setEditingPostContent(e.target.value)}
                />
              ) : (
                <p className="post-content">{post.content}</p>
              )}
              {post.media_type === "video" && post.media_url ? (
                <video className="post-photo post-video" src={post.media_url} controls />
              ) : (post.media_url || post.image_url) && (
                <img className="post-photo" src={post.media_url || post.image_url} alt="Shared post" />
              )}
              {renderTrack(post.track)}

              <div className="post-actions">
                <button className={post.is_liked ? "active" : ""} onClick={() => toggleLike(post.id)}>
                  {post.is_liked ? <FaHeart /> : <FaRegHeart />} Like {post.like_count}
                </button>
                <button>
                  <FaComment /> Comment {post.comment_count}
                </button>
                <button onClick={() => openShareDialog(post)}>
                  <FaRetweet /> Share {post.share_count}
                </button>
              </div>

              <div className="comments">
                {post.comments.map((comment) => (
                  <div className="comment" key={comment.id}>
                    <div className="comment-body">
                      <strong className="profile-name-link" onClick={(event) => openUserProfile(comment.author, event)}>{comment.author.username}</strong>
                      {editingCommentId === comment.id ? (
                        <input
                          value={editingCommentContent}
                          onChange={(e) => setEditingCommentContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveComment(post.id, comment.id);
                            if (e.key === "Escape") setEditingCommentId(null);
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
                            <button onClick={() => saveComment(post.id, comment.id)} title="Save comment"><FaSave /></button>
                            <button onClick={() => setEditingCommentId(null)} title="Cancel"><FaTimes /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); }} title="Edit comment"><FaEdit /></button>
                            <button onClick={() => deleteComment(post.id, comment.id)} title="Delete comment"><FaTrash /></button>
                          </>
                        )}
                      </div>
                    )}
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
          </>
        )}
      </main>

      <aside className="social-right-rail">
        <section className="side-panel social-profile-panel">
          <button className="social-profile-card" onClick={(event) => openUserProfile(user, event)} type="button">
            {renderUserAvatar(user, "social-profile-avatar")}
            <div>
              <strong>{username}</strong>
              <span>View your profile</span>
            </div>
          </button>
        </section>

        <section className="side-panel">
          <div className="panel-title">
            <h3>Friend Requests</h3>
            <FaUserFriends />
          </div>
          {friends.incoming_requests.length === 0 ? (
            <p className="panel-empty">No pending requests.</p>
          ) : (
            friends.incoming_requests.map((request) => (
              <div className="person-row" key={request.id}>
                {renderUserAvatar(request.user, "post-avatar")}
                <span className="profile-name-link" onClick={(event) => openUserProfile(request.user, event)}>{request.user.username}</span>
                <button onClick={() => acceptFriend(request.id)}><FaCheck /></button>
                <button className="quiet-action" onClick={() => removeFriendRequest(request.id)}><FaTimes /></button>
              </div>
            ))
          )}
        </section>

        <section className="side-panel">
          <div className="panel-title">
            <h3>Find Friends</h3>
            <FaSearch />
          </div>
          <input
            className="people-search"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search users"
          />
          <div className="user-list">
            {[...users, ...friends.suggestions].filter((user, index, arr) => (
              arr.findIndex((item) => item.id === user.id) === index
            )).slice(0, 8).map((user) => (
              <div className="user-row" key={user.id}>
                {renderUserAvatar(user, "post-avatar")}
                <span className="profile-name-link" onClick={(event) => openUserProfile(user, event)}>{user.username}</span>
                {user.friendship ? renderFriendButton(user) : <button onClick={() => requestFriend(user.id)}><FaUserPlus /> Add</button>}
                <button className="quiet-action" onClick={() => toggleFollow(user)}>
                  {user.is_following ? <FaUserCheck /> : <FaUserPlus />}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="side-panel">
          <div className="panel-title">
            <h3>Friends</h3>
            <FaComment />
          </div>
          <div className="user-list">
            {friends.friends.length === 0 ? (
              <p className="panel-empty">Add friends to start messaging.</p>
            ) : (
              friends.friends.map((friend) => (
                <button className="contact-row" key={friend.id} onClick={() => openChat(friend)}>
                  {renderUserAvatar(friend, "post-avatar")}
                  <span>{friend.username}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="side-panel">
          <div className="panel-title">
            <h3>Messages</h3>
            <FaPaperPlane />
          </div>
          <div className="thread-list">
            {threads.length === 0 ? (
              <p className="panel-empty">No messages yet.</p>
            ) : (
              threads.map((thread) => (
                <button className="thread-row" key={thread.user.id} onClick={() => openChat(thread.user)}>
                  {renderUserAvatar(thread.user, "post-avatar")}
                  <div>
                    <strong>{thread.user.username}</strong>
                    <span>{thread.latest_message.content}</span>
                  </div>
                  {thread.unread_count > 0 && <b>{thread.unread_count}</b>}
                </button>
              ))
            )}
          </div>
        </section>
      </aside>

      {activeChatUser && (
        <section className="chat-dock">
          <div className="chat-header">
            <div>
              <strong>{activeChatUser.username}</strong>
              <span>Direct message</span>
            </div>
            <button onClick={() => setActiveChatUser(null)}><FaTimes /></button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <p className="panel-empty">Say hello.</p>
            ) : (
              messages.map((message) => (
                <div className={`chat-bubble ${message.is_mine ? "mine" : ""}`} key={message.id}>
                  {message.content}
                </div>
              ))
            )}
          </div>
          <div className="chat-input">
            <input
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              placeholder="Message"
            />
            <button onClick={sendMessage}><FaPaperPlane /></button>
          </div>
        </section>
      )}
      {activeStory && (
        <section className="story-viewer-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeStoryViewer();
        }}>
          <div className="story-viewer" onMouseDown={(event) => event.stopPropagation()}>
            <div className="story-viewer-progress">
              {stories.map((story, index) => (
                <span key={story.id}>
                  <b
                    style={{
                      width:
                        index < activeStoryIndex
                          ? "100%"
                          : index === activeStoryIndex
                            ? `${storyProgress}%`
                            : "0%",
                    }}
                  />
                </span>
              ))}
            </div>
            <header className="story-viewer-header">
              <div className="post-author">
                {renderUserAvatar(activeStory.author, "post-avatar")}
                <div>
                  <strong>{activeStory.author.username}</strong>
                  <span>{activeStory.story_type === "reel" ? "Reel" : "Story"}</span>
                </div>
              </div>
              <button onClick={closeStoryViewer} title="Close story"><FaTimes /></button>
            </header>
            <div className="story-viewer-stage">
              {activeStoryMediaType === "video" && activeStoryMediaUrl ? (
                <video
                  src={activeStoryMediaUrl}
                  autoPlay
                  controls
                  playsInline
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    if (video.duration) setStoryProgress((video.currentTime / video.duration) * 100);
                  }}
                  onEnded={showNextStory}
                />
              ) : activeStoryMediaUrl ? (
                <img src={activeStoryMediaUrl} alt="Story" />
              ) : (
                <div className="story-viewer-empty">{activeStory.author.username?.[0]?.toUpperCase()}</div>
              )}
              {activeStory.content && <p className="story-viewer-caption">{activeStory.content}</p>}
              {activeStory.track && (
                <div className="story-viewer-song">
                  {renderStaticTrack(activeStory.track)}
                </div>
              )}
            </div>
            {activeStoryIndex > 0 && (
              <button className="story-viewer-nav previous" onClick={showPreviousStory} title="Previous story">
                <FaChevronLeft />
              </button>
            )}
            {activeStoryIndex < stories.length - 1 && (
              <button className="story-viewer-nav next" onClick={showNextStory} title="Next story">
                <FaChevronRight />
              </button>
            )}
          </div>
        </section>
      )}
      {isStoryCreatorOpen && (
        <section
          className="story-creator-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeStoryCreator();
          }}
        >
          <div className="story-creator-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="story-creator-header">
              <div>
                <span>Create</span>
                <h2>{storyType === "reel" ? "Reel" : "Story"}</h2>
              </div>
              <button onClick={closeStoryCreator}><FaTimes /></button>
            </header>

            {storyCreatorStep === "type" ? (
              <div className="story-type-screen">
                <button
                  className={`story-choice-card ${storyType === "story" ? "active" : ""}`}
                  onClick={() => setStoryType("story")}
                >
                  <FaCamera />
                  <strong>Story</strong>
                  <span>Lasts 24 hours</span>
                </button>
                <button
                  className={`story-choice-card ${storyType === "reel" ? "active" : ""}`}
                  onClick={() => setStoryType("reel")}
                >
                  <FaMusic />
                  <strong>Reel</strong>
                  <span>Stays visible</span>
                </button>
                <button className="story-next-button" onClick={() => setStoryCreatorStep("edit")}>
                  Next
                </button>
              </div>
            ) : (
              <div className="story-edit-screen">
                <div className="story-edit-preview">
                  {storyPreview && storyMediaType === "video" ? (
                    <video src={storyPreview} controls />
                  ) : storyPreview ? (
                    <img src={storyPreview} alt="Story preview" />
                  ) : (
                    <div className="story-edit-empty">{username?.[0]?.toUpperCase()}</div>
                  )}
                  {storyPreview && <button className="clear-story-preview" onClick={() => setStoryFile(null)}><FaTimes /></button>}
                </div>
                <div className="story-edit-tools">
                  <label className="story-upload-large">
                    <FaCamera />
                    Photo or video
                    <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={handleStoryPhotoChange} />
                  </label>
                  <textarea
                    value={storyContent}
                    onChange={(event) => setStoryContent(event.target.value)}
                    placeholder={storyType === "story" ? "Say something for 24 hours" : "Caption your reel"}
                  />
                  <div className="story-song-picker">
                    <div className="story-song-picker-header">
                      <strong>Choose song</strong>
                      {selectedStoryTrack && (
                        <button onClick={() => setSelectedStoryTrack(null)} type="button">
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      value={storySongQuery}
                      onChange={(event) => setStorySongQuery(event.target.value)}
                      placeholder="Search songs"
                    />
                    <div className="story-song-options">
                      {storySongOptions.length === 0 ? (
                        <p>No song selected.</p>
                      ) : (
                        storySongOptions.slice(0, 8).map((track) => (
                          <button
                            className={`story-song-option ${selectedStoryTrack?.id === track.id ? "selected" : ""}`}
                            key={`${track.isCurrent ? "current" : "search"}-${track.id}`}
                            onClick={() => setSelectedStoryTrack(track)}
                            type="button"
                          >
                            {renderStaticTrack(track)}
                            {track.isCurrent && <span className="current-song-badge">Current song</span>}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="story-modal-actions">
                    <button className="quiet-action" onClick={() => setStoryCreatorStep("type")}>Back</button>
                    <button className="create-story-share" onClick={createStory}>Share</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      {shareDialogPost && (
        <section
          className="share-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeShareDialog();
          }}
        >
          <div className="share-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <header className="share-dialog-header">
              <h2>{shareDialogType === "reel" ? "Share reel" : "Share post"}</h2>
              <button onClick={closeShareDialog}><FaTimes /></button>
            </header>
            <div className="share-mode-toggle">
              <button className={shareMode === "feed" ? "active" : ""} onClick={() => setShareMode("feed")} type="button">
                Share on feed
              </button>
              <button className={shareMode === "friend" ? "active" : ""} onClick={() => setShareMode("friend")} type="button">
                Send to friend
              </button>
            </div>
            {shareMode === "friend" && (
              <select
                className="share-friend-select"
                value={shareFriendId}
                onChange={(event) => setShareFriendId(event.target.value)}
              >
                <option value="">Choose a friend</option>
                {friends.friends.map((friend) => (
                  <option value={friend.id} key={friend.id}>{friend.username}</option>
                ))}
              </select>
            )}
            <textarea
              value={shareDraft}
              onChange={(event) => setShareDraft(event.target.value)}
              placeholder={shareMode === "friend" ? "Write a message" : "Write something about this share"}
            />
            <div className="share-dialog-preview">
              <div className="post-author">
                {renderUserAvatar(shareDialogPost.author, "post-avatar")}
                <div>
                  <strong>{shareDialogPost.author.username}</strong>
                  <span>{new Date(shareDialogPost.created_at).toLocaleString()}</span>
                </div>
              </div>
              <p>{shareDialogPost.content}</p>
              {shareDialogPost.media_type === "video" && shareDialogPost.media_url ? (
                <video className="post-photo post-video" src={shareDialogPost.media_url} controls />
              ) : (shareDialogPost.media_url || shareDialogPost.image_url) && (
                <img className="post-photo" src={shareDialogPost.media_url || shareDialogPost.image_url} alt="Shared post" />
              )}
              {shareDialogPost.track && renderStaticTrack(shareDialogPost.track)}
            </div>
            <button className="share-dialog-submit" onClick={sharePost} disabled={shareMode === "friend" && !shareFriendId}>
              {shareMode === "friend" ? "Send" : "Share"}
            </button>
          </div>
        </section>
      )}
      </div>
      <div className="social-player-bar">
        <MusicPlayer
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlayPause={() => {
            if (!currentSong) return;
            if (isPlaying) stop();
            else playSong(currentSong);
          }}
          onNext={nextSong}
          onPrev={prevSong}
          likedTrackIds={likedTrackIds}
          userPlaylists={userPlaylists}
          onToggleLike={handleToggleLike}
          onAddTrackToPlaylist={handleAddTrackToPlaylist}
          onToggleFullscreen={() => {}}
          onToggleQueue={() => {}}
          isQueueVisible={false}
          onToggleLyrics={() => {}}
          isLyricsVisible={false}
          isShuffleEnabled={isShuffleEnabled}
          repeatMode={repeatMode}
          onToggleShuffle={toggleShuffle}
          onCycleRepeat={cycleRepeatMode}
        />
      </div>
    </div>
  );
};

export default SocialFeed;
