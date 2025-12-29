# Инструкция: Что искать в файле app-2637cbcbd7da64c9.js

## Используйте поиск (Ctrl+F) в файле и ищите:

### 1. Функция `ei` - хеширование (КРИТИЧНО!)
**Поиск:** `function ei` или `const ei =` или `ei = function`

**Что искать:**
```javascript
function ei(S) {
    return new en().update(S).digest(...);
}
```

**Также найдите `en`:**
**Поиск:** `new en()` или `const en =` или `en = MD5` или `en = SHA256`

### 2. Функция `X` - что возвращает X((0, U.$i)())
**Поиск:** `function X` или `const X =` или `X = function`

**Также найдите `U.$i`:**
**Поиск:** `U.$i` или `U["$i"]` или `U['$i']`

### 3. Функция `ep` - кодирование параметров
**Поиск:** `function ep` или `const ep =` или `ep = function`

### 4. Функции `ea`, `eo`, `L` - имена заголовков
**Поиск:**
- `function ea` или `const ea =`
- `function eo` или `const eo =`
- `function L` или `const L =`

### 5. Переменные `ed`, `ef`
**Поиск:**
- `const ed =` или `var ed =` или `let ed =`
- `const ef =` или `var ef =` или `let ef =`

## Как искать:

1. Откройте файл `app-2637cbcbd7da64c9.js` в DevTools → Sources
2. Нажмите Ctrl+F (поиск)
3. Введите один из поисковых запросов выше
4. Нажмите Enter
5. Если нашли - скопируйте код функции
6. Повторите для всех поисковых запросов

## Что скопировать:

Когда найдете каждую функцию, скопируйте:
- Всю функцию (от `function` до `}`)
- Или определение переменной (от `const`/`let`/`var` до `;`)

## Особенно важно найти:

1. **`ei(J)`** - это функция хеширования. Нужно понять:
   - Использует ли она MD5 или SHA-256?
   - Как именно она хеширует строку J?

2. **`X((0, U.$i)())`** - что возвращает?
   - Пустая строка `""`?
   - Константа `"unisat"`?
   - Что-то другое?

## Пример того, что нужно найти:

```javascript
// Пример 1: Функция ei
function ei(S) {
    const en = require('crypto-js/md5');
    return new en().update(S).digest('hex').substring(0, 32);
}

// Пример 2: Функция X и U.$i
U.$i = function() {
    return "";  // или "unisat" или что-то другое
}
function X(s) {
    return s;
}

// Пример 3: Функция ep
function ep(T) {
    return encodeURIComponent(T)
        .replace(/'/g, "%27")
        .replace(/%3A/gi, ":")
        // ... остальные правила
}
```

