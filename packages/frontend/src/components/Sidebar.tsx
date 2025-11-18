import { useNavigate } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar() {
  const navigate = useNavigate();


  const handleHomeClick = () => {
    navigate("/");
  };

  const handleDMsClick = () => {
    navigate("/channels/@me");
  };

  return (
    <div className="sidebar">
      <div className="sidebar-servers">
        <button className="server-icon home-button" onClick={handleHomeClick} title="Главная">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <span className="server-name">Главная</span>
        </button>

        <div className="server-divider" />

        <button className="server-icon dm-button" onClick={handleDMsClick} title="Сообщество">
          <img src="/logo.png" alt="Ruscord" className="dm-logo-icon" />
          <span className="server-name">Сообщество</span>
        </button>
      </div>
    </div>
  );
}

