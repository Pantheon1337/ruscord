import { useState, useEffect, useRef } from "react";
import api from "../api/client";
import { useAuthStore } from "../store/authStore";
import "./UserSettingsModal.css";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Banner {
  id: string;
  image_url: string;
  name?: string;
  type?: "shop" | "custom";
}

export default function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const { user, setAuth } = useAuthStore();
  const [username, setUsername] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [purchasedBanners, setPurchasedBanners] = useState<Banner[]>([]);
  const [customBanners, setCustomBanners] = useState<Banner[]>([]);
  const [selectedBanner, setSelectedBanner] = useState<string | null>(null);
  const [currentBanner, setCurrentBanner] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      setUsername(user.username || "");
      setAvatarPreview(user.avatar ? `${import.meta.env.VITE_API_URL || "http://localhost:3001"}${user.avatar}` : "");
      setAvatarFile(null);
      loadBanners();
      loadCurrentBanner();
    }
  }, [isOpen, user]);

  const loadBanners = async () => {
    try {
      const [purchasesRes, customRes] = await Promise.all([
        api.get("/shop/purchases").catch(() => ({ data: [] })),
        api.get("/shop/custom-banners").catch(() => ({ data: [] }))
      ]);

      const purchased = (purchasesRes.data || [])
        .filter((p: any) => p.type === "banner")
        .map((p: any) => ({ id: p.item_id, image_url: p.image_url, name: p.name, type: "shop" as const }));
      
      const custom = (customRes.data || [])
        .map((b: any) => ({ id: b.id, image_url: b.image_url, type: "custom" as const }));

      setPurchasedBanners(purchased);
      setCustomBanners(custom);
    } catch (error) {
      console.error("Error loading banners:", error);
    }
  };

  const loadCurrentBanner = async () => {
    try {
      const response = await api.get("/profile/customization");
      if (response.data?.banner_url) {
        setCurrentBanner(response.data.banner_url);
        setSelectedBanner(response.data.banner_url);
      }
    } catch (error) {
      console.error("Error loading current banner:", error);
    }
  };

  const handleBannerSelect = async (bannerUrl: string) => {
    setSelectedBanner(bannerUrl);
    try {
      await api.put("/profile/customization", { banner_url: bannerUrl });
      setCurrentBanner(bannerUrl);
      setSuccess("Баннер успешно применен!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.error || "Ошибка при применении баннера");
      setTimeout(() => setError(""), 3000);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Файл должен быть изображением");
        return;
      }
      // Validate file size (8MB)
      if (file.size > 8 * 1024 * 1024) {
        setError("Размер файла не должен превышать 8MB");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Update username if changed
      if (username !== user?.username) {
        await api.patch("/users/me", { username });
      }

      // Upload avatar if file selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        await api.post("/users/me/avatar", formData);
      }

      // Reload user data
      const userResponse = await api.get("/users/me");
      const token = localStorage.getItem("token");
      if (token && userResponse.data) {
        setAuth(userResponse.data, token);
      }

      setSuccess("Настройки успешно сохранены!");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Ошибка при сохранении настроек");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal-content" ref={modalRef}>
        <div className="settings-modal-header">
          <h2>Настройки пользователя</h2>
          <button className="settings-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <form className="settings-modal-body" onSubmit={handleSubmit}>
          {error && <div className="settings-error">{error}</div>}
          {success && <div className="settings-success">{success}</div>}

          <div className="settings-field">
            <label className="settings-label">Имя пользователя</label>
            <input
              type="text"
              className="settings-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите имя пользователя"
              maxLength={32}
              required
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">
              Аватар
              <span className="settings-hint">Рекомендуемый размер: 256x256 пикселей (квадрат)</span>
            </label>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="settings-file-btn"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarFile ? "Изменить аватар" : "Выбрать аватар"}
            </button>
            {avatarPreview && (
              <div className="settings-preview">
                <img src={avatarPreview} alt="Avatar preview" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }} />
              </div>
            )}
          </div>

          <div className="settings-field">
            <label className="settings-label">Баннер профиля</label>
            {(purchasedBanners.length > 0 || customBanners.length > 0) ? (
              <div className="banners-grid">
                {purchasedBanners.map((banner) => (
                  <div
                    key={banner.id}
                    className={`banner-item ${selectedBanner === banner.image_url ? "selected" : ""}`}
                    onClick={() => handleBannerSelect(banner.image_url)}
                  >
                    <img src={banner.image_url} alt={banner.name || "Banner"} />
                    {banner.name && <span className="banner-name">{banner.name}</span>}
                  </div>
                ))}
                {customBanners.map((banner) => (
                  <div
                    key={banner.id}
                    className={`banner-item ${selectedBanner === banner.image_url ? "selected" : ""}`}
                    onClick={() => handleBannerSelect(banner.image_url)}
                  >
                    <img src={banner.image_url} alt="Custom banner" />
                    <span className="banner-name">Мой баннер</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="settings-hint">У вас пока нет баннеров. Купите их в магазине или загрузите свой!</p>
            )}
          </div>

          <div className="settings-modal-actions">
            <button type="button" className="settings-btn secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="settings-btn primary" disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

