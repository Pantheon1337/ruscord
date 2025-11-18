# Инструкция по развертыванию Ruscord на Ubuntu сервере

## Требования

- Ubuntu 20.04 или выше
- Node.js 18+ и npm
- PostgreSQL 14+
- Git
- Nginx (для production)
- PM2 (для управления процессами)

## Шаг 1: Подготовка сервера

### Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Проверка версии (должна быть 18+)
```

### Установка PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Установка Git

```bash
sudo apt install -y git
```

### Установка Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Установка PM2

```bash
sudo npm install -g pm2
```

## Шаг 2: Настройка базы данных

### Создание пользователя и базы данных

```bash
sudo -u postgres psql
```

В консоли PostgreSQL выполните:

```sql
CREATE USER ruscord_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE ruscord_db OWNER ruscord_user;
GRANT ALL PRIVILEGES ON DATABASE ruscord_db TO ruscord_user;
\q
```

### Настройка PostgreSQL для удаленного доступа (опционально)

Отредактируйте `/etc/postgresql/14/main/postgresql.conf`:

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Найдите и раскомментируйте:
```
listen_addresses = 'localhost'
```

Отредактируйте `/etc/postgresql/14/main/pg_hba.conf`:

```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Добавьте:
```
host    ruscord_db    ruscord_user    127.0.0.1/32    md5
```

Перезапустите PostgreSQL:

```bash
sudo systemctl restart postgresql
```

## Шаг 3: Клонирование и настройка проекта

### Клонирование репозитория

```bash
cd /var/www
sudo git clone git@github.com:Pantheon1337/ruscord.git
sudo chown -R $USER:$USER ruscord
cd ruscord
```

Если SSH ключ не настроен, используйте HTTPS:

```bash
git clone https://github.com/Pantheon1337/ruscord.git
cd ruscord
```

### Установка зависимостей

```bash
npm install
```

### Настройка переменных окружения

Создайте файл `.env` в `packages/backend/`:

```bash
cd packages/backend
cp .env.example .env
nano .env
```

Настройте следующие переменные:

```env
PORT=3001
NODE_ENV=production
JWT_SECRET=your_very_secure_jwt_secret_key_here
DATABASE_URL=postgresql://ruscord_user:your_secure_password@localhost:5432/ruscord_db
```

### Сборка проекта

```bash
cd /var/www/ruscord
npm run build:shared
cd packages/backend
npm run build
cd ../frontend
npm run build
cd ../..
```

## Шаг 4: Инициализация базы данных

```bash
cd packages/backend
npm run build
node dist/index.js
```

База данных будет автоматически инициализирована при первом запуске. Дождитесь сообщения "Database initialized" и остановите процесс (Ctrl+C).

## Шаг 5: Настройка PM2

Файл `ecosystem.config.js` уже находится в корне проекта. Создайте директорию для логов:

```bash
mkdir -p /var/www/ruscord/logs
```

Запустите приложения через PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Выполните команду, которую выведет `pm2 startup`, чтобы PM2 запускался при загрузке системы.

## Шаг 6: Настройка Nginx

Создайте конфигурацию Nginx:

```bash
sudo nano /etc/nginx/sites-available/ruscord
```

Добавьте следующую конфигурацию:

```nginx
# WebSocket и API проксирование
upstream backend {
    server localhost:3001;
}

# Frontend
upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;  # Замените на ваш домен или IP

    # Увеличение размера загружаемых файлов
    client_max_body_size 10M;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket для API
    location /api/ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Загрузка файлов
    location /uploads {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/ruscord /etc/nginx/sites-enabled/
sudo nginx -t  # Проверка конфигурации
sudo systemctl reload nginx
```

## Шаг 7: Настройка файрвола (опционально)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Шаг 8: Настройка SSL (опционально, рекомендуется)

Установите Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Получите SSL сертификат:

```bash
sudo certbot --nginx -d your-domain.com
```

Certbot автоматически обновит конфигурацию Nginx для использования HTTPS.

## Шаг 9: Проверка работы

Проверьте статус PM2:

```bash
pm2 status
pm2 logs
```

Проверьте логи:

```bash
pm2 logs ruscord-backend
pm2 logs ruscord-frontend
```

Откройте браузер и перейдите на `http://your-domain.com` или `http://your-server-ip`.

## Управление приложением

### Остановка приложения

```bash
pm2 stop all
```

### Перезапуск приложения

```bash
pm2 restart all
```

### Просмотр логов

```bash
pm2 logs
pm2 logs ruscord-backend
pm2 logs ruscord-frontend
```

### Обновление приложения

```bash
cd /var/www/ruscord
git pull origin main
npm install
npm run build
pm2 restart all
```

## Резервное копирование базы данных

Создайте скрипт для резервного копирования:

```bash
nano /var/www/ruscord/backup.sh
```

Добавьте:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/ruscord"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U ruscord_user ruscord_db > $BACKUP_DIR/ruscord_$DATE.sql
find $BACKUP_DIR -name "ruscord_*.sql" -mtime +7 -delete
```

Сделайте скрипт исполняемым:

```bash
chmod +x /var/www/ruscord/backup.sh
```

Добавьте в crontab для ежедневного резервного копирования:

```bash
crontab -e
```

Добавьте строку:

```
0 2 * * * /var/www/ruscord/backup.sh
```

## Мониторинг

PM2 предоставляет встроенный мониторинг:

```bash
pm2 monit
```

Для более детального мониторинга можно использовать PM2 Plus или другие инструменты.

## Решение проблем

### Проверка портов

```bash
sudo netstat -tlnp | grep -E '3000|3001'
```

### Проверка логов Nginx

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Проверка подключения к базе данных

```bash
psql -U ruscord_user -d ruscord_db -h localhost
```

### Перезапуск всех сервисов

```bash
sudo systemctl restart postgresql
sudo systemctl restart nginx
pm2 restart all
```

