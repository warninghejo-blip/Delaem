# Проблемы Fennec ID Card - Для Gemini

## Описание проекта
Fennec Swap - децентрализованный обменник на Fractal Bitcoin. Есть система Fennec ID Card, которая показывает статистику пользователя.

## Основные проблемы

### 1. Цена FENNEC округляется до 4 знаков вместо 6
**Проблема:** Цена FENNEC отображается с округлением до 4 знаков после запятой, но нужно показывать 6 знаков.

**Где отображается:** В элементе с `id="chartPrice"` на странице терминала.

**Текущий код:** Используется `toString()` или `toFixed(6)`, но почему-то показывает только 4 знака.

**Требование:** Всегда показывать 6 знаков после запятой для цены FENNEC.

---

### 2. Карточка уезжает вниз при нажатии (3D flip)
**Проблема:** При клике на карточку для переворота (flip), карточка смещается вниз, а не остается на месте.

**Структура:**
- `.card-scene` - контейнер с perspective
- `.card-object` - объект для 3D поворота
- `.card-face.face-front` - лицевая сторона
- `.card-face.face-back` - обратная сторона

**Текущий CSS:**
```css
.card-scene {
    perspective: 1000px;
    width: 320px;
    height: 450px;
    margin: 0 auto;
    position: relative;
    z-index: 10;
    overflow: visible;
}

.card-object {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    transform-style: preserve-3d;
    transition: transform 0.6s ease-in-out;
    border-radius: 24px;
    transform-origin: center center;
    will-change: transform;
}

.card-object.is-flipped {
    transform: rotateY(180deg);
}

.card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    border-radius: 24px;
    overflow: visible;
    background: #000;
    border: 3px solid transparent;
}

.face-back {
    transform: rotateY(180deg);
}

.card-object.is-flipped .face-front {
    transform: rotateY(180deg);
}

.card-object.is-flipped .face-back {
    transform: rotateY(0deg);
}
```

**JavaScript для переворота:**
```javascript
onclick="this.querySelector('.card-object').classList.toggle('is-flipped')"
```

**Требование:** Карточка должна оставаться на месте при повороте, не смещаясь вниз.

---

### 3. LP и Age не всегда загружаются
**Проблема:** Данные о ликвидности (LP) и возрасте (first_tx_ts) не всегда загружаются с первого раза.

**API endpoints:**
- `all_balance`: `https://inswap.cc/fractal-api/v1/brc20-swap/all_balance?address=...`
- `my_pool_list`: `https://inswap.cc/fractal-api/swap-v1/my_pool_list?address=...`
- `genesis_tx`: UniSat API для получения первой транзакции

**Проблемы:**
- Rate limiting (429 ошибки) от InSwap API
- Timestamp validation - иногда проходит будущий timestamp (например, 1765409223 = 2025 год)
- Sequential execution может не помочь при сильном rate limiting

**Текущая логика:**
- `all_balance` и `my_pool_list` выполняются последовательно
- Retries: 1, delay: 10000ms
- Exponential backoff: 2, 4, 8, 16, 32 секунды

**Требование:** Гарантированно получать все данные (LP, Age) при каждом запросе, даже при rate limiting.

---

## Релевантные фрагменты кода

### index.html - CSS для карточки (строки 353-434)
```css
.card-scene {
    perspective: 1000px;
    width: 320px;
    height: 450px;
    margin: 0 auto;
    position: relative;
    z-index: 10;
    overflow: visible;
}

.card-object {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    transform-style: preserve-3d;
    transition: transform 0.6s ease-in-out;
    border-radius: 24px;
    transform-origin: center center;
    will-change: transform;
}

.card-object.is-flipped {
    transform: rotateY(180deg);
}

.card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    border-radius: 24px;
    overflow: visible;
    background: #000;
    border: 3px solid transparent;
}

.face-back {
    transform: rotateY(180deg);
}

.card-object.is-flipped .face-front {
    transform: rotateY(180deg);
}

.card-object.is-flipped .face-back {
    transform: rotateY(0deg);
}
```

### index.html - Обновление цены FENNEC (строки 4552-4575)
```javascript
// Обновляем цену и изменение
if (filtered.length > 1) {
    const current = filtered[filtered.length - 1].price;
    const first = filtered[0].price;
    const change = ((current - first) / first) * 100;
    
    const priceEl = document.getElementById('chartPrice') || document.getElementById('currentPrice');
    const changeEl = document.getElementById('chartPriceChange') || document.getElementById('priceChange');
    if(priceEl) {
        // ИСПРАВЛЕНИЕ: Сохраняем и отображаем точное значение без округления
        priceEl.dataset.price = current.toString();
        priceEl.innerText = current.toString(); // Точная цена без округления
    }
    // ...
} else if (filtered.length === 1) {
    const priceEl = document.getElementById('chartPrice') || document.getElementById('currentPrice');
    if(priceEl) {
        priceEl.dataset.price = filtered[0].price.toString();
        priceEl.innerText = filtered[0].price.toString(); // Точная цена без округления
    }
}
```

### index.html - HTML структура карточки (строка 6409)
```html
<div class="card-scene group" onclick="this.querySelector('.card-object').classList.toggle('is-flipped')">
    <div class="card-object ${metrics.hasFennecSoul ? 'fennec-pulse' : ''}" id="card3D">
        <!-- FRONT FACE -->
        <div class="card-face face-front ${rarityClass} ${soulClass} flex flex-col">
            <!-- ... -->
        </div>
        <!-- BACK FACE -->
        <div class="card-face face-back ${rarityClass} flex flex-col">
            <!-- ... -->
        </div>
    </div>
</div>
```

### worker.js - Загрузка LP (строки 1390-1450)
```javascript
// ОПТИМИЗАЦИЯ: allBalance и myPoolList выполняются последовательно для снижения rate limiting
debugInfo.all_balance_parallel = false;
debugInfo.my_pool_list_parallel = false;
debugInfo.sequential_execution = true;

try {
    allBalance = await Promise.race([
        allBalancePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]).catch(() => null);

    if (allBalance) {
        myPoolList = await Promise.race([
            myPoolListPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]).catch(() => null);
    }
} catch(e) {
    // Игнорируем ошибки
}
```

### worker.js - Валидация timestamp (строки 1934-1959)
```javascript
} else if (firstTxTs > 0) {
    // КРИТИЧЕСКОЕ: Проверяем timestamp на будущее время ПЕРЕД проверкой диапазона
    const finalCheckYear = new Date(firstTxTs * 1000).getFullYear();
    const finalCheckMonth = new Date(firstTxTs * 1000).getMonth();
    const finalCheckDay = new Date(firstTxTs * 1000).getDate();
    const finalIsFutureYear = finalCheckYear > currentYear;
    const finalIsFutureMonth = finalCheckYear === currentYear && finalCheckMonth > currentMonth;
    const finalIsFutureDay = finalCheckYear === currentYear && finalCheckMonth === currentMonth && finalCheckDay > currentDay;
    
    // КРИТИЧЕСКОЕ: Проверяем СНАЧАЛА что timestamp не в будущем
    if (finalIsFutureYear || finalIsFutureMonth || finalIsFutureDay || firstTxTs > validationNow) {
        // Отклоняем если это будущее время
        debugInfo.first_tx_final_validation_error = true;
        debugInfo.first_tx_final_validation = 'timestamp_future_final_check';
        debugInfo.first_tx_error = `Final check failed: timestamp ${firstTxTs}...`;
        firstTxTs = 0;
    } else if (firstTxTs >= MIN_VALID && firstTxTs <= validationNow) {
        // Timestamp валидный
        debugInfo.first_tx_final_validation = 'passed';
    }
}
```

---

## Примеры дебага

### Успешный деплой:
```json
{
    "has_fennec_in_lp": true,
    "first_tx_ts": 1725847043,
    "lp_count": 1,
    "lp_value_fb": 320.35,
    "lp_value_usd": 131.84
}
```

### Проблемный деплой:
```json
{
    "has_fennec_in_lp": false,
    "first_tx_ts": 1765409223,  // Будущий timestamp!
    "lp_count": 0,
    "lp_value_fb": 0,
    "lp_value_usd": 0,
    "_debug": {
        "all_balance_rate_limited": true,
        "my_pool_list_rate_limited": true,
        "first_tx_final_validation": "passed"  // Неправильно!
    }
}
```

---

## Retry логика (текущая)

### all_balance и my_pool_list
- Retries: 1
- Delay: 10000ms (10 секунд)
- Exponential backoff: не используется (фиксированная задержка)
- Timeout: 15000ms (15 секунд)

### genesis_tx
- Retries: 1
- Delay: 8000ms (8 секунд)
- Timeout: зависит от метода

**Проблема:** При rate limiting (429) один retry с задержкой 10 секунд недостаточно. Нужно больше попыток с экспоненциальным backoff.

---

## Что нужно исправить

1. **Цена FENNEC:** Гарантированно показывать 6 знаков после запятой (использовать `toFixed(6)` или форматирование)
2. **Карточка:** Исправить CSS/JS чтобы карточка не смещалась при flip (возможно проблема с высотой контента или позиционированием)
3. **LP и Age:** 
   - Увеличить количество retries до 3-5
   - Использовать экспоненциальный backoff: 2, 4, 8, 16, 32 секунды
   - Улучшить валидацию timestamp - строже проверять будущие значения
   - Добавить fallback методы для получения данных

---

## Дополнительная информация

### API Rate Limits
- InSwap API: очень строгие лимиты, часто возвращает 429
- UniSat API: также имеет rate limits
- Нужно использовать более агрессивную retry стратегию

### Timestamp Validation
- Проблема: timestamp `1765409223` = 2025-09-10 (будущее!)
- Валидация должна быть строже
- Проверка должна происходить ДО установки `first_tx_final_validation = 'passed'`

### Цена FENNEC
- Текущее значение может быть очень маленьким (например, 0.00046855503009480816)
- `toString()` может показывать научную нотацию или округлять
- Нужно использовать `toFixed(6)` или специальное форматирование для гарантии 6 знаков

