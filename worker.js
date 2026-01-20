import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';

// Global Stealth Headers для обхода rate limiting
const STEALTH_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Connection: 'keep-alive',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    Referer: 'https://fractal.unisat.io/',
    Origin: 'https://fractal.unisat.io'
};

let __provenanceSigner = null;
let __provenanceSignerKeyId = null;
let __provenanceSignerJwkString = null;
let __provenanceSignerPublicJwk = null;

export default {
    async fetch(request, env, ctx) {
        // --- CONFIG & SMART FETCH ---
        const API_KEYS = [env.UNISAT_API_KEY, env.UNISAT_API_KEY_2, env.UNISAT_API_KEY_3, env.UNISAT_API_KEY_4].filter(
            k => !!k
        );

        const SPOOF_HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            Origin: 'https://fennecbtc.xyz',
            Referer: 'https://fennecbtc.xyz/'
        };

        async function smartFetch(url, options = {}) {
            const method = options.method || 'GET';
            const body = options.body || null;

            // Attempt 1: Free Tier (Spoofing)
            try {
                const res = await fetch(url, {
                    method,
                    headers: { ...SPOOF_HEADERS, 'Content-Type': 'application/json' },
                    body
                });
                const clone = res.clone();
                const json = await clone.json().catch(() => null);
                // If Success (200 OK & Code 0), return immediately
                if (res.status === 200 && json && json.code === 0) return json;
            } catch (e) {
                /* ignore network error, go to fallback */
            }

            // Attempt 2: Paid Tier (Key Rotation)
            let lastErr = null;
            for (const key of API_KEYS) {
                try {
                    const res = await fetch(url, {
                        method,
                        headers: {
                            ...SPOOF_HEADERS,
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${key}`
                        },
                        body
                    });
                    const json = await res.json();
                    if (res.status === 200 && json.code === 0) return json;
                    lastErr = json;
                } catch (e) {
                    lastErr = e;
                }
            }
            console.warn(`SmartFetch exhausted all options for ${url}`, lastErr);
            return { code: -1, msg: 'Fetch failed after retries', data: null };
        }

        // КРИТИЧЕСКОЕ: CORS заголовки должны быть определены в самом начале
        const __workerBuild = '2026-01-18-chartfix-2';
        const __allowedOrigins = new Set([
            'https://fennecbtc.xyz',
            'https://www.fennecbtc.xyz',
            'https://fennec-swap.pages.dev'
        ]);
        const __originHeader = String(request.headers.get('Origin') || '').trim();
        const __refererHeader = String(request.headers.get('Referer') || '').trim();
        const __originFromReferer = (() => {
            if (!__refererHeader) return '';
            try {
                return new URL(__refererHeader).origin;
            } catch (_) {
                void _;
                return '';
            }
        })();
        const __origin = __originHeader || __originFromReferer;
        const __isAllowedOrigin = origin => {
            const o = String(origin || '').trim();
            if (!o) return false;
            if (o === 'null') return true;
            if (
                o.startsWith('chrome-extension://') ||
                o.startsWith('moz-extension://') ||
                o.startsWith('safari-extension://')
            )
                return true;
            if (__allowedOrigins.has(o)) return true;
            try {
                const u = new URL(o);
                const host = String(u.hostname || '').toLowerCase();
                if (!host) return false;
                if (host === 'localhost' || host === '127.0.0.1') return true;
                if (host === 'fennecbtc.xyz' || host.endsWith('.fennecbtc.xyz')) return true;
                if (host === 'uniscan.cc' || host.endsWith('.uniscan.cc')) return true;
                if (host.endsWith('.pages.dev')) return true;
                if (host.endsWith('.warninghejo.workers.dev')) return true;
                return false;
            } catch (_) {
                void _;
                return false;
            }
        };
        const __allowOrigin = __isAllowedOrigin(__origin) ? __origin : '*';
        const corsHeaders = {
            'Access-Control-Allow-Origin': __allowOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers':
                'Content-Type, Accept, Authorization, x-public-key, x-address, x-internal, Cache-Control, Pragma',
            'Access-Control-Max-Age': '86400'
        };

        const __sensitiveActions = new Set([
            'sign_provenance',
            'chat',
            'create_inscription',
            'burn_remint_psbt',
            'push_psbt',
            'deposit_create',
            'deposit_confirm',
            'deposit_create_simple',
            'deposit_confirm_simple',
            'withdraw_create',
            'withdraw_confirm'
        ]);

        // Best-effort in-memory rate-limit (per isolate)
        const __rateState = globalThis.__fennecRateState || (globalThis.__fennecRateState = new Map());
        const __rateLimit = (key, limit, windowMs) => {
            const now = Date.now();
            const v = __rateState.get(key);
            if (!v || now - v.start >= windowMs) {
                __rateState.set(key, { start: now, count: 1 });
                return { ok: true };
            }
            if (v.count >= limit) return { ok: false, retryMs: windowMs - (now - v.start) };
            v.count += 1;
            return { ok: true };
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
            const pathname = url.pathname;

            // Handle /content/{inscriptionId} path for recursive inscriptions
            if (pathname.startsWith('/content/')) {
                const inscriptionId = pathname.replace('/content/', '').trim();
                if (inscriptionId) {
                    url.searchParams.set('action', 'inscription_content');
                    url.searchParams.set('inscriptionId', inscriptionId);
                    url.searchParams.set('raw', '1');
                }
            }

            const action = url.searchParams.get('action');

            const __debugEnabled = url.searchParams.get('debug') === '1';
            const __disableInswapByQuery =
                url.searchParams.get('no_inswap') === '1' || url.searchParams.get('basic') === '1';
            const __disableInswap =
                String(env?.DISABLE_INSWAP || env?.FENNEC_DISABLE_INSWAP || '').trim() === '1' ||
                __disableInswapByQuery;

            // Origin + simple rate limiting for sensitive endpoints
            try {
                const internal = String(request.headers.get('x-internal') || '').trim() === '1';
                if (!internal && action && __sensitiveActions.has(action)) {
                    if (!__isAllowedOrigin(__origin)) {
                        const includeDetails = __debugEnabled || action === 'sign_provenance';
                        let payload = { error: 'Forbidden' };
                        if (includeDetails) {
                            payload = {
                                error: 'Forbidden',
                                details: {
                                    reason: 'origin_not_allowed',
                                    worker_build: __workerBuild,
                                    action: action || null,
                                    method: String(request.method || 'GET').toUpperCase(),
                                    path: pathname || null,
                                    host: String(request.headers.get('Host') || '').trim() || null,
                                    origin: __originHeader || null,
                                    effective_origin: __origin || null,
                                    referer: __refererHeader || null,
                                    user_agent: String(request.headers.get('User-Agent') || '').trim() || null,
                                    cf_ip:
                                        String(request.headers.get('CF-Connecting-IP') || '').trim() ||
                                        String(request.headers.get('X-Forwarded-For') || '')
                                            .split(',')[0]
                                            .trim() ||
                                        null
                                }
                            };
                        }
                        return sendJSON(payload, 403);
                    }
                    const ip =
                        String(request.headers.get('CF-Connecting-IP') || '').trim() ||
                        String(request.headers.get('X-Forwarded-For') || '')
                            .split(',')[0]
                            .trim() ||
                        'unknown';
                    const limit = action === 'sign_provenance' ? 12 : 50;
                    const rl = __rateLimit(`ip:${ip}:action:${action}`, limit, 60_000);
                    if (!rl.ok) {
                        return sendJSON(
                            {
                                error: 'Rate limited',
                                retry_after_ms: rl.retryMs
                            },
                            429
                        );
                    }
                }
            } catch (_) {
                void _;
            }

            const __unisatKeysRaw = [
                env?.UNISAT_API_KEY,
                env?.UNISAT_API_KEY_2,
                env?.UNISAT_API_KEY_3,
                env?.UNISAT_API_KEY_4,
                env?.API_KEY
            ]
                .map(k => String(k || '').trim())
                .filter(Boolean);
            const __unisatKeys = Array.from(new Set(__unisatKeysRaw));
            let __unisatKeyIdx = 0;
            const __pickUniSatKey = () => {
                if (!__unisatKeys.length) return '';
                const k = String(__unisatKeys[__unisatKeyIdx % __unisatKeys.length] || '').trim();
                __unisatKeyIdx = (__unisatKeyIdx + 1) % __unisatKeys.length;
                return k;
            };

            const API_KEY = __unisatKeys[0] || '';
            const CMC_API_KEY = env?.CMC_API_KEY || env?.CMC_PRO_API_KEY || '';
            const GOOGLE_API_KEY = String(env?.GOOGLE_API_KEY || env?.GEMINI_API_KEY || '').trim();

            void CMC_API_KEY;

            const GEMINI_MODEL_CHAT_PRIMARY = 'gemini-3-flash';
            const GEMINI_MODEL_WORKHORSE = 'gemini-2.5-flash-lite';
            const GEMINI_MODEL_FALLBACK_1 = 'gemini-2.5-flash';
            const GEMINI_MODEL_FALLBACK_2 = 'gemini-2.5-pro';
            const GEMINI_MODEL_LEGACY_1 = 'gemini-2.0-flash-exp';
            const GEMINI_MODEL_LEGACY_2 = 'gemini-1.5-flash';
            const GEMINI_MODELS_WITH_SEARCH = new Set([
                'gemini-3-flash',
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'gemini-2.0-flash-exp',
                'gemini-1.5-flash'
            ]);

            const callGemini = async (prompt, options = {}) => {
                const {
                    useSearch = false,
                    systemInstruction = '',
                    temperature = 0.7,
                    purpose = 'generic',
                    model = '',
                    maxModelAttempts = 2,
                    timeoutMs = 12000
                } = options;

                if (!GOOGLE_API_KEY) {
                    throw new Error('GOOGLE_API_KEY not configured');
                }

                const desired = String(model || '').trim();
                const models = (() => {
                    if (desired) return [desired];
                    if (purpose === 'chat' || purpose === 'lore') {
                        return [
                            GEMINI_MODEL_CHAT_PRIMARY,
                            GEMINI_MODEL_WORKHORSE,
                            GEMINI_MODEL_FALLBACK_1,
                            GEMINI_MODEL_FALLBACK_2,
                            GEMINI_MODEL_LEGACY_1,
                            GEMINI_MODEL_LEGACY_2
                        ];
                    }
                    if (purpose === 'qa' || purpose === 'analysis') {
                        return [
                            GEMINI_MODEL_WORKHORSE,
                            GEMINI_MODEL_FALLBACK_1,
                            GEMINI_MODEL_CHAT_PRIMARY,
                            GEMINI_MODEL_FALLBACK_2,
                            GEMINI_MODEL_LEGACY_1,
                            GEMINI_MODEL_LEGACY_2
                        ];
                    }
                    return [
                        GEMINI_MODEL_WORKHORSE,
                        GEMINI_MODEL_CHAT_PRIMARY,
                        GEMINI_MODEL_FALLBACK_1,
                        GEMINI_MODEL_FALLBACK_2,
                        GEMINI_MODEL_LEGACY_1,
                        GEMINI_MODEL_LEGACY_2
                    ];
                })();

                const candidates = [];
                for (const m of models) {
                    const name = String(m || '').trim();
                    if (!name) continue;
                    if (useSearch && !GEMINI_MODELS_WITH_SEARCH.has(name)) continue;
                    if (candidates.includes(name)) continue;
                    candidates.push(name);
                }

                const attempts = candidates.slice(
                    0,
                    Math.max(1, Math.min(candidates.length, Number(maxModelAttempts) || 1))
                );
                let lastErr = null;

                const tryModel = async m => {
                    const body = {
                        contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
                        generationConfig: { temperature }
                    };

                    if (systemInstruction) {
                        body.systemInstruction = {
                            parts: [{ text: String(systemInstruction || '') }]
                        };
                    }

                    if (useSearch) {
                        body.tools = [{ googleSearch: {} }];
                    }

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                    try {
                        const res = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GOOGLE_API_KEY}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body),
                                signal: controller.signal
                            }
                        );

                        if (!res.ok) {
                            const errText = await res.text().catch(() => '');
                            const shortErr = String(errText || '').slice(0, 400);
                            const e = new Error(`HTTP ${res.status}: ${shortErr}`);
                            e.status = res.status;
                            throw e;
                        }

                        const data = await res.json();
                        const parts = data?.candidates?.[0]?.content?.parts;
                        const text = Array.isArray(parts) ? parts.map(p => String(p?.text || '')).join('') : '';
                        const cleaned = String(text || '').trim();
                        if (!cleaned) throw new Error('Empty response');
                        return { text: cleaned, model: m };
                    } finally {
                        clearTimeout(timeoutId);
                    }
                };

                for (const m of attempts) {
                    try {
                        return await tryModel(m);
                    } catch (e) {
                        lastErr = e;
                        const status = Number(e?.status || 0) || 0;
                        if (status === 429 || status >= 500 || status === 404 || status === 403 || status === 400)
                            continue;
                        break;
                    }
                }

                throw new Error(`Gemini failed: ${String(lastErr?.message || lastErr || 'Unknown error')}`);
            };

            const analyzeServerCrash = async (error, context) => {
                try {
                    const prompt = `Ты Senior Backend Developer. Произошла ошибка в Cloudflare Worker.

Error: ${error.message}
Stack: ${error.stack || 'N/A'}
Request Context: ${JSON.stringify(context, null, 2)}

Задача:
1. Найди точную строку и причину сбоя.
2. Если это ошибка внешнего API (404/429/500 от UniSat/InSwap), укажи это явно.
3. Напиши исправленный код или JSON структуру, которую мы ожидали.
Будь предельно техничным и кратким.`;

                    const result = await callGemini(prompt, {
                        purpose: 'analysis',
                        temperature: 0.3,
                        maxModelAttempts: 2,
                        timeoutMs: 12000
                    });
                    return result.text;
                } catch (e) {
                    return `AI analysis failed: ${e.message}`;
                }
            };

            void analyzeServerCrash;
            // ИСПРАВЛЕНИЕ: Используем правильные endpoints из UniSat Wallet констант
            // wallet-api требует аутентификации и может иметь больший приоритет для снижения 429 ошибок
            const WALLET_API_FRACTAL = 'https://wallet-api-fractal.unisat.io'; // Wallet API (требует аутентификации)
            // ОПТИМИЗАЦИЯ: Разделяем запросы между двумя API для снижения rate limiting
            // Стратегия: все запросы идут на open-api-fractal.unisat.io, так как это Fractal-специфичные данные
            // Если нужно распределить нагрузку, можно часть запросов перенести на open-api.unisat.io
            const FRACTAL_BASE = 'https://open-api-fractal.unisat.io/v1'; // Open API Fractal (для всех Fractal-специфичных запросов)
            const __normHost = v =>
                String(v || '')
                    .trim()
                    .replace(/^https?:\/\//i, '')
                    .replace(/\/+$/, '');
            const __unisatHost =
                __normHost(env?.UNISAT_OPEN_API_HOST) ||
                __normHost(env?.UNISAT_HOST) ||
                __normHost(env?.OPEN_API_UNISAT_HOST) ||
                'open-api-fractal.unisat.io';
            const UNISAT_BASE = `https://${__unisatHost}/v1`; // Open API для Fractal (production only)
            const BTC_BASE = `https://${__unisatHost}`;
            const INSWAP_URL = `${FRACTAL_BASE}/brc20-swap`; // Старый URL для обратной совместимости
            const INSWAP_V1_URL = `${FRACTAL_BASE}/brc20-swap`; // Правильный URL по документации

            void WALLET_API_FRACTAL;
            void BTC_BASE;
            void INSWAP_URL;
            void INSWAP_V1_URL;

            // КРИТИЧЕСКОЕ: Для brc20-swap эндпоинтов используем FRACTAL_BASE
            // Все brc20-swap запросы должны идти на open-api-fractal.unisat.io (они Fractal-специфичные)
            // Если нужно распределить нагрузку, можно использовать UNISAT_BASE, но это может не работать для Fractal сети
            const SWAP_BASE = FRACTAL_BASE; // Для brc20-swap используем Fractal API (обязательно для Fractal сети)

            const DEFAULT_FEE_TICK = 'sFB___000';

            const __normalizeSwapTick = t => {
                const v = String(t || '').trim();
                if (v.includes('/')) {
                    const parts = v
                        .split('/')
                        .map(p => String(p || '').trim())
                        .filter(Boolean);
                    if (parts.length === 2) {
                        const n0 = __normalizeSwapTick(parts[0]);
                        const n1 = __normalizeSwapTick(parts[1]);
                        return `${n0}/${n1}`;
                    }
                }
                const u = v.toUpperCase();
                if (u === 'SFB' || u === 'SFB___000') return 'sFB___000';
                if (u === 'SBTC' || u === 'SBTC___000') return 'sBTC___000';
                return v;
            };

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

            void sanitizeTimestamp;

            // Headers forwarding
            const incomingPubKey = request.headers.get('x-public-key');
            const incomingAddress = request.headers.get('x-address');

            const upstreamHeaders = {
                'Content-Type': 'application/json',
                ...STEALTH_HEADERS
            };

            if (API_KEY) upstreamHeaders.Authorization = `Bearer ${API_KEY}`;

            const unisatApiHeaders = {
                ...upstreamHeaders,
                ...STEALTH_HEADERS
            };

            const requireUniSatKey = () => {
                if (!__unisatKeys.length) {
                    throw new Error('UNISAT_API_KEY is not configured on the server.');
                }
            };

            const authHeaders = () => {
                requireUniSatKey();
                const k = __pickUniSatKey();
                return k ? { Authorization: `Bearer ${k}` } : {};
            };

            if (incomingPubKey) upstreamHeaders['x-public-key'] = incomingPubKey;
            if (incomingAddress) upstreamHeaders['x-address'] = incomingAddress;

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
                } catch (e) {
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

            // Вспомогательная функция для получения цен (Mempool Fractal для BTC, пул для FB)
            const getCMCPrices = async () => {
                let btcPrice = 0;
                let fbPrice = 0;

                try {
                    const cache =
                        globalThis.__fennecCgPricesV1 || (globalThis.__fennecCgPricesV1 = { ts: 0, btc: 0, fb: 0 });
                    const now = Date.now();
                    if (
                        cache &&
                        Number(cache.ts || 0) > 0 &&
                        now - Number(cache.ts || 0) < 15000 &&
                        ((Number(cache.btc || 0) || 0) > 0 || (Number(cache.fb || 0) || 0) > 0)
                    ) {
                        btcPrice = Number(cache.btc || 0) || 0;
                        fbPrice = Number(cache.fb || 0) || 0;
                    } else {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 2500);
                        const cgUrl =
                            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,fractal-bitcoin&vs_currencies=usd';
                        const cgRes = await fetch(cgUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0',
                                Accept: 'application/json'
                            },
                            signal: controller.signal
                        }).finally(() => clearTimeout(timeoutId));
                        if (cgRes.ok) {
                            const cgJson = await cgRes.json().catch(() => null);
                            btcPrice = Number(cgJson?.bitcoin?.usd || 0) || 0;
                            fbPrice = Number(cgJson?.['fractal-bitcoin']?.usd || 0) || 0;
                        }
                        try {
                            cache.ts = now;
                            cache.btc = btcPrice;
                            cache.fb = fbPrice;
                        } catch (_) {}
                    }
                } catch (_) {}

                if (!(btcPrice > 0)) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 2000);
                        const mempoolRes = await fetch('https://mempool.fractalbitcoin.io/api/v1/prices', {
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            signal: controller.signal
                        }).finally(() => clearTimeout(timeoutId));
                        if (mempoolRes.ok) {
                            const mempoolJson = await mempoolRes.json().catch(() => null);
                            btcPrice = Number(mempoolJson?.USD || 0) || 0;
                        }
                    } catch (_) {}
                }

                // Fallback: FB считаем из пула FB-Биткоин с учетом текущего курса биткоина
                if (fbPrice === 0 && btcPrice > 0) {
                    try {
                        const query = `?tick0=${encodeURIComponent(
                            'sBTC___000'
                        )}&tick1=${encodeURIComponent('sFB___000')}`;
                        let poolUrl = `${SWAP_BASE}/brc20-swap/pool_info${query}`;
                        let poolRes = await fetch(poolUrl, { headers: upstreamHeaders });
                        if (!poolRes.ok && poolRes.status === 404) {
                            poolUrl = `${SWAP_BASE}/indexer/brc20-swap/pool_info${query}`;
                            poolRes = await fetch(poolUrl, { headers: upstreamHeaders });
                        }
                        if (poolRes.ok) {
                            const poolJson = await poolRes.json().catch(() => null);
                            const d =
                                poolJson && poolJson.data && typeof poolJson.data === 'object' ? poolJson.data : null;
                            if (d) {
                                const amt0 = parseFloat(d.amount0);
                                const amt1 = parseFloat(d.amount1);
                                const isBtcFirst =
                                    String(d.tick0 || '').includes('BTC') || String(d.tick0 || '') === 'sBTC___000';

                                let ratio = 0;
                                if (isBtcFirst) {
                                    if (amt1 > 0) ratio = amt0 / amt1;
                                } else {
                                    if (amt0 > 0) ratio = amt1 / amt0;
                                }

                                if (ratio > 0) fbPrice = ratio * btcPrice;
                            }
                        }
                    } catch (e) {
                        console.error('FB pool fallback error:', e);
                    }
                }

                return { btcPrice, fbPrice };
            };
            const __parseRangeSec = tr => {
                const v = String(tr || '')
                    .trim()
                    .toLowerCase();
                if (v === '1h') return 60 * 60;
                if (v === '24h') return 24 * 60 * 60;
                if (v === '7d') return 7 * 24 * 60 * 60;
                if (v === '30d') return 30 * 24 * 60 * 60;
                if (v === '90d') return 90 * 24 * 60 * 60;
                return 24 * 60 * 60;
            };

            void __parseRangeSec;

            // ИСПРАВЛЕНИЕ: Удален алиас fractal_audit -> audit_data (конфликт handlers)

            // worker_info endpoint для проверки версии деплоя
            if (action === 'worker_info') {
                return sendJSON({ code: 0, data: { worker_build: __workerBuild } });
            }

            if (action === 'fennec_id_register') {
                if (String(request.method || 'GET').toUpperCase() !== 'POST') {
                    return sendJSON({ code: -1, msg: 'Method not allowed' }, 405);
                }

                if (!env?.FENNEC_DB) {
                    return sendJSON({ code: -1, msg: 'FENNEC_DB is not configured on the server.' }, 200);
                }

                const body = await request.json().catch(() => null);
                if (!body || typeof body !== 'object') {
                    return sendJSON({ code: -1, msg: 'Invalid JSON body' }, 200);
                }

                const address = String(body.address || body.addr || '').trim();
                const inscriptionId = String(body.inscriptionId || body.inscription_id || body.id || '').trim();
                if (!address || !inscriptionId) {
                    return sendJSON({ code: -1, msg: 'Missing address or inscriptionId' }, 200);
                }

                const addrKey = address.toLowerCase();
                const updatedAt = Date.now();
                const key = `fennec_id_v3:${addrKey}`;

                try {
                    await env.FENNEC_DB.put(key, JSON.stringify({ inscriptionId, updatedAt, address: addrKey }), {
                        metadata: { updatedAt }
                    });
                } catch (e) {
                    return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
                }

                return sendJSON({ code: 0, data: { address: addrKey, inscriptionId, updatedAt } }, 200);
            }

            if (action === 'fennec_id_lookup') {
                if (!env?.FENNEC_DB) {
                    return sendJSON({ code: -1, msg: 'FENNEC_DB is not configured on the server.' }, 200);
                }

                const address = String(url.searchParams.get('address') || url.searchParams.get('addr') || '').trim();
                if (!address) {
                    return sendJSON({ code: -1, msg: 'Missing address' }, 200);
                }

                const addrKey = address.toLowerCase();
                const key = `fennec_id_v3:${addrKey}`;
                try {
                    const raw = await env.FENNEC_DB.get(key);
                    if (!raw) {
                        return sendJSON({ code: 0, data: null }, 200);
                    }
                    const parsed = (() => {
                        try {
                            return JSON.parse(raw);
                        } catch (_) {
                            return null;
                        }
                    })();

                    const inscriptionId = String(parsed?.inscriptionId || '').trim();
                    const updatedAt = Number(parsed?.updatedAt || 0) || 0;
                    if (!inscriptionId) {
                        return sendJSON({ code: 0, data: null }, 200);
                    }

                    return sendJSON({ code: 0, data: { address: addrKey, inscriptionId, updatedAt } }, 200);
                } catch (e) {
                    return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
                }
            }

            // Совместимость: quote endpoint для фронта
            if (action === 'quote') {
                try {
                    const tick0Raw = url.searchParams.get('tick0');
                    const tick1Raw = url.searchParams.get('tick1');
                    const tick0 = __normalizeSwapTick(tick0Raw || 'FENNEC');
                    const tick1 = __normalizeSwapTick(tick1Raw || 'sFB___000');
                    const query = `?tick0=${encodeURIComponent(tick0)}&tick1=${encodeURIComponent(tick1)}`;
                    let poolUrl = `${SWAP_BASE}/brc20-swap/pool_info${query}`;
                    let res = await fetch(poolUrl, { headers: upstreamHeaders });
                    if (!res.ok && res.status === 404) {
                        poolUrl = `${SWAP_BASE}/indexer/brc20-swap/pool_info${query}`;
                        res = await fetch(poolUrl, { headers: upstreamHeaders });
                    }
                    const json = await res.json().catch(() => null);
                    if (!json || typeof json !== 'object') {
                        return sendJSON({ code: -1, msg: `API error: ${res.status} ${res.statusText}` }, 200);
                    }
                    return sendJSON(json, res.status);
                } catch (e) {
                    return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
                }
            }

            // Совместимость: get_prices endpoint для фронта
            if (action === 'get_prices') {
                try {
                    let btc = 0,
                        fb = 0;
                    try {
                        const p = await Promise.race([
                            getCMCPrices(),
                            new Promise(resolve => setTimeout(() => resolve({ btcPrice: 0, fbPrice: 0 }), 3000))
                        ]);
                        btc = Number(p?.btcPrice || 0) || 0;
                        fb = Number(p?.fbPrice || 0) || 0;
                    } catch (e) {
                        void e;
                    }
                    let fennec_in_fb = 0;
                    try {
                        const query = `?tick0=${encodeURIComponent('FENNEC')}&tick1=${encodeURIComponent('sFB___000')}`;
                        let poolUrl = `${SWAP_BASE}/brc20-swap/pool_info${query}`;
                        let res = await fetch(poolUrl, { headers: upstreamHeaders });
                        if (!res.ok && res.status === 404) {
                            poolUrl = `${SWAP_BASE}/indexer/brc20-swap/pool_info${query}`;
                            res = await fetch(poolUrl, { headers: upstreamHeaders });
                        }
                        const json = await res.json().catch(() => null);
                        const d = json?.data && typeof json.data === 'object' ? json.data : null;
                        const a0 = Number(d?.amount0 || 0) || 0;
                        const a1 = Number(d?.amount1 || 0) || 0;
                        const t0 = String(d?.tick0 || '').toUpperCase();
                        const t1 = String(d?.tick1 || '').toUpperCase();
                        if (a0 > 0 && a1 > 0) {
                            if (t0.includes('FENNEC')) fennec_in_fb = a1 / a0;
                            else if (t1.includes('FENNEC')) fennec_in_fb = a0 / a1;
                        }
                    } catch (e) {
                        void e;
                    }
                    return sendJSON({ code: 0, data: { btc, fb, fennec_in_fb } }, 200);
                } catch (e) {
                    return sendJSON(
                        {
                            code: 0,
                            data: { btc: 0, fb: 0, fennec_in_fb: 0 },
                            error: e?.message || String(e)
                        },
                        200
                    );
                }
            }

            if (action === 'get_dashboard_data') {
                try {
                    // 1) prices
                    let prices = null;
                    try {
                        const pr = await Promise.race([
                            (async () => {
                                let btc = 0,
                                    fb = 0;
                                const pPromise = Promise.race([
                                    getCMCPrices(),
                                    new Promise(resolve => setTimeout(() => resolve({ btcPrice: 0, fbPrice: 0 }), 3000))
                                ]).catch(() => ({ btcPrice: 0, fbPrice: 0 }));

                                const fPromise = Promise.race([
                                    (async () => {
                                        let fennec_in_fb = 0;
                                        try {
                                            const query = `?tick0=${encodeURIComponent(
                                                'FENNEC'
                                            )}&tick1=${encodeURIComponent('sFB___000')}`;
                                            let poolUrl = `${SWAP_BASE}/brc20-swap/pool_info${query}`;
                                            const controller = new AbortController();
                                            const timeoutId = setTimeout(() => controller.abort(), 2200);
                                            let res = await fetch(poolUrl, {
                                                headers: upstreamHeaders,
                                                signal: controller.signal
                                            }).finally(() => clearTimeout(timeoutId));
                                            if (!res.ok && res.status === 404) {
                                                poolUrl = `${SWAP_BASE}/indexer/brc20-swap/pool_info${query}`;
                                                const controller2 = new AbortController();
                                                const timeoutId2 = setTimeout(() => controller2.abort(), 2200);
                                                res = await fetch(poolUrl, {
                                                    headers: upstreamHeaders,
                                                    signal: controller2.signal
                                                }).finally(() => clearTimeout(timeoutId2));
                                            }
                                            const json = await res.json().catch(() => null);
                                            const d = json?.data && typeof json.data === 'object' ? json.data : null;
                                            const a0 = Number(d?.amount0 || 0) || 0;
                                            const a1 = Number(d?.amount1 || 0) || 0;
                                            const t0 = String(d?.tick0 || '').toUpperCase();
                                            const t1 = String(d?.tick1 || '').toUpperCase();
                                            if (a0 > 0 && a1 > 0) {
                                                if (t0.includes('FENNEC')) fennec_in_fb = a1 / a0;
                                                else if (t1.includes('FENNEC')) fennec_in_fb = a0 / a1;
                                            }
                                        } catch (_) {}
                                        return fennec_in_fb;
                                    })(),
                                    new Promise(resolve => setTimeout(() => resolve(0), 2400))
                                ]).catch(() => 0);

                                const [p, fennec_in_fb] = await Promise.all([pPromise, fPromise]);
                                btc = Number(p?.btcPrice || 0) || 0;
                                fb = Number(p?.fbPrice || 0) || 0;
                                return {
                                    btc,
                                    fb,
                                    fennec_in_fb: Number(fennec_in_fb || 0) || 0
                                };
                            })(),
                            new Promise(resolve => setTimeout(() => resolve(null), 3500))
                        ]);
                        if (pr && typeof pr === 'object') prices = pr;
                    } catch (_) {
                        prices = null;
                    }

                    // 2) fees
                    const readFee = async endpoint => {
                        try {
                            const res = await fetch(endpoint, {
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            });
                            if (!res.ok) return null;
                            const data = await res.json().catch(() => null);
                            if (!data || typeof data !== 'object') return null;
                            if (data.fastestFee !== undefined) return data;
                            if (data.data && typeof data.data === 'object') {
                                const fees = data.data;
                                return {
                                    fastestFee: fees.fastestFee || fees.fastest || fees.high || 10,
                                    halfHourFee: fees.halfHourFee || fees.halfHour || fees.medium || 8,
                                    hourFee: fees.hourFee || fees.hour || fees.low || 5,
                                    minimumFee: fees.minimumFee || fees.minimum || 3
                                };
                            }
                            return null;
                        } catch (_) {
                            return null;
                        }
                    };

                    const [fractalFee, btcFee] = await Promise.all([
                        readFee('https://mempool.fractalbitcoin.io/api/v1/fees/recommended'),
                        readFee('https://mempool.space/api/v1/fees/recommended')
                    ]);

                    return sendJSON(
                        {
                            code: 0,
                            data: {
                                prices: prices,
                                fees: {
                                    fractal: fractalFee || { fastestFee: 1 },
                                    bitcoin: btcFee || { fastestFee: 1 }
                                },
                                ts: Math.floor(Date.now() / 1000)
                            }
                        },
                        200,
                        60,
                        'public'
                    );
                } catch (e) {
                    return sendJSON(
                        {
                            code: 0,
                            data: {
                                prices: null,
                                fees: null,
                                ts: Math.floor(Date.now() / 1000)
                            }
                        },
                        200
                    );
                }
            }

            // Совместимость: price_line endpoint для фронта
            if (action === 'price_line') {
                try {
                    const __canonSwapTick = t => {
                        const n = __normalizeSwapTick(t);
                        if (n === 'sFB') return 'sFB___000';
                        if (n === 'sBTC') return 'sBTC___000';
                        return n;
                    };
                    const tick0 = __canonSwapTick(url.searchParams.get('tick0') || 'sFB___000');
                    const tick1 = __canonSwapTick(url.searchParams.get('tick1') || 'FENNEC');
                    const tick0Cmp = String(tick0 || '').toUpperCase();
                    const tick1Cmp = String(tick1 || '').toUpperCase();
                    const timeRange = String(url.searchParams.get('timeRange') || '7d').trim();

                    const __rangeMs = tr => {
                        const v = String(tr || '').toLowerCase();
                        if (v === '1h') return 60 * 60 * 1000;
                        if (v === '24h') return 24 * 60 * 60 * 1000;
                        if (v === '7d') return 7 * 24 * 60 * 60 * 1000;
                        if (v === '30d') return 30 * 24 * 60 * 60 * 1000;
                        if (v === '90d') return 90 * 24 * 60 * 60 * 1000;
                        if (v === 'all') return 365 * 24 * 60 * 60 * 1000;
                        return 7 * 24 * 60 * 60 * 1000;
                    };

                    const nowMs = Date.now();
                    const cutoffMs = nowMs - __rangeMs(timeRange);

                    let __swapV1Hint = '';

                    try {
                        const isFennecPair =
                            (tick0Cmp === 'FENNEC' && (tick1Cmp === 'SFB___000' || tick1Cmp === 'SFB')) ||
                            (tick1Cmp === 'FENNEC' && (tick0Cmp === 'SFB___000' || tick0Cmp === 'SFB'));
                        const __preferKline = (() => {
                            const v = String(timeRange || '').toLowerCase();
                            return v === '1h' || v === '24h';
                        })();
                        if (isFennecPair && !__preferKline) {
                            const tr = String(timeRange || '').toLowerCase() === 'all' ? '90d' : String(timeRange);
                            const baseNoV1 = String(SWAP_BASE || '').replace(/\/v1\/?$/i, '');
                            const __attempts = [];
                            const __pushAttempt = (host, status, code, len) => {
                                try {
                                    const h = String(host || '').trim();
                                    const s = Number(status || 0) || 0;
                                    const c = code !== undefined && code !== null ? Number(code) : NaN;
                                    const l = Number(len || 0) || 0;
                                    if (__attempts.length < 6) __attempts.push({ h, s, c, l });
                                } catch (_) {}
                            };

                            const candidates = [];
                            const queries = [
                                `tick0=FENNEC&tick1=sFB___000&timeRange=${encodeURIComponent(tr)}`,
                                `tick0=sFB___000&tick1=FENNEC&timeRange=${encodeURIComponent(tr)}`
                            ];
                            queries.push(
                                `tick0=FENNEC&tick1=FB&timeRange=${encodeURIComponent(tr)}`,
                                `tick0=FB&tick1=FENNEC&timeRange=${encodeURIComponent(tr)}`,
                                `tick0=FENNEC&tick1=sFB&timeRange=${encodeURIComponent(tr)}`,
                                `tick0=sFB&tick1=FENNEC&timeRange=${encodeURIComponent(tr)}`
                            );
                            for (const q of queries) {
                                candidates.push(
                                    ...[
                                        `https://inswap.cc/fractal-api/swap-v1/price_line?${q}`,
                                        `${baseNoV1}/fractal-api/swap-v1/price_line?${q}`,
                                        `${SWAP_BASE}/brc20-swap/price_line?${q}`,
                                        `${baseNoV1}/fractal-api/v1/brc20-swap/price_line?${q}`,
                                        `${baseNoV1}/swap-v1/price_line?${q}`,
                                        `${SWAP_BASE}/swap-v1/price_line?${q}`
                                    ].filter(Boolean)
                                );
                            }

                            const __swapPriceLineStartedAt = Date.now();
                            for (const endpointUrl of candidates) {
                                if (Date.now() - __swapPriceLineStartedAt > 6500) break;
                                let endpointHost = '';
                                let __needInvert = false;
                                try {
                                    const u0 = new URL(endpointUrl);
                                    endpointHost = u0.hostname;
                                    const q0 = String(u0.searchParams.get('tick0') || '').toUpperCase();
                                    const q1 = String(u0.searchParams.get('tick1') || '').toUpperCase();
                                    __needInvert = q0 && q1 && q0 !== 'FENNEC' && q1 === 'FENNEC';
                                } catch (_) {}
                                const headers0 = (() => {
                                    if (endpointHost && endpointHost.toLowerCase().includes('inswap.cc')) {
                                        const h = { ...upstreamHeaders };
                                        try {
                                            delete h.Authorization;
                                        } catch (_) {}
                                        return h;
                                    }
                                    return upstreamHeaders;
                                })();
                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => {
                                    try {
                                        controller.abort();
                                    } catch (_) {}
                                }, 2500);
                                const res = await fetch(endpointUrl, {
                                    method: 'GET',
                                    headers: headers0,
                                    signal: controller.signal
                                })
                                    .catch(() => null)
                                    .finally(() => {
                                        try {
                                            clearTimeout(timeoutId);
                                        } catch (_) {}
                                    });
                                if (!res) {
                                    __pushAttempt(endpointHost || 'fetch_null', 0, null, 0);
                                    continue;
                                }
                                const json = res.ok ? await res.json().catch(() => null) : null;
                                const rawList = (() => {
                                    if (!json || typeof json !== 'object') return [];
                                    if (Array.isArray(json.data?.list)) return json.data.list;
                                    if (Array.isArray(json.data?.data)) return json.data.data;
                                    if (Array.isArray(json.data)) return json.data;
                                    if (Array.isArray(json.list)) return json.list;
                                    return [];
                                })();
                                __pushAttempt(endpointHost || 'unknown', res.status, json?.code, rawList.length);
                                if (!res.ok) continue;
                                if (!rawList.length) continue;

                                const out = [];
                                for (const it of rawList) {
                                    const tsRaw = Number(it?.ts ?? it?.timestamp ?? 0) || 0;
                                    const ts = tsRaw > 1000000000000 ? Math.floor(tsRaw / 1000) : Math.floor(tsRaw);
                                    const priceNum0 = Number(it?.price ?? it?.close ?? 0) || 0;
                                    if (!(ts > 0 && priceNum0 > 0)) continue;
                                    let priceNum = __needInvert ? 1 / priceNum0 : priceNum0;
                                    if (priceNum > 10) priceNum = 1 / priceNum;
                                    if (!(priceNum > 0) || !Number.isFinite(priceNum)) continue;
                                    out.push({ ts, price: String(priceNum) });
                                }
                                out.sort((a, b) => (a.ts || 0) - (b.ts || 0));

                                if (out.length) {
                                    return sendJSON(
                                        {
                                            code: 0,
                                            data: {
                                                list: out,
                                                source: `swap_v1_price_line:${endpointUrl}`,
                                                build: __workerBuild
                                            }
                                        },
                                        200,
                                        120,
                                        'public'
                                    );
                                }
                            }

                            try {
                                __swapV1Hint = __attempts
                                    .map(a => {
                                        const host = String(a?.h || '').trim();
                                        const st = Number(a?.s || 0) || 0;
                                        const l = Number(a?.l || 0) || 0;
                                        return `${host}:${st}:${l}`;
                                    })
                                    .slice(0, 4)
                                    .join(',');
                            } catch (_) {}
                        }
                    } catch (e) {
                        void e;
                    }

                    // Основной источник исторического графика: UniSat Marketplace (Fractal) brc20_kline (smartFetch: Free → Paid)
                    try {
                        const isFennecPair =
                            (tick0Cmp === 'FENNEC' && (tick1Cmp === 'SFB___000' || tick1Cmp === 'SFB')) ||
                            (tick1Cmp === 'FENNEC' && (tick0Cmp === 'SFB___000' || tick0Cmp === 'SFB'));
                        if (isFennecPair) {
                            const stepMs = (() => {
                                const v = String(timeRange || '').toLowerCase();
                                if (v === '1h') return 60 * 1000; // 1m
                                if (v === '24h') return 5 * 60 * 1000; // 5m
                                if (v === '7d') return 60 * 60 * 1000; // 1h
                                if (v === '30d') return 4 * 60 * 60 * 1000; // 4h
                                if (v === '90d') return 12 * 60 * 60 * 1000; // 12h
                                if (v === 'all') return 24 * 60 * 60 * 1000; // 1d (90d window)
                                return 60 * 60 * 1000;
                            })();

                            const timeStart = cutoffMs;
                            const timeEnd = nowMs;

                            // Ограничение UniSat: (timeEnd-timeStart)/timeStep <= 2016
                            // Если выбрали слишком мелкий step — увеличиваем.
                            let effStepMs = stepMs;
                            const maxPoints = 2016;
                            const span = Math.max(0, timeEnd - timeStart);
                            if (span > 0 && Math.floor(span / effStepMs) > maxPoints) {
                                effStepMs = Math.ceil(span / maxPoints);
                            }

                            const klineUrl = 'https://open-api-fractal.unisat.io/v3/market/brc20/auction/brc20_kline';

                            const tryPayloads = [
                                {
                                    units: 'ms',
                                    body: {
                                        tick: 'FENNEC',
                                        timeStart,
                                        timeEnd,
                                        timeStep: effStepMs
                                    },
                                    mapTs: x => x
                                },
                                {
                                    units: 's',
                                    body: {
                                        tick: 'FENNEC',
                                        timeStart: Math.floor(timeStart / 1000),
                                        timeEnd: Math.floor(timeEnd / 1000),
                                        timeStep: Math.max(1, Math.floor(effStepMs / 1000))
                                    },
                                    mapTs: x => x
                                }
                            ];

                            for (const attempt of tryPayloads) {
                                const klineResult = await smartFetch(klineUrl, {
                                    method: 'POST',
                                    body: JSON.stringify(attempt.body)
                                }).catch(() => null);

                                if (!klineResult || klineResult.code !== 0) continue;

                                const arr = Array.isArray(klineResult?.data)
                                    ? klineResult.data
                                    : Array.isArray(klineResult?.data?.list)
                                      ? klineResult.data.list
                                      : Array.isArray(klineResult?.data?.data)
                                        ? klineResult.data.data
                                        : [];
                                if (!arr.length) continue;

                                const out = [];
                                for (const p of arr) {
                                    const tsRaw = Number(p?.timestamp ?? p?.ts ?? p?.time ?? 0) || 0;
                                    const priceNum0 = Number(p?.price ?? p?.close ?? p?.curPrice ?? 0) || 0;
                                    if (!(tsRaw > 0 && priceNum0 > 0)) continue;
                                    const tsMs = tsRaw > 1000000000000 ? tsRaw : tsRaw * 1000;
                                    const ts = Math.floor(tsMs / 1000);
                                    if (!(ts > 0)) continue;
                                    let priceNum = priceNum0;
                                    if (priceNum > 10) priceNum = 1 / priceNum;
                                    if (!(priceNum > 0) || !Number.isFinite(priceNum)) continue;
                                    out.push({ ts, price: String(priceNum) });
                                }
                                out.sort((a, b) => (a.ts || 0) - (b.ts || 0));
                                if (out.length) {
                                    return sendJSON(
                                        {
                                            code: 0,
                                            data: {
                                                list: out,
                                                source: `brc20_kline_${attempt.units}_smartfetch`,
                                                build: __workerBuild
                                            }
                                        },
                                        200,
                                        120,
                                        'public'
                                    );
                                }
                            }
                        }
                    } catch (e) {
                        void e;
                    }

                    const startedAt = Date.now();
                    const limit = 500;
                    const outList = [];

                    let start = 0;
                    let page = 0;
                    let total = 0;
                    let direction = 'forward';
                    let switchedToTail = false;

                    const MAX_PAGES =
                        timeRange === '1h'
                            ? 6
                            : timeRange === '24h'
                              ? 12
                              : timeRange === '7d'
                                ? 20
                                : timeRange === '30d'
                                  ? 30
                                  : timeRange === '90d'
                                    ? 45
                                    : timeRange === 'all'
                                      ? 45
                                      : 25;

                    while (page < MAX_PAGES) {
                        if (Date.now() - startedAt > 8500) break;

                        let endpointUrl = `${SWAP_BASE}/brc20-swap/swap_history?start=${start}&limit=${limit}`;
                        let res = null;
                        {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => {
                                try {
                                    controller.abort();
                                } catch (_) {}
                            }, 2000);
                            res = await fetch(endpointUrl, {
                                method: 'GET',
                                headers: upstreamHeaders,
                                signal: controller.signal
                            })
                                .catch(() => null)
                                .finally(() => {
                                    try {
                                        clearTimeout(timeoutId);
                                    } catch (_) {}
                                });
                        }
                        if (!res.ok && res.status === 404) {
                            endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/swap_history?start=${start}&limit=${limit}`;
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => {
                                try {
                                    controller.abort();
                                } catch (_) {}
                            }, 2000);
                            res = await fetch(endpointUrl, {
                                method: 'GET',
                                headers: upstreamHeaders,
                                signal: controller.signal
                            })
                                .catch(() => null)
                                .finally(() => {
                                    try {
                                        clearTimeout(timeoutId);
                                    } catch (_) {}
                                });
                        }
                        const json = res.ok ? await res.json().catch(() => null) : null;
                        const list = Array.isArray(json?.data?.list) ? json.data.list : [];
                        if (!list.length) break;

                        if (!total) {
                            total = Math.max(0, Number(json?.data?.total || 0) || 0);
                        }

                        // Если API выдаёт список от старых к новым (ASC), то start=0 — это "самое старое".
                        // В этом случае переключаемся на выборку с конца (последние записи), чтобы быстро получить актуальный диапазон.
                        if (!switchedToTail && total > 0 && list.length >= 2) {
                            const firstTs = Number(list[0]?.ts || 0) || 0;
                            const lastTs = Number(list[list.length - 1]?.ts || 0) || 0;
                            if (firstTs > 0 && lastTs > 0 && firstTs < lastTs) {
                                direction = 'backward';
                                start = Math.max(0, total - limit);
                                switchedToTail = true;
                                continue;
                            }
                        }

                        let pageMinMs = Infinity;
                        let pageMaxMs = 0;

                        for (const it of list) {
                            const ts = Number(it?.ts || 0) || 0;
                            if (!ts) continue;
                            const ms = ts * 1000;
                            if (ms < pageMinMs) pageMinMs = ms;
                            if (ms > pageMaxMs) pageMaxMs = ms;
                            if (ms < cutoffMs) continue;

                            const tin = __canonSwapTick(it?.tickIn);
                            const tout = __canonSwapTick(it?.tickOut);
                            const tinCmp = String(tin || '').toUpperCase();
                            const toutCmp = String(tout || '').toUpperCase();
                            const aIn = Number(it?.amountIn || 0) || 0;
                            const aOut = Number(it?.amountOut || 0) || 0;
                            if (!tin || !tout || aIn <= 0 || aOut <= 0) continue;

                            // Хотим price = FB per FENNEC
                            let price = 0;
                            if (tinCmp === tick1Cmp && toutCmp === tick0Cmp) {
                                // FENNEC -> FB
                                price = aOut / aIn;
                            } else if (tinCmp === tick0Cmp && toutCmp === tick1Cmp) {
                                // FB -> FENNEC
                                price = aIn / aOut;
                            } else {
                                continue;
                            }

                            if (price > 10) price = 1 / price;

                            if (!(price > 0)) continue;
                            outList.push({ ts, price: String(price) });
                        }

                        // Ранний stop по диапазону
                        if (direction === 'backward') {
                            // Идём в прошлое: если в странице уже встречаются времена старее cutoff,
                            // то предыдущие страницы будут ещё старее.
                            if (Number.isFinite(pageMinMs) && pageMinMs > 0 && pageMinMs < cutoffMs) break;
                        } else {
                            // Идём вперёд (обычно newest->oldest): если максимум страницы уже старее cutoff, можно стоп.
                            if (Number.isFinite(pageMaxMs) && pageMaxMs > 0 && pageMaxMs < cutoffMs) break;
                        }

                        if (list.length < limit) break;
                        if (direction === 'backward') {
                            if (!switchedToTail) {
                                // safety: если почему-то не переключились на tail, делаем это один раз
                                if (total > 0) {
                                    start = Math.max(0, total - limit);
                                    switchedToTail = true;
                                    continue;
                                }
                            }
                            if (start <= 0) break;
                            start = Math.max(0, start - limit);
                        } else {
                            start += limit;
                        }
                        page += 1;
                    }

                    outList.sort((a, b) => (a.ts || 0) - (b.ts || 0));
                    const src = __swapV1Hint ? `swap_history|swap_v1:${__swapV1Hint}` : 'swap_history';
                    return sendJSON(
                        {
                            code: 0,
                            data: {
                                list: outList,
                                source: src,
                                build: __workerBuild
                            }
                        },
                        200,
                        60,
                        'public'
                    );
                } catch (e) {
                    void e;
                }
                return sendJSON({ code: 0, data: { list: [], build: __workerBuild } }, 200);
            }

            if (action === 'btc_balance') {
                const address = url.searchParams.get('address');
                if (!address) return sendJSON({ code: -1, msg: 'No address' }, 200);
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 4000);
                    const mempoolRes = await fetch(`https://mempool.space/api/address/${address}`, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Mozilla/5.0',
                            Accept: 'application/json'
                        }
                    });
                    clearTimeout(timeoutId);
                    if (mempoolRes.ok) {
                        const data = await mempoolRes.json().catch(() => null);
                        const chain =
                            data && data.chain_stats && typeof data.chain_stats === 'object' ? data.chain_stats : {};
                        const mem =
                            data && data.mempool_stats && typeof data.mempool_stats === 'object'
                                ? data.mempool_stats
                                : {};
                        const satoshis =
                            Number(chain.funded_txo_sum || 0) -
                            Number(chain.spent_txo_sum || 0) +
                            (Number(mem.funded_txo_sum || 0) - Number(mem.spent_txo_sum || 0));
                        return sendJSON({ code: 0, data: { balance: satoshis / 1e8 } }, 200, 15, 'public');
                    }
                } catch (e) {
                    void e;
                }

                if (API_KEY) {
                    try {
                        const res = await fetch(`${BTC_BASE}/v1/indexer/address/${address}/balance`, {
                            headers: authHeaders()
                        });
                        if (res.ok) {
                            const data = await res.json().catch(() => null);
                            if (data && data.code === 0 && data.data) {
                                const total = Number(data.data.satoshi || 0) + Number(data.data.pendingSatoshi || 0);
                                return sendJSON({ code: 0, data: { balance: total / 1e8 } }, 200, 15, 'public');
                            }
                        }
                    } catch (e) {
                        void e;
                    }
                }

                return sendJSON({ code: 0, data: { balance: 0 } }, 200, 15, 'public');
            }

            // Совместимость: summary endpoint (smartFetch: Free → Paid)
            if (action === 'summary') {
                const address = String(url.searchParams.get('address') || '').trim();
                if (!address) return sendJSON({ error: 'Address required' }, 400);
                try {
                    const summaryJson = await smartFetch(`${FRACTAL_BASE}/indexer/address/${address}/summary`).catch(
                        () => null
                    );
                    let d = summaryJson?.data && typeof summaryJson.data === 'object' ? summaryJson.data : {};

                    if (!summaryJson || !summaryJson.data) {
                        try {
                            const [mempoolRes, utxoRes] = await Promise.all([
                                fetch(`https://mempool.fractalbitcoin.io/api/address/${address}`, {
                                    headers: { 'User-Agent': 'Mozilla/5.0' }
                                }).catch(() => null),
                                fetch(`https://mempool.fractalbitcoin.io/api/address/${address}/utxo`, {
                                    headers: { 'User-Agent': 'Mozilla/5.0' }
                                }).catch(() => null)
                            ]);

                            let txCount2 = 0;
                            let utxoCount2 = 0;
                            let nativeBalance2 = 0;

                            if (mempoolRes?.ok) {
                                const mempoolData = await mempoolRes.json().catch(() => null);
                                let c = {},
                                    m = {};
                                if (mempoolData?.chain_stats || mempoolData?.mempool_stats) {
                                    c = mempoolData.chain_stats || {};
                                    m = mempoolData.mempool_stats || {};
                                } else if (mempoolData && mempoolData.funded_txo_count !== undefined) {
                                    c = mempoolData;
                                    m = {};
                                }
                                txCount2 = Number(c.tx_count || 0) + Number(m.tx_count || 0);
                                const fundedSum = Number(c.funded_txo_sum || 0) + Number(m.funded_txo_sum || 0);
                                const spentSum = Number(c.spent_txo_sum || 0) + Number(m.spent_txo_sum || 0);
                                nativeBalance2 = Math.max(0, (fundedSum - spentSum) / 1e8);
                            }

                            if (utxoRes?.ok) {
                                const utxoData = await utxoRes.json().catch(() => null);
                                if (Array.isArray(utxoData)) utxoCount2 = utxoData.length;
                                else if (utxoData?.data && Array.isArray(utxoData.data))
                                    utxoCount2 = utxoData.data.length;
                                else if (utxoData?.list && Array.isArray(utxoData.list))
                                    utxoCount2 = utxoData.list.length;
                            }

                            d = {
                                tx_count: txCount2,
                                utxo_count: utxoCount2,
                                native_balance: nativeBalance2
                            };
                        } catch (e) {
                            void e;
                        }
                    }

                    const txCount =
                        Number(d.tx_count || d.totalTransactionCount || d.historyCount || d.txCount || 0) || 0;
                    const utxoCount = Number(d.utxo_count || d.utxoCount || 0) || 0;
                    const nativeBalance =
                        Number(d.native_balance || d.nativeBalance || 0) ||
                        (Number(d.satoshi || 0) ? Number(d.satoshi || 0) / 100000000 : 0);
                    const firstTxTs =
                        Number(d.first_tx_ts || d.firstTransactionTime || d.firstTxTime || d.first_tx_time || 0) || 0;

                    return sendJSON({
                        code: 0,
                        data: {
                            address,
                            tx_count: txCount,
                            utxo_count: utxoCount,
                            native_balance: nativeBalance,
                            first_tx_ts: firstTxTs,
                            runes_count: Number(d.runes_count || 0) || 0,
                            brc20_count: Number(d.brc20_count || 0) || 0,
                            ordinals_count: Number(d.ordinals_count || 0) || 0,
                            synced_at: new Date().toISOString()
                        }
                    });
                } catch (e) {
                    return sendJSON({ code: 0, data: {}, error: e?.message || String(e) }, 200);
                }
            }

            if (action === 'provenance_pubkey') {
                let signer = null;
                try {
                    signer = await getProvenanceSigner();
                } catch (_) {
                    signer = null;
                }
                return sendJSON({
                    code: 0,
                    data: {
                        key_id: signer?.keyId || 'unconfigured',
                        alg: signer ? 'ECDSA_P256_SHA256' : 'NONE',
                        public_key_jwk: signer?.publicJwk || null
                    }
                });
            }

            if (action === 'sign_provenance') {
                let signer = null;
                let signerError = null;
                try {
                    signer = await getProvenanceSigner();
                } catch (e) {
                    signer = null;
                    signerError = e?.message || String(e);
                }
                if (String(request.method || 'GET').toUpperCase() !== 'POST') {
                    return sendJSON({ error: 'Method not allowed' }, 405);
                }

                const body = await request.json().catch(() => null);
                if (!body) return sendJSON({ error: 'Invalid JSON body' }, 200);

                const inputPayload = body?.payload ?? body;
                const addrIn = String(
                    body?.address || body?.addr || inputPayload?.address || inputPayload?.addr || incomingAddress || ''
                ).trim();
                if (!addrIn) return sendJSON({ error: 'Missing address' }, 200);

                const htmlSha = String(
                    inputPayload?.html_sha256 || body?.html_sha256 || inputPayload?.htmlSha256 || body?.htmlSha256 || ''
                ).trim();

                const computeIdentity = auditData => {
                    const d = auditData && typeof auditData === 'object' ? auditData : {};

                    const txCount = Number(d.tx_count || 0) || 0;
                    const utxoCount = Number(d.utxo_count || 0) || 0;
                    const firstTxTs = Number(d.first_tx_ts || 0) || 0;
                    const runesCount = Number(d.runes_count || 0) || 0;
                    const brc20Count = Number(d.brc20_count || 0) || 0;
                    const ordinalsCount = Number(d.ordinals_count || 0) || 0;

                    const lpValueUSD = Number(d.lp_value_usd || d.lpValueUSD || 0) || 0;
                    const allTokensValueUSD = Number(d.all_tokens_value_usd || d.allTokensValueUSD || 0) || 0;
                    const netWorthUSD = allTokensValueUSD + lpValueUSD;

                    const providerValueUSD = lpValueUSD;
                    const isLiquidityProvider = providerValueUSD >= 50;
                    const isWhale = netWorthUSD >= 1000;
                    const totalInscriptions = brc20Count + runesCount + ordinalsCount;
                    const isArtifactHunter = totalInscriptions >= 50;
                    const isRuneKeeper = runesCount >= 20;

                    const LAUNCH_DATE = 1725840000;
                    const ONE_DAY = 86400;
                    const isGenesis = firstTxTs > 0 && firstTxTs >= LAUNCH_DATE && firstTxTs < LAUNCH_DATE + ONE_DAY;

                    const fennecWalletOnly = Number(d.fennec_wallet_balance || 0) || 0;
                    const fennecLpValueUSD = Number(d.fennec_lp_value_usd || d.fennecLpValueUSD || 0) || 0;
                    const hasFennecInLP = !!(d.has_fennec_in_lp || d.hasFennecInLP);

                    const fennecTotal = Number(d.fennec_native_balance || 0) || 0;
                    const isMempoolRider = txCount >= 10000;
                    const abandonedUtxoCountNum = Number.isFinite(Number(d.abandoned_utxo_count))
                        ? Number(d.abandoned_utxo_count)
                        : 0;
                    const abandonedUtxoCountMissing = !!d.abandoned_utxo_count_missing;
                    const isSandSweeper = !abandonedUtxoCountMissing && abandonedUtxoCountNum < 100;

                    const badges = [];
                    if (isGenesis)
                        badges.push({
                            name: 'GENESIS',
                            icon: '',
                            desc: 'You witnessed the first sunrise over the Fractal dunes.'
                        });
                    if (isWhale)
                        badges.push({
                            name: 'WHALE',
                            icon: '',
                            desc: 'When you move, the sands shift beneath you.'
                        });
                    if (isLiquidityProvider)
                        badges.push({
                            name: 'PROVIDER',
                            icon: '',
                            desc: 'The desert is thirsty, but your well runs deep.'
                        });
                    if (fennecTotal >= 10000 || hasFennecInLP)
                        badges.push({
                            name: 'FENNEC MAXI',
                            icon: '',
                            desc: 'The Spirit of the Fox guides your path.'
                        });
                    if (isArtifactHunter)
                        badges.push({
                            name: 'ARTIFACT HUNTER',
                            icon: '',
                            desc: 'Your pockets are heavy with echoes of the chain.'
                        });
                    if (isRuneKeeper)
                        badges.push({
                            name: 'RUNE KEEPER',
                            icon: '',
                            desc: 'You decipher the glyphs. The stones speak to you.'
                        });
                    if (isMempoolRider)
                        badges.push({
                            name: 'MEMPOOL RIDER',
                            icon: '',
                            desc: 'Surfing the chaos of the 30-second block waves.'
                        });
                    if (isSandSweeper)
                        badges.push({
                            name: 'SAND SWEEPER',
                            icon: '',
                            desc: 'Your UTXO set is clean. No trash left in the dunes.'
                        });

                    const badgeCount = badges.length;
                    let baseKey = 'DRIFTER';

                    if (isGenesis && isLiquidityProvider && isWhale) baseKey = 'PRIME';
                    else if (providerValueUSD >= 200) baseKey = 'LORD';
                    else if (isGenesis) baseKey = 'WALKER';
                    else if (isArtifactHunter && isRuneKeeper) baseKey = 'KEEPER';
                    else if (netWorthUSD >= 100) baseKey = 'MERCHANT';
                    else if (txCount > 1000) baseKey = 'ENGINEER';
                    else if (runesCount >= 20) baseKey = 'SHAMAN';
                    else baseKey = 'DRIFTER';

                    if (badgeCount >= 7) baseKey = 'SINGULARITY';

                    let tierLevel = 0;
                    if (badgeCount >= 6) tierLevel = 3;
                    else if (badgeCount >= 4) tierLevel = 2;
                    else if (badgeCount >= 2) tierLevel = 1;
                    else tierLevel = 0;

                    if (baseKey === 'PRIME' || baseKey === 'SINGULARITY') tierLevel = 3;

                    const tierNames = {
                        DRIFTER: ['DESERT RUNNER', 'SAND WANDERER', 'DUNE NOMAD', 'STORM SURFER'],
                        MERCHANT: ['CARAVAN MERCHANT', 'GOLD TRADER', 'OASIS KING', 'DESERT TYCOON'],
                        ENGINEER: ['CODE ENGINEER', 'SYSTEM BUILDER', 'NEURAL ARCHITECT', 'QUANTUM ENGINEER'],
                        SHAMAN: ['RUNE SHAMAN', 'RUNE SEER', 'RUNE PROPHET', 'RUNE DEITY'],
                        KEEPER: ['KEEPER OF LORE', 'CHRONICLER', 'GRAND ARCHIVIST', 'OMNISCIENT'],
                        WALKER: ['FIRST WALKER', 'ANCIENT WALKER', 'PRIMORDIAL', 'TIMELESS ENTITY'],
                        LORD: ['OASIS LORD', 'TERMINAL BARON', 'FRACTAL KING', 'EMPEROR'],
                        PRIME: ['FRACTAL PRIME', 'APEX PRIME', 'OMEGA PRIME', 'PRIME ABSOLUTE'],
                        SINGULARITY: ['THE SINGULARITY', 'THE SINGULARITY', 'THE SINGULARITY', 'THE SINGULARITY']
                    };

                    const evolutionPath = tierNames[baseKey] || tierNames.DRIFTER;
                    const title = evolutionPath[Math.min(tierLevel, evolutionPath.length - 1)];

                    return {
                        archetype: {
                            baseKey,
                            title,
                            tierLevel
                        },
                        badges,
                        metrics: {
                            address: addrIn,
                            txCount,
                            utxoCount,
                            first_tx_ts: firstTxTs,
                            lpValueUSD: providerValueUSD,
                            netWorth: Number(netWorthUSD.toFixed(2)),
                            fennecWalletBalance: fennecWalletOnly,
                            fennecLpValueUSD
                        }
                    };
                };

                let auditData = null;
                let auditDiagnostics = null;

                try {
                    const clientAudit =
                        body?.audit_data ||
                        body?.auditData ||
                        inputPayload?.audit_data ||
                        inputPayload?.auditData ||
                        null;
                    if (clientAudit && typeof clientAudit === 'object') {
                        auditData = clientAudit;
                        auditDiagnostics = { source: 'client_audit_snapshot' };
                    }
                } catch (_) {
                    void _;
                }

                try {
                    const base = new URL(request.url);
                    base.search = '';
                    const auditUrl = `${base.toString()}?action=fractal_audit&address=${encodeURIComponent(addrIn)}`;
                    if (!auditData) {
                        const auditRes = await fetch(auditUrl, {
                            method: 'GET',
                            headers: { Accept: 'application/json', 'x-internal': '1' }
                        });
                        let auditJson = null;
                        let rawText = null;
                        try {
                            rawText = await auditRes.text();
                            auditJson = rawText ? JSON.parse(rawText) : null;
                        } catch (_) {
                            auditJson = null;
                        }

                        const a = auditJson && typeof auditJson === 'object' ? auditJson.data || null : null;
                        if (auditJson && auditJson.code === 0 && a && typeof a === 'object') {
                            auditData = a;
                            auditDiagnostics = { source: 'self_fetch' };
                        } else {
                            auditDiagnostics = {
                                source: 'self_fetch_failed',
                                audit_url: auditUrl,
                                audit_http_status: auditRes.status,
                                audit_ok: !!auditRes.ok,
                                audit_json_code: auditJson?.code,
                                audit_json_msg: auditJson?.msg || auditJson?.error || null,
                                audit_preview: rawText ? String(rawText).slice(0, 500) : null
                            };
                        }
                    }
                } catch (e) {
                    if (!auditData) {
                        auditData = null;
                        auditDiagnostics = {
                            source: 'self_fetch_exception',
                            audit_exception: e?.message || String(e)
                        };
                    }
                }

                if (!auditData) {
                    const fallbackIdentity = {
                        archetype: {
                            baseKey: 'DRIFTER',
                            title: 'DESERT RUNNER',
                            tierLevel: 0
                        },
                        badges: [],
                        metrics: { address: addrIn }
                    };
                    const payloadKeyId = signer?.keyId || 'unconfigured';
                    const payload = {
                        schema: 'fennec.provenance.v1',
                        kind: String(inputPayload?.kind || 'mint'),
                        chain: String(inputPayload?.chain || 'fractal-bitcoin'),
                        address: addrIn,
                        html_sha256: htmlSha || null,
                        identity: fallbackIdentity,
                        identity_unverified: true,
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
                                signer_error: signerError,
                                ...(auditDiagnostics && __debugEnabled ? { audit_diagnostics: auditDiagnostics } : {})
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
                            public_key_jwk: signer.publicJwk,
                            ...(auditDiagnostics && __debugEnabled ? { audit_diagnostics: auditDiagnostics } : {})
                        }
                    });
                }

                const identity = computeIdentity(auditData);

                const payloadKeyId = signer?.keyId || 'unconfigured';
                const payload = {
                    schema: 'fennec.provenance.v1',
                    kind: String(inputPayload?.kind || 'mint'),
                    chain: String(inputPayload?.chain || 'fractal-bitcoin'),
                    address: addrIn,
                    html_sha256: htmlSha || null,
                    identity,
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
                if (!body) return sendJSON({ error: 'Invalid JSON body' }, 200);

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
                        {
                            error: `JSON parse error: ${e?.message || String(e)}`,
                            raw: text.substring(0, 200)
                        },
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
                        {
                            error: `JSON parse error: ${e?.message || String(e)}`,
                            raw: text.substring(0, 200)
                        },
                        response.status || 500
                    );
                }
            }

            // 4b. INSCRIPTION INFO (for Burn+Remint)
            if (action === 'inscription_info') {
                requireUniSatKey();
                const inscriptionId = url.searchParams.get('inscriptionId') || url.searchParams.get('id');
                if (!inscriptionId) return sendJSON({ code: -1, msg: 'Missing inscriptionId' }, 200);

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
                if (!inscriptionIdRaw) return sendJSON({ code: -1, msg: 'Missing inscriptionId' }, 200);

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
                    } catch (_) {
                        void _;
                    }

                    const makeRawResponse = (res, cacheSeconds) => {
                        const headers = new Headers(res.headers);
                        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);

                        try {
                            headers.delete('cross-origin-resource-policy');
                            headers.delete('Cross-Origin-Resource-Policy');
                            headers.delete('cross-origin-embedder-policy');
                            headers.delete('Cross-Origin-Embedder-Policy');
                            headers.delete('cross-origin-opener-policy');
                            headers.delete('Cross-Origin-Opener-Policy');
                            headers.delete('x-content-type-options');
                            headers.delete('X-Content-Type-Options');
                            headers.delete('content-security-policy');
                            headers.delete('Content-Security-Policy');
                            headers.delete('content-security-policy-report-only');
                            headers.delete('Content-Security-Policy-Report-Only');
                            headers.delete('x-frame-options');
                            headers.delete('X-Frame-Options');
                        } catch (_) {
                            void _;
                        }

                        // ИСПРАВЛЕНИЕ: Определяем правильный MIME type для JavaScript inscriptions
                        const currentCT = String(res.headers.get('content-type') || '').toLowerCase();
                        const isJSInscription =
                            idWithI === '961a15289f9ec4fb594a7543a5bc4cd94ce6feed2c7df994e8bfa456ada28a5ai0' ||
                            idWithI === '7aa235ba1220cb247c19c6e14f87004cb9c55a3e2f825ab3dbb6c6de5358df8ci0' ||
                            idWithI === '2d1cb598b3c43721850f7b7e5603dc1bfb85e0570afe79eedd20abe910a8fe01i0' ||
                            currentCT.includes('javascript') ||
                            currentCT.includes('application/x-javascript');

                        if (
                            isJSInscription &&
                            (currentCT.includes('text/html') || currentCT.includes('text/plain') || !currentCT)
                        ) {
                            headers.set('Content-Type', 'application/javascript; charset=utf-8');
                        }

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
                            const endpoint = `${FRACTAL_BASE}/indexer/inscription/content/${encodeURIComponent(
                                idWithI
                            )}`;
                            const res = await tryFetchRaw(endpoint, authHeaders());
                            if (res) {
                                const out = makeRawResponse(res, 86400);
                                try {
                                    ctx.waitUntil(cache.put(cacheKey, out.clone()));
                                } catch (_) {
                                    try {
                                        await cache.put(cacheKey, out.clone());
                                    } catch (_) {
                                        void _;
                                    }
                                }
                                return out;
                            }
                        }
                    } catch (_) {
                        void _;
                    }

                    const candidates = [];
                    if (idWithI) candidates.push(`https://uniscan.cc/fractal/content/${encodeURIComponent(idWithI)}`);
                    if (idNoI && idNoI !== idWithI)
                        candidates.push(`https://uniscan.cc/fractal/content/${encodeURIComponent(idNoI)}`);
                    if (idWithI) candidates.push(`https://ordinals.com/content/${encodeURIComponent(idWithI)}`);
                    if (idNoI && idNoI !== idWithI)
                        candidates.push(`https://ordinals.com/content/${encodeURIComponent(idNoI)}`);

                    for (const targetUrl of candidates) {
                        try {
                            const res = await tryFetchRaw(targetUrl);
                            if (res) {
                                const out = makeRawResponse(res, 86400);
                                try {
                                    ctx.waitUntil(cache.put(cacheKey, out.clone()));
                                } catch (_) {
                                    try {
                                        await cache.put(cacheKey, out.clone());
                                    } catch (_) {
                                        void _;
                                    }
                                }
                                return out;
                            }
                        } catch (_) {
                            void _;
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
                                    } catch (_) {
                                        void _;
                                    }
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
                        } catch (_) {
                            void _;
                        }
                        return out;
                    } catch (e) {
                        // continue
                    }
                }

                return sendJSON(
                    {
                        code: -1,
                        msg: 'Content fetch failed',
                        data: { contentType: '', body: '' }
                    },
                    200
                );
            }

            // 4c. PUSH TX (broadcast raw transaction)
            if (action === 'push_tx') {
                requireUniSatKey();
                const body = await request.json().catch(() => null);
                const rawtx = body?.rawtx;
                if (!rawtx) return sendJSON({ code: -1, msg: 'Missing rawtx' }, 200);

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
                if (!psbtHex) return sendJSON({ code: -1, msg: 'Missing psbt' }, 200);

                let rawtx = '';
                try {
                    const tx = btc.Transaction.fromPSBT(hex.decode(psbtHex));
                    try {
                        tx.finalize();
                    } catch (_) {
                        void _;
                    }
                    rawtx = hex.encode(tx.extract());
                } catch (e) {
                    return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
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

            if (action === 'tx_info') {
                requireUniSatKey();
                const txid = String(url.searchParams.get('txid') || '').trim();
                const chain = String(url.searchParams.get('chain') || '')
                    .trim()
                    .toUpperCase();
                if (!txid) return sendJSON({ code: -1, msg: 'Missing txid' }, 200);

                const base = chain.includes('BITCOIN') ? UNISAT_BASE : FRACTAL_BASE;
                const endpoint = `${base}/indexer/tx/${encodeURIComponent(txid)}`;
                const res = await fetch(endpoint, { headers: authHeaders() });
                const json = await res.json().catch(() => null);
                return sendJSON(json || { code: -1, msg: 'Invalid JSON from upstream' }, res.status);
            }

            if (action === 'burn_remint_psbt') {
                requireUniSatKey();
                const body = await request.json().catch(() => null);
                if (!body || typeof body !== 'object') return sendJSON({ code: -1, msg: 'Invalid JSON body' }, 200);

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

                if (!address) return sendJSON({ code: -1, msg: 'Missing address' }, 200);
                if (!burnAddress) return sendJSON({ code: -1, msg: 'Missing burnAddress' }, 200);
                if (!burnInscriptionId) return sendJSON({ code: -1, msg: 'Missing burnInscriptionId' }, 200);
                if (!inscriptionBody || typeof inscriptionBody !== 'object') {
                    return sendJSON({ code: -1, msg: 'Missing inscriptionBody' }, 200);
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
                        {
                            code: -1,
                            msg: 'Order create returned missing fields',
                            data: orderJson
                        },
                        200
                    );
                }

                let infoJson = null;
                try {
                    const endpoint = `${FRACTAL_BASE}/indexer/inscription/info/${encodeURIComponent(
                        burnInscriptionId
                    )}`;
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
                        {
                            code: -1,
                            msg: 'Failed to resolve burn UTXO for inscription',
                            data: infoJson
                        },
                        200
                    );
                }

                if (burnOwner && burnOwner !== address) {
                    return sendJSON(
                        {
                            code: -1,
                            msg: 'Inscription UTXO is not owned by provided address'
                        },
                        200
                    );
                }

                let addrUtxoJson = null;
                try {
                    const utxoUrl = `${FRACTAL_BASE}/indexer/address/${encodeURIComponent(
                        address
                    )}/utxo-data?cursor=0&size=200`;
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
                        {
                            code: -1,
                            msg: 'Insufficient funds to pay order in single transaction'
                        },
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
                    if (tapInternalKeyBytes && isTaprootScript(u.scriptPk)) input.tapInternalKey = tapInternalKeyBytes;
                    tx.addInput(input);
                }

                for (let i = 0; i < tx.inputsLength; i += 1) {
                    try {
                        tx.updateInput(i, { sighashType: btc.SigHash.ALL });
                    } catch (_) {
                        void _;
                    }
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
                    let response = await fetch(endpointUrl, {
                        headers: unisatApiHeaders
                    });
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

                    const headers = {
                        ...unisatApiHeaders,
                        'Content-Type': 'application/json'
                    };

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
                    let response = await fetch(endpointUrl, {
                        headers: unisatApiHeaders
                    });
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
                    let response = await fetch(endpointUrl, {
                        headers: unisatApiHeaders
                    });
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

                    const headers = {
                        ...unisatApiHeaders,
                        'Content-Type': 'application/json'
                    };

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

            if (action === 'deposit_balance') {
                const address = url.searchParams.get('address');
                const tick = url.searchParams.get('tick');
                if (!address || !tick) return sendJSON({ code: -1, msg: 'Missing address or tick' }, 200);
                try {
                    const endpoint = `${FRACTAL_BASE}/indexer/address/${encodeURIComponent(
                        address
                    )}/brc20/${encodeURIComponent(tick)}/info`;
                    const res = await fetch(endpoint, {
                        headers: upstreamHeaders
                    });
                    const json = await res.json().catch(() => null);
                    const transferable =
                        json?.data?.transferableBalance ||
                        json?.data?.balance?.transferableBalance ||
                        json?.data?.availableBalance ||
                        json?.data?.balance?.availableBalance ||
                        '0';
                    return sendJSON({
                        code: 0,
                        msg: 'OK',
                        data: {
                            externalBalance: { brc20: { transferable } }
                        }
                    });
                } catch (e) {
                    return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
                }
            }

            if (action === 'transferable_inscriptions') {
                const address = String(url.searchParams.get('address') || '').trim();
                const tick = String(url.searchParams.get('tick') || '').trim();
                const start = Math.max(0, parseInt(String(url.searchParams.get('start') || '0'), 10) || 0);
                const limit = Math.min(
                    1000,
                    Math.max(1, parseInt(String(url.searchParams.get('limit') || '16'), 10) || 16)
                );
                if (!address || !tick) return sendJSON({ error: 'Missing address or tick' }, 400);
                if (!API_KEY) return sendJSON({ error: 'UNISAT_API_KEY required' }, 403);
                try {
                    const endpoint =
                        `${FRACTAL_BASE}/indexer/address/${encodeURIComponent(address)}/brc20/` +
                        `${encodeURIComponent(tick)}/transferable-inscriptions?start=${start}&limit=${limit}`;
                    const res = await fetch(endpoint, { headers: upstreamHeaders });
                    const json = await res.json().catch(() => null);
                    if (json && typeof json === 'object' && json.data && typeof json.data === 'object') {
                        const d = json.data;
                        let list = [];
                        if (Array.isArray(d.list)) list = d.list;
                        else if (Array.isArray(d.detail)) list = d.detail;
                        else if (d.detail && typeof d.detail === 'object') list = [d.detail];
                        else if (Array.isArray(d.inscriptions)) list = d.inscriptions;
                        else if (Array.isArray(d.data)) list = d.data;
                        json.data = { ...d, list };
                    }
                    return sendJSON(json || { code: -1, msg: 'Invalid upstream response' }, res.status);
                } catch (e) {
                    return sendJSON({ error: e?.message || String(e) }, 500);
                }
            }

            if (action === 'quote_swap') {
                const tickIn = __normalizeSwapTick(url.searchParams.get('tickIn'));
                const tickOut = __normalizeSwapTick(url.searchParams.get('tickOut'));
                const exactType = String(url.searchParams.get('exactType') || 'exactIn');
                const amount = Number(url.searchParams.get('amount') || 0);
                if (!tickIn || !tickOut || !Number.isFinite(amount) || amount <= 0) {
                    return sendJSON({ code: -1, msg: 'Missing or invalid params' }, 200);
                }

                const __num = v => {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : 0;
                };

                const __extractReserves = d => {
                    if (!d || typeof d !== 'object') return null;
                    const t0 = __normalizeSwapTick(d.tick0);
                    const t1 = __normalizeSwapTick(d.tick1);
                    const r0 = __num(d.amount0 ?? d.reserve0 ?? d.r0 ?? d.liq0);
                    const r1 = __num(d.amount1 ?? d.reserve1 ?? d.r1 ?? d.liq1);
                    if (!t0 || !t1 || r0 <= 0 || r1 <= 0) return null;
                    return { t0, t1, r0, r1 };
                };

                try {
                    const query = `?tick0=${encodeURIComponent(tickIn)}&tick1=${encodeURIComponent(tickOut)}`;
                    let poolUrl = `${SWAP_BASE}/brc20-swap/pool_info${query}`;
                    let res = await fetch(poolUrl, { headers: upstreamHeaders });
                    if (!res.ok && res.status === 404) {
                        poolUrl = `${SWAP_BASE}/indexer/brc20-swap/pool_info${query}`;
                        res = await fetch(poolUrl, { headers: upstreamHeaders });
                    }
                    if (!res.ok) {
                        return sendJSON(
                            {
                                code: -1,
                                msg: `API error: ${res.status} ${res.statusText}`,
                                url: poolUrl
                            },
                            res.status
                        );
                    }
                    const json = await res.json().catch(() => null);
                    const data = json?.data && typeof json.data === 'object' ? json.data : json;
                    const r = __extractReserves(data);
                    if (!r) return sendJSON({ code: -1, msg: 'Pool reserves unavailable' }, 200);

                    let rIn = 0;
                    let rOut = 0;
                    if (tickIn === r.t0 && tickOut === r.t1) {
                        rIn = r.r0;
                        rOut = r.r1;
                    } else if (tickIn === r.t1 && tickOut === r.t0) {
                        rIn = r.r1;
                        rOut = r.r0;
                    } else {
                        return sendJSON({ code: -1, msg: 'Pool does not match requested pair' }, 200);
                    }

                    const feeMul = 985;
                    const feeDiv = 1000;

                    if (exactType === 'exactOut') {
                        const desiredOut = amount;
                        if (desiredOut >= rOut) return sendJSON({ code: -1, msg: 'Insufficient liquidity' }, 200);
                        const numerator = desiredOut * rIn * feeDiv;
                        const denominator = (rOut - desiredOut) * feeMul;
                        if (denominator <= 0) return sendJSON({ code: -1, msg: 'Invalid quote' }, 200);
                        const needIn = numerator / denominator;
                        return sendJSON({
                            code: 0,
                            msg: 'OK',
                            data: {
                                expect: String(needIn),
                                amountIn: String(needIn),
                                amountOut: String(desiredOut)
                            }
                        });
                    }

                    const amountIn = amount;
                    const feeIn = amountIn * feeMul;
                    const amountOut = (feeIn * rOut) / (rIn * feeDiv + feeIn);
                    return sendJSON({
                        code: 0,
                        msg: 'OK',
                        data: {
                            expect: String(amountOut),
                            amountIn: String(amountIn),
                            amountOut: String(amountOut)
                        }
                    });
                } catch (e) {
                    return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
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
                'pool_info'
            ];

            if (ALLOWED_GET.includes(action)) {
                // Кэшируем только глобальные GET, которые одинаковы для всех (например swap_history)
                // Это снижает нагрузку и ускоряет UI, но не кэшируем персональные операции.
                if (action === 'swap_history') {
                    try {
                        const cache = caches.default;
                        const cacheKeyUrl = new URL(request.url);
                        cacheKeyUrl.searchParams.delete('action');
                        // фиксированный ключ для одного и того же запроса
                        const swapCacheKey = new Request(
                            `https://fennec-api.pages.dev/swap_history?${cacheKeyUrl.searchParams.toString()}`,
                            {
                                method: 'GET'
                            }
                        );
                        const cached = await cache.match(swapCacheKey);
                        if (cached) return cached;

                        const proxyParams = new URLSearchParams(url.searchParams);
                        proxyParams.delete('action');
                        const endpoint = action;
                        let endpointUrl = `${SWAP_BASE}/brc20-swap/${endpoint}?${proxyParams.toString()}`;
                        let response = await fetch(endpointUrl, {
                            method: 'GET',
                            headers: upstreamHeaders
                        });
                        if (!response.ok && response.status === 404) {
                            endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/${endpoint}?${proxyParams.toString()}`;
                            response = await fetch(endpointUrl, {
                                method: 'GET',
                                headers: upstreamHeaders
                            });
                        }
                        const json = await response.json();
                        const out = sendJSON(json, response.status);
                        out.headers.set('Cache-Control', 's-maxage=60, max-age=30');
                        if (ctx?.waitUntil) ctx.waitUntil(cache.put(swapCacheKey, out.clone()));
                        else await cache.put(swapCacheKey, out.clone());
                        return out;
                    } catch (_) {
                        // fallback to uncached below
                    }
                }
                const proxyParams = new URLSearchParams(url.searchParams);
                proxyParams.delete('action');

                const __maybeNormalizeParam = name => {
                    if (!proxyParams.has(name)) return;
                    proxyParams.set(name, __normalizeSwapTick(proxyParams.get(name)));
                };

                __maybeNormalizeParam('tick0');
                __maybeNormalizeParam('tick1');
                __maybeNormalizeParam('tick');
                __maybeNormalizeParam('tickIn');
                __maybeNormalizeParam('tickOut');
                __maybeNormalizeParam('feeTick');

                let endpoint = action;
                if (action === 'create_swap') endpoint = 'pre_swap';

                const isBridgeCreateDeposit =
                    action === 'create_deposit' && !proxyParams.has('inscriptionId') && proxyParams.has('networkType');
                const isBridgeCreateWithdraw =
                    action === 'create_withdraw' && (proxyParams.has('networkType') || proxyParams.has('feeRate'));
                void isBridgeCreateDeposit;
                void isBridgeCreateWithdraw;

                let endpointUrl = `${SWAP_BASE}/brc20-swap/${endpoint}?${proxyParams.toString()}`;
                let response = await fetch(endpointUrl, {
                    method: 'GET',
                    headers: upstreamHeaders
                });
                if (!response.ok && response.status === 404) {
                    endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/${endpoint}?${proxyParams.toString()}`;
                    response = await fetch(endpointUrl, {
                        method: 'GET',
                        headers: upstreamHeaders
                    });
                }
                return sendJSON(await response.json(), response.status);
            }

            // 6. PROXY POST
            if (['submit_swap', 'confirm_deposit', 'confirm_withdraw'].includes(action)) {
                const body = await request.json();
                let endpoint = action;
                if (action === 'submit_swap') endpoint = 'swap';
                const isBrc20DepositConfirm =
                    action === 'confirm_deposit' && body && typeof body === 'object' && 'inscriptionId' in body;
                const isSwapSubmit = action === 'submit_swap';
                if (isSwapSubmit || isBrc20DepositConfirm) {
                    let endpointUrl = `${SWAP_BASE}/brc20-swap/${endpoint}`;
                    let response = await fetch(endpointUrl, {
                        method: 'POST',
                        headers: upstreamHeaders,
                        body: JSON.stringify(body)
                    });
                    if (!response.ok && response.status === 404) {
                        endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/${endpoint}`;
                        response = await fetch(endpointUrl, {
                            method: 'POST',
                            headers: upstreamHeaders,
                            body: JSON.stringify(body)
                        });
                    }
                    return sendJSON(await response.json(), response.status);
                }

                let endpointUrl = `${SWAP_BASE}/brc20-swap/${endpoint}`;
                let response = await fetch(endpointUrl, {
                    method: 'POST',
                    headers: upstreamHeaders,
                    body: JSON.stringify(body)
                });
                if (!response.ok && response.status === 404) {
                    endpointUrl = `${SWAP_BASE}/indexer/brc20-swap/${endpoint}`;
                    response = await fetch(endpointUrl, {
                        method: 'POST',
                        headers: upstreamHeaders,
                        body: JSON.stringify(body)
                    });
                }
                return sendJSON(await response.json(), response.status);
            }

            // 7. BALANCE
            // ОПТИМИЗАЦИЯ: Batch балансов для уменьшения запросов
            if (action === 'balance_batch') {
                const address = url.searchParams.get('address');
                const ticks = url.searchParams.get('ticks')?.split(',') || [];
                const walletOnly = url.searchParams.get('walletOnly') === 'true';

                if (!address || ticks.length === 0) {
                    return sendJSON({ error: 'Missing address or ticks' }, 200);
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
                        let balanceRes = await fetch(balanceUrl, {
                            headers: upstreamHeaders
                        });

                        // Fallback: если не работает без /indexer/, пробуем с /indexer/
                        if (!balanceRes.ok && balanceRes.status === 404) {
                            balanceUrl = `${SWAP_BASE}/indexer/brc20-swap/balance?address=${address}&tick=${tick}`;
                            balanceRes = await fetch(balanceUrl, {
                                headers: upstreamHeaders
                            });
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
                                {
                                    error: `JSON parse error: ${parseError.message}`,
                                    raw: text.substring(0, 200)
                                },
                                500
                            );
                        }
                    } catch (e) {
                        return sendJSON({ error: `Fetch error: ${e.message}` }, 500);
                    }
                } else {
                    try {
                        let balanceUrl = `${SWAP_BASE}/brc20-swap/balance?address=${address}&tick=${tick}`;
                        let res = await fetch(balanceUrl, { headers: upstreamHeaders });
                        if (!res.ok && res.status === 404) {
                            balanceUrl = `${SWAP_BASE}/indexer/brc20-swap/balance?address=${address}&tick=${tick}`;
                            res = await fetch(balanceUrl, { headers: upstreamHeaders });
                        }

                        if (!res.ok) {
                            return sendJSON(
                                {
                                    error: `API error: ${res.status} ${res.statusText}`,
                                    url: balanceUrl
                                },
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
                                {
                                    error: `JSON parse error: ${parseError.message}`,
                                    raw: text.substring(0, 200)
                                },
                                500
                            );
                        }
                    } catch (e) {
                        return sendJSON({ error: `Fetch error: ${e.message}` }, 500);
                    }
                }
            }

            // 8. FIP-101 HISTORY (smartFetch: Free → Paid)
            if (action === 'history') {
                const address = url.searchParams.get('address');
                const tick = url.searchParams.get('tick');

                if (!address) return sendJSON({ code: -1, msg: 'No address' }, 400);

                let targetUrl;
                if (tick && tick !== 'FB') {
                    targetUrl = `${FRACTAL_BASE}/indexer/address/${address}/brc20/${tick}/history?type=transfer&start=0&limit=10`;
                } else {
                    targetUrl = `${FRACTAL_BASE}/indexer/address/${address}/history?cursor=0&size=10`;
                }

                const result = await smartFetch(targetUrl).catch(() => null);
                if (!result || result.code !== 0) {
                    return sendJSON({ code: 0, data: { list: [] } }, 200);
                }
                return sendJSON(result, 200);
            }

            // 9. FULL UTXO DATA (smartFetch: Free → Paid)
            if (action === 'full_utxo_data') {
                const address = url.searchParams.get('address');
                const cursor = url.searchParams.get('cursor') || '0';
                const size = url.searchParams.get('size') || '50';

                if (!address) return sendJSON({ error: 'Missing address' }, 200);

                const endpoint = `${FRACTAL_BASE}/indexer/address/${address}/utxo-data?cursor=${cursor}&size=${size}`;
                const result = await smartFetch(endpoint).catch(() => null);

                if (result && result.code === 0) {
                    return sendJSON(result, 200);
                }

                return sendJSON(
                    {
                        code: 0,
                        data: { list: [], total: 0 },
                        msg: 'UTXO data unavailable'
                    },
                    200
                );
            }

            // --- FENNEC ID DATA (Simplified: Prices + Summary only) ---
            if (action === 'audit_data_light' || (action === 'audit_data' && url.searchParams.get('lite') === '1')) {
                const address = url.searchParams.get('address');
                if (!address) return sendJSON({ error: 'No address' }, 200);

                // Хелпер для безопасного фетча (никогда не кидает throw)
                // ИСПРАВЛЕНИЕ: Throttling для UniSat API (1-2 запроса в секунду)
                let lastUniSatRequest = 0;
                const UNISAT_THROTTLE_MS = 4000; // ОПТИМИЗАЦИЯ: Увеличено до 4000ms = 0.25 запроса в секунду для множества пользователей

                // Кэш для ответов (30 секунд для UI) - рекомендация UniSat
                const responseCache = new Map();
                const CACHE_TTL = 60000; // 60 секунд для балансов и метаданных (для множества пользователей)

                const safeFetch = async (p, options = {}) => {
                    const { useCache = false, cacheKey = null, isUniSat = false, maxRetries = 3 } = options;

                    // Проверяем кэш
                    if (useCache && cacheKey) {
                        const cached = responseCache.get(cacheKey);
                        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                            return cached.data;
                        }
                    }

                    let retries = maxRetries;
                    let lastError = null;

                    while (retries >= 0) {
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
                            const response = await (typeof p === 'function' ? p() : p);

                            if (!response.ok) {
                                // KEY HOPPING: Мгновенная смена ключа при 429
                                if (response.status === 429 && isUniSat) {
                                    const currentKey = upstreamHeaders.Authorization || '';
                                    const currentKeyLast4 = currentKey.slice(-4);

                                    console.log(
                                        `[KeyHopping] 429 on key ending in ...${currentKeyLast4}. Switching to next key.`
                                    );

                                    // Пробуем получить новый ключ
                                    const newKey = __pickUniSatKey();

                                    if (newKey && newKey !== currentKey.replace('Bearer ', '')) {
                                        // KEY SWITCHED: INSTANT RETRY
                                        upstreamHeaders.Authorization = `Bearer ${newKey}`;
                                        if (typeof unisatApiHeaders !== 'undefined') {
                                            unisatApiHeaders.Authorization = `Bearer ${newKey}`;
                                        }

                                        const newKeyLast4 = newKey.slice(-4);
                                        console.log(
                                            `[KeyHopping] Switched to new key ending in ...${newKeyLast4}. Retrying immediately.`
                                        );

                                        // Ждем минимальную задержку (100ms) и повторяем
                                        await new Promise(r => setTimeout(r, 100));
                                        retries--; // Уменьшаем счетчик попыток
                                        continue; // Retry loop
                                    } else {
                                        // NO NEW KEYS AVAILABLE: Fallback to standard wait
                                        const delayMs = 2000 * (maxRetries - retries + 1);
                                        console.log(
                                            `[KeyHopping] No fresh keys available. Waiting ${delayMs}ms before retry.`
                                        );
                                        await new Promise(r => setTimeout(r, delayMs));
                                        retries--;
                                        continue;
                                    }
                                }

                                // Для других ошибок возвращаем null
                                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                                return null;
                            }

                            const data = await response.json();

                            // Сохраняем в кэш
                            if (useCache && cacheKey) {
                                responseCache.set(cacheKey, { data, timestamp: Date.now() });
                            }

                            return data;
                        } catch (err) {
                            lastError = err;
                            console.warn(`Fetch error (${retries} retries left):`, err.message);

                            if (retries > 0) {
                                // Простой backoff для сетевых ошибок
                                await new Promise(r => setTimeout(r, 1000));
                                retries--;
                                continue;
                            }

                            return null;
                        }
                    }

                    console.warn('All retries exhausted:', lastError?.message);
                    return null;
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
                            fetch(`${SWAP_BASE}/brc20-swap/pool_info?tick0=sBTC___000&tick1=sFB___000`, {
                                headers: upstreamHeaders
                            })
                        ),
                        safeFetch(
                            fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0',
                                    Accept: 'application/json'
                                }
                            })
                        ),
                        safeFetch(
                            fetch(`${SWAP_BASE}/brc20-swap/pool_info?tick0=FENNEC&tick1=sFB___000`, {
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
                        const isFennecFirst = fennecPoolRes.data.tick0 && fennecPoolRes.data.tick0.includes('FENNEC');
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
                                fetch(`${FRACTAL_BASE}/indexer/address/${address}/history?start=${offset}&limit=1`, {
                                    headers: upstreamHeaders
                                })
                            );
                            if (hRes?.data?.detail?.[0]) {
                                firstTxTime = hRes.data.detail[0].blocktime || hRes.data.detail[0].timestamp || 0;
                            }
                        } catch (e) {
                            void e;
                        }
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
                            first_tx_ts: firstTxTime,
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

                const cache = caches.default;
                const cacheKeyUrl = new URL(request.url);
                cacheKeyUrl.searchParams.delete('pubkey');
                cacheKeyUrl.searchParams.delete('t');
                cacheKeyUrl.searchParams.delete('ts');
                cacheKeyUrl.searchParams.delete('_');
                cacheKeyUrl.searchParams.delete('debug');
                cacheKeyUrl.searchParams.set('v', '1');
                const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });

                if (!__debugEnabled) {
                    const cached = await cache.match(cacheKey);
                    if (cached) return cached;
                }

                if (__disableInswap) {
                    const summary = {
                        address: address,
                        all_balance: {},
                        lp_list: [],
                        lp_count: 0,
                        lp_total_usd: 0,
                        total_usd: 0,
                        user_info: {},
                        tokens: {},
                        lp_positions: [],
                        synced_at: new Date().toISOString()
                    };
                    const out = { code: 0, data: summary };
                    if (__debugEnabled) out._debug = { source: 'inswap_summary', disabled: true };
                    const response = sendJSON(out);
                    try {
                        response.headers.set('Cache-Control', 's-maxage=120, max-age=30');
                        if (!__debugEnabled) {
                            if (ctx?.waitUntil) ctx.waitUntil(cache.put(cacheKey, response.clone()));
                            else await cache.put(cacheKey, response.clone());
                        }
                    } catch (_) {
                        void _;
                    }
                    return response;
                }

                try {
                    void pubkey;
                    const myPoolListUrl = `${SWAP_BASE}/brc20-swap/my_pool_list?address=${address}&start=0&limit=100`;
                    let myPoolListRes = await fetch(myPoolListUrl, {
                        headers: upstreamHeaders
                    }).catch(() => null);
                    if (!myPoolListRes?.ok && myPoolListRes?.status === 404) {
                        const myPoolListUrlIdx = `${SWAP_BASE}/indexer/brc20-swap/my_pool_list?address=${address}&start=0&limit=100`;
                        myPoolListRes = await fetch(myPoolListUrlIdx, {
                            headers: upstreamHeaders
                        }).catch(() => null);
                    }
                    const myPoolList = myPoolListRes?.ok ? await myPoolListRes.json().catch(() => null) : null;

                    // Собираем summary данные из InSwap (как в коде пользователя)
                    const summary = {
                        address: address,
                        // Балансы из all_balance (getAllBalance)
                        all_balance: {},
                        // LP данные из my_pool_list (myPoolList)
                        lp_list: myPoolList?.data?.list || [],
                        lp_count: myPoolList?.data?.list?.length || 0,
                        lp_total_usd: myPoolList?.data?.totalLpUSD || 0,
                        // Net worth из address_usd (getAddressUsd) или all_balance
                        total_usd: 0,
                        // User info (userInfo) - дополнительная информация о пользователе
                        user_info: {},
                        // Детали по токенам (обработанные из all_balance)
                        tokens: {},
                        // LP позиции (если есть в all_balance)
                        lp_positions: [],
                        synced_at: new Date().toISOString()
                    };

                    const out = { code: 0, data: summary };
                    if (__debugEnabled) {
                        out._debug = {
                            source: 'inswap_summary',
                            my_pool_list_code: myPoolList?.code,
                            my_pool_list_msg: myPoolList?.msg,
                            tokens_count: Object.keys(summary.tokens).length,
                            lp_positions_count: summary.lp_positions.length
                        };
                    }

                    const response = sendJSON(out);
                    try {
                        response.headers.set('Cache-Control', 's-maxage=120, max-age=30');
                        if (!__debugEnabled) {
                            if (ctx?.waitUntil) ctx.waitUntil(cache.put(cacheKey, response.clone()));
                            else await cache.put(cacheKey, response.clone());
                        }
                    } catch (_) {
                        void _;
                    }
                    return response;
                } catch (e) {
                    return sendJSON({ error: 'InSwap Summary error: ' + e.message }, 500);
                }
            }

            // --- AUDIT DATA / FRACTAL AUDIT (Smart Logic: TX Count First → Genesis History) ---
            if (action === 'audit_data' || action === 'fractal_audit') {
                const address = url.searchParams.get('address');
                if (!address) return sendJSON({ error: 'Address required' }, 400);

                const response = {
                    address,
                    audit_time: new Date().toISOString(),
                    stages: { tx_count: 'pending', history: 'pending', wealth: 'pending', collections: 'pending' }
                };

                try {
                    // STAGE A: TX COUNT & WALLET AGE
                    // 1. Try UniSat Summary (smartFetch: Free → Paid)
                    let tx_count = 0;
                    const summary = await smartFetch(
                        `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/summary`
                    ).catch(() => null);

                    if (summary?.data?.txCount !== undefined) {
                        tx_count = Number(summary.data.txCount || 0) || 0;
                    } else {
                        // Fallback: Mempool (Free)
                        const mempoolRes = await fetch(`https://mempool.fractalbitcoin.io/api/address/${address}`);
                        const mempoolStats = await mempoolRes.json().catch(() => ({}));
                        const chain = mempoolStats.chain_stats || {};
                        const mem = mempoolStats.mempool_stats || {};
                        tx_count = Number(chain.tx_count || 0) + Number(mem.tx_count || 0) || 0;
                    }
                    response.tx_count = tx_count;
                    response.stages.tx_count = 'done';

                    // 2. Genesis Transaction Timestamp (if wallet has transactions)
                    response.first_tx_ts = 0;
                    if (tx_count > 0) {
                        const genesisStart = tx_count - 1;
                        const genesisHistory = await smartFetch(
                            `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/history?start=${genesisStart}&limit=1`
                        ).catch(() => null);
                        const genesisTx = genesisHistory?.data?.detail?.[0];
                        if (genesisTx?.timestamp) {
                            response.first_tx_ts = Number(genesisTx.timestamp) || 0;
                        }
                    }
                    response.stages.history = 'done';

                    await new Promise(r => setTimeout(r, 200));

                    // STAGE B: WEALTH (MONEY)
                    // Native Balance (Mempool)
                    const mempoolRes = await fetch(`https://mempool.fractalbitcoin.io/api/address/${address}`);
                    const mempoolStats = await mempoolRes.json().catch(() => ({}));
                    const chain = mempoolStats.chain_stats || {};
                    response.native_balance =
                        (Number(chain.funded_txo_sum || 0) - Number(chain.spent_txo_sum || 0)) / 1e8 || 0;

                    // BRC20 Summary (smartFetch)
                    const brc20 = await smartFetch(
                        `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/brc20/summary?start=0&limit=100`
                    ).catch(() => ({ data: { total: 0, detail: [] } }));
                    response.brc20_summary = { total: brc20.data?.total || 0, list: brc20.data?.detail || [] };
                    response.brc20_count = response.brc20_summary.list.length;

                    // Runes Balance (smartFetch)
                    const runes = await smartFetch(
                        `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/runes/balance-list?start=0&limit=100`
                    ).catch(() => ({ data: { total: 0 } }));
                    response.runes_count = runes.data?.total || 0;

                    // UTXO Count (smartFetch)
                    const utxos = await smartFetch(
                        `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/inscription-utxo-data?cursor=0&size=20`
                    ).catch(() => ({ data: { total: 0 } }));
                    response.utxo_count = utxos.data?.total || 0;

                    response.stages.wealth = 'done';

                    await new Promise(r => setTimeout(r, 200));

                    // STAGE C: COLLECTIONS (ORDINALS)
                    const colData = await smartFetch(
                        'https://open-api-fractal.unisat.io/v3/market/collection/auction/collection_summary',
                        {
                            method: 'POST',
                            body: JSON.stringify({ address })
                        }
                    ).catch(() => ({ data: { list: [] } }));

                    const colList = colData.data?.list || [];
                    const fennecBox = colList.find(c => c.collectionId === 'fennec_boxes');

                    // CRITICAL: Ordinals count is SUM of all collections' total field
                    response.ordinals_count = colList.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
                    response.total_collections = colList.length;
                    response.fennec_boxes_count = fennecBox ? Number(fennecBox.total) || 0 : 0;
                    response.has_fennec_boxes = response.fennec_boxes_count > 0;
                    response.all_collections = colList;
                    response.stages.collections = 'done';

                    // Legacy fields for UI compatibility
                    response.data = { ...response };

                    return sendJSON({ code: 0, data: response });
                } catch (e) {
                    return sendJSON({ error: e.message, stack: e.stack }, 500);
                }
            }

            // --- LEGACY audit_data_light REMOVED (use audit_data with lite=1 if needed) ---

            // --- FENNEC ID DATA (audit_data_light) ---
            if (action === 'audit_data_light') {
                const address = url.searchParams.get('address');
                if (!address) return sendJSON({ error: 'No address' }, 200);

                try {
                    const mempoolRes = await fetch(`https://mempool.fractalbitcoin.io/api/address/${address}`);
                    const mempool = await mempoolRes.json().catch(() => ({}));
                    const chain = mempool.chain_stats || {};
                    const mem = mempool.mempool_stats || {};

                    return sendJSON({
                        code: 0,
                        data: {
                            address,
                            tx_count: (chain.tx_count || 0) + (mem.tx_count || 0),
                            native_balance: ((chain.funded_txo_sum || 0) - (chain.spent_txo_sum || 0)) / 1e8
                        }
                    });
                } catch (e) {
                    return sendJSON({ error: e.message }, 500);
                }
            }

            // --- СТАРЫЙ КОД AUDIT_DATA УДАЛЕН (~5190 строк) ---
            // Полностью заменен на компактную оптимизированную версию с smartFetch выше (строки 3764-3834)
            // Старая версия использовала сложную логику кэширования, throttling, safeFetch, multiple sources
            // Новая версия: простая, быстрая, использует smartFetch (Free -> Paid fallback)

            // --- AI CHAT (OpenAI) ---
            if (action === 'chat') {
                if (request.method !== 'POST') return sendJSON({ error: 'Method not allowed' }, 405);

                let userMessage = '';
                let history = [];
                let uiContext = {};

                const __fallbackChat = text => {
                    const raw = String(text || '').trim();
                    const t = raw.toLowerCase();

                    const numMatch = raw.match(/(\d+(?:\.\d+)?)/);
                    const amount = numMatch ? numMatch[1] : '';

                    const mkReply = (msg, actionObj) => {
                        const safeMsg = String(msg || '').trim();
                        if (actionObj) return `${safeMsg}\n\n|||${JSON.stringify(actionObj)}|||`;
                        return safeMsg;
                    };

                    if (t.includes('connect') && t.includes('wallet')) {
                        return mkReply('AI is temporarily unavailable. I can still trigger wallet connection.', {
                            type: 'CONNECT_WALLET',
                            params: {}
                        });
                    }

                    if (t.includes('deposit')) {
                        return mkReply('AI is temporarily unavailable. I can still open the deposit tab.', {
                            type: 'OPEN_DEPOSIT',
                            params: {}
                        });
                    }

                    if (t.includes('withdraw')) {
                        return mkReply('AI is temporarily unavailable. I can still open the withdraw tab.', {
                            type: 'OPEN_WITHDRAW',
                            params: {}
                        });
                    }

                    if (t.includes('swap') || t.includes('buy') || t.includes('sell')) {
                        const hasBtc = t.includes('btc');
                        const pair = hasBtc ? 'BTC_FB' : 'FB_FENNEC';

                        let buy = true;
                        if (pair === 'FB_FENNEC') {
                            if (t.includes('sell') && t.includes('fennec')) buy = false;
                            if (t.includes('to fb')) buy = false;
                            if (t.includes('buy') && t.includes('fennec')) buy = true;
                            if (t.includes('to fennec')) buy = true;
                        } else {
                            if (t.includes('sell') && (t.includes('fb') || t.includes('sfb'))) buy = false;
                            if (t.includes('to btc')) buy = false;
                            if (t.includes('buy') && (t.includes('fb') || t.includes('sfb'))) buy = true;
                            if (t.includes('to fb')) buy = true;
                        }

                        return mkReply('AI is temporarily unavailable. I can still prefill the swap form for you.', {
                            type: 'FILL_SWAP',
                            params: {
                                pair,
                                amount: amount || '0.0',
                                buy
                            }
                        });
                    }

                    return 'AI is temporarily unavailable (Gemini key missing/blocked). Please try again later.';
                };

                try {
                    const ip =
                        String(request.headers.get('CF-Connecting-IP') || '').trim() ||
                        String(request.headers.get('X-Forwarded-For') || '')
                            .split(',')[0]
                            .trim() ||
                        'unknown';

                    if (env?.RATE_LIMITER) {
                        const bucket = Math.floor(Date.now() / 3600000);
                        const k = `chat:${ip}:${bucket}`;
                        const v = Number((await env.RATE_LIMITER.get(k)) || 0) || 0;
                        if (v >= 20) return sendJSON({ reply: 'Too many messages. Chill.' }, 429);
                        await env.RATE_LIMITER.put(k, String(v + 1), {
                            expirationTtl: 3600
                        });
                    } else {
                        const rl = __rateLimit(`ip:${ip}:chat`, 20, 3_600_000);
                        if (!rl.ok) return sendJSON({ reply: 'Too many messages. Chill.' }, 429);
                    }
                } catch (_) {
                    void _;
                }

                try {
                    const body = await request.json();
                    userMessage = body?.message;
                    history = Array.isArray(body?.history) ? body.history : [];
                    uiContext = body?.context && typeof body.context === 'object' ? body.context : {};
                } catch (_) {
                    void _;
                }

                try {
                    const builtinKnowledgeBase = `Fennec Swap is a DEX + terminal on Fractal Bitcoin.

KEY FACTS:
- Fractal Bitcoin is a Bitcoin-adjacent network with fast blocks (~30s).
- FENNEC is a BRC-20 token on Fractal.
- FB (sFB___000) is the native gas / main asset in the UI.
- BTC (sBTC___000) is bridged BTC inside Fractal.

TERMINAL OPERATIONS:
- SWAP: FB ↔ FENNEC and BTC ↔ FB.
- DEPOSIT: funds move from Bitcoin/Fractal into Fractal; balances appear after confirmations.
- WITHDRAW: funds move from Fractal back to Bitcoin mainnet.
  - Withdraw often has two tx identifiers: a burn/fee tx on Fractal and a receiveTxid on Bitcoin mainnet.

UNISAT:
- The site uses UniSat as a browser extension wallet (window.unisat).

FENNEC ID (v6.0, brief):
- Score (0..100) is derived from Activity/Wealth/Time/Badges, with an optional MAXI multiplier.
- Rarity thresholds: CUB(0-29), SCOUT(30-49), HUNTER(50-64), ALPHA(65-79), ELDER(80-94), SPIRIT(95-100).
- MAXI activates if FENNEC >= 10,000 or there is a LP position involving FENNEC.

IF YOU ARE NOT SURE:
- Say you are not sure.
- Provide verifiable sources or a search query.`;

                    let knowledgeBase = builtinKnowledgeBase;
                    try {
                        const controller = new AbortController();
                        setTimeout(() => controller.abort(), 1500);
                        const kbRes = await fetch('https://fennecbtc.xyz/knowledge_en.txt', {
                            signal: controller.signal
                        });
                        if (kbRes.ok) {
                            const kbText = await kbRes.text();
                            const trimmed = (kbText || '').trim();
                            knowledgeBase = trimmed ? `${trimmed}\n\n${builtinKnowledgeBase}` : builtinKnowledgeBase;
                        }
                    } catch (e) {
                        void e;
                    }

                    let marketData = 'Price unavailable.';
                    try {
                        const cacheObj = globalThis.__fennecChatPriceCache || (globalThis.__fennecChatPriceCache = {});
                        const now = Date.now();
                        if (cacheObj.ts && cacheObj.text && now - cacheObj.ts < 15000) {
                            marketData = cacheObj.text;
                        } else if (!__disableInswap) {
                            let poolUrl = `${SWAP_BASE}/brc20-swap/pool_info?tick0=FENNEC&tick1=sFB___000`;
                            let poolRes = await fetch(poolUrl, { headers: upstreamHeaders });
                            if (!poolRes.ok && poolRes.status === 404) {
                                poolUrl = `${SWAP_BASE}/indexer/brc20-swap/pool_info?tick0=FENNEC&tick1=sFB___000`;
                                poolRes = await fetch(poolUrl, { headers: upstreamHeaders });
                            }
                            const poolJson = await poolRes.json();
                            if (poolJson.data) {
                                const fennec = parseFloat(poolJson.data.amount0 || poolJson.data.amount1);
                                const fb = parseFloat(poolJson.data.amount1 || poolJson.data.amount0);
                                const price = (fb / fennec).toFixed(8);
                                marketData = `PRICE: 1 FENNEC = ${price} FB.`;
                                cacheObj.ts = now;
                                cacheObj.text = marketData;
                            }
                        }
                    } catch (e) {
                        void e;
                    }

                    const contextStr = `Section: ${uiContext.section || 'home'}, Tab: ${
                        uiContext.tab || 'none'
                    }, Swap: ${uiContext.swapPair || 'N/A'}`;

                    const systemPrompt = `
You are Fennec (Fennec Oracle), the AI assistant of the Fennec terminal on Fractal Bitcoin.
Your goal is to help users trade, debug issues, and understand the ecosystem.

CURRENT UI CONTEXT:
${contextStr}

KNOWLEDGE BASE:
${knowledgeBase}

MARKET DATA:
${marketData}

INSTRUCTIONS:
1. LANGUAGE: ALWAYS respond in English. Do not output any non-English words. If the user writes in another language, respond in English.
2. If the question is about Fennec/Fractal/UniSat/Terminal errors, answer precisely using the Knowledge Base.
3. If you are unsure, say so and provide verifiable sources or a search query.
4. Style: concise, technical, friendly.

=== TERMINAL FUNCTIONS ===
SWAP: Swap FB ↔ FENNEC and BTC ↔ FB
DEPOSIT: Deposit BTC/FB/FENNEC into Fractal
WITHDRAW: Withdraw to Bitcoin mainnet (burn on Fractal)
FENNEC ID: Generate and view your Fennec ID card

=== AI COMMANDS ===
1. NAVIGATE: {"type":"NAVIGATE","params":{"tab":"swap|deposit|withdraw|id"}}
2. FILL_SWAP: {"type":"FILL_SWAP","params":{"pair":"FB_FENNEC|BTC_FB","amount":"0.5","buy":true|false}}
   - buy=true: BUY FENNEC (you pay FB/BTC)
   - buy=false: SELL FENNEC (you pay FENNEC)
3. EXECUTE_SWAP: auto-execute the swap after filling
4. CONNECT_WALLET: {"type":"CONNECT_WALLET","params":{}}
5. OPEN_ID: {"type":"OPEN_ID","params":{}}

EXAMPLES:
- "swap 0.5 FB to FENNEC" → |||{"type":"FILL_SWAP","params":{"pair":"FB_FENNEC","amount":"0.5","buy":true}}|||
- "sell 100 FENNEC" → |||{"type":"FILL_SWAP","params":{"pair":"FB_FENNEC","amount":"100","buy":false}}|||
- "show my ID" → |||{"type":"OPEN_ID","params":{}}|||
`;

                    let conversationHistory = '';
                    for (const h of history.slice(-6)) {
                        const role = h && h.role === 'assistant' ? 'AI' : 'User';
                        const content = h && typeof h.content === 'string' ? h.content : '';
                        if (content && content.length <= 500) {
                            conversationHistory += `${role}: ${content}\n`;
                        }
                    }

                    const fullPrompt = `${systemPrompt}\n\n${
                        conversationHistory ? 'History:\n' + conversationHistory + '\n' : ''
                    }User: ${String(userMessage || '')}`;

                    const result = await callGemini(fullPrompt, {
                        purpose: 'chat',
                        useSearch: true,
                        temperature: 0.7,
                        maxModelAttempts: 3,
                        timeoutMs: 12000
                    });

                    let replyText = String(result.text || '').trim();
                    try {
                        if (replyText && /[\u0400-\u04FF]/.test(replyText)) {
                            const rewrite = await callGemini(
                                `Rewrite the following text in English only. Output ONLY English.\n\nTEXT:\n${replyText}`,
                                {
                                    purpose: 'chat',
                                    useSearch: false,
                                    temperature: 0.2,
                                    maxModelAttempts: 1,
                                    timeoutMs: 6000
                                }
                            );
                            const fixed = String(rewrite && rewrite.text ? rewrite.text : '').trim();
                            if (fixed && !/[\u0400-\u04FF]/.test(fixed)) replyText = fixed;
                        }
                    } catch (e) {
                        void e;
                    }

                    return sendJSON({ reply: replyText || 'Empty reply.' });
                } catch (e) {
                    console.error('Chat error:', e);
                    const fallbackReply = __fallbackChat(userMessage);
                    return sendJSON({ reply: fallbackReply || 'AI is temporarily unavailable.' }, 200);
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

            // --- QA AGENT CHECK (Gemini) ---
            if (action === 'qa_agent_check') {
                if (request.method !== 'POST') return sendJSON({ error: 'Method not allowed' }, 405);

                try {
                    const body = await request.json();
                    const { page_state, console_logs, network_errors } = body;

                    const errorLogs = (console_logs || []).filter(l => l.type === 'error');
                    const hasErrors = errorLogs.length > 0 || (network_errors || []).length > 0;

                    if (!hasErrors) {
                        return sendJSON({
                            status: 'PASS',
                            message: 'Все системы работают нормально. Ошибок не обнаружено.'
                        });
                    }

                    const prompt = `Ты QA Lead. Проверь состояние страницы.

Логи: ${JSON.stringify(errorLogs, null, 2)}
Сетевые ошибки: ${JSON.stringify(network_errors, null, 2)}
Состояние страницы: ${JSON.stringify(page_state, null, 2)}

Если есть ошибки (красные логи, NaN в балансах, пустые списки):
Верни JSON: { "status": "FAIL", "windsurf_instruction": "В файле X ошибка Y. Исправь так: ..." }

Если все чисто:
Верни JSON: { "status": "PASS", "message": "Все системы работают нормально." }`;

                    const result = await callGemini(prompt, {
                        purpose: 'qa',
                        temperature: 0.3,
                        maxModelAttempts: 3,
                        timeoutMs: 12000
                    });

                    try {
                        const parsed = JSON.parse(result.text);
                        return sendJSON(parsed);
                    } catch (e) {
                        return sendJSON({
                            status: 'FAIL',
                            windsurf_instruction: result.text
                        });
                    }
                } catch (e) {
                    return sendJSON({ error: e.message }, 500);
                }
            }

            // --- ANALYZE ERROR (Dev Console) ---
            if (action === 'analyze_error') {
                if (request.method !== 'POST') return sendJSON({ error: 'Method not allowed' }, 405);

                try {
                    const body = await request.json();
                    const { error, stack, variables } = body;

                    const prompt = `Ты Senior Frontend Developer. Произошла ошибка на клиенте.

Error: ${error}
Stack: ${stack || 'N/A'}
Важные переменные: ${JSON.stringify(variables, null, 2)}

Задача:
1. Найди точную причину ошибки.
2. Предложи быстрое решение (что изменить в коде).
3. Если это проблема с API или данными, укажи это.
Будь кратким и техничным.`;

                    const result = await callGemini(prompt, {
                        purpose: 'analysis',
                        temperature: 0.3,
                        maxModelAttempts: 3,
                        timeoutMs: 12000
                    });

                    return sendJSON({ analysis: result.text });
                } catch (e) {
                    return sendJSON({ analysis: `AI analysis failed: ${e.message}` });
                }
            }

            return sendJSON({ error: 'Unknown action' }, 400);
        } catch (error) {
            console.error('Worker error:', error);

            const debugInfo = {
                error: error.message || 'Internal server error',
                stack: error.stack || 'N/A',
                url: request?.url || 'unknown',
                method: request?.method || 'unknown'
            };

            try {
                const action = new URL(request.url).searchParams.get('action') || 'none';
                debugInfo.action = action;
            } catch (e) {
                debugInfo.action = 'parse_error';
            }

            return sendJSON(debugInfo, 500);
        }
    }
};
