# Как найти алгоритм генерации x-sign

## Метод 1: Поиск в исходном коде сайта (Рекомендуется)

### Шаги:

1. **Откройте сайт в браузере:**
   - Uniscan: https://uniscan.cc/fractal/address/...
   - InSwap: https://inswap.cc/swap/assets/account?tab=assets

2. **Откройте DevTools (F12) → Sources (Источники)**

3. **Найдите JavaScript файлы:**

   **Наиболее релевантные файлы (из вашего HTML):**
   - `pages/_app-2637cbcbd7da64c9.js` - Главный файл приложения (наиболее вероятное место)
   - `pages/address/%5Baddress%5D-6f69c84d2ba8284e.js` - Файл страницы адреса (URL-encoded, реальный путь: `pages/address/[address]-6f69c84d2ba8284e.js`)
   - `main-356a40b23ab6d589.js` - Основной файл
   - `framework-8ef029604074ff75.js` - Фреймворк

   **Как найти в DevTools:**
   - Откройте **Sources** → **Page** → Найдите папку с доменом (например, `uniscan.cc`)
   - Или используйте поиск (Ctrl+Shift+F) по всем файлам:
     - Поиск: `x-sign`
     - Поиск: `generateSign`
     - Поиск: `sign.*timestamp`
     - Поиск: `HMAC`
     - Поиск: `crypto.subtle`
     - Поиск: `x-ts` (часто используется вместе с x-sign)

4. **Найдите функцию генерации:**
   - Ищите функции, которые создают headers
   - Ищите функции, которые используют `x-ts` и `x-sign`
   - Ищите функции с названиями типа: `generateSign`, `createSign`, `signRequest`, `getHeaders`

5. **Скопируйте найденный код** и отправьте мне

## Метод 2: Поиск через Console (Быстрый способ)

1. **Откройте Console в DevTools (F12 → Console)**

2. **Выполните поиск в глобальных объектах:**
```javascript
// Поиск функции генерации x-sign
Object.getOwnPropertyNames(window).filter(name => name.toLowerCase().includes('sign'))

// Поиск в объектах API
Object.getOwnPropertyNames(window).filter(name => name.toLowerCase().includes('api'))

// Поиск в объектах fetch/interceptor
// (если используется axios или другой HTTP клиент)
```

3. **Попробуйте найти функцию через Network interceptor:**
```javascript
// Перехватываем все fetch запросы
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('Fetch intercepted:', args);
    return originalFetch.apply(this, args);
};

// Затем сделайте запрос на сайте и посмотрите в консоль
```

## Метод 3: Анализ паттернов (Если не найдете код)

Из ваших примеров:
- **Uniscan:** `x-sign=456cbba050b7560334ce59a863e41408`, `x-ts=1765934147`
- **InSwap:** `x-sign=d794f6e37228ead1270076fbb4bdf056`, `x-ts=1765934196`

Оба `x-sign` имеют длину **32 символа (hex)**, что может быть:
- MD5 хеш (32 символа)
- Первые 32 символа SHA-256 (64 символа, но берут первые 32)
- HMAC-SHA256 (первые 32 символа)

### Возможные алгоритмы для проверки:

1. **MD5 от URL + timestamp:**
```javascript
const message = `${url}${timestamp}`;
const hash = md5(message); // 32 символа
```

2. **SHA-256 от URL + timestamp (первые 32 символа):**
```javascript
const message = `${url}${timestamp}`;
const hash = sha256(message).substring(0, 32);
```

3. **HMAC-SHA256 с секретным ключом:**
```javascript
const message = `${url}${timestamp}`;
const secret = 'секретный_ключ'; // Нужно найти
const hash = hmacSha256(message, secret).substring(0, 32);
```

4. **HMAC-SHA256 с x-appid как секретом:**
```javascript
const message = `${url}${timestamp}`;
const secret = '1adcd7969603261753f1812c9461cd36'; // x-appid
const hash = hmacSha256(message, secret).substring(0, 32);
```

## Метод 4: Использование браузерного расширения

Если сайт использует расширение браузера (например, UniSat Wallet), алгоритм может быть в расширении:
- Chrome: `chrome://extensions/` → Найдите расширение → "Просмотреть код"
- Ищите файлы с названиями типа `background.js`, `content.js`, `inject.js`

## Что делать после нахождения:

1. **Скопируйте найденный код функции генерации x-sign**
2. **Отправьте мне код** - я интегрирую его в worker.js
3. **Или опишите алгоритм словами** - я реализую его

## Альтернатива: Временное решение

Пока мы ищем алгоритм, можно:
1. **Использовать значения из браузера** - передавать `x-sign` и `x-ts` через параметры запроса
2. **Создать браузерное расширение** - которое будет генерировать правильные headers
3. **Использовать прокси** - который будет добавлять headers из браузера

## Тестирование найденного алгоритма

После того как найдете алгоритм, мы можем протестировать его:

```javascript
// Пример теста
const url = 'https://uniscan.cc/fractal-api/explorer-v1/address/summary?address=...';
const timestamp = 1765934147;
const expectedSign = '456cbba050b7560334ce59a863e41408';

const calculatedSign = generateXSign(url, timestamp);
console.log('Expected:', expectedSign);
console.log('Calculated:', calculatedSign);
console.log('Match:', calculatedSign === expectedSign);
```

