import { getState, setState } from './state.js';
import { BACKEND_URL, T_FENNEC, T_SBTC, T_SFB } from './core.js';

export function switchDir() {
    try {
        const cur = !!getState('isBuying');
        setState('isBuying', !cur);
    } catch (_) {}

    try {
        const inEl = document.getElementById('swapIn');
        const outEl = document.getElementById('swapOut');
        if (inEl) inEl.value = '';
        if (outEl) outEl.value = '';
    } catch (_) {}

    try {
        if (typeof window.updateUI === 'function') window.updateUI();
    } catch (_) {}
}

export function setSwapPair(pair) {
    try {
        setState('currentSwapPair', pair);
        setState('isBuying', true);
    } catch (_) {}

    try {
        const inEl = document.getElementById('swapIn');
        const outEl = document.getElementById('swapOut');
        if (inEl) inEl.value = '';
        if (outEl) outEl.value = '';
    } catch (_) {}

    try {
        const pairFB = document.getElementById('pair-fb-fennec');
        const pairBTC = document.getElementById('pair-btc-fb');
        if (pairFB) {
            pairFB.className =
                pair === 'FB_FENNEC'
                    ? 'flex-1 py-2 text-xs font-bold border border-fennec bg-fennec/10 text-fennec rounded-lg transition'
                    : 'flex-1 py-2 text-xs font-bold border border-white/10 text-gray-500 hover:text-white rounded-lg transition';
        }
        if (pairBTC) {
            pairBTC.className =
                pair === 'BTC_FB'
                    ? 'flex-1 py-2 text-xs font-bold border border-fennec bg-fennec/10 text-fennec rounded-lg transition'
                    : 'flex-1 py-2 text-xs font-bold border border-white/10 text-gray-500 hover:text-white rounded-lg transition';
        }

        const oldPairFB = document.getElementById('swap-pair-fb-fennec');
        const oldPairBTC = document.getElementById('swap-pair-btc-fb');
        if (oldPairFB) {
            oldPairFB.className =
                pair === 'FB_FENNEC'
                    ? 'flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer border-fennec text-fennec bg-fennec/10'
                    : 'flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer border-gray-700 text-gray-500 hover:text-white';
        }
        if (oldPairBTC) {
            oldPairBTC.className =
                pair === 'BTC_FB'
                    ? 'flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer border-fennec text-fennec bg-fennec/10'
                    : 'flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer border-gray-700 text-gray-500 hover:text-white';
        }
    } catch (_) {}

    try {
        const at = window.activeTickers && typeof window.activeTickers === 'object' ? window.activeTickers : null;
        if (at) {
            if (pair === 'FB_FENNEC') {
                at.tick0 = window.T_SFB || 'sFB___000';
                at.tick1 = window.T_FENNEC || 'FENNEC';
            } else if (pair === 'BTC_FB') {
                at.tick0 = window.T_SBTC || 'sBTC___000';
                at.tick1 = window.T_SFB || 'sFB___000';
            }
        }
    } catch (_) {}

    try {
        if (typeof window.updateUI === 'function') window.updateUI();
    } catch (_) {}
    try {
        if (typeof window.fetchReserves === 'function') window.fetchReserves();
    } catch (_) {}

    try {
        if (window.userAddress && typeof window.refreshTransactionHistory === 'function') {
            setTimeout(window.refreshTransactionHistory, 500);
        }
    } catch (_) {}
}

export function setMaxAmount() {
    try {
        if (!getState('userAddress')) {
            if (typeof window.connectWallet === 'function') return window.connectWallet();
            return;
        }
    } catch (_) {}

    let bal = 0;
    try {
        const pair = getState('currentSwapPair');
        const buying = !!getState('isBuying');
        const ub = window.userBalances || {};
        const pr = window.poolReserves || {};

        if (pair === 'FB_FENNEC') {
            bal = buying ? Number(ub.sFB || 0) : Number(ub.FENNEC || 0);
        } else {
            bal = buying ? Number(pr.user_sBTC || 0) : Number(ub.sFB || 0);
        }
    } catch (_) {}

    if (!(bal > 0)) return;

    let feeBuffer = 0;
    try {
        if (getState('currentSwapPair') === 'FB_FENNEC' && getState('isBuying')) feeBuffer = 0.05;
    } catch (_) {}

    const maxAmount = Math.max(0, bal - feeBuffer);
    if (maxAmount <= 0) {
        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Not enough FB after reserving 0.05 for fees', 'warning', 2500);
            }
        } catch (_) {}
        return;
    }

    try {
        const inEl = document.getElementById('swapIn');
        if (inEl) inEl.value = maxAmount.toFixed(8);
    } catch (_) {}

    try {
        if (typeof window.calc === 'function') window.calc();
    } catch (_) {}
}

export async function doSwap() {
    const userAddress = String(getState('userAddress') || window.userAddress || '').trim();
    if (!userAddress) {
        if (typeof window.connectWallet === 'function') return window.connectWallet();
        return;
    }

    try {
        const chain =
            typeof window.unisat?.getChain === 'function'
                ? await window.unisat.getChain()
                : window.unisat?.chain || window.unisat?.network;
        const chainName = typeof chain === 'string' ? chain : String(chain?.enum || chain?.name || '');
        if (chainName !== 'FRACTAL_BITCOIN_MAINNET') {
            throw new Error('Please switch wallet network to FRACTAL_BITCOIN_MAINNET');
        }
    } catch (e) {
        try {
            const msg = String(e?.message || e || '').trim() || 'Network check failed';
            const errEl = document.getElementById('errorMsg');
            if (errEl) errEl.innerText = msg;
            const modal = document.getElementById('errorModal');
            if (modal) modal.classList.remove('hidden');
        } catch (_) {}
        return;
    }

    const inEl = document.getElementById('swapIn');
    const outEl = document.getElementById('swapOut');
    const btn = document.getElementById('swapBtn');
    let amount = parseFloat(String(inEl?.value || '').trim());
    if (!amount) {
        try {
            if (typeof window.showNotification === 'function') window.showNotification('Enter amount', 'warning', 2000);
        } catch (_) {}
        return;
    }

    const currentSwapPair = String(getState('currentSwapPair') || window.currentSwapPair || 'FB_FENNEC');
    const isBuying = !!(getState('isBuying') ?? window.isBuying ?? true);

    let bal = 0;
    try {
        const ub = window.userBalances || {};
        const pr = window.poolReserves || {};
        if (currentSwapPair === 'FB_FENNEC') {
            bal = isBuying ? Number(ub.sFB || 0) : Number(ub.FENNEC || 0);
        } else {
            bal = isBuying ? Number(pr.user_sBTC || 0) : Number(ub.sFB || 0);
        }
    } catch (_) {
        bal = 0;
    }

    if (currentSwapPair === 'FB_FENNEC' && isBuying) {
        const feeBuffer = 0.05;
        const maxAllowed = Math.max(0, bal - feeBuffer);
        if (maxAllowed <= 0) {
            try {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('Not enough FB after reserving 0.05 for fees', 'warning', 2500);
                }
            } catch (_) {}
            return;
        }
        if (amount > maxAllowed) {
            amount = maxAllowed;
            try {
                if (inEl) inEl.value = amount.toFixed(8);
                if (typeof window.calc === 'function') window.calc();
            } catch (_) {}
            try {
                if (typeof window.showNotification === 'function')
                    window.showNotification('Reserved 0.05 FB for fees', 'info', 2200);
            } catch (_) {}
        }
    }

    if (bal < amount) {
        try {
            const m = document.getElementById('depositLinkModal');
            if (m) m.classList.remove('hidden');
        } catch (_) {}
        return;
    }

    try {
        if (btn) btn.disabled = true;
        if (typeof window.startDiggingAnimation === 'function') window.startDiggingAnimation();
    } catch (_) {}

    try {
        let userPubkey = String(window.userPubkey || '').trim();
        if (!userPubkey && typeof window.unisat?.getPublicKey === 'function') {
            userPubkey = String(await window.unisat.getPublicKey()).trim();
            window.userPubkey = userPubkey;
        }

        let tickIn;
        let tickOut;
        if (currentSwapPair === 'BTC_FB') {
            tickIn = isBuying ? T_SBTC : T_SFB;
            tickOut = isBuying ? T_SFB : T_SBTC;
        } else {
            tickIn = isBuying ? T_SFB : T_FENNEC;
            tickOut = isBuying ? T_FENNEC : T_SFB;
        }

        let expectedOut = 0;
        try {
            const quoteUrl = `${BACKEND_URL}?action=quote_swap&exactType=exactIn&tickIn=${tickIn}&tickOut=${tickOut}&amount=${amount}&address=${encodeURIComponent(userAddress)}`;
            const quoteRes = await fetch(quoteUrl)
                .then(r => (r.ok ? r.json() : r.json().catch(() => ({ code: -1 }))))
                .catch(() => null);
            if (quoteRes && quoteRes.code === 0 && quoteRes.data) {
                const rawAmount =
                    quoteRes.data.expect ||
                    quoteRes.data.amountOut ||
                    quoteRes.data.outAmount ||
                    quoteRes.data.receiveAmount ||
                    quoteRes.data.amount;
                expectedOut = parseFloat(rawAmount);
            }
        } catch (_) {
            expectedOut = 0;
        }

        if (!expectedOut || expectedOut <= 0) {
            expectedOut = parseFloat(String(outEl?.value || '').trim());
        }
        if (!expectedOut || Number.isNaN(expectedOut) || expectedOut <= 0) {
            throw new Error('Invalid amount: Please enter a valid swap amount');
        }

        const ts = Math.floor(Date.now() / 1000);
        const params = new URLSearchParams({
            address: userAddress,
            tickIn,
            tickOut,
            amountIn: amount.toString(),
            amountOut: expectedOut.toString(),
            slippage: '0.005',
            exactType: 'exactIn',
            ts: String(ts),
            feeTick: T_SFB,
            payType: 'tick'
        });
        const url = `${BACKEND_URL}?action=create_swap&${params.toString()}`;
        const res = await fetch(url)
            .then(r => r.json())
            .catch(() => null);
        if (!res || res.code !== 0) throw new Error(res?.msg || 'Swap Error');
        const preSwap = res.data;

        const signMsgs = Array.isArray(preSwap?.signMsgs) ? preSwap.signMsgs : [];
        const signatures = [];
        for (let i = 0; i < signMsgs.length; i += 1) {
            const msg = signMsgs[i];
            const m = typeof msg === 'object' ? msg.text || msg.id : msg;
            const sig = await window.unisat.signMessage(m, 'bip322-simple');
            signatures.push(sig);
        }

        const body = {
            address: userAddress,
            tickIn,
            tickOut,
            amountIn: amount.toString(),
            amountOut: expectedOut.toString(),
            slippage: '0.005',
            exactType: 'exactIn',
            ts: ts,
            feeTick: T_SFB,
            payType: 'tick',
            feeAmount: preSwap?.feeAmount,
            feeTickPrice: preSwap?.feeTickPrice,
            sigs: signatures,
            rememberPayType: false
        };

        const sub = await fetch(`${BACKEND_URL}?action=submit_swap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(body)
        })
            .then(r => r.json())
            .catch(() => null);

        if (sub && sub.code === 0) {
            try {
                if (btn) {
                    btn.classList.remove('swap-success-pulse');
                    void btn.offsetWidth;
                    btn.classList.add('swap-success-pulse');
                }
            } catch (_) {}
            try {
                if (typeof window.showNotification === 'function')
                    window.showNotification('Swap successful', 'swap', 3200);
            } catch (_) {}
            try {
                const txEl = document.getElementById('successTxId');
                if (txEl) txEl.innerText = sub.data || sub.txid || 'Swap success!';
            } catch (_) {}
            try {
                if (typeof window.checkBalance === 'function') setTimeout(window.checkBalance, 2000);
                else if (typeof window.manualRefresh === 'function') setTimeout(window.manualRefresh, 2000);
            } catch (_) {}
            return;
        }

        throw new Error(sub?.msg || 'Submission failed');
    } catch (e) {
        try {
            if (typeof window.showNotification === 'function')
                window.showNotification(e?.message || String(e), 'error', 4500);
        } catch (_) {}
        try {
            const errEl = document.getElementById('errorMsg');
            if (errEl) errEl.innerText = e?.message || String(e);
            const modal = document.getElementById('errorModal');
            if (modal) modal.classList.remove('hidden');
        } catch (_) {}
    } finally {
        try {
            if (typeof window.stopDiggingAnimation === 'function') window.stopDiggingAnimation();
            if (btn) btn.disabled = false;
        } catch (_) {}
    }
}

export function installSwapUiGlobals(target = window) {
    try {
        if (target && typeof target === 'object') {
            target.switchDir = switchDir;
            target.setSwapPair = setSwapPair;
            target.setMaxAmount = setMaxAmount;
        }
    } catch (_) {}
}

// Note: installSwapUiGlobals() call removed - will be handled in main.js
