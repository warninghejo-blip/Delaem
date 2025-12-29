# Список API запросов для получения FENNEC ID

## Основные API запросы (action=fractal_audit)

### 1. **Mempool / UTXO данные**
- `https://mempool.fractalbitcoin.io/api/address/${address}` - Статистика адреса (tx_count, балансы)
- `https://mempool.fractalbitcoin.io/api/address/${address}/utxo` - Список UTXO
- `https://uniscan.cc/api/fractal/address/${address}` - Fallback для статистики адреса

### 2. **UniSat Fractal API** (основной источник данных)
Базовый URL: `https://open-api-fractal.unisat.io/v1/indexer`
- **Примечание:** Также доступен `wallet-api-fractal.unisat.io` (для расширения, может требовать аутентификацию)
- **Текущее использование:** Open API (публичный) с Bearer токеном

- **Runes:**
  - `${FRACTAL_BASE}/indexer/address/${address}/runes/balance-list?start=0&limit=100`
  - Получение списка рун на кошельке

- **BRC-20:**
  - `${FRACTAL_BASE}/indexer/address/${address}/brc20/summary?start=0&limit=100`
  - Получение списка BRC-20 токенов

- **Ordinals:**
  - `${FRACTAL_BASE}/indexer/address/${address}/inscription-data?start=0&limit=50`
  - Получение списка ординалов

- **History (для первой транзакции):**
  - `${FRACTAL_BASE}/indexer/address/${address}/history?cursor=0&size=20`
  - Получение истории транзакций (fallback метод)

### 3. **Uniscan API** (оптимизация - один запрос вместо множества)
Базовый URL: `https://uniscan.cc/fractal-api/explorer-v1`

- **Address Summary (ПРИОРИТЕТНЫЙ ИСТОЧНИК):**
  - `https://uniscan.cc/fractal-api/explorer-v1/address/summary?address=${address}`
  - **ОПТИМИЗАЦИЯ:** Один запрос возвращает:
    - `tx_count` - общее количество транзакций
    - `utxo_count` - количество UTXO
    - `native_balance` - нативный баланс
    - `runes_count` - количество рун
    - `brc20_count` - количество BRC-20 токенов
    - `ordinals_count` - количество ординалов
  - Используется как приоритетный источник данных, текущие запросы остаются как fallback

- **Первая транзакция (genesis):**
  - `https://uniscan.cc/fractal-api/explorer-v1/transaction/batch/spent_txid?height=&address=${address}&start=${lastStart}&limit=10`
  - Где `lastStart = Math.floor(tx_count / 10) * 10` (округляем до десятки)
  - Пример: для 12841 транзакций → `start=12840&limit=10`
  - Получаем последние 10 транзакций и находим самую старую

### 4. **InSwap API** (балансы и LP)
Базовый URL: `https://inswap.cc/fractal-api/swap-v1`

- **All Balance (ОПТИМИЗАЦИЯ - один запрос для всех токенов):**
  - `https://inswap.cc/fractal-api/v1/brc20-swap/all_balance?address=${address}` (новый, может возвращать 404)
  - `https://inswap.cc/fractal-api/swap-v1/all_balance?address=${address}&pubkey=${pubkey}` (старый, рабочий)
  - **Возвращает:**
    - Все токены на InSwap (sFB, sBTC, FENNEC, wangcai и т.д.)
    - Балансы каждого токена (swap, module, pendingSwap, pendingAvailable)
    - Цены в USD для каждого токена (поле `price`)
    - Возможно поле `total_usd` с общим балансом в долларах (если доступно)
  - **Использование:** Один запрос заменяет множественные запросы для получения всех токенов и их цен

- **My Pool List:**
  - `https://inswap.cc/fractal-api/swap-v1/my_pool_list?address=${address}&start=0&limit=10&sortType=desc&sortField=liq`
  - Получение списка LP позиций пользователя

- **Select (дополнительные токены):**
  - `https://inswap.cc/fractal-api/swap-v1/select?address=${address}`
  - Получение дополнительных токенов (sBTC, sFB, wangcai и т.д.)

- **Pool Info (цены):**
  - `https://inswap.cc/fractal-api/swap-v1/pool_info?tick0=sBTC___000&tick1=sFB___000` (для цены FB)
  - `https://inswap.cc/fractal-api/swap-v1/pool_info?tick0=FENNEC&tick1=sFB___000` (для цены FENNEC)

### 5. **Цены (CoinMarketCap / CoinGecko)**
- `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,FB&convert=USD` (основной)
- `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd` (fallback для BTC)

## Проблемы с 429 ошибками

### Запросы, которые часто получают 429:
1. **InSwap API:**
   - `all_balance` - получает 429 (5 попыток, задержка 5-30 секунд)
   - `my_pool_list` - получает 429 (5 попыток, задержка 5-30 секунд)

2. **Uniscan API:**
   - `transaction/batch/spent_txid` - получает 429 (1 попытка, затем fallback на UniSat)

3. **UniSat Fractal API:**
   - Все запросы к UniSat API имеют throttling 4000ms между запросами
   - Используется exponential backoff при 429 ошибках

## Текущие настройки

- **Throttling:** 4000ms между запросами к UniSat API
- **Кэш:** 60 секунд для балансов, 30 секунд для метаданных
- **Retry:** 5 попыток для критичных запросов (all_balance, my_pool_list)
- **Exponential backoff:** 5 → 10 → 20 → 30 секунд

## Рекомендации по оптимизации

1. ✅ **РЕАЛИЗОВАНО:** Использование Uniscan Summary API - один запрос вместо множества для получения основных данных (tx_count, runes_count, brc20_count, ordinals_count, utxo_count, native_balance)
2. Увеличить кэш для неизменяемых данных (runes, ordinals) до 5 минут
3. Использовать более агрессивное кэширование для цен (5 минут)
4. Уменьшить количество запросов к InSwap API (использовать только all_balance, если возможно)
5. Добавить очередь запросов для критичных API

## Изменения в коде

- Добавлен запрос к `uniscan.cc/fractal-api/explorer-v1/address/summary` как приоритетный источник данных
- Данные из summary используются для: tx_count, utxo_count, native_balance, runes_count, brc20_count, ordinals_count
- Текущие запросы к UniSat API остаются как fallback, если summary не содержит нужных данных
- Это значительно снижает количество запросов и риск получения 429 ошибок

## Headers для API запросов (обновлено 2025-12-17)

### Uniscan API Headers
Все запросы к Uniscan API теперь используют правильные headers из реальных запросов:
- `Accept: application/json, text/plain, */*`
- `Accept-Encoding: gzip, deflate, br, zstd`
- `Accept-Language: ru,en;q=0.9`
- `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/25.10.0.0 Safari/537.36`
- `Referer: https://uniscan.cc/fractal/address/{address}?assets=fb`
- `Origin: https://uniscan.cc`
- `x-appid: 1adcd7969603261753f1812c9461cd36`
- `x-front-version: 2128`
- `x-sign: {опционально, передается через параметр x-sign-uniscan}`
- `x-ts: {автоматически генерируется или передается через параметр x-ts-uniscan}`
- `Sec-Fetch-Dest: empty`
- `Sec-Fetch-Mode: cors`
- `Sec-Fetch-Site: same-origin`

### InSwap API Headers
Все запросы к InSwap API теперь используют правильные headers из реальных запросов:
- `Accept: application/json, text/plain, */*`
- `Accept-Encoding: gzip, deflate, br, zstd`
- `Accept-Language: ru,en;q=0.9`
- `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/25.10.0.0 Safari/537.36`
- `Referer: https://inswap.cc/swap/assets/account?tab=assets`
- `Origin: https://inswap.cc`
- `x-appid: 1adcd7969603261753f1812c9461cd36`
- `x-front-version: 2094`
- `x-sign: {опционально, передается через параметр x-sign-inswap}`
- `x-ts: {автоматически генерируется или передается через параметр x-ts-inswap}`
- `Sec-Fetch-Dest: empty`
- `Sec-Fetch-Mode: cors`
- `Sec-Fetch-Site: same-origin`

### Передача x-sign и x-ts через параметры запроса

Если у вас есть правильные значения `x-sign` и `x-ts` (например, из браузера), вы можете передать их через параметры запроса:

**Для Uniscan:**
```
?action=fractal_audit&address=...&x-sign-uniscan=456cbba050b7560334ce59a863e41408&x-ts-uniscan=1765934147
```

**Для InSwap:**
```
?action=fractal_audit&address=...&x-sign-inswap=d794f6e37228ead1270076fbb4bdf056&x-ts-inswap=1765934196
```

**Примечание:** Если `x-sign` и `x-ts` не переданы, worker автоматически генерирует `x-ts` (текущий timestamp), но `x-sign` будет отсутствовать. Для полной аутентификации рекомендуется передавать оба параметра.

