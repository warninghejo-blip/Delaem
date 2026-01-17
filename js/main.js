try {
    window.__fennecUseHashRouter = false;
    window.__fennecSectionRouterSetup = true;
} catch (_) {
    void _;
}

try {
    const noop = function () {};
    window.connectWallet = window.connectWallet || noop;
    window.disconnectWallet = window.disconnectWallet || noop;
    window.manualRefresh = window.manualRefresh || noop;
    window.toggleChat = window.toggleChat || noop;
    window.oracleQuick = window.oracleQuick || noop;
    window.sendMessage = window.sendMessage || noop;
    window.closeProgress = window.closeProgress || noop;
    window.setChartTimeframe = window.setChartTimeframe || noop;
    window.showSection = window.showSection || noop;
    window.doSwap = window.doSwap || noop;
    window.openAddLiquidityModal = window.openAddLiquidityModal || noop;
    window.openRemoveLiquidityModal = window.openRemoveLiquidityModal || noop;
    window.closeAddLiquidityModal = window.closeAddLiquidityModal || noop;
    window.closeRemoveLiquidityModal = window.closeRemoveLiquidityModal || noop;
    window.switchLiquidityTab = window.switchLiquidityTab || noop;
    window.selectLiquidityPair = window.selectLiquidityPair || noop;
    window.setMaxLiqAmount = window.setMaxLiqAmount || noop;
    window.setMaxRemoveLp = window.setMaxRemoveLp || noop;
    window.updateRemoveLiquidityEstimate = window.updateRemoveLiquidityEstimate || noop;
    window.refreshMyLiquidityForSelectedPair = window.refreshMyLiquidityForSelectedPair || noop;
    window.copyLiquidityPairForSearch = window.copyLiquidityPairForSearch || noop;
    window.doAddLiquidity = window.doAddLiquidity || noop;
    window.doRemoveLiquidity = window.doRemoveLiquidity || noop;
    window.setDepositToken = window.setDepositToken || noop;
    window.setDepositFee = window.setDepositFee || noop;
    window.setMaxDepositAmount = window.setMaxDepositAmount || noop;
    window.setMaxFennecAmount = window.setMaxFennecAmount || noop;
    window.setWithdrawToken = window.setWithdrawToken || noop;
    window.setWithdrawFee = window.setWithdrawFee || noop;
    window.setMaxWithdrawAmount = window.setMaxWithdrawAmount || noop;
    window.doWithdraw = window.doWithdraw || noop;
    window.onVisionFennecIdClick = window.onVisionFennecIdClick || noop;
} catch (_) {
    void _;
}

const __getVersion = () => {
    try {
        const u = new URL(import.meta.url);
        const v = String(u.searchParams.get('v') || '').trim();
        return v;
    } catch (_) {
        return '';
    }
};

const __loadLegacyScript = src => {
    return new Promise((resolve, reject) => {
        try {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error(`Failed to load: ${src}`));
            document.head.appendChild(s);
        } catch (e) {
            reject(e);
        }
    });
};

(async () => {
    const v = __getVersion();
    const suffix = v ? `?v=${encodeURIComponent(v)}` : '';

    // Initialize state first
    try {
        const { initializeFromGlobals } = await import(`./app/state.js${suffix}`);
        initializeFromGlobals();
    } catch (_) {
        void _;
    }

    try {
        await import(`./app/core.js${suffix}`);
    } catch (_) {
        void _;
    }
    try {
        await import(`./app/chart.js${suffix}`);
    } catch (_) {
        void _;
    }
    try {
        await import(`./app/audit_ui.js${suffix}`);
    } catch (_) {
        void _;
    }
    try {
        await import(`./app/terminal_tabs.js${suffix}`);
    } catch (_) {
        void _;
    }
    try {
        await import(`./app/swap_ui.js${suffix}`);
    } catch (_) {
        void _;
    }
    try {
        await import(`./app/liquidity_ui.js${suffix}`);
    } catch (_) {
        void _;
    }

    // Initialize event bindings after all modules are loaded
    try {
        const { initializeEventBindings } = await import(`./app/event_bindings.js${suffix}`);
        initializeEventBindings();
    } catch (_) {
        void _;
    }

    // Load assets/app.js as ES6 module instead of legacy script
    try {
        await import(`../assets/app.js${suffix}`);
    } catch (_) {
        void _;
    }
})();
