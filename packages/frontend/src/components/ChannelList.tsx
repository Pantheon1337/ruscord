import { useState, useMemo, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { wsManager } from "../services/websocket";
import { Server } from "./ServerView";
import "./ChannelList.css";

interface ChannelListProps {
  server: Server;
  selectedChannel: string | null;
  onChannelSelect: (channelId: string) => void;
  connectedVoiceChannel?: string | null;
  onVoiceChannelChange?: (channelId: string | null) => void;
}

export default function ChannelList({
  server,
  selectedChannel,
  onChannelSelect,
  connectedVoiceChannel: externalConnectedVoiceChannel,
  onVoiceChannelChange,
}: ChannelListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [internalConnectedVoiceChannel, setInternalConnectedVoiceChannel] = useState<string | null>(null);
  const { user } = useAuthStore();
  
  const connectedVoiceChannel = externalConnectedVoiceChannel !== undefined 
    ? externalConnectedVoiceChannel 
    : internalConnectedVoiceChannel;

  // Обновляем состояние при подключении/отключении
  useEffect(() => {
    if (connectedVoiceChannel && user?.id && onVoiceChannelChange) {
      // Уведомляем родителя о подключении
      onVoiceChannelChange(connectedVoiceChannel);
    }
  }, [connectedVoiceChannel, user?.id, onVoiceChannelChange]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery) return server.channels;
    const query = searchQuery.toLowerCase();
    return server.channels.filter((c) => c.name.toLowerCase().includes(query));
  }, [server.channels, searchQuery]);

  const textChannels = filteredChannels.filter((c) => c.type === "TEXT");
  const voiceChannels = filteredChannels.filter((c) => c.type === "VOICE");

  const handleVoiceChannelClick = (channelId: string) => {
    if (connectedVoiceChannel === channelId) {
      // Отключиться от канала
      wsManager.send({
        op: 4, // VOICE_STATE_UPDATE
        d: {
          channelId: null,
          serverId: server.id,
          selfMute: false,
          selfDeaf: false,
        },
      });
      if (onVoiceChannelChange) {
        onVoiceChannelChange(null);
      } else {
        setInternalConnectedVoiceChannel(null);
      }
    } else {
      // Подключиться к каналу
      wsManager.send({
        op: 4, // VOICE_STATE_UPDATE
        d: {
          channelId: channelId,
          serverId: server.id,
          selfMute: false,
          selfDeaf: false,
        },
      });
      if (onVoiceChannelChange) {
        onVoiceChannelChange(channelId);
      } else {
        setInternalConnectedVoiceChannel(channelId);
      }
    }
  };

  return (
    <div className="channel-list">
      <div className="server-header">
        <div className="server-header-content">
          <h2>{server.name}</h2>
        </div>
        <button className="server-header-menu" title="Меню сервера">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
            <path d="M9 0C4.03 0 0 4.03 0 9C0 13.97 4.03 18 9 18C13.97 18 18 13.97 18 9C18 4.03 13.97 0 9 0ZM9 16C5.13 16 2 12.87 2 9C2 5.13 5.13 2 9 2C12.87 2 16 5.13 16 9C16 12.87 12.87 16 9 16ZM9 4C6.24 4 4 6.24 4 9C4 11.76 6.24 14 9 14C11.76 14 14 11.76 14 9C14 6.24 11.76 4 9 4ZM9 12C7.34 12 6 10.66 6 9C6 7.34 7.34 6 9 6C10.66 6 12 7.34 12 9C12 10.66 10.66 12 9 12Z"/>
          </svg>
        </button>
      </div>

      <div className="channel-search">
        <input
          type="text"
          placeholder="Поиск каналов"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="channel-search-input"
        />
      </div>

      <div className="channels-container">
        {textChannels.length > 0 && (
          <div className="channel-category">
            <div className="category-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
              </svg>
              <span>ТЕКСТОВЫЕ КАНАЛЫ</span>
            </div>
            {textChannels.map((channel) => (
              <button
                key={channel.id}
                className={`channel-item ${selectedChannel === channel.id ? "active" : ""}`}
                onClick={() => onChannelSelect(channel.id)}
              >
                <div className="unread-indicator"></div>
                <span className="channel-hash">#</span>
                <span>{channel.name}</span>
                <div className="channel-actions">
                  <button className="channel-action-btn" title="Настройки канала">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M14 7v2h-1v6H3V9H2V7h1V1h10v6h1zm-2 0V2H4v5H2v2h2v5h8V9h2V7h-2z"/>
                    </svg>
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}

        {voiceChannels.length > 0 && (
          <div className="channel-category">
            <div className="category-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
              <span>ГОЛОСОВЫЕ КАНАЛЫ</span>
            </div>
            {voiceChannels.map((channel) => (
              <button
                key={channel.id}
                className={`channel-item voice ${selectedChannel === channel.id ? "active" : ""} ${connectedVoiceChannel === channel.id ? "connected" : ""}`}
                onClick={() => handleVoiceChannelClick(channel.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
                <span className="channel-name">{channel.name}</span>
                <div className="channel-actions">
                  <button className="channel-action-btn" title="Настройки канала">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M14 7v2h-1v6H3V9H2V7h1V1h10v6h1zm-2 0V2H4v5H2v2h2v5h8V9h2V7h-2z"/>
                    </svg>
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

