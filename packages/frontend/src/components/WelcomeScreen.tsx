import { useAuthStore } from "../store/authStore";
import "./WelcomeScreen.css";

export default function WelcomeScreen() {
  const { user } = useAuthStore();

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-logo">
          <img src="/logo.png" alt="Ruscord" />
        </div>
        <h1 className="welcome-title">
          Привет, <span className="username-highlight">@{user?.username}</span>!
        </h1>
        <p className="welcome-subtitle">
          Это платформа <strong>Ruscord</strong>
        </p>
        <div className="welcome-description">
          <p>
            Добро пожаловать в Ruscord — вашу коммуникационную платформу нового поколения!
          </p>
          <p>
            Здесь вы можете общаться с друзьями, создавать серверы, обмениваться сообщениями
            и наслаждаться голосовым общением в реальном времени.
          </p>
        </div>
        <div className="welcome-features">
          <div className="feature-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>Безопасное общение</span>
          </div>
          <div className="feature-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>Голосовые каналы</span>
          </div>
          <div className="feature-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>Создание серверов</span>
          </div>
        </div>
        <div className="welcome-hint">
          <p>Выберите сервер слева или создайте новый, чтобы начать общение</p>
        </div>
      </div>
    </div>
  );
}

