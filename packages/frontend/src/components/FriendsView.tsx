import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getAvatarUrl } from "../utils/imageUtils";
import { useWebSocket } from "../hooks/useWebSocket";
import AddFriendModal from "./AddFriendModal";
import "./FriendsView.css";

interface Friend {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  status: string;
}

export default function FriendsView() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const loadingRef = useRef(false);

  const loadFriends = useCallback(async () => {
    // Предотвращаем множественные одновременные запросы
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      const response = await api.get("/friends");
      setFriends(response.data || []);
    } catch (error) {
      setFriends([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // Subscribe to WebSocket presence updates
  useWebSocket((message) => {
    if (message.op === 0 && message.t === "PRESENCE_UPDATE") {
      const { userId, status } = message.d;
      setFriends((prevFriends) =>
        prevFriends.map((friend) =>
          friend.id === userId ? { ...friend, status } : friend
        )
      );
    }
  });

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

  const getStatusText = (status: string) => {
    switch (status) {
      case "online":
        return "В сети";
      case "idle":
        return "Нет на месте";
      case "dnd":
        return "Не беспокоить";
      default:
        return "Не в сети";
    }
  };

  const filteredFriends = useMemo(() => {
    return friends.filter((friend) => {
      if (!searchQuery) return true;
      return friend.username?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [friends, searchQuery]);

  const handleFriendClick = async (friend: Friend) => {
    try {
      // Создать или получить DM канал с этим другом
      const response = await api.post("/dms", { userId: friend.id });
      if (response.data?.id) {
        navigate(`/home/${response.data.id}`);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  return (
    <div className="friends-view">
      <div className="friends-header">
        <h2 className="friends-title">Друзья</h2>
        <button 
          className="friends-add-btn"
          onClick={() => setShowAddFriendModal(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          <span>Добавить друга</span>
        </button>
        <div className="friends-search">
          <input
            type="text"
            placeholder="Поиск друзей"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="friends-search-input"
          />
        </div>
      </div>

      <div className="friends-content">
        {loading ? (
          <div className="friends-empty">Загрузка...</div>
        ) : filteredFriends.length === 0 ? (
          <div className="friends-empty">
            <p>Нет друзей</p>
            <p className="friends-empty-hint">Добавьте друзей, чтобы начать общение!</p>
          </div>
        ) : (
          <div className="friends-list">
            {filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className="friends-item"
                onClick={() => handleFriendClick(friend)}
              >
                <div className="friends-avatar-wrapper">
                  <div
                    className="friends-avatar"
                    style={{
                      background: friend.avatar ? "transparent" : "#5865f2",
                    }}
                  >
                    {friend.avatar ? (
                      <img src={getAvatarUrl(friend.avatar) || ""} alt={friend.username} />
                    ) : (
                      <span>{friend.username?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div
                    className="friends-status"
                    style={{ backgroundColor: getStatusColor(friend.status) }}
                  />
                </div>
                <div className="friends-info">
                  <div className="friends-name">{friend.username}</div>
                  <div className="friends-status-text">{getStatusText(friend.status)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddFriendModal && (
        <AddFriendModal
          isOpen={showAddFriendModal}
          onClose={() => setShowAddFriendModal(false)}
          onFriendAdded={() => {
            loadFriends();
            setShowAddFriendModal(false);
          }}
        />
      )}
    </div>
  );
}

