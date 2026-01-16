export const MEMPOOL_API = 'https://mempool.fractalbitcoin.io/api';
export const UNISAT_API = 'https://open-api-fractal.unisat.io';

function __sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function __withTimeout(ms, externalSignal) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), Math.max(1, Number(ms) || 1));
    if (externalSignal) {
        try {
            if (externalSignal.aborted) controller.abort();
            else {
                externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
            }
        } catch (_) {}
    }
    return {
        signal: controller.signal,
        clear: () => clearTimeout(tid)
    };
}

async function __fetchJson(url, options = {}) {
    const {
        method = 'GET',
        headers = {},
        body = undefined,
        timeoutMs = 8000,
        signal = null,
        retries = 0,
        retryDelayMs = 400
    } = options && typeof options === 'object' ? options : {};

    const { signal: timedSignal, clear } = __withTimeout(timeoutMs, signal);
    try {
        let attempt = 0;
        while (true) {
            try {
                const res = await fetch(url, {
                    method,
                    headers,
                    body,
                    signal: timedSignal,
                    cache: 'no-store'
                });
                if (!res.ok) {
                    if (attempt < retries && (res.status === 429 || res.status >= 500)) {
                        attempt++;
                        await __sleep(retryDelayMs * attempt);
                        continue;
                    }
                    return null;
                }
                return await res.json().catch(() => null);
            } catch (e) {
                if (attempt < retries) {
                    attempt++;
                    await __sleep(retryDelayMs * attempt);
                    continue;
                }
                return null;
            }
        }
    } finally {
        clear();
    }
}

async function __fetchText(url, options = {}) {
    const {
        method = 'GET',
        headers = {},
        body = undefined,
        timeoutMs = 8000,
        signal = null,
        retries = 0,
        retryDelayMs = 400
    } = options && typeof options === 'object' ? options : {};

    const { signal: timedSignal, clear } = __withTimeout(timeoutMs, signal);
    try {
        let attempt = 0;
        while (true) {
            try {
                const res = await fetch(url, {
                    method,
                    headers,
                    body,
                    signal: timedSignal,
                    cache: 'no-store'
                });
                if (!res.ok) {
                    if (attempt < retries && (res.status === 429 || res.status >= 500)) {
                        attempt++;
                        await __sleep(retryDelayMs * attempt);
                        continue;
                    }
                    return null;
                }
                return await res.text().catch(() => null);
            } catch (e) {
                if (attempt < retries) {
                    attempt++;
                    await __sleep(retryDelayMs * attempt);
                    continue;
                }
                return null;
            }
        }
    } finally {
        clear();
    }
}

function __addr(a) {
    return String(a || '').trim();
}

function __backendUrl() {
    try {
        if (typeof window !== 'undefined' && window.BACKEND_URL) return String(window.BACKEND_URL);
    } catch (_) {}
    return 'https://fennec-api.warninghejo.workers.dev';
}

export async function getAddressStats(address, options = {}) {
    const addr = __addr(address);
    if (!addr) return null;
    return await __fetchJson(`${MEMPOOL_API}/address/${encodeURIComponent(addr)}`, {
        timeoutMs: options.timeoutMs ?? 6000,
        signal: options.signal ?? null,
        retries: options.retries ?? 1
    });
}

export async function getNativeBalance(address, options = {}) {
    const addr = __addr(address);
    if (!addr) return 0;
    const st = await getAddressStats(addr, options);
    const chain = st && st.chain_stats && typeof st.chain_stats === 'object' ? st.chain_stats : null;
    if (!chain) return 0;
    const funded = Number(chain.funded_txo_sum || 0) || 0;
    const spent = Number(chain.spent_txo_sum || 0) || 0;
    const sat = Math.max(0, Math.floor(funded - spent));
    return Number.isFinite(sat) ? sat : 0;
}

export async function getUtxos(address, options = {}) {
    const addr = __addr(address);
    if (!addr) return [];
    const mem = await __fetchJson(`${MEMPOOL_API}/address/${encodeURIComponent(addr)}/utxo`, {
        timeoutMs: options.timeoutMs ?? 7000,
        signal: options.signal ?? null,
        retries: options.retries ?? 1
    });
    if (Array.isArray(mem)) return mem;
    if (mem && Array.isArray(mem.data)) return mem.data;
    const backend = __backendUrl();
    const fallback = await __fetchJson(
        `${backend}?action=full_utxo_data&address=${encodeURIComponent(addr)}&cursor=0&size=200`,
        {
            timeoutMs: options.fallbackTimeoutMs ?? 9000,
            signal: options.signal ?? null,
            retries: 0
        }
    );
    const list =
        (fallback && fallback.data && Array.isArray(fallback.data.list) ? fallback.data.list : null) ||
        (fallback && Array.isArray(fallback.list) ? fallback.list : null) ||
        [];
    return Array.isArray(list) ? list : [];
}

export async function getHistory(address, options = {}) {
    const addr = __addr(address);
    if (!addr) return [];
    const after = String(options.afterTxid || '').trim();
    const q = after ? `?after_txid=${encodeURIComponent(after)}` : '';
    const txs = await __fetchJson(`${MEMPOOL_API}/address/${encodeURIComponent(addr)}/txs${q}`, {
        timeoutMs: options.timeoutMs ?? 9000,
        signal: options.signal ?? null,
        retries: options.retries ?? 1
    });
    if (Array.isArray(txs)) return txs;
    return [];
}

export async function getWalletAge(address, options = {}) {
    const txs = await getHistory(address, options);
    if (!Array.isArray(txs) || txs.length === 0) return 0;
    for (let i = txs.length - 1; i >= 0; i--) {
        const tx = txs[i];
        const st = tx && tx.status && typeof tx.status === 'object' ? tx.status : null;
        const t = Number(st && st.block_time ? st.block_time : 0) || 0;
        if (t > 0) return t;
    }
    return 0;
}

export async function getFeesRecommended(options = {}) {
    const j = await __fetchJson(`${MEMPOOL_API}/v1/fees/recommended`, {
        timeoutMs: options.timeoutMs ?? 6000,
        signal: options.signal ?? null,
        retries: options.retries ?? 1
    });
    if (!j || typeof j !== 'object') return null;
    return j;
}

export async function broadcastTx(rawHex, options = {}) {
    const hex = String(rawHex || '').trim();
    if (!hex) return null;

    const mempoolTxid = await __fetchText(`${MEMPOOL_API}/tx`, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: hex,
        timeoutMs: options.timeoutMs ?? 15000,
        signal: options.signal ?? null,
        retries: 0
    });
    const txid = String(mempoolTxid || '').trim();
    if (txid) return { txid, source: 'mempool' };

    const backend = __backendUrl();
    const j = await __fetchJson(`${backend}?action=push_tx`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rawtx: hex }),
        timeoutMs: options.fallbackTimeoutMs ?? 20000,
        signal: options.signal ?? null,
        retries: 0
    });
    const txid2 =
        String(j?.data?.txid || j?.data?.txId || j?.txid || j?.txId || j?.result || j?.data || '').trim() || '';
    if (txid2) return { txid: txid2, source: 'unisat_proxy' };
    return null;
}

export async function getTokens(address, options = {}) {
    const addr = __addr(address);
    if (!addr) return { brc20: null, source: 'none' };

    const direct = await __fetchJson(
        `${UNISAT_API}/v1/indexer/address/${encodeURIComponent(addr)}/brc20/summary?start=0&limit=500&tick_filter=24&exclude_zero=true`,
        {
            timeoutMs: options.directTimeoutMs ?? 12000,
            signal: options.signal ?? null,
            retries: 0
        }
    );
    if (direct) return { brc20: direct, source: 'unisat' };

    return { brc20: null, source: 'none' };
}
