# Troubleshooting Guide

## Проблема: ECONNREFUSED при подключении к PostgreSQL

Если вы видите ошибку `ECONNREFUSED` при запуске backend, это означает, что PostgreSQL не запущен или недоступен.

### Решение 1: Проверьте, запущен ли PostgreSQL

**Windows:**
1. Откройте "Службы" (Services) - нажмите Win+R, введите `services.msc`
2. Найдите службу PostgreSQL (может называться "postgresql-x64-XX" или "PostgreSQL")
3. Если статус "Остановлена" (Stopped), нажмите "Запустить" (Start)

**Или через PowerShell:**
```powershell
Get-Service | Where-Object {$_.Name -like "*postgres*"}
```

### Решение 2: Создайте базу данных

Если PostgreSQL запущен, но база данных не создана:

**Через pgAdmin:**
1. Откройте pgAdmin
2. Подключитесь к серверу PostgreSQL
3. Правой кнопкой на "Databases" → "Create" → "Database"
4. Имя: `ruscord`
5. Нажмите "Save"

**Через командную строку:**
```powershell
$env:PGPASSWORD = "Raptor-12345"
psql -U postgres -h localhost -c "CREATE DATABASE ruscord;"
```

Если psql не найден, используйте полный путь:
```powershell
$env:PGPASSWORD = "Raptor-12345"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE ruscord;"
```

### Решение 3: Проверьте настройки подключения

Убедитесь, что файл `packages/backend/.env` содержит правильные настройки:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ruscord
DB_USER=postgres
DB_PASSWORD=Raptor-12345
```

### Решение 4: Проверьте, слушает ли PostgreSQL на порту 5432

```powershell
Test-NetConnection -ComputerName localhost -Port 5432
```

Если порт недоступен, проверьте конфигурацию PostgreSQL в файле `postgresql.conf` и убедитесь, что `listen_addresses = '*'` или `listen_addresses = 'localhost'`.

### Решение 5: Проверьте пароль

Если пароль PostgreSQL отличается от `Raptor-12345`, обновите файл `.env`:

1. Откройте `packages/backend/.env`
2. Измените `DB_PASSWORD` на ваш пароль PostgreSQL

## Проблема: Порт 3000 занят

Если frontend запускается на другом порту (например, 3001), это нормально. Vite автоматически выберет свободный порт.

Убедитесь, что:
- Backend запущен на порту 3001 (как указано в `.env`)
- Frontend проксирует запросы к `http://localhost:3001`

## После исправления

После того как PostgreSQL запущен и база данных создана:

1. Остановите текущий процесс (Ctrl+C)
2. Запустите снова: `npm run dev`
3. Backend автоматически создаст все необходимые таблицы при первом запуске

