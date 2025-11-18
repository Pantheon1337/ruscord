import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./CreateServerModal.css";

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerCreated: () => void;
}

export default function CreateServerModal({
  isOpen,
  onClose,
  onServerCreated,
}: CreateServerModalProps) {
  const [serverName, setServerName] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) {
      setServerName("");
      setIconFile(null);
      setIconPreview(null);
      setError("");
    }
  }, [isOpen]);

  const handleIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setError("Размер файла не должен превышать 8 МБ");
        return;
      }
      setIconFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleRemoveIcon = () => {
    setIconFile(null);
    setIconPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreate = async () => {
    if (!serverName.trim()) {
      setError("Введите название сервера");
      return;
    }

    if (serverName.length > 100) {
      setError("Название сервера не должно превышать 100 символов");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", serverName.trim());
      if (iconFile) {
        formData.append("icon", iconFile);
      }

      const response = await api.post("/servers", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onServerCreated();
      onClose();
      navigate(`/servers/${response.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Ошибка создания сервера");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-server-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-server-step">
            <div className="create-server-header">
              <h2>Настройка вашего сервера</h2>
              <p className="create-server-description">
                Дайте вашему серверу индивидуальность с названием и иконкой. Вы
                всегда сможете изменить это позже.
              </p>
            </div>

            <div className="create-server-content">
              <div className="server-icon-upload-large" onClick={handleIconClick}>
                {iconPreview ? (
                  <div className="server-icon-preview-large">
                    <img src={iconPreview} alt="Server icon" />
                    <button
                      className="remove-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveIcon();
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="server-icon-placeholder-large">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <span>ЗАГРУЗИТЬ</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleIconChange}
                  style={{ display: "none" }}
                />
              </div>

              <div className="server-name-input-wrapper">
                <label htmlFor="server-name">НАЗВАНИЕ СЕРВЕРА</label>
                <input
                  id="server-name"
                  type="text"
                  className="server-name-input"
                  placeholder="Мой новый сервер"
                  value={serverName}
                  onChange={(e) => {
                    setServerName(e.target.value);
                    setError("");
                  }}
                  maxLength={100}
                />
              </div>

              {error && <div className="create-server-error">{error}</div>}
            </div>

            <div className="create-server-footer">
              <button className="create-server-back-btn" onClick={onClose}>
                Назад
              </button>
              <button
                className="create-server-create-btn"
                onClick={handleCreate}
                disabled={loading || !serverName.trim()}
              >
                {loading ? "Создание..." : "Создать"}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}

