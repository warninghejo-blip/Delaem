# Инструкции по деплою

## Что исправлено:

### 1. ✅ Зеркальный текст на обратной стороне карточки
- Добавлены расширенные CSS правила в `index.html`
- Все текстовые элементы (h1-h6, p, div, span, button, a) теперь корректно отображаются без зеркаливания

### 2. ✅ Валидация возраста (first_tx_ts)
- Добавлена строгая проверка `absoluteNow = Math.floor(Date.now() / 1000)`
- Timestamp `1765409223` (2025 год) теперь будет отклонен
- Добавлены дополнительные debug поля для диагностики

### 3. ✅ Fallback для networth при 429 ошибках
- Если `all_balance` возвращает 429, используется оценка на основе FENNEC balance
- Добавлен debug флаг `all_tokens_value_usd_source: 'fallback_fennec_estimate'`

## Как задеплоить:

### Вариант 1: Используйте VSE.bat
```cmd
cd "C:\Users\Дмитрий\Desktop\Fennec site"
VSE.bat
```

### Вариант 2: Wrangler вручную
```cmd
cd "C:\Users\Дмитрий\Desktop\Fennec site"
wrangler deploy
wrangler pages deploy . --project-name=fennec-site
```

### Вариант 3: Только Worker (если Pages уже задеплоен)
```cmd
cd "C:\Users\Дмитрий\Desktop\Fennec site"
wrangler deploy
```

## После деплоя:

1. Откройте сайт `fennecbtc.xyz`
2. Подключите кошелек
3. Нажмите "GET YOUR ID"
4. Проверьте в консоли браузера:
   - Текст на обратной стороне карточки должен быть нормальным (не зеркальным)
   - Возраст должен быть корректным (не 359 дней в будущем)
   - Networth должен показать хотя бы примерную оценку (даже если all_balance возвращает 429)

## Debug информация:

После аудита проверьте в debug JSON:
- `first_tx_absolute_now_check` - текущее время
- `first_tx_candidate_vs_now` - сравнение timestamp с текущим временем
- `all_tokens_value_usd_source` - источник данных для networth
  - `'all_balance_total_usd'` - данные из all_balance API (лучший вариант)
  - `'calculated_from_prices'` - рассчитано из цен токенов
  - `'fallback_fennec_estimate'` - fallback оценка при 429 ошибках

## Если все еще есть проблемы:

1. Проверьте в консоли браузера ошибки
2. Скопируйте debug JSON из ответа API
3. Сообщите, какие значения вы видите для:
   - `first_tx_ts`
   - `first_tx_absolute_now_check`
   - `first_tx_candidate_vs_now`
   - `all_tokens_value_usd`
   - `all_tokens_value_usd_source`

