# Инструменты для разработки Fennec Swap

## Установка

```bash
npm install
```

## Доступные команды

### Разработка
- `npm run dev` - Запускает локальный сервер для разработки (порт 3000)
- `npm run dev:worker` - Запускает Cloudflare Worker локально
- `npm run dev:all` - Запускает и сервер, и worker одновременно

### Деплой
- `npm run deploy:worker` - Деплой Worker на Cloudflare
- `npm run deploy:pages` - Деплой Pages на Cloudflare
- `npm run deploy` - Деплой всего проекта

### Проверка кода
- `npm run lint` - Проверка и автоисправление JavaScript кода
- `npm run lint:html` - Проверка HTML
- `npm run format` - Форматирование всего кода
- `npm run format:check` - Проверка форматирования без изменений
- `npm run validate` - Полная проверка кода (lint + format check)

## Рекомендуемые расширения VS Code

Установите расширения из `.vscode/extensions.json`:
- Prettier - форматирование кода
- ESLint - проверка JavaScript
- HTMLHint - проверка HTML
- Live Server - локальный сервер с автообновлением

## Структура проекта

- `index.html` - Основной HTML файл приложения
- `worker.js` - Cloudflare Worker (API backend)
- `api/proxy.js` - Vercel API proxy
- `wrangler.toml` - Конфигурация Cloudflare Worker
- `vercel.json` - Конфигурация Vercel

## Отладка

### Локальная разработка
1. Запустите `npm run dev` для локального сервера
2. Откройте http://localhost:3000
3. Изменения в файлах автоматически перезагружают страницу

### Отладка Worker
1. Запустите `npm run dev:worker`
2. Worker будет доступен на локальном порту (обычно 8787)
3. Используйте `console.log` для отладки

### Browser DevTools
- Chrome DevTools: F12 или Ctrl+Shift+I
- Network tab - для проверки API запросов
- Console - для логов и ошибок
- Application tab - для проверки localStorage

## Полезные советы

1. **Форматирование**: Код автоматически форматируется при сохранении (если установлен Prettier)
2. **Линтинг**: Ошибки и предупреждения показываются в VS Code
3. **Live Reload**: Изменения в HTML/CSS/JS автоматически обновляют страницу
4. **Worker Debugging**: Используйте `wrangler tail` для просмотра логов в реальном времени

## Troubleshooting

### Проблемы с портом 3000
Измените порт в `package.json` или `.vscode/settings.json`

### ESLint не работает
Убедитесь что установлены зависимости: `npm install`

### Prettier конфликтует с ESLint
Оба инструмента настроены для совместной работы, но если есть конфликты - проверьте `.eslintrc.json` и `.prettierrc`

