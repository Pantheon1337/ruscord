import { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import Toast from "./Toast";
import "./ShopView.css";

interface ShopItem {
  id: string;
  name: string;
  description?: string;
  type: string;
  price: number;
  image_url?: string;
  rarity: string;
}

interface Purchase {
  id: string;
  item_id: string;
  name: string;
  type: string;
  image_url?: string;
}

export default function ShopView() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [purchasedItems, setPurchasedItems] = useState<Purchase[]>([]);
  const [currency, setCurrency] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState<string>("1000");
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showUploadBannerModal, setShowUploadBannerModal] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsRes, currencyRes, purchasesRes] = await Promise.all([
        api.get("/shop/items"),
        api.get("/shop/currency"),
        api.get("/shop/purchases"),
      ]);

      setItems(itemsRes.data || []);
      const currencyAmount = parseInt(currencyRes.data?.rucoin_amount || 0);
      setCurrency(currencyAmount);
      setPurchasedItems(purchasesRes.data || []);
    } catch (error) {
      console.error("Error loading shop data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = async (item: ShopItem) => {
    if (purchasing) return;
    
    // Проверяем баланс на сервере, а не только на клиенте
    setPurchasing(item.id);
    try {
      const response = await api.post("/shop/purchase", { itemId: item.id });
      if (response.data.success) {
        const newBalance = parseInt(response.data.new_balance);
        setCurrency(newBalance);
        // Обновляем список покупок
        try {
          const purchasesRes = await api.get("/shop/purchases");
          setPurchasedItems(purchasesRes.data || []);
        } catch (error) {
          console.error("Error loading purchases:", error);
        }
        setToast({ message: `Вы успешно приобрели "${item.name}"!`, type: "success" });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "Ошибка при покупке";
      // Если ошибка "Insufficient funds", показываем более понятное сообщение
      if (error.response?.data?.error === "Insufficient funds" || errorMessage.includes("Insufficient")) {
        setToast({ message: "Недостаточно средств!", type: "error" });
      } else {
        setToast({ message: errorMessage, type: "error" });
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleApplyBanner = async (itemId: string) => {
    try {
      const response = await api.post("/shop/apply-banner", { itemId });
      if (response.data.success) {
        setToast({ message: "Баннер успешно применен к вашему профилю!", type: "success" });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "Ошибка при применении баннера";
      setToast({ message: errorMessage, type: "error" });
    }
  };

  const handleUploadCustomBanner = async () => {
    if (!bannerFile) {
      setToast({ message: "Выберите файл баннера!", type: "error" });
      return;
    }

    if (currency < 1000) {
      setToast({ message: "Недостаточно средств! Нужно 1000 🪙", type: "error" });
      return;
    }

    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append("banner", bannerFile);

      const response = await api.post("/shop/upload-custom-banner", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        const newBalance = parseInt(response.data.new_balance);
        setCurrency(newBalance);
        setShowUploadBannerModal(false);
        setBannerFile(null);
        setToast({ 
          message: `Баннер успешно загружен! Потрачено 1000 🪙. Новый баланс: ${newBalance.toLocaleString()} 🪙`, 
          type: "success" 
        });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "Ошибка при загрузке баннера";
      setToast({ message: errorMessage, type: "error" });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleTopup = async () => {
    const amount = parseInt(topupAmount);
    if (isNaN(amount) || amount <= 0) {
      setToast({ message: "Введите корректную сумму!", type: "error" });
      return;
    }

    try {
      // Получаем ID текущего пользователя из API
      const userResponse = await api.get("/users/me");
      const userId = userResponse.data?.id;

      if (!userId) {
        setToast({ message: "Ошибка: пользователь не найден", type: "error" });
        return;
      }

      const response = await api.post("/shop/admin/currency", {
        userId,
        amount,
        operation: "add"
      });

      if (response.data.success) {
        const newAmount = parseInt(response.data.new_amount);
        setCurrency(newAmount);
        setShowTopupModal(false);
        setTopupAmount("1000");
        // Обновляем список покупок, но не перезаписываем баланс
        try {
          const purchasesRes = await api.get("/shop/purchases");
          setPurchasedItems(purchasesRes.data || []);
        } catch (error) {
          console.error("Error loading purchases:", error);
        }
        setToast({ 
          message: `Баланс пополнен на ${amount.toLocaleString()} 🪙! Новый баланс: ${newAmount.toLocaleString()} 🪙`, 
          type: "success" 
        });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "Ошибка при пополнении баланса";
      setToast({ message: errorMessage, type: "error" });
    }
  };

  const isPurchased = (itemId: string) => {
    return purchasedItems.some((p) => p.item_id === itemId);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case "common":
        return "#99aab5";
      case "rare":
        return "#5865f2";
      case "epic":
        return "#eb459e";
      case "legendary":
        return "#faa61a";
      default:
        return "#99aab5";
    }
  };

  const banners = items.filter((item) => item.type === "banner");
  const collections = Array.from(new Set(banners.map((b) => b.rarity)));

  if (loading) {
    return (
      <div className="shop-view">
        <div className="shop-loading">Загрузка магазина...</div>
      </div>
    );
  }

  return (
    <div className="shop-view">
      <div className="shop-header">
        <div className="shop-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
          <h1>Магазин Ruscord</h1>
        </div>
        <div className="shop-header-right">
          <div className="shop-currency">
            <span className="currency-icon">🪙</span>
            <span className="currency-amount">{currency.toLocaleString()}</span>
          </div>
          <button 
            className="shop-topup-btn"
            onClick={() => setShowTopupModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.93s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
            </svg>
            <span>Пополнить</span>
          </button>
        </div>
      </div>

      <div className="shop-content">
        {/* Upload Custom Banner Section */}
        <div className="shop-section">
          <div className="section-header">
            <h2 className="section-title">Загрузить свой баннер</h2>
          </div>
          <div className="upload-banner-card">
            <div className="upload-banner-info">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#5865f2" }}>
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              <div>
                <h3>Загрузите свой уникальный баннер</h3>
                <p>Стоимость: 1000 🪙</p>
                <p className="upload-banner-hint">Рекомендуемый размер: 600x240 пикселей (2.5:1)</p>
              </div>
            </div>
            <button 
              className="upload-banner-btn"
              onClick={() => setShowUploadBannerModal(true)}
            >
              Загрузить баннер
            </button>
          </div>
        </div>

        {/* Featured Banner */}
        {banners.length > 0 && (
          <div className="shop-featured">
            <div className="featured-banner">
              <div className="featured-content">
                <h2 className="featured-title">НОВЫЕ БАННЕРЫ</h2>
                <p className="featured-description">
                  Украсьте свой профиль уникальными баннерами!
                </p>
                <button 
                  className="featured-button"
                  onClick={() => {
                    const firstCollection = collections[0];
                    if (firstCollection) {
                      setSelectedCollection(selectedCollection === firstCollection ? null : firstCollection);
                    }
                  }}
                >
                  Посмотреть коллекцию
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Featured Items Grid */}
        {banners.length > 0 && (
          <div className="shop-section">
            <h2 className="section-title">Рекомендуемые</h2>
            <div className="items-grid">
              {banners.slice(0, 4).map((item) => (
                <div key={item.id} className="shop-item">
                  <div className="item-image-wrapper">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="item-image" />
                    ) : (
                      <div className="item-image-placeholder" style={{ backgroundColor: getRarityColor(item.rarity) }}>
                        <span>{item.name.charAt(0)}</span>
                      </div>
                    )}
                    {isPurchased(item.id) && (
                      <div className="item-owned-badge">Куплено</div>
                    )}
                  </div>
                  <div className="item-info">
                    <h3 className="item-name">{item.name}</h3>
                    <div className="item-price">
                      <span className="price-amount">{item.price.toLocaleString()}</span>
                      <span className="price-currency">🪙</span>
                    </div>
                    {isPurchased(item.id) && item.type === "banner" ? (
                      <button
                        className="item-apply-btn"
                        onClick={() => handleApplyBanner(item.id)}
                      >
                        Применить
                      </button>
                    ) : (
                      <button
                        className={`item-purchase-btn ${isPurchased(item.id) ? "purchased" : ""}`}
                        onClick={() => !isPurchased(item.id) && handlePurchase(item)}
                        disabled={purchasing === item.id || isPurchased(item.id)}
                      >
                        {purchasing === item.id
                          ? "Покупка..."
                          : isPurchased(item.id)
                          ? "Куплено"
                          : "Купить"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collections */}
        {collections.length > 0 && (
          <div className="shop-section">
            <h2 className="section-title">Коллекции</h2>
            <div className="collections-grid">
              {collections.map((collection) => {
                const collectionItems = banners.filter((b) => b.rarity === collection);
                if (collectionItems.length === 0) return null;

                return (
                  <div key={collection} className="collection-card">
                    <div className="collection-preview">
                      {collectionItems.slice(0, 4).map((item, idx) => (
                        <div key={item.id} className="collection-item-preview">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} />
                          ) : (
                            <div
                              className="collection-item-placeholder"
                              style={{ backgroundColor: getRarityColor(item.rarity) }}
                            >
                              {item.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="collection-info">
                      <h3 className="collection-name">{collection.toUpperCase()}</h3>
                      <button
                        className="collection-button"
                        onClick={() =>
                          setSelectedCollection(
                            selectedCollection === collection ? null : collection
                          )
                        }
                      >
                        {selectedCollection === collection ? "Скрыть" : "Посмотреть"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Collection Items */}
        {selectedCollection && (
          <div className="shop-section">
            <h2 className="section-title">{selectedCollection.toUpperCase()}</h2>
            <div className="items-grid">
              {banners
                .filter((b) => b.rarity === selectedCollection)
                .map((item) => (
                  <div key={item.id} className="shop-item">
                    <div className="item-image-wrapper">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="item-image" />
                      ) : (
                        <div
                          className="item-image-placeholder"
                          style={{ backgroundColor: getRarityColor(item.rarity) }}
                        >
                          <span>{item.name.charAt(0)}</span>
                        </div>
                      )}
                      {isPurchased(item.id) && (
                        <div className="item-owned-badge">Куплено</div>
                      )}
                    </div>
                    <div className="item-info">
                      <h3 className="item-name">{item.name}</h3>
                      <div className="item-price">
                        <span className="price-amount">{item.price.toLocaleString()}</span>
                        <span className="price-currency">🪙</span>
                      </div>
                      <button
                        className={`item-purchase-btn ${isPurchased(item.id) ? "purchased" : ""}`}
                        onClick={() => !isPurchased(item.id) && handlePurchase(item)}
                        disabled={purchasing === item.id || isPurchased(item.id)}
                      >
                        {purchasing === item.id
                          ? "Покупка..."
                          : isPurchased(item.id)
                          ? "Куплено"
                          : "Купить"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Popular Picks */}
        {banners.length > 0 && (
          <div className="shop-section">
            <div className="section-header">
              <h2 className="section-title">Популярное</h2>
              <button className="shop-all-btn">Все товары</button>
            </div>
            <div className="items-grid">
              {banners.slice(0, 4).map((item) => (
                <div key={item.id} className="shop-item">
                  <div className="item-image-wrapper">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="item-image" />
                    ) : (
                      <div
                        className="item-image-placeholder"
                        style={{ backgroundColor: getRarityColor(item.rarity) }}
                      >
                        <span>{item.name.charAt(0)}</span>
                      </div>
                    )}
                    {isPurchased(item.id) && (
                      <div className="item-owned-badge">Куплено</div>
                    )}
                  </div>
                  <div className="item-info">
                    <h3 className="item-name">{item.name}</h3>
                    <div className="item-price">
                      <span className="price-amount">{item.price.toLocaleString()}</span>
                      <span className="price-currency">🪙</span>
                    </div>
                    {isPurchased(item.id) && item.type === "banner" ? (
                      <button
                        className="item-apply-btn"
                        onClick={() => handleApplyBanner(item.id)}
                      >
                        Применить
                      </button>
                    ) : (
                      <button
                        className={`item-purchase-btn ${isPurchased(item.id) ? "purchased" : ""}`}
                        onClick={() => !isPurchased(item.id) && handlePurchase(item)}
                        disabled={purchasing === item.id || isPurchased(item.id)}
                      >
                        {purchasing === item.id
                          ? "Покупка..."
                          : isPurchased(item.id)
                          ? "Куплено"
                          : "Купить"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="shop-empty">
            <p>В магазине пока нет товаров</p>
          </div>
        )}
      </div>

      {showUploadBannerModal && (
        <div className="topup-modal-overlay" onClick={() => !uploadingBanner && setShowUploadBannerModal(false)}>
          <div className="topup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="topup-modal-header">
              <h2>Загрузить свой баннер</h2>
              <button 
                className="topup-modal-close"
                onClick={() => !uploadingBanner && setShowUploadBannerModal(false)}
                disabled={uploadingBanner}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="topup-modal-content">
              <label className="topup-modal-label">
                Выберите изображение баннера
              </label>
              <input
                type="file"
                accept="image/*"
                className="topup-modal-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setBannerFile(file);
                  }
                }}
                disabled={uploadingBanner}
              />
              {bannerFile && (
                <div className="banner-preview">
                  <img 
                    src={URL.createObjectURL(bannerFile)} 
                    alt="Preview" 
                    style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "4px" }}
                  />
                </div>
              )}
              <div style={{ marginTop: "16px", padding: "12px", background: "#2f3136", borderRadius: "4px" }}>
                <p style={{ margin: 0, fontSize: "14px", color: "#b9bbbe" }}>
                  <strong>Стоимость:</strong> 1000 🪙
                </p>
                <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#72767d" }}>
                  Рекомендуемый размер: 600x240 пикселей (соотношение 2.5:1)
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#72767d" }}>
                  Форматы: PNG, JPG, GIF, WEBP (макс. 8MB)
                </p>
              </div>
              <button 
                className="topup-modal-submit"
                onClick={handleUploadCustomBanner}
                disabled={!bannerFile || uploadingBanner || currency < 1000}
              >
                {uploadingBanner ? "Загрузка..." : `Загрузить за 1000 🪙`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTopupModal && (
        <div className="topup-modal-overlay" onClick={() => setShowTopupModal(false)}>
          <div className="topup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="topup-modal-header">
              <h2>Пополнить баланс</h2>
              <button 
                className="topup-modal-close"
                onClick={() => setShowTopupModal(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="topup-modal-content">
              <label className="topup-modal-label">
                Сумма пополнения (🪙)
              </label>
              <input
                type="number"
                className="topup-modal-input"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                min="1"
                placeholder="1000"
              />
              <div className="topup-modal-presets">
                <button 
                  className="topup-preset-btn"
                  onClick={() => setTopupAmount("500")}
                >
                  500 🪙
                </button>
                <button 
                  className="topup-preset-btn"
                  onClick={() => setTopupAmount("1000")}
                >
                  1000 🪙
                </button>
                <button 
                  className="topup-preset-btn"
                  onClick={() => setTopupAmount("5000")}
                >
                  5000 🪙
                </button>
                <button 
                  className="topup-preset-btn"
                  onClick={() => setTopupAmount("10000")}
                >
                  10000 🪙
                </button>
              </div>
              <button 
                className="topup-modal-submit"
                onClick={handleTopup}
              >
                Пополнить баланс
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

