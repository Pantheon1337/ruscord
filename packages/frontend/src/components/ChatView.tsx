import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useCallStore } from "../store/callStore";
import { useWebSocket } from "../hooks/useWebSocket";
import { wsManager } from "../services/websocket";
import { getAvatarUrl } from "../utils/imageUtils";
import UserProfilePopup from "./UserProfilePopup";
import "./ChatView.css";

interface Message {
  id: string;
  channelId: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  content: string;
  attachments: any[];
  reactions: any[];
  editedAt?: string;
  createdAt: string;
}

interface ChatViewProps {
  channelId: string;
}

export default function ChatView({ channelId }: ChatViewProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const { user } = useAuthStore();
  const wsRef = useWebSocket();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | undefined>();
  const { setActiveCall } = useCallStore();

  useEffect(() => {
    if (!channelId) return;
    
    // Предотвращаем множественные одновременные запросы
    if (loadingRef.current) return;

    let cancelled = false;
    
    const loadData = async () => {
      loadingRef.current = true;
      setLoading(true);
      setChannel(null);
      setMessages([]);
      
      try {
        // Загружаем сообщения параллельно
        const messagesPromise = api.get(`/messages/channel/${channelId}`).catch(() => ({ data: [] }));
        
        // Пытаемся загрузить канал, если не получается - пробуем как DM
        let channelData: any = null;
        try {
          const response = await api.get(`/channels/${channelId}`);
          channelData = response.data;
        } catch (channelError: any) {
          // Если это не обычный канал, пробуем загрузить как DM
          if (channelError.response?.status === 404 || channelError.response?.status === 403) {
            try {
              const dmResponse = await api.get(`/dms`);
              const dmChannel = dmResponse.data.find((dm: any) => dm.id === channelId);
              if (dmChannel) {
                channelData = {
                  id: dmChannel.id,
                  name: dmChannel.recipients && dmChannel.recipients.length > 0 
                    ? dmChannel.recipients[0].username 
                    : "DM",
                  type: "DM",
                  recipients: dmChannel.recipients || [],
                };
              } else {
                // Если DM канал не найден в списке, создаем базовую структуру
                console.warn(`DM channel ${channelId} not found in list`);
                channelData = {
                  id: channelId,
                  name: "DM",
                  type: "DM",
                  recipients: [],
                };
              }
            } catch (dmError) {
              console.error("Error loading DM channels:", dmError);
              // Создаем базовую структуру для DM канала
              channelData = {
                id: channelId,
                name: "DM",
                type: "DM",
                recipients: [],
              };
            }
          } else {
            console.error("Error loading channel:", channelError);
          }
        }
        
        const messagesData = await messagesPromise;
        
        if (!cancelled) {
          // Всегда устанавливаем channelData, даже если это базовая структура
          if (channelData) {
            setChannel(channelData);
          } else {
            // Если канал не найден, создаем базовую структуру
            setChannel({
              id: channelId,
              name: "DM",
              type: "DM",
              recipients: [],
            });
          }
          setMessages(messagesData.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          // При ошибке создаем базовую структуру канала, чтобы компонент мог отображаться
          setChannel({
            id: channelId,
            name: "DM",
            type: "DM",
            recipients: [],
          });
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      cancelled = true;
      loadingRef.current = false;
    };
  }, [channelId]);

  // Subscribe to WebSocket messages for this channel
  useWebSocket((message) => {
    if (message.op === 0) {
      if (message.t === "MESSAGE_CREATE") {
        if (message.d.channelId === channelId) {
          setMessages((prev) => [...prev, message.d]);
        }
      } else if (message.t === "CALL_START") {
        // Incoming call - handled globally in MainLayout
      }
    }
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChannel = async () => {
    try {
      // Try to load as regular channel first
      try {
        const response = await api.get(`/channels/${channelId}`);
        setChannel(response.data);
        return;
      } catch (channelError: any) {
        // If it fails (404), try to load as DM channel
        if (channelError.response?.status === 404) {
          try {
            const dmResponse = await api.get(`/dms`);
            const dmChannel = dmResponse.data.find((dm: any) => dm.id === channelId);
            if (dmChannel) {
              // Create channel object from DM channel
              setChannel({
                id: dmChannel.id,
                name: dmChannel.recipients && dmChannel.recipients.length > 0 
                  ? dmChannel.recipients[0].username 
                  : "DM",
                type: "DM",
              });
              return;
            } else {
              throw new Error("Channel not found");
            }
          } catch (dmError) {
            throw dmError;
          }
        } else {
          throw channelError;
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const loadMessages = async () => {
    try {
      const response = await api.get(`/messages/channel/${channelId}`);
      setMessages(response.data || []);
    } catch (error: any) {
      setMessages([]);
      // Don't throw error, just set empty messages
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await api.post("/messages", {
        channelId,
        content: newMessage,
      });
      setNewMessage("");
    } catch (error) {
      // Silent error handling
    }
  };

  const handleCall = async (type: "voice" | "video") => {
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
    
    if (!channel?.type || channel.type !== "DM") {
      alert("Звонки доступны только в личных сообщениях");
      return;
    }

    // For DM channels, get the other user's ID
    if (channel?.type === "DM") {
      try {
        const dmResponse = await api.get(`/dms`);
        const dmChannel = dmResponse.data.find((dm: any) => dm.id === channelId);
        if (dmChannel && dmChannel.recipients && dmChannel.recipients.length > 0) {
          const targetUserId = dmChannel.recipients[0].id;
          const callId = `${user?.id}-${targetUserId}-${Date.now()}`;
          
          setActiveCall({
            callId,
            userId: targetUserId,
            channelId,
            type,
            isIncoming: false,
          });
          
          const sent = wsManager.send({
            op: 15, // CALL_START
            d: {
              userId: targetUserId,
              channelId,
              type,
              callId,
            },
          });
          
          if (!sent) {
            alert("Не удалось отправить запрос на звонок. Проверьте соединение.");
          }
        } else {
          alert("Не удалось найти получателя звонка");
        }
      } catch (error) {
        alert("Ошибка при инициализации звонка");
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!channelId) {
    return (
      <div className="chat-view" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div>Канал не выбран</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chat-view" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div>Загрузка сообщений...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="chat-view" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div>Канал не найден</div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="channel-info">
          <span className="channel-hash">#</span>
          <span className="channel-name">{channel?.name || "channel"}</span>
        </div>
        <div className="chat-header-actions">
          <button className="chat-action-btn" title="Поиск">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
          <button className="chat-action-btn" title="Закрепленные сообщения">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
          </button>
          <button className="chat-action-btn" title="Список участников">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </button>
          {channel?.type === "DM" && (
            <button
              className="chat-action-btn"
              title="Звонок"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  handleCall("video");
                } catch (error) {
                  // Silent error handling
                }
              }}
              style={{ cursor: "pointer", zIndex: 1000, pointerEvents: "auto" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className="message">
            <div
              className="message-avatar"
              onClick={(e) => {
                e.stopPropagation();
                if (!message.author?.id) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setPopupPosition({
                  x: rect.left,
                  y: rect.top + rect.height / 2,
                });
                setSelectedUser({
                  id: message.author.id,
                  username: message.author.username || "Unknown",
                  discriminator: message.author.discriminator || "0000",
                  avatar: message.author.avatar || null,
                  status: "online", // TODO: Get actual status
                });
              }}
              style={{ cursor: "pointer" }}
            >
              {message.author.avatar ? (
                <img 
                  src={getAvatarUrl(message.author.avatar) || ""} 
                  alt={message.author.username}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector("span")) {
                      const span = document.createElement("span");
                      span.textContent = message.author.username?.charAt(0).toUpperCase() || "?";
                      parent.appendChild(span);
                    }
                  }}
                />
              ) : (
                <span>{message.author.username?.charAt(0).toUpperCase() || "?"}</span>
              )}
            </div>
            <div className="message-content">
              <div className="message-header">
                <span className="message-author">{message.author.username}</span>
                <span className="message-tag">#{message.author.discriminator}</span>
                <span className="message-timestamp">
                  {new Date(message.createdAt).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="message-text">{message.content}</div>
              {message.reactions && message.reactions.length > 0 && (
                <div className="message-reactions">
                  {message.reactions.map((reaction: any, idx: number) => (
                    <div
                      key={idx}
                      className={`message-reaction ${reaction.users?.includes(user?.id) ? "own" : ""}`}
                    >
                      <span className="message-reaction-emoji">{reaction.emoji}</span>
                      <span className="message-reaction-count">{reaction.count || 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleSendMessage}>
        <div className="message-input-wrapper">
          <div className="message-input-actions">
            <button type="button" className="message-input-btn" title="Прикрепить файл">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
              </svg>
            </button>
          </div>
          <textarea
            className="message-input"
            placeholder={`Написать сообщение в #${channel?.name || "канал"}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            rows={1}
          />
          <button
            type="button"
            className="message-input-btn"
            title="Эмодзи"
            onClick={(e) => {
              e.preventDefault();
              // TODO: Open emoji picker
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
            </svg>
          </button>
          <button
            type="button"
            className="message-input-btn"
            title="GIF"
            onClick={(e) => {
              e.preventDefault();
              // TODO: Open GIF picker
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.5 9H13v6h-1.5zM9 9H6c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h3c.6 0 1-.5 1-1v-2H8.5v1.5h-2v-3H10V10c0-.5-.4-1-1-1zm10 1.5V9h-4.5v6H16v-2h2v-1.5h-2v-1z"/>
            </svg>
          </button>
          <button
            type="submit"
            className="message-send-btn"
            title="Отправить сообщение"
            style={{ opacity: newMessage.trim() ? 1 : 0, pointerEvents: newMessage.trim() ? "auto" : "none" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </form>

      {selectedUser && (
        <UserProfilePopup
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          position={popupPosition}
          onChatCreated={() => {
            // Reload will happen automatically via useEffect when channelId changes
          }}
        />
      )}
    </div>
  );
}

