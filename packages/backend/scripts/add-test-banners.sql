-- Скрипт для добавления тестовых баннеров в магазин
-- Выполните этот скрипт в базе данных для добавления примеров баннеров

-- Примеры баннеров разных редкостей
INSERT INTO shop_items (name, description, type, price, image_url, rarity, is_active) VALUES
-- Common баннеры
('Синий градиент', 'Классический синий градиентный баннер', 'banner', 500, 'https://via.placeholder.com/600x240/5865f2/ffffff?text=Blue+Gradient', 'common', true),
('Фиолетовый градиент', 'Элегантный фиолетовый градиент', 'banner', 500, 'https://via.placeholder.com/600x240/9b59b6/ffffff?text=Purple+Gradient', 'common', true),
('Зеленый градиент', 'Свежий зеленый градиент', 'banner', 500, 'https://via.placeholder.com/600x240/2ecc71/ffffff?text=Green+Gradient', 'common', true),

-- Rare баннеры
('Космический', 'Баннер с космической тематикой', 'banner', 1000, 'https://via.placeholder.com/600x240/1a1a2e/ffffff?text=Space', 'rare', true),
('Океан', 'Баннер с океанской тематикой', 'banner', 1000, 'https://via.placeholder.com/600x240/0f3460/ffffff?text=Ocean', 'rare', true),
('Лес', 'Баннер с лесной тематикой', 'banner', 1000, 'https://via.placeholder.com/600x240/2d5016/ffffff?text=Forest', 'rare', true),

-- Epic баннеры
('Неоновый город', 'Яркий неоновый городской баннер', 'banner', 2000, 'https://via.placeholder.com/600x240/ff00ff/ffffff?text=Neon+City', 'epic', true),
('Огненный', 'Пламенный баннер', 'banner', 2000, 'https://via.placeholder.com/600x240/ff4500/ffffff?text=Fire', 'epic', true),
('Ледяной', 'Холодный ледяной баннер', 'banner', 2000, 'https://via.placeholder.com/600x240/00bfff/ffffff?text=Ice', 'epic', true),

-- Legendary баннеры
('Золотой', 'Роскошный золотой баннер', 'banner', 5000, 'https://via.placeholder.com/600x240/ffd700/000000?text=Gold', 'legendary', true),
('Радужный', 'Яркий радужный баннер', 'banner', 5000, 'https://via.placeholder.com/600x240/ff1493/ffffff?text=Rainbow', 'legendary', true),
('Кристальный', 'Блестящий кристальный баннер', 'banner', 5000, 'https://via.placeholder.com/600x240/00ffff/000000?text=Crystal', 'legendary', true);

-- Примечание: Замените URL изображений на реальные ссылки на ваши баннеры
-- Рекомендуемый размер баннера: 600x240 пикселей

