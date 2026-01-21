import { BACKEND_URL, safeFetchJson, __fennecDedupe, T_SFB, T_FENNEC, T_SBTC } from './core.js';
import { getState, subscribe } from './state.js';

// Chart.js is loaded globally via CDN in index.html
// eslint-disable-next-line no-undef
const Chart = typeof window !== 'undefined' ? window.Chart : undefined;

try {
    window.__fennecChartModuleLoaded = true;
} catch (_) {}

const __FENNEC_PRICE_CACHE_VERSION = '2026-01-18-1';
const __LEGACY_PRICE_KEY = 'fennec_prices';
const __CHART_PAIRS = {
    FB_FENNEC: {
        base: T_FENNEC,
        quote: T_SFB,
        label: 'FENNEC/FB',
        invertIfAbove: 10,
        maxPrice: 10,
        minPrice: 1e-12
    },
    BTC_FB: {
        base: T_SBTC,
        quote: T_SFB,
        label: 'BTC/FB',
        invertIfAbove: null,
        maxPrice: 1e12,
        minPrice: 1e-12
    }
};

function __normalizePairKey(pair) {
    const raw = String(pair || '')
        .trim()
        .toUpperCase();
    return raw === 'BTC_FB' ? 'BTC_FB' : 'FB_FENNEC';
}

function __getSwapPairKey() {
    try {
        const statePair = typeof getState === 'function' ? getState('currentSwapPair') : null;
        if (statePair) return __normalizePairKey(statePair);
    } catch (_) {}
    try {
        if (window.currentSwapPair) return __normalizePairKey(window.currentSwapPair);
    } catch (_) {}
    return 'FB_FENNEC';
}

function __getChartPairMeta(pairKey) {
    const key = __normalizePairKey(pairKey || __getSwapPairKey());
    return __CHART_PAIRS[key] || __CHART_PAIRS.FB_FENNEC;
}

function __getPriceStorageKey(pairKey) {
    const key = __normalizePairKey(pairKey);
    return `fennec_prices_${key.toLowerCase()}`;
}

function __readStoredPrices(pairKey) {
    try {
        const key = __getPriceStorageKey(pairKey);
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
        const normalizedKey = __normalizePairKey(pairKey);
        if (normalizedKey === 'FB_FENNEC') {
            const legacy = localStorage.getItem(__LEGACY_PRICE_KEY);
            if (legacy) return JSON.parse(legacy);
        }
    } catch (_) {}
    return [];
}

function __writeStoredPrices(pairKey, points) {
    try {
        const key = __getPriceStorageKey(pairKey);
        const payload = JSON.stringify(points || []);
        localStorage.setItem(key, payload);
        if (__normalizePairKey(pairKey) === 'FB_FENNEC') {
            localStorage.setItem(__LEGACY_PRICE_KEY, payload);
        }
    } catch (_) {}
}

function __normalizeTickSymbol(tick) {
    const s = String(tick || '')
        .trim()
        .toUpperCase();
    if (!s) return '';
    if (s.includes('FENNEC')) return 'FENNEC';
    if (s.includes('SBTC')) return 'SBTC';
    if (s.includes('SFB')) return 'SFB';
    return s;
}

function __syncChartPairLabel(pairKey) {
    try {
        const meta = __getChartPairMeta(pairKey);
        const labelEl = document.getElementById('chartPairLabel');
        if (labelEl) labelEl.innerText = meta.label;
        if (priceChart && priceChart.data && priceChart.data.datasets && priceChart.data.datasets[0]) {
            priceChart.data.datasets[0].label = meta.label;
        }
    } catch (_) {}
}

function resetChartData(force = false) {
    try {
        const verKey = 'fennec_prices_cache_ver';
        const prev = String(localStorage.getItem(verKey) || '').trim();
        if (force || prev !== __FENNEC_PRICE_CACHE_VERSION) {
            try {
                const keys = [__LEGACY_PRICE_KEY, __getPriceStorageKey('FB_FENNEC'), __getPriceStorageKey('BTC_FB')];
                keys.forEach(key => {
                    try {
                        localStorage.removeItem(key);
                    } catch (_) {}
                });
            } catch (_) {}
            try {
                localStorage.setItem(verKey, __FENNEC_PRICE_CACHE_VERSION);
            } catch (_) {}
        }
    } catch (_) {}
}

function __normalizePriceSeries(points, nowMs) {
    try {
        const now = Number(nowMs || Date.now()) || Date.now();
        const historyMs = 5 * 365 * 24 * 60 * 60 * 1000;
        const cutoff90 = now - historyMs;
        const src = Array.isArray(points) ? points : [];
        const filtered = src
            .map(p => {
                const ts = Number(p && p.timestamp ? p.timestamp : 0) || 0;
                const price = Number(p && p.price !== undefined ? p.price : 0) || 0;
                if (!ts || ts < cutoff90) return null;
                if (!(price > 0) || !Number.isFinite(price)) return null;
                return { price, timestamp: ts };
            })
            .filter(Boolean)
            .sort((a, b) => a.timestamp - b.timestamp);

        const buckets = new Map();
        for (const p of filtered) {
            const ts = p.timestamp;
            let bucketMs = 6 * 60 * 60 * 1000;
            if (ts >= now - 60 * 60 * 1000) bucketMs = 10 * 1000;
            else if (ts >= now - 24 * 60 * 60 * 1000) bucketMs = 5 * 60 * 1000;
            else if (ts >= now - 7 * 24 * 60 * 60 * 1000) bucketMs = 30 * 60 * 1000;
            else if (ts >= now - 30 * 24 * 60 * 60 * 1000) bucketMs = 2 * 60 * 60 * 1000;
            const key = `${bucketMs}_${Math.floor(ts / bucketMs)}`;
            buckets.set(key, p);
        }

        return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
    } catch (_) {
        return Array.isArray(points) ? points : [];
    }
}

let chartTimeframe = '7d';
let priceChart = null;
const globalPrices = { btc: 0, fb: 0, fennec: 0 };
let __pairWatcherBound = false;

try {
    resetChartData(false);
} catch (_) {}

function __seedDashboardPricesFromCache() {
    try {
        const raw = localStorage.getItem('fennec_dashboard_prices_v1');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const p = parsed && typeof parsed === 'object' ? parsed.prices : null;
        if (!p || typeof p !== 'object') return;
        const btc = Number(p.btc || 0) || 0;
        const fb = Number(p.fb || 0) || 0;
        const fennec = Number(p.fennec || 0) || 0;
        if (!(globalPrices.btc > 0) && btc > 0) globalPrices.btc = btc;
        if (!(globalPrices.fb > 0) && fb > 0) globalPrices.fb = fb;
        if (!(globalPrices.fennec > 0) && fennec > 0) globalPrices.fennec = fennec;
    } catch (_) {}
}

function __storeDashboardPricesToCache() {
    try {
        const payload = {
            ts: Date.now(),
            prices: {
                btc: Number(globalPrices.btc || 0) || 0,
                fb: Number(globalPrices.fb || 0) || 0,
                fennec: Number(globalPrices.fennec || 0) || 0
            }
        };
        localStorage.setItem('fennec_dashboard_prices_v1', JSON.stringify(payload));
    } catch (_) {}
}

function seedChartPriceFromCache(pairKey) {
    try {
        const pair = __normalizePairKey(pairKey || __getSwapPairKey());
        const stored = __readStoredPrices(pair);
        if (!Array.isArray(stored) || stored.length === 0) return;
        const last = stored[stored.length - 1];
        const p = last && last.price !== undefined ? Number(last.price) : NaN;
        if (!Number.isFinite(p) || p <= 0) return;
        if (pair === 'FB_FENNEC') {
            globalPrices.fennec = globalPrices.fennec > 0 ? globalPrices.fennec : p;
        }
        const priceEl = document.getElementById('chartPrice') || document.getElementById('currentPrice');
        if (priceEl && (!String(priceEl.innerText || '').trim() || String(priceEl.innerText || '').trim() === '--')) {
            priceEl.dataset.price = p.toFixed(6);
            priceEl.innerText = p.toFixed(6);
        }
        __syncChartPairLabel(pair);
    } catch (_) {}
}

function __handlePairChange(nextPair) {
    const pair = __normalizePairKey(nextPair || __getSwapPairKey());
    __syncChartPairLabel(pair);
    try {
        const poolCache = window.poolCache && typeof window.poolCache === 'object' ? window.poolCache : null;
        if (poolCache) {
            poolCache.data = null;
            poolCache.timestamp = 0;
        }
    } catch (_) {}
    try {
        if (priceChart && priceChart.data && priceChart.data.datasets && priceChart.data.datasets[0]) {
            priceChart.data.labels = [];
            priceChart.data.datasets[0].data = [];
            priceChart.update('none');
        }
    } catch (_) {}
    try {
        const priceEl = document.getElementById('chartPrice') || document.getElementById('currentPrice');
        const changeEl = document.getElementById('chartPriceChange') || document.getElementById('priceChange');
        if (priceEl) {
            priceEl.dataset.price = '';
            priceEl.innerText = '--';
        }
        if (changeEl) changeEl.innerText = '--';
    } catch (_) {}
    try {
        const marketCapEl = document.getElementById('marketCap');
        const volume24hEl = document.getElementById('volume24h');
        const volume7dEl = document.getElementById('volume7d');
        const volume30dEl = document.getElementById('volume30d');
        if (marketCapEl) marketCapEl.innerText = '--';
        if (volume24hEl) volume24hEl.innerText = '--';
        if (volume7dEl) volume7dEl.innerText = '--';
        if (volume30dEl) volume30dEl.innerText = '--';
    } catch (_) {}
    seedChartPriceFromCache(pair);
    if (!document.getElementById('priceChart')) return;
    if (priceChart) {
        setChartTimeframe(chartTimeframe);
    }
    updatePriceData(true, pair).catch(() => null);
}

function __bindPairListener() {
    if (__pairWatcherBound) return;
    __pairWatcherBound = true;
    try {
        if (typeof subscribe === 'function') {
            subscribe('currentSwapPair', pair => {
                __handlePairChange(pair);
            });
        }
    } catch (_) {}
}

function initChart() {
    const ctx = document.getElementById('priceChart');
    if (!ctx || typeof Chart === 'undefined') {
        console.log('Chart.js not loaded yet, retrying...');
        setTimeout(initChart, 500);
        return;
    }

    // Destroy existing chart if it exists
    if (priceChart) {
        try {
            priceChart.destroy();
        } catch (e) {
            console.warn('Error destroying chart:', e);
        }
    }

    // Also check global instance(s)
    if (window.myChart) {
        try {
            window.myChart.destroy();
        } catch (e) {
            console.warn('Error destroying window.myChart:', e);
        }
    }
    if (window.myChartInstance) {
        try {
            window.myChartInstance.destroy();
        } catch (e) {
            console.warn('Error destroying global chart instance:', e);
        }
    }

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: __getChartPairMeta(__getSwapPairKey()).label,
                    data: [],
                    borderColor: '#FF6B35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#FF6B35',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#999', font: { size: 10 } }
                },
                y: {
                    display: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#999', font: { size: 10 } }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    // Save to global instance for external control
    window.myChartInstance = priceChart;
    window.myChart = priceChart;

    console.log('Chart initialized');
    __syncChartPairLabel(__getSwapPairKey());

    try {
        // Terminal timeframe buttons (terminal.html uses ids, no inline onclick)
        const map = {
            'chart-1h': '1h',
            'chart-24h': '24h',
            'chart-7d': '7d',
            'chart-30d': '30d',
            'chart-all': 'all'
        };
        for (const [id, tf] of Object.entries(map)) {
            const btn = document.getElementById(id);
            if (!btn) continue;
            if (!btn.__fennecBound) {
                btn.__fennecBound = true;
                btn.addEventListener('click', e => {
                    try {
                        e.preventDefault();
                    } catch (_) {}
                    try {
                        setChartTimeframe(tf);
                    } catch (_) {}
                });
            }
        }
        // Sync initial active state
        setChartTimeframe(chartTimeframe);
    } catch (_) {}

    // Load data and update chart
    updatePriceData().catch(() => null);
}

async function loadHistoricalPrices(pairKey) {
    try {
        const __chartDebug =
            (typeof window !== 'undefined' && (window.__fennecChartDebug === true || window.__debugChart === true)) ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('fennec_debug_chart') === '1') ||
            (typeof location !== 'undefined' && /[?&]debug_chart=1/.test(location.search));

        const pair = __normalizePairKey(pairKey || __getSwapPairKey());
        const meta = __getChartPairMeta(pair);
        const tick0 = meta.quote;
        const tick1 = meta.base;

        if (__chartDebug) console.log('Loading history from InSwap...', pair, chartTimeframe);

        const timeRange = chartTimeframe;
        const __url = `${BACKEND_URL}?action=price_line&tick0=${encodeURIComponent(tick0)}&tick1=${encodeURIComponent(
            tick1
        )}&timeRange=${encodeURIComponent(timeRange)}`;
        const json = await safeFetchJson(__url, {
            timeoutMs: 25000,
            retries: 0,
            cache: 'default',
            headers: { Accept: 'application/json' }
        });
        if (!json) throw new Error('Failed to load price history');

        if (__chartDebug) console.log('Price line API response:', json);

        if (json.code === 0 && json.data && json.data.list && json.data.list.length > 0) {
            // API returns price directly in item.price field (quote per base)
            const apiData = json.data.list
                .map(item => {
                    let price = parseFloat(item.price);
                    if (Number.isFinite(price) && meta.invertIfAbove && price > meta.invertIfAbove) {
                        const inv = 1 / price;
                        if (Number.isFinite(inv) && inv > 0) price = inv;
                    }
                    const tsRaw = Number(item.ts || item.timestamp || 0) || 0;
                    const timestamp = tsRaw > 1000000000000 ? tsRaw : tsRaw * 1000;

                    // Validate price is reasonable
                    if (
                        isNaN(price) ||
                        price <= 0 ||
                        !Number.isFinite(price) ||
                        price > meta.maxPrice ||
                        price < meta.minPrice
                    ) {
                        console.warn('Invalid price filtered:', price, item);
                        return null;
                    }

                    return {
                        price: price,
                        timestamp: timestamp
                    };
                })
                .filter(item => item !== null)
                .sort((a, b) => a.timestamp - b.timestamp);

            if (apiData.length > 0) {
                // Get existing data from localStorage
                const existing = __readStoredPrices(pair);

                // For all timeframes, merge existing data with new API data
                // Don't remove existing data - it might be needed for current timeframe
                // Just merge and deduplicate
                const merged = [...existing, ...apiData].sort((a, b) => a.timestamp - b.timestamp);

                // Remove exact duplicates by timestamp (fine-grained).
                const seen = new Map();
                for (const p of merged) {
                    const key = Number(p.timestamp || 0) || 0;
                    if (!key) continue;
                    if (!seen.has(key)) seen.set(key, p);
                }
                const deduplicated = Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
                const normalized = __normalizePriceSeries(deduplicated, Date.now());
                __writeStoredPrices(pair, normalized);
                if (__chartDebug)
                    console.log(`Chart data saved: ${apiData.length} new points, ${normalized.length} total points`);
                if (__chartDebug) console.log(`Pair: ${pair}, timeframe: ${chartTimeframe}, timeRange: ${timeRange}`);
            } else {
                if (__chartDebug) console.warn(`No valid price data from API for ${timeRange}`);
            }
        } else {
            if (__chartDebug) console.warn(`No data from price_line API for ${timeRange}, code: ${json.code}`);
        }

        // Always update chart after loading (even if no new data)
        updateChart(pair);
    } catch (e) {
        console.error('Failed to load prices:', e);
        // Still try to update chart with existing data
        updateChart(pairKey);
    }
}

async function updatePriceData(force = false, pairKey) {
    const pair = __normalizePairKey(pairKey || __getSwapPairKey());
    const meta = __getChartPairMeta(pair);
    const baseTick = meta.base;
    const quoteTick = meta.quote;
    const __now = Date.now();
    try {
        window.__fennecPriceFetchState =
            window.__fennecPriceFetchState && typeof window.__fennecPriceFetchState === 'object'
                ? window.__fennecPriceFetchState
                : {};
        const map = window.__fennecPriceFetchState;
        const state = map[pair] && typeof map[pair] === 'object' ? map[pair] : { lastFetchAt: 0 };
        const last = Number(state.lastFetchAt || 0) || 0;
        if (!force && last > 0 && __now - last < 60000) return;
        state.lastFetchAt = __now;
        map[pair] = state;
    } catch (_) {}

    return await __fennecDedupe(`updatePriceData:${pair}`, async () => {
        try {
            const json = await safeFetchJson(
                `${BACKEND_URL}?action=quote&tick0=${encodeURIComponent(baseTick)}&tick1=${encodeURIComponent(
                    quoteTick
                )}`,
                {
                    timeoutMs: 12000,
                    retries: 2
                }
            );
            if (!json) throw new Error('Failed to fetch quote');

            let data = null;
            if (json.data) {
                if (json.data.tick0) data = json.data;
                else if (Array.isArray(json.data.list) && json.data.list.length > 0) data = json.data.list[0];
            }

            if (data && data.amount0 && data.amount1) {
                const amount0 = parseFloat(data.amount0);
                const amount1 = parseFloat(data.amount1);
                const baseSym = __normalizeTickSymbol(baseTick);
                const quoteSym = __normalizeTickSymbol(quoteTick);
                const t0 = __normalizeTickSymbol(data.tick0);
                const t1 = __normalizeTickSymbol(data.tick1);
                let price = 0;
                if (t0 === baseSym && t1 === quoteSym) {
                    price = amount1 / amount0;
                } else if (t0 === quoteSym && t1 === baseSym) {
                    price = amount0 / amount1;
                }
                if (Number.isFinite(price) && meta.invertIfAbove && price > meta.invertIfAbove) {
                    price = 1 / price;
                }

                if (!Number.isFinite(price) || price <= 0 || price > meta.maxPrice || price < meta.minPrice) {
                    console.warn('Invalid price calculated:', price, 'from', data);
                    return;
                }
                const timestamp = Date.now();

                const stored = __readStoredPrices(pair);
                const lastPoint = stored[stored.length - 1];

                // Добавляем точку если прошло > 1 минуты или цена изменилась значительно
                if (
                    !lastPoint ||
                    timestamp - lastPoint.timestamp > 60000 ||
                    Math.abs(lastPoint.price - price) / lastPoint.price > 0.01
                ) {
                    stored.push({ price, timestamp });
                    const normalized = __normalizePriceSeries(stored, timestamp);
                    __writeStoredPrices(pair, normalized);
                    console.log(`New price: ${price.toFixed(6)} ${meta.label}`);
                    updateChart(pair);
                }
            }
        } catch (e) {
            console.error('Price update error:', e);
        }
    });
}

function updateChart(pairKey) {
    if (!priceChart) return;
    const pair = __normalizePairKey(pairKey || __getSwapPairKey());
    const meta = __getChartPairMeta(pair);
    __syncChartPairLabel(pair);
    try {
        if (priceChart.data && priceChart.data.datasets && priceChart.data.datasets[0]) {
            priceChart.data.datasets[0].label = meta.label;
        }
    } catch (_) {}

    const __chartDebug =
        (typeof window !== 'undefined' && (window.__fennecChartDebug === true || window.__debugChart === true)) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('fennec_debug_chart') === '1') ||
        (typeof location !== 'undefined' && /[?&]debug_chart=1/.test(location.search));

    const stored = __readStoredPrices(pair);
    const now = Date.now();

    // Фильтруем по таймфрейму
    let cutoff;
    if (chartTimeframe === '1h') cutoff = now - 60 * 60 * 1000;
    else if (chartTimeframe === '24h') cutoff = now - 24 * 60 * 60 * 1000;
    else if (chartTimeframe === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (chartTimeframe === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;
    else if (chartTimeframe === 'all') cutoff = 0;
    else cutoff = 0;

    const filtered = stored.filter(p => p.timestamp >= cutoff);

    if (__chartDebug) console.log(`Chart: ${chartTimeframe} | ${filtered.length} points`);

    // Если нет данных за выбранный период - показываем последнюю известную цену
    if (filtered.length === 0 && stored.length > 0) {
        // Показываем последнюю цену из всей истории
        const lastPoint = stored[stored.length - 1];
        priceChart.data.labels = ['Prev', 'Now'];
        priceChart.data.datasets[0].data = [lastPoint.price, lastPoint.price];
        priceChart.update('none');

        const priceEl = document.getElementById('chartPrice') || document.getElementById('currentPrice');
        const changeEl = document.getElementById('chartPriceChange') || document.getElementById('priceChange');
        if (priceEl) {
            // ИСПРАВЛЕНИЕ: Всегда показываем 6 знаков после запятой
            const fixedPrice = parseFloat(lastPoint.price).toFixed(6);
            priceEl.dataset.price = fixedPrice;
            priceEl.innerText = fixedPrice;
        }
        if (changeEl) changeEl.innerText = `No data for ${chartTimeframe}`;
        return;
    } else if (filtered.length === 0) {
        priceChart.data.labels = ['Loading...'];
        priceChart.data.datasets[0].data = [0];
        priceChart.update('none');
        return;
    }

    // Дедупликация и равномерное распределение точек
    // Для каждого таймфрейма - разный интервал дедупликации
    let dedupInterval = 60000; // 1 минута по умолчанию
    let maxPoints = 2000;
    if (chartTimeframe === '1h') {
        dedupInterval = 10000; // 10 секунд для более детального графика
        maxPoints = 360; // До 360 точек (1 точка каждые 10 секунд)
    } else if (chartTimeframe === '24h') {
        dedupInterval = 5 * 60000; // 5 минут (было 15)
        maxPoints = 288; // 24ч * 12 точек/час
    } else if (chartTimeframe === '7d') {
        dedupInterval = 30 * 60000; // 30 минут (было 1 час)
        maxPoints = 336; // 7д * 48 точек/день
    } else if (chartTimeframe === '30d') {
        dedupInterval = 2 * 60 * 60000; // 2 часа (было 4)
        maxPoints = 360; // 30д * 12 точек/день
    } else if (chartTimeframe === 'all') {
        dedupInterval = 6 * 60 * 60000; // 6 часов (было 12)
        maxPoints = 720; // 90д * 4 точек/день = 360, увеличено до 720
    }

    // Дедупликация: оставляем только одну точку на интервал
    const deduplicated = [];
    let lastTime = 0;
    for (const p of filtered) {
        if (p.timestamp - lastTime >= dedupInterval) {
            deduplicated.push(p);
            lastTime = p.timestamp;
        }
    }

    // Если точек все еще слишком много - берем каждую N-ю
    let finalData = deduplicated;
    if (deduplicated.length > maxPoints) {
        const step = Math.ceil(deduplicated.length / maxPoints);
        finalData = [];
        for (let i = 0; i < deduplicated.length; i += step) {
            finalData.push(deduplicated[i]);
        }
        // Всегда добавляем последнюю точку
        if (finalData[finalData.length - 1] !== deduplicated[deduplicated.length - 1]) {
            finalData.push(deduplicated[deduplicated.length - 1]);
        }
    }

    // Chart.js c pointRadius=0 может выглядеть «пустым» при единственной точке.
    // Дублируем точку, чтобы гарантировать линию.
    if (finalData.length === 1) {
        const only = finalData[0];
        const shiftMs = chartTimeframe === '24h' ? 15 * 60 * 1000 : 60 * 1000;
        finalData = [{ price: only.price, timestamp: only.timestamp - shiftMs }, only];
    }

    console.log(`Chart: ${filtered.length} points -> ${deduplicated.length} deduplicated -> ${finalData.length} final`);

    // Обновляем график
    if (!priceChart || !priceChart.data) {
        console.warn('Chart not initialized, skipping update');
        return;
    }

    if (finalData.length > 0) {
        priceChart.data.labels = finalData.map(p => {
            const d = new Date(p.timestamp);
            if (chartTimeframe === '1h' || chartTimeframe === '24h') {
                return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            }
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        priceChart.data.datasets[0].data = finalData.map(p => p.price);
        priceChart.update('none');
        console.log('Chart updated with', finalData.length, 'points');
    } else {
        console.warn('No data to display on chart');
        priceChart.data.labels = [];
        priceChart.data.datasets[0].data = [];
        priceChart.update('none');
    }

    // Обновляем цену и изменение
    if (filtered.length > 1) {
        const current = filtered[filtered.length - 1].price;
        const first = filtered[0].price;
        const change = ((current - first) / first) * 100;

        const priceEl = document.getElementById('chartPrice') || document.getElementById('currentPrice');
        const changeEl = document.getElementById('chartPriceChange') || document.getElementById('priceChange');
        if (priceEl) {
            // ИСПРАВЛЕНИЕ: Всегда показываем 6 знаков после запятой
            const fixedPrice = parseFloat(current).toFixed(6);
            priceEl.dataset.price = fixedPrice;
            priceEl.innerText = fixedPrice;
        }
        if (changeEl) {
            changeEl.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            changeEl.classList.remove('text-green-500', 'text-red-500');
            changeEl.classList.add(change >= 0 ? 'text-green-500' : 'text-red-500');
        }

        // Update market cap and volume
        updateMarketStats(current);
    } else if (filtered.length === 1) {
        // Only one point - show it
        const priceEl = document.getElementById('chartPrice') || document.getElementById('currentPrice');
        if (priceEl) {
            // ИСПРАВЛЕНИЕ: Всегда показываем 6 знаков после запятой
            const fixedPrice = parseFloat(filtered[0].price).toFixed(6);
            priceEl.dataset.price = fixedPrice;
            priceEl.innerText = fixedPrice;
        }
    }

    // Update market cap even if only one point
    if (filtered.length > 0) {
        updateMarketStats(filtered[filtered.length - 1].price);
    }
}

// Get pool info and update market stats from pool_info API
async function updateMarketStats(_fennecPriceInFB, pairKey) {
    try {
        const marketCapEl = document.getElementById('marketCap');
        const volume24hEl = document.getElementById('volume24h');
        const volume7dEl = document.getElementById('volume7d');
        const volume30dEl = document.getElementById('volume30d');
        const pair = __normalizePairKey(pairKey || __getSwapPairKey());
        const meta = __getChartPairMeta(pair);

        const safeNum = v => {
            if (v === null || v === undefined) return 0;
            if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
            const s = String(v)
                .trim()
                .replace(/[$,\s]/g, '')
                .replace(/(?!^)-/g, '');
            const n = Number(s);
            return Number.isFinite(n) ? n : 0;
        };

        const formatUsdInt = n => {
            const v = Number(n);
            if (!Number.isFinite(v) || v <= 0) return '--';
            return `$${Math.round(v).toLocaleString('en-US')}`;
        };

        const baseSym = __normalizeTickSymbol(meta.base);
        const quoteSym = __normalizeTickSymbol(meta.quote);
        const isPoolMatch = data => {
            if (!data || typeof data !== 'object') return false;
            const t0 = __normalizeTickSymbol(data.tick0);
            const t1 = __normalizeTickSymbol(data.tick1);
            if (!t0 || !t1) return false;
            return (t0 === baseSym && t1 === quoteSym) || (t0 === quoteSym && t1 === baseSym);
        };

        const poolCache = window.poolCache && typeof window.poolCache === 'object' ? window.poolCache : null;
        let poolData = poolCache && poolCache.data && isPoolMatch(poolCache.data) ? poolCache.data : null;
        if (!poolData) {
            const now = Date.now();
            const fetchPoolInfo = async (tick0, tick1) => {
                const url = `${BACKEND_URL}?action=pool_info&tick0=${encodeURIComponent(
                    tick0
                )}&tick1=${encodeURIComponent(tick1)}&t=${now}`;
                const json = await safeFetchJson(url, {
                    timeoutMs: 12000,
                    retries: 2,
                    headers: { Accept: 'application/json' }
                }).catch(() => null);
                const data = json?.data && typeof json.data === 'object' ? json.data : null;
                if (!data || !data.tick0) return null;
                return data;
            };

            poolData = (await fetchPoolInfo(meta.base, meta.quote)) || (await fetchPoolInfo(meta.quote, meta.base));
            if (poolData && poolCache) {
                poolCache.data = poolData;
                poolCache.timestamp = now;
            }
        }

        if (poolData) {
            // Market Cap: take from pool_info (do not calculate locally)
            if (marketCapEl) {
                const mcUsdRaw =
                    poolData.marketCapUsd ??
                    poolData.market_cap_usd ??
                    poolData.marketCap ??
                    poolData.market_cap ??
                    poolData.mcap_usd ??
                    poolData.mcap;
                const mcUsd = safeNum(mcUsdRaw);
                marketCapEl.innerText = mcUsd > 0 ? formatUsdInt(mcUsd) : '--';
            }

            // 24h Volume from API
            if (volume24hEl) {
                const vol24hUsdRaw =
                    poolData.volume24hUsd ??
                    poolData.volume_24h_usd ??
                    poolData.volume24h ??
                    poolData.volume_24h ??
                    poolData?.stats?.volume24hUsd ??
                    poolData?.stats?.volume_24h_usd ??
                    poolData?.stats?.volume24h ??
                    poolData?.stats?.volume_24h;
                const vol24hUsd = safeNum(vol24hUsdRaw);
                volume24hEl.innerText = formatUsdInt(vol24hUsd);
            }

            // 7d Volume from API
            if (volume7dEl) {
                const vol7dUsdRaw =
                    poolData.volume7dUsd ??
                    poolData.volume_7d_usd ??
                    poolData.volume7d ??
                    poolData.volume_7d ??
                    poolData?.stats?.volume7dUsd ??
                    poolData?.stats?.volume_7d_usd ??
                    poolData?.stats?.volume7d ??
                    poolData?.stats?.volume_7d;
                let vol7dUsd = safeNum(vol7dUsdRaw);
                if (!vol7dUsd || vol7dUsd <= 0) {
                    const vol30dUsdRaw =
                        poolData.volume30dUsd ??
                        poolData.volume_30d_usd ??
                        poolData.volume30d ??
                        poolData.volume_30d ??
                        poolData?.stats?.volume30dUsd ??
                        poolData?.stats?.volume_30d_usd ??
                        poolData?.stats?.volume30d ??
                        poolData?.stats?.volume_30d;
                    const vol30dUsd = safeNum(vol30dUsdRaw);
                    vol7dUsd = vol30dUsd > 0 ? (vol30dUsd / 30) * 7 : 0;
                }
                volume7dEl.innerText = formatUsdInt(vol7dUsd);
            }

            // 30d Volume from API
            if (volume30dEl) {
                const vol30dUsdRaw =
                    poolData.volume30dUsd ??
                    poolData.volume_30d_usd ??
                    poolData.volume30d ??
                    poolData.volume_30d ??
                    poolData?.stats?.volume30dUsd ??
                    poolData?.stats?.volume_30d_usd ??
                    poolData?.stats?.volume30d ??
                    poolData?.stats?.volume_30d;
                const vol30dUsd = safeNum(vol30dUsdRaw);
                volume30dEl.innerText = formatUsdInt(vol30dUsd);
            }
        } else {
            // Fallback display
            if (marketCapEl) marketCapEl.innerText = '--';
            if (volume24hEl) volume24hEl.innerText = '--';
            if (volume7dEl) volume7dEl.innerText = '--';
            if (volume30dEl) volume30dEl.innerText = '--';
        }
    } catch (e) {
        console.warn('Error updating market stats:', e);
        const marketCapEl = document.getElementById('marketCap');
        const volume24hEl = document.getElementById('volume24h');
        const volume7dEl = document.getElementById('volume7d');
        const volume30dEl = document.getElementById('volume30d');
        if (marketCapEl) marketCapEl.innerText = '--';
        if (volume24hEl) volume24hEl.innerText = '--';
        if (volume7dEl) volume7dEl.innerText = '--';
        if (volume30dEl) volume30dEl.innerText = '--';
    }
}

function setChartTimeframe(tf) {
    chartTimeframe = tf;
    const pair = __normalizePairKey(__getSwapPairKey());
    __syncChartPairLabel(pair);

    // Show loading indicator
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer && priceChart) {
        try {
            chartContainer.querySelectorAll('#chartLoading').forEach(el => el.remove());
        } catch (_) {}
        const loadingEl = document.createElement('div');
        loadingEl.id = 'chartLoading';
        loadingEl.className = 'absolute inset-0 bg-black/50 flex items-center justify-center z-10';
        loadingEl.innerHTML = '<div class="text-fennec"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';
        chartContainer.appendChild(loadingEl);
    }

    // Update button states immediately (support terminal.html ids and legacy inline onclick)
    try {
        const terminalIds = ['chart-1h', 'chart-24h', 'chart-7d', 'chart-30d', 'chart-all'];
        for (const id of terminalIds) {
            const btn = document.getElementById(id);
            if (!btn) continue;
            btn.classList.remove('bg-fennec/20', 'text-fennec');
            btn.classList.add('bg-white/5', 'text-gray-400');
        }
        const tfToId = {
            '1h': 'chart-1h',
            '24h': 'chart-24h',
            '7d': 'chart-7d',
            '30d': 'chart-30d',
            all: 'chart-all'
        };
        const activeId = tfToId[String(tf || '').toLowerCase()];
        const activeBtn = activeId ? document.getElementById(activeId) : null;
        if (activeBtn) {
            activeBtn.classList.remove('bg-white/5', 'text-gray-400');
            activeBtn.classList.add('bg-fennec/20', 'text-fennec');
        }

        // Legacy support: inline onclick buttons (if present in other pages)
        document.querySelectorAll('button[onclick*="setChartTimeframe"]').forEach(btn => {
            btn.classList.remove('bg-fennec/20', 'text-fennec');
            btn.classList.add('bg-white/5', 'text-gray-400');
        });
        const legacyActive = Array.from(document.querySelectorAll('button[onclick*="setChartTimeframe"]')).find(b =>
            String(b.getAttribute('onclick') || '').includes(`'${tf}'`)
        );
        if (legacyActive) {
            legacyActive.classList.remove('bg-white/5', 'text-gray-400');
            legacyActive.classList.add('bg-fennec/20', 'text-fennec');
        }
    } catch (_) {}

    // IMPORTANT: Reload historical data for new timeframe FIRST, then update chart
    __fennecDedupe(`loadHistoricalPrices:${pair}:${String(tf || '').toLowerCase()}`, async () => {
        await loadHistoricalPrices(pair);
        return true;
    })
        .then(() => {
            // Update chart with new data
            updateChart(pair);
            // Remove loading indicator
            try {
                const root = document.querySelector('.chart-container') || document;
                root.querySelectorAll('#chartLoading').forEach(el => el.remove());
            } catch (_) {}
        })
        .catch(e => {
            console.error('Chart loading error:', e);
            // Still update chart with existing data
            updateChart(pair);
            try {
                const root = document.querySelector('.chart-container') || document;
                root.querySelectorAll('#chartLoading').forEach(el => el.remove());
            } catch (_) {}
        });
}

function __syncTickerMarqueePhase() {
    try {
        const tickerEl = document.getElementById('liveTicker');
        if (!tickerEl) return;
        const marquee = tickerEl.querySelector('.ticker-marquee');
        if (!marquee) return;

        marquee.style.animation = 'none';
        void marquee.offsetHeight;
        marquee.style.animation = '';
        marquee.style.animationDelay = '0s';
    } catch (_) {}
}

async function updateLiveTicker() {
    return await __fennecDedupe('updateLiveTicker', async () => {
        try {
            const tickerEl = document.getElementById('liveTicker');
            if (!tickerEl) return;

            const tickerContent = tickerEl.querySelector('#ticker-content') || tickerEl;

            // Seed instantly from cache so it never stays blank on slow API
            seedChartPriceFromCache('FB_FENNEC');
            __seedDashboardPricesFromCache();

            const dash = await fetch(`${BACKEND_URL}?action=get_dashboard_data`, {
                cache: 'no-store'
            })
                .then(r => (r.ok ? r.json().catch(() => null) : null))
                .catch(() => null);

            const priceRes = dash?.data?.prices || null;
            const fractalFee = dash?.data?.fees?.fractal || { fastestFee: 1 };
            const btcFeeRes = dash?.data?.fees?.bitcoin || { fastestFee: 1 };

            if (priceRes) {
                globalPrices.btc = priceRes.btc || globalPrices.btc || 0;
                globalPrices.fb = priceRes.fb || globalPrices.fb || 0;
                globalPrices.fennec = priceRes.fennec_in_fb || globalPrices.fennec || 0;

                __storeDashboardPricesToCache();

                // Обновляем заголовок вкладки браузера
                if (globalPrices.fb > 0) {
                    document.title = `$${globalPrices.fb.toFixed(2)} FB | $FENNEC`;
                }
            }

            // 3. Формируем HTML
            const items = [];

            // BTC (округляем до целых)
            if (globalPrices.btc > 0) {
                items.push(
                    `<span class="ticker-item text-white"><img src="img/BTC.svg" class="w-4 h-4 rounded-full" onerror="this.style.display='none'"><span>BTC: $${globalPrices.btc.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></span>`
                );
            }

            // FB (показываем 2 знака, если цена > 1, иначе 4)
            if (globalPrices.fb > 0) {
                const fbDecimals = globalPrices.fb >= 1 ? 2 : 4;
                items.push(
                    `<span class="ticker-item text-white"><img src="img/FB.png" class="w-4 h-4 rounded-full" onerror="this.style.display='none'"><span>FB: $${globalPrices.fb.toFixed(fbDecimals)}</span></span>`
                );
            } else {
                items.push(
                    '<span class="ticker-item text-white"><img src="img/FB.png" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'"><span>FB: --</span></span>'
                );
            }

            // FENNEC - always show last known price (seeded from cache/pool)
            let fennecPrice = globalPrices.fennec;
            // Fallback к poolReserves если цена не загрузилась
            const poolReserves = window.poolReserves;
            if (
                fennecPrice === 0 &&
                typeof poolReserves !== 'undefined' &&
                poolReserves &&
                poolReserves.FENNEC > 0 &&
                poolReserves.sFB > 0
            ) {
                fennecPrice = poolReserves.sFB / poolReserves.FENNEC;
                globalPrices.fennec = fennecPrice; // Сохраняем для следующего обновления
            }

            if (fennecPrice > 0) {
                items.push(
                    `<span class="ticker-item text-fennec"><img src="img/phav.png" class="w-4 h-4 rounded-full" onerror="this.style.display='none'"><span>FENNEC: ${fennecPrice.toFixed(6)} FB</span></span>`
                );
            } else {
                items.push(
                    '<span class="ticker-item text-fennec"><img src="img/phav.png" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'"><span>FENNEC: --</span></span>'
                );
            }

            // Gas
            const fractalGas = fractalFee.fastestFee || 1;
            const btcGas = btcFeeRes.fastestFee || 1;
            items.push(`<span class="ticker-item text-white"><span>⛽ Bitcoin fee: ${btcGas} sat/vB</span></span>`);
            items.push(`<span class="ticker-item text-white"><span>⛽ Fractal fee: ${fractalGas} sat/vB</span></span>`);

            const trackHtml = items.join('<span class="ticker-divider"></span>');
            const tickerHtml = `<div class="ticker-marquee">${trackHtml}</div>`;

            // ИСПРАВЛЕНИЕ: Убираем дублирование - показываем только один раз
            if (tickerContent) {
                tickerContent.innerHTML = tickerHtml;
            } else {
                tickerEl.innerHTML = tickerHtml;
            }

            try {
                __syncTickerMarqueePhase();
            } catch (_) {}
        } catch (e) {
            console.error('Ticker update error:', e);
            const tickerEl = document.getElementById('liveTicker');
            if (tickerEl) {
                tickerEl.innerHTML =
                    '<div class="ticker-marquee"><span class="ticker-item text-fennec"><img src="img/phav.png" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'"><span>FENNEC SYSTEM ONLINE</span></span></div>';
            }

            try {
                __syncTickerMarqueePhase();
            } catch (_) {}
        }
    });
}

let __publicTickerInterval = null;
function startPublicTickerUpdates() {
    if (__publicTickerInterval) return;
    __publicTickerInterval = setInterval(() => {
        try {
            updateLiveTicker();
        } catch (_) {}
    }, 600000);
}

function stopPublicTickerUpdates() {
    if (__publicTickerInterval) {
        clearInterval(__publicTickerInterval);
        __publicTickerInterval = null;
    }
}

function __maybeInitChart() {
    try {
        if (window.__fennecTerminalInitDone) return;
    } catch (_) {}
    try {
        if (!document.getElementById('priceChart')) return;
    } catch (_) {
        return;
    }

    try {
        if (!window.__fennecTerminalInitDone) {
            window.__fennecTerminalInitDone = true;
        }
    } catch (_) {}

    try {
        seedChartPriceFromCache(__getSwapPairKey());
    } catch (_) {}

    try {
        __bindPairListener();
    } catch (_) {}

    try {
        setTimeout(initChart, 1000);
    } catch (_) {}
}

try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            __maybeInitChart();
            try {
                if (!window.__fennecTickerSetup) {
                    window.__fennecTickerSetup = true;
                    updateLiveTicker();
                    startPublicTickerUpdates();
                }
            } catch (_) {}
        });
    } else {
        __maybeInitChart();
        try {
            if (!window.__fennecTickerSetup) {
                window.__fennecTickerSetup = true;
                updateLiveTicker();
                startPublicTickerUpdates();
            }
        } catch (_) {}
    }
} catch (_) {}

try {
    document.addEventListener('visibilitychange', () => {
        try {
            if (document.hidden) {
                stopPublicTickerUpdates();
            } else {
                startPublicTickerUpdates();
            }
        } catch (_) {}
    });
} catch (_) {}

Object.assign(window, {
    initChart,
    loadHistoricalPrices,
    updateChart,
    setChartTimeframe,
    updatePriceData,
    updateLiveTicker,
    startPublicTickerUpdates,
    stopPublicTickerUpdates,
    seedChartPriceFromCache,
    resetChartData
});

export {
    initChart,
    loadHistoricalPrices,
    updateChart,
    setChartTimeframe,
    updatePriceData,
    updateLiveTicker,
    startPublicTickerUpdates,
    stopPublicTickerUpdates,
    seedChartPriceFromCache,
    resetChartData
};
