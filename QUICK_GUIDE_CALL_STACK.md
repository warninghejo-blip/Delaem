# Быстрая инструкция: Как использовать Call Stack

## Что такое Call Stack простыми словами?

**Call Stack** - это список функций, которые были вызваны одна за другой. Это как история: "сначала вызвали функцию A, потом она вызвала функцию B, потом B вызвала функцию C".

## Пошаговая инструкция:

### 1. В консоли найдите сообщение:
```
✅ НАЙДЕН ЗАПРОС С X-SIGN (fetch)
```

### 2. Под сообщением будет строка:
```
at fetch (simple_x_sign_finder.js:45)
at someFunction (_app-2637cbcbd7da64c9.js:123)  ← КЛИКНИТЕ СЮДА!
at requestInterceptor (_app-2637cbcbd7da64c9.js:456)
```

### 3. Кликните на любую строку, которая НЕ `simple_x_sign_finder.js`

Например, кликните на:
- `_app-2637cbcbd7da64c9.js:123`
- или `_app-2637cbcbd7da64c9.js:456`

### 4. Откроется вкладка Sources с кодом

Вы увидите код функции, которая устанавливает x-sign.

### 5. Найдите в коде:

**Ищите строку, где устанавливается x-sign:**
```javascript
S.headers["x-sign"] = ei(J);
// или
headers["x-sign"] = ei(J);
```

**Найдите функции:**
- `ei(J)` - что это? Найдите определение `function ei`
- `X((0, U.$i)())` - что возвращает? Найдите `U.$i` и `function X`
- `ep(T)` - как кодирует? Найдите `function ep`

### 6. Скопируйте весь код функции и отправьте мне

## Визуальный пример:

```
Консоль:
┌─────────────────────────────────────┐
│ ✅ НАЙДЕН ЗАПРОС С X-SIGN (fetch)  │
│ URL: https://uniscan.cc/...         │
│ x-sign: 456cbba...                  │
│                                     │
│ ▼ at fetch (simple_x_sign_finder...)│ ← НЕ КЛИКАЙТЕ СЮДА
│   at requestInterceptor (app.js:456)│ ← КЛИКНИТЕ СЮДА!
│   at axios.interceptors...          │
└─────────────────────────────────────┘
```

После клика откроется:
```
Sources → _app-2637cbcbd7da64c9.js:456

function requestInterceptor(S) {
    let I = Math.floor(Date.now() / 1e3);
    let J = (S.baseURL || "") + S.url;
    // ... код ...
    S.headers["x-sign"] = ei(J);  ← ВОТ ОНА!
    return S;
}
```

## Если не видите call stack:

1. Убедитесь, что вы развернули сообщение (нажмите на стрелку ▶)
2. Или найдите в консоли строку с `console.trace()` - там будет список функций
3. Кликните на любую функцию из списка (кроме `simple_x_sign_finder.js`)

## Что скопировать:

Скопируйте **весь код функции**, где устанавливается `x-sign`, включая:
- Определения `ei`, `X`, `U.$i`, `ep`
- Код формирования строки `J`
- Код установки headers

**Пример того, что нужно:**
```javascript
// Вся функция requestInterceptor
S.interceptors.request.use(S => {
    let I = Math.floor(Date.now() / 1e3);
    let J = (S.baseURL || "") + S.url;
    J = J.replace(/https?:\/\/[^/]+/, "");
    // ... весь код ...
    J += "\n" + I + e_ + X((0, U.$i)());
    S.headers[ea((0, U.tt)())] = ei(J);
    S.headers[eo((0, U.Q9)())] = I;
    return S;
});

// И определения функций:
function ei(S) { ... }
function X(...) { ... }
U.$i = function() { ... }
```

