/**
 * Event bindings for the Fennec app
 * Replaces onclick attributes with proper event listeners
 */

import { switchDir, setSwapPair, setMaxAmount } from './swap_ui.js';

// Chart timeframe buttons
const chartTimeframeButtons = [
    { id: 'chart-1h', timeframe: '1h' },
    { id: 'chart-24h', timeframe: '24h' },
    { id: 'chart-7d', timeframe: '7d' },
    { id: 'chart-30d', timeframe: '30d' },
    { id: 'chart-all', timeframe: 'all' }
];

// Tab switching buttons
const tabButtons = [
    { id: 'tab-swap', tab: 'swap' },
    { id: 'tab-deposit', tab: 'deposit' },
    { id: 'tab-withdraw', tab: 'withdraw' },
    { id: 'tab-pending', tab: 'pending' }
];

// Swap pair buttons
const swapPairButtons = [
    { id: 'pair-fb-fennec', pair: 'FB_FENNEC' },
    { id: 'pair-btc-fb', pair: 'BTC_FB' }
];

// Deposit token buttons
const depositTokenButtons = [
    { id: 'dep-btc', token: 'BTC' },
    { id: 'dep-fb', token: 'FB' },
    { id: 'dep-fennec', token: 'FENNEC' }
];

// Withdraw token buttons
const withdrawTokenButtons = [
    { id: 'wd-btc', token: 'BTC' },
    { id: 'wd-fb', token: 'FB' },
    { id: 'wd-fennec', token: 'FENNEC' }
];

/**
 * Initialize all event listeners
 */
export function initializeEventBindings() {
    // Wallet buttons
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            if (typeof window.connectWallet === 'function') {
                window.connectWallet();
            }
        });
    }

    const disconnectBtn = document.getElementById('disconnectBtn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            if (typeof window.disconnectWallet === 'function') {
                window.disconnectWallet();
            }
        });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (typeof window.manualRefresh === 'function') {
                window.manualRefresh();
            }
        });
    }

    const visionFennecIdBtn = document.getElementById('visionFennecIdBtn');
    if (visionFennecIdBtn) {
        visionFennecIdBtn.addEventListener('click', () => {
            if (typeof window.onVisionFennecIdClick === 'function') {
                window.onVisionFennecIdClick();
            }
        });
    }

    // Chart timeframe buttons
    chartTimeframeButtons.forEach(({ id, timeframe }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof window.setChartTimeframe === 'function') {
                    window.setChartTimeframe(timeframe);
                }
            });
        }
    });

    // Tab buttons
    tabButtons.forEach(({ id, tab }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof window.switchTab === 'function') {
                    window.switchTab(tab);
                }
            });
        }
    });

    // Swap pair buttons
    swapPairButtons.forEach(({ id, pair }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => setSwapPair(pair));
        }
    });

    // Max amount button
    const maxAmountBtn = document.getElementById('max-amount-btn');
    if (maxAmountBtn) {
        maxAmountBtn.addEventListener('click', setMaxAmount);
    }

    // Swap direction button
    const switchDirBtn = document.getElementById('switch-dir-btn');
    if (switchDirBtn) {
        switchDirBtn.addEventListener('click', switchDir);
    }

    // Swap button
    const swapBtn = document.getElementById('swapBtn');
    if (swapBtn) {
        swapBtn.addEventListener('click', () => {
            if (typeof window.doSwap === 'function') {
                window.doSwap();
            }
        });
    }

    // Add liquidity modal button
    const addLiquidityBtn = document.getElementById('add-liquidity-btn');
    if (addLiquidityBtn) {
        addLiquidityBtn.addEventListener('click', () => {
            if (typeof window.openAddLiquidityModal === 'function') {
                const pair = window.currentSwapPair || 'FB_FENNEC';
                window.openAddLiquidityModal(pair);
            }
        });
    }

    // Deposit token buttons
    depositTokenButtons.forEach(({ id, token }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof window.setDepositToken === 'function') {
                    // Handle sFB token mapping
                    const tokenValue = id === 'dep-sfb' ? 'sFB' : token;
                    window.setDepositToken(tokenValue);
                }
            });
        }
    });

    // Withdraw token buttons
    withdrawTokenButtons.forEach(({ id, token }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof window.setWithdrawToken === 'function') {
                    // Handle sFB token mapping
                    const tokenValue = id === 'wd-sfb' ? 'sFB' : token;
                    window.setWithdrawToken(tokenValue);
                }
            });
        }
    });

    // Fee buttons
    const feeButtons = [
        { id: 'dep-fee-medium', fee: 'medium' },
        { id: 'dep-fee-fast', fee: 'fast' },
        { id: 'dep-fee-custom', fee: 'custom' },
        { id: 'wd-fee-slow', fee: 'slow' },
        { id: 'wd-fee-normal', fee: 'normal' },
        { id: 'wd-fee-fast', fee: 'fast' }
    ];

    feeButtons.forEach(({ id, fee }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                const isDeposit = id.startsWith('dep-');
                if (typeof window.setDepositFee === 'function' && isDeposit) {
                    window.setDepositFee(fee);
                } else if (typeof window.setWithdrawFee === 'function' && !isDeposit) {
                    window.setWithdrawFee(fee);
                }
            });
        }
    });

    // Custom fee input handling
    const depFeeCustomInput = document.getElementById('dep-fee-custom-input');
    if (depFeeCustomInput) {
        depFeeCustomInput.addEventListener('change', e => {
            if (typeof window.setDepositFeeCustom === 'function') {
                window.setDepositFeeCustom(e.target.value);
            }
        });
    }

    const wdFeeCustomInput = document.getElementById('wd-fee-custom-input');
    if (wdFeeCustomInput) {
        wdFeeCustomInput.addEventListener('change', e => {
            if (typeof window.setWithdrawFeeCustom === 'function') {
                window.setWithdrawFeeCustom(e.target.value);
            }
        });
    }

    // Fennec max amount button
    const maxFennecBtn = document.getElementById('max-fennec-btn');
    if (maxFennecBtn) {
        maxFennecBtn.addEventListener('click', () => {
            if (typeof window.setMaxFennecAmount === 'function') {
                window.setMaxFennecAmount();
            }
        });
    }

    // Create inscription button
    const createInscriptionBtn = document.getElementById('btn-create-inscription');
    if (createInscriptionBtn) {
        createInscriptionBtn.addEventListener('click', () => {
            if (typeof window.createFennecInscription === 'function') {
                window.createFennecInscription();
            }
        });
    }

    // Max amount buttons for deposit/withdraw
    const maxDepositBtn = document.getElementById('max-deposit-btn');
    if (maxDepositBtn) {
        maxDepositBtn.addEventListener('click', () => {
            if (typeof window.setMaxDepositAmount === 'function') {
                window.setMaxDepositAmount();
            }
        });
    }

    // Max withdraw button
    const maxWithdrawBtn = document.getElementById('max-withdraw-btn');
    if (maxWithdrawBtn) {
        maxWithdrawBtn.addEventListener('click', () => {
            if (typeof window.setMaxWithdrawAmount === 'function') {
                window.setMaxWithdrawAmount();
            }
        });
    }

    // Deposit and withdraw action buttons
    const depositBtn = document.getElementById('btnDeposit');
    if (depositBtn) {
        depositBtn.addEventListener('click', () => {
            if (typeof window.doDeposit === 'function') {
                window.doDeposit();
            }
        });
    }

    // Withdraw action button
    const withdrawBtn = document.getElementById('btnWithdraw');
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', () => {
            if (typeof window.doWithdraw === 'function') {
                window.doWithdraw();
            }
        });
    }

    console.log('Event bindings initialized');
}
