import { useState, useMemo } from "react";
import { getAvatarUrl } from "../utils/imageUtils";
import UserProfilePopup from "./UserProfilePopup";
import "./MemberList.css";

interface Member {
  id: string;
  user_id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  status?: "online" | "idle" | "dnd" | "offline";
  nickname?: string;
  activity?: {
    type: "voice" | "streaming";
    name: string;
  };
}

interface MemberListProps {
  members?: Member[];
  connectedVoiceChannel?: string | null;
  serverId?: string;
  onDisconnectVoice?: () => void;
}

export default function MemberList({ 
  members = [], 
  connectedVoiceChannel,
  serverId,
  onDisconnectVoice 
}: MemberListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | undefined>();

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    const query = searchQuery.toLowerCase();
    return members.filter((m) => {
      const displayName = m.nickname || m.username || "";
      return displayName.toLowerCase().includes(query) || 
             m.username?.toLowerCase().includes(query);
    });
  }, [members, searchQuery]);
  // Сортируем участников: сначала те, кто в голосовом канале, затем по статусу
  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      // Участники в голосовом канале выше
      if (a.activity?.type === "voice" && b.activity?.type !== "voice") return -1;
      if (a.activity?.type !== "voice" && b.activity?.type === "voice") return 1;
      return 0;
    });
  }, [filteredMembers]);

  const onlineMembers = sortedMembers.filter((m) => m.status === "online");
  const idleMembers = sortedMembers.filter((m) => m.status === "idle");
  const dndMembers = sortedMembers.filter((m) => m.status === "dnd");
  const offlineMembers = sortedMembers.filter((m) => !m.status || m.status === "offline");

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

  const renderMember = (member: Member) => {
    const displayName = member.nickname || member.username || "";
    return (
      <div key={member.id || member.user_id} className="member-item">
        <div className="member-avatar-wrapper">
          <div
            className="member-avatar"
            style={{
              background: member.avatar ? "transparent" : "#5865f2",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!member.user_id && !member.id) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setPopupPosition({
                x: rect.left,
                y: rect.top + rect.height / 2,
              });
              setSelectedUser({
                id: member.user_id || member.id,
                username: member.username || "Unknown",
                discriminator: member.discriminator || "0000",
                avatar: member.avatar || null,
                status: member.status || "offline",
              });
            }}
          >
            {member.avatar ? (
              <img src={getAvatarUrl(member.avatar) || ""} alt={member.username || ""} />
            ) : (
              <span>{(member.username || "?").charAt(0).toUpperCase()}</span>
            )}
          </div>
          {member.status && (
            <div
              className="member-status-indicator"
              style={{ backgroundColor: getStatusColor(member.status) }}
            />
          )}
        </div>
        <div className="member-info">
          <div className="member-name-wrapper">
            <span className="member-name">{displayName}</span>
          {member.activity && (
            <div className="member-activity">
              {member.activity.type === "voice" && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              )}
              {member.activity.type === "streaming" && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
              )}
              <span className="member-activity-name">{member.activity.name}</span>
            </div>
          )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="member-list">
      <div className="member-list-header">
        <span>УЧАСТНИКИ — {members.length}</span>
      </div>
      <div className="member-search">
        <input
          type="text"
          placeholder="Поиск участников"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="member-search-input"
        />
      </div>
      <div className="member-list-content">
        {onlineMembers.length > 0 && (
          <div className="member-group">
            <div className="member-group-header">
              <span>В сети — {onlineMembers.length}</span>
            </div>
            {onlineMembers.map(renderMember)}
          </div>
        )}
        {idleMembers.length > 0 && (
          <div className="member-group">
            <div className="member-group-header">
              <span>Неактивен — {idleMembers.length}</span>
            </div>
            {idleMembers.map(renderMember)}
          </div>
        )}
        {dndMembers.length > 0 && (
          <div className="member-group">
            <div className="member-group-header">
              <span>Не беспокоить — {dndMembers.length}</span>
            </div>
            {dndMembers.map(renderMember)}
          </div>
        )}
        {offlineMembers.length > 0 && (
          <div className="member-group">
            <div className="member-group-header">
              <span>Не в сети — {offlineMembers.length}</span>
            </div>
            {offlineMembers.map(renderMember)}
          </div>
        )}
      </div>

      {selectedUser && (
        <UserProfilePopup
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          position={popupPosition}
        />
      )}

      {connectedVoiceChannel && onDisconnectVoice && (
        <div className="voice-controls">
          <div className="voice-controls-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
            <span>Подключен к голосовому каналу</span>
          </div>
          <button className="voice-disconnect-btn" onClick={onDisconnectVoice} title="Отключиться">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

