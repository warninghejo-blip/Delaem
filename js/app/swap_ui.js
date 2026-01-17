import { getState, setState } from './state.js';

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

// Export functions for use in event bindings
export { switchDir, setSwapPair, setMaxAmount };
