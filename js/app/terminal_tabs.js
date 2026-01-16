const __terminalTabRefreshState = { last: { swap: 0, deposit: 0, withdraw: 0 } };

export async function __refreshTerminalTab(tab, force = false) {
    try {
        if (document.hidden) return;
    } catch (_) {}

    try {
        const active = document.querySelector('.tab-btn.active')?.id?.replace('tab-', '') || 'swap';
        if (String(active || '') !== String(tab || '')) return;
    } catch (_) {}

    const now = Date.now();
    const ttl = tab === 'swap' ? 30000 : 60000;
    const last =
        (__terminalTabRefreshState && __terminalTabRefreshState.last && __terminalTabRefreshState.last[tab]) || 0;
    if (!force && last && now - last < ttl) {
        return;
    }
    try {
        __terminalTabRefreshState.last[tab] = now;
    } catch (_) {}

    if (tab === 'swap') {
        try {
            await Promise.all([
                typeof window.fetchReserves === 'function' ? window.fetchReserves() : Promise.resolve(),
                typeof window.refreshTransactionHistory === 'function'
                    ? window.refreshTransactionHistory(false)
                    : Promise.resolve(),
                typeof window.checkWhales === 'function' ? window.checkWhales() : Promise.resolve(),
                typeof window.checkBalance === 'function' ? window.checkBalance(false) : Promise.resolve()
            ]);
        } catch (_) {}
        return;
    }

    if (tab === 'deposit') {
        try {
            if (typeof window.loadFees === 'function') await window.loadFees('deposit');
        } catch (_) {}
        try {
            if (typeof window.checkBalance === 'function') await window.checkBalance(false);
        } catch (_) {}
        try {
            if (typeof window.refreshTransactionHistory === 'function') await window.refreshTransactionHistory(false);
        } catch (_) {}
        return;
    }

    if (tab === 'withdraw') {
        try {
            if (typeof window.loadFees === 'function') await window.loadFees('withdraw');
        } catch (_) {}
        try {
            if (typeof window.checkBalance === 'function') await window.checkBalance(false);
        } catch (_) {}
        try {
            if (typeof window.refreshTransactionHistory === 'function') await window.refreshTransactionHistory(false);
        } catch (_) {}
        return;
    }
}

export function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
    });
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const targetView = document.getElementById(`view-${tab}`);
    const targetTab = document.getElementById(`tab-${tab}`);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('active');
    }
    if (targetTab) targetTab.classList.add('active');
    if (tab === 'deposit') {
        try {
            window.setDepositToken(window.depositToken, { skipFetch: true, skipFees: true });
        } catch (_) {}
        __refreshTerminalTab('deposit', false);
    }
    if (tab === 'withdraw') {
        try {
            if (typeof window.updateWithdrawUI === 'function') window.updateWithdrawUI();
        } catch (_) {}
        __refreshTerminalTab('withdraw', false);
    }
    if (tab === 'swap') {
        __refreshTerminalTab('swap', false);
    }
    if (tab === 'pending') {
        try {
            if (typeof window.refreshPendingOperations === 'function') window.refreshPendingOperations();
        } catch (_) {}
    }
}

export function installTerminalTabsGlobals(target = window) {
    try {
        if (target && typeof target === 'object') {
            target.switchTab = switchTab;
        }
    } catch (_) {}
}

installTerminalTabsGlobals();
