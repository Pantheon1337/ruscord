import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/client";
import { wsManager } from "../services/websocket";
import { useWebSocket } from "../hooks/useWebSocket";
import { getAvatarUrl } from "../utils/imageUtils";
import UserProfilePopup from "./UserProfilePopup";
import "./HomeView.css";

interface DMChannel {
  id: string;
  type: string;
  recipients?: any[];
  updatedAt: string;
}


interface HomeViewProps {
  onTabChange?: (tab: "home" | "friends" | "requests" | "shop") => void;
  activeTab?: "home" | "friends" | "requests" | "shop";
}

export default function HomeView({ onTabChange, activeTab: externalActiveTab }: HomeViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [internalActiveTab, setInternalActiveTab] = useState<"home" | "friends" | "requests" | "shop">("home");
  const [dmChannels, setDmChannels] = useState<DMChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | undefined>();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const loadingRef = useRef(false);

  const activeTab = externalActiveTab || internalActiveTab;

  const getActiveChannelId = () => {
    if (location.pathname.startsWith("/home/")) {
      return location.pathname.split("/home/")[1];
    }
    return null;
  };

  const loadDMChannels = useCallback(async () => {
    // Предотвращаем множественные одновременные запросы
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      const response = await api.get("/dms");
      setDmChannels(response.data || []);
    } catch (error) {
      setDmChannels([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const loadPendingRequestsCount = useCallback(async () => {
    try {
      const response = await api.get("/friends/requests");
      const receivedCount = response.data?.received?.length || 0;
      setPendingRequestsCount(receivedCount);
    } catch (error) {
      setPendingRequestsCount(0);
    }
  }, []);

  useEffect(() => {
    loadDMChannels();
    loadPendingRequestsCount();
  }, [loadDMChannels, loadPendingRequestsCount]);

  // Обновляем список DM каналов при изменении пути (когда открывается новый чат)
  // Используем debounce, чтобы не делать запросы слишком часто
  useEffect(() => {
    if (location.pathname.startsWith("/home/")) {
      const timeoutId = setTimeout(() => {
        loadDMChannels();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [location.pathname, loadDMChannels]);

  // Обновляем список при переключении на вкладку requests
  useEffect(() => {
    if (activeTab === "requests") {
      loadPendingRequestsCount();
    }
  }, [activeTab, loadPendingRequestsCount]);

  // Listen for friend request updates
  useEffect(() => {
    const handleFriendRequestUpdate = () => {
      loadPendingRequestsCount();
    };

    window.addEventListener("friendRequestUpdated", handleFriendRequestUpdate);
    return () => {
      window.removeEventListener("friendRequestUpdated", handleFriendRequestUpdate);
    };
  }, [loadPendingRequestsCount]);

  // Handle WebSocket messages for friend requests
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.op === 0 && message.t === "FRIEND_REQUEST") {
        // New friend request received
        loadPendingRequestsCount();
      }
    };

    const unsubscribe = wsManager.subscribe(handleMessage);
    return unsubscribe;
  }, [loadPendingRequestsCount]);

  // Subscribe to WebSocket presence updates for DM channels
  useWebSocket((message) => {
    if (message.op === 0 && message.t === "PRESENCE_UPDATE") {
      const { userId, status } = message.d;
      setDmChannels((prevChannels) =>
        prevChannels.map((channel) => {
          if (!channel.recipients) return channel;
          const updatedRecipients = channel.recipients.map((recipient: any) =>
            recipient.id === userId ? { ...recipient, status } : recipient
          );
          return { ...channel, recipients: updatedRecipients };
        })
      );
    }
  });

  const handleTabChange = (tab: "home" | "friends" | "requests" | "shop") => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
    // При переключении на другую вкладку сбрасываем путь
    if (tab !== "friends") {
      navigate("/");
    } else if (tab === "friends" && location.pathname.startsWith("/home/")) {
      // Если переключаемся на друзей и мы в чате, сбрасываем путь чтобы показать список друзей
      navigate("/");
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "#3ba55d";
      case "idle":
        return "#faa61a";
      case "dnd":
        return "#ed4245";
      default:
        return "#747f8d";
    }
  };

  const filteredDMs = useMemo(() => {
    return dmChannels.filter((dm) => {
      if (!searchQuery) return true;
      const recipient = dm.recipients?.[0];
      if (!recipient) return false;
      return recipient.username?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [dmChannels, searchQuery]);

  return (
    <div className="home-view">
      <div className="home-search">
        <input
          type="text"
          placeholder="Найти или начать беседу"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="home-search-input"
        />
      </div>

      <div className="home-nav">
        <button
          className={`home-nav-item ${activeTab === "home" ? "active" : ""}`}
          onClick={() => handleTabChange("home")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <span>Главная</span>
        </button>
        <button
          className={`home-nav-item ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => handleTabChange("friends")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <span>Друзья</span>
        </button>
        <button
          className={`home-nav-item ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => handleTabChange("requests")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          <span>Запросы сообщений</span>
          {pendingRequestsCount > 0 && (
            <span className="home-nav-badge">{pendingRequestsCount}</span>
          )}
        </button>
        <button
          className={`home-nav-item ${activeTab === "shop" ? "active" : ""}`}
          onClick={() => handleTabChange("shop")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
          <span>Магазин</span>
        </button>
      </div>

      <div className="home-content">
        <div className="home-dms-header">
          <span className="home-dms-title">Личные сообщения</span>
          <button className="home-dms-add-btn" title="Создать группу">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>

        <div className="home-dms-list">
          {loading ? (
            <div className="home-empty">Загрузка...</div>
          ) : filteredDMs.length === 0 ? (
            <div className="home-empty">
              <p>Нет личных сообщений</p>
              <p className="home-empty-hint">Начните новый разговор с друзьями!</p>
            </div>
          ) : (
            filteredDMs.map((channel) => {
              const recipient = channel.recipients?.[0];
              if (!recipient) return null;

                return (
                  <div
                    key={channel.id}
                    className={`home-dm-item ${getActiveChannelId() === channel.id ? "active" : ""}`}
                    onClick={() => {
                      navigate(`/home/${channel.id}`);
                      if (onTabChange) {
                        onTabChange("friends");
                      }
                    }}
                  >
                  <div className="home-dm-avatar-wrapper">
                    <div
                      className="home-dm-avatar"
                      style={{
                        background: recipient.avatar ? "transparent" : "#5865f2",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPopupPosition({
                          x: rect.left,
                          y: rect.top + rect.height / 2,
                        });
                        setSelectedUser({
                          id: recipient.id,
                          username: recipient.username,
                          discriminator: recipient.discriminator,
                          avatar: recipient.avatar,
                          status: recipient.status || "offline",
                        });
                      }}
                    >
                      {recipient.avatar ? (
                        <img src={getAvatarUrl(recipient.avatar) || ""} alt={recipient.username} />
                      ) : (
                        <span>{recipient.username?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div
                      className="home-dm-status"
                      style={{ backgroundColor: getStatusColor(recipient.status || "offline") }}
                    />
                  </div>
                  <div className="home-dm-info">
                    <div className="home-dm-name">{recipient.username}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedUser && (
        <UserProfilePopup
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          position={popupPosition}
          onChatCreated={() => {
            loadDMChannels();
          }}
        />
      )}
    </div>
  );
}

