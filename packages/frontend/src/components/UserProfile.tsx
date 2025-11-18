import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { getAvatarUrl } from "../utils/imageUtils";
import UserProfilePopup from "./UserProfilePopup";
import UserSettingsModal from "./UserSettingsModal";
import "./UserProfile.css";

export default function UserProfile() {
  const { user, logout } = useAuthStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | undefined>();
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserMenu]);

  return (
    <div className="user-profile" ref={menuRef}>
      <div 
        className="user-profile-main"
        onClick={() => setShowUserMenu(!showUserMenu)}
      >
        <div className="user-profile-avatar-wrapper">
          <div 
            className="user-profile-avatar"
            ref={avatarRef}
            onClick={(e) => {
              e.stopPropagation();
              if (avatarRef.current) {
                const rect = avatarRef.current.getBoundingClientRect();
                setPopupPosition({
                  x: rect.left,
                  y: rect.top + rect.height / 2,
                });
                setShowProfile(true);
              }
            }}
          >
            {user?.avatar ? (
              <img src={getAvatarUrl(user.avatar) || ""} alt={user.username} />
            ) : (
              <span>{user?.username?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="user-profile-status-indicator online"></div>
        </div>
        <div className="user-profile-info">
          <div className="user-profile-name">{user?.username}</div>
          <div className="user-profile-tag">#{user?.discriminator}</div>
        </div>
      </div>
      
      <div className="user-profile-actions">
        <button
          className={`user-profile-action-btn ${isMuted ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
          title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            {isMuted ? (
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            ) : (
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            )}
          </svg>
        </button>
        <button
          className={`user-profile-action-btn ${isDeafened ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsDeafened(!isDeafened);
          }}
          title={isDeafened ? "Включить звук" : "Выключить звук"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            {isDeafened ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            )}
          </svg>
        </button>
        <button
          className="user-profile-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowSettings(true);
            setShowUserMenu(false);
          }}
          title="Настройки пользователя"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
        </button>
      </div>

      {showUserMenu && (
        <div className="user-profile-menu">
          <div className="user-profile-menu-item" onClick={logout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 17L21 12L16 7V10H9V14H16V17ZM4 5H12V3H4C2.89 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z"/>
            </svg>
            <span>Выйти</span>
          </div>
        </div>
      )}

      {showProfile && user && (
        <UserProfilePopup
          user={{
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
            status: user.status,
          }}
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          position={popupPosition}
        />
      )}

      {showSettings && (
        <UserSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

