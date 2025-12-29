# Что искать в браузере для полного алгоритма x-sign

## В файле `_app-2637cbcbd7da64c9.js` или в DevTools Sources

### 1. Функция `X((0, U.$i)())` - КРИТИЧНО
**Что искать:**
- Откройте DevTools → Sources → Найдите `_app-2637cbcbd7da64c9.js`
- Поиск по тексту: `U.$i` или `X((0,`
- Найдите определение функции `X` или что возвращает `U.$i()`

**Что это может быть:**
- Пустая строка `""`
- Константа типа `"unisat"` или `"uniscan"`
- Еще один timestamp
- Случайная строка

**Где используется:**
```javascript
J += "\n" + timestamp + "@#?.#@" + X((0, U.$i)());
```

### 2. Тип хеша (MD5 или SHA-256) - КРИТИЧНО
**Что искать:**
- Поиск: `new en().update` или `.digest(`
- Найдите определение `en` - это класс хеша
- Проверьте, что это: `MD5`, `SHA256`, `Hash` или что-то другое

**Пример кода:**
```javascript
function ei(S) {
    return new en().update(S).digest((0, U.ms)());
}
```

**Варианты:**
- Если `en` = `MD5` → нужно использовать MD5 (32 символа)
- Если `en` = `SHA256` или `SHA-256` → используем SHA-256 (первые 32 символа)

### 3. Функция `ep` - кодирование параметров
**Что искать:**
- Поиск: `function ep` или `ep =` или `ep:`
- Убедитесь, что все правила кодирования учтены

**Текущие правила (из вашего кода):**
```javascript
encodeURIComponent(value)
    .replace(/'/g, "%27")
    .replace(/%3A/gi, ":")
    .replace(/%24/g, "$")
    .replace(/%2C/gi, ",")
    .replace(/%20/g, "+")
    .replace(/%5B/gi, "[")
    .replace(/%5D/gi, "]")
```

### 4. POST запросы - полная обработка
**Что искать:**
- Найдите полный код после `J += "\n"` в POST блоке
- Убедитесь, что `JSON.stringify(data)` добавляется правильно

**Текущий код:**
```javascript
if (method === "POST" && data) {
    J += "\n";
    J += JSON.stringify(data);
}
```

## Как проверить правильность

1. **Откройте Uniscan в браузере**
2. **Откройте DevTools → Network**
3. **Найдите запрос к `/fractal-api/explorer-v1/address/summary`**
4. **Посмотрите headers:**
   - `x-sign`: `456cbba050b7560334ce59a863e41408`
   - `x-ts`: `1765934147`
5. **Поставьте breakpoint в функции генерации `x-sign`**
6. **Проверьте, что строка `J` формируется правильно**
7. **Проверьте, что хеш от `J` совпадает с `x-sign`**

## Тестовые данные для проверки

**URL:** `/fractal-api/explorer-v1/address/summary?address=bc1pmq3lgs85hjf686j8davaju6v29pf2lydw05fpwplq0443lz9ag5s8u9l9q`
**Timestamp:** `1765934147`
**Ожидаемый x-sign:** `456cbba050b7560334ce59a863e41408`

**Строка J должна быть:**
```
/fractal-api/explorer-v1/address/summary?address=bc1pmq3lgs85hjf686j8davaju6v29pf2lydw05fpwplq0443lz9ag5s8u9l9q
1765934147@#?.#@[X((0, U.$i)())]
```

## Быстрый способ найти

1. Откройте консоль браузера
2. Введите: `debugger;` и нажмите Enter
3. Сделайте запрос на странице Uniscan
4. Когда остановится на breakpoint, найдите в call stack функцию с `x-sign`
5. Изучите переменные в этой функции

