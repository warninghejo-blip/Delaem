import { BACKEND_URL, safeFetchJson, __fennecDedupe } from './core.js';

// Chart.js is loaded globally via CDN in index.html
// eslint-disable-next-line no-undef
const Chart = typeof window !== 'undefined' ? window.Chart : undefined;

try {
    window.__fennecChartModuleLoaded = true;
} catch (_) {}

let chartTimeframe = '7d';
let priceChart = null;
const globalPrices = { btc: 0, fb: 0, fennec: 0 };

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

function seedChartPriceFromCache() {
    try {
        const stored = JSON.parse(localStorage.getItem('fennec_prices') || '[]');
        if (!Array.isArray(stored) || stored.length === 0) return;
        const last = stored[stored.length - 1];
        const p = last && last.price !== undefined ? Number(last.price) : NaN;
        if (!Number.isFinite(p) || p <= 0) return;
        globalPrices.fennec = globalPrices.fennec > 0 ? globalPrices.fennec : p;
        const priceEl = document.getElementById('chartPrice') || document.getElementById('currentPrice');
        if (priceEl && (!String(priceEl.innerText || '').trim() || String(priceEl.innerText || '').trim() === '--')) {
            priceEl.dataset.price = p.toFixed(6);
            priceEl.innerText = p.toFixed(6);
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
                    label: 'FENNEC/FB',
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

    // Load data and update chart
    loadHistoricalPrices().then(() => {
        updatePriceData();
    });
}

async function loadHistoricalPrices() {
    try {
        const __chartDebug =
            (typeof window !== 'undefined' && (window.__fennecChartDebug === true || window.__debugChart === true)) ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('fennec_debug_chart') === '1') ||
            (typeof location !== 'undefined' && /[?&]debug_chart=1/.test(location.search));

        if (__chartDebug) console.log('Loading history from InSwap...', chartTimeframe);

        // Load history based on current timeframe
        // For 'all', use '90d' since InSwap doesn't store more than 90 days
        const timeRange =
            chartTimeframe === 'all'
                ? '90d'
                : chartTimeframe === '30d'
                  ? '30d'
                  : chartTimeframe === '7d'
                    ? '7d'
                    : chartTimeframe === '24h'
                      ? '24h'
                      : '1h';
        const json = await safeFetchJson(
            `${BACKEND_URL}?action=price_line&tick0=sFB___000&tick1=FENNEC&timeRange=${timeRange}`,
            { timeoutMs: 12000, retries: 2 }
        );
        if (!json) throw new Error('Failed to load price history');

        if (__chartDebug) console.log('Price line API response:', json);

        if (json.code === 0 && json.data && json.data.list && json.data.list.length > 0) {
            // API returns price directly in item.price field (FB per FENNEC)
            const apiData = json.data.list
                .map(item => {
                    const price = parseFloat(item.price);
                    const tsRaw = Number(item.ts || item.timestamp || 0) || 0;
                    const timestamp = tsRaw > 1000000000000 ? tsRaw : tsRaw * 1000;

                    // Validate price is reasonable (0.00001 to 10 FB per FENNEC)
                    if (isNaN(price) || price <= 0 || price > 10 || price < 0.00001) {
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
                const existing = JSON.parse(localStorage.getItem('fennec_prices') || '[]');

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

                // For 90d/all timeframe, limit to max 200 points to avoid overcrowding
                // For shorter timeframes, use fewer points
                if (deduplicated.length > 10000) {
                    deduplicated.splice(0, deduplicated.length - 10000);
                }

                // Save all data (no limit - keep full 90+ day history)
                localStorage.setItem('fennec_prices', JSON.stringify(deduplicated));
                if (__chartDebug)
                    console.log(`Chart data saved: ${apiData.length} new points, ${deduplicated.length} total points`);
                if (__chartDebug) console.log(`Timeframe: ${chartTimeframe}, timeRange: ${timeRange}`);
            } else {
                if (__chartDebug) console.warn(`No valid price data from API for ${timeRange}`);
            }
        } else {
            if (__chartDebug) console.warn(`No data from price_line API for ${timeRange}, code: ${json.code}`);
        }

        // Always update chart after loading (even if no new data)
        updateChart();
    } catch (e) {
        console.error('Failed to load prices:', e);
        // Still try to update chart with existing data
        updateChart();
    }
}

async function updatePriceData(force = false) {
    const __now = Date.now();
    try {
        window.__fennecPriceFetchState =
            window.__fennecPriceFetchState && typeof window.__fennecPriceFetchState === 'object'
                ? window.__fennecPriceFetchState
                : { lastFetchAt: 0 };
        const last = Number(window.__fennecPriceFetchState.lastFetchAt || 0) || 0;
        if (!force && last > 0 && __now - last < 60000) return;
        window.__fennecPriceFetchState.lastFetchAt = __now;
    } catch (_) {}

    return await __fennecDedupe('updatePriceData', async () => {
        try {
            const json = await safeFetchJson(`${BACKEND_URL}?action=quote`, {
                timeoutMs: 12000,
                retries: 2
            });
            if (!json) throw new Error('Failed to fetch quote');

            let data = null;
            if (json.data) {
                if (json.data.tick0) data = json.data;
                else if (Array.isArray(json.data.list) && json.data.list.length > 0) data = json.data.list[0];
            }

            if (data && data.amount0 && data.amount1) {
                const amount0 = parseFloat(data.amount0);
                const amount1 = parseFloat(data.amount1);
                // Determine which is FENNEC and which is FB
                const isFennecFirst = data.tick0 && data.tick0.includes('FENNEC');
                // Price = FB per FENNEC (how much FB you get for 1 FENNEC)
                // If FENNEC is first: amount0 = FENNEC, amount1 = FB, so price = FB/FENNEC = amount1/amount0
                // If FB is first: amount0 = FB, amount1 = FENNEC, so price = FB/FENNEC = amount0/amount1
                const price = isFennecFirst ? amount1 / amount0 : amount0 / amount1;

                // Validate price is reasonable (between 0.00001 and 10 FB per FENNEC)
                if (isNaN(price) || price <= 0 || price > 10 || price < 0.00001) {
                    console.warn('Invalid price calculated:', price, 'from', data);
                    return;
                }
                const timestamp = Date.now();

                const stored = JSON.parse(localStorage.getItem('fennec_prices') || '[]');
                const lastPoint = stored[stored.length - 1];

                // Добавляем точку если прошло > 1 минуты или цена изменилась значительно
                if (
                    !lastPoint ||
                    timestamp - lastPoint.timestamp > 60000 ||
                    Math.abs(lastPoint.price - price) / lastPoint.price > 0.01
                ) {
                    stored.push({ price, timestamp });
                    // Храним максимум 500 точек для производительности
                    if (stored.length > 10000) stored.shift();
                    localStorage.setItem('fennec_prices', JSON.stringify(stored));
                    console.log(`New price: ${price.toFixed(6)} FB/FENNEC`);
                    updateChart();
                }
            }
        } catch (e) {
            console.error('Price update error:', e);
        }
    });
}

function updateChart() {
    if (!priceChart) return;

    const __chartDebug =
        (typeof window !== 'undefined' && (window.__fennecChartDebug === true || window.__debugChart === true)) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('fennec_debug_chart') === '1') ||
        (typeof location !== 'undefined' && /[?&]debug_chart=1/.test(location.search));

    const stored = JSON.parse(localStorage.getItem('fennec_prices') || '[]');
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
async function updateMarketStats(_fennecPriceInFB) {
    try {
        const marketCapEl = document.getElementById('marketCap');
        const volume24hEl = document.getElementById('volume24h');
        const volume7dEl = document.getElementById('volume7d');
        const volume30dEl = document.getElementById('volume30d');

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

        const poolCache = window.poolCache && typeof window.poolCache === 'object' ? window.poolCache : null;
        let poolData = poolCache && poolCache.data ? poolCache.data : null;
        if (!poolData) {
            await (typeof window.fetchReserves === 'function' ? window.fetchReserves() : Promise.resolve());
            poolData = poolCache && poolCache.data ? poolCache.data : null;
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

    // Show loading indicator
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer && priceChart) {
        const loadingEl = document.createElement('div');
        loadingEl.id = 'chartLoading';
        loadingEl.className = 'absolute inset-0 bg-black/50 flex items-center justify-center z-10';
        loadingEl.innerHTML = '<div class="text-fennec"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';
        chartContainer.appendChild(loadingEl);
    }

    // Update button states immediately
    document.querySelectorAll('button[onclick*="setChartTimeframe"]').forEach(btn => {
        btn.classList.remove('bg-fennec/20', 'text-fennec');
        btn.classList.add('bg-white/5', 'text-gray-400');
    });
    const activeBtn = Array.from(document.querySelectorAll('button[onclick*="setChartTimeframe"]')).find(b =>
        b.getAttribute('onclick').includes(`'${tf}'`)
    );
    if (activeBtn) {
        activeBtn.classList.remove('bg-white/5', 'text-gray-400');
        activeBtn.classList.add('bg-fennec/20', 'text-fennec');
    }

    // IMPORTANT: Reload historical data for new timeframe FIRST, then update chart
    loadHistoricalPrices()
        .then(() => {
            // Update chart with new data
            updateChart();
            // Remove loading indicator
            const loadingEl = document.getElementById('chartLoading');
            if (loadingEl) loadingEl.remove();
        })
        .catch(e => {
            console.error('Chart loading error:', e);
            // Still update chart with existing data
            updateChart();
            const loadingEl = document.getElementById('chartLoading');
            if (loadingEl) loadingEl.remove();
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
            seedChartPriceFromCache();
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
        seedChartPriceFromCache();
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
    seedChartPriceFromCache
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
    seedChartPriceFromCache
};
