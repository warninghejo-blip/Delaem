# 🦊 Fennec Swap - Fractal Bitcoin Token Exchange

Modern swap interface for Fractal Bitcoin with InSwap integration.

## 🚀 Quick Start - Auto Deploy

### First Time Setup (один раз):

1. **Установи Node.js** (если еще нет):
   - Скачай: https://nodejs.org/
   - Версия: 18+ рекомендуется

2. **Установи Wrangler** (Cloudflare CLI):
   ```bash
   npm install -g wrangler
   ```

3. **Залогинься в Cloudflare**:
   ```bash
   wrangler login
   ```
   Откроется браузер - подтверди авторизацию

4. **Установи зависимости** (в папке проекта):
   ```bash
   npm install
   ```

### Деплой (каждый раз после изменений):

#### Способ 1: Через Cursor IDE (самый удобный) 🎯
1. Нажми `Ctrl+Shift+P` (или `Cmd+Shift+P` на Mac)
2. Набери "Run Task"
3. Выбери "🚀 Deploy to Cloudflare"
4. Готово!

**Или:**
- Нажми `Ctrl+Shift+B` для быстрого запуска

#### Способ 2: Двойной клик ⚡
Просто **дважды кликни на `deploy.bat`** - всё задеплоится автоматически!

#### Способ 3: Через терминал
```bash
# Деплой всего (Worker + Pages)
npm run deploy

# ИЛИ отдельно:
npm run deploy-worker   # Только Worker (API)
npm run deploy-pages    # Только Pages (Frontend)
```

#### Способ 4: Вручную
```bash
# Worker
wrangler deploy

# Pages
wrangler pages deploy . --project-name=fennec-swap
```

## 📁 Структура проекта

```
Fennec site/
├── index.html          # Frontend (главная страница)
├── worker.txt          # Worker код (исходник)
├── worker.js           # Worker код (для деплоя)
├── wrangler.toml       # Cloudflare Worker конфигурация
├── package.json        # NPM конфигурация
├── deploy.bat          # Автоматический деплой (Windows)
└── README.md           # Эта инструкция
```

## ⚙️ Конфигурация

### Worker (wrangler.toml)

Измени `name` если хочешь другое имя Worker:
```toml
name = "fennec-api"  # Будет доступен на: fennec-api.твой-аккаунт.workers.dev
```

### Frontend (index.html)

URL Worker находится в начале файла:
```javascript
const BACKEND_URL = "https://fennec-api.warninghejo.workers.dev";
```

Измени на свой после первого деплоя Worker.

## 🔧 Полезные команды

```bash
# Разработка (локальный сервер)
npm run dev:worker      # Worker на http://localhost:8787

# Логи Worker в реальном времени
wrangler tail

# Информация о проекте
wrangler whoami
```

## 📝 Workflow после изменений

1. **Редактируешь код** в `index.html` или `worker.txt`
2. **Запускаешь** `deploy.bat` (или `npm run deploy`)
3. **Готово!** Изменения на продакшене

## 🐛 Troubleshooting

### "wrangler: command not found"
```bash
npm install -g wrangler
```

### "Not logged in"
```bash
wrangler login
```

### Worker деплоится, Pages нет
Создай Pages проект вручную:
1. Зайди на https://dash.cloudflare.com/
2. Pages → Create project → Direct upload
3. Назови `fennec-swap`

### Ошибка "account_id required"
Добавь в `wrangler.toml`:
```toml
account_id = "твой_account_id"
```
Найти можно: `wrangler whoami`

## 🌟 Features

- ✅ Swap FB ↔ FENNEC
- ✅ Deposit FB/FENNEC to InSwap
- ✅ Withdraw from InSwap
- ✅ Real-time balance checking
- ✅ Transaction status tracking
- ✅ Auto-detect deposit confirmations
- ✅ Mobile responsive

## 🔗 Links

- **Worker API**: https://fennec-api.warninghejo.workers.dev
- **InSwap**: https://inswap.cc
- **Fractal Bitcoin**: https://fractalbitcoin.io
- **UniSat Wallet**: https://unisat.io

## 📄 License

MIT

---

Made with ❤️ for Fractal Bitcoin Community

