import React, { useState, useRef, useEffect, useCallback } from "react";
import "../styles/Navbar.css";
import {
  FaBell,
  FaBan,
  FaChevronDown,
  FaCog,
  FaCommentDots,
  FaCompass,
  FaEllipsisH,
  FaHome,
  FaMusic,
  FaPaperPlane,
  FaPen,
  FaSearch,
  FaTimes,
  FaTrash,
  FaVolumeMute,
  FaVolumeUp,
  FaUsers,
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; 
import { authFetch } from "../utils/authFetch";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";
const CHAT_PREFS_KEY = "chatPreferences";

const loadChatPrefs = () => {
  try {
    return {
      messageSounds: true,
      popupMessages: true,
      activeStatus: true,
      ...(JSON.parse(localStorage.getItem(CHAT_PREFS_KEY) || "{}")),
    };
  } catch (err) {
    return {
      messageSounds: true,
      popupMessages: true,
      activeStatus: true,
    };
  }
};

const Navbar = ({ username, profilePicture, userId }) => {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const isAuthenticated = Boolean(token);
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [threads, setThreads] = useState([]);
  const [friends, setFriends] = useState([]);
  const [people, setPeople] = useState([]);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [showConversationSettings, setShowConversationSettings] = useState(false);
  const [chatPrefs, setChatPrefs] = useState(loadChatPrefs);
  const [chatPopup, setChatPopup] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchType, setSearchType] = useState("Track");
  const [searchTerm, setSearchTerm] = useState("");
  const [roles, setRoles] = useState([]); 

  const menuRef = useRef();
  const notificationRef = useRef();
  const chatRef = useRef();
  const dropdownRef = useRef();
  const debounceRef = useRef(null);
  const previousUnreadRef = useRef(null);
  const navigate = useNavigate();

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : "";

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const userRoles = decoded.roles || [];
        setRoles(Array.isArray(userRoles) ? userRoles : [userRoles]);
      } catch (err) {
        console.error("Invalid token", err);
      }
    }
  }, [token]);

  useEffect(() => {
    if (!location.pathname.includes("/search")) {
      setSearchTerm("");
    }
  }, [location]);

  useEffect(() => {
    localStorage.setItem(CHAT_PREFS_KEY, JSON.stringify(chatPrefs));
  }, [chatPrefs]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      if (notificationRef.current && !notificationRef.current.contains(e.target)) setShowNotifications(false);
      if (chatRef.current && !chatRef.current.contains(e.target)) {
        setShowChat(false);
        setShowChatSettings(false);
        setShowNewMessage(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchType === "Emotion") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm.trim()) return;

    debounceRef.current = setTimeout(() => {
      navigate(`/search?query=${encodeURIComponent(searchTerm)}&filter_by=${searchType.toLowerCase()}`);
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, searchType, navigate]);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("user");
    localStorage.removeItem("authUser");
    window.dispatchEvent(new Event("authUpdated"));
    fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  const handleDropdownClick = (type) => {
    setSearchType(type);
    setShowDropdown(false);
  };

  const handleEmotionSearch = async (query) => {
    try {
      const formData = new FormData();
      formData.append('prompt', query);

      const res = await authFetch(`${API_BASE}/api/music/ask`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to get emotion recommendations");
      }

      const data = await res.json();
      navigate(`/search?query=${encodeURIComponent(query)}&filter_by=emotion&results=${encodeURIComponent(JSON.stringify(data))}`);
    } catch (err) {
      console.error("Failed to get emotion-based recommendations:", err);
      alert(err.message || "Failed to get emotion-based recommendations");
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/social/notifications`);
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, [isAuthenticated]);

  const fetchThreads = useCallback(async () => {
    if (!isAuthenticated) {
      setThreads([]);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/social/messages/threads`);
      const data = await res.json();
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch chat threads", err);
    }
  }, [isAuthenticated]);

  const fetchPeople = useCallback(async () => {
    if (!isAuthenticated) {
      setPeople([]);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/social/users?q=${encodeURIComponent(peopleSearch)}`);
      const data = await res.json();
      setPeople(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch people", err);
    }
  }, [isAuthenticated, peopleSearch]);

  const fetchFriends = useCallback(async () => {
    if (!isAuthenticated) {
      setFriends([]);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/api/social/friends`);
      const data = await res.json();
      setFriends(Array.isArray(data.friends) ? data.friends : []);
    } catch (err) {
      console.error("Failed to fetch chat friends", err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    fetchThreads();
    fetchFriends();
    const notificationTimer = setInterval(fetchNotifications, 60000);
    const threadTimer = setInterval(fetchThreads, 15000);
    return () => {
      clearInterval(notificationTimer);
      clearInterval(threadTimer);
    };
  }, [fetchFriends, fetchNotifications, fetchThreads, isAuthenticated]);

  useEffect(() => {
    if (!showNewMessage) return;
    const timer = setTimeout(fetchPeople, 250);
    return () => clearTimeout(timer);
  }, [fetchPeople, showNewMessage]);

  const playMessageSound = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(720, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.24);
    } catch (err) {
      console.error("Failed to play message sound", err);
    }
  }, []);

  useEffect(() => {
    const unreadTotal = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
    if (previousUnreadRef.current === null) {
      previousUnreadRef.current = unreadTotal;
      return;
    }

    if (unreadTotal > previousUnreadRef.current) {
      const newThread = threads.find((thread) => (thread.unread_count || 0) > 0);
      const isActiveThread = activeChatUser?.id && newThread?.user?.id === activeChatUser.id;
      if (!isActiveThread && chatPrefs.messageSounds) {
        playMessageSound();
      }
      if (!isActiveThread && chatPrefs.popupMessages && newThread) {
        setChatPopup({
          user: newThread.user,
          content: newThread.latest_message?.content || "New message",
        });
      }
    }
    previousUnreadRef.current = unreadTotal;
  }, [activeChatUser?.id, chatPrefs.messageSounds, chatPrefs.popupMessages, playMessageSound, threads]);

  useEffect(() => {
    if (!chatPopup) return;
    const timer = setTimeout(() => setChatPopup(null), 6000);
    return () => clearTimeout(timer);
  }, [chatPopup]);

  const openNotifications = async () => {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }

    const next = !showNotifications;
    setShowNotifications(next);
    setShowChat(false);
    setShowMenu(false);
    if (next) {
      await fetchNotifications();
      await authFetch(`${API_BASE}/api/social/notifications/read`, { method: "POST" });
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    }
  };

  const openChatMenu = async () => {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }

    const next = !showChat;
    setShowChat(next);
    setShowNotifications(false);
    setShowMenu(false);
    setShowChatSettings(false);
    setShowNewMessage(false);
    if (next) {
      await fetchThreads();
      await fetchFriends();
    }
  };

  const openConversation = async (targetUser) => {
    if (!targetUser?.id) return;
    setActiveChatUser(targetUser);
    setShowConversationSettings(false);
    setShowNewMessage(false);
    try {
      const res = await authFetch(`${API_BASE}/api/social/messages/${targetUser.id}`);
      const data = await res.json();
      if (data.user) setActiveChatUser(data.user);
      setConversation(data.messages || []);
      fetchThreads();
    } catch (err) {
      console.error("Failed to open conversation", err);
    }
  };

  const sendMessage = async () => {
    const value = chatDraft.trim();
    if (!value || !activeChatUser?.id || activeChatUser.is_blocked) return;

    try {
      const res = await authFetch(`${API_BASE}/api/social/messages/${activeChatUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });
      const message = await res.json();
      setConversation((prev) => [...prev, message]);
      setChatDraft("");
      fetchThreads();
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleEmotionClick = (type) => {
    setShowDropdown(false);
    setSearchType(type);
  };

  const openBrowse = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchTerm("");
    setShowDropdown(false);
    navigate("/search?browse=1");
  };

  const isSocialActive = location.pathname.startsWith("/social");
  const isHomeActive = location.pathname === "/" || ["/search", "/playlist", "/album", "/artist", "/chart", "/purchased", "/artist-studio"].some((path) => location.pathname.startsWith(path));
  const chatRows = [
    ...threads.map((thread) => ({ type: "thread", user: thread.user, latestMessage: thread.latest_message, unreadCount: thread.unread_count || 0 })),
    ...friends
      .filter((friend) => !threads.some((thread) => thread.user?.id === friend.id))
      .map((friend) => ({ type: "friend", user: friend, latestMessage: null, unreadCount: 0 })),
  ];
  const filteredChatRows = chatRows.filter((row) => {
    const query = chatSearch.trim().toLowerCase();
    if (!query) return true;
    return `${row.user?.username || ""} ${row.latestMessage?.content || ""}`.toLowerCase().includes(query);
  });
  const getChatStatusText = (chatUser) => {
    if (chatUser?.is_blocked) return "Blocked";
    if (chatUser?.is_muted) return "Muted conversation";
    return chatPrefs.activeStatus ? "Active status on" : "Active status off";
  };
  const toggleChatPref = (key) => {
    setChatPrefs((current) => ({ ...current, [key]: !current[key] }));
  };
  const toggleConversationMute = async () => {
    if (!activeChatUser?.id) return;
    const nextMuted = !activeChatUser.is_muted;
    try {
      await authFetch(`${API_BASE}/api/social/users/${activeChatUser.id}/mute`, {
        method: nextMuted ? "POST" : "DELETE",
      });
      setActiveChatUser((current) => current ? { ...current, is_muted: nextMuted } : current);
    } catch (err) {
      console.error("Failed to update chat mute state", err);
    }
  };
  const toggleConversationBlock = async () => {
    if (!activeChatUser?.id) return;
    const nextBlocked = !activeChatUser.is_blocked;
    try {
      await authFetch(`${API_BASE}/api/social/users/${activeChatUser.id}/block`, {
        method: nextBlocked ? "POST" : "DELETE",
      });
      setActiveChatUser((current) => current ? { ...current, is_blocked: nextBlocked } : current);
      if (nextBlocked) {
        setConversation([]);
        setChatDraft("");
      }
      fetchThreads();
    } catch (err) {
      console.error("Failed to update chat block state", err);
    }
  };
  const deleteConversation = async () => {
    if (!activeChatUser?.id) return;
    const confirmed = window.confirm(`Delete chat with ${activeChatUser.username}? This only removes it from your inbox.`);
    if (!confirmed) return;
    try {
      await authFetch(`${API_BASE}/api/social/messages/${activeChatUser.id}`, { method: "DELETE" });
      setConversation([]);
      setChatDraft("");
      setShowConversationSettings(false);
      setActiveChatUser(null);
      fetchThreads();
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  return (
    <header className="navbar">
      <div className="nav-left">
  <img src="/my-logo.png" alt="App Logo" className="app-logo" />
  <button className={`home-b ${isHomeActive ? "active" : ""}`} onClick={() => navigate("/")} title="Home">
    <FaHome />
  </button>
  <button className={`home-b ${isSocialActive ? "active" : ""}`} onClick={() => navigate("/social")} title="Social Feed">
    <FaUsers />
  </button>
</div>


      <div className="nav-center">
        <div className="search-group">
          <input
            type="text"
            className="search-input"
            placeholder={
              searchType === "Emotion"
                ? "How are you feeling today?"
                : "What do you want to play?"
            }
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (searchType !== "Emotion") {
                navigate(`/search?query=${encodeURIComponent(e.target.value)}&filter_by=${searchType.toLowerCase()}`);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchType === "Emotion") {
                e.preventDefault();
                handleEmotionSearch(searchTerm);
              }
            }}
          />
          <div className="search-filter-wrapper" ref={dropdownRef}>
            <div
              className={`search-filter-button ${showDropdown ? "open" : ""}`}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              Search by {searchType} <FaChevronDown className="arrow-icon" />
            </div>
            <div className={`search-filter-dropdown ${showDropdown ? "show" : ""}`}>
              {["Track", "Artist", "Album", "Emotion"].map((type) => (
                <div
                  key={type}
                  className="dropdown-item"
                  onClick={() =>
                    type === "Emotion"
                      ? handleEmotionClick(type)
                      : handleDropdownClick(type)
                  }
                >
                  {type}
                </div>
              ))}
            </div>
          </div>
          <button
            className={`browse-button ${location.pathname.includes("/search") && location.search.includes("browse=") ? "active" : ""}`}
            type="button"
            onClick={openBrowse}
          >
            <FaCompass />
            Browse
          </button>
        </div>
      </div>

      <div className="nav-right">
        <button className="premium-nav-link" type="button" onClick={() => navigate("/premium")}>
          Premium
        </button>
        {isAuthenticated && (
        <>
        <div className="notification-wrapper" ref={notificationRef}>
          <button className="notification-button" onClick={openNotifications} title="Notifications">
            <FaBell />
            {notifications.some((item) => !item.is_read) && <span className="notification-dot" />}
          </button>
          <div className={`notification-menu ${showNotifications ? "show" : ""}`}>
            <h4>Notifications</h4>
            {notifications.length === 0 ? (
              <p className="notification-empty">No notifications</p>
            ) : (
              notifications.map((item) => (
                <div className="notification-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="chat-wrapper" ref={chatRef}>
          <button className="notification-button chat-nav-button" onClick={openChatMenu} title="Chat">
            <FaCommentDots />
            {threads.some((thread) => thread.unread_count > 0) && <span className="notification-dot" />}
          </button>
          {chatPopup && (
            <button
              type="button"
              className="chat-popup-toast"
              onClick={() => {
                openConversation(chatPopup.user);
                setChatPopup(null);
              }}
            >
              {chatPopup.user?.profile_picture_url ? (
                <img src={chatPopup.user.profile_picture_url} alt={chatPopup.user.username} />
              ) : (
                <span>{getInitial(chatPopup.user?.username)}</span>
              )}
              <div>
                <strong>{chatPopup.user?.username || "New message"}</strong>
                <small>{chatPopup.content}</small>
              </div>
            </button>
          )}
          <div className={`chat-menu ${showChat ? "show" : ""}`}>
            <div className="chat-menu-header">
              <h3>Chat</h3>
              <div className="chat-menu-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowChatSettings((current) => !current);
                    setShowNewMessage(false);
                  }}
                  title="Options"
                >
                  <FaEllipsisH />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewMessage((current) => !current);
                    setShowChatSettings(false);
                    fetchPeople();
                  }}
                  title="New message"
                >
                  <FaPen />
                </button>
              </div>
            </div>
            {showChatSettings && (
              <div className="chat-settings-panel">
                <div className="chat-settings-heading">
                  <strong><FaCog /> Chat settings</strong>
                  <span>Customise your Messenger experience.</span>
                </div>
                <button className="chat-setting-row" type="button" onClick={() => toggleChatPref("messageSounds")}>
                  <span><FaVolumeUp /> Message sounds</span>
                  <b className={chatPrefs.messageSounds ? "on" : ""}>{chatPrefs.messageSounds ? "On" : "Off"}</b>
                </button>
                <button className="chat-setting-row" type="button" onClick={() => toggleChatPref("popupMessages")}>
                  <span><FaCommentDots /> Pop up new messages</span>
                  <b className={chatPrefs.popupMessages ? "on" : ""}>{chatPrefs.popupMessages ? "On" : "Off"}</b>
                </button>
                <button className="chat-setting-row" type="button" onClick={() => toggleChatPref("activeStatus")}>
                  <span><FaUsers /> Active status</span>
                  <b className={chatPrefs.activeStatus ? "on" : ""}>{chatPrefs.activeStatus ? "On" : "Off"}</b>
                </button>
                <button className="chat-setting-row" type="button" disabled>
                  <span><FaBan /> Chat safety</span>
                  <small>Open a conversation to mute or block someone</small>
                </button>
              </div>
            )}
            <div className="chat-search chat-search-slim">
              <FaSearch />
              <input
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search messages"
              />
            </div>
            {showNewMessage && (
              <div className="new-message-panel">
                <div className="new-message-title">
                  <strong>New message</strong>
                  <button type="button" onClick={() => setShowNewMessage(false)}><FaTimes /></button>
                </div>
                <div className="chat-search">
                  <FaSearch />
                  <input
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    placeholder="Search people"
                  />
                </div>
                <div className="chat-thread-list">
                  {people.length === 0 ? (
                    <p className="chat-empty">No people found.</p>
                  ) : (
                    people.slice(0, 8).map((person) => (
                      <button className="chat-thread-row" key={person.id} onClick={() => openConversation(person)}>
                        {person.profile_picture_url ? (
                          <img src={person.profile_picture_url} alt={person.username} />
                        ) : (
                          <span>{getInitial(person.username)}</span>
                        )}
                        <strong>{person.username}</strong>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="chat-thread-list">
              {filteredChatRows.length === 0 ? (
                <p className="chat-empty">{chatSearch.trim() ? "No matching chats." : "No messages yet."}</p>
              ) : (
                filteredChatRows.map((row) => (
                  <button className={`chat-thread-row ${chatPrefs.activeStatus ? "active-status-enabled" : ""}`} key={`${row.type}-${row.user.id}`} onClick={() => openConversation(row.user)}>
                    {row.user.profile_picture_url ? (
                      <img src={row.user.profile_picture_url} alt={row.user.username} />
                    ) : (
                      <span>{getInitial(row.user.username)}</span>
                    )}
                    <div>
                      <strong>{row.user.username}</strong>
                      <small>{row.latestMessage?.content || "Start a conversation"}</small>
                    </div>
                    {row.unreadCount > 0 && <b>{row.unreadCount}</b>}
                  </button>
                ))
              )}
            </div>
          </div>
          {activeChatUser && (
            <section className="nav-chat-window">
              <div className="nav-chat-header">
                <div>
                  <strong>{activeChatUser.username}</strong>
                  <span>{getChatStatusText(activeChatUser)}</span>
                </div>
                <div className="nav-chat-header-actions">
                  <button type="button" onClick={() => setShowConversationSettings((current) => !current)} title="Conversation settings"><FaEllipsisH /></button>
                  <button type="button" onClick={() => setActiveChatUser(null)}><FaTimes /></button>
                </div>
              </div>
              {showConversationSettings && (
                <div className="conversation-settings-panel">
                  <button type="button" onClick={toggleConversationMute}>
                    <span>{activeChatUser.is_muted ? <FaVolumeUp /> : <FaVolumeMute />} {activeChatUser.is_muted ? "Unmute conversation" : "Mute conversation"}</span>
                    <small>{activeChatUser.is_muted ? "Messages can notify you again." : "Stop notifications from this chat."}</small>
                  </button>
                  <button type="button" className="danger" onClick={toggleConversationBlock}>
                    <span><FaBan /> {activeChatUser.is_blocked ? "Unblock messages" : "Block messages"}</span>
                    <small>{activeChatUser.is_blocked ? "Allow messages from this person." : "They will not be able to message you."}</small>
                  </button>
                  <button type="button" className="danger" onClick={deleteConversation}>
                    <span><FaTrash /> Delete chat</span>
                    <small>Remove this conversation from your inbox only.</small>
                  </button>
                </div>
              )}
              <div className="nav-chat-messages">
                {activeChatUser.is_blocked ? (
                  <p className="chat-empty">You blocked this conversation.</p>
                ) : conversation.length === 0 ? (
                  <p className="chat-empty">Say hello.</p>
                ) : (
                  conversation.map((message) => (
                    <div className={`nav-chat-bubble ${message.is_mine ? "mine" : ""}`} key={message.id}>
                      {message.content}
                    </div>
                  ))
                )}
              </div>
              <div className="nav-chat-input">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendMessage();
                  }}
                  placeholder={activeChatUser.is_blocked ? "Unblock to send a message" : "Write a message"}
                  disabled={activeChatUser.is_blocked}
                />
                <button type="button" onClick={sendMessage} disabled={activeChatUser.is_blocked}><FaPaperPlane /></button>
              </div>
            </section>
          )}
        </div>
        </>
        )}
        <div
          className="profile-wrapper"
          ref={menuRef}
          onClick={() => setShowMenu(!showMenu)}
        >
          {isAuthenticated && profilePicture ? (
            <img src={profilePicture} alt="Profile" className="profile-pic" />
          ) : isAuthenticated && username ? (
            <div className="profile-initial">{getInitial(username)}</div>
          ) : (
            <button className="login-pill" type="button">Log in</button>
          )}
          {showMenu && (
          <div className="account-dropdown-menu" onClick={(event) => event.stopPropagation()}>
            {isAuthenticated ? (
              <>
                <div className="account-name">{username}</div>
                {userId && <button className="button" onClick={() => navigate(`/profile/${userId}`)}>Profile</button>}
                <button className="button" onClick={() => navigate("/setting")}>Setting</button>
                {roles.includes("artist") && (
                  <button className="button" onClick={() => navigate("/artist-studio")}>
                    <FaMusic /> Artist Studio
                  </button>
                )}
                {roles.includes("admin") && (
                  <>
                    <button className="button" onClick={() => navigate("/admin/songs")}>Song Review</button>
                    <button className="button" onClick={() => navigate("/admin/moderation")}>Moderation</button>
                    <button className="button" onClick={() => navigate("/database")}>Database</button>
                  </>
                )}
                <button className="button" onClick={handleSignOut}>Log Out</button>
              </>
            ) : (
              <>
                <button className="button" onClick={() => navigate("/signin")}>Log In</button>
                <button className="button" onClick={() => navigate("/signup")}>Sign Up</button>
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
