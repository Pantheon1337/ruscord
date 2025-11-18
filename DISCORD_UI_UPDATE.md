# Обновление интерфейса Discord

## Что было сделано:

1. ✅ Обновлены глобальные стили (index.css) - цветовая схема Discord, шрифты Whitney
2. ✅ Обновлен ServerList - точная копия Discord с индикаторами и анимациями
3. ✅ Обновлен ChannelList - категории каналов, иконки, индикаторы непрочитанных
4. ✅ Обновлен ChatView - заголовок канала с иконками, сообщения, реакции, панель ввода
5. ✅ Создан MemberList - панель участников справа с группировкой по статусу
6. ✅ Добавлена интерактивность - ховер-эффекты, отправка по Enter

## Структура интерфейса:

```
MainLayout
├── ServerList (72px, слева)
└── Routes
    └── ServerView
        ├── ChannelList (240px)
        ├── ChatView (основная область)
        └── MemberList (240px, справа, только для серверов)
```

## Если изменения не видны:

1. **Перезапустите dev server:**
   ```bash
   cd packages/frontend
   npm run dev
   ```

2. **Очистите кэш браузера:**
   - Нажмите Ctrl+Shift+R (Windows/Linux) или Cmd+Shift+R (Mac)
   - Или откройте DevTools (F12) → вкладка Network → включите "Disable cache"

3. **Проверьте, что все файлы сохранены:**
   - index.css
   - ServerList.css
   - ChannelList.css и ChannelList.tsx
   - ChatView.css и ChatView.tsx
   - MemberList.css и MemberList.tsx
   - ServerView.tsx
   - MainLayout.tsx

## Цветовая схема Discord:

- Фон серверов: #202225
- Фон каналов: #2f3136
- Фон чата: #36393f
- Акцент: #5865f2
- Текст: #dcddde
- Текст вторичный: #8e9297

