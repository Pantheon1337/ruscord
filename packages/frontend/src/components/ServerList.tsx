import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/client";
import CreateServerModal from "./CreateServerModal";
import { getServerIconUrl } from "../utils/imageUtils";
import "./ServerList.css";

interface Server {
  id: string;
  name: string;
  icon?: string;
}

export default function ServerList() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const loadServers = async () => {
    try {
      const response = await api.get("/servers");
      setServers(response.data);
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleServerClick = (serverId: string) => {
    navigate(`/servers/${serverId}`);
  };

  const isServerActive = (serverId: string) => {
    return location.pathname.startsWith(`/servers/${serverId}`);
  };

  const isHomeActive = () => {
    return location.pathname === "/" || location.pathname === "/welcome";
  };

  if (loading) {
    return <div className="server-list">Загрузка...</div>;
  }

  return (
    <div className="server-list">
      {/* Кнопка главной страницы */}
      <button
        className={`server-item home-btn ${isHomeActive() ? "active" : ""}`}
        title="Главная"
        onClick={() => navigate("/")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </button>

      <div className="server-divider" />

      {/* Список серверов */}
      <div className="servers-container">
        {servers.map((server) => (
          <button
            key={server.id}
            className={`server-item ${isServerActive(server.id) ? "active" : ""}`}
            onClick={() => handleServerClick(server.id)}
            title={server.name}
          >
            {server.icon ? (
              <img src={getServerIconUrl(server.icon) || ""} alt={server.name} />
            ) : (
              <span>{server.name.charAt(0).toUpperCase()}</span>
            )}
          </button>
        ))}
      </div>

      <div className="server-divider" />

      {/* Кнопка добавления сервера */}
      <button
        className="server-item add-server-btn"
        title="Добавить сервер"
        onClick={() => setIsCreateModalOpen(true)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H13V4C13 3.73478 12.8946 3.48043 12.7071 3.29289C12.5196 3.10536 12.2652 3 12 3C11.7348 3 11.4804 3.10536 11.2929 3.29289C11.1054 3.48043 11 3.73478 11 4V11H4C3.73478 11 3.48043 11.1054 3.29289 11.2929C3.10536 11.4804 3 11.7348 3 12C3 12.2652 3.10536 12.5196 3.29289 12.7071C3.48043 12.8946 3.73478 13 4 13H11V20C11 20.2652 11.1054 20.5196 11.2929 20.7071C11.4804 20.8946 11.7348 21 12 21C12.2652 21 12.5196 20.8946 12.7071 20.7071C12.8946 20.5196 13 20.2652 13 20V13H20C20.2652 13 20.5196 12.8946 20.7071 12.7071C20.8946 12.5196 21 12.2652 21 12C21 11.7348 20.8946 11.4804 20.7071 11.2929C20.5196 11.1054 20.2652 11 20 11Z"/>
        </svg>
      </button>

      <CreateServerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onServerCreated={loadServers}
      />
    </div>
  );
}

