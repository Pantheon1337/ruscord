import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useWebSocket } from "../hooks/useWebSocket";
import api from "../api/client";
import { wsManager } from "../services/websocket";
import ChannelList from "./ChannelList";
import ChatView from "./ChatView";
import MemberList from "./MemberList";
import DMsView from "./DMsView";
import HomeView from "./HomeView";
import WelcomeScreen from "./WelcomeScreen";
import FriendsView from "./FriendsView";
import FriendRequestsView from "./FriendRequestsView";
import ShopView from "./ShopView";
import "./ServerView.css";

interface Server {
  id: string;
  name: string;
  icon?: string;
  channels: Channel[];
  members: any[];
  roles: any[];
}

interface Channel {
  id: string;
  name: string;
  type: string;
  position: number;
}

export default function ServerView() {
  const { serverId, channelId } = useParams();
  const location = useLocation();
  const { user } = useAuthStore();
  const [server, setServer] = useState<Server | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "friends" | "requests" | "shop">("home");
  const [connectedVoiceChannel, setConnectedVoiceChannel] = useState<string | null>(null);
  const [voiceStates, setVoiceStates] = useState<Map<string, string | null>>(new Map());

  const isHomePage = location.pathname === "/" || location.pathname === "/welcome" || location.pathname.startsWith("/home");

  useEffect(() => {
    // If we're on home page
    if (isHomePage) {
      // Use channelId from useParams if available, otherwise parse from pathname
      let homeChannelId = channelId;
      
      // Если channelId не получен из useParams, парсим из pathname
      if (!homeChannelId && location.pathname.startsWith("/home/")) {
        const pathParts = location.pathname.split("/home/");
        if (pathParts.length > 1 && pathParts[1]) {
          homeChannelId = pathParts[1].split("/")[0]; // Берем только первый сегмент после /home/
        }
      }
      
      if (homeChannelId && homeChannelId.trim() !== "") {
        setSelectedChannel(homeChannelId);
        setActiveTab("friends");
      } else {
        setActiveTab("home");
        setSelectedChannel(null);
      }
      setLoading(false);
      return;
    }
    
    if (!serverId && channelId) {
      // If serverId is undefined but channelId exists, it's a DM channel from /channels/@me/:channelId
      setLoading(false);
      setSelectedChannel(channelId);
      return;
    }
    
    if (serverId && serverId !== "@me") {
      loadServer();
      return;
    }
    
    if (serverId === "@me") {
      setLoading(false);
      if (channelId) {
        setSelectedChannel(channelId);
      }
      return;
    }
    
    setLoading(false);
  }, [serverId, channelId, location.pathname, isHomePage]);

  const loadServer = async () => {
    if (!serverId) return;

    try {
      const response = await api.get(`/servers/${serverId}`);
      setServer(response.data);
      if (!selectedChannel && response.data.channels.length > 0) {
        setSelectedChannel(response.data.channels[0].id);
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  // Отслеживание VOICE_STATE_UPDATE событий
  useWebSocket(
    useCallback((message) => {
      if (message.op === 0 && message.t === "VOICE_STATE_UPDATE") {
        const { user_id, channel_id } = message.d;
        if (server) {
          // Обновляем состояние для всех участников сервера
          setVoiceStates((prev) => {
            const newMap = new Map(prev);
            if (channel_id) {
              newMap.set(user_id, channel_id);
            } else {
              newMap.delete(user_id);
            }
            return newMap;
          });
        }
      }
    }, [server])
  );

  // Обновляем локальное состояние при подключении/отключении
  useEffect(() => {
    if (user?.id) {
      setVoiceStates((prev) => {
        const newMap = new Map(prev);
        if (connectedVoiceChannel) {
          newMap.set(user.id, connectedVoiceChannel);
        } else {
          newMap.delete(user.id);
        }
        return newMap;
      });
    }
  }, [connectedVoiceChannel, user?.id]);

  if (loading) {
    return <div className="server-view">Загрузка...</div>;
  }

  // Only show "Server not found" for actual server IDs (not DM channels)
  if (!server && serverId && serverId !== "@me") {
    return <div className="server-view">Сервер не найден</div>;
  }

  // Если мы на главной странице, показываем HomeView + контент справа в зависимости от вкладки
  if (isHomePage) {
    return (
      <div className="server-view">
        <HomeView 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
        />
        {activeTab === "home" && (
          <div className="home-right-content">
            <WelcomeScreen />
          </div>
        )}
        {activeTab === "friends" && (
          <>
            {selectedChannel ? (
              <ChatView channelId={selectedChannel} />
            ) : (
              <FriendsView />
            )}
          </>
        )}
        {activeTab === "requests" && (
          <FriendRequestsView />
        )}
        {activeTab === "shop" && (
          <ShopView />
        )}
      </div>
    );
  }

  // Если мы в разделе личных сообщений, показываем DMsView вместо ChannelList
  if (!serverId || serverId === "@me") {
    return (
      <div className="server-view">
        <DMsView />
        {selectedChannel && <ChatView channelId={selectedChannel} />}
      </div>
    );
  }

  const handleDisconnectVoice = () => {
    if (!server) return;
    wsManager.send({
      op: 4, // VOICE_STATE_UPDATE
      d: {
        channelId: null,
        serverId: server.id,
        selfMute: false,
        selfDeaf: false,
      },
    });
    setConnectedVoiceChannel(null);
    if (user?.id) {
      setVoiceStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(user.id);
        return newMap;
      });
    }
  };

  // Обновляем members с информацией о голосовых каналах
  const membersWithVoiceActivity = server?.members.map((member: any) => {
    const userId = member.user_id || member.id;
    const voiceChannelId = voiceStates.get(userId);
    const voiceChannel = voiceChannelId 
      ? server.channels.find((c: Channel) => c.id === voiceChannelId)
      : null;

    return {
      ...member,
      activity: voiceChannel
        ? {
            type: "voice" as const,
            name: voiceChannel.name,
          }
        : undefined,
    };
  }) || [];

  // Если мы на сервере, показываем стандартную структуру
  return (
    <div className="server-view">
      <ChannelList
        server={server!}
        selectedChannel={selectedChannel}
        onChannelSelect={setSelectedChannel}
        connectedVoiceChannel={connectedVoiceChannel}
        onVoiceChannelChange={setConnectedVoiceChannel}
      />
      {selectedChannel && <ChatView channelId={selectedChannel} />}
      <MemberList 
        members={membersWithVoiceActivity} 
        connectedVoiceChannel={connectedVoiceChannel}
        serverId={server?.id}
        onDisconnectVoice={handleDisconnectVoice}
      />
    </div>
  );
}

