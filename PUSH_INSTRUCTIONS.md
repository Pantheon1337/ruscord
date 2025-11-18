# Инструкция по push на GitHub

## Текущий статус

Проект готов к push. Все файлы закоммичены, node_modules игнорируются через .gitignore.

## Вариант 1: Push через SSH (если SSH ключ настроен)

```bash
cd C:\Users\Ilya\Documents\Ruscord
git push -u origin main
```

## Вариант 2: Настройка SSH ключа (если еще не настроен)

Следуйте инструкциям в файле `GIT_SETUP.md` для настройки SSH ключа.

## Вариант 3: Push через HTTPS

Если SSH не настроен, можно использовать HTTPS:

```bash
cd C:\Users\Ilya\Documents\Ruscord
git remote set-url origin https://github.com/Pantheon1337/ruscord.git
git push -u origin main
```

При использовании HTTPS потребуется:
1. Логин GitHub
2. Personal Access Token (не пароль!)

Для создания токена:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Выберите права: `repo` (полный доступ к репозиториям)
4. Скопируйте токен и используйте его как пароль при push

## Проверка после push

После успешного push проверьте репозиторий:
https://github.com/Pantheon1337/ruscord

