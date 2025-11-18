# Инструкция по настройке Git и push на GitHub

## Настройка SSH ключа для GitHub

### 1. Проверка существующих SSH ключей

```bash
ls -al ~/.ssh
```

### 2. Создание нового SSH ключа (если нет)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Нажмите Enter для сохранения в стандартную директорию. При запросе пароля можно оставить пустым или установить пароль.

### 3. Добавление SSH ключа в ssh-agent

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### 4. Копирование публичного ключа

```bash
cat ~/.ssh/id_ed25519.pub
```

Скопируйте весь вывод команды.

### 5. Добавление ключа в GitHub

1. Перейдите на GitHub.com
2. Нажмите на ваш аватар → Settings
3. В левом меню выберите SSH and GPG keys
4. Нажмите New SSH key
5. Вставьте скопированный ключ
6. Нажмите Add SSH key

### 6. Проверка подключения

```bash
ssh -T git@github.com
```

Должно появиться сообщение об успешной аутентификации.

## Push проекта на GitHub

### Вариант 1: Использование SSH (рекомендуется)

```bash
cd /path/to/ruscord
git remote set-url origin git@github.com:Pantheon1337/ruscord.git
git push -u origin main
```

### Вариант 2: Использование HTTPS

Если SSH не настроен, можно использовать HTTPS:

```bash
cd /path/to/ruscord
git remote set-url origin https://github.com/Pantheon1337/ruscord.git
git push -u origin main
```

При использовании HTTPS потребуется ввести логин и токен доступа GitHub (Personal Access Token).

## Настройка Git пользователя (если еще не настроено)

```bash
git config --global user.name "Your Name"
git config --global user.email "your_email@example.com"
```

Для локального репозитория:

```bash
git config user.name "Your Name"
git config user.email "your_email@example.com"
```

