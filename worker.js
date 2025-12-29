import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';

let __provenanceSigner = null;
let __provenanceSignerKeyId = null;
let __provenanceSignerJwkString = null;
let __provenanceSignerPublicJwk = null;

export default {
    async fetch(request, env, ctx) {
        // КРИТИЧЕСКОЕ: CORS заголовки должны быть определены в самом начале
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-public-key, x-address, Authorization',
            'Access-Control-Max-Age': '86400'
        };

        // Обработка OPTIONS запросов
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // КРИТИЧЕСКОЕ: Определяем sendJSON ДО try блока, чтобы он был доступен в catch
        const sendJSON = (data, status = 200, cacheSeconds = 0, cacheScope = 'private') => {
            const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
            const isGet = String(request?.method || 'GET').toUpperCase() === 'GET';
            if (!isGet) {
                headers['Cache-Control'] = 'no-store';
            } else if (Number(cacheSeconds || 0) > 0) {
                const scope = cacheScope === 'public' ? 'public' : 'private';
                const secs = Math.max(1, Number(cacheSeconds) || 0);
                headers['Cache-Control'] =
                    scope === 'public' ? `public, max-age=${secs}, s-maxage=${secs}` : `private, max-age=${secs}`;
            } else {
                headers['Cache-Control'] = 'no-store';
            }
            return new Response(JSON.stringify(data), { status, headers });
        };

        // КРИТИЧЕСКОЕ: Обертка для гарантированного возврата CORS заголовков при любой ошибке
        // Включая ошибки при парсинге URL
        try {
            const url = new URL(request.url);
            const action = url.searchParams.get('action');
            const API_KEY = env?.UNISAT_API_KEY || env?.API_KEY || '';
            const CMC_API_KEY = env?.CMC_API_KEY || env?.CMC_PRO_API_KEY || '';
            // ИСПРАВЛЕНИЕ: Используем правильные endpoints из UniSat Wallet констант
            // wallet-api требует аутентификации и может иметь больший приоритет для снижения 429 ошибок
            const WALLET_API_FRACTAL = 'https://wallet-api-fractal.unisat.io'; // Wallet API (требует аутентификации)
            // ОПТИМИЗАЦИЯ: Разделяем запросы между двумя API для снижения rate limiting
            // Стратегия: все запросы идут на open-api-fractal.unisat.io, так как это Fractal-специфичные данные
            // Если нужно распределить нагрузку, можно часть запросов перенести на open-api.unisat.io
            const FRACTAL_BASE = 'https://open-api-fractal.unisat.io/v1'; // Open API Fractal (для всех Fractal-специфичных запросов)
            const UNISAT_BASE = 'https://open-api.unisat.io/v1'; // Open API общий (резерв, если нужно распределить нагрузку)
            const BTC_BASE = 'https://open-api.unisat.io';
            const INSWAP_URL = 'https://inswap.cc/fractal-api/swap-v1'; // Старый URL для обратной совместимости
            const INSWAP_V1_URL = 'https://inswap.cc/fractal-api/v1/brc20-swap'; // Правильный URL по документации

            // КРИТИЧЕСКОЕ: Для brc20-swap эндпоинтов используем FRACTAL_BASE
            // Все brc20-swap запросы должны идти на open-api-fractal.unisat.io (они Fractal-специфичные)
            // Если нужно распределить нагрузку, можно использовать UNISAT_BASE, но это может не работать для Fractal сети
            const SWAP_BASE = FRACTAL_BASE; // Для brc20-swap используем Fractal API (обязательно для Fractal сети)

            const DEFAULT_FEE_TICK = 'sFB___000';

            // ИСПРАВЛЕНИЕ: Строгая функция санитизации timestamp - убийца будущего
            const sanitizeTimestamp = ts => {
                if (!ts || ts === 0) return 0;
                // Конвертируем миллисекунды в секунды
                if (ts > 1000000000000) ts = Math.floor(ts / 1000);

                const now = Math.floor(Date.now() / 1000);
                const minValid = 1700000000; // Nov 2023

                // СТРОГАЯ ПРОВЕРКА: Если timestamp в будущем, возвращаем 0
                if (ts > now) {
                    return 0; // Жестко обнуляем любые даты из будущего
                }
                if (ts < minValid) {
                    return 0; // Слишком старый
                }

                return ts;
            };

            // Headers forwarding
            const incomingPubKey = request.headers.get('x-public-key');
            const incomingAddress = request.headers.get('x-address');

            const upstreamHeaders = {
                'Content-Type': 'application/json',
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            if (API_KEY) upstreamHeaders.Authorization = `Bearer ${API_KEY}`;

            const unisatApiHeaders = {
                ...upstreamHeaders,
                Accept: 'application/json, text/plain, */*'
            };

            const requireUniSatKey = () => {
                if (!API_KEY) {
                    throw new Error('UNISAT_API_KEY is not configured on the server.');
                }
            };

            const authHeaders = () => {
                requireUniSatKey();
                return { Authorization: `Bearer ${API_KEY}` };
            };

            if (incomingPubKey) upstreamHeaders['x-public-key'] = incomingPubKey;
            if (incomingAddress) upstreamHeaders['x-address'] = incomingAddress;

            // ИСПРАВЛЕНИЕ: Инициализируем debugInfo в самом начале, чтобы он был доступен везде
            // Определяем его как пустой объект, он будет заполнен позже в fractal_audit
            const debugInfo = {};

            const stableSortObject = value => {
                if (value == null || typeof value !== 'object') return value;
                if (Array.isArray(value)) return value.map(stableSortObject);
                const keys = Object.keys(value).sort();
                const out = {};
                for (const k of keys) out[k] = stableSortObject(value[k]);
                return out;
            };

            const stableStringify = value => JSON.stringify(stableSortObject(value));

            const bytesToBase64 = bytes => {
                let binary = '';
                for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
                return btoa(binary);
            };

            const getProvenanceSigner = async () => {
                const jwkString = env?.PROVENANCE_SIGNING_KEY_JWK || env?.provenance_signing_key_jwk || '';
                if (!jwkString) return null;

                const keyId = env?.PROVENANCE_KEY_ID || env?.provenance_key_id || 'default';
                if (
                    __provenanceSigner &&
                    __provenanceSignerJwkString === jwkString &&
                    __provenanceSignerKeyId === keyId
                ) {
                    return {
                        key: __provenanceSigner,
                        publicJwk: __provenanceSignerPublicJwk,
                        keyId: __provenanceSignerKeyId
                    };
                }

                let jwk;
                try {
                    jwk = JSON.parse(jwkString);
                } catch {
                    throw new Error('PROVENANCE_SIGNING_KEY_JWK is not valid JSON.');
                }

                const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
                    'sign'
                ]);

                const publicJwk = { ...jwk };
                delete publicJwk.d;
                publicJwk.key_ops = ['verify'];

                __provenanceSigner = key;
                __provenanceSignerJwkString = jwkString;
                __provenanceSignerKeyId = keyId;
                __provenanceSignerPublicJwk = publicJwk;

                return { key, publicJwk, keyId };
            };

            // ИСПРАВЛЕНИЕ: Убрана подпись пользователя - не требуется для этих API
            // const userSignature = url.searchParams.get('signature') || '';
            // if (userSignature) {
            //     upstreamHeaders['x-signature'] = userSignature;
            //     debugInfo.user_signature_provided = true;
            //     debugInfo.user_signature_length = userSignature.length;
            // } else {
            //     debugInfo.user_signature_provided = false;
            // }

            // Функция генерации x-sign и x-ts для InSwap/Unisat API
            // АЛГОРИТМ НАЙДЕН В БРАУЗЕРЕ: Из функции eh в _app-2637cbcbd7da64c9.js
            // Найдено:
            // - ep(T): кодирование параметров ✅
            // - ed: /https?:\/\/[^/]+/ ✅
            // - ef: ["/api/", "/btc-api/", "/fractal-api/"] ✅
            // - e_: "@#?.#@" ✅
            // - X по умолчанию = eu (но eu зависит от N.a7 и N.Em, которые неизвестны)
            // - U.$i(): что возвращает? ❓
            // - en: класс хеша (MD5 или SHA-256?) ❓
            // Алгоритм:
            // 1. Формируется строка J из URL (без домена) + параметры + "\n" + timestamp + "@#?.#@" + X(U.$i())
            // 2. От строки J делается хеш через MD5 или SHA-256 (через функцию ei)
            // 3. Результат устанавливается как x-sign
            async function generateXSign(url, timestamp, method = 'GET', params = null, data = null) {
                // Шаг 1: Убираем домен из URL, оставляем только путь
                // ed = /https?:\/\/[^/]+/
                let J = url.replace(/https?:\/\/[^/]+/, '');

                // Шаг 2: Удаляем префиксы из ef = ["/api/", "/btc-api/", "/fractal-api/"]
                const ef = ['/api/', '/btc-api/', '/fractal-api/'];
                for (let i = 0; i < ef.length; i += 1) {
                    if (J.startsWith(ef[i])) {
                        J = J.substring(ef[i].length - 1, J.length);
                        break;
                    }
                }

                // Шаг 3: Обрабатываем параметры в зависимости от метода
                // КРИТИЧЕСКОЕ: x-sign-suffix не должен добавляться в query string, только для формирования J
                let xSignSuffix = null;
                if (method.toUpperCase() === 'GET' && params) {
                    // Извлекаем x-sign-suffix из params (если есть) перед обработкой остальных параметров
                    if (params['x-sign-suffix']) {
                        xSignSuffix = params['x-sign-suffix'];
                        delete params['x-sign-suffix']; // Удаляем из params, чтобы не добавлять в query string
                    }

                    // Для GET добавляем параметры как query string
                    // Функция ep из кода: encodeURIComponent с особыми правилами
                    for (const key in params) {
                        if (params[key] != null) {
                            const encodedValue = encodeURIComponent(params[key])
                                .replace(/'/g, '%27')
                                .replace(/%3A/gi, ':')
                                .replace(/%24/g, '$')
                                .replace(/%2C/gi, ',')
                                .replace(/%20/g, '+')
                                .replace(/%5B/gi, '[')
                                .replace(/%5D/gi, ']');
                            if (J.includes('?')) {
                                J += `&${key}=${encodedValue}`;
                            } else {
                                J += `?${key}=${encodedValue}`;
                            }
                        }
                    }
                    J += '\n';
                    J = J.replaceAll('•', '%E2%80%A2');
                } else if (method.toUpperCase() === 'POST' && data) {
                    J += '\n';
                    J += JSON.stringify(data);
                }

                // Шаг 4: Добавляем timestamp + разделитель + дополнительная строка
                // Из кода: J += "\n" + I + e_ + X((0, U.$i)())
                // где:
                // - I = timestamp
                // - e_ = "@#?.#@"
                // - X по умолчанию = eu, где eu = S => N.a7[7] + N.Em[0] + N.Em[1]
                // - U.$i() - что возвращает? ❓ (возможно пустая строка или константа)
                //
                // ПРИМЕЧАНИЕ: X((0, U.$i)()) может возвращать строку из массива N,
                // но без знания значений N.a7 и N.Em мы не можем точно воспроизвести.
                // Пробуем разные варианты для обхода 403 ошибки:
                // Вариант 1: Пустая строка (не работает - 403)
                // Вариант 2: x-front-version (2128) - НЕ РАБОТАЕТ - 403
                // Вариант 3: x-appid (1adcd7969603261753f1812c9461cd36) - ПРОБУЕМ
                // Вариант 4: Комбинация x-appid + x-front-version
                //
                // КРИТИЧЕСКОЕ: Пробуем x-appid как дополнительную строку
                // Это может быть то самое X((0, U.$i)())
                const additionalString = xSignSuffix || '1adcd7969603261753f1812c9461cd36'; // По умолчанию пробуем x-appid

                J += '\n' + timestamp + '@#?.#@' + additionalString;

                // Шаг 5: Делаем хеш от строки J
                // Из кода: ei(J) = new en().update(J).digest((0, U.ms)())
                // en - класс хеша (MD5 или SHA-256?) ❓
                // U.ms() - метод для получения hex строки
                //
                // ПРИМЕЧАНИЕ: Cloudflare Workers не поддерживают MD5 напрямую, используем SHA-256
                // Если в браузере используется MD5, нужно будет использовать внешнюю библиотеку
                const encoder = new TextEncoder();
                const dataBytes = encoder.encode(J);

                // Пробуем SHA-256 (первые 32 символа)
                // TODO: Проверить, используется ли MD5 в браузере (нужно найти определение en)
                const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                // Возвращаем первые 32 символа (как в примере: 456cbba050b7560334ce59a863e41408)
                return hashHex.substring(0, 32);
            }

            // Вспомогательная функция для получения цен (Mempool Fractal для BTC, пул для FB)
            async function getCMCPrices() {
                let btcPrice = 0;
                let fbPrice = 0;

                // ИСПРАВЛЕНИЕ: Используем Mempool Fractal API для BTC (разгружаем CoinGecko)
                try {
                    const mempoolRes = await fetch('https://mempool.fractalbitcoin.io/api/v1/prices', {
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });
                    if (mempoolRes.ok) {
                        const mempoolJson = await mempoolRes.json();
                        // Mempool API возвращает цены в формате { USD: price }
                        btcPrice = mempoolJson.USD || 0;
                    }
                } catch (e) {
                    console.error('Mempool Fractal BTC price error:', e);
                }

                // Fallback: CoinGecko для BTC (если Mempool не работает)
                if (btcPrice === 0) {
                    try {
                        const cgRes = await fetch(
                            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
                            {
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            }
                        );
                        if (cgRes.ok) {
                            const cgJson = await cgRes.json();
                            btcPrice = cgJson.bitcoin?.usd || 0;
                        }
                    } catch (e) {
                        console.error('CoinGecko BTC price error:', e);
                    }
                }

                // ИСПРАВЛЕНИЕ: Сначала пытаемся получить цену FB с CoinGecko (fractal-bitcoin)
                try {
                    const cgFBRes = await fetch(
                        'https://api.coingecko.com/api/v3/simple/price?ids=fractal-bitcoin&vs_currencies=usd',
                        {
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        }
                    );
                    if (cgFBRes.ok) {
                        const cgFBJson = await cgFBRes.json();
                        if (cgFBJson['fractal-bitcoin']?.usd) {
                            fbPrice = cgFBJson['fractal-bitcoin'].usd;
                            console.log('✅ FB price from CoinGecko:', fbPrice);
                        }
                    }
                } catch (e) {
                    console.error('CoinGecko FB price error:', e);
                }

                // Fallback: FB считаем из пула FB-Биткоин с учетом текущего курса биткоина
                if (fbPrice === 0 && btcPrice > 0) {
                    try {
                        const inswapHeaders = {
                            Accept: 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            Referer: 'https://inswap.cc/',
                            Origin: 'https://inswap.cc',
                            'x-appid': '1adcd7969603261753f1812c9461cd36',
                            'x-front-version': '2094'
                        };

                        const poolRes = await fetch(`${INSWAP_URL}/pool_info?tick0=sBTC___000&tick1=sFB___000`, {
                            headers: inswapHeaders
                        });
                        const poolJson = await poolRes.json();
                        if (poolJson.data) {
                            const d = poolJson.data;
                            const amt0 = parseFloat(d.amount0);
                            const amt1 = parseFloat(d.amount1);
                            const isBtcFirst = d.tick0.includes('BTC') || d.tick0 === 'sBTC___000';

                            let ratio = 0;
                            if (isBtcFirst) {
                                if (amt1 > 0) ratio = amt0 / amt1;
                            } else {
                                if (amt0 > 0) ratio = amt1 / amt0;
                            }

                            // ИСПРАВЛЕНИЕ: FB цена = ratio * текущий курс биткоина
                            if (ratio > 0) {
                                fbPrice = ratio * btcPrice;
                            }
                        }
                    } catch (e) {
                        console.error('Pool Price Error', e);
                    }
                }

                return { btcPrice, fbPrice };
            }

            try {
                // 0. ПОЛУЧЕНИЕ ЦЕН (НОВОЕ ДЕЙСТВИЕ) - Использует CoinMarketCap
                // КРИТИЧЕСКОЕ: Цены одинаковы для всех пользователей - кэшируем агрессивно
                if (action === 'get_prices') {
                    // Кэш для цен (одинаковы для всех пользователей) - 5 минут
                    const cache = caches.default;
                    // КРИТИЧЕСКОЕ: Используем фиксированный ключ для всех пользователей
                    const priceCacheKey = new Request('https://fennec-api.pages.dev/prices', { method: 'GET' });
                    const cachedPriceResponse = await cache.match(priceCacheKey);
                    if (cachedPriceResponse) {
                        console.log('✅ Serving prices from Cloudflare cache (same for all users, reduces API calls)');
                        return cachedPriceResponse;
                    }

                    let btcPrice = 0;
                    let fbPrice = 0;
                    let fennecInFB = 0;

                    // 1. Запрос к CoinMarketCap (BTC и FB)
                    const cmcPrices = await getCMCPrices();
                    btcPrice = cmcPrices.btcPrice;
                    fbPrice = cmcPrices.fbPrice;

                    // ИСПРАВЛЕНИЕ: Fallback для цен - если getCMCPrices не вернул цены, используем дефолтные
                    if (btcPrice === 0) {
                        btcPrice = 86000; // Дефолтная цена BTC
                        debugInfo.btc_price_fallback = true;
                        debugInfo.btc_price_source = 'fallback_default';
                    }
                    if (fbPrice === 0) {
                        fbPrice = 0.4; // Дефолтная цена FB
                        debugInfo.fb_price_fallback = true;
                        debugInfo.fb_price_source = 'fallback_default';
                    }

                    // 3. Цена FENNEC (через пул, так как на CMC его скорее всего нет)
                    try {
                        const inswapHeaders = {
                            Accept: 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            Referer: 'https://inswap.cc/',
                            Origin: 'https://inswap.cc',
                            'x-appid': '1adcd7969603261753f1812c9461cd36',
                            'x-front-version': '2125'
                        };

                        const fenRes = await fetch(`${INSWAP_URL}/pool_info?tick0=FENNEC&tick1=sFB___000`, {
                            headers: inswapHeaders
                        });
                        const fenJson = await fenRes.json();
                        if (fenJson.data) {
                            const d = fenJson.data;
                            const amt0 = parseFloat(d.amount0);
                            const amt1 = parseFloat(d.amount1);
                            const isFennecFirst = d.tick0 === 'FENNEC';

                            if (isFennecFirst) {
                                if (amt0 > 0) fennecInFB = amt1 / amt0;
                            } else {
                                if (amt1 > 0) fennecInFB = amt0 / amt1;
                            }
                        }
                    } catch (e) {
                        console.error('FENNEC Price Error', e);
                    }

                    const priceResponse = sendJSON({
                        btc: btcPrice,
                        fb: fbPrice, // Теперь это точная цена с CMC
                        fennec_in_fb: fennecInFB
                    });

                    // КРИТИЧЕСКОЕ: Кэшируем цены (одинаковы для всех пользователей) - 5 минут
                    priceResponse.headers.set('Cache-Control', 's-maxage=300, max-age=60'); // 5 минут в Cloudflare
                    if (ctx?.waitUntil) {
                        ctx.waitUntil(cache.put(priceCacheKey, priceResponse.clone()));
                    } else {
                        await cache.put(priceCacheKey, priceResponse.clone());
                    }

                    return priceResponse;
                }

                if (action === 'get_dashboard_data') {
                    const cache = caches.default;
                    const dashboardCacheKey = new Request('https://fennec-api.pages.dev/dashboard', { method: 'GET' });
                    const cached = await cache.match(dashboardCacheKey);
                    if (cached) return cached;

                    let priceRes = null;
                    try {
                        const priceCacheKey = new Request('https://fennec-api.pages.dev/prices', { method: 'GET' });
                        const cachedPrices = await cache.match(priceCacheKey);
                        if (cachedPrices) {
                            const parsed = await cachedPrices
                                .clone()
                                .json()
                                .catch(() => null);
                            if (parsed && typeof parsed === 'object') priceRes = parsed;
                        }
                    } catch (_) {
                        priceRes = null;
                    }

                    if (!priceRes) {
                        try {
                            let btcPrice = 0;
                            let fbPrice = 0;
                            let fennecInFB = 0;

                            const cmcPrices = await getCMCPrices();
                            btcPrice = cmcPrices.btcPrice;
                            fbPrice = cmcPrices.fbPrice;

                            if (btcPrice === 0) btcPrice = 86000;
                            if (fbPrice === 0) fbPrice = 0.4;

                            try {
                                const inswapHeaders = {
                                    Accept: 'application/json, text/plain, */*',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    Referer: 'https://inswap.cc/',
                                    Origin: 'https://inswap.cc',
                                    'x-appid': '1adcd7969603261753f1812c9461cd36',
                                    'x-front-version': '2125'
                                };
                                const fenRes = await fetch(`${INSWAP_URL}/pool_info?tick0=FENNEC&tick1=sFB___000`, {
                                    headers: inswapHeaders
                                });
                                const fenJson = await fenRes.json().catch(() => null);
                                if (fenJson?.data) {
                                    const d = fenJson.data;
                                    const amt0 = parseFloat(d.amount0);
                                    const amt1 = parseFloat(d.amount1);
                                    const isFennecFirst = d.tick0 === 'FENNEC';
                                    if (isFennecFirst) {
                                        if (amt0 > 0) fennecInFB = amt1 / amt0;
                                    } else {
                                        if (amt1 > 0) fennecInFB = amt0 / amt1;
                                    }
                                }
                            } catch (e) {}

                            priceRes = { btc: btcPrice, fb: fbPrice, fennec_in_fb: fennecInFB };

                            try {
                                const priceCacheKey = new Request('https://fennec-api.pages.dev/prices', {
                                    method: 'GET'
                                });
                                const priceResponse = sendJSON(priceRes, 200, 60, 'public');
                                priceResponse.headers.set('Cache-Control', 's-maxage=300, max-age=60');
                                if (ctx?.waitUntil) ctx.waitUntil(cache.put(priceCacheKey, priceResponse.clone()));
                                else await cache.put(priceCacheKey, priceResponse.clone());
                            } catch (_) {}
                        } catch (_) {
                            priceRes = null;
                        }
                    }

                    const [fractalFeeRes, btcFeeRes] = await Promise.all([
                        fetch('https://mempool.fractalbitcoin.io/api/v1/fees/recommended', {
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        })
                            .then(r => (r.ok ? r.json().catch(() => null) : null))
                            .catch(() => null),
                        fetch('https://mempool.space/api/v1/fees/recommended', {
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        })
                            .then(r => (r.ok ? r.json().catch(() => null) : null))
                            .catch(() => null)
                    ]);

                    const out = sendJSON(
                        {
                            code: 0,
                            data: {
                                prices: priceRes || null,
                                fees: {
                                    fractal: fractalFeeRes || { fastestFee: 1 },
                                    bitcoin: btcFeeRes || { fastestFee: 1 }
                                },
                                ts: Math.floor(Date.now() / 1000)
                            }
                        },
                        200,
                        60,
                        'public'
                    );

                    try {
                        out.headers.set('Cache-Control', 's-maxage=300, max-age=60');
                    } catch (_) {}

                    try {
                        if (ctx?.waitUntil) ctx.waitUntil(cache.put(dashboardCacheKey, out.clone()));
                        else await cache.put(dashboardCacheKey, out.clone());
                    } catch (_) {}

                    return out;
                }

                if (action === 'fennec_id_lookup') {
                    const address = String(url.searchParams.get('address') || '').trim();
                    if (!address) return sendJSON({ code: -1, msg: 'Missing address' }, 400);

                    const db = env?.FENNEC_DB;
                    if (!db || typeof db.get !== 'function') {
                        return sendJSON({ code: -1, msg: 'FENNEC_DB is not configured' }, 200);
                    }

                    try {
                        const raw = await db.get(`addr_v2:${address}`);
                        if (!raw) return sendJSON({ code: 0, data: null }, 200, 600, 'private');
                        const parsed = JSON.parse(raw);
                        return sendJSON({ code: 0, data: parsed }, 200, 600, 'private');
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
                    }
                }

                if (action === 'fennec_id_register') {
                    if (String(request.method || 'GET').toUpperCase() !== 'POST') {
                        return sendJSON({ code: -1, msg: 'Method not allowed' }, 405);
                    }

                    const db = env?.FENNEC_DB;
                    if (!db || typeof db.put !== 'function') {
                        return sendJSON({ code: -1, msg: 'FENNEC_DB is not configured' }, 200);
                    }

                    requireUniSatKey();
                    const body = await request.json().catch(() => null);
                    const address = String(body?.address || '').trim();
                    const inscriptionId = String(body?.inscriptionId || body?.inscription_id || '').trim();
                    if (!address || !inscriptionId) {
                        return sendJSON({ code: -1, msg: 'Missing address or inscriptionId' }, 400);
                    }

                    try {
                        const endpoint = `${FRACTAL_BASE}/indexer/inscription/info/${encodeURIComponent(inscriptionId)}`;
                        const res = await fetch(endpoint, {
                            method: 'GET',
                            headers: {
                                ...unisatApiHeaders,
                                ...authHeaders()
                            }
                        });
                        const j = await res.json().catch(() => null);
                        const info = j && typeof j === 'object' ? j.data || null : null;
                        const owner = String(info?.address || '').trim();
                        if (!owner || owner !== address) {
                            return sendJSON(
                                {
                                    code: -1,
                                    msg: 'Ownership verification failed',
                                    data: { owner: owner || null }
                                },
                                200
                            );
                        }

                        const pickInscriptionNumber = d => {
                            const v = d?.inscriptionNumber ?? d?.inscription_number ?? d?.number ?? null;
                            const n = Number(v);
                            return Number.isFinite(n) ? n : null;
                        };

                        const incomingNum = pickInscriptionNumber(info);

                        let existing = null;
                        try {
                            const raw0 = await db.get(`addr_v2:${address}`);
                            if (raw0) existing = JSON.parse(raw0);
                        } catch (_) {
                            existing = null;
                        }

                        const existingId = String(existing?.inscriptionId || existing?.inscription_id || '').trim();
                        let existingNum = pickInscriptionNumber(existing);

                        if (
                            existingId &&
                            existingId !== inscriptionId &&
                            (existingNum == null || incomingNum == null)
                        ) {
                            try {
                                const endpoint2 = `${FRACTAL_BASE}/indexer/inscription/info/${encodeURIComponent(existingId)}`;
                                const res2 = await fetch(endpoint2, {
                                    method: 'GET',
                                    headers: {
                                        ...unisatApiHeaders,
                                        ...authHeaders()
                                    }
                                });
                                const j2 = await res2.json().catch(() => null);
                                const info2 = j2 && typeof j2 === 'object' ? j2.data || null : null;
                                const owner2 = String(info2?.address || '').trim();
                                if (owner2 && owner2 === address) {
                                    const n2 = pickInscriptionNumber(info2);
                                    if (n2 != null) existingNum = n2;
                                }
                            } catch (_) {}
                        }

                        if (existingId && existingId !== inscriptionId && existingNum != null && incomingNum == null) {
                            return sendJSON({ code: 0, data: existing }, 200);
                        }

                        if (
                            existingId &&
                            existingId !== inscriptionId &&
                            existingNum != null &&
                            incomingNum != null &&
                            incomingNum <= existingNum
                        ) {
                            return sendJSON({ code: 0, data: existing }, 200);
                        }

                        const record = {
                            address,
                            inscriptionId,
                            inscriptionNumber: incomingNum,
                            updatedAt: Date.now(),
                            source: 'verified_inscription_info'
                        };
                        await db.put(`addr_v2:${address}`, JSON.stringify(record));
                        return sendJSON({ code: 0, data: record }, 200);
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
                    }
                }

                // 1. TRANSFERABLE INSCRIPTIONS (UniSat API)
                if (action === 'transferable_inscriptions') {
                    requireUniSatKey();
                    const address = url.searchParams.get('address');
                    const tick = url.searchParams.get('tick');
                    const limit = url.searchParams.get('limit') || 512;
                    const start = url.searchParams.get('start') || 0;

                    if (!address || !tick) return sendJSON({ error: 'Missing params' }, 400);

                    // Используем UniSat Fractal API
                    // Важно: UniSat требует Bearer Token
                    const endpoint = `${FRACTAL_BASE}/indexer/address/${address}/brc20/${tick}/transferable-inscriptions?start=${start}&limit=${limit}`;

                    const response = await fetch(endpoint, {
                        method: 'GET',
                        headers: upstreamHeaders
                    });

                    const data = await response.json();
                    return sendJSON(data, response.status);
                }

                // 1b. ADDRESS INSCRIPTIONS (Ordinals list)
                if (action === 'inscriptions') {
                    const address = url.searchParams.get('address');
                    const start = Number(url.searchParams.get('start') || 0) || 0;
                    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50) || 50));

                    if (!address) return sendJSON({ error: 'Address required' }, 400);

                    const norm = v => String(v == null ? '' : v).trim();
                    const normalizeItem = it => {
                        const id = norm(it?.inscriptionId || it?.inscription_id || it?.id);
                        const num = it?.inscriptionNumber ?? it?.inscription_number ?? it?.number ?? null;
                        const ct = norm(it?.contentType || it?.content_type);
                        const parent = norm(
                            it?.parent || it?.parentId || it?.parent_inscription_id || it?.parentInscriptionId
                        );
                        return {
                            inscriptionId: id,
                            inscriptionNumber: num,
                            contentType: ct,
                            parent: parent || null,
                            timestamp: it?.timestamp ?? it?.time ?? it?.blocktime ?? null
                        };
                    };

                    try {
                        // Приоритет: Uniscan Summary (часто содержит parent)
                        const UNISCAN_BASE = 'https://uniscan.cc/fractal-api/explorer-v1';
                        const uniscanSummaryUrl = `${UNISCAN_BASE}/address/summary?address=${encodeURIComponent(address)}`;

                        const xTs = Math.floor(Date.now() / 1000);
                        const xSign = await generateXSign(uniscanSummaryUrl, xTs, 'GET', { address: address });

                        const uniscanHeaders = {
                            Accept: 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'x-appid': '1adcd7969603261753f1812c9461cd36',
                            'x-front-version': '2128',
                            'x-sign': xSign,
                            'x-ts': xTs.toString()
                        };

                        const summaryRes = await fetch(uniscanSummaryUrl, { headers: uniscanHeaders });
                        const summaryData = await summaryRes.json().catch(() => null);
                        const listRaw = summaryData?.data?.assets?.InscriptionsList;
                        if (Array.isArray(listRaw)) {
                            const sliced = listRaw.slice(start, start + limit);
                            const mapped = sliced.map(normalizeItem).filter(x => x.inscriptionId);
                            return sendJSON({
                                code: 0,
                                data: {
                                    address,
                                    start,
                                    limit,
                                    total: listRaw.length,
                                    list: mapped,
                                    source: 'uniscan_summary'
                                }
                            });
                        }
                    } catch (e) {
                        // fallback below
                    }

                    // Fallback: UniSat Open API inscription-data
                    try {
                        requireUniSatKey();
                        const endpoint = `${FRACTAL_BASE}/indexer/address/${address}/inscription-data?cursor=${start}&size=${limit}`;
                        const response = await fetch(endpoint, {
                            method: 'GET',
                            headers: upstreamHeaders
                        });
                        const data = await response.json().catch(() => null);
                        const arr =
                            data?.data?.inscription ||
                            data?.data?.inscriptions ||
                            data?.data?.list ||
                            (Array.isArray(data?.data) ? data.data : []);
                        const mapped = Array.isArray(arr) ? arr.map(normalizeItem).filter(x => x.inscriptionId) : [];
                        const total = data?.data?.total ?? data?.data?.totalConfirmed ?? null;
                        return sendJSON({
                            code: 0,
                            data: { address, start, limit, total, list: mapped, source: 'unisat_inscription_data' }
                        });
                    } catch (e) {
                        return sendJSON({ error: 'Failed to load inscriptions: ' + (e?.message || String(e)) }, 500);
                    }
                }

                // 2. BTC BALANCE
                if (action === 'btc_balance') {
                    const address = url.searchParams.get('address');
                    if (!address) return sendJSON({ code: -1, msg: 'No address' }, 400);

                    // Mempool-first to reduce UniSat usage. UniSat is only used as a fallback.
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 4000);
                        const mempoolRes = await fetch(`https://mempool.space/api/address/${address}`, {
                            signal: controller.signal,
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        clearTimeout(timeoutId);
                        if (mempoolRes.ok) {
                            const data = await mempoolRes.json();
                            const satoshis =
                                data.chain_stats.funded_txo_sum -
                                data.chain_stats.spent_txo_sum +
                                (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum);
                            return sendJSON({ code: 0, data: { balance: satoshis / 1e8 } });
                        }
                    } catch (e) {
                        // Ignore and fallback
                    }

                    if (API_KEY) {
                        try {
                            const res = await fetch(`${BTC_BASE}/v1/indexer/address/${address}/balance`, {
                                headers: authHeaders()
                            });
                            if (res.ok) {
                                const data = await res.json();
                                if (data.code === 0 && data.data) {
                                    const total = data.data.satoshi + data.data.pendingSatoshi;
                                    return sendJSON({ code: 0, data: { balance: total / 1e8 } });
                                }
                            }
                        } catch (e) {
                            // ignore
                        }
                    }

                    return sendJSON({ code: 0, data: { balance: 0 } });
                }

                // --- COINGECKO PROXY (для обхода CORS) ---
                if (action === 'coingecko_price') {
                    const ids = url.searchParams.get('ids') || 'bitcoin';
                    const vs_currencies = url.searchParams.get('vs_currencies') || 'usd';
                    try {
                        const response = await fetch(
                            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vs_currencies}`,
                            {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0'
                                }
                            }
                        );
                        const data = await response.json();
                        return sendJSON(data);
                    } catch (e) {
                        return sendJSON({ error: 'CoinGecko API error: ' + e.message }, 500);
                    }
                }

                // 3. QUOTE / CHART
                if (action === 'quote' || action === 'price_line') {
                    let query = '';
                    if (action === 'quote') {
                        // ИСПРАВЛЕНИЕ: Используем параметры из URL, если они есть
                        const t0 = url.searchParams.get('tick0') || 'FENNEC';
                        const t1 = url.searchParams.get('tick1') || 'sFB___000';
                        query = `?tick0=${t0}&tick1=${t1}`;
                    }
                    if (action === 'price_line') {
                        const t0 = url.searchParams.get('tick0');
                        const t1 = url.searchParams.get('tick1');
                        const tr = url.searchParams.get('timeRange');
                        query = `?tick0=${t0}&tick1=${t1}&timeRange=${tr}`;
                    }
                    const endpoint = action === 'quote' ? 'pool_info' : 'price_line';
                    if (action === 'quote') {
                        try {
                            // ИСПРАВЛЕНИЕ: Используем правильный URL для quote (pool_info)
                            // Пробуем сначала через SWAP_BASE (UniSat Fractal API), если не работает - через INSWAP_URL
                            let quoteUrl = `${SWAP_BASE}/indexer/brc20-swap/pool_info${query}`;
                            let response = await fetch(quoteUrl, { headers: upstreamHeaders });

                            // Fallback: если SWAP_BASE не работает (404), пробуем через INSWAP_URL
                            if (!response.ok && response.status === 404) {
                                quoteUrl = `${INSWAP_URL}/pool_info${query}`;
                                response = await fetch(quoteUrl, { headers: upstreamHeaders });
                            }

                            if (!response.ok) {
                                return sendJSON(
                                    { error: `API error: ${response.status} ${response.statusText}`, url: quoteUrl },
                                    response.status
                                );
                            }
                            const text = await response.text();
                            if (!text || text.trim().length === 0) {
                                return sendJSON({ error: 'Empty response from API' }, 500);
                            }
                            try {
                                const data = JSON.parse(text);
                                return sendJSON(data, 200, action === 'quote' ? 20 : 300, 'public');
                            } catch (parseError) {
                                return sendJSON(
                                    { error: `JSON parse error: ${parseError.message}`, raw: text.substring(0, 200) },
                                    500
                                );
                            }
                        } catch (e) {
                            return sendJSON({ error: `Fetch error: ${e.message}` }, 500);
                        }
                    }
                    try {
                        const response = await fetch(`${INSWAP_URL}/${endpoint}${query}`, { headers: upstreamHeaders });
                        if (!response.ok) {
                            return sendJSON(
                                { error: `API error: ${response.status} ${response.statusText}` },
                                response.status
                            );
                        }
                        const text = await response.text();
                        if (!text || text.trim().length === 0) {
                            return sendJSON({ error: 'Empty response from API' }, 500);
                        }
                        try {
                            const data = JSON.parse(text);
                            return sendJSON(data, 200, action === 'quote' ? 20 : 300, 'public');
                        } catch (parseError) {
                            return sendJSON(
                                { error: `JSON parse error: ${parseError.message}`, raw: text.substring(0, 200) },
                                500
                            );
                        }
                    } catch (e) {
                        return sendJSON({ error: `Fetch error: ${e.message}` }, 500);
                    }
                }

                // 4. INSCRIPTION ACTIONS
                if (action === 'sign_provenance') {
                    let signer = null;
                    let signerError = null;
                    try {
                        signer = await getProvenanceSigner();
                    } catch (e) {
                        signer = null;
                        signerError = e?.message || String(e);
                    }
                    const body = await request.json().catch(() => null);
                    if (!body) return sendJSON({ error: 'Invalid JSON body' }, 400);

                    const inputPayload = body?.payload ?? body;
                    if (!inputPayload || typeof inputPayload !== 'object') {
                        return sendJSON({ error: 'Payload must be an object' }, 400);
                    }

                    const payloadKeyId = signer?.keyId || 'unconfigured';
                    const payload = {
                        schema: inputPayload.schema || 'fennec.provenance.v1',
                        ...inputPayload,
                        issued_at: new Date().toISOString(),
                        key_id: payloadKeyId
                    };

                    if (!signer) {
                        return sendJSON({
                            code: 0,
                            data: {
                                payload,
                                signature: null,
                                alg: 'NONE',
                                public_key_jwk: null,
                                signer_error: signerError
                            }
                        });
                    }

                    const canonical = stableStringify(payload);
                    const bytes = new TextEncoder().encode(canonical);
                    const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer.key, bytes);
                    const signature = bytesToBase64(new Uint8Array(sigBuf));

                    return sendJSON({
                        code: 0,
                        data: {
                            payload,
                            signature,
                            alg: 'ECDSA_P256_SHA256',
                            public_key_jwk: signer.publicJwk
                        }
                    });
                }

                if (action === 'create_inscription') {
                    const body = await request.json().catch(() => null);
                    if (!body) return sendJSON({ error: 'Invalid JSON body' }, 400);

                    const response = await fetch('https://open-api-fractal.unisat.io/v2/inscribe/order/create', {
                        method: 'POST',
                        headers: upstreamHeaders,
                        body: JSON.stringify(body)
                    });

                    const text = await response.text().catch(() => '');
                    if (!text || text.trim().length === 0) {
                        return sendJSON({ error: 'Empty response from upstream' }, response.status || 500);
                    }

                    try {
                        return sendJSON(JSON.parse(text), response.status);
                    } catch (e) {
                        return sendJSON(
                            { error: `JSON parse error: ${e?.message || String(e)}`, raw: text.substring(0, 200) },
                            response.status || 500
                        );
                    }
                }

                if (action === 'inscription_status') {
                    const orderId = url.searchParams.get('orderId');
                    const response = await fetch(`https://open-api-fractal.unisat.io/v2/inscribe/order/${orderId}`, {
                        headers: upstreamHeaders
                    });

                    const text = await response.text().catch(() => '');
                    if (!text || text.trim().length === 0) {
                        return sendJSON({ error: 'Empty response from upstream' }, response.status || 500);
                    }

                    try {
                        return sendJSON(JSON.parse(text), response.status);
                    } catch (e) {
                        return sendJSON(
                            { error: `JSON parse error: ${e?.message || String(e)}`, raw: text.substring(0, 200) },
                            response.status || 500
                        );
                    }
                }

                // 4b. INSCRIPTION INFO (for Burn+Remint)
                if (action === 'inscription_info') {
                    requireUniSatKey();
                    const inscriptionId = url.searchParams.get('inscriptionId') || url.searchParams.get('id');
                    if (!inscriptionId) return sendJSON({ code: -1, msg: 'Missing inscriptionId' }, 400);

                    const endpoint = `${FRACTAL_BASE}/indexer/inscription/info/${encodeURIComponent(inscriptionId)}`;
                    const response = await fetch(endpoint, {
                        method: 'GET',
                        headers: {
                            ...unisatApiHeaders,
                            ...authHeaders()
                        }
                    });
                    return sendJSON(await response.json(), response.status);
                }

                if (action === 'inscription_content') {
                    const inscriptionIdRaw = url.searchParams.get('inscriptionId') || url.searchParams.get('id');
                    if (!inscriptionIdRaw) return sendJSON({ code: -1, msg: 'Missing inscriptionId' }, 400);

                    const rawMode = String(url.searchParams.get('raw') || '').trim() === '1';

                    const norm = v => String(v == null ? '' : v).trim();
                    const idIn = norm(inscriptionIdRaw);
                    const mInsc = idIn.match(/^([0-9a-f]{64})(?:i(\d+))?$/i);
                    const txid = mInsc ? mInsc[1] : '';
                    const idx = mInsc && mInsc[2] != null ? String(mInsc[2]) : '';
                    const idWithI = mInsc ? `${txid}i${idx || '0'}` : idIn;
                    const idNoI = txid || '';

                    if (rawMode) {
                        const cache = caches.default;
                        const cacheKey = new Request(url.toString(), { method: 'GET' });
                        try {
                            const cached = await cache.match(cacheKey);
                            if (cached) return cached;
                        } catch (_) {}

                        const makeRawResponse = (res, cacheSeconds) => {
                            const headers = new Headers(res.headers);
                            for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
                            const secs = Math.max(1, Number(cacheSeconds || 0) || 0);
                            headers.set('Cache-Control', `public, max-age=${secs}, s-maxage=${secs}`);
                            return new Response(res.body, { status: res.status, headers });
                        };

                        const tryFetchRaw = async (targetUrl, headers) => {
                            const res = await fetch(targetUrl, {
                                method: 'GET',
                                headers: {
                                    Accept: '*/*',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    ...(headers || {})
                                }
                            });
                            if (!res.ok) return null;
                            return res;
                        };

                        try {
                            if (API_KEY) {
                                const endpoint = `${FRACTAL_BASE}/indexer/inscription/content/${encodeURIComponent(idWithI)}`;
                                const res = await tryFetchRaw(endpoint, authHeaders());
                                if (res) {
                                    const out = makeRawResponse(res, 86400);
                                    try {
                                        ctx.waitUntil(cache.put(cacheKey, out.clone()));
                                    } catch (_) {
                                        try {
                                            await cache.put(cacheKey, out.clone());
                                        } catch (_) {}
                                    }
                                    return out;
                                }
                            }
                        } catch (_) {}

                        const candidates = [];
                        if (idWithI)
                            candidates.push(`https://uniscan.cc/fractal/content/${encodeURIComponent(idWithI)}`);
                        if (idNoI && idNoI !== idWithI)
                            candidates.push(`https://uniscan.cc/fractal/content/${encodeURIComponent(idNoI)}`);
                        if (idWithI) candidates.push(`https://ordinals.com/content/${encodeURIComponent(idWithI)}`);
                        if (idNoI && idNoI !== idWithI)
                            candidates.push(`https://ordinals.com/content/${encodeURIComponent(idNoI)}`);

                        for (const targetUrl of candidates) {
                            try {
                                const res = await tryFetchRaw(targetUrl);
                                if (!res) continue;
                                const out = makeRawResponse(res, 86400);
                                try {
                                    ctx.waitUntil(cache.put(cacheKey, out.clone()));
                                } catch (_) {
                                    try {
                                        await cache.put(cacheKey, out.clone());
                                    } catch (_) {}
                                }
                                return out;
                            } catch (_) {
                                // continue
                            }
                        }

                        return new Response('Not found', {
                            status: 404,
                            headers: {
                                ...corsHeaders,
                                'Cache-Control': 'no-store'
                            }
                        });
                    }

                    if (API_KEY) {
                        try {
                            const endpoint = `${FRACTAL_BASE}/indexer/inscription/content/${encodeURIComponent(idWithI)}`;
                            const cache = caches.default;
                            const cacheKey = new Request(endpoint, { method: 'GET' });
                            const cached = await cache.match(cacheKey);
                            if (cached) {
                                const cachedText = await cached.text().catch(() => '');
                                const cachedCt = cached.headers.get('content-type') || '';
                                return sendJSON({ code: 0, data: { contentType: cachedCt, body: cachedText } }, 200);
                            }

                            const res = await fetch(endpoint, {
                                method: 'GET',
                                headers: {
                                    ...authHeaders(),
                                    Accept: '*/*',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            });
                            if (res.ok) {
                                const ct = res.headers.get('content-type') || '';
                                const ctLower = ct.toLowerCase();
                                if (
                                    ctLower.includes('image/') ||
                                    ctLower.includes('video/') ||
                                    ctLower.includes('audio/') ||
                                    ctLower.includes('application/octet-stream')
                                ) {
                                    // skip non-text
                                } else {
                                    const text = await res.text().catch(() => '');
                                    if (text) {
                                        const maxLen = 250000;
                                        const body = text.length > maxLen ? text.slice(0, maxLen) : text;
                                        const out = sendJSON({ code: 0, data: { contentType: ct, body } }, 200);
                                        try {
                                            const respToCache = new Response(body, {
                                                status: 200,
                                                headers: {
                                                    'content-type': ct,
                                                    'cache-control': 'public, max-age=86400'
                                                }
                                            });
                                            await cache.put(cacheKey, respToCache);
                                        } catch (_) {}
                                        return out;
                                    }
                                }
                            }
                        } catch (e) {
                            // fallback to public mirrors
                        }
                    }

                    const candidates = [];
                    if (idWithI) candidates.push(`https://uniscan.cc/fractal/content/${encodeURIComponent(idWithI)}`);
                    if (idNoI && idNoI !== idWithI)
                        candidates.push(`https://uniscan.cc/fractal/content/${encodeURIComponent(idNoI)}`);
                    if (idWithI) candidates.push(`https://ordinals.com/content/${encodeURIComponent(idWithI)}`);
                    if (idNoI && idNoI !== idWithI)
                        candidates.push(`https://ordinals.com/content/${encodeURIComponent(idNoI)}`);

                    const cache = caches.default;
                    for (const targetUrl of candidates) {
                        try {
                            const cacheKey = new Request(targetUrl, { method: 'GET' });
                            const cached = await cache.match(cacheKey);
                            if (cached) {
                                const cachedText = await cached.text().catch(() => '');
                                const cachedCt = cached.headers.get('content-type') || '';
                                return sendJSON(
                                    {
                                        code: 0,
                                        data: {
                                            contentType: cachedCt,
                                            body: cachedText
                                        }
                                    },
                                    200
                                );
                            }

                            const res = await fetch(targetUrl, {
                                method: 'GET',
                                headers: {
                                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            });
                            if (!res.ok) continue;
                            const ct = res.headers.get('content-type') || '';
                            const ctLower = ct.toLowerCase();
                            if (
                                ctLower.includes('image/') ||
                                ctLower.includes('video/') ||
                                ctLower.includes('audio/') ||
                                ctLower.includes('application/octet-stream')
                            ) {
                                continue;
                            }
                            const text = await res.text().catch(() => '');
                            if (!text) continue;

                            const maxLen = 250000;
                            const body = text.length > maxLen ? text.slice(0, maxLen) : text;
                            const out = sendJSON(
                                {
                                    code: 0,
                                    data: {
                                        contentType: ct,
                                        body
                                    }
                                },
                                200
                            );
                            try {
                                const respToCache = new Response(body, {
                                    status: 200,
                                    headers: {
                                        'content-type': ct,
                                        'cache-control': 'public, max-age=86400'
                                    }
                                });
                                await cache.put(cacheKey, respToCache);
                            } catch (_) {}
                            return out;
                        } catch (e) {
                            // continue
                        }
                    }

                    return sendJSON(
                        { code: -1, msg: 'Content fetch failed', data: { contentType: '', body: '' } },
                        200
                    );
                }

                // 4c. PUSH TX (broadcast raw transaction)
                if (action === 'push_tx') {
                    requireUniSatKey();
                    const body = await request.json().catch(() => null);
                    const rawtx = body?.rawtx;
                    if (!rawtx) return sendJSON({ code: -1, msg: 'Missing rawtx' }, 400);

                    const endpoint = `${FRACTAL_BASE}/indexer/local_pushtx`;
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            ...unisatApiHeaders,
                            ...authHeaders()
                        },
                        body: JSON.stringify({ rawtx })
                    });
                    return sendJSON(await response.json(), response.status);
                }

                if (action === 'push_psbt') {
                    requireUniSatKey();
                    const body = await request.json().catch(() => null);
                    const psbtHex = String(body?.psbt || body?.psbtHex || body?.psbt_hex || '').trim();
                    if (!psbtHex) return sendJSON({ code: -1, msg: 'Missing psbt' }, 400);

                    let rawtx = '';
                    try {
                        const tx = btc.Transaction.fromPSBT(hex.decode(psbtHex));
                        try {
                            tx.finalize();
                        } catch (_) {}
                        rawtx = hex.encode(tx.extract());
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 400);
                    }

                    const endpoint = `${FRACTAL_BASE}/indexer/local_pushtx`;
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            ...unisatApiHeaders,
                            ...authHeaders()
                        },
                        body: JSON.stringify({ rawtx })
                    });
                    return sendJSON(await response.json(), response.status);
                }

                if (action === 'burn_remint_psbt') {
                    requireUniSatKey();
                    const body = await request.json().catch(() => null);
                    if (!body || typeof body !== 'object') return sendJSON({ code: -1, msg: 'Invalid JSON body' }, 400);

                    const address = String(
                        body.address || body.changeAddress || body.change_address || incomingAddress || ''
                    ).trim();
                    const pubkeyHex = String(
                        body.pubkey || body.publicKey || body.public_key || incomingPubKey || ''
                    ).trim();
                    const burnAddress = String(body.burnAddress || body.burn_address || '').trim();
                    const burnInscriptionId = String(
                        body.burnInscriptionId || body.inscriptionId || body.inscription_id || ''
                    ).trim();
                    const feeRate = Math.max(1, Number(body.feeRate || body.fee_rate || 5) || 5);
                    const inscriptionBody = body.inscriptionBody || body.inscription_body || null;

                    if (!address) return sendJSON({ code: -1, msg: 'Missing address' }, 400);
                    if (!burnAddress) return sendJSON({ code: -1, msg: 'Missing burnAddress' }, 400);
                    if (!burnInscriptionId) return sendJSON({ code: -1, msg: 'Missing burnInscriptionId' }, 400);
                    if (!inscriptionBody || typeof inscriptionBody !== 'object') {
                        return sendJSON({ code: -1, msg: 'Missing inscriptionBody' }, 400);
                    }

                    let orderJson = null;
                    try {
                        const response = await fetch('https://open-api-fractal.unisat.io/v2/inscribe/order/create', {
                            method: 'POST',
                            headers: upstreamHeaders,
                            body: JSON.stringify(inscriptionBody)
                        });
                        orderJson = await response.json().catch(() => null);
                        if (!orderJson || typeof orderJson !== 'object') {
                            return sendJSON({ code: -1, msg: 'Order create failed: invalid JSON' }, 502);
                        }
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 502);
                    }

                    if (orderJson.code !== 0) {
                        return sendJSON(
                            {
                                code: -1,
                                msg: orderJson.msg || orderJson.error || 'Order create failed',
                                data: orderJson
                            },
                            200
                        );
                    }

                    const orderId = orderJson?.data?.orderId || orderJson?.data?.id || '';
                    const payAddress = orderJson?.data?.payAddress || '';
                    const payAmount = BigInt(orderJson?.data?.amount || 0);
                    if (!orderId || !payAddress || payAmount <= 0n) {
                        return sendJSON(
                            { code: -1, msg: 'Order create returned missing fields', data: orderJson },
                            200
                        );
                    }

                    let infoJson = null;
                    try {
                        const endpoint = `${FRACTAL_BASE}/indexer/inscription/info/${encodeURIComponent(burnInscriptionId)}`;
                        const response = await fetch(endpoint, {
                            method: 'GET',
                            headers: {
                                ...unisatApiHeaders,
                                ...authHeaders()
                            }
                        });
                        infoJson = await response.json().catch(() => null);
                    } catch (e) {
                        infoJson = null;
                    }

                    const burnUtxo = infoJson && infoJson.code === 0 ? infoJson?.data?.utxo || null : null;
                    const burnTxid = String(burnUtxo?.txid || '').trim();
                    const burnVout = Number(burnUtxo?.vout ?? burnUtxo?.index ?? 0);
                    const burnSatoshi = BigInt(burnUtxo?.satoshi || 0);
                    const burnScriptPkHex = String(burnUtxo?.scriptPk || burnUtxo?.script_pk || '').trim();
                    const burnOwner = String(burnUtxo?.address || '').trim();

                    if (!burnTxid || !Number.isFinite(burnVout) || burnSatoshi <= 0n || !burnScriptPkHex) {
                        return sendJSON(
                            { code: -1, msg: 'Failed to resolve burn UTXO for inscription', data: infoJson },
                            200
                        );
                    }

                    if (burnOwner && burnOwner !== address) {
                        return sendJSON({ code: -1, msg: 'Inscription UTXO is not owned by provided address' }, 200);
                    }

                    let addrUtxoJson = null;
                    try {
                        const utxoUrl = `${FRACTAL_BASE}/indexer/address/${encodeURIComponent(address)}/utxo-data?cursor=0&size=200`;
                        const response = await fetch(utxoUrl, {
                            method: 'GET',
                            headers: {
                                ...authHeaders(),
                                Accept: 'application/json'
                            }
                        });
                        addrUtxoJson = await response.json().catch(() => null);
                    } catch (e) {
                        addrUtxoJson = null;
                    }

                    const listRaw =
                        (addrUtxoJson &&
                            addrUtxoJson.code === 0 &&
                            (addrUtxoJson?.data?.utxo || addrUtxoJson?.data?.list || addrUtxoJson?.data?.data)) ||
                        [];
                    const utxoList = Array.isArray(listRaw) ? listRaw : [];

                    const isTaprootScript = s => {
                        const h = String(s || '')
                            .trim()
                            .toLowerCase();
                        return h.startsWith('5120') && h.length === 68;
                    };

                    const xOnlyFromPubkey = pkHex => {
                        const p = String(pkHex || '')
                            .trim()
                            .toLowerCase();
                        if (!p) return '';
                        if (p.length === 66 && (p.startsWith('02') || p.startsWith('03'))) return p.slice(2);
                        if (p.length === 64) return p;
                        return '';
                    };

                    const xOnlyHex = xOnlyFromPubkey(pubkeyHex);
                    const tapInternalKeyBytes = xOnlyHex ? hex.decode(xOnlyHex) : null;

                    const normUtxo = u => {
                        if (!u || typeof u !== 'object') return null;
                        const txid = String(u.txid || '').trim();
                        const vout = Number(u.vout ?? u.index ?? 0);
                        const satoshi = BigInt(u.satoshi || 0);
                        const scriptPk = String(u.scriptPk || u.script_pk || '').trim();
                        const inscriptions = Array.isArray(u.inscriptions) ? u.inscriptions : [];
                        if (!txid || !Number.isFinite(vout) || satoshi <= 0n || !scriptPk) return null;
                        return { txid, vout, satoshi, scriptPk, inscriptions };
                    };

                    const burnKey = `${burnTxid}:${burnVout}`;
                    const candidates = utxoList
                        .map(normUtxo)
                        .filter(x => {
                            if (!x) return false;
                            if (`${x.txid}:${x.vout}` === burnKey) return false;
                            if (Array.isArray(x.inscriptions) && x.inscriptions.length > 0) return false;
                            return true;
                        })
                        .sort((a, b) => (a.satoshi === b.satoshi ? 0 : a.satoshi < b.satoshi ? 1 : -1));

                    const baseVb = 12;
                    const inVb = 75;
                    const outVb = 43;
                    const estimateFee = (inputsCount, outputsCount) => {
                        const vb = BigInt(baseVb + inputsCount * inVb + outputsCount * outVb);
                        return vb * BigInt(feeRate);
                    };

                    const burnValue = burnSatoshi;
                    const selected = [];
                    let totalIn = burnValue;

                    const outCount = 3;
                    let fee = estimateFee(1, outCount);
                    let required = burnValue + payAmount + fee;
                    for (const u of candidates) {
                        if (totalIn >= required) break;
                        selected.push(u);
                        totalIn += u.satoshi;
                        fee = estimateFee(1 + selected.length, outCount);
                        required = burnValue + payAmount + fee;
                    }

                    if (totalIn < burnValue + payAmount + estimateFee(1 + selected.length, 2)) {
                        return sendJSON(
                            { code: -1, msg: 'Insufficient funds to pay order in single transaction' },
                            200
                        );
                    }

                    fee = estimateFee(1 + selected.length, 3);
                    let change = totalIn - burnValue - payAmount - fee;
                    let withChange = change >= 546n;
                    if (!withChange) {
                        fee = estimateFee(1 + selected.length, 2);
                        change = totalIn - burnValue - payAmount - fee;
                        withChange = false;
                        if (change > 0n) {
                            fee = fee + change;
                            change = 0n;
                        }
                    }

                    const tx = new btc.Transaction();
                    const burnScriptBytes = hex.decode(burnScriptPkHex);
                    const burnInput = {
                        txid: burnTxid,
                        index: burnVout,
                        witnessUtxo: { script: burnScriptBytes, amount: burnSatoshi }
                    };
                    if (tapInternalKeyBytes && isTaprootScript(burnScriptPkHex))
                        burnInput.tapInternalKey = tapInternalKeyBytes;
                    tx.addInput(burnInput);

                    for (const u of selected) {
                        const scriptBytes = hex.decode(u.scriptPk);
                        const input = {
                            txid: u.txid,
                            index: u.vout,
                            witnessUtxo: { script: scriptBytes, amount: u.satoshi }
                        };
                        if (tapInternalKeyBytes && isTaprootScript(u.scriptPk))
                            input.tapInternalKey = tapInternalKeyBytes;
                        tx.addInput(input);
                    }

                    for (let i = 0; i < tx.inputsLength; i += 1) {
                        try {
                            tx.updateInput(i, { sighashType: btc.SigHash.ALL });
                        } catch (_) {}
                    }

                    tx.addOutputAddress(burnAddress, burnValue);
                    tx.addOutputAddress(payAddress, payAmount);
                    if (withChange && change >= 546n) tx.addOutputAddress(address, change);

                    const psbt = hex.encode(tx.toPSBT());
                    return sendJSON({
                        code: 0,
                        data: {
                            psbt,
                            order: { orderId, payAddress, amount: String(payAmount) },
                            burn: {
                                inscriptionId: burnInscriptionId,
                                txid: burnTxid,
                                vout: burnVout,
                                satoshi: String(burnSatoshi)
                            },
                            summary: {
                                feeRate,
                                fee: String(fee),
                                change: withChange ? String(change) : '0',
                                inputs: 1 + selected.length,
                                outputs: withChange ? 3 : 2
                            }
                        }
                    });
                }

                if (action === 'pre_add_liq') {
                    try {
                        requireUniSatKey();
                        const proxyParams = new URLSearchParams(url.searchParams);
                        proxyParams.delete('action');
                        proxyParams.delete('rememberPayType');

                        if (!proxyParams.has('feeTick')) proxyParams.set('feeTick', DEFAULT_FEE_TICK);
                        if (!proxyParams.has('payType')) proxyParams.set('payType', 'tick');

                        let endpointUrl = `${SWAP_BASE}/brc20-swap/pre_add_liq?${proxyParams.toString()}`;
                        let response = await fetch(endpointUrl, { headers: unisatApiHeaders });
                        if (!response.ok && response.status === 404) {
                            endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/pre_add_liq?${proxyParams.toString()}`;
                            response = await fetch(endpointUrl, { headers: unisatApiHeaders });
                        }
                        return sendJSON(await response.json(), response.status);
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 500);
                    }
                }

                if (action === 'add_liq') {
                    try {
                        requireUniSatKey();
                        const body = await request.json();

                        if (body && typeof body === 'object') {
                            if (!('feeTick' in body)) body.feeTick = DEFAULT_FEE_TICK;
                            if (!('payType' in body)) body.payType = 'tick';
                            if ('rememberPayType' in body) delete body.rememberPayType;
                        }

                        const headers = { ...unisatApiHeaders, 'Content-Type': 'application/json' };

                        let endpointUrl = `${SWAP_BASE}/brc20-swap/add_liq`;
                        let response = await fetch(endpointUrl, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(body)
                        });
                        if (!response.ok && response.status === 404) {
                            endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/add_liq`;
                            response = await fetch(endpointUrl, {
                                method: 'POST',
                                headers,
                                body: JSON.stringify(body)
                            });
                        }
                        return sendJSON(await response.json(), response.status);
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 500);
                    }
                }

                if (action === 'quote_remove_liq') {
                    try {
                        requireUniSatKey();
                        const proxyParams = new URLSearchParams(url.searchParams);
                        proxyParams.delete('action');
                        proxyParams.delete('rememberPayType');

                        let endpointUrl = `${SWAP_BASE}/brc20-swap/quote_remove_liq?${proxyParams.toString()}`;
                        let response = await fetch(endpointUrl, { headers: unisatApiHeaders });
                        if (!response.ok && response.status === 404) {
                            endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/quote_remove_liq?${proxyParams.toString()}`;
                            response = await fetch(endpointUrl, { headers: unisatApiHeaders });
                        }
                        return sendJSON(await response.json(), response.status);
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 500);
                    }
                }

                if (action === 'pre_remove_liq') {
                    try {
                        requireUniSatKey();
                        const proxyParams = new URLSearchParams(url.searchParams);
                        proxyParams.delete('action');
                        proxyParams.delete('rememberPayType');

                        if (!proxyParams.has('feeTick')) proxyParams.set('feeTick', DEFAULT_FEE_TICK);
                        if (!proxyParams.has('payType')) proxyParams.set('payType', 'tick');

                        let endpointUrl = `${SWAP_BASE}/brc20-swap/pre_remove_liq?${proxyParams.toString()}`;
                        let response = await fetch(endpointUrl, { headers: unisatApiHeaders });
                        if (!response.ok && response.status === 404) {
                            endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/pre_remove_liq?${proxyParams.toString()}`;
                            response = await fetch(endpointUrl, { headers: unisatApiHeaders });
                        }
                        return sendJSON(await response.json(), response.status);
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 500);
                    }
                }

                if (action === 'remove_liq') {
                    try {
                        requireUniSatKey();
                        const body = await request.json();

                        if (body && typeof body === 'object') {
                            if (!('feeTick' in body)) body.feeTick = DEFAULT_FEE_TICK;
                            if (!('payType' in body)) body.payType = 'tick';
                            if ('rememberPayType' in body) delete body.rememberPayType;
                        }

                        const headers = { ...unisatApiHeaders, 'Content-Type': 'application/json' };

                        let endpointUrl = `${SWAP_BASE}/brc20-swap/remove_liq`;
                        let response = await fetch(endpointUrl, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(body)
                        });
                        if (!response.ok && response.status === 404) {
                            endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/remove_liq`;
                            response = await fetch(endpointUrl, {
                                method: 'POST',
                                headers,
                                body: JSON.stringify(body)
                            });
                        }
                        return sendJSON(await response.json(), response.status);
                    } catch (e) {
                        return sendJSON({ code: -1, msg: e?.message || String(e) }, 500);
                    }
                }

                // 5. PROXY GET (InSwap) - включает quote_swap
                const ALLOWED_GET = [
                    'create_swap',
                    'create_deposit',
                    'create_withdraw',
                    'config',
                    'deposit_list',
                    'withdraw_history',
                    'deposit_process',
                    'withdraw_process',
                    'swap_history',
                    'deposit_balance',
                    'quote_swap',
                    'price_line'
                ];

                if (ALLOWED_GET.includes(action)) {
                    const proxyParams = new URLSearchParams(url.searchParams);
                    proxyParams.delete('action');

                    let endpoint = action;
                    if (action === 'create_swap') endpoint = 'pre_swap';

                    const response = await fetch(`${INSWAP_URL}/${endpoint}?${proxyParams.toString()}`, {
                        method: 'GET',
                        headers: upstreamHeaders
                    });
                    return sendJSON(await response.json(), response.status);
                }

                // 6. PROXY POST
                if (['submit_swap', 'confirm_deposit', 'confirm_withdraw'].includes(action)) {
                    const body = await request.json();
                    let endpoint = action;
                    if (action === 'submit_swap') endpoint = 'swap';
                    const response = await fetch(`${INSWAP_URL}/${endpoint}`, {
                        method: 'POST',
                        headers: upstreamHeaders,
                        body: JSON.stringify(body)
                    });
                    return sendJSON(await response.json(), response.status);
                }

                // 7. BALANCE
                // ОПТИМИЗАЦИЯ: Batch балансов для уменьшения запросов
                if (action === 'balance_batch') {
                    const address = url.searchParams.get('address');
                    const ticks = url.searchParams.get('ticks')?.split(',') || [];
                    const walletOnly = url.searchParams.get('walletOnly') === 'true';

                    if (!address || ticks.length === 0) {
                        return sendJSON({ error: 'Missing address or ticks' }, 400);
                    }

                    // Загружаем все балансы параллельно
                    const balancePromises = ticks.map(async tick => {
                        if (walletOnly) {
                            return fetch(`${FRACTAL_BASE}/indexer/address/${address}/brc20/${tick}/info`, {
                                headers: upstreamHeaders
                            })
                                .then(r => r.json())
                                .then(data => ({ tick, data }))
                                .catch(e => ({ tick, error: e.message }));
                        } else {
                            // ИСПРАВЛЕНИЕ: Пробуем сначала без /indexer/, затем с /indexer/ (fallback)
                            let balanceUrl = `${SWAP_BASE}/brc20-swap/balance?address=${address}&tick=${tick}`;
                            let balanceRes = await fetch(balanceUrl, { headers: upstreamHeaders });

                            // Fallback: если не работает без /indexer/, пробуем с /indexer/
                            if (!balanceRes.ok && balanceRes.status === 404) {
                                balanceUrl = `${SWAP_BASE}/indexer/brc20-swap/balance?address=${address}&tick=${tick}`;
                                balanceRes = await fetch(balanceUrl, { headers: upstreamHeaders });
                            }

                            try {
                                const data = await balanceRes.json();
                                return { tick, data };
                            } catch (e) {
                                return { tick, error: e.message };
                            }
                        }
                    });

                    const results = await Promise.all(balancePromises);
                    const balances = {};
                    results.forEach(({ tick, data, error }) => {
                        balances[tick] = error ? { error } : data;
                    });

                    return sendJSON({ code: 0, data: balances });
                }

                if (action === 'balance') {
                    const address = url.searchParams.get('address');
                    const tick = url.searchParams.get('tick') || 'sFB___000';
                    const walletOnly = url.searchParams.get('walletOnly') === 'true';
                    if (walletOnly) {
                        try {
                            const res = await fetch(`${FRACTAL_BASE}/indexer/address/${address}/brc20/${tick}/info`, {
                                headers: upstreamHeaders
                            });
                            if (!res.ok) {
                                return sendJSON({ error: `API error: ${res.status} ${res.statusText}` }, res.status);
                            }
                            const text = await res.text();
                            if (!text || text.trim().length === 0) {
                                return sendJSON({ error: 'Empty response from API' }, 500);
                            }
                            try {
                                return sendJSON(JSON.parse(text));
                            } catch (parseError) {
                                return sendJSON(
                                    { error: `JSON parse error: ${parseError.message}`, raw: text.substring(0, 200) },
                                    500
                                );
                            }
                        } catch (e) {
                            return sendJSON({ error: `Fetch error: ${e.message}` }, 500);
                        }
                    } else {
                        try {
                            // ИСПРАВЛЕНИЕ: Пробуем сначала через SWAP_BASE, если 404 - через INSWAP_URL
                            let balanceUrl = `${SWAP_BASE}/indexer/brc20-swap/balance?address=${address}&tick=${tick}`;
                            let res = await fetch(balanceUrl, { headers: upstreamHeaders });

                            // Fallback: если SWAP_BASE не работает (404), пробуем через INSWAP_URL
                            if (!res.ok && res.status === 404) {
                                balanceUrl = `${INSWAP_URL}/balance?address=${address}&tick=${tick}`;
                                res = await fetch(balanceUrl, { headers: upstreamHeaders });
                            }

                            if (!res.ok) {
                                return sendJSON(
                                    { error: `API error: ${res.status} ${res.statusText}`, url: balanceUrl },
                                    res.status
                                );
                            }
                            const text = await res.text();
                            if (!text || text.trim().length === 0) {
                                return sendJSON({ error: 'Empty response from API' }, 500);
                            }
                            try {
                                return sendJSON(JSON.parse(text));
                            } catch (parseError) {
                                return sendJSON(
                                    { error: `JSON parse error: ${parseError.message}`, raw: text.substring(0, 200) },
                                    500
                                );
                            }
                        } catch (e) {
                            return sendJSON({ error: `Fetch error: ${e.message}` }, 500);
                        }
                    }
                }

                // 8. FIP-101 HISTORY
                if (action === 'history') {
                    requireUniSatKey();
                    const address = url.searchParams.get('address');
                    const tick = url.searchParams.get('tick'); // Если есть, ищем BRC-20, если нет - Native FB

                    if (!address) return sendJSON({ code: -1, msg: 'No address' }, 400);

                    let targetUrl;
                    if (tick && tick !== 'FB') {
                        // История токена BRC-20 (FENNEC)
                        // FIP-101: /v1/indexer/address/{address}/brc20/{ticker}/history
                        targetUrl = `${FRACTAL_BASE}/indexer/address/${address}/brc20/${tick}/history?type=transfer&start=0&limit=10`;
                    } else {
                        // История нативного FB
                        // FIP-101: /v1/indexer/address/{address}/history
                        // ИСПРАВЛЕНИЕ: Используем правильные параметры cursor и size (по документации API)
                        targetUrl = `${FRACTAL_BASE}/indexer/address/${address}/history?cursor=0&size=10`;
                    }

                    const response = await fetch(targetUrl, { headers: authHeaders() });
                    return sendJSON(await response.json(), response.status);
                }

                // 9. FULL UTXO DATA (for Audit)
                if (action === 'full_utxo_data') {
                    requireUniSatKey();
                    const address = url.searchParams.get('address');
                    const filter = url.searchParams.get('filter') || 'all';
                    const status = url.searchParams.get('status') || 'all';
                    const cursor = url.searchParams.get('cursor') || '0';
                    const size = url.searchParams.get('size') || '50';

                    if (!address) return sendJSON({ error: 'Missing address' }, 400);

                    // Try Fractal UniSat API v1 endpoint (with API key) first
                    try {
                        const v1Endpoint = `${FRACTAL_BASE}/indexer/address/${address}/utxo-data?cursor=${cursor}&size=${size}`;

                        const v1Response = await fetch(v1Endpoint, {
                            method: 'GET',
                            headers: {
                                ...authHeaders(),
                                Accept: 'application/json'
                            }
                        });

                        if (v1Response.ok) {
                            const v1Data = await v1Response.json();
                            return sendJSON(v1Data, v1Response.status);
                        }
                    } catch (e) {
                        console.warn('v1 UTXO endpoint failed:', e);
                    }

                    // Fallback: return empty result (UTXO count will use window.unisat.getUtxos() instead)
                    return sendJSON(
                        {
                            code: 0,
                            data: { list: [], total: 0 },
                            msg: 'UTXO data unavailable via API, using wallet fallback'
                        },
                        200
                    );
                }

                // --- FENNEC ID DATA (Simplified: Prices + Summary only) ---
                if (action === 'audit_data') {
                    const address = url.searchParams.get('address');
                    if (!address) return sendJSON({ error: 'No address' }, 400);

                    // Хелпер для безопасного фетча (никогда не кидает throw)
                    // ИСПРАВЛЕНИЕ: Throttling для UniSat API (1-2 запроса в секунду)
                    let lastUniSatRequest = 0;
                    const UNISAT_THROTTLE_MS = 4000; // ОПТИМИЗАЦИЯ: Увеличено до 4000ms = 0.25 запроса в секунду для множества пользователей

                    // Кэш для ответов (30 секунд для UI) - рекомендация UniSat
                    const responseCache = new Map();
                    const CACHE_TTL = 60000; // 60 секунд для балансов и метаданных (для множества пользователей)

                    const safeFetch = async (p, options = {}) => {
                        const { useCache = false, cacheKey = null, isUniSat = false } = options;

                        // Проверяем кэш
                        if (useCache && cacheKey) {
                            const cached = responseCache.get(cacheKey);
                            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                                return cached.data;
                            }
                        }

                        // Throttling для UniSat API
                        if (isUniSat) {
                            const now = Date.now();
                            const timeSinceLastRequest = now - lastUniSatRequest;
                            if (timeSinceLastRequest < UNISAT_THROTTLE_MS) {
                                await new Promise(r => setTimeout(r, UNISAT_THROTTLE_MS - timeSinceLastRequest));
                            }
                            lastUniSatRequest = Date.now();
                        }

                        try {
                            const response = await p;
                            if (!response.ok) {
                                // Exponential backoff для 429
                                if (response.status === 429) {
                                    const retryAfter = response.headers.get('Retry-After');
                                    const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000; // ОПТИМИЗАЦИЯ: Уменьшено до 1 секунды
                                    console.warn(`Rate limited (429), waiting ${delay}ms`);
                                    await new Promise(r => setTimeout(r, delay));
                                    // Не ретраим автоматически - пусть вызывающий код решает
                                    return null;
                                }
                                return null;
                            }
                            const data = await response.json();

                            // Сохраняем в кэш
                            if (useCache && cacheKey) {
                                responseCache.set(cacheKey, { data, timestamp: Date.now() });
                            }

                            return data;
                        } catch (err) {
                            console.warn('Fetch error:', err.message);
                            return null;
                        }
                    };

                    try {
                        // Запускаем все запросы параллельно и безопасно
                        const [summaryRes, btcPriceData, poolRes, coingeckoRes, fennecPoolRes] = await Promise.all([
                            safeFetch(
                                fetch(`${FRACTAL_BASE}/indexer/address/${address}/summary`, {
                                    headers: upstreamHeaders
                                })
                            ),
                            safeFetch(fetch('https://mempool.space/api/v1/prices')),
                            safeFetch(
                                fetch(`${INSWAP_URL}/pool_info?tick0=sBTC___000&tick1=sFB___000`, {
                                    headers: upstreamHeaders
                                })
                            ),
                            safeFetch(fetch(`${BACKEND_URL}?action=coingecko_price&ids=bitcoin&vs_currencies=usd`)),
                            safeFetch(
                                fetch(`${INSWAP_URL}/pool_info?tick0=FENNEC&tick1=sFB___000`, {
                                    headers: upstreamHeaders
                                })
                            )
                        ]);

                        // Собираем данные с фоллбеками
                        const btcPriceUSD = btcPriceData?.USD || coingeckoRes?.bitcoin?.usd || 95000;

                        // Расчет цены FB
                        let fbPriceUSD = 0;
                        if (poolRes?.data) {
                            // Логика определения цены FB через пул sBTC/sFB
                            const isBtcFirst = poolRes.data.tick0 && poolRes.data.tick0.includes('BTC');
                            const amt0 = parseFloat(poolRes.data.amount0 || 0);
                            const amt1 = parseFloat(poolRes.data.amount1 || 0);

                            if (isBtcFirst && amt1 > 0) fbPriceUSD = (amt0 / amt1) * btcPriceUSD;
                            else if (!isBtcFirst && amt0 > 0) fbPriceUSD = (amt1 / amt0) * btcPriceUSD;
                        }
                        if (fbPriceUSD === 0) fbPriceUSD = btcPriceUSD / 12000; // Хардкод фоллбек

                        // Расчет цены FENNEC
                        let fennecPriceInFB = 0;
                        if (fennecPoolRes?.data) {
                            const isFennecFirst =
                                fennecPoolRes.data.tick0 && fennecPoolRes.data.tick0.includes('FENNEC');
                            const amt0 = parseFloat(fennecPoolRes.data.amount0 || 0);
                            const amt1 = parseFloat(fennecPoolRes.data.amount1 || 0);

                            if (isFennecFirst && amt0 > 0) fennecPriceInFB = amt1 / amt0;
                            else if (!isFennecFirst && amt1 > 0) fennecPriceInFB = amt0 / amt1;
                        }

                        // Summary data
                        const summary = summaryRes?.data || {};
                        const txCount = summary.totalTransactionCount || summary.historyCount || 0;

                        // First TX time
                        let firstTxTime = 0;
                        if (summary.firstTransactionTime) {
                            firstTxTime = summary.firstTransactionTime;
                        } else if (txCount > 0) {
                            try {
                                const offset = Math.max(0, txCount - 1);
                                // ИСПРАВЛЕНИЕ: Используем правильные параметры cursor и size (по документации API)
                                const hRes = await safeFetch(
                                    fetch(
                                        `${FRACTAL_BASE}/indexer/address/${address}/history?cursor=${offset}&size=1`,
                                        {
                                            headers: upstreamHeaders
                                        }
                                    )
                                );
                                if (hRes?.data?.detail?.[0]) {
                                    firstTxTime = hRes.data.detail[0].blocktime || hRes.data.detail[0].timestamp || 0;
                                }
                            } catch (e) {}
                        }

                        return sendJSON({
                            code: 0,
                            data: {
                                summary: summary,
                                prices: {
                                    btc: btcPriceUSD,
                                    fb: fbPriceUSD,
                                    fennec_in_fb: fennecPriceInFB
                                },
                                synced_at: new Date().toISOString()
                            }
                        });
                    } catch (e) {
                        return sendJSON({ error: 'Critical audit error: ' + e.message }, 200); // Возвращаем 200 с ошибкой внутри, чтобы фронт не падал
                    }
                }

                // --- MEMPOOL SUMMARY (Оптимизированный эндпоинт на основе Mempool Fractal API) ---
                // ИСПРАВЛЕНИЕ: Используем Mempool Fractal API для получения базовой статистики (разгружаем UniSat)
                if (action === 'mempool_summary') {
                    const address = url.searchParams.get('address');
                    if (!address) return sendJSON({ error: 'Address required' }, 400);

                    try {
                        // Параллельно запрашиваем статистику и UTXO из Mempool Fractal API
                        const [mempoolRes, utxoRes] = await Promise.all([
                            fetch(`https://mempool.fractalbitcoin.io/api/address/${address}`, {
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            }).catch(() => null),
                            fetch(`https://mempool.fractalbitcoin.io/api/address/${address}/utxo`, {
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            }).catch(() => null)
                        ]);

                        let txCount = 0;
                        let utxoCount = 0;
                        let nativeBalance = 0;

                        // Обрабатываем статистику из mempool
                        if (mempoolRes?.ok) {
                            const mempoolData = await mempoolRes.json();
                            let c = {},
                                m = {};

                            if (mempoolData.chain_stats || mempoolData.mempool_stats) {
                                c = mempoolData.chain_stats || {};
                                m = mempoolData.mempool_stats || {};
                            } else if (mempoolData.funded_txo_count !== undefined) {
                                c = mempoolData;
                                m = {};
                            }

                            txCount = Number(c.tx_count || 0) + Number(m.tx_count || 0);
                            const fundedSum = Number(c.funded_txo_sum || 0) + Number(m.funded_txo_sum || 0);
                            const spentSum = Number(c.spent_txo_sum || 0) + Number(m.spent_txo_sum || 0);
                            nativeBalance = Math.max(0, (fundedSum - spentSum) / 1e8);

                            // UTXO count из статистики
                            const chainFunded = Number(c.funded_txo_count || 0);
                            const chainSpent = Number(c.spent_txo_count || 0);
                            const mempoolFunded = Number(m.funded_txo_count || 0);
                            const mempoolSpent = Number(m.spent_txo_count || 0);
                            utxoCount = Math.max(0, chainFunded + mempoolFunded - (chainSpent + mempoolSpent));
                        }

                        // UTXO count из прямого запроса (приоритет)
                        if (utxoRes?.ok) {
                            const utxoData = await utxoRes.json();
                            if (Array.isArray(utxoData)) {
                                utxoCount = utxoData.length;
                            } else if (utxoData.data && Array.isArray(utxoData.data)) {
                                utxoCount = utxoData.data.length;
                            } else if (utxoData.list && Array.isArray(utxoData.list)) {
                                utxoCount = utxoData.list.length;
                            }
                        }

                        return sendJSON({
                            code: 0,
                            data: {
                                address: address,
                                tx_count: txCount,
                                utxo_count: utxoCount,
                                native_balance: nativeBalance,
                                source: 'mempool_fractal',
                                synced_at: new Date().toISOString()
                            },
                            _debug: {
                                mempool_ok: mempoolRes?.ok || false,
                                utxo_ok: utxoRes?.ok || false,
                                mempool_status: mempoolRes?.status,
                                utxo_status: utxoRes?.status
                            }
                        });
                    } catch (e) {
                        return sendJSON({ error: 'Mempool Summary error: ' + e.message }, 500);
                    }
                }

                // --- INSWAP SUMMARY (Оптимизированный эндпоинт на основе InSwap API) ---
                if (action === 'inswap_summary') {
                    const address = url.searchParams.get('address');
                    const pubkey = url.searchParams.get('pubkey') || '';
                    if (!address) return sendJSON({ error: 'Address required' }, 400);

                    try {
                        // КРИТИЧЕСКОЕ: Используем InSwap API как основной источник данных
                        // Это несколько "жирных" эндпоинтов, которые возвращают много данных сразу

                        // Генерируем x-sign для InSwap API
                        const xTs = Math.floor(Date.now() / 1000);
                        const xSignInswapParam = url.searchParams.get('x-sign-inswap');
                        const xTsInswapParam = url.searchParams.get('x-ts-inswap');

                        let inswapXSign = xSignInswapParam;
                        if (!inswapXSign) {
                            const inswapSelectUrl = `${INSWAP_URL}/select?address=${address}`;
                            inswapXSign = await generateXSign(
                                inswapSelectUrl,
                                xTsInswapParam ? parseInt(xTsInswapParam) : xTs,
                                'GET',
                                { address: address }
                            );
                        }

                        const inswapHeaders = {
                            Accept: 'application/json, text/plain, */*',
                            'Accept-Encoding': 'gzip, deflate, br, zstd',
                            'Accept-Language': 'ru,en;q=0.9',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            Referer: 'https://inswap.cc/swap/assets/account?tab=assets',
                            Origin: 'https://inswap.cc',
                            'x-appid': '1adcd7969603261753f1812c9461cd36',
                            'x-front-version': '2094',
                            'Sec-Fetch-Dest': 'empty',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Site': 'same-origin',
                            'x-sign': inswapXSign,
                            'x-ts': (xTsInswapParam ? xTsInswapParam : xTs).toString()
                        };

                        // Параллельно запрашиваем все нужные данные из InSwap (как в коде пользователя)
                        // Используем эндпоинты из кода: getAllBalance, myPoolList, getAddressUsd, userInfo
                        const [allBalanceRes, myPoolListRes, addressUsdRes, userInfoRes] = await Promise.all([
                            fetch(`${INSWAP_URL}/all_balance?address=${address}${pubkey ? `&pubkey=${pubkey}` : ''}`, {
                                headers: inswapHeaders
                            }).catch(() => null),
                            fetch(
                                `${INSWAP_URL}/my_pool_list?address=${address}&start=0&limit=10&sortType=desc&sortField=liq`,
                                { headers: inswapHeaders }
                            ).catch(() => null),
                            fetch(`${INSWAP_URL}/address_usd?address=${address}`, { headers: inswapHeaders }).catch(
                                () => null
                            ),
                            fetch(`${INSWAP_URL}/user_info?address=${address}`, { headers: inswapHeaders }).catch(
                                () => null
                            )
                        ]);

                        const allBalance = allBalanceRes?.ok ? await allBalanceRes.json().catch(() => null) : null;
                        const myPoolList = myPoolListRes?.ok ? await myPoolListRes.json().catch(() => null) : null;
                        const addressUsd = addressUsdRes?.ok ? await addressUsdRes.json().catch(() => null) : null;
                        const userInfo = userInfoRes?.ok ? await userInfoRes.json().catch(() => null) : null;

                        // Собираем summary данные из InSwap (как в коде пользователя)
                        const summary = {
                            address: address,
                            // Балансы из all_balance (getAllBalance)
                            all_balance: allBalance?.data || {},
                            // LP данные из my_pool_list (myPoolList)
                            lp_list: myPoolList?.data?.list || [],
                            lp_count: myPoolList?.data?.list?.length || 0,
                            lp_total_usd: myPoolList?.data?.totalLpUSD || 0,
                            // Net worth из address_usd (getAddressUsd) или all_balance
                            total_usd: addressUsd?.data?.total_usd || allBalance?.data?.total_usd || 0,
                            // User info (userInfo) - дополнительная информация о пользователе
                            user_info: userInfo?.data || {},
                            // Детали по токенам (обработанные из all_balance)
                            tokens: {},
                            // LP позиции (если есть в all_balance)
                            lp_positions: allBalance?.data?.lp_positions || allBalance?.data?.positions || [],
                            synced_at: new Date().toISOString()
                        };

                        // Обрабатываем токены из all_balance
                        if (allBalance?.data) {
                            Object.keys(allBalance.data).forEach(ticker => {
                                const tokenData = allBalance.data[ticker];
                                if (
                                    ticker === 'lp_positions' ||
                                    ticker === 'positions' ||
                                    typeof tokenData !== 'object' ||
                                    !tokenData
                                ) {
                                    return;
                                }

                                const balance = tokenData.balance || tokenData;
                                let balanceValue = 0;
                                if (typeof balance === 'object' && balance !== null) {
                                    balanceValue = parseFloat(
                                        balance.swap ||
                                            balance.module ||
                                            balance.pendingSwap ||
                                            balance.pendingAvailable ||
                                            0
                                    );
                                } else {
                                    balanceValue = parseFloat(balance || 0);
                                }

                                if (balanceValue > 0) {
                                    summary.tokens[ticker] = {
                                        balance: balanceValue,
                                        price: parseFloat(tokenData.price || 0),
                                        value_usd: balanceValue * parseFloat(tokenData.price || 0)
                                    };
                                }
                            });
                        }

                        return sendJSON({
                            code: 0,
                            data: summary,
                            _debug: {
                                source: 'inswap_summary',
                                all_balance_code: allBalance?.code,
                                all_balance_msg: allBalance?.msg,
                                my_pool_list_code: myPoolList?.code,
                                my_pool_list_msg: myPoolList?.msg,
                                address_usd_code: addressUsd?.code,
                                address_usd_msg: addressUsd?.msg,
                                user_info_code: userInfo?.code,
                                user_info_msg: userInfo?.msg,
                                tokens_count: Object.keys(summary.tokens).length,
                                lp_positions_count: summary.lp_positions.length
                            }
                        });
                    } catch (e) {
                        return sendJSON({ error: 'InSwap Summary error: ' + e.message }, 500);
                    }
                }

                // --- SUMMARY (Оптимизированный эндпоинт на основе Uniscan Summary API) ---
                if (action === 'summary') {
                    const address = url.searchParams.get('address');
                    if (!address) return sendJSON({ error: 'Address required' }, 400);

                    try {
                        // КРИТИЧЕСКОЕ: Используем Uniscan Summary API как основной источник данных
                        // Это один "жирный" эндпоинт, который возвращает много данных сразу
                        const UNISCAN_BASE = 'https://uniscan.cc/fractal-api/explorer-v1';
                        const uniscanSummaryUrl = `${UNISCAN_BASE}/address/summary?address=${address}`;

                        // Генерируем x-sign для Uniscan API
                        const xTs = Math.floor(Date.now() / 1000);
                        const xSign = await generateXSign(uniscanSummaryUrl, xTs, 'GET', { address: address });

                        const uniscanHeaders = {
                            Accept: 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'x-appid': '1adcd7969603261753f1812c9461cd36',
                            'x-front-version': '2128',
                            'x-sign': xSign,
                            'x-ts': xTs.toString()
                        };

                        const summaryRes = await fetch(uniscanSummaryUrl, { headers: uniscanHeaders });
                        const summaryData = await summaryRes.json();

                        // Извлекаем данные из Uniscan Summary (как в коде пользователя)
                        const assets = summaryData?.data?.assets || {};
                        const brc20List = assets.BRC20List || [];

                        // Фильтруем BRC-20 токены (как в коде: L.sm - проверка валидности тикера)
                        // Упрощенная проверка: убираем токены с пустыми или невалидными тикерами
                        const validBrc20List = brc20List.filter(token => {
                            const ticker = token.ticker || token.tick || '';
                            return ticker && ticker.length > 0 && ticker.length <= 20;
                        });

                        // Собираем summary данные
                        const summary = {
                            address: address,
                            tx_count: summaryData?.data?.totalTransactionCount || summaryData?.data?.tx_count || 0,
                            utxo_count: summaryData?.data?.utxo_count || 0,
                            native_balance: summaryData?.data?.native_balance || 0,
                            runes_count: summaryData?.data?.runes_count || assets?.RunesList?.length || 0,
                            brc20_count: validBrc20List.length,
                            ordinals_count: summaryData?.data?.ordinals_count || assets?.InscriptionsList?.length || 0,
                            brc20_list: validBrc20List.map(token => ({
                                ticker: token.ticker || token.tick || '',
                                balance: token.balance || token.availableBalance || 0,
                                transferableBalance: token.transferableBalance || 0,
                                availableBalance: token.availableBalance || 0
                            })),
                            // Дополнительные данные из summary
                            first_tx_time: summaryData?.data?.firstTxTime || 0,
                            last_tx_time: summaryData?.data?.lastTxTime || 0,
                            synced_at: new Date().toISOString()
                        };

                        return sendJSON({
                            code: 0,
                            data: summary,
                            _debug: {
                                source: 'uniscan_summary',
                                uniscan_response_code: summaryData?.code,
                                uniscan_response_msg: summaryData?.msg,
                                brc20_total: brc20List.length,
                                brc20_valid: validBrc20List.length
                            }
                        });
                    } catch (e) {
                        return sendJSON({ error: 'Summary error: ' + e.message }, 500);
                    }
                }

                // --- FRACTAL AUDIT (Grand Dossier v4 - CoinGecko FB Price) ---
                if (action === 'fractal_audit') {
                    const address = url.searchParams.get('address');
                    if (!address) return sendJSON({ error: 'Address required' }, 400);

                    // Cache API (Cloudflare) — АГРЕССИВНОЕ кэширование для снижения 429 ошибок
                    // КРИТИЧЕСКОЕ: Кэшируем по адресу (без pubkey и других параметров) для переиспользования между пользователями
                    const cache = caches.default;
                    // Нормализуем URL для кэша (убираем pubkey и другие неважные параметры)
                    const cacheKeyUrl = new URL(request.url);
                    cacheKeyUrl.searchParams.delete('pubkey'); // pubkey не влияет на результат для кэша
                    cacheKeyUrl.searchParams.delete('fast');
                    cacheKeyUrl.searchParams.delete('x-sign-uniscan');
                    cacheKeyUrl.searchParams.delete('x-ts-uniscan');
                    cacheKeyUrl.searchParams.delete('x-sign-inswap');
                    cacheKeyUrl.searchParams.delete('x-ts-inswap');
                    cacheKeyUrl.searchParams.set('v', '2');
                    const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });
                    const cachedResponse = await cache.match(cacheKey);
                    if (cachedResponse) {
                        console.log(
                            `✅ Serving fractal_audit from Cloudflare cache for address ${address?.substring(0, 10)}... (reduces 429 errors)`
                        );
                        return cachedResponse;
                    }

                    // ИСПРАВЛЕНИЕ: Throttling для UniSat API (оптимизировано для скорости)
                    // ИСПРАВЛЕНИЕ: Получаем параметры запроса (address уже объявлен выше на строке 745)
                    const pubkey = url.searchParams.get('pubkey') || '';
                    // ИСПРАВЛЕНИЕ: Убрана подпись пользователя - не требуется для этих API
                    // const userSignature = url.searchParams.get('signature') || '';
                    // if (userSignature) {
                    //     upstreamHeaders['x-signature'] = userSignature;
                    //     upstreamHeaders['x-address'] = address;
                    // }

                    // Функция нормализации тикера (используется в нескольких местах)
                    const normalizeTicker = ticker => {
                        if (!ticker) return '';
                        // Убираем суффиксы типа ___000, затем подчеркивание в конце, затем приводим к верхнему регистру
                        return ticker
                            .replace(/___\d+$/, '')
                            .replace(/_+$/, '')
                            .toUpperCase()
                            .trim();
                    };

                    let lastUniSatRequest = 0;
                    // ОПТИМИЗАЦИЯ: Throttling для UniSat API (рекомендация: 1-5 req/s max)
                    // КРИТИЧЕСКОЕ: Увеличено для множества пользователей - меньше запросов = меньше 429
                    const UNISAT_THROTTLE_MS = 900; // 900ms = ~1.1 req/s (баланс скорости и 429)

                    // Кэш для ответов - увеличен для снижения 429 ошибок при множестве пользователей
                    const responseCache = new Map();
                    // КРИТИЧЕСКОЕ: Увеличено время кэша - даже если адреса разные, кэш снижает нагрузку
                    const CACHE_TTL = 60000; // 60 секунд для балансов и метаданных (для множества пользователей)

                    // ИСПРАВЛЕНИЕ: Улучшенный safeFetch с throttling, кэшированием и exponential backoff
                    const safeFetch = async (p, options = {}) => {
                        const { useCache = false, cacheKey = null, isUniSat = false, retryOn429 = false } = options;

                        // Проверяем кэш
                        if (useCache && cacheKey) {
                            const cached = responseCache.get(cacheKey);
                            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                                return cached.data;
                            }
                        }

                        // Exponential backoff для 429 (рекомендация Unisat)
                        let retries = retryOn429 ? 3 : 0;
                        let delay = 1000; // ОПТИМИЗАЦИЯ: Уменьшено до 1 секунды для ускорения загрузки

                        while (retries >= 0) {
                            try {
                                // Throttling для UniSat API (рекомендация Unisat: 1-5 req/s)
                                // ВАЖНО: throttle имеет смысл только когда p - функция (иначе fetch уже запущен)
                                if (isUniSat && typeof p === 'function') {
                                    const now = Date.now();
                                    const timeSinceLastRequest = now - lastUniSatRequest;
                                    if (timeSinceLastRequest < UNISAT_THROTTLE_MS) {
                                        await new Promise(r =>
                                            setTimeout(r, UNISAT_THROTTLE_MS - timeSinceLastRequest)
                                        );
                                    }
                                    lastUniSatRequest = Date.now();
                                }

                                const response = typeof p === 'function' ? await p() : await p;

                                if (!response.ok) {
                                    // КРИТИЧЕСКОЕ: Добавляем debug информацию о статусе ответа
                                    // Проверяем cacheKey для определения какой запрос это
                                    if (cacheKey && cacheKey.includes('uniscan_summary')) {
                                        debugInfo.uniscan_summary_raw_status = response.status;
                                        debugInfo.uniscan_summary_raw_statusText = response.statusText;
                                        debugInfo.uniscan_summary_raw_headers = Object.fromEntries(
                                            response.headers.entries()
                                        );
                                    }

                                    // Обработка 429 (Too Many Requests)
                                    if (response.status === 429) {
                                        // Если p - не функция, повторить запрос нельзя (fetch уже выполнен)
                                        if (typeof p !== 'function') {
                                            if (cacheKey && cacheKey.includes('uniscan_summary')) {
                                                debugInfo.uniscan_summary_429_final = true;
                                            }
                                            return null;
                                        }
                                        if (retries > 0) {
                                            const retryAfter = response.headers.get('Retry-After');
                                            delay = retryAfter ? parseInt(retryAfter) * 1000 : delay;
                                            console.warn(
                                                `Rate limited (429), waiting ${delay}ms, retries left: ${retries}`
                                            );
                                            await new Promise(r => setTimeout(r, delay));
                                            delay = Math.min(delay * 2, 30000); // Exponential backoff, max 30s
                                            retries--;
                                            continue; // Повторяем запрос
                                        } else {
                                            console.warn('Rate limited (429), no more retries');
                                            if (cacheKey && cacheKey.includes('uniscan_summary')) {
                                                debugInfo.uniscan_summary_429_final = true;
                                            }
                                            return null;
                                        }
                                    }

                                    // КРИТИЧЕСКОЕ: Если не 429, но статус не OK - логируем
                                    if (cacheKey && cacheKey.includes('uniscan_summary')) {
                                        debugInfo.uniscan_summary_not_ok = true;
                                        debugInfo.uniscan_summary_not_ok_status = response.status;
                                    }

                                    return null;
                                }

                                const data = await response.json();

                                // Сохраняем в кэш
                                if (useCache && cacheKey) {
                                    responseCache.set(cacheKey, { data, timestamp: Date.now() });
                                }

                                return data;
                            } catch (err) {
                                // КРИТИЧЕСКОЕ: Добавляем debug информацию об ошибке
                                if (cacheKey && cacheKey.includes('uniscan_summary')) {
                                    debugInfo.uniscan_summary_fetch_error = err.message || 'unknown';
                                    debugInfo.uniscan_summary_fetch_error_name = err.name;
                                    debugInfo.uniscan_summary_fetch_error_stack = err.stack;
                                }

                                if (retries > 0 && retryOn429) {
                                    console.warn(`Fetch error, retrying: ${err.message}`);
                                    await new Promise(r => setTimeout(r, delay));
                                    delay = Math.min(delay * 2, 30000);
                                    retries--;
                                    continue;
                                }
                                console.warn('Fetch error:', err.message);
                                return null;
                            }
                        }

                        return null;
                    };

                    // ИСПРАВЛЕНИЕ: debugInfo уже определен выше, используем существующий объект
                    // Очищаем его для нового запроса
                    Object.keys(debugInfo).forEach(key => delete debugInfo[key]);

                    try {
                        // ИСПРАВЛЕНИЕ: Используем Mempool Fractal API как основной источник статистики (разгружаем UniSat)
                        // 1. MEMPOOL (Статистика) - только Fractal
                        // Пробуем оба обозревателя Fractal параллельно
                        const mempoolFractalPromise = safeFetch(
                            fetch(`https://mempool.fractalbitcoin.io/api/address/${address}`, {
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            })
                        );
                        // ИСПРАВЛЕНИЕ: UTXO список из Mempool Fractal (разгружаем UniSat)
                        const utxoListPromise = safeFetch(
                            fetch(`https://mempool.fractalbitcoin.io/api/address/${address}/utxo`, {
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            })
                        );
                        // Uniscan как альтернативный источник (если доступен API)
                        const uniscanPromise = safeFetch(
                            fetch(`https://uniscan.cc/api/fractal/address/${address}`, {
                                headers: {
                                    Accept: 'application/json',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            })
                        );

                        // ИСПРАВЛЕНИЕ: Объявляем mempoolPromise ДО его использования
                        const mempoolPromise = Promise.all([mempoolFractalPromise, uniscanPromise]).then(
                            ([fractal, uniscan]) => {
                                // Приоритет: mempool.fractalbitcoin.io, затем uniscan
                                if (
                                    fractal &&
                                    (fractal.chain_stats ||
                                        fractal.mempool_stats ||
                                        fractal.funded_txo_count !== undefined)
                                ) {
                                    return fractal;
                                }
                                if (
                                    uniscan &&
                                    (uniscan.chain_stats ||
                                        uniscan.mempool_stats ||
                                        uniscan.funded_txo_count !== undefined)
                                ) {
                                    return uniscan;
                                }
                                return fractal || uniscan || null;
                            }
                        );

                        // ОПТИМИЗАЦИЯ: Используем Uniscan Summary API как приоритетный источник данных (как в коде пользователя)
                        // Это один "жирный" эндпоинт, который возвращает много данных сразу
                        const UNISCAN_BASE = 'https://uniscan.cc/fractal-api/explorer-v1';
                        const uniscanSummaryUrl = `${UNISCAN_BASE}/address/summary?address=${address}`;

                        // ИСПРАВЛЕНИЕ: Убрана генерация x-sign для Uniscan - если она не работает (403), не тратим запрос
                        // Uniscan Summary API требует x-sign, но если он не работает, пропускаем этот источник
                        const xSignUniscanParam = url.searchParams.get('x-sign-uniscan');
                        const xTsUniscanParam = url.searchParams.get('x-ts-uniscan');

                        // Используем x-sign только если он передан через параметры (не генерируем автоматически)
                        let uniscanSummaryPromise = null;
                        if (xSignUniscanParam && xTsUniscanParam) {
                            const xTsUniscan = parseInt(xTsUniscanParam);
                            const uniscanHeaders = {
                                Accept: 'application/json, text/plain, */*',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'x-appid': '1adcd7969603261753f1812c9461cd36',
                                'x-front-version': '2128',
                                'x-sign': xSignUniscanParam,
                                'x-ts': xTsUniscan.toString()
                            };

                            uniscanSummaryPromise = safeFetch(
                                () => fetch(uniscanSummaryUrl, { headers: uniscanHeaders }),
                                {
                                    isUniSat: false,
                                    useCache: true,
                                    cacheKey: `uniscan_summary_${address}`,
                                    retryOn429: true
                                }
                            );
                            debugInfo.uniscan_x_sign_provided = true;
                        } else {
                            debugInfo.uniscan_x_sign_provided = false;
                            debugInfo.uniscan_summary_skipped = 'x-sign not provided, skipping to avoid 403 error';
                        }

                        // ОПТИМИЗАЦИЯ: Используем 3 основных эндпоинта UniSat Open API вместо множества мелких запросов
                        // Это значительно снижает количество запросов и вероятность 429 ошибок

                        // 1. UniSat Balance API - BTC баланс, inscriptionUtxoCount (proxy для ordinals), utxoCount
                        const unisatBalancePromise = safeFetch(
                            () =>
                                fetch(`${FRACTAL_BASE}/indexer/address/${address}/balance`, {
                                    headers: upstreamHeaders
                                }),
                            { isUniSat: true, useCache: true, cacheKey: `unisat_balance_${address}`, retryOn429: true }
                        );

                        // 2. UniSat BRC-20 Summary API - все BRC-20 токены разом
                        // ИСПРАВЛЕНИЕ: Используем brc20-prog/summary как приоритетный источник (более полные данные)
                        // Fallback на brc20/summary если brc20-prog не работает
                        const unisatBrc20SummaryPromise = (async () => {
                            // ПРИОРИТЕТ: Пробуем brc20-prog/summary (может возвращать более полные данные)
                            let result = await safeFetch(
                                fetch(
                                    `${FRACTAL_BASE}/indexer/address/${address}/brc20-prog/summary?start=0&limit=500`,
                                    { headers: upstreamHeaders }
                                ),
                                { isUniSat: true, useCache: false, retryOn429: false }
                            );

                            // Fallback: если brc20-prog не работает, используем brc20/summary
                            if (!result || (result.code !== undefined && result.code !== 0)) {
                                result = await safeFetch(
                                    () =>
                                        fetch(
                                            `${FRACTAL_BASE}/indexer/address/${address}/brc20/summary?start=0&limit=100`,
                                            { headers: upstreamHeaders }
                                        ),
                                    {
                                        isUniSat: true,
                                        useCache: true,
                                        cacheKey: `unisat_brc20_${address}`,
                                        retryOn429: true
                                    }
                                );
                                if (result) {
                                    debugInfo.brc20_api_used = 'brc20_summary_fallback';
                                }
                            } else {
                                debugInfo.brc20_api_used = 'brc20_prog_summary';
                            }

                            return result;
                        })();

                        // 3. UniSat History API - total транзакций (для расчета возраста)
                        // ИСПРАВЛЕНИЕ: Используем правильные параметры cursor и size (по документации API)
                        const unisatHistoryPromise = safeFetch(
                            () =>
                                fetch(`${FRACTAL_BASE}/indexer/address/${address}/history?cursor=0&size=1`, {
                                    headers: upstreamHeaders
                                }),
                            { isUniSat: true, useCache: true, cacheKey: `unisat_history_${address}`, retryOn429: true }
                        );

                        // 4. Опционально: UniSat Runes Balance List - все руны разом
                        const unisatRunesPromise = safeFetch(
                            () =>
                                fetch(
                                    `${FRACTAL_BASE}/indexer/address/${address}/runes/balance-list?start=0&limit=100`,
                                    {
                                        headers: upstreamHeaders
                                    }
                                ),
                            { isUniSat: true, useCache: true, cacheKey: `unisat_runes_${address}`, retryOn429: true }
                        );

                        // 5. НОВЫЙ: UniSat Summary API - получаем данные кошелька одним запросом (из кода Gemini)
                        const unisatSummaryPromise = safeFetch(
                            () =>
                                fetch(`${FRACTAL_BASE}/indexer/address/${address}/summary`, {
                                    headers: upstreamHeaders
                                }),
                            { isUniSat: true, useCache: true, cacheKey: `unisat_summary_${address}`, retryOn429: true }
                        );

                        const unisatAbandonNftUtxoPromise = safeFetch(
                            () =>
                                fetch(`${FRACTAL_BASE}/indexer/address/${address}/abandon-nft-utxo-data`, {
                                    headers: upstreamHeaders
                                }),
                            {
                                isUniSat: true,
                                useCache: true,
                                cacheKey: `unisat_abandon_nft_utxo_${address}`,
                                retryOn429: true
                            }
                        );

                        // 6. НОВЫЙ: InSwap Asset Summary API - получаем LP данные из модуля свапа (из кода Gemini)
                        // КРИТИЧЕСКОЕ: Используем SWAP_BASE для brc20-swap эндпоинтов
                        // ИСПРАВЛЕНИЕ: Проверяем правильный путь - возможно это /brc20-swap/address/{address}/asset-summary
                        // Пробуем оба варианта: с /indexer/ и без (fallback)
                        const inswapAssetSummaryPromise = (async () => {
                            // Сначала пробуем без /indexer/
                            let result = await safeFetch(
                                fetch(`${SWAP_BASE}/brc20-swap/address/${address}/asset-summary`, {
                                    headers: upstreamHeaders
                                }),
                                { isUniSat: true, useCache: false, retryOn429: false }
                            );
                            // Fallback: если не работает, пробуем с /indexer/
                            if (!result || (result.code !== undefined && result.code !== 0)) {
                                result = await safeFetch(
                                    () =>
                                        fetch(`${SWAP_BASE}/indexer/brc20-swap/address/${address}/asset-summary`, {
                                            headers: upstreamHeaders
                                        }),
                                    {
                                        isUniSat: true,
                                        useCache: true,
                                        cacheKey: `inswap_asset_summary_${address}`,
                                        retryOn429: true
                                    }
                                );
                            }
                            return result;
                        })();

                        // ОПТИМИЗАЦИЯ: Убран CoinGecko - цены получаем из InSwap all_balance
                        // const cgPromise = null;

                        // InSwap требует специальные headers (как на сайте)
                        // ИСПРАВЛЕНИЕ: Используем правильные headers из реальных запросов
                        const xTsInswap = Math.floor(Date.now() / 1000);
                        const xSignInswapParam = url.searchParams.get('x-sign-inswap');
                        const xTsInswapParam = url.searchParams.get('x-ts-inswap');

                        // Генерируем x-sign автоматически для InSwap, если не передан через параметры
                        let inswapXSign = xSignInswapParam;
                        if (!inswapXSign) {
                            // Для InSwap используем URL /select или /all_balance
                            const inswapSelectUrl = `${INSWAP_URL}/select?address=${address}`;
                            inswapXSign = await generateXSign(
                                inswapSelectUrl,
                                xTsInswapParam ? parseInt(xTsInswapParam) : xTsInswap,
                                'GET',
                                { address: address }
                            );
                            debugInfo.inswap_x_sign_auto_generated = true;
                        } else {
                            debugInfo.inswap_x_sign_auto_generated = false;
                        }

                        // КРИТИЧЕСКОЕ: Используем правильные headers из реальных запросов InSwap API
                        const inswapHeaders = {
                            Accept: 'application/json, text/plain, */*',
                            'Accept-Encoding': 'gzip, deflate, br, zstd',
                            'Accept-Language': 'ru,en;q=0.9',
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/25.10.0.0 Safari/537.36',
                            Referer: 'https://inswap.cc/swap/assets/account?tab=assets',
                            Origin: 'https://inswap.cc',
                            'x-appid': '1adcd7969603261753f1812c9461cd36',
                            'x-front-version': '2094',
                            'Sec-Fetch-Dest': 'empty',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Site': 'same-origin',
                            'x-sign': inswapXSign,
                            'x-ts': xTsInswapParam ? xTsInswapParam : xTsInswap.toString()
                        };

                        // ИСПРАВЛЕНИЕ: Убраны неиспользуемые запросы для оптимизации и снижения rate limiting:
                        // - fbPoolPromise: цены загружаются из CMC
                        // - fennecPoolPromise: цена FENNEC может быть из all_balance
                        // - addressUsdPromise: если all_balance не работает, это тоже не поможет
                        // ОПТИМИЗАЦИЯ: Убран brc20SelectPromise - используем только all_balance
                        // const brc20SelectPromise = null;

                        // ИСПРАВЛЕНИЕ: Пробуем оба варианта URL (новый и старый для обратной совместимости)
                        // Новый URL по документации: /v1/brc20-swap/all_balance (возвращает 404)
                        // Старый URL: /swap-v1/all_balance (работает)
                        const pubkey = url.searchParams.get('pubkey') || incomingPubKey || '';
                        const allBalanceUrlV1 = `${INSWAP_V1_URL}/all_balance?address=${address}`;
                        const allBalanceUrlOld = pubkey
                            ? `${INSWAP_URL}/all_balance?address=${address}&pubkey=${pubkey}`
                            : `${INSWAP_URL}/all_balance?address=${address}`;
                        debugInfo.all_balance_url = allBalanceUrlV1;
                        debugInfo.all_balance_url_old = allBalanceUrlOld;
                        debugInfo.all_balance_has_pubkey = !!pubkey;
                        // ОПТИМИЗАЦИЯ: Уменьшено количество попыток для ускорения (не критично для основной карточки)
                        const allBalancePromise = (async () => {
                            // ИСПРАВЛЕНИЕ: Увеличено до 5 для гарантированной загрузки данных
                            const retries = 5;
                            // ОПТИМИЗАЦИЯ: Уменьшена начальная задержка для ускорения загрузки
                            let delay = 2000; // 2 секунды начальная задержка (баланс между скоростью и 429 ошибками)
                            debugInfo.all_balance_retries_total = retries;
                            for (let attempt = 0; attempt < retries; attempt++) {
                                debugInfo.all_balance_current_attempt = attempt + 1;
                                try {
                                    // ИСПРАВЛЕНИЕ: Увеличиваем таймаут до 10 секунд для важных запросов
                                    const controller = new AbortController();
                                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                                    // Пробуем сначала новый URL, если 404 - используем старый
                                    let res = await fetch(allBalanceUrlV1, {
                                        method: 'GET',
                                        headers: inswapHeaders,
                                        signal: controller.signal
                                    });

                                    clearTimeout(timeoutId);
                                    if (!res.ok || res.status === 404) {
                                        debugInfo.all_balance_using_old_url = true;
                                        const controller2 = new AbortController();
                                        const timeoutId2 = setTimeout(() => controller2.abort(), 8000);
                                        res = await fetch(allBalanceUrlOld, {
                                            method: 'GET',
                                            headers: inswapHeaders,
                                            signal: controller2.signal
                                        });
                                        clearTimeout(timeoutId2);
                                    }
                                    // ИСПРАВЛЕНИЕ: Если 429 - ждем и повторяем с обработкой Retry-After
                                    if (res.status === 429) {
                                        debugInfo.all_balance_retry_attempt = attempt + 1;
                                        debugInfo.all_balance_retry_delay = delay;

                                        // Проверяем Retry-After заголовок
                                        const retryAfter = res.headers.get('Retry-After');
                                        if (retryAfter) {
                                            const retryAfterSeconds = parseInt(retryAfter, 10);
                                            if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                                                delay = Math.max(delay, retryAfterSeconds * 1000);
                                                debugInfo.all_balance_retry_after = retryAfterSeconds;
                                            }
                                        }

                                        if (attempt === retries - 1) {
                                            // Последняя попытка - возвращаем null
                                            debugInfo.all_balance_rate_limited = true;
                                            debugInfo.all_balance_raw_status = 429;
                                            debugInfo.all_balance_raw_statusText = 'Too Many Requests';
                                            return null;
                                        }
                                        await new Promise(r => setTimeout(r, delay));
                                        // ИСПРАВЛЕНИЕ: Exponential backoff 2, 4, 8, 16, 32 секунды
                                        delay = Math.min(delay * 2, 30000); // Exponential backoff: 2, 4, 8, 16, 30 секунд (макс, рекомендация UniSat)
                                        debugInfo.all_balance_next_delay = delay;
                                        continue;
                                    }
                                    if (res.ok) {
                                        const data = await res.json();
                                        debugInfo.all_balance_fetch_ok = true;
                                        debugInfo.all_balance_response_code = data?.code;
                                        debugInfo.all_balance_response_msg = data?.msg || data?.message;
                                        return data;
                                    } else {
                                        debugInfo.all_balance_raw_status = res.status;
                                        debugInfo.all_balance_raw_statusText = res.statusText;
                                        const errorText = await res.text().catch(() => '');
                                        debugInfo.all_balance_raw_error = errorText.substring(0, 200);
                                        return null;
                                    }
                                } catch (e) {
                                    // ИСПРАВЛЕНИЕ: Обрабатываем таймауты и другие ошибки
                                    if (e.name === 'AbortError') {
                                        debugInfo.all_balance_timeout = true;
                                        debugInfo.all_balance_fetch_error = 'Request timeout (8s)';
                                    } else {
                                        debugInfo.all_balance_fetch_error = e.message || 'unknown';
                                    }
                                    if (attempt === retries - 1) {
                                        debugInfo.all_balance_final_attempt = true;
                                        return null;
                                    }
                                    await new Promise(r => setTimeout(r, delay));
                                    // ИСПРАВЛЕНИЕ: Exponential backoff 2, 4, 8, 16, 32 секунды
                                    delay = Math.min(delay * 2, 30000); // Exponential backoff: 2, 4, 8, 16, 30 секунд (макс, рекомендация UniSat)
                                    debugInfo.all_balance_next_delay = delay;
                                }
                            }
                            debugInfo.all_balance_all_retries_exhausted = true;
                            return null;
                        })();

                        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: my_pool_list использует правильный путь по документации API
                        // По документации: /v1/brc20-swap/my_pool_list (БЕЗ /indexer/)
                        // Параметры: address (required), start (required), limit (required), tick (optional)
                        const myPoolListUrl = `${SWAP_BASE}/brc20-swap/my_pool_list?address=${address}&start=0&limit=10`;
                        debugInfo.my_pool_list_url = myPoolListUrl;
                        debugInfo.my_pool_list_auth_provided = !!API_KEY;
                        // ОПТИМИЗАЦИЯ: Увеличено количество попыток и задержки из backup версии
                        const myPoolListPromise = (async () => {
                            const retries = 3; // ИСПРАВЛЕНИЕ: Увеличено до 3 для надежности
                            let delay = 2000; // ОПТИМИЗАЦИЯ: Уменьшено до 2 секунд для ускорения загрузки
                            debugInfo.my_pool_list_retries_total = retries;
                            for (let attempt = 0; attempt < retries; attempt++) {
                                debugInfo.my_pool_list_current_attempt = attempt + 1;
                                try {
                                    // ИСПРАВЛЕНИЕ: Увеличиваем таймаут до 10 секунд для надежности (из backup)
                                    const controller = new AbortController();
                                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                                    const res = await fetch(myPoolListUrl, {
                                        headers: unisatApiHeaders,
                                        signal: controller.signal
                                    });

                                    clearTimeout(timeoutId);

                                    // ИСПРАВЛЕНИЕ: Если 429 - ждем и повторяем (из backup версии)
                                    if (res.status === 429) {
                                        debugInfo.my_pool_list_retry_attempt = attempt + 1;
                                        debugInfo.my_pool_list_retry_delay = delay;

                                        // ИСПРАВЛЕНИЕ: Проверяем Retry-After заголовок если он есть
                                        const retryAfter = res.headers.get('Retry-After');
                                        if (retryAfter) {
                                            const retryAfterSeconds = parseInt(retryAfter, 10);
                                            if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                                                delay = Math.max(delay, retryAfterSeconds * 1000);
                                                debugInfo.my_pool_list_retry_after = retryAfterSeconds;
                                            }
                                        }

                                        if (attempt === retries - 1) {
                                            // Последняя попытка - возвращаем null
                                            debugInfo.my_pool_list_rate_limited = true;
                                            debugInfo.my_pool_list_raw_status = 429;
                                            debugInfo.my_pool_list_raw_statusText = 'Too Many Requests';
                                            return null;
                                        }
                                        await new Promise(r => setTimeout(r, delay));
                                        // ИСПРАВЛЕНИЕ: Exponential backoff из backup: 5, 10, 15 секунд
                                        delay = Math.min(delay * 2, 30000); // Exponential backoff: 5, 10, 30 секунд (макс)
                                        debugInfo.my_pool_list_next_delay = delay;
                                        continue;
                                    }
                                    if (res.ok) {
                                        const data = await res.json();
                                        debugInfo.my_pool_list_fetch_ok = true;
                                        debugInfo.my_pool_list_response_code = data?.code;
                                        debugInfo.my_pool_list_response_msg = data?.msg || data?.message;
                                        return data;
                                    } else {
                                        debugInfo.my_pool_list_raw_status = res.status;
                                        debugInfo.my_pool_list_raw_statusText = res.statusText;
                                        const errorText = await res.text().catch(() => '');
                                        debugInfo.my_pool_list_raw_error = errorText.substring(0, 500);
                                        if (res.status === 403 && !API_KEY) {
                                            debugInfo.my_pool_list_auth_required = true;
                                        }
                                        return null;
                                    }
                                } catch (e) {
                                    // ИСПРАВЛЕНИЕ: Обрабатываем таймауты и другие ошибки
                                    if (e.name === 'AbortError') {
                                        debugInfo.my_pool_list_timeout = true;
                                        debugInfo.my_pool_list_fetch_error = 'Request timeout (8s)';
                                    } else {
                                        debugInfo.my_pool_list_fetch_error = e.message || 'unknown';
                                    }
                                    if (attempt === retries - 1) {
                                        debugInfo.my_pool_list_final_attempt = true;
                                        return null;
                                    }
                                    await new Promise(r => setTimeout(r, delay));
                                    // ИСПРАВЛЕНИЕ: Exponential backoff из backup: 5, 10, 15 секунд
                                    delay = Math.min(delay * 2, 30000); // Exponential backoff: 5, 10, 30 секунд (макс)
                                    debugInfo.my_pool_list_next_delay = delay;
                                }
                            }
                            debugInfo.my_pool_list_all_retries_exhausted = true;
                            return null;
                        })();

                        // ОПТИМИЗАЦИЯ: Выполняем 4-5 основных запросов с небольшими задержками (100-200ms) для предотвращения 429
                        console.log('📊 Loading data with optimized UniSat Open API (4-5 requests)...');

                        // ИСПРАВЛЕНИЕ: Увеличиваем интервалы между запросами для предотвращения 429 ошибок
                        // Из backup версии: использовались большие интервалы (10 секунд для all_balance)
                        // Компромисс: 500ms между UniSat запросами, 2 секунды перед InSwap

                        // ОПТИМИЗАЦИЯ: Выполняем запросы параллельно для ускорения (из кода Gemini)
                        // 0. ПРИОРИТЕТ: Uniscan Summary API (один "жирный" эндпоинт)
                        console.log('📊 [0/7] Loading Uniscan Summary (priority)...');
                        let uniscanSummary = null;
                        try {
                            uniscanSummary = await uniscanSummaryPromise;
                            debugInfo.uniscan_summary_loaded = !!uniscanSummary;
                            debugInfo.uniscan_summary_code = uniscanSummary?.code;
                            debugInfo.uniscan_summary_msg = uniscanSummary?.msg;
                        } catch (e) {
                            debugInfo.uniscan_summary_error = e.message;
                            debugInfo.uniscan_summary_loaded = false;
                        }
                        await new Promise(r => setTimeout(r, 120));

                        // 1-5. UniSat API запросы (параллельно)
                        console.log('📊 [1-5/7] Loading UniSat APIs in parallel...');
                        const [
                            unisatBalance,
                            unisatBrc20Summary,
                            unisatHistory,
                            unisatRunes,
                            unisatSummary,
                            unisatAbandonNftUtxo
                        ] = await Promise.all([
                            unisatBalancePromise,
                            unisatBrc20SummaryPromise,
                            unisatHistoryPromise,
                            unisatRunesPromise,
                            unisatSummaryPromise,
                            unisatAbandonNftUtxoPromise
                        ]);
                        await new Promise(r => setTimeout(r, 120));

                        // 6. InSwap All Balance API - все токены с балансами и ценами в USD
                        console.log('💱 [6/7] Loading InSwap All Balance...');
                        let allBalance = null;
                        try {
                            allBalance = await allBalancePromise;
                        } catch (e) {
                            debugInfo.all_balance_error = e.message;
                        }
                        await new Promise(r => setTimeout(r, 120));

                        // 7. НОВЫЙ: InSwap Asset Summary API - LP данные из модуля свапа (из кода Gemini)
                        console.log('💱 [7/7] Loading InSwap Asset Summary (LP)...');
                        let inswapAssetSummary = null;
                        try {
                            inswapAssetSummary = await inswapAssetSummaryPromise;
                        } catch (e) {
                            debugInfo.inswap_asset_summary_error = e.message;
                        }

                        // ИСПРАВЛЕНИЕ: Загружаем данные параллельно (как в backup версии)
                        // 1. Критичные данные (базовые) - загружаем первыми параллельно
                        const [mempool, utxoList] = await Promise.all([mempoolPromise, utxoListPromise]);

                        // ИСПРАВЛЕНИЕ: Инициализируем txCount ДО использования, получаем из mempool
                        let txCount = 0;
                        if (mempool) {
                            let c = {},
                                m = {};
                            if (mempool.chain_stats || mempool.mempool_stats) {
                                c = mempool.chain_stats || {};
                                m = mempool.mempool_stats || {};
                            }
                            txCount = Number(c.tx_count || 0) + Number(m.tx_count || 0);
                        }

                        // Получаем txCount для genesis запроса (ПРИОРИТЕТ: Mempool, затем Uniscan Summary, затем UniSat History)
                        let txCountForOffset = txCount;
                        let genesisTxPromise = null;

                        // ИСПРАВЛЕНИЕ: Используем txCount из mempool как приоритетный источник (он уже загружен)
                        if (txCount > 0) {
                            txCountForOffset = txCount;
                            debugInfo.genesis_txCount_source = 'mempool_stats';
                        } else if (uniscanSummary?.data) {
                            txCountForOffset = Number(
                                uniscanSummary.data.totalTransactionCount || uniscanSummary.data.tx_count || 0
                            );
                            txCount = txCountForOffset; // Сохраняем для дальнейшего использования
                            debugInfo.genesis_txCount_source = 'uniscan_summary';
                        } else if (unisatHistory?.data?.total) {
                            txCountForOffset = unisatHistory.data.total;
                            txCount = txCountForOffset; // Сохраняем для дальнейшего использования
                            debugInfo.genesis_txCount_source = 'unisat_history';
                        }

                        // КРИТИЧЕСКОЕ: Получаем первую транзакцию используя total из history
                        // ИСПРАВЛЕНИЕ: Если txCountForOffset = 0, пробуем start=0&limit=100
                        // ИСПРАВЛЕНИЕ: Всегда пробуем запросить первую транзакцию, даже если txCount = 0
                        if (txCountForOffset > 0 || txCount > 0 || true) {
                            genesisTxPromise = (async () => {
                                try {
                                    const controller = new AbortController();
                                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                                    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем правильные параметры cursor и size (по документации API)
                                    // UniSat History API возвращает транзакции отсортированные от новых к старым
                                    // Поэтому cursor=total-1&size=1 даст самую первую (самую старую) транзакцию
                                    // ИСПРАВЛЕНИЕ: Если txCountForOffset = 0, используем cursor=0&size=100 и берем последний элемент
                                    let cursor, size;
                                    if (txCountForOffset > 0) {
                                        cursor = Math.max(0, txCountForOffset - 1);
                                        size = 1;
                                    } else {
                                        // Fallback: если txCountForOffset = 0, пробуем cursor=0&size=100
                                        cursor = 0;
                                        size = 100;
                                    }

                                    const res = await fetch(
                                        `${FRACTAL_BASE}/indexer/address/${address}/history?cursor=${cursor}&size=${size}`,
                                        { headers: upstreamHeaders, signal: controller.signal }
                                    );

                                    clearTimeout(timeoutId);

                                    if (res.ok) {
                                        const data = await res.json();
                                        if (
                                            data?.data?.detail &&
                                            Array.isArray(data.data.detail) &&
                                            data.data.detail.length > 0
                                        ) {
                                            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем правильные параметры cursor и size
                                            // Если size=1, cursor=total-1 дает самую первую транзакцию, берем первый элемент
                                            // Если size=100, берем последний элемент (самая старая транзакция)
                                            const tx =
                                                size === 1
                                                    ? data.data.detail[0]
                                                    : data.data.detail[data.data.detail.length - 1];

                                            const txTs =
                                                tx.timestamp ||
                                                tx.blocktime ||
                                                tx.time ||
                                                (tx.blockTime ? Math.floor(tx.blockTime / 1000) : 0);
                                            const now = Math.floor(Date.now() / 1000);
                                            const MIN_VALID = 1700000000;

                                            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Строгая валидация timestamp - не может быть в будущем
                                            // Проверяем год, месяц и день ДО использования timestamp
                                            const currentDate = new Date();
                                            const currentYear = currentDate.getFullYear();
                                            const currentMonth = currentDate.getMonth();
                                            const currentDay = currentDate.getDate();

                                            const timestampDate = txTs > 0 ? new Date(txTs * 1000) : null;
                                            const timestampYear = timestampDate ? timestampDate.getFullYear() : 0;
                                            const timestampMonth = timestampDate ? timestampDate.getMonth() : 0;
                                            const timestampDay = timestampDate ? timestampDate.getDate() : 0;

                                            const isFutureYear = timestampYear > currentYear;
                                            const isFutureMonth =
                                                timestampYear === currentYear && timestampMonth > currentMonth;
                                            const isFutureDay =
                                                timestampYear === currentYear &&
                                                timestampMonth === currentMonth &&
                                                timestampDay > currentDay;
                                            const isFuture = isFutureYear || isFutureMonth || isFutureDay;

                                            if (txTs > 0 && txTs >= MIN_VALID && txTs <= now && !isFuture) {
                                                debugInfo.genesis_tx_found = true;
                                                debugInfo.genesis_tx_cursor_used = cursor;
                                                debugInfo.genesis_tx_timestamp = txTs;
                                                return {
                                                    data: {
                                                        detail: [
                                                            {
                                                                txid: tx.txid || tx.hash || '',
                                                                timestamp: txTs,
                                                                blocktime: txTs,
                                                                time: txTs,
                                                                ...tx
                                                            }
                                                        ]
                                                    }
                                                };
                                            } else {
                                                debugInfo.genesis_tx_invalid_timestamp = txTs;
                                            }
                                        } else {
                                            // Если cursor=total-1 не сработал, пробуем cursor=0 и берем последний элемент
                                            if (cursor > 0) {
                                                debugInfo.genesis_tx_retry_with_cursor_0 = true;
                                                const res0 = await fetch(
                                                    `${FRACTAL_BASE}/indexer/address/${address}/history?cursor=0&size=100`,
                                                    { headers: upstreamHeaders, signal: controller.signal }
                                                );
                                                if (res0.ok) {
                                                    const data0 = await res0.json();
                                                    if (
                                                        data0?.data?.detail &&
                                                        Array.isArray(data0.data.detail) &&
                                                        data0.data.detail.length > 0
                                                    ) {
                                                        // Берем последний элемент (самая старая транзакция)
                                                        const oldestTx =
                                                            data0.data.detail[data0.data.detail.length - 1];
                                                        const txTs =
                                                            oldestTx.timestamp ||
                                                            oldestTx.blocktime ||
                                                            oldestTx.time ||
                                                            (oldestTx.blockTime
                                                                ? Math.floor(oldestTx.blockTime / 1000)
                                                                : 0);
                                                        const now = Math.floor(Date.now() / 1000);
                                                        const MIN_VALID = 1700000000;

                                                        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Строгая валидация timestamp - не может быть в будущем
                                                        const currentDate = new Date();
                                                        const currentYear = currentDate.getFullYear();
                                                        const currentMonth = currentDate.getMonth();
                                                        const currentDay = currentDate.getDate();

                                                        const timestampDate = txTs > 0 ? new Date(txTs * 1000) : null;
                                                        const timestampYear = timestampDate
                                                            ? timestampDate.getFullYear()
                                                            : 0;
                                                        const timestampMonth = timestampDate
                                                            ? timestampDate.getMonth()
                                                            : 0;
                                                        const timestampDay = timestampDate
                                                            ? timestampDate.getDate()
                                                            : 0;

                                                        const isFutureYear = timestampYear > currentYear;
                                                        const isFutureMonth =
                                                            timestampYear === currentYear &&
                                                            timestampMonth > currentMonth;
                                                        const isFutureDay =
                                                            timestampYear === currentYear &&
                                                            timestampMonth === currentMonth &&
                                                            timestampDay > currentDay;
                                                        const isFuture = isFutureYear || isFutureMonth || isFutureDay;

                                                        if (txTs > 0 && txTs >= MIN_VALID && txTs <= now && !isFuture) {
                                                            debugInfo.genesis_tx_found_via_cursor_0 = true;
                                                            debugInfo.genesis_tx_timestamp = txTs;
                                                            return {
                                                                data: {
                                                                    detail: [
                                                                        {
                                                                            txid: oldestTx.txid || oldestTx.hash || '',
                                                                            timestamp: txTs,
                                                                            blocktime: txTs,
                                                                            time: txTs,
                                                                            ...oldestTx
                                                                        }
                                                                    ]
                                                                }
                                                            };
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } catch (e) {
                                    debugInfo.genesis_error = e.message;
                                }
                                return null;
                            })();
                        }

                        // Получаем первую транзакцию (genesis)
                        let genesisTxData = null;
                        if (genesisTxPromise) {
                            try {
                                genesisTxData = await genesisTxPromise;
                            } catch (e) {
                                debugInfo.genesis_error = e.message;
                            }
                        }

                        // 2. Цены и история - загружаем параллельно (не критично для rate limiting)
                        // const cg = null; // Убран CoinGecko - цены получаем из InSwap all_balance
                        const historyData = await unisatHistoryPromise;

                        // 3. Runes, BRC-20 и Ordinals - загружаем параллельно
                        const [runesBalanceList, brc20Data, ordinalsInscriptionData] = await Promise.all([
                            unisatRunesPromise,
                            unisatBrc20SummaryPromise,
                            unisatBalancePromise // Используем balance для ordinals count
                        ]);
                        const runesData = null; // Не используется
                        const ordinalsData = null; // Не используется

                        // 4. InSwap данные - ОПТИМИЗАЦИЯ: пропускаем если rate limited, используем только если критично
                        let brc20Select = null;
                        let myPoolList = null;

                        // ИСПРАВЛЕНИЕ: brc20SelectPromise не определен, пропускаем его использование
                        // brc20Select не критичен - пропускаем если долго
                        brc20Select = null; // ИСПРАВЛЕНИЕ: brc20SelectPromise не определен, устанавливаем null

                        // ОПТИМИЗАЦИЯ: allBalance и myPoolList выполняются последовательно (независимые запросы)
                        // ИСПРАВЛЕНИЕ: Последовательное выполнение для снижения rate limiting
                        try {
                            // Сначала загружаем allBalance, потом myPoolList
                            allBalance = await Promise.race([
                                allBalancePromise,
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
                            ]).catch(() => null);

                            // Задержка между запросами для снижения rate limiting
                            await new Promise(r => setTimeout(r, 2000));

                            myPoolList = await Promise.race([
                                myPoolListPromise,
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
                            ]).catch(() => null);
                        } catch (e) {
                            // Игнорируем ошибки
                        }

                        const summaryData = null; // Отключен

                        // ИСПРАВЛЕНИЕ: Последовательное выполнение запросов для снижения rate limiting
                        // ОПТИМИЗАЦИЯ: Выполняем запросы последовательно для снижения 429 ошибок (рекомендация UniSat)
                        debugInfo.all_balance_parallel = false;
                        debugInfo.my_pool_list_parallel = false;
                        debugInfo.sequential_execution = true;

                        // Сначала загружаем allBalance, потом myPoolList
                        debugInfo.summary_has_data = false; // summary отключен
                        debugInfo.summary_txCount = 0;
                        debugInfo.summary_firstTxTime = 'disabled';
                        debugInfo.summary_structure = 'disabled';
                        debugInfo.genesis_tx_has_data = !!genesisTxData;
                        debugInfo.genesis_tx_method = genesisTxPromise ? 'offset_based' : 'not_attempted';
                        debugInfo.genesis_txCount_for_offset = txCountForOffset;
                        debugInfo.genesis_txCount_source = txCountForOffset > 0 ? 'mempool_early' : 'none';
                        // ИСПРАВЛЕНИЕ: Убраны debug для fbPool - запрос удален для оптимизации
                        debugInfo.all_balance_has_data = !!allBalance?.data;
                        debugInfo.all_balance_structure = allBalance
                            ? typeof allBalance === 'object'
                                ? Object.keys(allBalance)
                                : typeof allBalance
                            : 'null';
                        debugInfo.all_balance_code = allBalance?.code;
                        debugInfo.all_balance_msg = allBalance?.msg;
                        debugInfo.all_balance_sFB_price = allBalance?.data?.sFB___000?.price || 'not found';
                        debugInfo.all_balance_FENNEC_price = allBalance?.data?.FENNEC?.price || 'not found';
                        debugInfo.all_balance_keys = allBalance?.data ? Object.keys(allBalance.data) : 'no data';
                        // all_balance_url, all_balance_has_pubkey, all_balance_fetch_ok, all_balance_fetch_error уже установлены выше
                        debugInfo.fbPool_method = 'pool_info'; // Будет обновлено позже
                        // ИСПРАВЛЕНИЕ: Убраны debug для lp (user_positions) - не используется, оптимизация
                        // debugInfo.lp_has_data = !!lp?.data;
                        // debugInfo.lp_list_length = lp?.data?.list?.length || 0;
                        // debugInfo.lp_code = lp?.code;
                        // debugInfo.lp_msg = lp?.msg;
                        debugInfo.my_pool_list_has_data = !!myPoolList?.data;
                        debugInfo.my_pool_list_structure = myPoolList
                            ? typeof myPoolList === 'object'
                                ? Object.keys(myPoolList)
                                : typeof myPoolList
                            : 'null';
                        debugInfo.my_pool_list_length = myPoolList?.data?.list?.length || 0;
                        debugInfo.my_pool_list_code = myPoolList?.code;
                        debugInfo.my_pool_list_msg = myPoolList?.msg || myPoolList?.message;
                        debugInfo.my_pool_list_data_keys = myPoolList?.data ? Object.keys(myPoolList.data) : 'no data';
                        // my_pool_list_url, my_pool_list_fetch_ok, my_pool_list_fetch_error, my_pool_list_response_code, my_pool_list_response_msg уже установлены выше
                        debugInfo.mempool_has_data = !!mempool;
                        debugInfo.mempool_structure = mempool ? Object.keys(mempool) : 'null';
                        debugInfo.mempool_chain_stats = mempool?.chain_stats
                            ? Object.keys(mempool.chain_stats)
                            : 'null';
                        debugInfo.mempool_mempool_stats = mempool?.mempool_stats
                            ? Object.keys(mempool.mempool_stats)
                            : 'null';
                        debugInfo.runes_data_structure = runesBalanceList
                            ? typeof runesBalanceList === 'object'
                                ? Object.keys(runesBalanceList)
                                : typeof runesBalanceList
                            : 'null';
                        // ИСПРАВЛЕНИЕ: Убраны debug для неиспользуемых runes fallback методов (оптимизация)
                        // debugInfo.runes_utxo_list_structure = runesUtxoList ? (typeof runesUtxoList === 'object' ? Object.keys(runesUtxoList) : typeof runesUtxoList) : 'null';
                        // debugInfo.runes_summary_structure = runesSummary ? (typeof runesSummary === 'object' ? Object.keys(runesSummary) : typeof runesSummary) : 'null';
                        // ИСПРАВЛЕНИЕ: Убираем строку "null", используем реальный null или не добавляем поле
                        if (ordinalsData) {
                            debugInfo.ordinals_data_structure =
                                typeof ordinalsData === 'object' ? Object.keys(ordinalsData) : typeof ordinalsData;
                        }
                        // ИСПРАВЛЕНИЕ: Убран debug для ordinalsInscriptions (не используется, оптимизация)
                        // ИСПРАВЛЕНИЕ: Убираем строку "null", используем реальный null или не добавляем поле
                        if (ordinalsData !== null && ordinalsData !== undefined) {
                            debugInfo.ordinals_utxo_promise_result = 'has_data';
                        }
                        // debugInfo.ordinals_inscriptions_promise_result = ordinalsInscriptions === null ? 'null' : (ordinalsInscriptions === undefined ? 'undefined' : 'has_data');
                        debugInfo.ordinals_inscription_data_promise_result =
                            ordinalsInscriptionData === null
                                ? 'null'
                                : ordinalsInscriptionData === undefined
                                  ? 'undefined'
                                  : 'has_data';
                        debugInfo.utxo_list_type = utxoList
                            ? Array.isArray(utxoList)
                                ? 'array'
                                : typeof utxoList
                            : 'null';
                        debugInfo.utxo_list_length = Array.isArray(utxoList)
                            ? utxoList.length
                            : utxoList?.data && Array.isArray(utxoList.data)
                              ? utxoList.data.length
                              : 0;

                        // ИСПРАВЛЕНИЕ: Убраны все fallback механизмы - используем только основной метод
                        // Если данные не загрузились, это будет видно в debug
                        const finalGenesisTxData = genesisTxData;

                        // ИСПРАВЛЕНИЕ: Инициализируем переменные ДО использования
                        // txCount уже объявлен выше для genesis запроса
                        let utxoCount = 0; // КРИТИЧЕСКИ ВАЖНО: инициализируем до использования в debugInfo и проверках
                        let nativeBalance = 0;

                        // ИСПРАВЛЕНИЕ: Используем данные из Mempool Fractal API (приоритет) и UniSat Open API (fallback)
                        // 1. UTXO Count - используем прямой запрос /utxo из Mempool (ПРИОРИТЕТ)
                        if (utxoList) {
                            if (Array.isArray(utxoList)) {
                                utxoCount = utxoList.length;
                                debugInfo.utxo_method = 'mempool_direct_array';
                            } else if (utxoList.data && Array.isArray(utxoList.data)) {
                                utxoCount = utxoList.data.length;
                                debugInfo.utxo_method = 'mempool_direct_data_array';
                            } else if (utxoList.list && Array.isArray(utxoList.list)) {
                                utxoCount = utxoList.list.length;
                                debugInfo.utxo_method = 'mempool_direct_list_array';
                            }
                        }

                        // Альтернативный метод: если прямой запрос не сработал, используем расчет через stats из Mempool
                        if (utxoCount === 0 && mempool) {
                            let c = {},
                                m = {};

                            if (mempool.chain_stats || mempool.mempool_stats) {
                                c = mempool.chain_stats || {};
                                m = mempool.mempool_stats || {};
                            } else if (mempool.funded_txo_count !== undefined) {
                                c = mempool;
                                m = {};
                            } else if (mempool.data) {
                                c = mempool.data.chain_stats || mempool.data || {};
                                m = mempool.data.mempool_stats || {};
                            }

                            const hasChainStats = c && (c.funded_txo_count !== undefined || c.tx_count !== undefined);
                            const hasMempoolStats = m && (m.funded_txo_count !== undefined || m.tx_count !== undefined);

                            if (hasChainStats || hasMempoolStats) {
                                const chainFunded = Number(c.funded_txo_count || 0);
                                const chainSpent = Number(c.spent_txo_count || 0);
                                const mempoolFunded = Number(m.funded_txo_count || 0);
                                const mempoolSpent = Number(m.spent_txo_count || 0);

                                const funded = chainFunded + mempoolFunded;
                                const spent = chainSpent + mempoolSpent;
                                utxoCount = Math.max(0, funded - spent);

                                debugInfo.utxo_method = 'mempool_calculated_from_stats';
                                debugInfo.mempool_chain_funded = chainFunded;
                                debugInfo.mempool_chain_spent = chainSpent;
                                debugInfo.mempool_mempool_funded = mempoolFunded;
                                debugInfo.mempool_mempool_spent = mempoolSpent;
                                debugInfo.mempool_calculated_funded = funded;
                                debugInfo.mempool_calculated_spent = spent;
                            }

                            txCount = Number(c.tx_count || 0) + Number(m.tx_count || 0);
                            const fundedSum = Number(c.funded_txo_sum || 0) + Number(m.funded_txo_sum || 0);
                            const spentSum = Number(c.spent_txo_sum || 0) + Number(m.spent_txo_sum || 0);
                            nativeBalance = Math.max(0, (fundedSum - spentSum) / 1e8);
                        } else if (mempool) {
                            // Если UTXO получили через прямой запрос, все равно берем tx_count и balance из stats
                            let c = {},
                                m = {};
                            if (mempool.chain_stats || mempool.mempool_stats) {
                                c = mempool.chain_stats || {};
                                m = mempool.mempool_stats || {};
                            }
                            txCount = Number(c.tx_count || 0) + Number(m.tx_count || 0);
                            const fundedSum = Number(c.funded_txo_sum || 0) + Number(m.funded_txo_sum || 0);
                            const spentSum = Number(c.spent_txo_sum || 0) + Number(m.spent_txo_sum || 0);
                            nativeBalance = Math.max(0, (fundedSum - spentSum) / 1e8);
                        }

                        // Fallback: UniSat Balance API (если Mempool не работает)
                        if (utxoCount === 0 && unisatBalance?.data) {
                            utxoCount = Number(unisatBalance.data.utxoCount || 0);
                            debugInfo.utxo_method = 'unisat_balance_fallback';
                        }
                        if (nativeBalance === 0 && unisatBalance?.data) {
                            nativeBalance = parseFloat(unisatBalance.data.satoshi || 0) / 100000000; // Конвертируем satoshi в BTC
                            debugInfo.native_balance_source = 'unisat_balance_fallback';
                        } else if (nativeBalance > 0) {
                            debugInfo.native_balance_source = 'mempool_stats';
                        }
                        debugInfo.utxo_count_source = debugInfo.utxo_method || 'unknown';
                        debugInfo.ordinals_count_from_balance = Number(unisatBalance?.data?.inscriptionUtxoCount || 0);

                        // 2. History API - total транзакций (ПРИОРИТЕТ: Uniscan Summary, fallback: UniSat History)
                        if (uniscanSummary?.data) {
                            txCount = Number(
                                uniscanSummary.data.totalTransactionCount || uniscanSummary.data.tx_count || 0
                            );
                            debugInfo.tx_count_source = 'uniscan_summary';
                        } else if (unisatHistory?.data?.total) {
                            txCount = Number(unisatHistory.data.total);
                            debugInfo.tx_count_source = 'unisat_history';
                        } else if (unisatHistory?.data) {
                            // Fallback: проверяем другие возможные поля
                            txCount = Number(unisatHistory.data.total || unisatHistory.data.count || 0);
                            debugInfo.tx_count_source = 'unisat_history_fallback';
                            debugInfo.tx_count_debug = Object.keys(unisatHistory.data);
                        } else {
                            // ИСПРАВЛЕНИЕ: Если history не загрузился, пробуем запросить отдельно для получения total
                            debugInfo.tx_count_source = 'fallback_attempt';
                            debugInfo.tx_count_error = 'History API not loaded - will try to fetch total separately';
                            try {
                                // ИСПРАВЛЕНИЕ: Используем правильные параметры cursor и size (по документации API)
                                const historyRes = await fetch(
                                    `${FRACTAL_BASE}/indexer/address/${address}/history?cursor=0&size=1`,
                                    {
                                        headers: upstreamHeaders
                                    }
                                );
                                if (historyRes.ok) {
                                    const historyData = await historyRes.json();
                                    if (historyData?.data?.total) {
                                        txCount = Number(historyData.data.total);
                                        debugInfo.tx_count_source = 'fallback_separate_request';
                                    }
                                }
                            } catch (e) {
                                debugInfo.tx_count_fallback_error = e.message;
                            }
                        }

                        // 3. BRC-20 Summary API - количество BRC-20 токенов (кошелек + InSwap)
                        // ИСПРАВЛЕНИЕ: Считаем BRC-20 и на кошельке, и в InSwap (объединяем)
                        let brc20Count = 0;
                        const walletBrc20Tickers = new Set();
                        const inswapBrc20Tickers = new Set();

                        // BRC-20 на кошельке (UniSat)
                        // ИСПРАВЛЕНИЕ: Поддерживаем разные структуры ответа (brc20-prog и brc20)
                        if (unisatBrc20Summary?.data) {
                            let tokensList = [];

                            // Проверяем разные возможные структуры ответа
                            if (unisatBrc20Summary.data.detail && Array.isArray(unisatBrc20Summary.data.detail)) {
                                tokensList = unisatBrc20Summary.data.detail;
                            } else if (unisatBrc20Summary.data.list && Array.isArray(unisatBrc20Summary.data.list)) {
                                tokensList = unisatBrc20Summary.data.list;
                            } else if (Array.isArray(unisatBrc20Summary.data)) {
                                tokensList = unisatBrc20Summary.data;
                            }

                            if (tokensList.length > 0) {
                                // ИСПРАВЛЕНИЕ: Считаем ВСЕ токены из detail, даже с балансом 0 (например, MULTIBIT)
                                // Это важно для правильного подсчета общего количества BRC-20 токенов
                                tokensList.forEach(t => {
                                    const ticker = (t.ticker || t.tick || t.symbol || '').toUpperCase();
                                    if (ticker) {
                                        // ИСПРАВЛЕНИЕ: Добавляем все токены, не только с балансом > 0
                                        // Это нужно для правильного подсчета (например, MULTIBIT может быть с балансом 0)
                                        walletBrc20Tickers.add(ticker);
                                    }
                                });
                                debugInfo.brc20_wallet_count = walletBrc20Tickers.size;
                                debugInfo.brc20_count_source = 'unisat_brc20_summary_wallet';
                                debugInfo.brc20_data_exists = true;
                                debugInfo.brc20_data_structure =
                                    tokensList.length > 0 ? Object.keys(tokensList[0]) : 'empty';
                                debugInfo.brc20_detail_length = tokensList.length;
                                // ИСПРАВЛЕНИЕ: Считаем токены с балансом > 0 отдельно для отладки
                                const tokensWithBalance = tokensList.filter(t => {
                                    const bal =
                                        parseFloat(t.availableBalance || t.balance || 0) +
                                        parseFloat(t.transferableBalance || 0);
                                    return bal > 0;
                                });
                                debugInfo.brc20_with_balance = tokensWithBalance.length;
                            } else {
                                debugInfo.brc20_wallet_count = 0;
                                debugInfo.brc20_data_exists = false;
                                debugInfo.brc20_data_error = 'BRC-20 summary data exists but no tokens list found';
                            }
                        } else {
                            // ИСПРАВЛЕНИЕ: Fallback для BRC-20 с кошелька - если summary не загрузился, пробуем запросить отдельно
                            debugInfo.brc20_wallet_count = 0;
                            debugInfo.brc20_wallet_error =
                                'BRC-20 summary not loaded from UniSat API, will try separate request';
                            // Пробуем запросить BRC-20 отдельно
                            // ИСПРАВЛЕНИЕ: Пробуем сначала brc20-prog/summary, затем brc20/summary
                            try {
                                let brc20Res = await fetch(
                                    `${FRACTAL_BASE}/indexer/address/${address}/brc20-prog/summary?start=0&limit=500`,
                                    {
                                        headers: upstreamHeaders
                                    }
                                );

                                // Fallback: если brc20-prog не работает, пробуем brc20/summary
                                if (!brc20Res.ok || brc20Res.status === 404) {
                                    brc20Res = await fetch(
                                        `${FRACTAL_BASE}/indexer/address/${address}/brc20/summary?start=0&limit=100`,
                                        {
                                            headers: upstreamHeaders
                                        }
                                    );
                                }

                                if (brc20Res.ok) {
                                    const brc20Data = await brc20Res.json();
                                    // ИСПРАВЛЕНИЕ: brc20-prog/summary может иметь другую структуру данных
                                    // Проверяем разные возможные структуры ответа
                                    let tokensList = [];

                                    if (brc20Data?.data?.detail && Array.isArray(brc20Data.data.detail)) {
                                        tokensList = brc20Data.data.detail;
                                    } else if (brc20Data?.data?.list && Array.isArray(brc20Data.data.list)) {
                                        tokensList = brc20Data.data.list;
                                    } else if (brc20Data?.data && Array.isArray(brc20Data.data)) {
                                        tokensList = brc20Data.data;
                                    } else if (Array.isArray(brc20Data)) {
                                        tokensList = brc20Data;
                                    }

                                    if (tokensList.length > 0) {
                                        // ИСПРАВЛЕНИЕ: Считаем ВСЕ токены из detail, даже с балансом 0 (например, MULTIBIT)
                                        tokensList.forEach(t => {
                                            const ticker = (t.ticker || t.tick || t.symbol || '').toUpperCase();
                                            if (ticker) {
                                                // ИСПРАВЛЕНИЕ: Добавляем все токены, не только с балансом > 0
                                                walletBrc20Tickers.add(ticker);
                                            }
                                        });
                                        debugInfo.brc20_wallet_count = walletBrc20Tickers.size;
                                        debugInfo.brc20_count_source = 'fallback_separate_request';
                                        debugInfo.brc20_fallback_api_used = brc20Res.url.includes('brc20-prog')
                                            ? 'brc20_prog'
                                            : 'brc20';
                                        debugInfo.brc20_fallback_structure =
                                            tokensList.length > 0 ? Object.keys(tokensList[0]) : 'empty';
                                    }
                                }
                            } catch (e) {
                                debugInfo.brc20_wallet_fallback_error = e.message;
                            }
                        }

                        // BRC-20 в InSwap (из all_balance)
                        // ИСПРАВЛЕНИЕ: Учитываем ВСЕ токены из all_balance, включая sFB
                        if (allBalance?.data) {
                            Object.keys(allBalance.data).forEach(key => {
                                if (['lp_positions', 'positions', 'total_usd'].includes(key)) return;
                                const tokenData = allBalance.data[key];
                                if (typeof tokenData !== 'object' || !tokenData) return;
                                const bal = tokenData.balance || tokenData;
                                let balance = 0;
                                if (typeof bal === 'object' && bal !== null) {
                                    balance = parseFloat(
                                        bal.swap || bal.module || bal.pendingSwap || bal.pendingAvailable || 0
                                    );
                                } else {
                                    balance = parseFloat(bal || 0);
                                }
                                if (balance > 0) {
                                    // ИСПРАВЛЕНИЕ: Нормализуем тикер (убираем ___000, приводим к верхнему регистру)
                                    const ticker = key.replace(/___\d+$/, '').toUpperCase();
                                    if (ticker) {
                                        inswapBrc20Tickers.add(ticker);
                                        debugInfo[`brc20_inswap_${ticker}`] = balance;
                                    }
                                }
                            });
                            debugInfo.brc20_inswap_count = inswapBrc20Tickers.size;
                            debugInfo.brc20_inswap_tickers = Array.from(inswapBrc20Tickers);
                        }

                        // ИСПРАВЛЕНИЕ: Объединяем: кошелек + InSwap (уникальные тикеры)
                        // КРИТИЧЕСКОЕ: Нормализуем тикеры перед объединением (как в backup версии)
                        // normalizeTicker уже объявлена выше

                        // Нормализуем тикеры из кошелька
                        const normalizedWalletTickers = new Set();
                        walletBrc20Tickers.forEach(t => {
                            const normalized = normalizeTicker(t);
                            if (normalized) normalizedWalletTickers.add(normalized);
                        });

                        // Нормализуем тикеры из InSwap и добавляем только те, которых нет в кошельке
                        const inswapAddedTickers = [];
                        const inswapSkippedTickers = [];
                        inswapBrc20Tickers.forEach(t => {
                            const normalized = normalizeTicker(t);
                            if (normalized) {
                                if (!normalizedWalletTickers.has(normalized)) {
                                    normalizedWalletTickers.add(normalized);
                                    inswapAddedTickers.push({ original: t, normalized });
                                } else {
                                    inswapSkippedTickers.push({ original: t, normalized, reason: 'already_in_wallet' });
                                }
                            }
                        });

                        brc20Count = normalizedWalletTickers.size;
                        debugInfo.brc20_count_total = brc20Count;
                        debugInfo.brc20_count_combined = true;
                        debugInfo.brc20_final_list = Array.from(normalizedWalletTickers).sort();
                        debugInfo.brc20_wallet_tickers_raw = Array.from(walletBrc20Tickers).map(t => ({
                            raw: t,
                            normalized: normalizeTicker(t)
                        }));
                        // ИСПРАВЛЕНИЕ: Сохраняем нормализованные тикеры из кошелька ДО добавления InSwap
                        const walletNormalizedBeforeInSwap = Array.from(normalizedWalletTickers).sort();
                        debugInfo.brc20_wallet_tickers_normalized = walletNormalizedBeforeInSwap;
                        debugInfo.brc20_wallet_tickers_normalized_count = walletNormalizedBeforeInSwap.length;
                        debugInfo.brc20_inswap_tickers_raw = Array.from(inswapBrc20Tickers).sort();
                        debugInfo.brc20_inswap_added_tickers = inswapAddedTickers;
                        debugInfo.brc20_inswap_skipped_tickers = inswapSkippedTickers;
                        debugInfo.brc20_wallet_count_before_normalize = walletBrc20Tickers.size;
                        debugInfo.brc20_inswap_count_before_normalize = inswapBrc20Tickers.size;

                        // ИСПРАВЛЕНИЕ: Добавляем детальную информацию о всех токенах из all_balance для отладки
                        if (allBalance?.data) {
                            const allCheckedTickers = [];
                            Object.keys(allBalance.data).forEach(key => {
                                if (['lp_positions', 'positions', 'total_usd'].includes(key)) return;
                                const tokenData = allBalance.data[key];
                                if (typeof tokenData !== 'object' || !tokenData) return;
                                const bal = tokenData.balance || tokenData;
                                let balance = 0;
                                if (typeof bal === 'object' && bal !== null) {
                                    balance = parseFloat(
                                        bal.swap || bal.module || bal.pendingSwap || bal.pendingAvailable || 0
                                    );
                                } else {
                                    balance = parseFloat(bal || 0);
                                }
                                const normalized = normalizeTicker(key.replace(/___\d+$/, '').toUpperCase());
                                const inWallet = normalizedWalletTickers.has(normalized);
                                allCheckedTickers.push({ original: key, normalized, balance, inWallet });
                            });
                            debugInfo.brc20_inswap_all_checked = allCheckedTickers;
                        }

                        // 4. Runes Balance List API - количество рун
                        // ПРИОРИТЕТ: Uniscan Summary API (как в коде пользователя)
                        let runesCount = 0;
                        if (uniscanSummary?.data?.runes_count !== undefined) {
                            runesCount = Number(uniscanSummary.data.runes_count || 0);
                            debugInfo.runes_count_source = 'uniscan_summary';
                        } else if (
                            uniscanSummary?.data?.assets?.RunesList &&
                            Array.isArray(uniscanSummary.data.assets.RunesList)
                        ) {
                            runesCount = uniscanSummary.data.assets.RunesList.length;
                            debugInfo.runes_count_source = 'uniscan_summary_runes_list';
                        } else if (unisatRunes?.data) {
                            // Fallback: Проверяем разные структуры ответа UniSat API
                            if (Array.isArray(unisatRunes.data)) {
                                runesCount = unisatRunes.data.length;
                            } else if (unisatRunes.data.detail && Array.isArray(unisatRunes.data.detail)) {
                                runesCount = unisatRunes.data.detail.length;
                            } else if (unisatRunes.data.list && Array.isArray(unisatRunes.data.list)) {
                                runesCount = unisatRunes.data.list.length;
                            } else if (unisatRunes.data.total) {
                                runesCount = Number(unisatRunes.data.total) || 0;
                            }
                            if (runesCount > 0) {
                                debugInfo.runes_count_source = 'unisat_runes_balance_list';
                            }
                        } else {
                            // ИСПРАВЛЕНИЕ: Fallback для рун - если UniSat API не загрузился, пробуем запросить отдельно
                            debugInfo.runes_count_source = 'fallback_attempt';
                            debugInfo.runes_error =
                                'Runes data not loaded - UniSat API returned no data, will try separate request';
                            // Пробуем запросить руны отдельно
                            try {
                                const runesRes = await fetch(
                                    `${FRACTAL_BASE}/indexer/address/${address}/runes/balance-list?start=0&limit=100`,
                                    {
                                        headers: upstreamHeaders
                                    }
                                );
                                if (runesRes.ok) {
                                    const runesData = await runesRes.json();
                                    if (runesData?.data) {
                                        if (Array.isArray(runesData.data)) {
                                            runesCount = runesData.data.length;
                                        } else if (runesData.data.detail && Array.isArray(runesData.data.detail)) {
                                            runesCount = runesData.data.detail.length;
                                        } else if (runesData.data.total) {
                                            runesCount = Number(runesData.data.total) || 0;
                                        }
                                        if (runesCount > 0) {
                                            debugInfo.runes_count_source = 'fallback_separate_request';
                                        }
                                    }
                                }
                            } catch (e) {
                                debugInfo.runes_fallback_error = e.message;
                            }
                        }

                        // 5. Ordinals - используем данные из Summary API
                        // ПРИОРИТЕТ: Uniscan Summary API (как в коде пользователя)
                        let ordinalsCount = 0;
                        if (uniscanSummary?.data?.ordinals_count !== undefined) {
                            ordinalsCount = Number(uniscanSummary.data.ordinals_count || 0);
                            debugInfo.ordinals_count_source = 'uniscan_summary';
                        } else if (
                            uniscanSummary?.data?.assets?.InscriptionsList &&
                            Array.isArray(uniscanSummary.data.assets.InscriptionsList)
                        ) {
                            ordinalsCount = uniscanSummary.data.assets.InscriptionsList.length;
                            debugInfo.ordinals_count_source = 'uniscan_summary_inscriptions_list';
                        } else if (unisatBalance?.data?.inscriptionUtxoCount) {
                            // Fallback: используем inscriptionUtxoCount из Balance API
                            ordinalsCount = Number(unisatBalance.data.inscriptionUtxoCount);
                            debugInfo.ordinals_count_source = 'unisat_balance_inscriptionUtxoCount';
                        }

                        let abandonedUtxoCount = null;
                        if (unisatAbandonNftUtxo?.data !== undefined) {
                            const d = unisatAbandonNftUtxo.data;
                            if (d && typeof d.total === 'number') abandonedUtxoCount = d.total;
                            else if (d && typeof d.count === 'number') abandonedUtxoCount = d.count;
                            else if (d && d.data && typeof d.data.total === 'number') abandonedUtxoCount = d.data.total;
                            else if (d && d.data && typeof d.data.count === 'number') abandonedUtxoCount = d.data.count;
                            else if (d && d.data && Array.isArray(d.data.list)) abandonedUtxoCount = d.data.list.length;
                            else if (d && Array.isArray(d.list)) abandonedUtxoCount = d.list.length;
                        }
                        if (typeof abandonedUtxoCount === 'number' && Number.isFinite(abandonedUtxoCount)) {
                            abandonedUtxoCount = Math.max(0, Math.floor(abandonedUtxoCount));
                            debugInfo.abandoned_utxo_count_source = 'unisat_abandon_nft_utxo_data';
                        } else {
                            abandonedUtxoCount = null;
                        }

                        // Debug информация
                        debugInfo.unisat_balance_has_data = !!unisatBalance?.data;
                        debugInfo.unisat_brc20_summary_has_data = !!unisatBrc20Summary?.data;
                        debugInfo.unisat_history_has_data = !!unisatHistory?.data;
                        debugInfo.unisat_runes_has_data = !!unisatRunes?.data;
                        debugInfo.data_source = 'unisat_open_api';
                        debugInfo.utxo_method = 'unisat_balance';

                        // B. Возраст кошелька (РАБОТАЕТ ПРАВИЛЬНО - ЗАФИКСИРОВАНО)
                        // КРИТИЧЕСКОЕ: Метод получения первой транзакции через cursor=total-1&size=1
                        // 1. Получаем txCount из mempool (приоритет) или UniSat History API
                        // 2. Используем cursor=txCount-1&size=1 для получения самой старой транзакции
                        // 3. Валидируем timestamp (не может быть в будущем, проверяем год/месяц/день)
                        // 4. Возвращаем валидный timestamp для расчета возраста
                        let firstTxTs = 0;

                        // Метод 0 (НОВЫЙ ПРИОРИТЕТ): Используем offset для получения первой транзакции напрямую
                        // ИСПРАВЛЕНИЕ: Добавляем валидацию timestamp
                        const now = Math.floor(Date.now() / 1000);
                        const MIN_VALID = 1700000000; // Ноябрь 2023
                        const FRACTAL_LAUNCH = 1725840000; // 9 сентября 2024 (запуск Fractal)
                        const MAX_VALID = now; // Не может быть в будущем

                        if (
                            finalGenesisTxData &&
                            finalGenesisTxData.data &&
                            finalGenesisTxData.data.detail &&
                            finalGenesisTxData.data.detail.length > 0
                        ) {
                            const genesisTx = finalGenesisTxData.data.detail[0];
                            // UniSat отдает timestamp в секундах
                            let candidateTs = genesisTx.timestamp || genesisTx.blocktime || genesisTx.time || 0;

                            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем что timestamp не в миллисекундах
                            if (candidateTs > 10000000000) {
                                candidateTs = Math.floor(candidateTs / 1000);
                                debugInfo.genesis_tx_converted_from_ms = true;
                            }

                            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Строгая валидация timestamp из backup версии
                            // Проверяем год и месяц ДО установки firstTxTs
                            const currentDate = new Date();
                            const currentYear = currentDate.getFullYear();
                            const currentMonth = currentDate.getMonth(); // 0-11

                            const timestampDate = candidateTs > 0 ? new Date(candidateTs * 1000) : null;
                            const timestampYear = timestampDate ? timestampDate.getFullYear() : 0;
                            const timestampMonth = timestampDate ? timestampDate.getMonth() : 0;

                            // КРИТИЧЕСКОЕ: Проверяем что timestamp не в будущем (год не может быть больше текущего)
                            const isFutureYear = timestampYear > currentYear;
                            const isFutureMonth = timestampYear === currentYear && timestampMonth > currentMonth;

                            // КРИТИЧЕСКОЕ: Дополнительная проверка - НЕ добавляем запас для будущего
                            // Timestamp не может быть больше текущего времени (без запаса)
                            const STRICT_MAX_VALID = now; // БЕЗ запаса - не может быть в будущем

                            // ИСПРАВЛЕНИЕ: Валидация timestamp перед использованием
                            // Добавляем проверку дня для более строгой валидации
                            const isFutureDay =
                                timestampYear === currentYear && timestampMonth === currentMonth && timestampDate
                                    ? timestampDate.getDate() > currentDate.getDate()
                                    : false;

                            if (
                                candidateTs > 0 &&
                                candidateTs >= MIN_VALID &&
                                candidateTs <= STRICT_MAX_VALID &&
                                !isFutureYear &&
                                !isFutureMonth &&
                                !isFutureDay
                            ) {
                                firstTxTs = candidateTs;
                                debugInfo.first_tx_method = genesisTxData
                                    ? 'genesis_offset_direct'
                                    : 'genesis_offset_fallback_mempool';
                                debugInfo.genesis_tx_timestamp = firstTxTs;
                                debugInfo.genesis_tx_txid = genesisTx.txid || genesisTx.hash || 'unknown';
                                debugInfo.genesis_tx_structure = Object.keys(genesisTx);
                                debugInfo.first_tx_final_validation = 'passed';
                            } else {
                                debugInfo.genesis_tx_no_timestamp = true;
                                debugInfo.genesis_tx_candidate_ts = candidateTs;
                                debugInfo.genesis_tx_candidate_valid =
                                    candidateTs > 0 && candidateTs >= MIN_VALID && candidateTs <= STRICT_MAX_VALID;
                                debugInfo.genesis_tx_is_future_year = isFutureYear;
                                debugInfo.genesis_tx_is_future_month = isFutureMonth;
                                debugInfo.genesis_tx_timestamp_year = timestampYear;
                                debugInfo.genesis_tx_timestamp_month = timestampMonth;
                                debugInfo.genesis_tx_current_year = currentYear;
                                debugInfo.genesis_tx_current_month = currentMonth;
                                debugInfo.genesis_tx_keys = Object.keys(genesisTx);
                                debugInfo.first_tx_final_validation = 'failed';
                            }
                        } else if (finalGenesisTxData) {
                            debugInfo.genesis_tx_has_data_but_no_detail = true;
                            debugInfo.genesis_tx_structure = Object.keys(finalGenesisTxData);
                            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Если data.detail пустой, не используем этот метод
                            // Оставляем firstTxTs = 0 для использования других методов
                        }

                        // ИСПРАВЛЕНИЕ: Убран fallback метод mempool_txs_sorted - он возвращает последние транзакции, а не первую
                        // Если первая транзакция не определена, это будет видно в debug
                        // Метод 1: mempool_txs_sorted - ОТКЛЮЧЕН (fallback)
                        // ИСПРАВЛЕНИЕ: Убран fallback метод mempool_txs_sorted - поиск стейкинга перенесен на клиентскую сторону
                        if (false && firstTxTs === 0) {
                            // now, MIN_VALID, MAX_VALID уже определены выше

                            // Фильтруем только подтвержденные транзакции с валидным timestamp
                            const confirmedTxs = txsData.filter(tx => {
                                // Проверяем разные возможные структуры
                                const blockTime =
                                    tx.status?.block_time ||
                                    tx.block_time ||
                                    tx.time ||
                                    (tx.status && typeof tx.status === 'object' && tx.status.block_time !== undefined
                                        ? tx.status.block_time
                                        : null);
                                // ИСПРАВЛЕНИЕ: Проверяем что timestamp валидный (не в будущем и не слишком старый)
                                if (blockTime && blockTime > 0) {
                                    // Если timestamp в будущем или слишком старый - игнорируем
                                    if (blockTime > now || blockTime < MIN_VALID) {
                                        return false;
                                    }
                                    return true;
                                }
                                return false;
                            });

                            if (confirmedTxs.length > 0) {
                                // Сортируем: от старых к новым (меньшее время -> большее время)
                                confirmedTxs.sort((a, b) => {
                                    const timeA = a.status?.block_time || a.block_time || a.time || 0;
                                    const timeB = b.status?.block_time || b.block_time || b.time || 0;
                                    return timeA - timeB;
                                });

                                // Берем самую первую (самую старую)
                                const oldestTx = confirmedTxs[0];
                                let candidateTs =
                                    oldestTx.status?.block_time || oldestTx.block_time || oldestTx.time || 0;

                                // ИСПРАВЛЕНИЕ: Проверяем что timestamp не в миллисекундах (если > 10000000000, то это миллисекунды)
                                if (candidateTs > 10000000000) {
                                    candidateTs = Math.floor(candidateTs / 1000);
                                    debugInfo.first_tx_converted_from_ms = true;
                                }

                                // ИСПРАВЛЕНИЕ: Дополнительная валидация перед использованием
                                // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем что timestamp не в будущем (2025 год = неправильно!)
                                // Переопределяем now на всякий случай (на случай если прошло время)
                                const validationNow = Math.floor(Date.now() / 1000);
                                // ИСПРАВЛЕНИЕ: Упрощенная валидация - используем validationNow как максимальный timestamp
                                // Добавляем небольшой запас только для учета задержек синхронизации (например, +1 час)
                                const MAX_VALID_TS = validationNow + 3600; // +1 час запас для синхронизации

                                // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем год и месяц ДО установки firstTxTs
                                const currentDate = new Date();
                                const currentYear = currentDate.getFullYear();
                                const currentMonth = currentDate.getMonth(); // 0-11
                                const currentDay = currentDate.getDate();

                                const timestampDate = candidateTs > 0 ? new Date(candidateTs * 1000) : null;
                                const timestampYear = timestampDate ? timestampDate.getFullYear() : 0;
                                const timestampMonth = timestampDate ? timestampDate.getMonth() : 0;
                                const timestampDay = timestampDate ? timestampDate.getDate() : 0;

                                // Проверяем что timestamp НЕ в будущем
                                const isFutureYear = timestampYear > currentYear;
                                const isFutureMonth = timestampYear === currentYear && timestampMonth > currentMonth;
                                const isFutureDay =
                                    timestampYear === currentYear &&
                                    timestampMonth === currentMonth &&
                                    timestampDay > currentDay;
                                const isFuture = isFutureYear || isFutureMonth || isFutureDay;

                                // ИСПРАВЛЕНИЕ: Упрощенная валидация - проверяем только диапазон timestamp
                                // Mempool возвращает последние транзакции, а не первую, поэтому этот метод ненадежен
                                // Используем MAX_VALID_TS (validationNow + 1 час) для учета задержек синхронизации
                                const isValidTimestamp =
                                    candidateTs > 0 && candidateTs >= MIN_VALID && candidateTs <= MAX_VALID_TS;

                                // ИСПРАВЛЕНИЕ: Также не используем если genesis fallback был попыткой (даже если провалился)
                                const genesisWasAttempted =
                                    debugInfo.genesis_fallback_to_mempool ||
                                    (debugInfo.genesis_tx_method && debugInfo.genesis_tx_method !== 'not_attempted');

                                // ИСПРАВЛЕНИЕ: Используем timestamp если он валидный (не в будущем и в диапазоне)
                                // НЕ проверяем genesisWasAttempted - используем данные если они валидные
                                if (isValidTimestamp && !isFuture) {
                                    firstTxTs = candidateTs;
                                    debugInfo.first_tx_method = 'mempool_txs_sorted';
                                    debugInfo.first_tx_total_txs = txsData.length;
                                    debugInfo.first_tx_confirmed_txs = confirmedTxs.length;
                                    debugInfo.first_tx_timestamp = candidateTs;
                                    debugInfo.first_tx_timestamp_date = new Date(candidateTs * 1000).toISOString();
                                    debugInfo.first_tx_timestamp_year = timestampYear;
                                    debugInfo.first_tx_current_year = currentYear;
                                    debugInfo.first_tx_timestamp_month = timestampMonth;
                                    debugInfo.first_tx_current_month = currentMonth;
                                    debugInfo.first_tx_timestamp_day = timestampDay;
                                    debugInfo.first_tx_current_day = currentDay;
                                    debugInfo.first_tx_warning =
                                        'Using mempool_txs_sorted (last transactions, not first) - may be inaccurate';
                                } else {
                                    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Не используем mempool_txs_sorted если timestamp в будущем
                                    // Mempool возвращает последние транзакции, а не первую, поэтому этот метод ненадежен
                                    // ИСПРАВЛЕНИЕ: mempool_txs_sorted убран как fallback - не используем его
                                    debugInfo.first_tx_method = 'error_mempool_txs_sorted_disabled';
                                    debugInfo.first_tx_error = `mempool_txs_sorted is disabled as fallback - it returns last transactions, not first. Invalid timestamp from mempool: ${candidateTs} (date: ${candidateTs > 0 ? new Date(candidateTs * 1000).toISOString() : 'invalid'}, year: ${timestampYear}, month: ${timestampMonth}, day: ${timestampDay}). Valid range: ${MIN_VALID} - ${validationNow}, year: <= ${currentYear}, month: <= ${currentMonth}, day: <= ${currentDay}`;
                                    debugInfo.first_tx_candidate_ts = candidateTs;
                                    debugInfo.first_tx_candidate_date =
                                        candidateTs > 0 ? new Date(candidateTs * 1000).toISOString() : 'invalid';
                                    debugInfo.first_tx_candidate_year = timestampYear;
                                    debugInfo.first_tx_candidate_month = timestampMonth;
                                    debugInfo.first_tx_candidate_day = timestampDay;
                                    debugInfo.first_tx_current_year = currentYear;
                                    debugInfo.first_tx_current_month = currentMonth;
                                    debugInfo.first_tx_current_day = currentDay;
                                    debugInfo.first_tx_is_future_year = isFutureYear;
                                    debugInfo.first_tx_is_future_month = isFutureMonth;
                                    debugInfo.first_tx_is_future_day = isFutureDay;
                                    debugInfo.first_tx_is_future = isFuture;
                                    const MAX_VALID_TS = validationNow + 3600; // +1 час запас для синхронизации
                                    debugInfo.first_tx_candidate_valid = isValidTimestamp;
                                    debugInfo.first_tx_now = validationNow;
                                    debugInfo.first_tx_min_valid = MIN_VALID;
                                    debugInfo.first_tx_max_valid = MAX_VALID_TS;
                                    // ИСПРАВЛЕНИЕ: Используем MAX_VALID_TS в сообщении, а не validationNow
                                    debugInfo.first_tx_rejected_reason = isFuture
                                        ? `Timestamp is in future (year: ${timestampYear}, month: ${timestampMonth}, day: ${timestampDay})`
                                        : `Timestamp out of valid range (${candidateTs} not in [${MIN_VALID}, ${MAX_VALID_TS}])`;
                                    // НЕ устанавливаем firstTxTs если timestamp невалидный - оставляем 0 для использования других методов
                                }
                            } else {
                                // ОШИБКА: Все транзакции в мемпуле (не подтверждены) - не можем определить первую транзакцию
                                debugInfo.first_tx_method = 'error_all_txs_in_mempool';
                                debugInfo.first_tx_error =
                                    'All transactions are in mempool (unconfirmed). Cannot determine first transaction timestamp.';
                            }
                        }

                        // Метод 2: Проверяем summary
                        // ИСПРАВЛЕНИЕ: Добавляем валидацию timestamp из summary
                        if (firstTxTs === 0 && summaryData?.data) {
                            let candidateTs = 0;
                            if (summaryData.data.firstTransactionTime) {
                                candidateTs = summaryData.data.firstTransactionTime;
                            } else if (summaryData.data.firstTxTime) {
                                candidateTs = summaryData.data.firstTxTime;
                            } else if (summaryData.firstTransactionTime) {
                                candidateTs = summaryData.firstTransactionTime;
                            }

                            // Валидация перед использованием
                            if (candidateTs > 0 && candidateTs >= MIN_VALID && candidateTs <= MAX_VALID) {
                                firstTxTs = candidateTs;
                                debugInfo.first_tx_method = summaryData.data?.firstTransactionTime
                                    ? 'summary_firstTransactionTime'
                                    : summaryData.data?.firstTxTime
                                      ? 'summary_firstTxTime'
                                      : 'summary_root_firstTransactionTime';
                            } else if (candidateTs > 0) {
                                debugInfo.first_tx_method = 'error_summary_invalid_timestamp';
                                debugInfo.first_tx_error = `Summary returned invalid timestamp: ${candidateTs} (date: ${new Date(candidateTs * 1000).toISOString()}). Valid range: ${MIN_VALID} - ${MAX_VALID}`;
                                debugInfo.summary_candidate_ts = candidateTs;
                                debugInfo.summary_candidate_valid =
                                    candidateTs >= MIN_VALID && candidateTs <= MAX_VALID;
                            } else {
                                debugInfo.first_tx_method = 'error_summary_no_timestamp';
                                debugInfo.first_tx_error =
                                    'Summary data exists but no firstTransactionTime field found.';
                            }
                        }

                        // ИСПРАВЛЕНИЕ: Валидация timestamp (но не сбрасываем если он уже найден)
                        if (firstTxTs > 0) {
                            // Если timestamp найден, но невалидный - логируем, но оставляем (может быть правильный)
                            if (firstTxTs > now || firstTxTs < MIN_VALID) {
                                console.warn(
                                    `⚠️ Suspicious first_tx_ts: ${firstTxTs} (date: ${new Date(firstTxTs * 1000).toISOString()})`
                                );
                                debugInfo.first_tx_warning = `Timestamp ${firstTxTs} is outside valid range (${MIN_VALID} - ${now})`;
                                // НЕ сбрасываем - возможно это правильный timestamp из будущего (если часы сервера отстают)
                            }
                        } else {
                            // Если timestamp не найден - возвращаем 0
                            debugInfo.first_tx_method = 'error_no_valid_timestamp';
                            debugInfo.first_tx_error =
                                'Failed to determine first transaction timestamp from all available sources. Invalid timestamp or no data.';
                            firstTxTs = 0; // Реальная ошибка, не fallback
                        }

                        // Метод 3: Используем history (последняя попытка)
                        if (firstTxTs === 0 && historyData) {
                            let txList = [];
                            // ИСПРАВЛЕНИЕ: Проверяем разные структуры ответа
                            // Если historyData.data существует, но пустой или не массив, проверяем другие поля
                            if (historyData.data) {
                                if (historyData.data.detail && Array.isArray(historyData.data.detail)) {
                                    txList = historyData.data.detail;
                                    debugInfo.history_structure = 'data.detail';
                                } else if (historyData.data.list && Array.isArray(historyData.data.list)) {
                                    txList = historyData.data.list;
                                    debugInfo.history_structure = 'data.list';
                                } else if (Array.isArray(historyData.data)) {
                                    txList = historyData.data;
                                    debugInfo.history_structure = 'data_array';
                                } else {
                                    // data существует, но не массив - проверяем его структуру
                                    debugInfo.history_data_structure = typeof historyData.data;
                                    debugInfo.history_data_keys = historyData.data
                                        ? Object.keys(historyData.data)
                                        : 'null';
                                }
                            } else if (Array.isArray(historyData)) {
                                txList = historyData;
                                debugInfo.history_structure = 'root_array';
                            } else {
                                debugInfo.history_structure = 'unknown';
                                debugInfo.history_keys = historyData ? Object.keys(historyData) : 'null';
                            }

                            debugInfo.history_tx_count = txList.length;

                            if (txList.length > 0) {
                                // Фильтруем только с timestamp и валидируем их (строгая проверка - не в будущем)
                                const validationNow = Math.floor(Date.now() / 1000);
                                const txsWithTime = txList.filter(tx => {
                                    let ts = tx.timestamp || tx.blocktime || tx.time || 0;
                                    // Конвертируем миллисекунды в секунды если нужно
                                    if (ts > 1000000000000) {
                                        ts = Math.floor(ts / 1000);
                                    }
                                    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Убираем запас в 1 день - отклоняем любой timestamp в будущем
                                    // КРИТИЧЕСКОЕ: Проверяем СНАЧАЛА что timestamp не больше текущего времени
                                    const nowCheck = Math.floor(Date.now() / 1000);
                                    if (ts > 0 && ts >= MIN_VALID && ts <= validationNow && ts <= nowCheck) {
                                        const tsYear = new Date(ts * 1000).getFullYear();
                                        const tsMonth = new Date(ts * 1000).getMonth();
                                        const tsDay = new Date(ts * 1000).getDate();
                                        const currentYear = new Date().getFullYear();
                                        const currentMonth = new Date().getMonth();
                                        const currentDay = new Date().getDate();
                                        // КРИТИЧЕСКОЕ: Отклоняем если год, месяц ИЛИ день в будущем
                                        const isFutureYear = tsYear > currentYear;
                                        const isFutureMonth = tsYear === currentYear && tsMonth > currentMonth;
                                        const isFutureDay =
                                            tsYear === currentYear && tsMonth === currentMonth && tsDay > currentDay;
                                        // КРИТИЧЕСКОЕ: Дополнительная проверка - если timestamp больше nowCheck, отклоняем
                                        // Возвращаем true только если НЕ в будущем И не больше текущего времени
                                        return !isFutureYear && !isFutureMonth && !isFutureDay && ts <= nowCheck;
                                    }
                                    return false;
                                });

                                debugInfo.history_txs_with_time = txsWithTime.length;

                                if (txsWithTime.length > 0) {
                                    // Сортируем по времени (от старых к новым)
                                    txsWithTime.sort((a, b) => {
                                        let timeA = a.timestamp || a.blocktime || a.time || 0;
                                        let timeB = b.timestamp || b.blocktime || b.time || 0;
                                        // Конвертируем миллисекунды в секунды если нужно
                                        if (timeA > 1000000000000) timeA = Math.floor(timeA / 1000);
                                        if (timeB > 1000000000000) timeB = Math.floor(timeB / 1000);
                                        return timeA - timeB;
                                    });
                                    let candidateTs =
                                        txsWithTime[0].timestamp ||
                                        txsWithTime[0].blocktime ||
                                        txsWithTime[0].time ||
                                        0;
                                    // Конвертируем миллисекунды в секунды если нужно
                                    if (candidateTs > 1000000000000) {
                                        candidateTs = Math.floor(candidateTs / 1000);
                                    }
                                    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем что timestamp не в будущем ПЕРЕД установкой
                                    const nowCheckStrict = Math.floor(Date.now() / 1000);
                                    const tsYear = new Date(candidateTs * 1000).getFullYear();
                                    const tsMonth = new Date(candidateTs * 1000).getMonth();
                                    const tsDay = new Date(candidateTs * 1000).getDate();
                                    const currentYear = new Date().getFullYear();
                                    const currentMonth = new Date().getMonth();
                                    const currentDay = new Date().getDate();
                                    const isFutureYear = tsYear > currentYear;
                                    const isFutureMonth = tsYear === currentYear && tsMonth > currentMonth;
                                    const isFutureDay =
                                        tsYear === currentYear && tsMonth === currentMonth && tsDay > currentDay;
                                    // КРИТИЧЕСКОЕ: Проверяем СТРОГО что timestamp не больше validationNow И не больше nowCheckStrict
                                    const isFuture =
                                        isFutureYear ||
                                        isFutureMonth ||
                                        isFutureDay ||
                                        candidateTs > validationNow ||
                                        candidateTs > nowCheckStrict;

                                    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Отклоняем timestamp если он в будущем (даже на 1 год)
                                    // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Проверяем также что timestamp не больше validationNow И не больше nowCheckStrict
                                    if (isFuture || candidateTs > validationNow || candidateTs > nowCheckStrict) {
                                        debugInfo.first_tx_method = 'error_history_future_timestamp';
                                        debugInfo.first_tx_error = `History timestamp ${candidateTs} (year: ${tsYear}, month: ${tsMonth + 1}, day: ${tsDay}) is in future. Current: ${currentYear}-${currentMonth + 1}-${currentDay}, validationNow: ${validationNow}, candidateTs > validationNow: ${candidateTs > validationNow}`;
                                        debugInfo.first_tx_from_history = candidateTs;
                                        debugInfo.first_tx_future_check = {
                                            tsYear,
                                            tsMonth,
                                            tsDay,
                                            currentYear,
                                            currentMonth,
                                            currentDay,
                                            isFutureYear,
                                            isFutureMonth,
                                            isFutureDay,
                                            isFuture,
                                            candidateTs,
                                            validationNow,
                                            tsGreaterThanNow: candidateTs > validationNow
                                        };
                                        firstTxTs = 0; // Не используем timestamp из будущего
                                    } else if (
                                        candidateTs > 0 &&
                                        candidateTs >= MIN_VALID &&
                                        candidateTs <= validationNow &&
                                        !isFuture
                                    ) {
                                        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Дополнительная проверка на будущее время - строгая проверка
                                        // Дополнительно проверяем что candidateTs не больше validationNow И не в будущем по дате
                                        const nowCheck2 = Math.floor(Date.now() / 1000);
                                        const tsYear2 = new Date(candidateTs * 1000).getFullYear();
                                        const tsMonth2 = new Date(candidateTs * 1000).getMonth();
                                        const tsDay2 = new Date(candidateTs * 1000).getDate();
                                        const isStillFuture2 =
                                            tsYear2 > currentYear ||
                                            (tsYear2 === currentYear && tsMonth2 > currentMonth) ||
                                            (tsYear2 === currentYear &&
                                                tsMonth2 === currentMonth &&
                                                tsDay2 > currentDay);

                                        // КРИТИЧЕСКОЕ: Дополнительная проверка - если timestamp больше текущего времени в секундах, ОТКЛОНЯЕМ
                                        const strictNowCheck = Math.floor(Date.now() / 1000);
                                        const isGreaterThanStrictNow = candidateTs > strictNowCheck;

                                        // КРИТИЧЕСКОЕ: ДОПОЛНИТЕЛЬНАЯ проверка - timestamp НЕ ДОЛЖЕН быть больше ТЕКУЩЕГО времени
                                        const absoluteNow = Math.floor(Date.now() / 1000);
                                        const candidateIsReallyInFuture = candidateTs > absoluteNow;

                                        if (
                                            candidateTs <= validationNow &&
                                            candidateTs <= nowCheck2 &&
                                            candidateTs <= strictNowCheck &&
                                            candidateTs <= absoluteNow && // НОВАЯ ПРОВЕРКА
                                            !candidateIsReallyInFuture && // НОВАЯ ПРОВЕРКА
                                            !isFuture &&
                                            !isStillFuture2 &&
                                            !isGreaterThanStrictNow
                                        ) {
                                            firstTxTs = candidateTs;
                                            debugInfo.first_tx_method = 'history_sorted';
                                            debugInfo.first_tx_from_history = firstTxTs;
                                            debugInfo.first_tx_absolute_now_check = absoluteNow;
                                            debugInfo.first_tx_candidate_vs_now = `${candidateTs} <= ${absoluteNow}`;
                                        } else {
                                            const absoluteNow = Math.floor(Date.now() / 1000);
                                            debugInfo.first_tx_method = 'error_history_future_timestamp';
                                            debugInfo.first_tx_error = `History timestamp ${candidateTs} (year: ${tsYear2}, month: ${tsMonth2 + 1}, day: ${tsDay2}) is greater than validationNow ${validationNow} or nowCheck ${nowCheck2} or strictNowCheck ${strictNowCheck} or absoluteNow ${absoluteNow} or is future. Current: ${currentYear}-${currentMonth + 1}-${currentDay}`;
                                            debugInfo.first_tx_absolute_now = absoluteNow;
                                            debugInfo.first_tx_candidate_greater_than_absolute =
                                                candidateTs > absoluteNow;
                                            debugInfo.first_tx_rejected_reason = {
                                                candidateTs,
                                                validationNow,
                                                nowCheck2,
                                                strictNowCheck,
                                                isFuture,
                                                isStillFuture2,
                                                isGreaterThanStrictNow,
                                                tsYear2,
                                                tsMonth2,
                                                tsDay2,
                                                currentYear,
                                                currentMonth,
                                                currentDay
                                            };
                                            firstTxTs = 0;
                                        }
                                    } else {
                                        debugInfo.first_tx_method = 'error_history_invalid_timestamp';
                                        debugInfo.first_tx_error = `History timestamp ${candidateTs} is invalid. Valid range: ${MIN_VALID} - ${validationNow}, isFuture: ${isFuture}, candidateTs > validationNow: ${candidateTs > validationNow}`;
                                        firstTxTs = 0;
                                    }
                                } else {
                                    debugInfo.first_tx_method = 'error_history_no_valid_timestamps';
                                    debugInfo.first_tx_error =
                                        'History has transactions but none have valid timestamps.';
                                    // ИСПРАВЛЕНИЕ: Пробуем использовать первую транзакцию без валидации timestamp (для debug)
                                    if (txList.length > 0) {
                                        const firstTx = txList[0];
                                        const rawTs = firstTx.timestamp || firstTx.blocktime || firstTx.time || 0;
                                        debugInfo.first_tx_raw_timestamp = rawTs;
                                        debugInfo.first_tx_raw_timestamp_date =
                                            rawTs > 0 ? new Date(rawTs * 1000).toISOString() : 'invalid';
                                    }
                                }
                            } else {
                                debugInfo.first_tx_method = 'error_history_no_txs';
                                debugInfo.first_tx_error = 'History data exists but no transactions found.';
                                debugInfo.history_data_type = typeof historyData;
                                debugInfo.history_data_keys = historyData ? Object.keys(historyData) : 'null';
                                // ИСПРАВЛЕНИЕ: Если data существует, но пустой, логируем это
                                if (historyData.data) {
                                    debugInfo.history_data_empty = true;
                                    debugInfo.history_data_type_detail = typeof historyData.data;
                                }
                            }
                        }

                        // Финальная валидация: проверяем что timestamp не в миллисекундах и валидный
                        // ИСПРАВЛЕНИЕ: НЕ используем sanitizeTimestamp - используем валидацию из backup
                        if (firstTxTs > 0) {
                            // Если timestamp в будущем, возможно это миллисекунды, конвертируем
                            if (firstTxTs > 1000000000000) {
                                firstTxTs = Math.floor(firstTxTs / 1000);
                                debugInfo.first_tx_converted_from_ms = true;
                            }

                            // Финальная проверка валидности - возвращаем ошибку вместо fallback
                            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Строгая проверка - timestamp НЕ должен быть в будущем
                            const validationNow = Math.floor(Date.now() / 1000);
                            const nowCheck = Math.floor(Date.now() / 1000); // Дополнительная проверка
                            const currentYear = new Date().getFullYear();
                            const currentMonth = new Date().getMonth();
                            const currentDay = new Date().getDate();
                            const timestampYear = new Date(firstTxTs * 1000).getFullYear();
                            const timestampMonth = new Date(firstTxTs * 1000).getMonth();
                            const timestampDay = new Date(firstTxTs * 1000).getDate();

                            // КРИТИЧЕСКОЕ: Проверяем СНАЧАЛА что timestamp не больше текущего времени
                            const isGreaterThanNow = firstTxTs > validationNow || firstTxTs > nowCheck;
                            const isFutureYear = timestampYear > currentYear;
                            const isFutureMonth = timestampYear === currentYear && timestampMonth > currentMonth;
                            const isFutureDay =
                                timestampYear === currentYear &&
                                timestampMonth === currentMonth &&
                                timestampDay > currentDay;
                            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Отклоняем если timestamp больше текущего времени ИЛИ в будущем по дате
                            const isFuture = isGreaterThanNow || isFutureYear || isFutureMonth || isFutureDay;

                            // ИСПРАВЛЕНИЕ: Отклоняем timestamp если он в будущем (даже на 1 год)
                            // КРИТИЧЕСКОЕ: Проверяем СНАЧАЛА что timestamp не в будущем, ПОТОМ что он не слишком старый
                            // КРИТИЧЕСКОЕ: Дополнительная проверка - если timestamp больше validationNow ИЛИ в будущем по дате - ОТКЛОНЯЕМ
                            if (isFuture || firstTxTs > validationNow || firstTxTs > nowCheck) {
                                debugInfo.first_tx_final_validation_error = true;
                                debugInfo.first_tx_final_validation = 'timestamp_future';
                                debugInfo.first_tx_final_original = firstTxTs;
                                debugInfo.first_tx_final_year = timestampYear;
                                debugInfo.first_tx_final_month = timestampMonth;
                                debugInfo.first_tx_final_day = timestampDay;
                                debugInfo.first_tx_current_year = currentYear;
                                debugInfo.first_tx_current_month = currentMonth;
                                debugInfo.first_tx_current_day = currentDay;
                                debugInfo.first_tx_now = validationNow;
                                debugInfo.first_tx_now_check = nowCheck;
                                debugInfo.first_tx_is_future = isFuture;
                                debugInfo.first_tx_greater_than_validation = firstTxTs > validationNow;
                                debugInfo.first_tx_greater_than_now = firstTxTs > nowCheck;
                                debugInfo.first_tx_error = `Final validation failed: timestamp ${firstTxTs} (date: ${new Date(firstTxTs * 1000).toISOString()}, year: ${timestampYear}, month: ${timestampMonth + 1}, day: ${timestampDay}) is in future. Current: ${currentYear}-${currentMonth + 1}-${currentDay}, validationNow: ${validationNow}, nowCheck: ${nowCheck}, firstTxTs > validationNow: ${firstTxTs > validationNow}, firstTxTs > nowCheck: ${firstTxTs > nowCheck}, isFuture: ${isFuture}`;
                                firstTxTs = 0; // Сбрасываем на 0 если timestamp в будущем
                            } else if (firstTxTs < MIN_VALID) {
                                // Timestamp слишком старый
                                debugInfo.first_tx_final_validation_error = true;
                                debugInfo.first_tx_final_validation = 'timestamp_too_old';
                                debugInfo.first_tx_error = `Final validation failed: timestamp ${firstTxTs} is too old. Valid range: ${MIN_VALID} - ${validationNow}`;
                                firstTxTs = 0;
                            } else if (firstTxTs > 0) {
                                // ИСПРАВЛЕНИЕ: СТРОГАЯ проверка - сначала проверяем что timestamp НЕ в будущем
                                // Нормализуем timestamp (может быть в миллисекундах)
                                if (firstTxTs > 1000000000000) {
                                    firstTxTs = Math.floor(firstTxTs / 1000);
                                }

                                // КРИТИЧЕСКОЕ: Проверяем timestamp на будущее время ПЕРЕД проверкой диапазона
                                const finalCheckYear = new Date(firstTxTs * 1000).getFullYear();
                                const finalCheckMonth = new Date(firstTxTs * 1000).getMonth();
                                const finalCheckDay = new Date(firstTxTs * 1000).getDate();
                                const finalIsFutureYear = finalCheckYear > currentYear;
                                const finalIsFutureMonth =
                                    finalCheckYear === currentYear && finalCheckMonth > currentMonth;
                                const finalIsFutureDay =
                                    finalCheckYear === currentYear &&
                                    finalCheckMonth === currentMonth &&
                                    finalCheckDay > currentDay;

                                // КРИТИЧЕСКОЕ: СТРОГАЯ проверка - если timestamp больше текущего времени, ОТКЛОНЯЕМ
                                // КРИТИЧЕСКОЕ: Дополнительная проверка - сравниваем timestamp с текущим временем напрямую
                                const strictNowCheckFinal = Math.floor(Date.now() / 1000);
                                const isGreaterThanStrictNowFinal = firstTxTs > strictNowCheckFinal;

                                if (
                                    firstTxTs > validationNow ||
                                    firstTxTs > strictNowCheckFinal ||
                                    isGreaterThanStrictNowFinal ||
                                    finalIsFutureYear ||
                                    finalIsFutureMonth ||
                                    finalIsFutureDay
                                ) {
                                    // Отклоняем если это будущее время
                                    debugInfo.first_tx_final_validation_error = true;
                                    debugInfo.first_tx_final_validation = 'timestamp_future_final_check';
                                    debugInfo.first_tx_error = `Final check failed: timestamp ${firstTxTs} (year: ${finalCheckYear}, month: ${finalCheckMonth + 1}, day: ${finalCheckDay}) is in future. Current: ${currentYear}-${currentMonth + 1}-${currentDay}, validationNow: ${validationNow}, strictNowCheckFinal: ${strictNowCheckFinal}, firstTxTs > validationNow: ${firstTxTs > validationNow}, firstTxTs > strictNowCheckFinal: ${firstTxTs > strictNowCheckFinal}`;
                                    debugInfo.first_tx_debug_final = {
                                        firstTxTs,
                                        validationNow,
                                        strictNowCheckFinal,
                                        isGreaterThanStrictNowFinal,
                                        finalCheckYear,
                                        finalCheckMonth,
                                        finalCheckDay,
                                        currentYear,
                                        currentMonth,
                                        currentDay
                                    };
                                    firstTxTs = 0;
                                } else if (firstTxTs >= MIN_VALID && firstTxTs <= validationNow) {
                                    // Дополнительная проверка - убеждаемся что timestamp действительно в прошлом
                                    const nowCheck = Math.floor(Date.now() / 1000);
                                    // КРИТИЧЕСКОЕ: Проверяем еще раз год/месяц/день перед тем как пометить как passed
                                    const finalCheckYear2 = new Date(firstTxTs * 1000).getFullYear();
                                    const finalCheckMonth2 = new Date(firstTxTs * 1000).getMonth();
                                    const finalCheckDay2 = new Date(firstTxTs * 1000).getDate();
                                    const isStillFuture =
                                        finalCheckYear2 > currentYear ||
                                        (finalCheckYear2 === currentYear && finalCheckMonth2 > currentMonth) ||
                                        (finalCheckYear2 === currentYear &&
                                            finalCheckMonth2 === currentMonth &&
                                            finalCheckDay2 > currentDay);

                                    // КРИТИЧЕСКОЕ: СТРОГАЯ проверка - если timestamp больше validationNow ИЛИ в будущем по дате - ОТКЛОНЯЕМ
                                    // КРИТИЧЕСКОЕ: Дополнительная проверка - сравниваем timestamp с текущим временем напрямую
                                    const strictNowCheck = Math.floor(Date.now() / 1000);
                                    const isGreaterThanStrictNow = firstTxTs > strictNowCheck;

                                    if (
                                        firstTxTs > validationNow ||
                                        firstTxTs > nowCheck ||
                                        firstTxTs > strictNowCheck ||
                                        isStillFuture ||
                                        isGreaterThanStrictNow
                                    ) {
                                        // Еще одна проверка - если все равно в будущем, отклоняем
                                        debugInfo.first_tx_final_validation_error = true;
                                        debugInfo.first_tx_final_validation = 'timestamp_future_now_check';
                                        debugInfo.first_tx_error = `Now check failed: timestamp ${firstTxTs} (year: ${finalCheckYear2}, month: ${finalCheckMonth2 + 1}, day: ${finalCheckDay2}) > validationNow ${validationNow} or > nowCheck ${nowCheck} or > strictNowCheck ${strictNowCheck} or is future. Current: ${currentYear}-${currentMonth + 1}-${currentDay}, isStillFuture: ${isStillFuture}, isGreaterThanStrictNow: ${isGreaterThanStrictNow}`;
                                        debugInfo.first_tx_debug_values = {
                                            firstTxTs,
                                            validationNow,
                                            nowCheck,
                                            strictNowCheck,
                                            isStillFuture,
                                            isGreaterThanStrictNow,
                                            finalCheckYear2,
                                            finalCheckMonth2,
                                            finalCheckDay2,
                                            currentYear,
                                            currentMonth,
                                            currentDay
                                        };
                                        firstTxTs = 0;
                                    } else {
                                        // Timestamp валидный - только если он в прошлом или настоящем И прошел все проверки
                                        debugInfo.first_tx_final_validation = 'passed';
                                    }
                                } else {
                                    // Timestamp не прошел проверки - отклоняем
                                    debugInfo.first_tx_final_validation_error = true;
                                    debugInfo.first_tx_final_validation = 'timestamp_invalid_range';
                                    debugInfo.first_tx_error = `Timestamp ${firstTxTs} is outside valid range: ${MIN_VALID} - ${validationNow}`;
                                    firstTxTs = 0;
                                }
                            } else {
                                // Неожиданный случай - отклоняем
                                debugInfo.first_tx_final_validation_error = true;
                                debugInfo.first_tx_final_validation = 'unexpected_case';
                                debugInfo.first_tx_error = `Unexpected timestamp value: ${firstTxTs}`;
                                firstTxTs = 0;
                            }
                        }

                        // D. ЦЕНЫ (ОПТИМИЗАЦИЯ: Загружаем параллельно с таймаутом и улучшенным fallback)
                        console.log('💰 Loading prices...');
                        // Загружаем цены параллельно с коротким таймаутом
                        let btcPrice = 0;
                        let fbPrice = 0;

                        try {
                            // ИСПРАВЛЕНИЕ: Увеличиваем таймаут до 18 секунд для надежности (getCMCPrices имеет внутренний таймаут 15 секунд)
                            const cmcPrices = await Promise.race([
                                getCMCPrices(),
                                new Promise(resolve => setTimeout(() => resolve({ btcPrice: 0, fbPrice: 0 }), 18000))
                            ]);
                            btcPrice = cmcPrices.btcPrice || 0;
                            fbPrice = cmcPrices.fbPrice || 0;

                            if (btcPrice > 0) {
                                debugInfo.btc_price_source = 'cmc';
                                debugInfo.btc_price = btcPrice;
                            }
                            if (fbPrice > 0) {
                                debugInfo.fb_price_source = 'cmc';
                                debugInfo.fb_price = fbPrice;
                            }
                        } catch (e) {
                            console.warn('CMC prices error:', e.message);
                        }

                        // Fallback на CoinGecko для BTC если CMC не вернул
                        if (btcPrice === 0) {
                            try {
                                // ИСПРАВЛЕНИЕ: Увеличиваем таймаут CoinGecko до 8 секунд
                                const cgRes = await Promise.race([
                                    fetch(
                                        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
                                        {
                                            headers: { 'User-Agent': 'Mozilla/5.0' }
                                        }
                                    ),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
                                ]);
                                if (cgRes.ok) {
                                    const cgJson = await cgRes.json();
                                    if (cgJson.bitcoin && cgJson.bitcoin.usd) {
                                        btcPrice = cgJson.bitcoin.usd;
                                        debugInfo.btc_price_source = 'coingecko';
                                        debugInfo.btc_price = btcPrice;
                                    }
                                }
                            } catch (e) {
                                debugInfo.btc_price_coingecko_error = e.message;
                            }
                        }

                        // Fallback на пул InSwap для FB если CMC не вернул (только если есть BTC цена)
                        if (fbPrice === 0 && btcPrice > 0) {
                            try {
                                const inswapHeaders = {
                                    Accept: 'application/json, text/plain, */*',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    Referer: 'https://inswap.cc/',
                                    Origin: 'https://inswap.cc',
                                    'x-appid': '1adcd7969603261753f1812c9461cd36',
                                    'x-front-version': '2125'
                                };
                                // ИСПРАВЛЕНИЕ: Увеличиваем таймаут для пула до 8 секунд
                                const poolRes = await Promise.race([
                                    fetch(`${INSWAP_URL}/pool_info?tick0=sBTC___000&tick1=sFB___000`, {
                                        headers: inswapHeaders
                                    }),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
                                ]);
                                const poolJson = await poolRes.json();
                                if (poolJson.data) {
                                    const d = poolJson.data;
                                    const amt0 = parseFloat(d.amount0);
                                    const amt1 = parseFloat(d.amount1);
                                    const isBtcFirst = d.tick0.includes('BTC') || d.tick0 === 'sBTC___000';
                                    let ratio = 0;
                                    if (isBtcFirst) {
                                        if (amt1 > 0) ratio = amt0 / amt1;
                                    } else {
                                        if (amt0 > 0) ratio = amt1 / amt0;
                                    }
                                    if (ratio > 0) {
                                        fbPrice = ratio * btcPrice;
                                        debugInfo.fb_price_source = 'pool_calculation';
                                        debugInfo.fb_price = fbPrice;
                                    }
                                }
                            } catch (e) {
                                debugInfo.fb_price_pool_error = e.message;
                            }
                        }

                        // Fallback на дефолтные цены если все источники не работают
                        if (btcPrice === 0) {
                            // Используем примерную цену BTC как fallback
                            btcPrice = 86000; // Примерная цена BTC
                            debugInfo.btc_price_source = 'fallback_default';
                            debugInfo.btc_price_fallback = true;
                        }
                        if (fbPrice === 0) {
                            // Используем примерную цену FB как fallback
                            fbPrice = 0.4; // Примерная цена FB
                            debugInfo.fb_price_source = 'fallback_default';
                            debugInfo.fb_price_fallback = true;
                        }

                        if (btcPrice === 0 || fbPrice === 0) {
                            debugInfo.prices_missing = true;
                        } else {
                            debugInfo.prices_missing = false;
                        }

                        // Приоритет 2: all_balance содержит поле price для каждого токена (альтернативный метод если CMC не работает)
                        if (fbPrice === 0 && allBalance?.data?.sFB___000?.price) {
                            // Цена FB в BTC из all_balance
                            const fbPriceInBTC = parseFloat(allBalance.data.sFB___000.price) || 0;
                            // Конвертируем в USD: цена в BTC * цена BTC в USD
                            fbPrice = fbPriceInBTC * btcPrice;
                            debugInfo.fbPrice_method = 'all_balance_price';
                            debugInfo.fbPrice_in_btc = fbPriceInBTC;
                        }

                        // Приоритет 3: Расчет через пул sBTC/sFB (альтернативный метод если CMC и all_balance не работают)
                        if (fbPrice === 0) {
                            debugInfo.fbPrice_method = 'pool_calculation';
                            let poolData = null;

                            // Метод 1: Пробуем all_balance для получения pool info
                            if (allBalance?.data) {
                                if (allBalance.data.pools) {
                                    const sbtcFbPool = allBalance.data.pools.find(
                                        p =>
                                            (p.tick0 === 'sBTC___000' && p.tick1 === 'sFB___000') ||
                                            (p.tick1 === 'sBTC___000' && p.tick0 === 'sFB___000')
                                    );
                                    if (sbtcFbPool) poolData = sbtcFbPool;
                                }
                            }

                            // Метод 2: pool_info (убран fbPool - используем только myPoolList)
                            // ИСПРАВЛЕНИЕ: fbPool был удален для оптимизации, используем только myPoolList

                            // Метод 3: my_pool_list (если pool_info не работает)
                            if (!poolData && myPoolList?.data?.list && Array.isArray(myPoolList.data.list)) {
                                const sbtcFbPool = myPoolList.data.list.find(p => {
                                    const t0 = p.tick0 || '';
                                    const t1 = p.tick1 || '';
                                    return (
                                        (t0 === 'sBTC___000' && t1 === 'sFB___000') ||
                                        (t1 === 'sBTC___000' && t0 === 'sFB___000')
                                    );
                                });
                                if (sbtcFbPool) {
                                    poolData = sbtcFbPool;
                                    debugInfo.fbPool_method = 'from_my_pool_list';
                                }
                            }

                            if (poolData) {
                                const tick0 = poolData.tick0 || '';
                                const tick1 = poolData.tick1 || '';
                                const isBtc0 =
                                    tick0.includes('BTC') || tick0 === 'sBTC___000' || tick0.includes('sBTC');
                                const isBtc1 =
                                    tick1.includes('BTC') || tick1 === 'sBTC___000' || tick1.includes('sBTC');

                                let amtBTC = 0;
                                let amtFB = 0;

                                if (isBtc0) {
                                    amtBTC = parseFloat(poolData.amount0 || 0);
                                    amtFB = parseFloat(poolData.amount1 || 0);
                                } else if (isBtc1) {
                                    amtBTC = parseFloat(poolData.amount1 || 0);
                                    amtFB = parseFloat(poolData.amount0 || 0);
                                }

                                if (amtFB > 0 && amtBTC > 0 && !isNaN(amtBTC) && !isNaN(amtFB)) {
                                    fbPrice = (amtBTC / amtFB) * btcPrice;
                                    if (isNaN(fbPrice) || !isFinite(fbPrice)) {
                                        fbPrice = 0;
                                    }
                                    debugInfo.fbPrice_method = 'pool_calculation';
                                    debugInfo.fbPrice_calculated = fbPrice;
                                    debugInfo.fbPool_calc_amtBTC = amtBTC;
                                    debugInfo.fbPool_calc_amtFB = amtFB;
                                    debugInfo.fbPool_calc_btcPrice = btcPrice;
                                } else {
                                    debugInfo.fbPrice_method = 'pool_calculation_failed';
                                    debugInfo.fbPrice_fail_reason = `amtBTC=${amtBTC}, amtFB=${amtFB}, btcPrice=${btcPrice}`;
                                }
                            } else {
                                debugInfo.fbPrice_method = 'no_pool_data';
                                debugInfo.fbPool_data_available = !!poolData;
                            }
                        }

                        // Расчет цены FENNEC через пул FENNEC/sFB
                        let fennecPriceInFB = 0;

                        // ИСПРАВЛЕНИЕ: Пробуем all_balance для получения цены FENNEC
                        if (allBalance?.data?.FENNEC?.price && allBalance?.data?.sFB___000?.price) {
                            // Цена FENNEC в BTC из all_balance
                            const fennecPriceInBTC = parseFloat(allBalance.data.FENNEC.price) || 0;
                            // Цена FB в BTC из all_balance
                            const fbPriceInBTC = parseFloat(allBalance.data.sFB___000.price) || 0;
                            // Конвертируем в FB: (цена FENNEC в BTC) / (цена FB в BTC)
                            if (fbPriceInBTC > 0) {
                                fennecPriceInFB = fennecPriceInBTC / fbPriceInBTC;
                                debugInfo.fennecPrice_method = 'all_balance_price';
                            }
                        }

                        // ИСПРАВЛЕНИЕ: Убрана проверка fennecPool - запрос удален для оптимизации
                        // Цена FENNEC будет получена из all_balance или my_pool_list

                        // Альтернативный метод: Пробуем my_pool_list для пула FENNEC/sFB
                        if (fennecPriceInFB === 0 && myPoolList?.data?.list && Array.isArray(myPoolList.data.list)) {
                            const fennecFbPool = myPoolList.data.list.find(p => {
                                const t0 = p.tick0 || '';
                                const t1 = p.tick1 || '';
                                return (
                                    (t0 === 'FENNEC' && t1 === 'sFB___000') || (t1 === 'FENNEC' && t0 === 'sFB___000')
                                );
                            });
                            if (fennecFbPool) {
                                const isFennec0 = fennecFbPool.tick0 === 'FENNEC';
                                const amtFennec =
                                    parseFloat(isFennec0 ? fennecFbPool.amount0 : fennecFbPool.amount1) || 0;
                                const amtFB = parseFloat(isFennec0 ? fennecFbPool.amount1 : fennecFbPool.amount0) || 0;
                                if (amtFennec > 0) {
                                    fennecPriceInFB = amtFB / amtFennec;
                                    debugInfo.fennecPrice_method = 'my_pool_list';
                                }
                            }
                        }

                        // C. Точные количества Активов (Используем несколько источников)

                        // Runes: ОПТИМИЗАЦИЯ - используем UniSat Runes Balance List API
                        // runesCount уже установлен выше из unisatRunes
                        if (runesCount === 0) {
                            debugInfo.runes_method = 'error_no_data';
                            debugInfo.runes_error = 'Runes data not loaded - UniSat API returned no data';
                        } else {
                            debugInfo.runes_method = 'unisat_runes_balance_list';
                        }

                        // BRC-20: ОПТИМИЗАЦИЯ - используем UniSat BRC-20 Summary API
                        // ИСПРАВЛЕНИЕ: Добавляем debug для диагностики
                        debugInfo.brc20_data_exists = !!unisatBrc20Summary;
                        debugInfo.brc20_data_structure = unisatBrc20Summary ? Object.keys(unisatBrc20Summary) : 'null';
                        debugInfo.brc20_data_has_data = !!unisatBrc20Summary?.data;
                        debugInfo.brc20_data_keys = unisatBrc20Summary?.data
                            ? Object.keys(unisatBrc20Summary.data)
                            : 'no data';

                        // ИСПРАВЛЕНИЕ: Улучшенная логика BRC-20 - собираем все тикеры и проверяем на дубликаты
                        // Объединяем списки из кошелька и InSwap, убираем дубликаты
                        const uniqueTickers = new Set();
                        const walletTickers = new Set(); // Тикеры из основного кошелька (для проверки дубликатов)

                        // normalizeTicker уже объявлена выше

                        // 1. Добавляем тикеры из основного кошелька (UniSat BRC-20 Summary API)
                        {
                            let tokensList = [];
                            if (unisatBrc20Summary?.data?.detail && Array.isArray(unisatBrc20Summary.data.detail)) {
                                tokensList = unisatBrc20Summary.data.detail;
                            } else if (unisatBrc20Summary?.data?.list && Array.isArray(unisatBrc20Summary.data.list)) {
                                tokensList = unisatBrc20Summary.data.list;
                            } else if (Array.isArray(unisatBrc20Summary?.data)) {
                                tokensList = unisatBrc20Summary.data;
                            }

                            if (tokensList.length > 0) {
                                tokensList.forEach(t => {
                                    const bal =
                                        parseFloat(t.availableBalance || t.balance || 0) +
                                        parseFloat(t.transferableBalance || 0);
                                    if (!(bal > 0)) return;
                                    const rawTicker = t.ticker || t.tick || t.symbol || '';
                                    const normalizedTicker = normalizeTicker(rawTicker);
                                    if (normalizedTicker) {
                                        uniqueTickers.add(normalizedTicker);
                                        walletTickers.add(normalizedTicker);
                                    }
                                });
                            }
                        }

                        // 2. Добавляем тикеры из InSwap (all_balance) - проверяем что их нет в кошельке
                        if (allBalance?.data) {
                            const inswapTickersAdded = [];
                            const inswapTickersSkipped = [];
                            const inswapTickersChecked = []; // Все проверенные тикеры для отладки

                            Object.keys(allBalance.data).forEach(key => {
                                // Пропускаем служебные поля (но НЕ total_usd - это может быть общий баланс в USD)
                                if (['lp_positions', 'positions'].includes(key)) return;

                                // ИСПРАВЛЕНИЕ: Если это total_usd, сохраняем для использования в расчете net worth
                                if (key === 'total_usd' && typeof allBalance.data[key] === 'number') {
                                    debugInfo.all_balance_total_usd = allBalance.data[key];
                                    return; // Пропускаем, так как это не токен
                                }

                                const tokenData = allBalance.data[key];
                                if (typeof tokenData !== 'object' || !tokenData) return;
                                // ИСПРАВЛЕНИЕ: Проверяем баланс в разных форматах (balance, swap, module и т.д.)
                                const bal = tokenData.balance || tokenData;
                                let balance = 0;

                                // Поддержка разных структур
                                if (typeof bal === 'object' && bal !== null) {
                                    balance = parseFloat(
                                        bal.swap || bal.module || bal.pendingSwap || bal.pendingAvailable || 0
                                    );
                                } else {
                                    balance = parseFloat(bal || tokenData.available || tokenData.swap || 0);
                                }

                                // Нормализуем тикер для проверки
                                const normalizedTicker = normalizeTicker(key);

                                // ИСПРАВЛЕНИЕ: Проверяем ВСЕ тикеры, даже с нулевым балансом (для отладки)
                                inswapTickersChecked.push({
                                    original: key,
                                    normalized: normalizedTicker,
                                    balance: balance,
                                    inWallet: walletTickers.has(normalizedTicker)
                                });

                                if (balance > 0) {
                                    // ИСПРАВЛЕНИЕ: Проверяем что тикер еще не добавлен из кошелька
                                    if (normalizedTicker && !walletTickers.has(normalizedTicker)) {
                                        uniqueTickers.add(normalizedTicker);
                                        inswapTickersAdded.push({
                                            original: key,
                                            normalized: normalizedTicker,
                                            balance: balance
                                        });
                                    } else {
                                        inswapTickersSkipped.push({
                                            original: key,
                                            normalized: normalizedTicker,
                                            reason: 'already_in_wallet',
                                            balance: balance
                                        });
                                    }
                                }
                            });

                            // Debug информация
                            debugInfo.brc20_inswap_added_tickers = inswapTickersAdded;
                            debugInfo.brc20_inswap_skipped_tickers = inswapTickersSkipped;
                            debugInfo.brc20_inswap_all_checked = inswapTickersChecked; // Все проверенные тикеры
                        }

                        // ИСПРАВЛЕНИЕ: Добавляем тикеры из /select API (включая bSATS_)
                        if (brc20Select?.data && Array.isArray(brc20Select.data)) {
                            const selectTickersAdded = [];
                            brc20Select.data.forEach(item => {
                                const rawTicker = item.tick || item.ticker || '';
                                if (!rawTicker) return;

                                const normalizedTicker = normalizeTicker(rawTicker);
                                // Проверяем баланс (brc20Balance или swapBalance)
                                const brc20Bal = parseFloat(item.brc20Balance || 0);
                                const swapBal = parseFloat(item.swapBalance || 0);
                                const totalBal = brc20Bal + swapBal;

                                if (totalBal > 0 && normalizedTicker) {
                                    selectTickersAdded.push({
                                        original: rawTicker,
                                        normalized: normalizedTicker,
                                        brc20Balance: brc20Bal,
                                        swapBalance: swapBal
                                    });
                                }
                            });
                            debugInfo.brc20_select_added = selectTickersAdded;
                        }

                        // Итог: считаем уникальные тикеры
                        // ИСПРАВЛЕНИЕ: Всегда используем подсчет уникальных тикеров (кошелек + InSwap + select)
                        brc20Count = uniqueTickers.size;
                        debugInfo.brc20_method = 'wallet_plus_inswap_positive_balance';
                        debugInfo.brc20_count_combined = true;
                        debugInfo.brc20_count_total = brc20Count;
                        debugInfo.brc20_wallet_count = walletTickers.size;

                        // ИСПРАВЛЕНИЕ: Если BRC-20 не загрузились, это будет видно в debug
                        if (brc20Count === 0) {
                            debugInfo.brc20_method = debugInfo.brc20_method || 'error_no_data';
                            debugInfo.brc20_error = 'BRC-20 data not loaded - tried all fallback methods';
                        }

                        // Debug информация
                        debugInfo.brc20_final_list = Array.from(uniqueTickers).sort();
                        debugInfo.brc20_wallet_tickers = Array.from(walletTickers).sort();
                        debugInfo.brc20_wallet_tickers_raw = unisatBrc20Summary?.data?.detail
                            ? unisatBrc20Summary.data.detail
                                  .filter(t => {
                                      const bal =
                                          parseFloat(t.availableBalance || 0) + parseFloat(t.transferableBalance || 0);
                                      return bal > 0;
                                  })
                                  .map(t => ({
                                      raw: t.ticker || t.tick || t.symbol || '',
                                      normalized: normalizeTicker(t.ticker || t.tick || t.symbol || '')
                                  }))
                            : [];
                        debugInfo.brc20_detail_length = unisatBrc20Summary?.data?.detail?.length || 0;
                        debugInfo.brc20_with_balance = unisatBrc20Summary?.data?.detail
                            ? unisatBrc20Summary.data.detail.filter(t => {
                                  const bal =
                                      parseFloat(t.availableBalance || 0) + parseFloat(t.transferableBalance || 0);
                                  return bal > 0;
                              }).length
                            : 0;

                        // ИСПРАВЛЕНИЕ: Дополнительная проверка - собираем все оригинальные тикеры для сравнения
                        if (unisatBrc20Summary?.data?.detail && Array.isArray(unisatBrc20Summary.data.detail)) {
                            const allWalletTickersRaw = unisatBrc20Summary.data.detail
                                .filter(t => {
                                    const bal =
                                        parseFloat(t.availableBalance || 0) + parseFloat(t.transferableBalance || 0);
                                    return bal > 0;
                                })
                                .map(t => {
                                    const raw = t.ticker || t.tick || t.symbol || '';
                                    return { raw, normalized: normalizeTicker(raw) };
                                });
                            debugInfo.brc20_wallet_tickers_raw = allWalletTickersRaw;
                        }

                        // Ordinals: ОПТИМИЗАЦИЯ - используем UniSat Balance API (inscriptionUtxoCount) как приоритетный источник
                        // ordinalsCount уже установлен выше из unisatBalance.data.inscriptionUtxoCount
                        if (ordinalsCount === 0) {
                            // Fallback: используем inscription-data endpoint
                            // ИСПРАВЛЕНИЕ: Добавляем debug информацию для ordinals
                            debugInfo.ordinals_data_exists = !!ordinalsInscriptionData;
                            debugInfo.ordinals_data_type = typeof ordinalsInscriptionData;
                            debugInfo.ordinals_data_structure_debug = ordinalsInscriptionData
                                ? typeof ordinalsInscriptionData === 'object'
                                    ? Object.keys(ordinalsInscriptionData)
                                    : typeof ordinalsInscriptionData
                                : 'null';
                            debugInfo.ordinals_data_has_total = ordinalsInscriptionData?.total !== undefined;
                            debugInfo.ordinals_data_has_data_total = ordinalsInscriptionData?.data?.total !== undefined;
                            debugInfo.ordinals_data_is_array = Array.isArray(ordinalsInscriptionData);

                            // ОПТИМИЗАЦИЯ: Используем только inscription-data endpoint (основной метод)
                            // Уменьшен лимит до 50, но если нужно больше, используем total если доступен
                            if (ordinalsInscriptionData) {
                                if (ordinalsInscriptionData.data?.total !== undefined) {
                                    // Если есть total, используем его (более точно)
                                    ordinalsCount = Number(ordinalsInscriptionData.data.total) || 0;
                                    debugInfo.ordinals_method = 'inscription_data_total';
                                } else if (ordinalsInscriptionData.total !== undefined) {
                                    ordinalsCount = Number(ordinalsInscriptionData.total) || 0;
                                    debugInfo.ordinals_method = 'inscription_data_total_direct';
                                } else if (
                                    ordinalsInscriptionData.data?.list &&
                                    Array.isArray(ordinalsInscriptionData.data.list)
                                ) {
                                    // Если нет total, считаем из списка (но это только первые 50)
                                    ordinalsCount = ordinalsInscriptionData.data.list.filter(insc => {
                                        const ct = insc.contentType || insc.content_type || '';
                                        return (
                                            (ct.includes('image') ||
                                                ct.includes('video') ||
                                                ct.includes('audio') ||
                                                ct.includes('text')) &&
                                            !ct.includes('application/json')
                                        );
                                    }).length;
                                    debugInfo.ordinals_method = 'inscription_data_list_filtered';
                                    debugInfo.ordinals_note = 'Only first 50 inscriptions counted (limit=50)';
                                } else if (
                                    ordinalsInscriptionData.data &&
                                    Array.isArray(ordinalsInscriptionData.data)
                                ) {
                                    ordinalsCount = ordinalsInscriptionData.data.filter(insc => {
                                        const ct = insc.contentType || insc.content_type || '';
                                        return (
                                            (ct.includes('image') ||
                                                ct.includes('video') ||
                                                ct.includes('audio') ||
                                                ct.includes('text')) &&
                                            !ct.includes('application/json')
                                        );
                                    }).length;
                                    debugInfo.ordinals_method = 'inscription_data_array_filtered';
                                    debugInfo.ordinals_note = 'Only first 50 inscriptions counted (limit=50)';
                                }
                            }
                        }

                        // ОПТИМИЗАЦИЯ: Убраны все fallback методы для ordinals - используем только inscription-data для ускорения
                        if (ordinalsCount === 0) {
                            debugInfo.ordinals_method = ordinalsInscriptionData
                                ? 'inscription_data_empty'
                                : 'error_no_data';
                            debugInfo.ordinals_error = 'Ordinals data not loaded - using only inscription-data method';
                        }

                        // E. LP Value (ИСПРАВЛЕНИЕ: используем новый метод из кода Gemini + fallback)
                        let lpCount = 0;
                        let lpValueFB = 0;
                        let lpValueUSD = 0; // ИСПРАВЛЕНИЕ: Добавляем расчет в долларах
                        let hasFennecInLP = false; // ИСПРАВЛЕНИЕ: Проверяем есть ли LP с FENNEC
                        let fennecLpValueUSD = 0;

                        // ИСПРАВЛЕНИЕ: Добавляем подробный debug для LP
                        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем структуру ответа my_pool_list из backup версии
                        debugInfo.my_pool_list_response = myPoolList
                            ? JSON.stringify(myPoolList).substring(0, 500)
                            : 'null';
                        debugInfo.my_pool_list_code = myPoolList?.code;
                        debugInfo.my_pool_list_msg = myPoolList?.msg || myPoolList?.message;
                        // КРИТИЧЕСКОЕ: Проверяем структуру данных из backup версии
                        debugInfo.my_pool_list_has_data = !!myPoolList?.data;
                        debugInfo.my_pool_list_structure = myPoolList ? Object.keys(myPoolList) : 'null';
                        debugInfo.my_pool_list_length = myPoolList?.data?.list?.length || 0;
                        debugInfo.my_pool_list_data_keys = myPoolList?.data ? Object.keys(myPoolList.data) : 'no data';
                        debugInfo.all_balance_code = allBalance?.code;
                        debugInfo.all_balance_msg = allBalance?.msg || allBalance?.message;
                        debugInfo.inswap_asset_summary_has_data = !!inswapAssetSummary?.data;
                        debugInfo.inswap_asset_summary_structure = inswapAssetSummary
                            ? Object.keys(inswapAssetSummary)
                            : 'null';

                        // Метод 0 (НОВЫЙ ПРИОРИТЕТ): InSwap Asset Summary API (из кода Gemini)
                        // КРИТИЧЕСКОЕ: Используем новый эндпоинт /brc20-swap/address/{address}/asset-summary
                        if (inswapAssetSummary?.data && Array.isArray(inswapAssetSummary.data)) {
                            const swapAssets = inswapAssetSummary.data;
                            debugInfo.lp_method = 'inswap_asset_summary';
                            debugInfo.inswap_asset_summary_count = swapAssets.length;

                            swapAssets.forEach(asset => {
                                const ticker = (asset.ticker || '').toUpperCase();
                                const amount = parseFloat(asset.balance || 0);

                                // Проверяем, является ли актив LP-токеном (обычно содержит '/' или '-')
                                if (ticker.includes('/') || ticker.includes('-')) {
                                    // Это пул! Например "FB/FENNEC" или "FB-FENNEC"
                                    if (ticker.includes('FENNEC')) {
                                        hasFennecInLP = true;
                                        debugInfo.has_fennec_in_lp_found = true;
                                        debugInfo.has_fennec_in_lp_pool = ticker;
                                    }
                                    lpCount++;

                                    // Упрощенная оценка: если API не дает цену LP, считаем как 0
                                    // Но если это FB, считаем по цене FB
                                    // TODO: Нужно получить цену LP из API или рассчитать из amount0/amount1
                                } else {
                                    // Это просто токены, лежащие внутри Inswap (не в пуле, но на балансе свапа)
                                    // Не считаем их как LP, только как баланс в InSwap
                                }
                            });
                        }

                        // Метод 1: my_pool_list (FALLBACK)
                        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем структуру ответа из backup версии
                        // ИСПРАВЛЕНИЕ: По документации API нет поля lpUSD, только amount0, amount1, lp, shareOfPool
                        // Рассчитываем стоимость LP из amount0 и amount1, используя цены токенов
                        if (
                            (lpCount === 0 || (lpValueUSD === 0 && lpValueFB === 0)) &&
                            myPoolList?.code === 0 &&
                            myPoolList?.data?.list &&
                            Array.isArray(myPoolList.data.list)
                        ) {
                            lpCount = myPoolList.data.list.length;
                            debugInfo.lp_method = 'my_pool_list_calculated';

                            // ИСПРАВЛЕНИЕ: Проверяем есть ли FENNEC в пулах ДО расчета стоимости
                            myPoolList.data.list.forEach(pool => {
                                const tick0 = pool.tick0 || '';
                                const tick1 = pool.tick1 || '';
                                const amount0 = parseFloat(pool.amount0 || 0);
                                const amount1 = parseFloat(pool.amount1 || 0);

                                // ИСПРАВЛЕНИЕ: Проверяем есть ли FENNEC в пуле (строгая проверка)
                                if ((tick0 === 'FENNEC' || tick1 === 'FENNEC') && (amount0 > 0 || amount1 > 0)) {
                                    hasFennecInLP = true;
                                    debugInfo.has_fennec_in_lp_found = true;
                                    debugInfo.has_fennec_in_lp_pool = { tick0, tick1, amount0, amount1 };
                                }
                            });

                            // Проверяем есть ли totalLpUSD в ответе (может быть в некоторых версиях API)
                            if (myPoolList.data.totalLpUSD) {
                                debugInfo.lp_total_lpUSD = myPoolList.data.totalLpUSD;
                                lpValueUSD = parseFloat(myPoolList.data.totalLpUSD) || 0;
                                if (fbPrice > 0) {
                                    lpValueFB = lpValueUSD / fbPrice;
                                }

                                // Отдельно считаем LP именно по паре с FENNEC (для скидки)
                                try {
                                    myPoolList.data.list.forEach(pool => {
                                        const tick0 = pool.tick0 || '';
                                        const tick1 = pool.tick1 || '';
                                        if (tick0 !== 'FENNEC' && tick1 !== 'FENNEC') return;
                                        const amount0 = parseFloat(pool.amount0 || 0);
                                        const amount1 = parseFloat(pool.amount1 || 0);
                                        let price0 = 0;
                                        let price1 = 0;
                                        if (tick0 === 'sFB___000' || tick0.includes('FB')) price0 = fbPrice;
                                        else if (tick0 === 'FENNEC')
                                            price0 = fennecPriceInFB > 0 ? fennecPriceInFB * fbPrice : 0;
                                        else if (tick0 === 'sBTC___000' || tick0.includes('BTC')) price0 = btcPrice;
                                        if (tick1 === 'sFB___000' || tick1.includes('FB')) price1 = fbPrice;
                                        else if (tick1 === 'FENNEC')
                                            price1 = fennecPriceInFB > 0 ? fennecPriceInFB * fbPrice : 0;
                                        else if (tick1 === 'sBTC___000' || tick1.includes('BTC')) price1 = btcPrice;
                                        const poolValueUSD = amount0 * price0 + amount1 * price1;
                                        fennecLpValueUSD += poolValueUSD;
                                    });
                                } catch (e) {}
                            } else {
                                // Рассчитываем из amount0 и amount1
                                myPoolList.data.list.forEach(pool => {
                                    const tick0 = pool.tick0 || '';
                                    const tick1 = pool.tick1 || '';
                                    const amount0 = parseFloat(pool.amount0 || 0);
                                    const amount1 = parseFloat(pool.amount1 || 0);

                                    // Определяем цены токенов
                                    let price0 = 0;
                                    let price1 = 0;

                                    // Для sFB___000 используем fbPrice
                                    if (tick0 === 'sFB___000' || tick0.includes('FB')) {
                                        price0 = fbPrice;
                                    } else if (tick0 === 'FENNEC') {
                                        price0 = fennecPriceInFB > 0 ? fennecPriceInFB * fbPrice : 0;
                                    } else if (tick0 === 'sBTC___000' || tick0.includes('BTC')) {
                                        price0 = btcPrice;
                                    }

                                    if (tick1 === 'sFB___000' || tick1.includes('FB')) {
                                        price1 = fbPrice;
                                    } else if (tick1 === 'FENNEC') {
                                        price1 = fennecPriceInFB > 0 ? fennecPriceInFB * fbPrice : 0;
                                    } else if (tick1 === 'sBTC___000' || tick1.includes('BTC')) {
                                        price1 = btcPrice;
                                    }

                                    // Рассчитываем стоимость LP позиции в USD
                                    const value0USD = amount0 * price0;
                                    const value1USD = amount1 * price1;
                                    const poolValueUSD = value0USD + value1USD;

                                    lpValueUSD += poolValueUSD;

                                    if (tick0 === 'FENNEC' || tick1 === 'FENNEC') {
                                        fennecLpValueUSD += poolValueUSD;
                                    }

                                    // Конвертируем в FB для унификации ответа
                                    if (fbPrice > 0) {
                                        lpValueFB += poolValueUSD / fbPrice;
                                    } else {
                                        // Если цены нет, используем amount1 (обычно это FB в паре)
                                        // Но только если это действительно FB, иначе пропускаем
                                        if (tick1 === 'sFB___000' || tick1.includes('FB')) {
                                            lpValueFB += amount1 * 2; // Примерная оценка (amount1 * 2 = общая ликвидность)
                                        } else if (tick0 === 'sFB___000' || tick0.includes('FB')) {
                                            lpValueFB += amount0 * 2;
                                        }
                                    }
                                });
                            }
                        } else if (myPoolList?.code !== undefined) {
                            // Если есть код ответа, но нет данных - логируем для отладки
                            debugInfo.lp_method = 'my_pool_list_error';
                            debugInfo.my_pool_list_error_code = myPoolList.code;
                            debugInfo.my_pool_list_error_msg = myPoolList.msg || myPoolList.message || 'unknown';
                        }

                        // ИСПРАВЛЕНИЕ: Используем fallback из all_balance, если my_pool_list не загрузился или вернул 404
                        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем также totalLpUSD в all_balance
                        if ((lpCount === 0 || (lpValueUSD === 0 && lpValueFB === 0)) && allBalance?.data) {
                            // Проверяем totalLpUSD в all_balance (может быть в корне data)
                            if (allBalance.data.totalLpUSD) {
                                lpValueUSD = parseFloat(allBalance.data.totalLpUSD) || 0;
                                if (fbPrice > 0) {
                                    lpValueFB = lpValueUSD / fbPrice;
                                }
                                lpCount = 1; // Устанавливаем count если есть LP
                                debugInfo.lp_method = 'all_balance_totalLpUSD';
                                debugInfo.lp_total_lpUSD = allBalance.data.totalLpUSD;
                                debugInfo.lp_included_in_all_tokens = true; // Уже добавлено выше

                                // Если доступны позиции LP, считаем отдельную сумму по пулам с FENNEC
                                if (allBalance.data.lp_positions && Array.isArray(allBalance.data.lp_positions)) {
                                    allBalance.data.lp_positions.forEach(lpPos => {
                                        const tick0 = lpPos.tick0 || '';
                                        const tick1 = lpPos.tick1 || '';
                                        if (tick0 !== 'FENNEC' && tick1 !== 'FENNEC') return;
                                        const amount0 = parseFloat(lpPos.amount0 || 0);
                                        const amount1 = parseFloat(lpPos.amount1 || 0);
                                        let price0 = 0;
                                        let price1 = 0;
                                        if (tick0 === 'sFB___000' || tick0.includes('FB')) price0 = fbPrice;
                                        else if (tick0 === 'FENNEC')
                                            price0 = fennecPriceInFB > 0 ? fennecPriceInFB * fbPrice : 0;
                                        else if (tick0 === 'sBTC___000' || tick0.includes('BTC')) price0 = btcPrice;
                                        if (tick1 === 'sFB___000' || tick1.includes('FB')) price1 = fbPrice;
                                        else if (tick1 === 'FENNEC')
                                            price1 = fennecPriceInFB > 0 ? fennecPriceInFB * fbPrice : 0;
                                        else if (tick1 === 'sBTC___000' || tick1.includes('BTC')) price1 = btcPrice;
                                        const poolValueUSD = amount0 * price0 + amount1 * price1;
                                        fennecLpValueUSD += poolValueUSD;
                                    });
                                }
                            } else if (allBalance.data.lp_positions && Array.isArray(allBalance.data.lp_positions)) {
                                // Рассчитываем LP из lp_positions
                                lpCount = allBalance.data.lp_positions.length;
                                allBalance.data.lp_positions.forEach(lpPos => {
                                    const amount0 = parseFloat(lpPos.amount0 || 0);
                                    const amount1 = parseFloat(lpPos.amount1 || 0);
                                    const tick0 = lpPos.tick0 || '';
                                    const tick1 = lpPos.tick1 || '';

                                    // Определяем цены
                                    let price0 = 0;
                                    let price1 = 0;

                                    if (tick0 === 'sFB___000' || tick0.includes('FB')) {
                                        price0 = fbPrice;
                                    } else if (tick0 === 'FENNEC') {
                                        price0 = fennecPriceInFB > 0 ? fennecPriceInFB * fbPrice : 0;
                                    } else if (tick0 === 'sBTC___000' || tick0.includes('BTC')) {
                                        price0 = btcPrice;
                                    }

                                    if (tick1 === 'sFB___000' || tick1.includes('FB')) {
                                        price1 = fbPrice;
                                    } else if (tick1 === 'FENNEC') {
                                        price1 = fennecPriceInFB > 0 ? fennecPriceInFB * fbPrice : 0;
                                    } else if (tick1 === 'sBTC___000' || tick1.includes('BTC')) {
                                        price1 = btcPrice;
                                    }

                                    const value0USD = amount0 * price0;
                                    const value1USD = amount1 * price1;
                                    const poolValueUSD = value0USD + value1USD;

                                    lpValueUSD += poolValueUSD;

                                    if (tick0 === 'FENNEC' || tick1 === 'FENNEC') {
                                        fennecLpValueUSD += poolValueUSD;
                                    }

                                    if (fbPrice > 0) {
                                        lpValueFB += poolValueUSD / fbPrice;
                                    }

                                    // Проверяем есть ли FENNEC в пуле
                                    if ((tick0 === 'FENNEC' || tick1 === 'FENNEC') && (amount0 > 0 || amount1 > 0)) {
                                        hasFennecInLP = true;
                                    }
                                });
                                debugInfo.lp_method = 'all_balance_lp_positions';
                                debugInfo.lp_fallback_used = true;
                            }
                        }

                        // Финальная проверка LP
                        if (lpCount === 0) {
                            debugInfo.lp_method = debugInfo.lp_method || 'error_no_data';
                            debugInfo.lp_error = 'LP data not loaded - no fallback methods available';
                        }

                        // ИСПРАВЛЕНИЕ: Убран fallback метод user_positions для LP - используем только my_pool_list
                        // Если LP не загрузились, это будет видно в debug

                        // ИСПРАВЛЕНИЕ: Если lpValueUSD не был рассчитан, конвертируем из FB
                        if (lpValueUSD === 0 && lpValueFB > 0 && fbPrice > 0) {
                            lpValueUSD = lpValueFB * fbPrice;
                        }

                        // ИСПРАВЛЕНИЕ: Нативный баланс FENNEC берем из brc20 summary (кошелек) + allBalance (InSwap)
                        // Поддерживаем разные структуры ответа (brc20-prog и brc20)
                        let fennecNativeBalance = 0;
                        let fennecWalletBalance = 0;
                        let fennecInSwapBalance = 0;

                        // 1. FENNEC на кошельке (из brc20 summary)
                        if (unisatBrc20Summary?.data) {
                            let tokensList = [];

                            // Проверяем разные возможные структуры ответа
                            if (unisatBrc20Summary.data.detail && Array.isArray(unisatBrc20Summary.data.detail)) {
                                tokensList = unisatBrc20Summary.data.detail;
                            } else if (unisatBrc20Summary.data.list && Array.isArray(unisatBrc20Summary.data.list)) {
                                tokensList = unisatBrc20Summary.data.list;
                            } else if (Array.isArray(unisatBrc20Summary.data)) {
                                tokensList = unisatBrc20Summary.data;
                            }

                            if (tokensList.length > 0) {
                                const fen = tokensList.find(t => {
                                    const raw = t.ticker || t.tick || t.symbol || '';
                                    return raw.toUpperCase() === 'FENNEC';
                                });
                                if (fen) {
                                    // ИСПРАВЛЕНИЕ: brc20-prog может иметь другие поля для баланса
                                    const avail = parseFloat(fen.availableBalance || fen.balance || 0);
                                    const trans = parseFloat(fen.transferableBalance || 0);
                                    fennecWalletBalance = avail + trans || 0;
                                    debugInfo.fennec_balance_method = 'brc20_summary_detail';
                                }
                            }
                        }

                        // 2. FENNEC в InSwap (из all_balance)
                        if (allBalance?.data?.FENNEC) {
                            const fennecData = allBalance.data.FENNEC;
                            const bal = fennecData.balance || fennecData;
                            if (typeof bal === 'object' && bal !== null) {
                                fennecInSwapBalance = parseFloat(
                                    bal.swap || bal.module || bal.pendingSwap || bal.pendingAvailable || 0
                                );
                            } else {
                                fennecInSwapBalance = parseFloat(bal || 0);
                            }
                            debugInfo.fennec_inswap_balance = fennecInSwapBalance;
                        }

                        // 3. Суммируем: кошелек + InSwap
                        fennecNativeBalance = fennecWalletBalance + fennecInSwapBalance;
                        debugInfo.fennec_native_balance = fennecNativeBalance;
                        debugInfo.fennec_wallet_balance = fennecWalletBalance;
                        debugInfo.fennec_inswap_balance = fennecInSwapBalance;

                        // FENNEC BOXES: владельцам коллекции выдаем максимальные перки (скидка/бейдж/сердце) на уровне карточки
                        let fennecBoxesCount = 0;
                        let hasFennecBoxes = false;
                        try {
                            if (API_KEY) {
                                const boxesRes = await safeFetch(
                                    () =>
                                        fetch(
                                            'https://open-api-fractal.unisat.io/v3/market/collection/auction/collection_inscriptions',
                                            {
                                                method: 'POST',
                                                headers: {
                                                    ...unisatApiHeaders,
                                                    ...authHeaders(),
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify({
                                                    collectionId: 'fennec_boxes',
                                                    address,
                                                    start: 0,
                                                    limit: 1
                                                })
                                            }
                                        ),
                                    {
                                        isUniSat: true,
                                        useCache: true,
                                        cacheKey: `fennec_boxes_${address}`,
                                        retryOn429: true
                                    }
                                );

                                const totalRaw = boxesRes?.data?.total;
                                const listLen = Array.isArray(boxesRes?.data?.list) ? boxesRes.data.list.length : 0;
                                fennecBoxesCount = Number(totalRaw ?? listLen ?? 0) || 0;
                                hasFennecBoxes = fennecBoxesCount > 0;
                            }
                        } catch (e) {
                            // silent
                        }
                        debugInfo.has_fennec_boxes = hasFennecBoxes;
                        debugInfo.fennec_boxes_count = fennecBoxesCount;

                        // ИСПРАВЛЕНИЕ: Баланс FB в InSwap (sFB___000). Нужен на клиенте для корректного fbTotal.
                        let fbInSwapBalance = 0;
                        if (allBalance?.data?.sFB___000) {
                            const sfbData = allBalance.data.sFB___000;
                            const bal = sfbData.balance || sfbData;
                            if (typeof bal === 'object' && bal !== null) {
                                fbInSwapBalance = parseFloat(
                                    bal.swap ||
                                        bal.module ||
                                        bal.pendingSwap ||
                                        bal.pendingAvailable ||
                                        bal.available ||
                                        bal.total ||
                                        0
                                );
                            } else {
                                fbInSwapBalance = parseFloat(bal || 0);
                            }
                        }
                        debugInfo.fb_inswap_balance = fbInSwapBalance;

                        // ИСПРАВЛЕНИЕ: Поиск стейкинга перенесен на клиентскую сторону для ускорения загрузки
                        // ИСПРАВЛЕНИЕ: Стейкинг временно отключен - сканирование транзакций занимает слишком много времени для адресов с большим количеством транзакций
                        // В будущем можно реализовать через API или оптимизированный метод
                        const stakedFB = 0;
                        debugInfo.staked_fb = 0;
                        debugInfo.staking_method = 'disabled';
                        debugInfo.staking_note =
                            'Staking detection temporarily disabled - scanning transactions is too slow for addresses with many transactions';

                        // ИСПРАВЛЕНИЕ: Рассчитываем стоимость ВСЕХ токенов из InSwap (включая Bitcoin, Wangcai и другие)
                        // ВАЖНО: Исключаем sFB и FENNEC, так как они уже учтены в fbSwapBal и fennecSwapBal
                        // КРИТИЧЕСКОЕ: Включаем LP в общую стоимость токенов
                        let allTokensValueUSD = 0;
                        const allTokensDetails = {};

                        // ИСПРАВЛЕНИЕ: Проверяем total_usd из all_balance (если доступен)
                        // all_balance может содержать поле total_usd с общим балансом в долларах
                        // КРИТИЧЕСКОЕ: total_usd может включать LP, поэтому используем его как приоритетный источник
                        let allBalanceTotalUSD = 0;
                        if (allBalance?.data?.total_usd !== undefined) {
                            allBalanceTotalUSD = parseFloat(allBalance.data.total_usd) || 0;
                            debugInfo.all_balance_total_usd_found = true;
                            debugInfo.all_balance_total_usd_value = allBalanceTotalUSD;
                        }

                        // ИСПРАВЛЕНИЕ: LP НЕ добавляем в all_tokens_value_usd здесь
                        // LP уже учитывается отдельно в Net Worth через lpValueUSD
                        // Если добавить LP здесь, он будет учтен дважды (здесь + в fbValueUSD)

                        // ИСПРАВЛЕНИЕ: Используем allBalance для расчета стоимости токенов
                        // КРИТИЧЕСКОЕ: Учитываем ТОЛЬКО токены из InSwap (all_balance), не добавляем токены из кошелька
                        // Это предотвращает подсчет токенов с 0 объемом, но высокой ценой
                        if (allBalance?.data) {
                            // Проходим по всем ключам в allBalance.data
                            Object.keys(allBalance.data).forEach(ticker => {
                                const tokenData = allBalance.data[ticker];

                                // Пропускаем только служебные поля
                                if (
                                    ticker === 'lp_positions' ||
                                    ticker === 'positions' ||
                                    ticker === 'total_usd' ||
                                    typeof tokenData !== 'object' ||
                                    !tokenData
                                ) {
                                    return;
                                }

                                // ИСПРАВЛЕНИЕ: Исключаем только sFB, так как он уже учтен в fbSwapBal
                                // FENNEC теперь учитывается вместе с остальными токенами в Net Worth
                                const normalizedTicker = ticker
                                    .replace(/___\d+$/, '')
                                    .toUpperCase()
                                    .replace(/_+$/, '');
                                if (normalizedTicker === 'SFB') {
                                    return; // Пропускаем sFB, так как уже учтен в fbSwapBal
                                }
                                // FENNEC теперь учитывается в all_tokens_value_usd

                                // ИСПРАВЛЕНИЕ: Извлекаем баланс с учетом разных структур (balance может быть объектом)
                                let balance = 0;
                                const bal = tokenData.balance || tokenData;

                                // Поддержка разных структур: { balance: { swap: X, module: Y } } или { balance: X }
                                if (typeof bal === 'object' && bal !== null) {
                                    balance = parseFloat(
                                        bal.swap ||
                                            bal.module ||
                                            bal.pendingSwap ||
                                            bal.pendingAvailable ||
                                            bal.available ||
                                            bal.total ||
                                            0
                                    );
                                } else {
                                    balance = parseFloat(bal || tokenData.available || tokenData.total || 0);
                                }

                                if (balance > 0) {
                                    let tokenValueUSD = 0;

                                    // ИСПРАВЛЕНИЕ: Используем цену из all_balance (она уже в USD)
                                    const price = parseFloat(tokenData.price || 0);

                                    if (price > 0) {
                                        // Цена уже в USD (из all_balance API)
                                        tokenValueUSD = balance * price;
                                    } else {
                                        // Альтернативный метод: конвертируем через FB или BTC если цена не указана
                                        // ИСПРАВЛЕНИЕ: Учитываем все токены, включая sBTC, sFB, FENNEC
                                        if (ticker === 'sBTC___000' || ticker === 'sBTC' || ticker === 'BTC') {
                                            tokenValueUSD = balance * btcPrice;
                                        } else if (ticker === 'sFB___000' || ticker === 'sFB' || ticker === 'FB') {
                                            tokenValueUSD = balance * fbPrice;
                                        } else if (ticker === 'FENNEC') {
                                            // FENNEC через цену в FB
                                            if (fennecPriceInFB > 0 && fbPrice > 0) {
                                                tokenValueUSD = balance * fennecPriceInFB * fbPrice;
                                            }
                                        } else {
                                            // Для других токенов (например, wangcai) пытаемся найти цену
                                            // Если есть цена в FB, конвертируем
                                            const priceInFB = parseFloat(
                                                tokenData.priceInFB || tokenData.price_fb || 0
                                            );
                                            if (priceInFB > 0 && fbPrice > 0) {
                                                tokenValueUSD = balance * priceInFB * fbPrice;
                                            } else if (btcPrice > 0) {
                                                // Альтернативный метод: через BTC (если есть цена в BTC)
                                                const priceInBTC = parseFloat(
                                                    tokenData.priceInBTC || tokenData.price_btc || 0
                                                );
                                                if (priceInBTC > 0) {
                                                    tokenValueUSD = balance * priceInBTC * btcPrice;
                                                }
                                            }
                                        }
                                    }

                                    if (tokenValueUSD > 0) {
                                        allTokensValueUSD += tokenValueUSD;
                                        allTokensDetails[ticker] = {
                                            balance: balance,
                                            valueUSD: tokenValueUSD,
                                            price: price || tokenValueUSD / balance
                                        };
                                    }
                                }
                            });
                        }

                        // ИСПРАВЛЕНИЕ: Если total_usd доступен из all_balance, используем его как приоритетный источник
                        // ИСПРАВЛЕНИЕ: НЕ добавляем LP в all_tokens_value_usd, так как LP уже включен в total_usd из all_balance
                        // LP value уже учтен в all_balance.total_usd, поэтому не нужно добавлять его отдельно
                        if (allBalanceTotalUSD > 0) {
                            // ВАЖНО: На клиенте netWorth считается как all_tokens_value_usd + lp_value_usd.
                            // Поэтому здесь держим all_tokens_value_usd БЕЗ LP (вычитаем LP из total_usd),
                            // иначе LP будет учтен дважды.
                            allTokensValueUSD = Math.max(0, allBalanceTotalUSD - lpValueUSD);
                            debugInfo.all_tokens_value_usd_source = 'all_balance_total_usd';
                            debugInfo.all_tokens_value_usd_calculated = allTokensValueUSD;
                            debugInfo.lp_included_in_all_tokens = false;
                            debugInfo.all_balance_total_usd_includes_lp = true;
                            debugInfo.all_tokens_value_usd_lp_subtracted = lpValueUSD;
                        } else if (allTokensValueUSD > 0) {
                            // ИСПРАВЛЕНИЕ: НЕ добавляем LP, так как он уже должен быть учтен в all_balance или будет учтен отдельно
                            debugInfo.all_tokens_value_usd_source = 'calculated_from_prices';
                        } else {
                            // FALLBACK: Если all_balance недоступен (429 error), пытаемся рассчитать из доступных данных
                            // Используем FENNEC balance * price как минимальную оценку
                            const fennecBalance = parseFloat(fennecNativeBalance || 0);
                            const fennecPrice = fbPrice * 0.0005; // Примерная цена FENNEC в USD (fallback)
                            allTokensValueUSD = fennecBalance * fennecPrice;
                            debugInfo.all_tokens_value_usd_source = 'fallback_fennec_estimate';
                            debugInfo.all_tokens_value_usd_fallback_note =
                                'all_balance returned 429, using FENNEC balance estimate';
                        }

                        // ИСПРАВЛЕНИЕ: Добавляем токены с кошелька, которых нет в InSwap (например, BITMAP)
                        // Эти токены торгуются, но не находятся на InSwap, поэтому их нужно учесть отдельно
                        const walletTokensNotInInSwap = {};
                        let walletTokensValueUSD = 0;

                        if (unisatBrc20Summary?.data) {
                            let tokensList = [];
                            if (unisatBrc20Summary.data.detail && Array.isArray(unisatBrc20Summary.data.detail)) {
                                tokensList = unisatBrc20Summary.data.detail;
                            } else if (unisatBrc20Summary.data.list && Array.isArray(unisatBrc20Summary.data.list)) {
                                tokensList = unisatBrc20Summary.data.list;
                            } else if (Array.isArray(unisatBrc20Summary.data)) {
                                tokensList = unisatBrc20Summary.data;
                            }

                            // Получаем список токенов из InSwap для сравнения
                            const inswapTickers = new Set();
                            if (allBalance?.data) {
                                Object.keys(allBalance.data).forEach(key => {
                                    if (['lp_positions', 'positions', 'total_usd'].includes(key)) return;
                                    const normalized = normalizeTicker(key.replace(/___\d+$/, '').toUpperCase());
                                    if (normalized) inswapTickers.add(normalized);
                                });
                            }

                            // Проходим по токенам с кошелька
                            tokensList.forEach(t => {
                                const ticker = (t.ticker || t.tick || t.symbol || '').toUpperCase();
                                if (!ticker) return;

                                const normalizedTicker = normalizeTicker(ticker);

                                // Пропускаем токены, которые уже есть в InSwap
                                if (inswapTickers.has(normalizedTicker)) return;

                                // Получаем баланс токена
                                const bal =
                                    parseFloat(t.availableBalance || t.balance || 0) +
                                    parseFloat(t.transferableBalance || 0);

                                if (bal > 0) {
                                    // ИСПРАВЛЕНИЕ: Пытаемся найти цену для токена
                                    // Для токенов, которые торгуются, но не на InSwap, можно использовать примерную оценку
                                    // Или попытаться получить цену через API (если доступно)
                                    const tokenValueUSD = 0;

                                    // Пока используем минимальную оценку: если токен торгуется, но цена неизвестна, пропускаем
                                    // В будущем можно добавить запрос к API для получения цен токенов
                                    // Для BITMAP и других популярных токенов можно добавить hardcoded цены или API запрос

                                    // Пока не добавляем токены без цены, чтобы не завышать Net Worth
                                    // Это можно будет улучшить, добавив API для получения цен токенов

                                    if (tokenValueUSD > 0) {
                                        walletTokensValueUSD += tokenValueUSD;
                                        walletTokensNotInInSwap[normalizedTicker] = {
                                            balance: bal,
                                            valueUSD: tokenValueUSD,
                                            price: tokenValueUSD / bal
                                        };
                                    }
                                }
                            });
                        }

                        // Добавляем стоимость токенов с кошелька к общей стоимости
                        allTokensValueUSD += walletTokensValueUSD;
                        Object.assign(allTokensDetails, walletTokensNotInInSwap);

                        debugInfo.wallet_tokens_not_in_inswap = Object.keys(walletTokensNotInInSwap);
                        debugInfo.wallet_tokens_value_usd = walletTokensValueUSD;
                        debugInfo.all_tokens_count = Object.keys(allTokensDetails).length;
                        debugInfo.all_tokens_value_usd = allTokensValueUSD;
                        debugInfo.all_tokens_list = Object.keys(allTokensDetails);
                        debugInfo.all_balance_tokens_processed = Object.keys(allTokensDetails);
                        debugInfo.all_balance_calculation_debug = {
                            sFB_balance: allBalance?.data?.sFB___000?.balance,
                            sFB_price: allBalance?.data?.sFB___000?.price,
                            sBTC_balance: allBalance?.data?.sBTC___000?.balance,
                            sBTC_price: allBalance?.data?.sBTC___000?.price,
                            FENNEC_balance: allBalance?.data?.FENNEC?.balance,
                            FENNEC_price: allBalance?.data?.FENNEC?.price,
                            wangcai_balance: allBalance?.data?.wangcai?.balance,
                            wangcai_price: allBalance?.data?.wangcai?.price,
                            fbPrice_used: fbPrice,
                            btcPrice_used: btcPrice
                        };

                        // ИСПРАВЛЕНИЕ: Если all_balance не загрузился, добавляем sFB и FENNEC из allBalance в расчет
                        // (если они есть в allBalance, но были пропущены выше)
                        if (allBalance?.data && allBalanceTotalUSD <= 0) {
                            // Добавляем sFB из all_balance (если не был добавлен выше)
                            if (allBalance.data.sFB___000 && !allTokensDetails['sFB___000']) {
                                const sFbBalance = parseFloat(allBalance.data.sFB___000.balance || 0);
                                const sFbPrice = parseFloat(allBalance.data.sFB___000.price || 0);
                                if (sFbBalance > 0) {
                                    const sFbValueUSD = sFbPrice > 0 ? sFbBalance * sFbPrice : sFbBalance * fbPrice;
                                    if (sFbValueUSD > 0) {
                                        allTokensValueUSD += sFbValueUSD;
                                        allTokensDetails['sFB___000'] = {
                                            balance: sFbBalance,
                                            valueUSD: sFbValueUSD,
                                            price: sFbPrice || fbPrice
                                        };
                                    }
                                }
                            }

                            // Добавляем FENNEC из all_balance (если не был добавлен выше)
                            if (allBalance.data.FENNEC && !allTokensDetails['FENNEC']) {
                                const fennecBalance = parseFloat(allBalance.data.FENNEC.balance || 0);
                                const fennecPrice = parseFloat(allBalance.data.FENNEC.price || 0);
                                if (fennecBalance > 0) {
                                    let fennecValueUSD = 0;
                                    if (fennecPrice > 0) {
                                        fennecValueUSD = fennecBalance * fennecPrice;
                                    } else if (fennecPriceInFB > 0 && fbPrice > 0) {
                                        fennecValueUSD = fennecBalance * fennecPriceInFB * fbPrice;
                                    }
                                    if (fennecValueUSD > 0) {
                                        allTokensValueUSD += fennecValueUSD;
                                        allTokensDetails['FENNEC'] = {
                                            balance: fennecBalance,
                                            valueUSD: fennecValueUSD,
                                            price: fennecPrice || fennecPriceInFB * fbPrice
                                        };
                                    }
                                }
                            }

                            // Добавляем sBTC из all_balance
                            if (allBalance.data.sBTC___000 && !allTokensDetails['sBTC___000']) {
                                const sBtcBalance = parseFloat(allBalance.data.sBTC___000.balance || 0);
                                const sBtcPrice = parseFloat(allBalance.data.sBTC___000.price || 0);
                                if (sBtcBalance > 0) {
                                    const sBtcValueUSD =
                                        sBtcPrice > 0 ? sBtcBalance * sBtcPrice : sBtcBalance * btcPrice;
                                    if (sBtcValueUSD > 0) {
                                        allTokensValueUSD += sBtcValueUSD;
                                        allTokensDetails['sBTC___000'] = {
                                            balance: sBtcBalance,
                                            valueUSD: sBtcValueUSD,
                                            price: sBtcPrice || btcPrice
                                        };
                                    }
                                }
                            }
                        }

                        // Дополняем debug информацию вычисленными значениями (ПЕРЕД возвратом)
                        debugInfo.calculated_utxo = utxoCount || 0;
                        debugInfo.calculated_runes = runesCount || 0;
                        debugInfo.calculated_ordinals = ordinalsCount || 0;
                        debugInfo.calculated_lp_count = lpCount || 0;
                        debugInfo.calculated_lp_value_fb = lpValueFB || 0;
                        debugInfo.calculated_lp_value_usd = lpValueUSD || 0;

                        const response = sendJSON({
                            code: 0,
                            data: {
                                schema_version: 1,
                                tx_count: txCount,
                                utxo_count: utxoCount,
                                native_balance: nativeBalance,
                                fb_inswap_balance: fbInSwapBalance,
                                fennec_native_balance: fennecNativeBalance, // ИСПРАВЛЕНИЕ: Добавляем нативный баланс FENNEC
                                fennec_wallet_balance: fennecWalletBalance,
                                fennec_inswap_balance: fennecInSwapBalance,
                                staked_fb: stakedFB, // НОВОЕ: Нативный стейкинг FB
                                has_fennec_in_lp: hasFennecInLP, // ИСПРАВЛЕНИЕ: Есть ли LP с FENNEC
                                first_tx_ts: firstTxTs, // ИСПРАВЛЕНИЕ: Валидация уже применена выше
                                runes_count: runesCount,
                                brc20_count: brc20Count,
                                ordinals_count: ordinalsCount,
                                abandoned_utxo_count: abandonedUtxoCount,
                                lp_count: lpCount,
                                lp_value_fb: lpValueFB,
                                lp_value_usd: lpValueUSD, // ИСПРАВЛЕНИЕ: Возвращаем LP в долларах
                                fennec_lp_value_usd: fennecLpValueUSD,
                                has_fennec_boxes: hasFennecBoxes,
                                fennec_boxes_count: fennecBoxesCount,
                                all_tokens_value_usd: allTokensValueUSD, // НОВОЕ: Стоимость всех токенов из InSwap
                                all_tokens_details: allTokensDetails, // НОВОЕ: Детали по каждому токену
                                prices: {
                                    btc: btcPrice,
                                    fb: fbPrice,
                                    fennec_in_fb: fennecPriceInFB
                                },
                                _debug: debugInfo // Временное поле для отладки
                            }
                        });
                        // Кэшируем ответ - АГРЕССИВНОЕ кэширование для снижения 429 ошибок
                        try {
                            // ИСПРАВЛЕНИЕ: Увеличено время кэша для снижения 429 ошибок (особенно важно при множестве пользователей)
                            // КРИТИЧЕСКОЕ: Используем нормализованный cacheKey (без pubkey) для переиспользования между пользователями
                            const normalizedCacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });
                            response.headers.set('Cache-Control', 's-maxage=300, max-age=60'); // 5 минут в Cloudflare, 1 минута в браузере
                            if (ctx?.waitUntil) {
                                ctx.waitUntil(cache.put(normalizedCacheKey, response.clone()));
                            } else {
                                await cache.put(normalizedCacheKey, response.clone());
                            }
                        } catch (cacheErr) {
                            console.warn('Cache put failed:', cacheErr.message);
                        }
                        return response;
                    } catch (e) {
                        return sendJSON({ error: e.message }, 500);
                    }
                }

                // --- AI CHAT (OpenAI) ---
                if (action === 'chat') {
                    if (request.method !== 'POST') return sendJSON({ error: 'Method not allowed' }, 405);

                    const body = await request.json();
                    const userMessage = body.message;
                    const history = Array.isArray(body.history) ? body.history : [];
                    const uiContext = body.context && typeof body.context === 'object' ? body.context : {};

                    // OpenAI API Key
                    const OPENAI_API_KEY = env?.OPENAI_API_KEY || '';

                    if (!OPENAI_API_KEY) {
                        return sendJSON({ reply: 'AI chat is not configured on the server.' });
                    }

                    // 1. Knowledge Base
                    const builtinKnowledgeBase = `Fennec Swap — DEX/terminal на Fractal Bitcoin.

КЛЮЧЕВЫЕ ФАКТЫ:
- Fractal Bitcoin: L2/sidechain экосистема с быстрыми блоками (~30s), отдельная сеть от Bitcoin mainnet.
- FENNEC: BRC-20 токен в сети Fractal.
- FB (sFB___000): нативный газ/актив Fractal (в UI отображается как FB).
- BTC (sBTC___000): мостовой BTC внутри Fractal (в UI отображается как BTC).

ОПЕРАЦИИ ТЕРМИНАЛА:
- SWAP: FB ↔ FENNEC и BTC ↔ FB.
- DEPOSIT: ввод (из Bitcoin mainnet/Fractal в Fractal), после подтверждений появляется баланс в терминале.
- WITHDRAW: вывод из Fractal на Bitcoin mainnet.
  - Для withdraw обычно есть две сущности: burn/fee в Fractal и receiveTxid в Bitcoin mainnet.
  - Пользователю в истории важно показывать receiveTxid (реальный Bitcoin tx).

UNI SAT:
- Терминал работает с UniSat как с браузерным кошельком (window.unisat). Никакие yarn/npm пакеты UniSat не нужны, если интеграция остаётся через расширение.

FENNEC ID (v6.0, кратко):
- Итоговый Score (0..100) = Activity(0..30) + Wealth(0..20) + Time(0..15) + Badges(0..35), затем возможен MAXI multiplier.
- Rarity thresholds:
  - CUB: 0-29
  - SCOUT: 30-49
  - HUNTER: 50-64
  - ALPHA: 65-79
  - ELDER: 80-94
  - SPIRIT: 95-100
- Badges (8 слотов): GENESIS(+15), WHALE(+10), PROVIDER(+8), ARTIFACT HUNTER(+3), RUNE KEEPER(+3), MEMPOOL RIDER(+7), DUST DEVIL(+3), FENNEC MAXI(0, но множитель к итоговому score).
- FENNEC MAXI активируется если FENNEC >= 10,000 или есть LP-позиция с парой FENNEC.

ЕСЛИ НЕ УВЕРЕН:
- Скажи честно, что не уверен.
- Дай проверяемые источники или ссылку на поиск (Google) с ключевыми словами.`;

                    let knowledgeBase = builtinKnowledgeBase;
                    try {
                        const controller = new AbortController();
                        setTimeout(() => controller.abort(), 1500);
                        const kbRes = await fetch('https://fennecbtc.xyz/knowledge.txt', { signal: controller.signal });
                        if (kbRes.ok) {
                            const kbText = await kbRes.text();
                            const trimmed = (kbText || '').trim();
                            knowledgeBase = trimmed ? `${trimmed}\n\n${builtinKnowledgeBase}` : builtinKnowledgeBase;
                        }
                    } catch (e) {}

                    // 2. Live Data (Price)
                    let marketData = 'Цена недоступна.';
                    try {
                        const poolRes = await fetch(`${INSWAP_URL}/pool_info?tick0=FENNEC&tick1=sFB___000`, {
                            headers: upstreamHeaders
                        });
                        const poolJson = await poolRes.json();
                        if (poolJson.data) {
                            const fennec = parseFloat(poolJson.data.amount0 || poolJson.data.amount1);
                            const fb = parseFloat(poolJson.data.amount1 || poolJson.data.amount0);
                            const price = (fb / fennec).toFixed(8);
                            marketData = `ЦЕНА: 1 FENNEC = ${price} FB.`;
                        }
                    } catch (e) {}

                    // Build context string
                    const contextStr = `Section: ${uiContext.section || 'home'}, Tab: ${uiContext.tab || 'none'}, Swap: ${uiContext.swapPair || 'N/A'}`;

                    const systemPrompt = `
Ты — Фенек (Fennec), ИИ-ассистент терминала Fennec на Fractal Bitcoin.
ТВОЯ ЦЕЛЬ: Помогать пользователям торговать, проверять кошельки и понимать экосистему.

ТЕКУЩИЙ UI-КОНТЕКСТ:
${contextStr}

БАЗА ЗНАНИЙ:
${knowledgeBase}

ТЕКУЩИЙ РЫНОК:
${marketData}

ИНСТРУКЦИИ:
1. ЯЗЫК: Отвечай на языке пользователя. Если пользователь пишет на английском — отвечай на английском. Если на китайском — отвечай на китайском. Если язык не определен — используй английский как основной.
2. Если вопрос касается Fennec, Fractal, кошельков или ошибок — отвечай максимально точно, используя БАЗУ ЗНАНИЙ.
3. Если вопрос общий про крипту — отвечай, используя свои общие знания, но привязывай это к контексту Fractal Bitcoin.
4. Стиль: Краткий, технический, дружелюбный. Используй эмодзи: 🦊🔥⚡🌵
5. Если ты не уверен в факте/цифрах — дай ссылку на источник или поисковый запрос.

=== ФУНКЦИИ ТЕРМИНАЛА ===
SWAP: Обмен FB ↔ FENNEC и BTC ↔ FB
DEPOSIT: Внесение BTC, FB, FENNEC с Bitcoin/Fractal
WITHDRAW: Вывод на Bitcoin Mainnet (сжигание на Fractal)
FENNEC ID: Генерация ID карточки

=== КОМАНДЫ ИИ ===
1. NAVIGATE: {"type":"NAVIGATE","params":{"tab":"swap|deposit|withdraw|id"}}
2. FILL_SWAP: {"type":"FILL_SWAP","params":{"pair":"FB_FENNEC|BTC_FB","amount":"0.5","buy":true|false}}
   - buy=true: ПОКУПКА FENNEC (отдаем FB/BTC)
   - buy=false: ПРОДАЖА FENNEC (отдаем FENNEC)
3. EXECUTE_SWAP: auto-swap после заполнения
4. CONNECT_WALLET: {"type":"CONNECT_WALLET","params":{}}
5. OPEN_ID: {"type":"OPEN_ID","params":{}}

ПРИМЕРЫ:
- "swap 0.5 FB to FENNEC" → |||{"type":"FILL_SWAP","params":{"pair":"FB_FENNEC","amount":"0.5","buy":true}}|||
- "sell 100 FENNEC" → |||{"type":"FILL_SWAP","params":{"pair":"FB_FENNEC","amount":"100","buy":false}}|||
- "show my ID" → |||{"type":"OPEN_ID","params":{}}|||
`;

                    try {
                        const chatMessages = [];
                        chatMessages.push({ role: 'system', content: systemPrompt });

                        // Optional short history from client (keep it small and safe)
                        for (const h of history.slice(-12)) {
                            const role = h && h.role === 'assistant' ? 'assistant' : 'user';
                            const content = h && typeof h.content === 'string' ? h.content : '';
                            if (content && content.length <= 1500) {
                                chatMessages.push({ role, content });
                            }
                        }

                        // Always include current user message last
                        chatMessages.push({ role: 'user', content: String(userMessage || '') });

                        const response = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${OPENAI_API_KEY}`
                            },
                            body: JSON.stringify({
                                model: 'gpt-4o-mini', // Самая быстрая и дешевая, но очень умная
                                messages: chatMessages,
                                temperature: 0.3, // Более строгие и точные ответы для финансового сервиса
                                max_tokens: 350
                            })
                        });

                        const data = await response.json();

                        if (data.error) {
                            return sendJSON({ reply: `Ошибка мозга: ${data.error.message}` });
                        }

                        const reply = data.choices[0].message.content;
                        return sendJSON({ reply });
                    } catch (e) {
                        return sendJSON({ reply: 'Спутник потерян... (Ошибка сети)' });
                    }
                }

                // --- GAS ESTIMATE (Прокси для CORS с имитацией браузера) ---
                if (action === 'gas') {
                    try {
                        // ИСПРАВЛЕНИЕ: Используем Mempool Fractal API для получения fee rates (разгружаем UniSat)
                        // Пробуем сначала Mempool Fractal, потом fallback на UniSat
                        let response = await fetch('https://mempool.fractalbitcoin.io/api/v1/fees/recommended', {
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });

                        // Fallback: если Mempool не работает, используем UniSat
                        if (!response.ok) {
                            requireUniSatKey();
                            response = await fetch(`${FRACTAL_BASE}/indexer/fees/recommended`, {
                                headers: {
                                    ...authHeaders(),
                                    'Content-Type': 'application/json',
                                    'User-Agent':
                                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            });
                        }

                        if (!response.ok) throw new Error('Upstream API Error');
                        const data = await response.json();

                        // ИСПРАВЛЕНИЕ: API может возвращать данные в разных форматах
                        // Если есть fastestFee, halfHourFee, hourFee - возвращаем как есть
                        // Если структура другая, преобразуем
                        if (data.data) {
                            const fees = data.data;
                            return sendJSON(
                                {
                                    fastestFee: fees.fastestFee || fees.fastest || fees.high || 10,
                                    halfHourFee: fees.halfHourFee || fees.halfHour || fees.medium || 8,
                                    hourFee: fees.hourFee || fees.hour || fees.low || 5,
                                    minimumFee: fees.minimumFee || fees.minimum || 3
                                },
                                200,
                                30,
                                'public'
                            );
                        } else if (data.fastestFee !== undefined) {
                            return sendJSON(data, 200, 30, 'public');
                        } else {
                            // Если структура неожиданная, возвращаем средние значения
                            return sendJSON(
                                { fastestFee: 10, halfHourFee: 8, hourFee: 5, minimumFee: 3 },
                                200,
                                30,
                                'public'
                            );
                        }
                    } catch (e) {
                        // Fallback: mempool.fractalbitcoin.io
                        try {
                            const fallbackResponse = await fetch(
                                'https://mempool.fractalbitcoin.io/api/v1/fees/recommended'
                            );
                            if (!fallbackResponse.ok) throw new Error('Fallback API Error');
                            const fallbackData = await fallbackResponse.json();
                            return sendJSON(fallbackData, 200, 30, 'public');
                        } catch (e2) {
                            // Возвращаем дефолтные значения
                            return sendJSON(
                                { fastestFee: 10, halfHourFee: 8, hourFee: 5, minimumFee: 3 },
                                200,
                                30,
                                'public'
                            );
                        }
                    }
                }

                return sendJSON({ error: 'Unknown action' }, 400);
            } catch (error) {
                // Внутренний catch для ошибок внутри основного кода
                return sendJSON({ error: error.message }, 500);
            }
        } catch (outerError) {
            // КРИТИЧЕСКОЕ: Внешний catch для любых ошибок, которые не были пойманы внутренним try-catch
            // Это гарантирует, что CORS заголовки всегда будут возвращены
            console.error('Outer worker error:', outerError);
            return new Response(
                JSON.stringify({
                    error: outerError.message || 'Internal server error',
                    stack: outerError.stack
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            );
        }
    }
};
