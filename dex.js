export async function handleDexAction(ctx) {
    const {
        action,
        url,
        request,
        sendJSON,
        requireUniSatKey,
        DEFAULT_FEE_TICK,
        SWAP_BASE,
        FRACTAL_BASE,
        upstreamHeaders,
        unisatApiHeaders,
        __normalizeSwapTick,
        smartFetch,
        API_KEY,
        ctx: workerCtx
    } = ctx || {};

    if (!action) return null;

    const swapBase = String(SWAP_BASE || 'https://open-api-fractal.unisat.io/v1').trim();
    const fractalBase = String(FRACTAL_BASE || 'https://open-api-fractal.unisat.io/v1').trim();
    const upstream = upstreamHeaders && typeof upstreamHeaders === 'object' ? upstreamHeaders : {};
    const uniHeaders = unisatApiHeaders && typeof unisatApiHeaders === 'object' ? unisatApiHeaders : upstream;
    const normalizeTick = typeof __normalizeSwapTick === 'function' ? __normalizeSwapTick : t => String(t || '').trim();
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

    const ensureUniKey = () => {
        if (typeof requireUniSatKey === 'function') return requireUniSatKey();
        throw new Error('UNISAT_API_KEY is not configured on the server.');
    };

    if (action === 'pre_add_liq') {
        try {
            ensureUniKey();
            const proxyParams = new URLSearchParams(url.searchParams);
            proxyParams.delete('action');
            proxyParams.delete('rememberPayType');

            if (!proxyParams.has('feeTick')) proxyParams.set('feeTick', DEFAULT_FEE_TICK);
            if (!proxyParams.has('payType')) proxyParams.set('payType', 'tick');

            let endpointUrl = `${swapBase}/brc20-swap/pre_add_liq?${proxyParams.toString()}`;
            let response = await fetch(endpointUrl, {
                headers: uniHeaders
            });
            if (!response.ok && response.status === 404) {
                endpointUrl = `${swapBase}/indexer/brc20-swap/pre_add_liq?${proxyParams.toString()}`;
                response = await fetch(endpointUrl, { headers: uniHeaders });
            }
            return sendJSON(await response.json(), response.status);
        } catch (e) {
            return sendJSON({ code: -1, msg: e?.message || String(e) }, 500);
        }
    }

    if (action === 'add_liq') {
        try {
            ensureUniKey();
            const body = await request.json();

            if (body && typeof body === 'object') {
                if (!('feeTick' in body)) body.feeTick = DEFAULT_FEE_TICK;
                if (!('payType' in body)) body.payType = 'tick';
                if ('rememberPayType' in body) delete body.rememberPayType;
            }

            const headers = {
                ...uniHeaders,
                'Content-Type': 'application/json'
            };

            let endpointUrl = `${swapBase}/brc20-swap/add_liq`;
            let response = await fetch(endpointUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            if (!response.ok && response.status === 404) {
                endpointUrl = `${swapBase}/indexer/brc20-swap/add_liq`;
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
            ensureUniKey();
            const proxyParams = new URLSearchParams(url.searchParams);
            proxyParams.delete('action');
            proxyParams.delete('rememberPayType');

            let endpointUrl = `${swapBase}/brc20-swap/quote_remove_liq?${proxyParams.toString()}`;
            let response = await fetch(endpointUrl, {
                headers: uniHeaders
            });
            if (!response.ok && response.status === 404) {
                endpointUrl = `${swapBase}/indexer/brc20-swap/quote_remove_liq?${proxyParams.toString()}`;
                response = await fetch(endpointUrl, { headers: uniHeaders });
            }
            return sendJSON(await response.json(), response.status);
        } catch (e) {
            return sendJSON({ code: -1, msg: e?.message || String(e) }, 500);
        }
    }

    if (action === 'pre_remove_liq') {
        try {
            ensureUniKey();
            const proxyParams = new URLSearchParams(url.searchParams);
            proxyParams.delete('action');
            proxyParams.delete('rememberPayType');

            if (!proxyParams.has('feeTick')) proxyParams.set('feeTick', DEFAULT_FEE_TICK);
            if (!proxyParams.has('payType')) proxyParams.set('payType', 'tick');

            let endpointUrl = `${swapBase}/brc20-swap/pre_remove_liq?${proxyParams.toString()}`;
            let response = await fetch(endpointUrl, {
                headers: uniHeaders
            });
            if (!response.ok && response.status === 404) {
                endpointUrl = `${swapBase}/indexer/brc20-swap/pre_remove_liq?${proxyParams.toString()}`;
                response = await fetch(endpointUrl, { headers: uniHeaders });
            }
            return sendJSON(await response.json(), response.status);
        } catch (e) {
            return sendJSON({ code: -1, msg: e?.message || String(e) }, 500);
        }
    }

    if (action === 'remove_liq') {
        try {
            ensureUniKey();
            const body = await request.json();

            if (body && typeof body === 'object') {
                if (!('feeTick' in body)) body.feeTick = DEFAULT_FEE_TICK;
                if (!('payType' in body)) body.payType = 'tick';
                if ('rememberPayType' in body) delete body.rememberPayType;
            }

            const headers = {
                ...uniHeaders,
                'Content-Type': 'application/json'
            };

            let endpointUrl = `${swapBase}/brc20-swap/remove_liq`;
            let response = await fetch(endpointUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            if (!response.ok && response.status === 404) {
                endpointUrl = `${swapBase}/indexer/brc20-swap/remove_liq`;
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
            const endpoint = `${fractalBase}/indexer/address/${encodeURIComponent(address)}/brc20/${encodeURIComponent(
                tick
            )}/info`;
            const res = await fetch(endpoint, {
                headers: upstream
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
        const limit = Math.min(1000, Math.max(1, parseInt(String(url.searchParams.get('limit') || '16'), 10) || 16));
        if (!address || !tick) return sendJSON({ error: 'Missing address or tick' }, 400);
        if (!API_KEY) return sendJSON({ error: 'UNISAT_API_KEY required' }, 403);
        try {
            const endpoint =
                `${fractalBase}/indexer/address/${encodeURIComponent(address)}/brc20/` +
                `${encodeURIComponent(tick)}/transferable-inscriptions?start=${start}&limit=${limit}`;
            const res = await fetch(endpoint, { headers: upstream });
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
        const tickIn = normalizeTick(url.searchParams.get('tickIn'));
        const tickOut = normalizeTick(url.searchParams.get('tickOut'));
        const exactType = String(url.searchParams.get('exactType') || 'exactIn');
        const amountRaw = String(url.searchParams.get('amount') || '').trim();
        if (!tickIn || !tickOut || !amountRaw) {
            return sendJSON({ code: -1, msg: 'Missing or invalid params' }, 200);
        }

        const __DECIMALS = 8;
        const __UNIT = 100000000n;
        const __toBigIntAmount = value => {
            const raw = String(value || '').trim();
            if (!raw) return 0n;
            if (/[eE]/.test(raw)) {
                try {
                    return __toBigIntAmount(Number(raw).toFixed(__DECIMALS));
                } catch (_) {
                    return 0n;
                }
            }
            const cleaned = raw.replace(/,/g, '');
            const parts = cleaned.split('.');
            const whole = (parts[0] || '').replace(/\D/g, '') || '0';
            const frac = (parts[1] || '').replace(/\D/g, '');
            const fracPadded = (frac + '0'.repeat(__DECIMALS)).slice(0, __DECIMALS) || '0';
            return BigInt(whole) * __UNIT + BigInt(fracPadded);
        };
        const __formatAmount = value => {
            const v = typeof value === 'bigint' ? value : BigInt(value || 0);
            if (v <= 0n) return '0';
            const whole = v / __UNIT;
            const frac = v % __UNIT;
            if (frac === 0n) return whole.toString();
            const fracStr = frac.toString().padStart(__DECIMALS, '0').replace(/0+$/g, '');
            return `${whole.toString()}.${fracStr}`;
        };
        const __divUp = (a, b) => {
            if (b <= 0n) return 0n;
            return (a + b - 1n) / b;
        };
        const amountBase = __toBigIntAmount(amountRaw);
        if (amountBase <= 0n) {
            return sendJSON({ code: -1, msg: 'Missing or invalid params' }, 200);
        }

        const __extractReserves = d => {
            if (!d || typeof d !== 'object') return null;
            const t0 = normalizeTick(d.tick0);
            const t1 = normalizeTick(d.tick1);
            const r0 = __toBigIntAmount(d.amount0 ?? d.reserve0 ?? d.r0 ?? d.liq0);
            const r1 = __toBigIntAmount(d.amount1 ?? d.reserve1 ?? d.r1 ?? d.liq1);
            if (!t0 || !t1 || r0 <= 0n || r1 <= 0n) return null;
            return { t0, t1, r0, r1 };
        };

        try {
            const query = `?tick0=${encodeURIComponent(tickIn)}&tick1=${encodeURIComponent(tickOut)}`;
            let poolUrl = `${swapBase}/brc20-swap/pool_info${query}`;
            let res = await fetch(poolUrl, {
                headers: upstream
            });
            if (!res.ok && res.status === 404) {
                poolUrl = `${swapBase}/indexer/brc20-swap/pool_info${query}`;
                res = await fetch(poolUrl, {
                    headers: upstream
                });
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

            let rIn = 0n;
            let rOut = 0n;
            if (tickIn === r.t0 && tickOut === r.t1) {
                rIn = r.r0;
                rOut = r.r1;
            } else if (tickIn === r.t1 && tickOut === r.t0) {
                rIn = r.r1;
                rOut = r.r0;
            } else {
                return sendJSON({ code: -1, msg: 'Pool does not match requested pair' }, 200);
            }

            const feeMul = 985n;
            const feeDiv = 1000n;

            if (exactType === 'exactOut') {
                const desiredOut = amountBase;
                if (desiredOut >= rOut) return sendJSON({ code: -1, msg: 'Insufficient liquidity' }, 200);
                const numerator = desiredOut * rIn * feeDiv;
                const denominator = (rOut - desiredOut) * feeMul;
                if (denominator <= 0n) return sendJSON({ code: -1, msg: 'Invalid quote' }, 200);
                const needIn = __divUp(numerator, denominator);
                return sendJSON({
                    code: 0,
                    msg: 'OK',
                    data: {
                        expect: __formatAmount(needIn),
                        amountIn: __formatAmount(needIn),
                        amountOut: __formatAmount(desiredOut)
                    }
                });
            }

            const amountIn = amountBase;
            const feeIn = amountIn * feeMul;
            const amountOut = (feeIn * rOut) / (rIn * feeDiv + feeIn);
            return sendJSON({
                code: 0,
                msg: 'OK',
                data: {
                    expect: __formatAmount(amountOut),
                    amountIn: __formatAmount(amountIn),
                    amountOut: __formatAmount(amountOut)
                }
            });
        } catch (e) {
            return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
        }
    }

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
        if (action === 'swap_history') {
            try {
                const cache = caches.default;
                const cacheKeyUrl = new URL(request.url);
                cacheKeyUrl.searchParams.delete('action');
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
                let endpointUrl = `${swapBase}/brc20-swap/${endpoint}?${proxyParams.toString()}`;
                let response = await fetch(endpointUrl, {
                    method: 'GET',
                    headers: upstream
                });
                if (!response.ok && response.status === 404) {
                    endpointUrl = `${swapBase}/indexer/brc20-swap/${endpoint}?${proxyParams.toString()}`;
                    response = await fetch(endpointUrl, {
                        method: 'GET',
                        headers: upstream
                    });
                }
                const json = await response.json();
                const out = sendJSON(json, response.status);
                out.headers.set('Cache-Control', 's-maxage=60, max-age=30');
                if (workerCtx?.waitUntil) workerCtx.waitUntil(cache.put(swapCacheKey, out.clone()));
                else await cache.put(swapCacheKey, out.clone());
                return out;
            } catch (_) {
                void _;
            }
        }
        const proxyParams = new URLSearchParams(url.searchParams);
        proxyParams.delete('action');

        const __maybeNormalizeParam = name => {
            if (!proxyParams.has(name)) return;
            proxyParams.set(name, normalizeTick(proxyParams.get(name)));
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

        let endpointUrl = `${swapBase}/brc20-swap/${endpoint}?${proxyParams.toString()}`;
        let response = await fetch(endpointUrl, {
            method: 'GET',
            headers: upstream
        });
        if (!response.ok && response.status === 404) {
            endpointUrl = `${swapBase}/indexer/brc20-swap/${endpoint}?${proxyParams.toString()}`;
            response = await fetch(endpointUrl, {
                method: 'GET',
                headers: upstream
            });
        }
        return sendJSON(await response.json(), response.status);
    }

    if (['submit_swap', 'confirm_deposit', 'confirm_withdraw'].includes(action)) {
        const body = await request.json();
        let endpoint = action;
        if (action === 'submit_swap') endpoint = 'swap';
        const isBrc20DepositConfirm =
            action === 'confirm_deposit' && body && typeof body === 'object' && 'inscriptionId' in body;
        const isSwapSubmit = action === 'submit_swap';
        if (isSwapSubmit || isBrc20DepositConfirm) {
            let endpointUrl = `${swapBase}/brc20-swap/${endpoint}`;
            let response = await fetch(endpointUrl, {
                method: 'POST',
                headers: upstream,
                body: JSON.stringify(body)
            });
            if (!response.ok && response.status === 404) {
                endpointUrl = `${swapBase}/indexer/brc20-swap/${endpoint}`;
                response = await fetch(endpointUrl, {
                    method: 'POST',
                    headers: upstream,
                    body: JSON.stringify(body)
                });
            }
            return sendJSON(await response.json(), response.status);
        }

        let endpointUrl = `${swapBase}/brc20-swap/${endpoint}`;
        let response = await fetch(endpointUrl, {
            method: 'POST',
            headers: upstream,
            body: JSON.stringify(body)
        });
        if (!response.ok && response.status === 404) {
            endpointUrl = `${swapBase}/indexer/brc20-swap/${endpoint}`;
            response = await fetch(endpointUrl, {
                method: 'POST',
                headers: upstream,
                body: JSON.stringify(body)
            });
        }
        return sendJSON(await response.json(), response.status);
    }

    if (action === 'balance_batch') {
        const address = url.searchParams.get('address');
        const ticks = url.searchParams.get('ticks')?.split(',') || [];
        const walletOnly = url.searchParams.get('walletOnly') === 'true';

        if (!address || ticks.length === 0) {
            return sendJSON({ error: 'Missing address or ticks' }, 200);
        }

        const balancePromises = ticks.map(async tick => {
            if (walletOnly) {
                return fetch(`${fractalBase}/indexer/address/${address}/brc20/${tick}/info`, {
                    headers: upstream
                })
                    .then(r => r.json())
                    .then(data => ({ tick, data }))
                    .catch(e => ({ tick, error: e.message }));
            }
            let balanceUrl = `${swapBase}/brc20-swap/balance?address=${address}&tick=${tick}`;
            let balanceRes = await fetch(balanceUrl, {
                headers: upstream
            });

            if (!balanceRes.ok && balanceRes.status === 404) {
                balanceUrl = `${swapBase}/indexer/brc20-swap/balance?address=${address}&tick=${tick}`;
                balanceRes = await fetch(balanceUrl, {
                    headers: upstream
                });
            }

            try {
                const data = await balanceRes.json();
                return { tick, data };
            } catch (e) {
                return { tick, error: e.message };
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
                const result = await smartFetchFn(`${fractalBase}/indexer/address/${address}/brc20/${tick}/info`);
                if (!result || result.code !== 0) {
                    return sendJSON({ error: `API error: ${result?.msg || 'Unknown error'}` }, 500);
                }
                return sendJSON(result);
            } catch (e) {
                return sendJSON({ error: `Fetch error: ${e.message}` }, 500);
            }
        }
        try {
            let balanceUrl = `${swapBase}/brc20-swap/balance?address=${address}&tick=${tick}`;
            let res = await fetch(balanceUrl, { headers: upstream });
            if (!res.ok && res.status === 404) {
                balanceUrl = `${swapBase}/indexer/brc20-swap/balance?address=${address}&tick=${tick}`;
                res = await fetch(balanceUrl, { headers: upstream });
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

    if (action === 'history') {
        const address = url.searchParams.get('address');
        const tick = url.searchParams.get('tick');

        if (!address) return sendJSON({ code: -1, msg: 'No address' }, 400);

        let targetUrl;
        if (tick && tick !== 'FB') {
            targetUrl = `${fractalBase}/indexer/address/${address}/brc20/${tick}/history?type=transfer&start=0&limit=10`;
        } else {
            targetUrl = `${fractalBase}/indexer/address/${address}/history?cursor=0&size=10`;
        }

        const result = await smartFetchFn(targetUrl).catch(() => null);
        if (!result || result.code !== 0) {
            return sendJSON({ code: 0, data: { list: [] } }, 200);
        }
        return sendJSON(result, 200);
    }

    if (action === 'full_utxo_data') {
        const address = url.searchParams.get('address');
        const cursor = url.searchParams.get('cursor') || '0';
        const size = url.searchParams.get('size') || '50';

        if (!address) return sendJSON({ error: 'Missing address' }, 200);

        const endpoint = `${fractalBase}/indexer/address/${address}/utxo-data?cursor=${cursor}&size=${size}`;
        const result = await smartFetchFn(endpoint).catch(() => null);

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

    return null;
}
