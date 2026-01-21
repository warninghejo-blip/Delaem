import { saveAuditAnalytics } from './database.js';

export async function handleAuditAction(ctx) {
    const {
        action,
        url,
        sendJSON,
        smartFetch,
        upstreamHeaders,
        SWAP_BASE,
        __disableInswap,
        request,
        env,
        ctx: workerCtx
    } = ctx || {};
    if (action !== 'audit_data' && action !== 'fractal_audit') return null;

    const address = url?.searchParams?.get('address');
    if (!address) return sendJSON({ error: 'Address required' }, 400);

    const response = {
        address,
        audit_time: new Date().toISOString(),
        stages: { tx_count: 'pending', history: 'pending', wealth: 'pending', collections: 'pending' }
    };

    let kvFennecId = null;
    try {
        if (env?.FENNEC_DB) {
            const addrKey = String(address || '')
                .trim()
                .toLowerCase();
            const key = `fennec_id_v3:${addrKey}`;
            const raw = await env.FENNEC_DB.get(key);
            if (raw) {
                let parsed = null;
                try {
                    parsed = JSON.parse(raw);
                } catch (_) {
                    parsed = null;
                }
                const inscriptionId = String(parsed?.inscriptionId || parsed?.inscription_id || '').trim();
                const updatedAt = Number(parsed?.updatedAt || 0) || 0;
                if (inscriptionId) {
                    kvFennecId = { inscriptionId, updatedAt };
                }
            }
        }
    } catch (_) {}
    if (kvFennecId) {
        response.fennec_id = kvFennecId;
        response.has_fennec_id = true;
    }

    const smartFetchFn =
        typeof smartFetch === 'function'
            ? smartFetch
            : async inputUrl => {
                  try {
                      const res = await fetch(inputUrl);
                      return await res.json().catch(() => null);
                  } catch (_) {
                      return null;
                  }
              };

    const swapBase = String(SWAP_BASE || 'https://open-api-fractal.unisat.io/v1').trim();
    const headers = upstreamHeaders && typeof upstreamHeaders === 'object' ? upstreamHeaders : {};
    const disableInswap = !!__disableInswap;

    const fetchMempoolStats = async addr => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        try {
            const res = await fetch(`https://mempool.fractalbitcoin.io/api/address/${addr}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    Accept: 'application/json'
                },
                signal: controller.signal
            });
            if (!res || !res.ok) return null;
            return await res.json().catch(() => null);
        } catch (_) {
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const fetchSwapJson = async pathWithQuery => {
        const endpoints = [
            `${swapBase}/brc20-swap/${pathWithQuery}`,
            `${swapBase}/indexer/brc20-swap/${pathWithQuery}`
        ];
        for (const endpoint of endpoints) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            try {
                const res = await fetch(endpoint, {
                    headers,
                    signal: controller.signal
                });
                if (!res) continue;
                if (!res.ok) {
                    if (res.status === 404) continue;
                    return null;
                }
                return await res.json().catch(() => null);
            } catch (_) {
                void _;
            } finally {
                clearTimeout(timeoutId);
            }
        }
        return null;
    };

    try {
        let __mempoolStats = null;

        // STAGE A: TX COUNT & WALLET AGE
        // 1. Mempool first (source of truth for blockchain physics)
        let tx_count = 0;
        let mempoolOk = false;
        try {
            const mempoolStats = await fetchMempoolStats(address);
            if (mempoolStats) {
                __mempoolStats = mempoolStats;
                mempoolOk = true;
                const chain = mempoolStats.chain_stats || {};
                const mem = mempoolStats.mempool_stats || {};
                tx_count = Number(chain.tx_count || 0) + Number(mem.tx_count || 0) || 0;
            }
        } catch (_) {}

        // 2. Fallback: UniSat Summary (smartFetch: Free → Paid)
        if (!mempoolOk) {
            const summary = await smartFetchFn(
                `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/summary`
            ).catch(() => null);
            if (summary?.data?.txCount !== undefined) {
                tx_count = Number(summary.data.txCount || 0) || 0;
            }
        }
        response.tx_count = tx_count;
        response.stages.tx_count = 'done';

        // 2. Genesis Transaction Timestamp (Simple "Total - 1" Logic)
        response.first_tx_ts = 0;
        if (tx_count > 0) {
            const offset = tx_count - 1;
            const genesisHistory = await smartFetchFn(
                `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/history?cursor=${offset}&size=1`
            ).catch(() => null);
            const genesisTx = genesisHistory?.data?.detail?.[0];
            if (genesisTx?.timestamp) {
                response.first_tx_ts = Number(genesisTx.timestamp) || 0;
            }
        }
        response.stages.history = 'done';

        await new Promise(r => setTimeout(r, 200));

        // STAGE B: WEALTH (MONEY)
        // Native Balance (Mempool -> UniSat fallback)
        const mempoolStats = __mempoolStats || (await fetchMempoolStats(address)) || {};
        const chain = mempoolStats.chain_stats || {};
        const toBigInt = value => {
            try {
                if (typeof value === 'bigint') return value;
                if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
                const raw = String(value ?? '').trim();
                if (!raw) return 0n;
                if (raw.includes('.')) return BigInt(Math.trunc(Number(raw)));
                return BigInt(raw);
            } catch (_) {
                return 0n;
            }
        };
        const hasMempoolBalance =
            Object.prototype.hasOwnProperty.call(chain, 'funded_txo_sum') ||
            Object.prototype.hasOwnProperty.call(chain, 'spent_txo_sum');
        let native_balance_sats = 0n;
        if (hasMempoolBalance) {
            native_balance_sats = toBigInt(chain.funded_txo_sum) - toBigInt(chain.spent_txo_sum);
            if (native_balance_sats < 0n) native_balance_sats = 0n;
        } else {
            const balanceFallback = await smartFetchFn(
                `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/balance`
            ).catch(() => null);
            const balData = balanceFallback?.data || {};
            const balValue =
                balData.balance ??
                balData.availableBalance ??
                balData.total ??
                balData.satoshi ??
                balData.sats ??
                balData.amount ??
                0;
            native_balance_sats = toBigInt(balValue);
        }
        response.native_balance = Number(native_balance_sats) / 1e8 || 0;

        // InSwap Balance + Liquidity (restore old logic)
        let inswap_fb_balance = 0;
        let inswap_fennec_balance = 0;
        let inswap_fb_wallet_balance = 0;
        let inswap_fennec_wallet_balance = 0;
        let inswap_fennec_wallet_value_usd = 0;
        let inswap_fennec_wallet_price_usd = 0;
        let inswap_fb_lp_balance = 0;
        let inswap_fennec_lp_balance = 0;
        let inswap_fb_lp_balance_fennec_pair = 0;
        let inswap_fennec_lp_balance_fennec_pair = 0;
        let inswap_lp_total_usd = 0;
        let inswap_lp_total_source = '';
        const inswapTokenBalances = new Map();
        const normalizeTicker = ticker => String(ticker || '').trim();
        const isIgnoredBalanceKey = ticker => {
            const upper = normalizeTicker(ticker).toUpperCase();
            return (
                !upper ||
                upper === 'TOTAL' ||
                upper === 'TOTAL_VALUE' ||
                upper === 'TOTAL_VALUE_USD' ||
                upper === 'TOTALVALUE' ||
                upper === 'TOTALVALUEUSD' ||
                upper === 'TOTAL_USD' ||
                upper === 'VALUE_USD' ||
                upper === 'CODE' ||
                upper === 'MSG' ||
                upper === 'SUCCESS'
            );
        };
        const isFbTicker = ticker => {
            const upper = normalizeTicker(ticker).toUpperCase();
            return upper === 'SFB___000' || upper === 'SFB' || upper === 'FB';
        };
        const getNumeric = value => {
            const num = Number(value);
            return Number.isFinite(num) ? num : 0;
        };
        const readBalanceValue = raw => {
            if (raw === null || raw === undefined) return 0;
            if (typeof raw === 'number' || typeof raw === 'string') return getNumeric(raw);
            if (typeof raw !== 'object') return 0;
            const priorityKeys = [
                'totalBalance',
                'total',
                'overallBalance',
                'availableBalance',
                'available',
                'balance'
            ];
            for (const key of priorityKeys) {
                const val = getNumeric(raw[key]);
                if (val > 0) return val;
            }
            const sumKeys = ['swap', 'module', 'pendingSwap', 'pendingAvailable'];
            let sum = 0;
            for (const key of sumKeys) sum += getNumeric(raw[key]);
            return sum;
        };
        const addInswapBalance = (ticker, balanceRaw, valueUsdRaw, priceUsdRaw) => {
            if (isIgnoredBalanceKey(ticker)) return;
            const cleanTicker = normalizeTicker(ticker);
            if (!cleanTicker) return;
            const balance = getNumeric(balanceRaw || 0);
            if (!Number.isFinite(balance) || balance <= 0) return;
            const valueUsd = getNumeric(valueUsdRaw || 0);
            let priceUsd = getNumeric(priceUsdRaw || 0);
            if (priceUsd <= 0 && valueUsd > 0 && balance > 0) priceUsd = valueUsd / balance;
            if (isFbTicker(cleanTicker)) {
                inswap_fb_wallet_balance += balance;
                return;
            }
            const upper = cleanTicker.toUpperCase();
            if (upper === 'FENNEC') {
                inswap_fennec_wallet_balance += balance;
                if (valueUsd > 0) inswap_fennec_wallet_value_usd += valueUsd;
                if (priceUsd > 0) inswap_fennec_wallet_price_usd = priceUsd;
                return;
            }
            const prev = inswapTokenBalances.get(upper) || { balance: 0, value_usd: 0, price_usd: 0 };
            const nextBalance = prev.balance + balance;
            const nextValue = prev.value_usd + (valueUsd > 0 ? valueUsd : 0);
            const nextPrice = priceUsd > 0 ? priceUsd : prev.price_usd;
            inswapTokenBalances.set(upper, {
                balance: nextBalance,
                value_usd: nextValue,
                price_usd: nextPrice
            });
        };
        try {
            if (!disableInswap) {
                const addressSafe = encodeURIComponent(address);
                let balanceData = await fetchSwapJson(`all_balance?address=${addressSafe}`);
                if (!balanceData?.data || typeof balanceData.data !== 'object') {
                    balanceData = await fetchSwapJson(`address/${addressSafe}/balance`);
                }
                const liquidityData = await fetchSwapJson(`address/${encodeURIComponent(address)}/liquidity`);
                const readLpTotalUsd = data => {
                    if (!data || typeof data !== 'object') return 0;
                    const val =
                        data.totalLpUSD ?? data.totalLpUsd ?? data.total_usd ?? data.totalUsd ?? data.totalUSD ?? 0;
                    const num = Number(val || 0);
                    return Number.isFinite(num) ? num : 0;
                };
                let poolListData = null;
                let liquidityList = Array.isArray(liquidityData?.data?.list) ? liquidityData.data.list : [];
                inswap_lp_total_usd = readLpTotalUsd(liquidityData?.data);
                if (inswap_lp_total_usd > 0) inswap_lp_total_source = 'liquidity';
                if (!liquidityList.length) {
                    poolListData = await fetchSwapJson(
                        `my_pool_list?address=${encodeURIComponent(address)}&start=0&limit=100`
                    );
                    liquidityList = Array.isArray(poolListData?.data?.list) ? poolListData.data.list : [];
                }
                if (!(inswap_lp_total_usd > 0)) {
                    if (!poolListData) {
                        poolListData = await fetchSwapJson(
                            `my_pool_list?address=${encodeURIComponent(address)}&start=0&limit=100`
                        );
                    }
                    inswap_lp_total_usd = readLpTotalUsd(poolListData?.data || poolListData);
                    if (inswap_lp_total_usd > 0) inswap_lp_total_source = 'my_pool_list';
                }

                // Sum FB/tokens from balance
                if (balanceData?.data) {
                    const dataObj = balanceData.data;
                    const tokenObject =
                        dataObj && typeof dataObj.tokens === 'object'
                            ? dataObj.tokens
                            : dataObj && typeof dataObj.all_balance === 'object'
                              ? dataObj.all_balance
                              : dataObj && typeof dataObj.allBalance === 'object'
                                ? dataObj.allBalance
                                : null;
                    if (tokenObject && !Array.isArray(tokenObject)) {
                        for (const [ticker, value] of Object.entries(tokenObject)) {
                            if (value && typeof value === 'object') {
                                const balance = readBalanceValue(
                                    value.balance ??
                                        value.available ??
                                        value.availableBalance ??
                                        value.overallBalance ??
                                        value.amount ??
                                        value.total ??
                                        value.totalBalance ??
                                        value
                                );
                                const valueUsd =
                                    value.value_usd ??
                                    value.valueUsd ??
                                    value.usdValue ??
                                    value.total_usd ??
                                    value.totalUsd ??
                                    value.value ??
                                    0;
                                const priceUsd =
                                    value.price_usd ?? value.priceUsd ?? value.price ?? value.usdPrice ?? 0;
                                const computedValueUsd =
                                    Number(valueUsd || 0) || (Number(priceUsd || 0) > 0 ? priceUsd * balance : 0);
                                addInswapBalance(ticker, balance, computedValueUsd, priceUsd);
                            } else {
                                const balance = readBalanceValue(value);
                                addInswapBalance(ticker, balance, 0, 0);
                            }
                        }
                    } else {
                        const balanceList = Array.isArray(dataObj.list)
                            ? dataObj.list
                            : Array.isArray(dataObj.detail)
                              ? dataObj.detail
                              : Array.isArray(dataObj)
                                ? dataObj
                                : null;
                        if (balanceList) {
                            for (const item of balanceList) {
                                const ticker = item?.tick || item?.ticker || item?.symbol || item?.token || '';
                                const balance = readBalanceValue(
                                    item?.balance ??
                                        item?.available ??
                                        item?.availableBalance ??
                                        item?.overallBalance ??
                                        item?.amount ??
                                        item?.total ??
                                        item?.totalBalance ??
                                        item
                                );
                                const valueUsd =
                                    item?.value_usd ??
                                    item?.valueUsd ??
                                    item?.usdValue ??
                                    item?.total_usd ??
                                    item?.totalUsd ??
                                    item?.value ??
                                    0;
                                const priceUsd =
                                    item?.price_usd ?? item?.priceUsd ?? item?.price ?? item?.usdPrice ?? 0;
                                const computedValueUsd =
                                    Number(valueUsd || 0) || (Number(priceUsd || 0) > 0 ? priceUsd * balance : 0);
                                addInswapBalance(ticker, balance, computedValueUsd, priceUsd);
                            }
                        } else if (typeof dataObj === 'object') {
                            for (const [ticker, value] of Object.entries(dataObj)) {
                                if (value && typeof value === 'object') {
                                    const balance = readBalanceValue(
                                        value.balance ??
                                            value.available ??
                                            value.availableBalance ??
                                            value.overallBalance ??
                                            value.amount ??
                                            value.total ??
                                            value.totalBalance ??
                                            value
                                    );
                                    const valueUsd =
                                        value.value_usd ??
                                        value.valueUsd ??
                                        value.usdValue ??
                                        value.total_usd ??
                                        value.totalUsd ??
                                        value.value ??
                                        0;
                                    const priceUsd =
                                        value.price_usd ?? value.priceUsd ?? value.price ?? value.usdPrice ?? 0;
                                    const computedValueUsd =
                                        Number(valueUsd || 0) || (Number(priceUsd || 0) > 0 ? priceUsd * balance : 0);
                                    addInswapBalance(ticker, balance, computedValueUsd, priceUsd);
                                } else {
                                    const balance = readBalanceValue(value);
                                    addInswapBalance(ticker, balance, 0, 0);
                                }
                            }
                        }
                    }
                }

                // Sum FB from liquidity positions
                if (liquidityList.length) {
                    for (const lp of liquidityList) {
                        const tick0 = String(lp.tick0 || '');
                        const tick1 = String(lp.tick1 || '');
                        const amount0 = Number(lp.amount0 || 0);
                        const amount1 = Number(lp.amount1 || 0);
                        const isFb0 = tick0 === 'sFB___000' || tick0 === 'sFB';
                        const isFb1 = tick1 === 'sFB___000' || tick1 === 'sFB';
                        const isFennec0 = tick0 === 'FENNEC';
                        const isFennec1 = tick1 === 'FENNEC';

                        if (isFb0) inswap_fb_lp_balance += amount0;
                        if (isFb1) inswap_fb_lp_balance += amount1;
                        if (isFennec0) inswap_fennec_lp_balance += amount0;
                        if (isFennec1) inswap_fennec_lp_balance += amount1;

                        if (isFennec0 || isFennec1) {
                            if (isFennec0) inswap_fennec_lp_balance_fennec_pair += amount0;
                            if (isFennec1) inswap_fennec_lp_balance_fennec_pair += amount1;
                            if (isFb0) inswap_fb_lp_balance_fennec_pair += amount0;
                            if (isFb1) inswap_fb_lp_balance_fennec_pair += amount1;
                        }
                    }
                }
            }

            // Convert sats to BTC if needed
            if (inswap_fb_wallet_balance > 1000000) {
                inswap_fb_wallet_balance = inswap_fb_wallet_balance / 1e8;
            }
            if (inswap_fb_lp_balance > 1000000) {
                inswap_fb_lp_balance = inswap_fb_lp_balance / 1e8;
            }
            if (inswap_fb_lp_balance_fennec_pair > 1000000) {
                inswap_fb_lp_balance_fennec_pair = inswap_fb_lp_balance_fennec_pair / 1e8;
            }

            inswap_fb_balance = inswap_fb_wallet_balance;
            inswap_fennec_balance = inswap_fennec_wallet_balance;
        } catch (_) {}
        response.inswap_fb_balance = inswap_fb_balance;
        response.inswap_fennec_balance = inswap_fennec_balance;
        response.fb_inswap_balance = inswap_fb_balance;
        response.fennec_inswap_balance = inswap_fennec_balance;
        response.inswap_fb_wallet_balance = inswap_fb_wallet_balance;
        response.inswap_fennec_wallet_balance = inswap_fennec_wallet_balance;
        response.inswap_fb_lp_balance = inswap_fb_lp_balance;
        response.inswap_fennec_lp_balance = inswap_fennec_lp_balance;
        response.inswap_lp_total_usd = inswap_lp_total_usd;
        response.has_fennec_in_lp = inswap_fennec_lp_balance_fennec_pair > 0 || inswap_fb_lp_balance_fennec_pair > 0;

        // Keep native_balance as mempool-only; sFB is accounted in BRC20 summary

        // BRC20 Summary with DEDUPLICATION (smartFetch)
        const brc20 = await smartFetchFn(
            `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/brc20/summary?start=0&limit=100`
        ).catch(() => ({ data: { total: 0, detail: [] } }));

        // Use Map to deduplicate tokens by ticker
        const tokenMap = new Map();
        let fennec_wallet_balance = 0;
        const brc20List = brc20.data?.detail || [];
        for (const token of brc20List) {
            const ticker = String(token.ticker || '').toUpperCase();
            if (!ticker) continue;

            const existing = tokenMap.get(ticker);
            const balance = Number(token.overallBalance || token.balance || 0);

            // CRITICAL: Filter out zero-balance tokens
            if (balance <= 0) continue;

            if (!existing || balance > existing.balance) {
                tokenMap.set(ticker, {
                    ticker,
                    balance,
                    price_usd: Number(token.price_usd || 0),
                    value_usd: balance * Number(token.price_usd || 0)
                });
                if (ticker === 'FENNEC') fennec_wallet_balance = balance;
            }
        }

        // Add InSwap FENNEC wallet balance - merge with existing or create new entry
        if (inswap_fennec_wallet_balance > 0) {
            const existing = tokenMap.get('FENNEC');
            if (existing) {
                // Merge: add InSwap balance to existing wallet balance
                existing.balance += inswap_fennec_wallet_balance;
                if (!(existing.price_usd > 0) && inswap_fennec_wallet_price_usd > 0)
                    existing.price_usd = inswap_fennec_wallet_price_usd;
                existing.value_usd = existing.balance * (existing.price_usd || 0);
                existing.source = existing.source ? `${existing.source}+inswap` : 'inswap';
            } else {
                // Create new FENNEC entry from InSwap
                tokenMap.set('FENNEC', {
                    ticker: 'FENNEC',
                    balance: inswap_fennec_wallet_balance,
                    price_usd: inswap_fennec_wallet_price_usd || 0,
                    value_usd:
                        (inswap_fennec_wallet_price_usd || 0) > 0
                            ? inswap_fennec_wallet_balance * inswap_fennec_wallet_price_usd
                            : 0,
                    source: 'inswap'
                });
            }
        }

        // Merge InSwap balances for other tokens
        for (const [ticker, meta] of inswapTokenBalances.entries()) {
            const existing = tokenMap.get(ticker);
            const balance = Number(meta?.balance || 0) || 0;
            const valueUsd = Number(meta?.value_usd || 0) || 0;
            const priceUsd = Number(meta?.price_usd || 0) || 0;
            if (existing) {
                existing.balance += balance;
                if (!(existing.price_usd > 0) && priceUsd > 0) existing.price_usd = priceUsd;
                if (!(existing.value_usd > 0) && valueUsd > 0) existing.value_usd = valueUsd;
                existing.source = existing.source ? `${existing.source}+inswap` : 'inswap';
                if (existing.price_usd > 0) existing.value_usd = existing.balance * existing.price_usd;
            } else {
                tokenMap.set(ticker, {
                    ticker,
                    balance,
                    price_usd: priceUsd || 0,
                    value_usd: priceUsd > 0 ? balance * priceUsd : valueUsd || 0,
                    source: 'inswap'
                });
            }
        }

        // Ensure sFB is represented in the BRC20 summary (fallback to InSwap wallet balance)
        if (inswap_fb_wallet_balance > 0) {
            let sfbKey = '';
            for (const key of tokenMap.keys()) {
                if (isFbTicker(key)) {
                    sfbKey = key;
                    break;
                }
            }
            if (sfbKey) {
                const existing = tokenMap.get(sfbKey);
                if (existing) {
                    const nextBalance = Math.max(Number(existing.balance || 0) || 0, inswap_fb_wallet_balance);
                    existing.balance = nextBalance;
                    existing.source = existing.source ? `${existing.source}+inswap` : 'inswap';
                }
            } else {
                tokenMap.set('SFB', {
                    ticker: 'SFB',
                    balance: inswap_fb_wallet_balance,
                    price_usd: 0,
                    value_usd: 0,
                    source: 'inswap'
                });
            }
        }

        // Ensure FENNEC is always present in the list (even with 0 balance for tracking)
        if (!tokenMap.has('FENNEC')) {
            tokenMap.set('FENNEC', {
                ticker: 'FENNEC',
                balance: 0,
                price_usd: 0,
                value_usd: 0,
                source: 'placeholder'
            });
        }

        response.brc20_summary = { total: tokenMap.size, list: Array.from(tokenMap.values()) };
        response.brc20_count = tokenMap.size;
        response.fennec_wallet_balance = fennec_wallet_balance;
        response.fennec_inswap_balance = inswap_fennec_wallet_balance;
        response.fennec_native_balance = fennec_wallet_balance + inswap_fennec_wallet_balance;
        response.inswap_fb_balance = inswap_fb_wallet_balance;
        response.inswap_fennec_balance = inswap_fennec_wallet_balance;
        response.fb_inswap_balance = inswap_fb_wallet_balance;
        response.fennec_inswap_balance = inswap_fennec_wallet_balance;

        // Runes Balance (smartFetch)
        const runes = await smartFetchFn(
            `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/runes/balance-list?start=0&limit=100`
        ).catch(() => ({ data: { total: 0 } }));
        response.runes_count = runes.data?.total || 0;

        // UTXO Count (smartFetch)
        const utxos = await smartFetchFn(
            `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/inscription-utxo-data?cursor=0&size=20`
        ).catch(() => ({ data: { total: 0 } }));
        response.utxo_count = utxos.data?.total || 0;

        response.stages.wealth = 'done';

        await new Promise(r => setTimeout(r, 200));

        // STAGE C: COLLECTIONS (ORDINALS)
        const colData = await smartFetchFn(
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

        // STAGE D: CALCULATE NETWORTH
        // Get FB price (sBTC/sFB pool) with BTC USD fallback
        let btc_price_usd = 0;
        let fb_price_usd = 0;
        let fennec_price_usd = 0;
        let fb_price_source = '';
        let fennec_price_source = '';
        let fb_price_pool = null;
        let fennec_price_pool = null;

        try {
            const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').catch(
                () => null
            );
            if (binanceRes && binanceRes.ok) {
                const binanceData = await binanceRes.json().catch(() => null);
                btc_price_usd = Number(binanceData?.price || 0) || 0;
            }
        } catch (_) {}

        if (!btc_price_usd) {
            try {
                const mempoolRes = await fetch('https://mempool.space/api/v1/prices').catch(() => null);
                if (mempoolRes && mempoolRes.ok) {
                    const mempoolData = await mempoolRes.json().catch(() => null);
                    btc_price_usd = Number(mempoolData?.USD || 0) || 0;
                }
            } catch (_) {}
        }

        if (!btc_price_usd) {
            try {
                const coingeckoRes = await fetch(
                    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
                ).catch(() => null);
                if (coingeckoRes && coingeckoRes.ok) {
                    const coingeckoData = await coingeckoRes.json().catch(() => null);
                    btc_price_usd = Number(coingeckoData?.bitcoin?.usd || 0) || 0;
                }
            } catch (_) {}
        }

        if (btc_price_usd > 0) {
            try {
                const poolData = await fetchSwapJson('pool_info?tick0=sBTC___000&tick1=sFB___000');
                if (poolData?.code === 0 && poolData?.data) {
                    const isBtcFirst = String(poolData.data.tick0 || '').includes('BTC');
                    const amount0 = Number(poolData.data.amount0 || 0);
                    const amount1 = Number(poolData.data.amount1 || 0);
                    if (isBtcFirst && amount1 > 0) {
                        fb_price_usd = (amount0 / amount1) * btc_price_usd;
                        fb_price_source = 'pool_sbtc_sfb';
                    } else if (!isBtcFirst && amount0 > 0) {
                        fb_price_usd = (amount1 / amount0) * btc_price_usd;
                        fb_price_source = 'pool_sbtc_sfb';
                    }
                    if (fb_price_usd > 0) {
                        fb_price_pool = {
                            tick0: poolData.data.tick0,
                            tick1: poolData.data.tick1,
                            amount0,
                            amount1
                        };
                    }
                }
            } catch (_) {}
        }

        if (!fb_price_usd && btc_price_usd > 0) {
            fb_price_usd = btc_price_usd / 12000;
            fb_price_source = 'fallback_ratio';
        }

        // Get FENNEC price from InSwap pool
        try {
            const poolData = await fetchSwapJson('pool_info?tick0=FENNEC&tick1=sFB___000');
            if (poolData?.code === 0 && poolData?.data) {
                // Calculate FENNEC price: (amount_sFB / amount_FENNEC) * FB_price_usd
                // tick0=FENNEC, tick1=sFB___000, so amount0=FENNEC, amount1=sFB
                const fennecAmount = Number(poolData.data.amount0 || 0);
                const sfbAmount = Number(poolData.data.amount1 || 0);
                if (fennecAmount > 0 && sfbAmount > 0 && fb_price_usd > 0) {
                    const fennec_in_fb = sfbAmount / fennecAmount;
                    fennec_price_usd = fennec_in_fb * fb_price_usd;
                    fennec_price_source = 'pool_fennec_sfb';
                    fennec_price_pool = {
                        tick0: poolData.data.tick0,
                        tick1: poolData.data.tick1,
                        amount0: fennecAmount,
                        amount1: sfbAmount
                    };
                }
            }
        } catch (_) {}

        if (!fennec_price_usd && inswap_fennec_wallet_price_usd > 0) {
            fennec_price_usd = inswap_fennec_wallet_price_usd;
            fennec_price_source = 'inswap_wallet_price';
        } else if (!fennec_price_usd && inswap_fennec_wallet_value_usd > 0 && inswap_fennec_wallet_balance > 0) {
            fennec_price_usd = inswap_fennec_wallet_value_usd / inswap_fennec_wallet_balance;
            fennec_price_source = 'inswap_wallet_value';
        }

        const getPoolPriceInFb = async ticker => {
            const cleanTicker = String(ticker || '').trim();
            if (!cleanTicker) return 0;
            const encoded = encodeURIComponent(cleanTicker);
            const candidatePaths = [
                `pool_info?tick0=${encoded}&tick1=sFB___000`,
                `pool_info?tick0=sFB___000&tick1=${encoded}`,
                `pool_info?tick0=${encoded}&tick1=sFB`,
                `pool_info?tick0=sFB&tick1=${encoded}`
            ];
            for (const path of candidatePaths) {
                const poolData = await fetchSwapJson(path).catch(() => null);
                if (!poolData || poolData.code !== 0 || !poolData.data) continue;
                const tick0 = String(poolData.data.tick0 || '').trim();
                const tick1 = String(poolData.data.tick1 || '').trim();
                const amount0 = Number(poolData.data.amount0 || 0);
                const amount1 = Number(poolData.data.amount1 || 0);
                if (!(amount0 > 0 && amount1 > 0)) continue;
                const tick0IsFb = isFbTicker(tick0);
                const tick1IsFb = isFbTicker(tick1);
                if (tick0IsFb && !tick1IsFb) return amount0 / amount1;
                if (tick1IsFb && !tick0IsFb) return amount1 / amount0;
            }
            return 0;
        };

        const topPoolTickers = new Set();
        const addPoolTicker = ticker => {
            const clean = normalizeTicker(ticker).toUpperCase();
            if (!clean) return;
            topPoolTickers.add(clean);
        };
        try {
            const poolListCandidates = [
                'pool_list?start=0&limit=30',
                'pool_list?start=0&limit=30&sort=volume',
                'pool_list?start=0&limit=30&sort=liquidity',
                'pool_list?start=0&limit=30&order=desc'
            ];
            for (const path of poolListCandidates) {
                const poolData = await fetchSwapJson(path).catch(() => null);
                const poolList = Array.isArray(poolData?.data?.list)
                    ? poolData.data.list
                    : Array.isArray(poolData?.data?.detail)
                      ? poolData.data.detail
                      : Array.isArray(poolData?.data)
                        ? poolData.data
                        : Array.isArray(poolData?.list)
                          ? poolData.list
                          : null;
                if (!poolList || !poolList.length) continue;
                for (const pool of poolList) {
                    addPoolTicker(pool?.tick0 ?? pool?.token0 ?? pool?.ticker0 ?? pool?.symbol0 ?? pool?.tokenA);
                    addPoolTicker(pool?.tick1 ?? pool?.token1 ?? pool?.ticker1 ?? pool?.symbol1 ?? pool?.tokenB);
                    addPoolTicker(pool?.ticker ?? pool?.symbol ?? pool?.tick);
                }
                if (topPoolTickers.size) break;
            }
        } catch (_) {}

        // Calculate total networth
        const fb_holdings_balance = response.native_balance;
        const fb_value = fb_holdings_balance * fb_price_usd;

        const tokenPriceInFb = new Map();
        const tokenList = response.brc20_summary.list || [];
        const tokenTickersForPricing = tokenList
            .map(token => String(token.ticker || '').trim())
            .filter(ticker => ticker && ticker.toUpperCase() !== 'FENNEC' && !isFbTicker(ticker))
            .filter(ticker => !topPoolTickers.size || topPoolTickers.has(ticker.toUpperCase()));
        const uniqueTickers = Array.from(new Set(tokenTickersForPricing));
        if (uniqueTickers.length) {
            const priceResults = await Promise.all(
                uniqueTickers.map(async ticker => [ticker, await getPoolPriceInFb(ticker)])
            );
            for (const [ticker, priceInFb] of priceResults) {
                if (priceInFb > 0) tokenPriceInFb.set(ticker, priceInFb);
            }
        }

        // Calculate token values with FENNEC price and InSwap pool pricing
        let tokens_value = 0;
        for (const token of tokenList) {
            const tokenTicker = String(token.ticker || '').trim();
            const tokenUpper = tokenTicker.toUpperCase();
            if (tokenUpper === 'FENNEC') {
                const fPrice = Number(token.price_usd || 0) || fennec_price_usd;
                token.price_usd = fPrice;
                token.value_usd = token.balance * (fPrice || 0);
                tokens_value += token.value_usd;
                continue;
            }
            if (isFbTicker(tokenUpper)) {
                const fbPrice = Number(fb_price_usd || 0) || 0;
                token.price_usd = fbPrice;
                token.value_usd = token.balance * fbPrice;
                tokens_value += token.value_usd || 0;
                continue;
            }
            if (topPoolTickers.size && !topPoolTickers.has(tokenUpper)) {
                token.price_usd = 0;
                token.value_usd = 0;
                continue;
            }
            const existingPriceUsd = Number(token.price_usd || 0) || 0;
            const priceInFb = tokenPriceInFb.get(tokenTicker) || 0;
            if (!(existingPriceUsd > 0) && priceInFb > 0 && fb_price_usd > 0) {
                token.price_usd = priceInFb * fb_price_usd;
            }
            const finalPriceUsd = Number(token.price_usd || 0) || 0;
            token.value_usd = token.balance * finalPriceUsd;
            tokens_value += token.value_usd || 0;
        }

        response.total_usd = fb_value + tokens_value;
        response.fb_price_usd = fb_price_usd;
        response.fennec_price_usd = fennec_price_usd;
        const fennec_in_fb = fb_price_usd > 0 ? fennec_price_usd / fb_price_usd : 0;
        response.prices = {
            fb_usd: fb_price_usd,
            fennec_usd: fennec_price_usd,
            fennec_in_fb
        };
        const token_price_in_fb = {};
        for (const [ticker, priceInFb] of tokenPriceInFb.entries()) {
            token_price_in_fb[ticker] = priceInFb;
        }
        const lp_value_usd_computed = inswap_fennec_lp_balance * fennec_price_usd + inswap_fb_lp_balance * fb_price_usd;
        const lp_value_usd = inswap_lp_total_usd > 0 ? inswap_lp_total_usd : lp_value_usd_computed;
        const lp_value_fb = inswap_fb_lp_balance + inswap_fennec_lp_balance * fennec_in_fb;
        response.lp_value_usd = lp_value_usd;
        response.lp_value_fb = lp_value_fb;
        response.fennec_lp_value_usd =
            inswap_fennec_lp_balance_fennec_pair * fennec_price_usd + inswap_fb_lp_balance_fennec_pair * fb_price_usd;
        response.all_tokens_value_usd = Math.max(0, response.total_usd);
        response.all_tokens_details = { tokens: response.brc20_summary.list };
        response.pricing_debug = {
            fb_price_usd,
            fb_price_source: fb_price_source || (fb_price_usd > 0 ? 'unknown' : 'none'),
            fb_price_pool,
            fennec_price_usd,
            fennec_price_source: fennec_price_source || (fennec_price_usd > 0 ? 'unknown' : 'none'),
            fennec_price_pool,
            top_pool_tickers: Array.from(topPoolTickers),
            token_pricing_tickers: uniqueTickers,
            token_price_in_fb,
            lp_value_usd_computed,
            lp_value_usd_inswap: inswap_lp_total_usd,
            lp_value_usd_source:
                inswap_lp_total_usd > 0 ? inswap_lp_total_source || 'inswap_totalLpUSD' : 'pool_amounts'
        };

        // Holdings summary for UI
        response.holdings = {
            fb: { balance: fb_holdings_balance, value_usd: fb_value },
            fennec: {
                balance: response.fennec_native_balance,
                value_usd: response.fennec_native_balance * fennec_price_usd
            }
        };
        response.networth = response.total_usd + lp_value_usd;

        // Legacy fields for UI compatibility
        response.data = { ...response };

        try {
            if (action === 'audit_data' && workerCtx && typeof workerCtx.waitUntil === 'function') {
                const ip =
                    String(request?.headers?.get('CF-Connecting-IP') || '').trim() ||
                    String(request?.headers?.get('X-Forwarded-For') || '')
                        .split(',')[0]
                        .trim() ||
                    'unknown';
                const referrer =
                    String(url?.searchParams?.get('ref') || url?.searchParams?.get('referrer') || '') ||
                    String(request?.headers?.get('X-Referrer') || '').trim() ||
                    '';
                workerCtx.waitUntil(saveAuditAnalytics(address, response, ip, referrer, env));
            }
        } catch (_) {}

        return sendJSON({ code: 0, data: response });
    } catch (e) {
        return sendJSON({ error: e.message, stack: e.stack }, 500);
    }
}
