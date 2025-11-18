import { useState, useEffect } from "react";
import { wsManager } from "../services/websocket";
import api from "../api/client";
import { getAvatarUrl } from "../utils/imageUtils";
import "./FriendRequestsView.css";

interface FriendRequest {
  id: string;
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
    status?: string;
  };
  createdAt: string;
}

export default function FriendRequestsView() {
  const [friendRequests, setFriendRequests] = useState<{ sent: FriendRequest[]; received: FriendRequest[] }>({
    sent: [],
    received: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriendRequests();
  }, []);

  // Handle WebSocket messages for friend requests
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.op === 0 && message.t === "FRIEND_REQUEST") {
        // New friend request received
        loadFriendRequests();
      }
    };

    const unsubscribe = wsManager.subscribe(handleMessage);
    return unsubscribe;
  }, []);

  const loadFriendRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get("/friends/requests");
      setFriendRequests(response.data || { sent: [], received: [] });
    } catch (error) {
      setFriendRequests({ sent: [], received: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await api.post(`/friends/${requestId}/accept`);
      await loadFriendRequests();
      // Trigger a custom event to update the badge count
      window.dispatchEvent(new CustomEvent("friendRequestUpdated"));
    } catch (error) {
      alert("Не удалось принять запрос");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await api.delete(`/friends/${requestId}`);
      await loadFriendRequests();
      // Trigger a custom event to update the badge count
      window.dispatchEvent(new CustomEvent("friendRequestUpdated"));
    } catch (error) {
      alert("Не удалось отклонить запрос");
    }
  };

  const getStatusColor = (status?: string) => {
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

  return (
    <div className="friend-requests-view">
      <div className="friend-requests-header">
        <h2 className="friend-requests-title">Запросы на дружбу</h2>
      </div>

      <div className="friend-requests-content">
        {loading ? (
          <div className="friend-requests-empty">Загрузка...</div>
        ) : (
          <>
            {/* Received requests */}
            <div className="friend-requests-section">
              <h3 className="friend-requests-section-title">
                Входящие запросы ({friendRequests.received.length})
              </h3>
              {friendRequests.received.length === 0 ? (
                <div className="friend-requests-empty">
                  <p>Нет входящих запросов</p>
                </div>
              ) : (
                <div className="friend-requests-list">
                  {friendRequests.received.map((request) => (
                    <div key={request.id} className="friend-request-item">
                      <div className="friend-request-avatar-wrapper">
                        <div
                          className="friend-request-avatar"
                          style={{
                            background: request.user.avatar ? "transparent" : "#5865f2",
                          }}
                        >
                          {request.user.avatar ? (
                            <img src={getAvatarUrl(request.user.avatar) || ""} alt={request.user.username} />
                          ) : (
                            <span>{request.user.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div
                          className="friend-request-status"
                          style={{ backgroundColor: getStatusColor(request.user.status) }}
                        />
                      </div>
                      <div className="friend-request-info">
                        <div className="friend-request-name">
                          {request.user.username}
                          <span className="friend-request-tag">#{request.user.discriminator}</span>
                        </div>
                        <div className="friend-request-actions">
                          <button
                            className="friend-request-btn accept"
                            onClick={() => handleAccept(request.id)}
                          >
                            Принять
                          </button>
                          <button
                            className="friend-request-btn reject"
                            onClick={() => handleReject(request.id)}
                          >
                            Отклонить
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent requests */}
            <div className="friend-requests-section">
              <h3 className="friend-requests-section-title">
                Исходящие запросы ({friendRequests.sent.length})
              </h3>
              {friendRequests.sent.length === 0 ? (
                <div className="friend-requests-empty">
                  <p>Нет исходящих запросов</p>
                </div>
              ) : (
                <div className="friend-requests-list">
                  {friendRequests.sent.map((request) => (
                    <div key={request.id} className="friend-request-item">
                      <div className="friend-request-avatar-wrapper">
                        <div
                          className="friend-request-avatar"
                          style={{
                            background: request.user.avatar ? "transparent" : "#5865f2",
                          }}
                        >
                          {request.user.avatar ? (
                            <img src={getAvatarUrl(request.user.avatar) || ""} alt={request.user.username} />
                          ) : (
                            <span>{request.user.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div
                          className="friend-request-status"
                          style={{ backgroundColor: getStatusColor(request.user.status) }}
                        />
                      </div>
                      <div className="friend-request-info">
                        <div className="friend-request-name">
                          {request.user.username}
                          <span className="friend-request-tag">#{request.user.discriminator}</span>
                        </div>
                        <div className="friend-request-actions">
                          <button
                            className="friend-request-btn cancel"
                            onClick={() => handleReject(request.id)}
                          >
                            Отменить
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

