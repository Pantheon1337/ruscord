import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getAvatarUrl } from "../utils/imageUtils";
import AddFriendModal from "./AddFriendModal";
import UserProfilePopup from "./UserProfilePopup";
import { useWebSocket } from "../hooks/useWebSocket";
import "./DMsView.css";

interface DMChannel {
  id: string;
  type: string;
  recipients?: any[];
  updatedAt: string;
}

interface Friend {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  status: string;
}

interface FriendRequest {
  id: string;
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
    status: string;
  };
  createdAt: string;
}

export default function DMsView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"chats" | "friends" | "requests">("friends");
  const [dmChannels, setDmChannels] = useState<DMChannel[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<{ sent: FriendRequest[]; received: FriendRequest[] }>({
    sent: [],
    received: [],
  });
  const [loading, setLoading] = useState(true);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Friend | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | undefined>();
  const friendItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (activeTab === "chats") {
      loadDMChannels();
    } else if (activeTab === "friends") {
      loadFriends();
    } else if (activeTab === "requests") {
      loadFriendRequests();
    }
  }, [activeTab]);

  useEffect(() => {
    // Load friend requests on mount
    loadFriendRequests();
    // Load DM channels on mount to keep them updated
    if (activeTab === "chats") {
      loadDMChannels();
    }
  }, []);

  // Reload DM channels when switching to chats tab
  useEffect(() => {
    if (activeTab === "chats") {
      loadDMChannels();
    }
  }, [activeTab]);

  // Handle WebSocket messages for friend requests and presence updates
  useWebSocket((message) => {
    if (message.op === 0) {
      if (message.t === "FRIEND_REQUEST") {
        // New friend request received
        loadFriendRequests();
        // Switch to requests tab if not already there
        if (activeTab !== "requests") {
          // Show notification or badge update
        }
      } else if (message.t === "PRESENCE_UPDATE") {
        // Update friend status
        const { user: updatedUser, status } = message.d;
        setFriends((prev) =>
          prev.map((friend) =>
            friend.id === updatedUser.id ? { ...friend, status } : friend
          )
        );
      }
    }
  });

  const loadDMChannels = async () => {
    try {
      setLoading(true);
      const response = await api.get("/dms");
      setDmChannels(response.data);
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await api.get("/friends");
      setFriends(response.data);
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const response = await api.get("/friends/requests");
      setFriendRequests(response.data);
    } catch (error) {
      // Silent error handling
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await api.post(`/friends/${requestId}/accept`);
      loadFriendRequests();
      loadFriends();
    } catch (error) {
      // Silent error handling
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.delete(`/friends/${requestId}`);
      loadFriendRequests();
    } catch (error) {
      // Silent error handling
    }
  };

  return (
    <div className="dms-view">
      <div className="dms-header">
        <div className="dms-header-content">
          <div className="dms-logo">
            <img src="/logo.png" alt="Ruscord" />
          </div>
          <h2>Личные сообщения</h2>
        </div>
      </div>

      <div className="dms-tabs">
        <button
          className={`dms-tab ${activeTab === "chats" ? "active" : ""}`}
          onClick={() => setActiveTab("chats")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
          <span>Чаты</span>
        </button>
        <button
          className={`dms-tab ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <span>Друзья</span>
        </button>
        <button
          className={`dms-tab ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>
            Запросы
            {friendRequests.received.length > 0 && (
              <span className="dms-tab-badge">{friendRequests.received.length}</span>
            )}
          </span>
        </button>
        {activeTab === "friends" && (
          <button
            className="dms-add-friend-btn"
            onClick={() => setShowAddFriendModal(true)}
            title="Добавить друга"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        )}
      </div>

      <div className="dms-content">
        {activeTab === "chats" && (
          <div className="dms-chats">
            {loading ? (
              <div className="dms-empty">Загрузка...</div>
            ) : dmChannels.length === 0 ? (
              <div className="dms-empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                <p>У вас пока нет личных сообщений</p>
                <p className="dms-empty-hint">Начните новый разговор с друзьями!</p>
              </div>
            ) : (
              <div className="dms-chats-list">
                {dmChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="dms-chat-item"
                    onClick={() => navigate(`/channels/@me/${channel.id}`)}
                  >
                    <div className="dms-chat-avatar">
                      {channel.recipients && channel.recipients.length > 0 ? (
                        channel.recipients[0].avatar ? (
                          <img src={channel.recipients[0].avatar} alt={channel.recipients[0].username} />
                        ) : (
                          <span>{channel.recipients[0].username?.charAt(0).toUpperCase()}</span>
                        )
                      ) : (
                        <span>?</span>
                      )}
                    </div>
                    <div className="dms-chat-info">
                      <div className="dms-chat-name">
                        {channel.recipients && channel.recipients.length > 0
                          ? channel.recipients[0].username
                          : "Неизвестный пользователь"}
                      </div>
                      <div className="dms-chat-preview">Нажмите, чтобы открыть чат</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "friends" && (
          <div className="dms-friends">
            {loading ? (
              <div className="dms-empty">Загрузка...</div>
            ) : friends.length === 0 ? (
              <div className="dms-empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <p>У вас пока нет друзей</p>
                <p className="dms-empty-hint">Найдите друзей по имени пользователя и добавьте их!</p>
              </div>
            ) : (
              <div className="dms-friends-list">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    ref={(el) => (friendItemRefs.current[friend.id] = el)}
                    className="dms-friend-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPopupPosition({
                        x: rect.left,
                        y: rect.top + rect.height / 2,
                      });
                      setSelectedUser(friend);
                    }}
                  >
                    <div className="dms-friend-avatar">
                      {friend.avatar ? (
                        <img src={getAvatarUrl(friend.avatar) || ""} alt={friend.username} />
                      ) : (
                        <span>{friend.username.charAt(0).toUpperCase()}</span>
                      )}
                      <div className={`dms-friend-status ${friend.status}`}></div>
                    </div>
                    <div className="dms-friend-info">
                      <div className="dms-friend-name">{friend.username}</div>
                      <div className="dms-friend-tag">#{friend.discriminator}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "requests" && (
          <div className="dms-requests">
            <div className="dms-requests-section">
              <h3 className="dms-requests-title">Входящие запросы</h3>
              {friendRequests.received.length === 0 ? (
                <div className="dms-empty-small">Нет входящих запросов</div>
              ) : (
                <div className="dms-requests-list">
                  {friendRequests.received.map((request) => (
                    <div key={request.id} className="dms-request-item">
                      <div className="dms-request-avatar">
                        {request.user.avatar ? (
                          <img src={getAvatarUrl(request.user.avatar) || ""} alt={request.user.username} />
                        ) : (
                          <span>{request.user.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="dms-request-info">
                        <div className="dms-request-name">{request.user.username}</div>
                        <div className="dms-request-tag">#{request.user.discriminator}</div>
                      </div>
                      <div className="dms-request-actions">
                        <button
                          className="dms-request-accept"
                          onClick={() => handleAcceptRequest(request.id)}
                        >
                          Принять
                        </button>
                        <button
                          className="dms-request-reject"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dms-requests-section">
              <h3 className="dms-requests-title">Исходящие запросы</h3>
              {friendRequests.sent.length === 0 ? (
                <div className="dms-empty-small">Нет исходящих запросов</div>
              ) : (
                <div className="dms-requests-list">
                  {friendRequests.sent.map((request) => (
                    <div key={request.id} className="dms-request-item">
                      <div className="dms-request-avatar">
                        {request.user.avatar ? (
                          <img src={getAvatarUrl(request.user.avatar) || ""} alt={request.user.username} />
                        ) : (
                          <span>{request.user.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="dms-request-info">
                        <div className="dms-request-name">{request.user.username}</div>
                        <div className="dms-request-tag">#{request.user.discriminator}</div>
                      </div>
                      <div className="dms-request-status">Ожидает ответа</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AddFriendModal
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        onFriendAdded={() => {
          loadFriends();
          loadFriendRequests();
        }}
      />

      {selectedUser && (
        <UserProfilePopup
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          position={popupPosition}
          onChatCreated={() => {
            loadDMChannels();
            setActiveTab("chats");
          }}
        />
      )}
    </div>
  );
}

