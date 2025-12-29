# Быстрая инструкция: Как найти x-sign алгоритм

## Шаг 1: Откройте DevTools
1. Откройте https://uniscan.cc/fractal/address/bc1pmq3lgs85hjf686j8davaju6v29pf2lydw05fpwplq0443lz9ag5s8u9l9q
2. Нажмите **F12** (или Ctrl+Shift+I)
3. Перейдите на вкладку **Sources** (Источники)

## Шаг 2: Найдите нужные файлы

### Вариант A: Поиск по всем файлам (Самый быстрый)
1. Нажмите **Ctrl+Shift+F** (поиск по всем файлам)
2. Введите: `x-sign`
3. Нажмите Enter
4. Просмотрите найденные результаты

### Вариант B: Поиск в конкретных файлах
Найдите и откройте эти файлы (они загружаются на странице):

**Приоритет 1 (наиболее вероятно):**
- `pages/_app-2637cbcbd7da64c9.js`
  - Путь: Sources → Page → uniscan.cc → _next → static → chunks → pages → _app-2637cbcbd7da64c9.js

**Приоритет 2:**
- `pages/address/[address]-6f69c84d2ba8284e.js`
  - Путь: Sources → Page → uniscan.cc → _next → static → chunks → pages → address → [address]-6f69c84d2ba8284e.js

**Приоритет 3:**
- `main-356a40b23ab6d589.js`
  - Путь: Sources → Page → uniscan.cc → _next → static → chunks → main-356a40b23ab6d589.js

## Шаг 3: Что искать в коде

Откройте найденный файл и найдите:

1. **Поиск по ключевым словам:**
   - `x-sign` или `'x-sign'` или `"x-sign"`
   - `x-ts` или `'x-ts'` или `"x-ts"`
   - `generateSign` или `createSign` или `signRequest`
   - `HMAC` или `crypto.subtle.digest`
   - `x-appid` (может использоваться как секретный ключ)

2. **Что должно быть в коде:**
   ```javascript
   // Пример того, что мы ищем:
   const xSign = generateSign(url, timestamp);
   headers['x-sign'] = xSign;
   headers['x-ts'] = timestamp;

   // Или:
   function generateSign(url, ts) {
       // Алгоритм генерации
       return hash;
   }
   ```

## Шаг 4: Скопируйте код

Когда найдете функцию генерации `x-sign`:
1. Выделите весь код функции (включая название функции)
2. Скопируйте (Ctrl+C)
3. Отправьте мне

## Альтернативный метод: Network Tab

Если не можете найти в Sources:

1. Откройте вкладку **Network** (Сеть)
2. Обновите страницу (F5)
3. Найдите запрос к `/fractal-api/explorer-v1/address/summary`
4. Кликните на запрос
5. Перейдите на вкладку **Initiator** (Инициатор)
6. Кликните на файл в стеке вызовов - это откроет нужный файл в Sources

## Что делать, если не нашли?

1. Попробуйте поиск по другим ключевым словам:
   - `signature`
   - `auth`
   - `header`
   - `request`

2. Проверьте расширения браузера:
   - Если используется UniSat Wallet, алгоритм может быть в расширении
   - Chrome: `chrome://extensions/` → Найдите UniSat → "Просмотреть код"

3. Используйте временное решение:
   - Передавайте `x-sign` и `x-ts` через параметры запроса (уже реализовано в worker.js)

