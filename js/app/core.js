// Now define constants and variables
export const BACKEND_URL = window.location.hostname.includes('vercel.app')
    ? '/api/proxy' // Vercel serverless function
    : window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
      ? 'http://127.0.0.1:8787' // Local wrangler dev
      : 'https://fennec-api.warninghejo.workers.dev'; // Cloudflare Worker fallback

export const T_SFB = 'sFB___000';
export const T_FENNEC = 'FENNEC';
export const T_BTC = 'BTC';
export const T_SBTC = 'sBTC___000'; // ВАЖНО: Правильный тикер для пула sBTC/FB

export async function safeFetchJson(url, options = {}) {
    const method = options.method || 'GET';
    const headers = options.headers;
    const body = options.body;
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 12000;
    const retries = typeof options.retries === 'number' ? options.retries : 2;
    const retryDelayMs = typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 700;

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { method, headers, body, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) {
                lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
                    continue;
                }
                return null;
            }

            return await res.json();
        } catch (e) {
            clearTimeout(timeoutId);
            lastErr = e;
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
                continue;
            }
            console.warn('safeFetchJson failed:', url, lastErr);
            return null;
        }
    }
    return null;
}

export function __fennecDedupe(key, fn) {
    try {
        const k = String(key || '').trim();
        const f = typeof fn === 'function' ? fn : null;
        if (!k || !f) return Promise.resolve().then(() => (f ? f() : null));
        window.__fennecInflight =
            window.__fennecInflight && typeof window.__fennecInflight === 'object' ? window.__fennecInflight : {};
        const inflight = window.__fennecInflight;
        if (inflight[k]) return inflight[k];
        const p = Promise.resolve()
            .then(() => f())
            .finally(() => {
                try {
                    delete inflight[k];
                } catch (_) {}
            });
        inflight[k] = p;
        return p;
    } catch (_) {
        try {
            return Promise.resolve().then(() => (typeof fn === 'function' ? fn() : null));
        } catch (e) {
            return Promise.reject(e);
        }
    }
}

export async function safeFetchText(url, options = {}) {
    const method = options.method || 'GET';
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 12000;
    const retries = typeof options.retries === 'number' ? options.retries : 1;
    const retryDelayMs = typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 700;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { method, signal: controller.signal, cache: 'no-store' });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            return await res.text();
        } catch (e) {
            clearTimeout(timeoutId);
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
                continue;
            }
            return '';
        }
    }
    return '';
}

try {
    window.BACKEND_URL = window.BACKEND_URL || BACKEND_URL;
    window.T_SFB = window.T_SFB || T_SFB;
    window.T_FENNEC = window.T_FENNEC || T_FENNEC;
    window.T_BTC = window.T_BTC || T_BTC;
    window.T_SBTC = window.T_SBTC || T_SBTC;

    window.safeFetchJson = window.safeFetchJson || safeFetchJson;
    window.safeFetchText = window.safeFetchText || safeFetchText;

    window.__fennecDedupe = window.__fennecDedupe || __fennecDedupe;
} catch (_) {}
