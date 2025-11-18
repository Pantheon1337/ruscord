import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useCallStore } from "../store/callStore";
import { useAuthStore } from "../store/authStore";
import { wsManager } from "../services/websocket";
import { getAvatarUrl, getBannerUrl } from "../utils/imageUtils";
import "./UserProfilePopup.css";

interface UserProfilePopupProps {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
    status?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
  onChatCreated?: () => void;
}

export default function UserProfilePopup({
  user,
  isOpen,
  onClose,
  position,
  onChatCreated,
}: UserProfilePopupProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { setActiveCall } = useCallStore();
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    if (isOpen && user && user.id) {
      // Load full user profile with banner
      api.get(`/profile/${user.id}`)
        .then((response) => {
          if (response.data) {
            setUserProfile(response.data);
          }
        })
        .catch((error) => {
          // Silent error - use provided user data
          setUserProfile(null);
        });
    } else {
      setUserProfile(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Use profile data if available, otherwise use provided user data
  const displayUser = userProfile ? {
    ...user,
    banner: userProfile.customization?.banner_url || null,
  } : user;

  const handleSendMessage = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const response = await api.post("/dms", { userId: user.id });
      // Notify parent component to refresh chat list
      if (onChatCreated) {
        onChatCreated();
      }
      // Navigate to the DM channel using the new home route
      navigate(`/home/${response.data.id}`);
      onClose();
    } catch (error) {
      alert("Не удалось создать чат. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleCall = async (type: "voice" | "video") => {
    if (!user?.id || !currentUser?.id) return;
    try {
      setLoading(true);
      
      // Wait for WebSocket to be ready
      let attempts = 0;
      while (wsManager.getReadyState() !== WebSocket.OPEN && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (wsManager.getReadyState() !== WebSocket.OPEN) {
        alert("WebSocket не подключен. Попробуйте перезагрузить страницу.");
        return;
      }

      // Find or create DM channel
      let dmChannel;
      try {
        const dmResponse = await api.get(`/dms`);
        dmChannel = dmResponse.data.find((dm: any) => 
          dm.recipients && dm.recipients.some((r: any) => r.id === user.id)
        );
        
        if (!dmChannel) {
          // Create DM channel if it doesn't exist
          const createResponse = await api.post("/dms", { userId: user.id });
          dmChannel = createResponse.data;
        }
      } catch (error) {
        alert("Не удалось найти или создать чат");
        return;
      }

      const callId = `${currentUser.id}-${user.id}-${Date.now()}`;
      
      setActiveCall({
        callId,
        userId: user.id,
        channelId: dmChannel.id,
        type,
        isIncoming: false,
      });
      
      wsManager.send({
        op: 15, // CALL_START
        d: {
          userId: user.id,
          channelId: dmChannel.id,
          type,
          callId,
        },
      });
      
      onClose();
    } catch (error) {
      alert("Ошибка при инициализации звонка");
    } finally {
      setLoading(false);
    }
  };

  const getPopupStyle = (): React.CSSProperties => {
    if (!position) return {};

    const popupWidth = 340;
    const popupHeight = 280; // Approximate height
    const margin = 10;

    let left = position.x + 20; // Position to the right of the clicked element
    let top = position.y;

    // Check if popup would go off the right edge
    if (left + popupWidth + margin > window.innerWidth) {
      left = position.x - popupWidth - 20; // Position to the left instead
    }

    // Ensure popup doesn't go off screen vertically
    if (top + popupHeight / 2 + margin > window.innerHeight) {
      top = window.innerHeight - popupHeight / 2 - margin;
    }

    if (top - popupHeight / 2 < margin) {
      top = popupHeight / 2 + margin;
    }

    return {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      transform: "translateY(-50%)",
      zIndex: 10000,
    };
  };

  return (
    <>
      <div className="popup-overlay" onClick={onClose} />
      <div className="user-profile-popup" style={getPopupStyle()}>
        <div className="user-profile-popup-header">
          <div className="user-profile-popup-banner">
            {getBannerUrl(displayUser.banner) ? (
              <img src={getBannerUrl(displayUser.banner) || ""} alt="Banner" />
            ) : !displayUser.avatar && (
              <div className="user-profile-popup-banner-pattern"></div>
            )}
          </div>
          <div className="user-profile-popup-avatar-container">
            <div className="user-profile-popup-avatar">
              {displayUser.avatar ? (
                <img src={getAvatarUrl(displayUser.avatar) || ""} alt={displayUser.username} />
              ) : (
                <span>{displayUser.username.charAt(0).toUpperCase()}</span>
              )}
              <div className={`user-profile-popup-status ${displayUser.status || "offline"}`}></div>
            </div>
          </div>
        </div>

        <div className="user-profile-popup-body">
          <div className="user-profile-popup-info">
            <div className="user-profile-popup-username">
              {displayUser.username}
              <span className="user-profile-popup-discriminator">#{displayUser.discriminator}</span>
            </div>
            <div className="user-profile-popup-divider"></div>
          </div>

          {displayUser.id !== currentUser?.id && (
            <div className="user-profile-popup-actions">
              <button
                className="user-profile-popup-action-btn primary"
                onClick={handleSendMessage}
                disabled={loading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
                <span>Написать сообщение</span>
              </button>
              <button
                className="user-profile-popup-action-btn secondary"
                onClick={() => handleCall("voice")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
                <span>Начать голосовой звонок</span>
              </button>
              <button
                className="user-profile-popup-action-btn secondary"
                onClick={() => handleCall("video")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                <span>Начать видеозвонок</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

