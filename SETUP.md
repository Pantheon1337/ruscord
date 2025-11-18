# Ruscord Setup Guide

## Database Configuration

База данных настроена со следующими параметрами:
- **Название**: `ruscord`
- **Пользователь**: `postgres`
- **Пароль**: `Raptor-12345`
- **Хост**: `localhost`
- **Порт**: `5432`

## Создание базы данных

### Способ 1: Через PowerShell (если psql в PATH)

```powershell
$env:PGPASSWORD = "Raptor-12345"
psql -U postgres -h localhost -c "CREATE DATABASE ruscord;"
```

### Способ 2: Через pgAdmin

1. Откройте pgAdmin
2. Подключитесь к серверу PostgreSQL
3. Правой кнопкой на "Databases" → "Create" → "Database"
4. Имя: `ruscord`
5. Нажмите "Save"

### Способ 3: Через SQL скрипт

1. Подключитесь к PostgreSQL как пользователь postgres
2. Выполните:
```sql
CREATE DATABASE ruscord;
```

## Файл .env

Файл `.env` уже создан в `packages/backend/.env` со следующими настройками:

```
PORT=3001
JWT_SECRET=ruscord-secret-key-change-in-production-[random]
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ruscord
DB_USER=postgres
DB_PASSWORD=Raptor-12345
```

## Проверка подключения

После создания базы данных, при первом запуске backend сервера все таблицы будут созданы автоматически.

Для проверки подключения:
```powershell
$env:PGPASSWORD = "Raptor-12345"
psql -U postgres -h localhost -d ruscord -c "SELECT version();"
```

## Запуск приложения

1. Установите зависимости:
```bash
npm run install:all
```

2. Убедитесь, что база данных создана (см. выше)

3. Запустите приложение:
```bash
npm run dev
```

Backend будет доступен на `http://localhost:3001`
Frontend будет доступен на `http://localhost:3000`

