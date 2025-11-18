import { useState, useEffect } from "react";
import api from "../api/client";
import { getAvatarUrl } from "../utils/imageUtils";
import "./AddFriendModal.css";

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendAdded: () => void;
}

export default function AddFriendModal({
  isOpen,
  onClose,
  onFriendAdded,
}: AddFriendModalProps) {
  const [username, setUsername] = useState("");
  const [discriminator, setDiscriminator] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setUsername("");
      setDiscriminator("");
      setSearchQuery("");
      setSearchResults([]);
      setError("");
    }
  }, [isOpen]);

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setError("");
    
    // Парсим username#discriminator
    const parts = value.split("#");
    if (parts.length === 2) {
      setUsername(parts[0].trim());
      setDiscriminator(parts[1].trim());
    } else {
      setUsername(value.trim());
      setDiscriminator("");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length < 2) {
      setError("Введите минимум 2 символа");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get(`/friends/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
      if (response.data.length === 0) {
        setError("Пользователь не найден");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Ошибка поиска");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (userUsername: string, userDiscriminator: string) => {
    try {
      setLoading(true);
      setError("");
      await api.post("/friends", { username: userUsername, discriminator: userDiscriminator });
      onFriendAdded();
      setSearchQuery("");
      setSearchResults([]);
      setUsername("");
      setDiscriminator("");
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Ошибка добавления друга");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Добавить друга</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Вы можете добавить друга по его имени пользователя и тегу.
          </p>

          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Введите имя пользователя"
                value={username}
                onChange={(e) => {
                  const value = e.target.value;
                  setUsername(value);
                  setSearchQuery(discriminator ? `${value}#${discriminator}` : value);
                }}
              />
              <span className="search-separator">#</span>
              <input
                type="text"
                className="search-input-discriminator"
                placeholder="0000"
                value={discriminator}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setDiscriminator(value);
                  setSearchQuery(username ? `${username}#${value}` : "");
                }}
                maxLength={4}
              />
            </div>
            <button type="submit" className="search-btn" disabled={loading || !username || discriminator.length !== 4}>
              {loading ? "Поиск..." : "Отправить запрос"}
            </button>
          </form>

          {error && <div className="modal-error">{error}</div>}

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((user) => (
                <div key={user.id} className="search-result-item">
                  <div className="search-result-avatar">
                    {user.avatar ? (
                      <img src={getAvatarUrl(user.avatar) || ""} alt={user.username} />
                    ) : (
                      <span>{user.username.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="search-result-info">
                    <div className="search-result-name">{user.username}</div>
                    <div className="search-result-tag">#{user.discriminator}</div>
                  </div>
                  <button
                    className="add-friend-btn"
                    onClick={() => handleAddFriend(user.username, user.discriminator)}
                  >
                    Добавить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

