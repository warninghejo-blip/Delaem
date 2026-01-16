function __t() {
    return {
        BACKEND_URL: window.BACKEND_URL || '',
        T_SFB: window.T_SFB || 'sFB___000',
        T_FENNEC: window.T_FENNEC || 'FENNEC',
        T_SBTC: window.T_SBTC || 'sBTC___000'
    };
}

function __pairNorm(pair) {
    return pair === 'BTC_FB' ? 'BTC_FB' : 'FB_FENNEC';
}

function __ensureDefaults() {
    try {
        if (typeof window.currentLiquidityPair !== 'string' || !window.currentLiquidityPair) {
            window.currentLiquidityPair = 'FB_FENNEC';
        }
    } catch (_) {}

    try {
        if (!window.liquidityPoolData || typeof window.liquidityPoolData !== 'object') {
            const { T_SFB, T_FENNEC } = __t();
            window.liquidityPoolData = {
                pair: 'FB_FENNEC',
                apiTick0: T_FENNEC,
                apiTick1: T_SFB,
                apiReserve0: 0,
                apiReserve1: 0,
                uiReserve0: 0,
                uiReserve1: 0,
                poolLp: 0
            };
        }
    } catch (_) {}
}

function __getLpd() {
    try {
        return window.liquidityPoolData && typeof window.liquidityPoolData === 'object'
            ? window.liquidityPoolData
            : null;
    } catch (_) {
        return null;
    }
}

function __setLpd(v) {
    try {
        window.liquidityPoolData = v;
    } catch (_) {}
}

function __safeFetchJson(url, options = {}) {
    try {
        if (typeof window.safeFetchJson === 'function') return window.safeFetchJson(url, options);
    } catch (_) {}

    const method = options.method || 'GET';
    const headers = options.headers;
    const body = options.body;

    return fetch(url, { method, headers, body }).then(r => (r && r.ok ? r.json() : null));
}

function __extractPoolInfoData(json) {
    if (!json) return null;
    if (json.data && json.data.tick0) return json.data;
    if (json.pool && json.pool.tick0) return json.pool;
    if (json.data && Array.isArray(json.data.list) && json.data.list.length > 0) return json.data.list[0];
    return null;
}

function __extractPoolLp(data) {
    const candidates = [
        data?.poolLp,
        data?.poolLP,
        data?.pool_lp,
        data?.lp,
        data?.lpSupply,
        data?.poolLpSupply,
        data?.poolLpAmount,
        data?.pool_lp_supply
    ];
    for (const v of candidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
}

function __toFixedTrim(num, maxDecimals) {
    const n = Number(num);
    if (!Number.isFinite(n)) return '';
    const d = Number.isFinite(Number(maxDecimals)) ? Math.max(0, Math.min(18, Number(maxDecimals))) : 8;
    const s = n.toFixed(d);
    return s
        .replace(/\.0+$/, '')
        .replace(/(\.\d*?)0+$/, '$1')
        .replace(/\.$/, '');
}

export function __normalizeAmountStr(value, maxDecimals) {
    if (value === null || value === undefined) return '';
    const s = String(value).trim();
    if (!s) return '';

    if (/e/i.test(s)) {
        const n = Number(s);
        return __toFixedTrim(n, maxDecimals);
    }

    if (!/^[0-9]*\.?[0-9]*$/.test(s)) {
        const n = Number(s);
        return __toFixedTrim(n, maxDecimals);
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    return __toFixedTrim(n, maxDecimals);
}

export function computeExpectedLp(amount0, amount1, reserve0, reserve1, poolLp) {
    const a0 = Number(amount0 || 0);
    const a1 = Number(amount1 || 0);
    const r0 = Number(reserve0 || 0);
    const r1 = Number(reserve1 || 0);
    const p = Number(poolLp || 0);
    if (!a0 || !a1) return 0;

    if (p > 0 && r0 > 0 && r1 > 0) {
        return Math.max(0, Math.min((a0 * p) / r0, (a1 * p) / r1));
    }
    if (r0 > 0 && r1 > 0) {
        const pEst = Math.sqrt(r0 * r1);
        if (Number.isFinite(pEst) && pEst > 0) {
            return Math.max(0, Math.min((a0 * pEst) / r0, (a1 * pEst) / r1));
        }
    }
    return Math.max(0, Math.sqrt(a0 * a1));
}

export function getBalanceForTick(tick) {
    const t = (tick || '').toString().toUpperCase();
    const ub = window.userBalances && typeof window.userBalances === 'object' ? window.userBalances : {};
    const pr = window.poolReserves && typeof window.poolReserves === 'object' ? window.poolReserves : {};
    if (t.includes('FENNEC')) return Number(ub.FENNEC || 0) || 0;
    if (t.includes('SBTC') || t === 'BTC') return Number(pr.user_sBTC || 0) || 0;
    if (t.includes('SFB') || t === 'FB') return Number(ub.sFB || 0) || 0;
    return 0;
}

export function getLiquidityConfig() {
    __ensureDefaults();
    const { T_SFB, T_FENNEC, T_SBTC } = __t();
    const p = __pairNorm(window.currentLiquidityPair);
    const uiTick0 = p === 'BTC_FB' ? T_SBTC : T_FENNEC;
    const uiTick1 = T_SFB;

    const lpd = __getLpd();

    const apiTick0 = lpd?.pair === p ? lpd.apiTick0 : uiTick0;
    const apiTick1 = lpd?.pair === p ? lpd.apiTick1 : uiTick1;
    const uiReserve0 = lpd?.pair === p ? Number(lpd.uiReserve0 || 0) || 0 : 0;
    const uiReserve1 = lpd?.pair === p ? Number(lpd.uiReserve1 || 0) || 0 : 0;
    const poolLp = lpd?.pair === p ? Number(lpd.poolLp || 0) || 0 : 0;

    const mapUiToApiAmounts = (amountUi0, amountUi1) => {
        const a0 = Number(amountUi0 || 0) || 0;
        const a1 = Number(amountUi1 || 0) || 0;
        if (p === 'FB_FENNEC') {
            const api0IsFennec = (apiTick0 || '').toString().toUpperCase().includes('FENNEC');
            return api0IsFennec ? { amount0: a0, amount1: a1 } : { amount0: a1, amount1: a0 };
        }
        const api0IsBtc = (apiTick0 || '').toString().toUpperCase().includes('SBTC');
        return api0IsBtc ? { amount0: a0, amount1: a1 } : { amount0: a1, amount1: a0 };
    };

    return {
        label: p === 'BTC_FB' ? 'BTC/FB' : 'FB/FENNEC',
        pair: p,
        uiTick0,
        uiTick1,
        apiTick0,
        apiTick1,
        reserve0: uiReserve0,
        reserve1: uiReserve1,
        poolLp,
        bal0: getBalanceForTick(uiTick0),
        bal1: getBalanceForTick(uiTick1),
        mapUiToApiAmounts
    };
}

export function updateLiquidityBalancesUI() {
    const cfg = getLiquidityConfig();
    const b0 = document.getElementById('liqBal0');
    const b1 = document.getElementById('liqBal1');
    if (b0) b0.innerText = Number(cfg.bal0 || 0).toFixed(8);
    if (b1) b1.innerText = Number(cfg.bal1 || 0).toFixed(8);
}

let __liqSyncGuard = false;
export function syncLiquidityAmounts(changedIndex) {
    if (__liqSyncGuard) return;
    __liqSyncGuard = true;
    try {
        const cfg = getLiquidityConfig();
        const el0 = document.getElementById('liqAmount0');
        const el1 = document.getElementById('liqAmount1');
        if (!el0 || !el1) return;

        const r0 = Number(cfg.reserve0 || 0);
        const r1 = Number(cfg.reserve1 || 0);
        const v0 = parseFloat(el0.value || '0') || 0;
        const v1 = parseFloat(el1.value || '0') || 0;

        if (r0 > 0 && r1 > 0) {
            if (changedIndex === 0 && v0 > 0) {
                el1.value = (v0 * (r1 / r0)).toFixed(8);
            }
            if (changedIndex === 1 && v1 > 0) {
                el0.value = (v1 * (r0 / r1)).toFixed(8);
            }
        }

        const lpEl = document.getElementById('liqExpectedLP');
        const lp = computeExpectedLp(
            parseFloat(el0.value || '0') || 0,
            parseFloat(el1.value || '0') || 0,
            r0,
            r1,
            cfg.poolLp || 0
        );
        if (lpEl) lpEl.innerText = lp ? lp.toFixed(8) : '--';

        const btn = document.getElementById('liqSupplyBtn');
        if (btn) {
            const v0Final = parseFloat(el0.value || '0') || 0;
            const v1Final = parseFloat(el1.value || '0') || 0;
            if (v0Final > 0 && v1Final > 0) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    } finally {
        __liqSyncGuard = false;
    }
}

export function setMaxLiqAmount(which) {
    if (!window.userAddress) return window.connectWallet();
    updateLiquidityBalancesUI();
    const cfg = getLiquidityConfig();
    const el0 = document.getElementById('liqAmount0');
    const el1 = document.getElementById('liqAmount1');
    if (!el0 || !el1) return;

    const feeBuffer = 0.05;
    const max0 = Math.max(0, Number(cfg.bal0 || 0) - (cfg.uiTick0 === __t().T_SFB ? feeBuffer : 0));
    const max1 = Math.max(0, Number(cfg.bal1 || 0) - (cfg.uiTick1 === __t().T_SFB ? feeBuffer : 0));

    if (which === 0) {
        el0.value = max0.toFixed(8);
        syncLiquidityAmounts(0);
        return;
    }

    el1.value = max1.toFixed(8);
    syncLiquidityAmounts(1);
}

export function switchLiquidityTab(tab) {
    const addContent = document.getElementById('liqAddContent');
    const removeContent = document.getElementById('liqRemoveContent');
    const addTab = document.getElementById('liqTabAdd');
    const removeTab = document.getElementById('liqTabRemove');

    if (tab === 'add') {
        if (addContent) addContent.classList.remove('hidden');
        if (removeContent) removeContent.classList.add('hidden');
        if (addTab) {
            addTab.className =
                'flex-1 px-4 py-2 rounded-xl bg-fennec/15 border border-fennec/30 text-white font-black transition';
        }
        if (removeTab) {
            removeTab.className =
                'flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-black transition';
        }
    } else if (tab === 'remove') {
        if (addContent) addContent.classList.add('hidden');
        if (removeContent) removeContent.classList.remove('hidden');
        if (addTab) {
            addTab.className =
                'flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-black transition';
        }
        if (removeTab) {
            removeTab.className =
                'flex-1 px-4 py-2 rounded-xl bg-fennec/15 border border-fennec/30 text-white font-black transition';
        }

        const ctx = window.__liqWithdrawCtx || null;
        const lpBalEl = document.getElementById('removeLpBalance');
        if (lpBalEl) {
            const lpAvail = Number(ctx?.lp || 0) || 0;
            lpBalEl.textContent = lpAvail > 0 ? lpAvail.toString() : '--';
        }
        const inp = document.getElementById('removeLpAmount');
        if (inp) {
            inp.value = '';
            try {
                if (typeof window.updateRemoveLiquidityEstimate === 'function') {
                    inp.addEventListener('input', window.updateRemoveLiquidityEstimate);
                }
            } catch (_) {}
        }
        const recv = document.getElementById('removeReceive');
        if (recv) recv.textContent = '--';
        const btn = document.getElementById('removeLiqBtn');
        if (btn) {
            btn.disabled = true;
            btn.className =
                'mt-3 w-full bg-gradient-to-r from-fennec to-orange-400 text-black font-black text-base py-3 rounded-xl hover:brightness-110 transition opacity-50 cursor-not-allowed';
        }
    }
}

export function closeAddLiquidityModal() {
    const modal = document.getElementById('addLiquidityModal');
    if (modal) modal.classList.add('hidden');
    switchLiquidityTab('add');
}

export async function loadLiquidityPoolData(pair) {
    const { BACKEND_URL, T_SBTC, T_FENNEC, T_SFB } = __t();
    const p = __pairNorm(pair);
    const queryTick0 = p === 'BTC_FB' ? T_SBTC : T_FENNEC;
    const queryTick1 = T_SFB;

    try {
        const now = Date.now();
        const url = `${BACKEND_URL}?action=quote&tick0=${encodeURIComponent(queryTick0)}&tick1=${encodeURIComponent(queryTick1)}&t=${now}`;
        const json = await __safeFetchJson(url, { timeoutMs: 12000, retries: 2 });
        const data = __extractPoolInfoData(json);
        if (!data) return;

        const apiTick0 = data.tick0 || queryTick0;
        const apiTick1 = data.tick1 || queryTick1;
        const apiReserve0 = Number(data.amount0 || 0) || 0;
        const apiReserve1 = Number(data.amount1 || 0) || 0;
        const poolLp = __extractPoolLp(data);

        let uiReserve0 = 0;
        let uiReserve1 = 0;

        if (p === 'FB_FENNEC') {
            const isApi0Fennec = (apiTick0 || '').toString().toUpperCase().includes('FENNEC');
            uiReserve0 = isApi0Fennec ? apiReserve0 : apiReserve1;
            uiReserve1 = isApi0Fennec ? apiReserve1 : apiReserve0;
        } else {
            const isApi0Btc = (apiTick0 || '').toString().toUpperCase().includes('SBTC');
            uiReserve0 = isApi0Btc ? apiReserve0 : apiReserve1;
            uiReserve1 = isApi0Btc ? apiReserve1 : apiReserve0;
        }

        __setLpd({
            pair: p,
            apiTick0,
            apiTick1,
            apiReserve0,
            apiReserve1,
            uiReserve0,
            uiReserve1,
            poolLp
        });
    } catch (e) {
        console.error('loadLiquidityPoolData failed:', e);
    }
}

export async function selectLiquidityPair(pair) {
    __ensureDefaults();
    window.currentLiquidityPair = __pairNorm(pair);

    const btn0 = document.getElementById('liqPairFBF');
    const btn1 = document.getElementById('liqPairBFB');
    if (btn0 && btn1) {
        btn0.className =
            window.currentLiquidityPair === 'FB_FENNEC'
                ? 'px-4 py-3 rounded-xl bg-fennec/10 border border-fennec/25 text-white font-black hover:bg-fennec/15 hover:border-fennec/45 transition'
                : 'px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black hover:bg-white/10 hover:border-white/20 transition';
        btn1.className =
            window.currentLiquidityPair === 'BTC_FB'
                ? 'px-4 py-3 rounded-xl bg-fennec/10 border border-fennec/25 text-white font-black hover:bg-fennec/15 hover:border-fennec/45 transition'
                : 'px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black hover:bg-white/10 hover:border-white/20 transition';
    }

    const tick0El = document.getElementById('liqTick0Label');
    const tick1El = document.getElementById('liqTick1Label');
    if (tick0El && tick1El) {
        if (window.currentLiquidityPair === 'FB_FENNEC') {
            tick0El.innerText = 'FENNEC';
            tick1El.innerText = 'FB';
        } else {
            tick0El.innerText = 'BTC';
            tick1El.innerText = 'FB';
        }
    }

    await loadLiquidityPoolData(window.currentLiquidityPair);
    updateLiquidityBalancesUI();
    syncLiquidityAmounts(0);
    try {
        if (typeof window.refreshMyLiquidityForSelectedPair === 'function') {
            window.refreshMyLiquidityForSelectedPair(false);
        } else if (typeof refreshMyLiquidityForSelectedPair === 'function') {
            refreshMyLiquidityForSelectedPair(false);
        }
    } catch (_) {}
}

function __formatMaybeNum(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.abs(n) >= 1e8 ? n.toExponential(3) : Math.abs(n) >= 1 ? n.toFixed(6) : n.toFixed(10);
}

function __escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function __poolMatchesPair(pool, pair) {
    const a = String(pool?.tick0 || '').toUpperCase();
    const b = String(pool?.tick1 || '').toUpperCase();
    const hasFennec = a.includes('FENNEC') || b.includes('FENNEC');
    const hasFB =
        a.includes('SFB') ||
        b.includes('SFB') ||
        a === 'FB' ||
        b === 'FB' ||
        a === 'SFB___000' ||
        b === 'SFB___000' ||
        a.includes('FB') ||
        b.includes('FB');
    const hasBTC =
        a.includes('SBTC') ||
        b.includes('SBTC') ||
        a === 'BTC' ||
        b === 'BTC' ||
        a === 'SBTC___000' ||
        b === 'SBTC___000' ||
        a.includes('BTC') ||
        b.includes('BTC');
    if (pair === 'FB_FENNEC') return hasFennec && hasFB;
    if (pair === 'BTC_FB') return hasBTC && hasFB;
    return false;
}

let __myLiqCache = null;
let __myLiqCacheAt = 0;

export async function fetchMyLiquiditySummary(force) {
    if (!window.userAddress) return null;
    const now = Date.now();
    if (!force && __myLiqCache && now - __myLiqCacheAt < 15000) return __myLiqCache;
    try {
        const { BACKEND_URL } = __t();
        const pubkey = typeof window.userPubkey === 'string' && window.userPubkey ? window.userPubkey : '';
        const url = pubkey
            ? `${BACKEND_URL}?action=inswap_summary&address=${encodeURIComponent(window.userAddress)}&pubkey=${encodeURIComponent(pubkey)}&t=${now}`
            : `${BACKEND_URL}?action=inswap_summary&address=${encodeURIComponent(window.userAddress)}&t=${now}`;
        const json = await __safeFetchJson(url, { timeoutMs: 15000, retries: 1 });
        const data = json && typeof json === 'object' ? json.data || null : null;
        __myLiqCache = data;
        __myLiqCacheAt = now;
        return data;
    } catch (_) {
        return __myLiqCache;
    }
}

export async function refreshMyLiquidityForSelectedPair(force) {
    const box = document.getElementById('liqMyPos');
    const body = document.getElementById('liqMyPosBody');
    const withdrawBox = document.getElementById('liqWithdrawPanel');
    if (!box || !body) return;

    if (!window.userAddress) {
        box.classList.add('hidden');
        if (withdrawBox) withdrawBox.classList.add('hidden');
        window.__liqWithdrawCtx = null;
        return;
    }

    try {
        window.__fennecUiCache =
            window.__fennecUiCache && typeof window.__fennecUiCache === 'object'
                ? window.__fennecUiCache
                : { historyHtml: {}, inscriptionsHtml: {}, liquidityHtml: {} };
    } catch (_) {}

    try {
        const key = `liq:${String(window.userAddress || '').trim()}:${String(window.currentLiquidityPair || '').trim()}`;
        const cached = window.__fennecUiCache?.liquidityHtml?.[key];
        if (!force && cached) {
            body.innerHTML = String(cached);
        } else {
            body.innerHTML = '<div class="text-[10px] text-gray-500 font-mono">Loading...</div>';
        }
    } catch (_) {
        body.innerHTML = '<div class="text-[10px] text-gray-500 font-mono">Loading...</div>';
    }
    box.classList.remove('hidden');
    if (withdrawBox) withdrawBox.classList.add('hidden');

    const data = await fetchMyLiquiditySummary(!!force);
    if (!data) {
        body.innerHTML =
            '<div class="text-[10px] text-gray-500 font-mono">Liquidity data unavailable. Try Refresh.</div>';
        if (withdrawBox) withdrawBox.classList.add('hidden');
        window.__liqWithdrawCtx = null;
        return;
    }
    const list = data && Array.isArray(data.lp_list) ? data.lp_list : [];
    const pair = __pairNorm(window.currentLiquidityPair);
    const pools = list.filter(p => __poolMatchesPair(p, pair));

    if (!pools.length) {
        body.innerHTML = '<div class="text-[10px] text-gray-500 font-mono">No liquidity found for this pair.</div>';
        if (withdrawBox) withdrawBox.classList.add('hidden');
        window.__liqWithdrawCtx = null;
        return;
    }

    let uiAmt0 = 0;
    let uiAmt1 = 0;
    let share = 0;
    let lp = 0;
    const uiTick0 = pair === 'BTC_FB' ? 'BTC' : 'FENNEC';
    const uiTick1 = 'FB';

    for (const p of pools) {
        const a0 = Number(p.amount0 || 0) || 0;
        const a1 = Number(p.amount1 || 0) || 0;
        const api0 = String(p.tick0 || '').toUpperCase();
        if (pair === 'FB_FENNEC') {
            const api0IsFennec = api0.includes('FENNEC');
            uiAmt0 += api0IsFennec ? a0 : a1;
            uiAmt1 += api0IsFennec ? a1 : a0;
        } else {
            const api0IsBtc = api0.includes('SBTC') || api0 === 'BTC' || api0.includes('BTC');
            uiAmt0 += api0IsBtc ? a0 : a1;
            uiAmt1 += api0IsBtc ? a1 : a0;
        }
        share += Number(p.shareOfPool || p.share || 0) || 0;
        lp += Number(p.lp || p.liq || p.liquidity || 0) || 0;
    }

    const lpStr = lp ? __formatMaybeNum(lp) || String(lp) : '--';
    const shareStr = share ? __formatMaybeNum(share) || String(share) : '--';

    body.innerHTML = `
                                                                                                                    <div class="grid grid-cols-2 gap-3">
                                                                                                                        <div class="bg-white/5 border border-white/10 rounded-xl p-3">
                                                                                                                            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${uiTick0}</div>
                                                                                                                            <div class="mt-1 text-white text-base font-black">${__escapeHtml(__formatMaybeNum(uiAmt0) || '0')}</div>
                                                                                                                        </div>
                                                                                                                        <div class="bg-white/5 border border-white/10 rounded-xl p-3">
                                                                                                                            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${uiTick1}</div>
                                                                                                                            <div class="mt-1 text-white text-base font-black">${__escapeHtml(__formatMaybeNum(uiAmt1) || '0')}</div>
                                                                                                                        </div>
                                                                                                                    </div>

                                                                                                                    <div class="mt-3 grid grid-cols-2 gap-3 text-[10px] font-mono">
                                                                                                                        <div class="text-gray-400">LP: <span class="text-white font-bold">${__escapeHtml(lpStr)}</span></div>
                                                                                                                        <div class="text-gray-400 text-right">Share: <span class="text-white font-bold">${__escapeHtml(shareStr)}</span></div>
                                                                                                                    </div>
                                                                                                                `;

    try {
        const key = `liq:${String(window.userAddress || '').trim()}:${String(window.currentLiquidityPair || '').trim()}`;
        if (window.__fennecUiCache && window.__fennecUiCache.liquidityHtml) {
            window.__fennecUiCache.liquidityHtml[key] = String(body.innerHTML || '');
        }
    } catch (_) {}

    try {
        const cfg =
            typeof window.getLiquidityConfig === 'function' ? window.getLiquidityConfig() : getLiquidityConfig();
        window.__liqWithdrawCtx = {
            pair,
            uiTick0,
            uiTick1,
            apiTick0: cfg?.apiTick0 || pools[0]?.tick0 || '',
            apiTick1: cfg?.apiTick1 || pools[0]?.tick1 || '',
            lp: Number(lp || 0) || 0
        };
    } catch (_) {
        window.__liqWithdrawCtx = null;
    }

    if (withdrawBox) withdrawBox.classList.add('hidden');
}

export async function openRemoveLiquidityModal() {
    if (!window.userAddress) {
        try {
            await window.connectWallet();
        } catch (_) {}
        if (!window.userAddress) return;
    }
    const modal = document.getElementById('addLiquidityModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    switchLiquidityTab('remove');
}

export function closeRemoveLiquidityModal() {
    try {
        const modal = document.getElementById('removeLiquidityModal');
        if (modal) modal.classList.add('hidden');
    } catch (_) {}
}

export function setMaxRemoveLp() {
    const ctx = window.__liqWithdrawCtx || null;
    const lpAvail = Number(ctx?.lp || 0) || 0;
    const inp = document.getElementById('removeLpAmount');
    if (!inp) return;
    inp.value = lpAvail ? __normalizeAmountStr(lpAvail, 8) : '';
    updateRemoveLiquidityEstimate();
}

let __removeQuoteTimeout = null;
export async function updateRemoveLiquidityEstimate() {
    clearTimeout(__removeQuoteTimeout);
    const inp = document.getElementById('removeLpAmount');
    const recv = document.getElementById('removeReceive');
    const btn = document.getElementById('removeLiqBtn');
    const ctx = window.__liqWithdrawCtx || null;

    if (!inp || !recv || !ctx) return;

    const lpVal = Number(inp.value || 0) || 0;
    if (!lpVal || lpVal <= 0) {
        recv.textContent = '--';
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        return;
    }

    recv.textContent = 'Loading...';
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    __removeQuoteTimeout = setTimeout(async () => {
        try {
            const { BACKEND_URL } = __t();
            const lpStr = __normalizeAmountStr(lpVal, 8);
            const qUrl =
                `${BACKEND_URL}?action=quote_remove_liq` +
                `&address=${encodeURIComponent(window.userAddress)}` +
                `&tick0=${encodeURIComponent(ctx.apiTick0)}` +
                `&tick1=${encodeURIComponent(ctx.apiTick1)}` +
                `&lp=${encodeURIComponent(lpStr)}`;
            const q = await fetch(qUrl, {
                headers: {
                    'x-public-key': window.userPubkey,
                    'x-address': window.userAddress
                },
                cache: 'no-store'
            }).then(r => r.json());

            if (q && q.code === 0 && q.data) {
                const amount0Str = String(q.data.amount0 || q.data.amt0 || '').trim();
                const amount1Str = String(q.data.amount1 || q.data.amt1 || '').trim();
                if (amount0Str && amount1Str) {
                    let uiAmt0 = amount0Str;
                    let uiAmt1 = amount1Str;
                    if (ctx.pair === 'FB_FENNEC') {
                        const api0 = String(ctx.apiTick0 || '').toUpperCase();
                        const api0IsFennec = api0.includes('FENNEC');
                        uiAmt0 = api0IsFennec ? amount0Str : amount1Str;
                        uiAmt1 = api0IsFennec ? amount1Str : amount0Str;
                    } else {
                        const api0 = String(ctx.apiTick0 || '').toUpperCase();
                        const api0IsBtc = api0.includes('SBTC') || api0 === 'BTC' || api0.includes('BTC');
                        uiAmt0 = api0IsBtc ? amount0Str : amount1Str;
                        uiAmt1 = api0IsBtc ? amount1Str : amount0Str;
                    }
                    const amt0Rounded = Number(uiAmt0).toFixed(2);
                    const amt1Rounded = Number(uiAmt1).toFixed(2);
                    recv.textContent = `${ctx.uiTick0}: ${amt0Rounded}   |   ${ctx.uiTick1}: ${amt1Rounded}`;
                    if (btn) {
                        btn.disabled = false;
                        btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                    return;
                }
            }
            recv.textContent = 'Quote failed';
        } catch (_) {
            recv.textContent = 'Error';
        }
    }, 500);
}

export async function doRemoveLiquidity() {
    if (!window.userAddress) return window.connectWallet();

    const btn = document.getElementById('removeLiqBtn');
    const originalText = btn ? btn.innerText : '';
    try {
        if (typeof window.checkFractalNetwork === 'function') {
            await window.checkFractalNetwork();
        }

        if (!window.userPubkey)
            try {
                window.userPubkey = await window.unisat.getPublicKey();
            } catch (_) {}

        const ctx = window.__liqWithdrawCtx || null;
        if (!ctx || !ctx.apiTick0 || !ctx.apiTick1) throw new Error('No liquidity context');

        const inp = document.getElementById('removeLpAmount');
        const lpVal = Number(inp?.value || 0) || 0;
        if (!lpVal || lpVal <= 0) throw new Error('Enter LP amount');

        const lpStr = __normalizeAmountStr(lpVal, 8);
        if (!lpStr || Number(lpStr) <= 0) throw new Error('Invalid LP amount');
        if (ctx.lp && lpVal > Number(ctx.lp || 0) * 1.0000001) throw new Error('LP amount exceeds your position');

        if (btn) {
            btn.disabled = true;
            btn.innerText = 'QUOTING…';
        }

        const { BACKEND_URL, T_SFB } = __t();
        const qUrl =
            `${BACKEND_URL}?action=quote_remove_liq` +
            `&address=${encodeURIComponent(window.userAddress)}` +
            `&tick0=${encodeURIComponent(ctx.apiTick0)}` +
            `&tick1=${encodeURIComponent(ctx.apiTick1)}` +
            `&lp=${encodeURIComponent(lpStr)}`;
        const q = await fetch(qUrl, {
            headers: {
                'x-public-key': window.userPubkey,
                'x-address': window.userAddress
            },
            cache: 'no-store'
        }).then(r => r.json());
        if (!q || q.code !== 0 || !q.data) throw new Error(q?.msg || q?.error || 'quote_remove_liq failed');

        const amount0Str = String(q.data.amount0 || q.data.amt0 || '').trim();
        const amount1Str = String(q.data.amount1 || q.data.amt1 || '').trim();
        if (!amount0Str || !amount1Str) throw new Error('quote_remove_liq returned empty amounts');

        try {
            const recv = document.getElementById('removeReceive');
            if (recv) {
                let uiAmt0 = amount0Str;
                let uiAmt1 = amount1Str;
                if (ctx.pair === 'FB_FENNEC') {
                    const api0 = String(ctx.apiTick0 || '').toUpperCase();
                    const api0IsFennec = api0.includes('FENNEC');
                    uiAmt0 = api0IsFennec ? amount0Str : amount1Str;
                    uiAmt1 = api0IsFennec ? amount1Str : amount0Str;
                } else {
                    const api0 = String(ctx.apiTick0 || '').toUpperCase();
                    const api0IsBtc = api0.includes('SBTC') || api0 === 'BTC' || api0.includes('BTC');
                    uiAmt0 = api0IsBtc ? amount0Str : amount1Str;
                    uiAmt1 = api0IsBtc ? amount1Str : amount0Str;
                }
                recv.textContent = `${ctx.uiTick0}: ${uiAmt0}   |   ${ctx.uiTick1}: ${uiAmt1}`;
            }
        } catch (_) {}

        const ts = Math.floor(Date.now() / 1000);
        const feeTick = T_SFB;
        const payType = 'tick';
        const slippage = '0.05';

        if (btn) btn.innerText = 'PREPARING…';
        const preUrl =
            `${BACKEND_URL}?action=pre_remove_liq` +
            `&address=${encodeURIComponent(window.userAddress)}` +
            `&tick0=${encodeURIComponent(ctx.apiTick0)}` +
            `&tick1=${encodeURIComponent(ctx.apiTick1)}` +
            `&amount0=${encodeURIComponent(amount0Str)}` +
            `&amount1=${encodeURIComponent(amount1Str)}` +
            `&lp=${encodeURIComponent(lpStr)}` +
            `&slippage=${encodeURIComponent(slippage)}` +
            `&ts=${encodeURIComponent(ts)}` +
            `&feeTick=${encodeURIComponent(feeTick)}` +
            `&payType=${encodeURIComponent(payType)}`;
        const pre = await fetch(preUrl, {
            headers: {
                'x-public-key': window.userPubkey,
                'x-address': window.userAddress
            },
            cache: 'no-store'
        }).then(r => r.json());
        if (!pre || pre.code !== 0 || !pre.data) throw new Error(pre?.msg || pre?.error || 'pre_remove_liq failed');

        const signMsgs = Array.isArray(pre.data.signMsgs)
            ? pre.data.signMsgs
            : pre.data.signMsg
              ? [pre.data.signMsg]
              : pre.data.sign_msg
                ? [pre.data.sign_msg]
                : pre.data.msg
                  ? [pre.data.msg]
                  : [];
        const msgsToSign = signMsgs
            .map(m => (typeof m === 'object' ? (m.text ?? m.msg ?? m.message ?? m.signMsg ?? m.sign_msg ?? m.id) : m))
            .map(m => (m === null || m === undefined ? '' : String(m)))
            .filter(m => m.length > 0);
        if (!msgsToSign.length) throw new Error('pre_remove_liq returned empty signMsgs');

        const feeAmount = String(pre.data.feeAmount || pre.data.fee_amount || '').trim();
        const feeTickPrice = String(pre.data.feeTickPrice || pre.data.fee_tick_price || '').trim();
        if (!feeAmount || !feeTickPrice) throw new Error('pre_remove_liq returned empty feeAmount/feeTickPrice');

        const sigs = [];
        for (let i = 0; i < msgsToSign.length; i += 1) {
            if (btn) btn.innerText = `SIGNING (${i + 1}/${msgsToSign.length})…`;
            await new Promise(r => setTimeout(r, 250));
            const sig = await window.unisat.signMessage(msgsToSign[i], 'bip322-simple');
            sigs.push(sig);
        }

        if (!Array.isArray(sigs) || sigs.length !== msgsToSign.length || sigs.some(s => !s || typeof s !== 'string')) {
            throw new Error('Wallet returned invalid signature(s)');
        }

        if (btn) btn.innerText = 'SUBMITTING…';
        const body = {
            address: window.userAddress,
            tick0: ctx.apiTick0,
            tick1: ctx.apiTick1,
            lp: lpStr,
            amount0: amount0Str,
            amount1: amount1Str,
            slippage,
            ts,
            feeTick,
            feeAmount,
            feeTickPrice,
            sigs,
            payType,
            rememberPayType: false
        };

        const sub = await fetch(`${BACKEND_URL}?action=remove_liq`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': window.userPubkey,
                'x-address': window.userAddress
            },
            body: JSON.stringify(body)
        }).then(r => r.json());

        if (!sub || sub.code !== 0) throw new Error(sub?.msg || sub?.error || 'remove_liq failed');

        if (typeof window.showSuccess === 'function')
            window.showSuccess(`Liquidity withdrawn! ID: ${sub.data?.id || 'OK'}`);
        if (typeof window.showNotification === 'function')
            window.showNotification('Liquidity withdrawn successfully', 'success', 3200);
        closeAddLiquidityModal();
        setTimeout(() => {
            try {
                refreshMyLiquidityForSelectedPair(true);
            } catch (_) {}
            try {
                if (typeof window.checkBalance === 'function') window.checkBalance();
            } catch (_) {}
        }, 1200);
    } catch (e) {
        console.error('Remove liquidity error:', e);
        if (typeof window.showNotification === 'function')
            window.showNotification(e?.message || String(e), 'error', 4500);
        try {
            document.getElementById('errorMsg').innerText = e?.message || String(e);
            document.getElementById('errorModal').classList.remove('hidden');
        } catch (_) {}
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

export async function openAddLiquidityModal(pair) {
    if (!window.userAddress) {
        try {
            await window.connectWallet();
        } catch (_) {}
        if (!window.userAddress) return;
    }

    const modal = document.getElementById('addLiquidityModal');
    if (modal) modal.classList.remove('hidden');

    try {
        switchLiquidityTab('add');
    } catch (_) {}

    const p = __pairNorm(pair);

    const fixedDisplay = document.getElementById('liqFixedPairDisplay');
    if (fixedDisplay) {
        fixedDisplay.textContent = p === 'BTC_FB' ? 'BTC / FB' : 'FB / FENNEC';
    }

    const el0 = document.getElementById('liqAmount0');
    const el1 = document.getElementById('liqAmount1');
    const btn = document.getElementById('liqSupplyBtn');
    if (el0) el0.disabled = true;
    if (el1) el1.disabled = true;
    if (btn) btn.disabled = true;
    try {
        await selectLiquidityPair(p);
    } catch (_) {
        try {
            window.currentLiquidityPair = p;
            await loadLiquidityPoolData(window.currentLiquidityPair);
            updateLiquidityBalancesUI();
        } catch (_) {}
    }

    if (el0) el0.disabled = false;
    if (el1) el1.disabled = false;
    if (btn) btn.disabled = false;

    try {
        const v0 = Number(el0?.value || 0);
        const v1 = Number(el1?.value || 0);
        if (v0 > 0) syncLiquidityAmounts(0);
        else if (v1 > 0) syncLiquidityAmounts(1);
    } catch (_) {}

    try {
        refreshMyLiquidityForSelectedPair(false);
    } catch (_) {}

    try {
        if (el0) setTimeout(() => el0.focus(), 50);
    } catch (_) {}
}

export async function doAddLiquidity() {
    if (!window.userAddress) return window.connectWallet();
    try {
        if (typeof window.checkFractalNetwork === 'function') {
            await window.checkFractalNetwork();
        }
    } catch (e) {
        try {
            document.getElementById('errorMsg').innerText = e?.message || String(e);
            document.getElementById('errorModal').classList.remove('hidden');
        } catch (_) {}
        return;
    }

    const cfg = getLiquidityConfig();
    const el0 = document.getElementById('liqAmount0');
    const el1 = document.getElementById('liqAmount1');
    const btn = document.getElementById('liqSupplyBtn');
    if (!el0 || !el1 || !btn) return;

    const amount0 = parseFloat(el0.value || '0') || 0;
    const amount1 = parseFloat(el1.value || '0') || 0;
    if (!amount0 || !amount1) {
        if (typeof window.showNotification === 'function') window.showNotification('Enter amounts', 'warning', 2000);
        return;
    }

    const feeBuffer = 0.05;
    const { T_SFB, BACKEND_URL } = __t();
    if (cfg.uiTick0 === T_SFB && amount0 > Math.max(0, cfg.bal0 - feeBuffer)) {
        if (typeof window.showNotification === 'function')
            window.showNotification('Reserved 0.05 FB for fees', 'info', 2200);
        el0.value = Math.max(0, cfg.bal0 - feeBuffer).toFixed(8);
        syncLiquidityAmounts(0);
        return;
    }
    if (cfg.uiTick1 === T_SFB && amount1 > Math.max(0, cfg.bal1 - feeBuffer)) {
        if (typeof window.showNotification === 'function')
            window.showNotification('Reserved 0.05 FB for fees', 'info', 2200);
        el1.value = Math.max(0, cfg.bal1 - feeBuffer).toFixed(8);
        syncLiquidityAmounts(1);
        return;
    }

    if (amount0 > (cfg.bal0 || 0) || amount1 > (cfg.bal1 || 0)) {
        try {
            document.getElementById('depositLinkModal').classList.remove('hidden');
        } catch (_) {}
        return;
    }

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = 'PREPARING…';

    try {
        if (!window.userPubkey)
            try {
                window.userPubkey = await window.unisat.getPublicKey();
            } catch (_) {}

        const ts = Math.floor(Date.now() / 1000);
        const expectedLp = computeExpectedLp(amount0, amount1, cfg.reserve0, cfg.reserve1, cfg.poolLp || 0);
        const lpStr = __normalizeAmountStr(expectedLp || 0, 8);
        if (!lpStr || Number(lpStr) <= 0) {
            throw new Error('Invalid LP amount');
        }

        const apiAmounts = cfg.mapUiToApiAmounts(amount0, amount1);
        const amount0Str = __normalizeAmountStr(apiAmounts.amount0, 8);
        const amount1Str = __normalizeAmountStr(apiAmounts.amount1, 8);
        if (!amount0Str || !amount1Str || Number(amount0Str) <= 0 || Number(amount1Str) <= 0) {
            throw new Error('Invalid amount');
        }

        const feeTick = T_SFB;
        const payType = 'tick';

        const preUrl =
            `${BACKEND_URL}?action=pre_add_liq` +
            `&address=${encodeURIComponent(window.userAddress)}` +
            `&tick0=${encodeURIComponent(cfg.apiTick0)}` +
            `&tick1=${encodeURIComponent(cfg.apiTick1)}` +
            `&amount0=${encodeURIComponent(amount0Str)}` +
            `&amount1=${encodeURIComponent(amount1Str)}` +
            `&lp=${encodeURIComponent(lpStr)}` +
            `&slippage=${encodeURIComponent('0.05')}` +
            `&ts=${encodeURIComponent(ts)}` +
            `&feeTick=${encodeURIComponent(feeTick)}` +
            `&payType=${encodeURIComponent(payType)}`;
        const pre = await fetch(preUrl, {
            headers: {
                'x-public-key': window.userPubkey,
                'x-address': window.userAddress
            },
            cache: 'no-store'
        }).then(r => r.json());
        if (!pre || pre.code !== 0 || !pre.data) throw new Error(pre?.msg || pre?.error || 'pre_add_liq failed');

        const signMsgs = Array.isArray(pre.data.signMsgs)
            ? pre.data.signMsgs
            : pre.data.signMsg
              ? [pre.data.signMsg]
              : pre.data.sign_msg
                ? [pre.data.sign_msg]
                : pre.data.msg
                  ? [pre.data.msg]
                  : [];
        const msgsToSign = signMsgs
            .map(m => (typeof m === 'object' ? (m.text ?? m.msg ?? m.message ?? m.signMsg ?? m.sign_msg ?? m.id) : m))
            .map(m => (m === null || m === undefined ? '' : String(m)))
            .filter(m => m.length > 0);
        if (!msgsToSign.length) throw new Error('pre_add_liq returned empty signMsgs');

        const feeAmount = String(pre.data.feeAmount || pre.data.fee_amount || '').trim();
        const feeTickPrice = String(pre.data.feeTickPrice || pre.data.fee_tick_price || '').trim();
        if (!feeAmount || !feeTickPrice) throw new Error('pre_add_liq returned empty feeAmount/feeTickPrice');

        const sigs = [];
        for (let i = 0; i < msgsToSign.length; i += 1) {
            btn.innerText = `SIGNING (${i + 1}/${msgsToSign.length})…`;
            await new Promise(r => setTimeout(r, 250));
            const sig = await window.unisat.signMessage(msgsToSign[i], 'bip322-simple');
            sigs.push(sig);
        }

        btn.innerText = 'SUBMITTING…';
        const body = {
            address: window.userAddress,
            tick0: cfg.apiTick0,
            tick1: cfg.apiTick1,
            amount0: amount0Str,
            amount1: amount1Str,
            lp: lpStr,
            slippage: '0.05',
            ts,
            feeTick,
            feeAmount,
            feeTickPrice,
            sigs,
            payType,
            rememberPayType: false
        };

        const sub = await fetch(`${BACKEND_URL}?action=add_liq`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': window.userPubkey,
                'x-address': window.userAddress
            },
            body: JSON.stringify(body)
        }).then(r => r.json());

        if (!sub || sub.code !== 0) throw new Error(sub?.msg || sub?.error || 'add_liq failed');

        if (typeof window.showSuccess === 'function')
            window.showSuccess(`Liquidity supplied! ID: ${sub.data?.id || 'OK'}`);
        if (typeof window.showNotification === 'function')
            window.showNotification('Liquidity supplied successfully', 'success', 3200);
        setTimeout(() => {
            try {
                if (typeof window.checkBalance === 'function') window.checkBalance();
            } catch (_) {}
        }, 2000);
    } catch (e) {
        console.error('Add liquidity error:', e);
        if (typeof window.showNotification === 'function')
            window.showNotification(e?.message || String(e), 'error', 4500);
        try {
            document.getElementById('errorMsg').innerText = e?.message || String(e);
            document.getElementById('errorModal').classList.remove('hidden');
        } catch (_) {}
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

export async function copyLiquidityPairForSearch() {
    const cfg = getLiquidityConfig();
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(cfg.label);
        }
    } catch (_) {}
}

export function installLiquidityUiGlobals(target = window) {
    try {
        __ensureDefaults();
    } catch (_) {}

    const api = {
        __normalizeAmountStr,
        computeExpectedLp,
        getBalanceForTick,
        getLiquidityConfig,
        updateLiquidityBalancesUI,
        syncLiquidityAmounts,
        setMaxLiqAmount,
        switchLiquidityTab,
        closeAddLiquidityModal,
        openAddLiquidityModal,
        openRemoveLiquidityModal,
        closeRemoveLiquidityModal,
        fetchMyLiquiditySummary,
        refreshMyLiquidityForSelectedPair,
        setMaxRemoveLp,
        updateRemoveLiquidityEstimate,
        doAddLiquidity,
        doRemoveLiquidity,
        loadLiquidityPoolData,
        selectLiquidityPair,
        copyLiquidityPairForSearch
    };

    for (const k of Object.keys(api)) {
        try {
            target[k] = api[k];
        } catch (_) {}
    }

    return api;
}

installLiquidityUiGlobals();
