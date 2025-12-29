# Найдена функция Z - нужно найти генерацию X-Sign

## Что мы нашли:
```javascript
function Z(S) {
    let O = S.headers["X-Sign"];
    S.headers["cf-token"] = "".concat(Math.random().toString(36).slice(-6))
        .concat(O.substring(12, 14))
        .concat(Math.random().toString(36).slice(-8), "u")
        .concat(Math.random().toString(36).slice(-8))
}
```

Эта функция **использует** `X-Sign`, но **не генерирует** его.

## Что нужно найти:

### Вариант 1: Поиск установки X-Sign
В том же файле или рядом найдите:

```javascript
// Ищите такие паттерны:
S.headers["X-Sign"] = ...
headers["X-Sign"] = ...
headers['X-Sign'] = ...
S.headers.X-Sign = ...
request.headers["X-Sign"] = ...
```

### Вариант 2: Поиск функции генерации
Ищите функции, которые:
- Принимают параметры (URL, timestamp, и т.д.)
- Возвращают или устанавливают `X-Sign`

```javascript
// Возможные названия функций:
function generateXSign(...)
function createXSign(...)
function getXSign(...)
function signRequest(...)
function generateSign(...)
```

### Вариант 3: Поиск вызова функции Z
Найдите, где вызывается функция `Z`:

```javascript
// Ищите:
Z(...)
// Или где-то выше в коде может быть:
const sign = generateXSign(...);
S.headers["X-Sign"] = sign;
Z(S);
```

## Инструкция:

1. **В том же файле, где нашли функцию `Z`:**
   - Прокрутите вверх и вниз
   - Ищите `X-Sign` или `x-sign` (регистр может отличаться)
   - Ищите функции, которые устанавливают headers

2. **Поиск по всем файлам:**
   - Ctrl+Shift+F
   - Поиск: `headers["X-Sign"]` или `headers['X-Sign']` или `headers.X-Sign`
   - Поиск: `"X-Sign"` или `'X-Sign'`

3. **Поиск генерации:**
   - Поиск: `generateSign` или `createSign` или `signRequest`
   - Поиск: `HMAC` или `crypto.subtle`
   - Поиск: `x-ts` (часто используется вместе с x-sign)

## Что прислать:

Когда найдете код, который **устанавливает** или **генерирует** `X-Sign`, скопируйте:
1. Всю функцию генерации
2. Контекст вокруг (несколько строк до и после)
3. Название функции

Пример того, что мы ищем:
```javascript
function generateXSign(url, timestamp, appId) {
    const message = `${url}${timestamp}${appId}`;
    // ... алгоритм генерации ...
    return hash;
}

// И где-то используется:
S.headers["X-Sign"] = generateXSign(url, timestamp, appId);
```

