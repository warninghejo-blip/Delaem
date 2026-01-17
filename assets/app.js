// Импорты функций из модулей
import {
    refreshMyLiquidityForSelectedPair,
    openAddLiquidityModal,
    switchLiquidityTab,
    updateRemoveLiquidityEstimate,
    selectLiquidityPair,
    loadLiquidityPoolData,
    updateLiquidityBalancesUI,
    syncLiquidityAmounts,
    fetchMyLiquiditySummary,
    getLiquidityConfig,
    computeExpectedLp,
    __normalizeAmountStr,
    closeAddLiquidityModal,
    getBalanceForTick
} from '../js/app/liquidity_ui.js';

import { initAudit, runAudit, refreshAudit, startAuditRefreshTimer } from '../js/app/audit_ui.js';

import {
    seedChartPriceFromCache,
    initChart,
    loadHistoricalPrices,
    updateChart,
    setChartTimeframe,
    updateLiveTicker,
    startPublicTickerUpdates,
    stopPublicTickerUpdates,
    __fennecStartSmartPolling,
    __fennecStopSmartPolling
} from '../js/app/chart.js';

import { doSwap, setSwapPair, switchDir, setMaxAmount } from '../js/app/swap_ui.js';

// Временные заглушки для функций из отсутствующих модулей
const setDepositFeeCustom = window.setDepositFeeCustom || function () {};
const setWithdrawFeeCustom = window.setWithdrawFeeCustom || function () {};
const setDepositFee = window.setDepositFee || function () {};
const setWithdrawFee = window.setWithdrawFee || function () {};
const loadFees = window.loadFees || function () {};
const setDepositToken = window.setDepositToken || function () {};
const setMaxDepositAmount = window.setMaxDepositAmount || function () {};
const setMaxFennecAmount = window.setMaxFennecAmount || function () {};
const setWithdrawToken = window.setWithdrawToken || function () {};
const setMaxWithdrawAmount = window.setMaxWithdrawAmount || function () {};
const doWithdraw = window.doWithdraw || function () {};
const createFennecInscription = window.createFennecInscription || function () {};
const manualRefresh = window.manualRefresh || function () {};
const connectWallet = window.connectWallet || function () {};
const disconnectWallet = window.disconnectWallet || function () {};
const onVisionFennecIdClick = window.onVisionFennecIdClick || function () {};
const oracleQuick = window.oracleQuick || function () {};
const fetchAuditData = window.fetchAuditData || function () {};
const updatePriceData = window.updatePriceData || function () {};

// ИСПРАВЛЕНИЕ: Предварительно объявляем функции на window, чтобы они были доступны для inline onclick
// Это предотвращает ошибки "function is not defined" при парсинге HTML
// DO NOT REMOVE.
window.showSection = window.showSection || function () {};
window.showSection = function (id) {
    const sections = document.querySelectorAll('.page-section');
    if (sections.length === 0) {
        console.warn('Sections not loaded yet');
        return;
    }
    sections.forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none'; // Скрываем полностью
    });

    // ИСПРАВЛЕНИЕ: Если переключились на аудит, восстанавливаем из кэша или показываем кнопку
    if (id === 'audit') {
        const currentAddr = window.userAddress || userAddress || null;
        if (currentAddr && !window.auditLoading) {
            const cacheKey = `audit_v3_${currentAddr}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached && !window.auditIdentity) {
                try {
                    const cachedData = JSON.parse(cached);
                    if (Date.now() - cachedData.timestamp < 7 * 24 * 60 * 60 * 1000) {
                        console.log('Restoring audit from cache');
                        window.auditIdentity = cachedData.identity;
                        try {
                            const a = String(currentAddr || '').trim();
                            if (a && window.auditIdentity && typeof window.auditIdentity === 'object') {
                                window.auditIdentity.metrics =
                                    window.auditIdentity.metrics && typeof window.auditIdentity.metrics === 'object'
                                        ? window.auditIdentity.metrics
                                        : {};
                                window.auditIdentity.metrics.address = String(
                                    window.auditIdentity.metrics.address || a
                                ).trim();
                            }
                        } catch (_) {}
                        // Do not render legacy parent card UI. window.initAudit() will show v2 iframe preview.
                    }
                } catch (e) {
                    console.warn('Failed to restore from cache:', e);
                }
            }
        }
        if (typeof window.initAudit === 'function' && !window.auditLoading) {
            setTimeout(() => {
                try {
                    const p = window.initAudit();
                    if (p && typeof p.then === 'function') p.catch(() => false);
                } catch (_) {}
            }, 50);
        }
    }

    const target = document.getElementById(`sec-${id}`);
    if (target) {
        target.style.display = 'flex';
        setTimeout(() => target.classList.add('active'), 10);
        window.scrollTo(0, 0);
    }

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const navLink = document.getElementById(`nav-${id}`);
    if (navLink) navLink.classList.add('active');

    try {
        const desired = String(id || '').trim();
        const curHash = String(window.location.hash || '')
            .replace(/^#/, '')
            .trim();
        if (
            desired &&
            curHash !== desired &&
            !window.__fennecSectionHashWrite &&
            window.__fennecUseHashRouter !== false
        ) {
            window.__fennecSectionHashWrite = true;
            window.location.hash = `#${desired}`;
            setTimeout(() => {
                window.__fennecSectionHashWrite = false;
            }, 0);
        }
    } catch (_) {}

    // Если пользователь уже запустил SCAN/OPEN, не сбрасываем UI только потому что адрес еще не появился.
    try {
        const addrNow = String(window.userAddress || userAddress || '').trim();
        const activeMode = String((window.__fennecAuditUi && window.__fennecAuditUi.mode) || 'idle');
        if (!addrNow && (activeMode === 'scanning' || activeMode === 'opening')) {
            return;
        }
    } catch (_) {}

    // ИСПРАВЛЕНИЕ: Скрываем кнопку REFRESH в header когда открыт Fennec ID
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        if (id === 'audit' || id === 'terminal' || id === 'home') {
            refreshBtn.classList.add('hidden');
        } else {
            // Показываем только если кошелек подключен
            if (userAddress) {
                refreshBtn.classList.remove('hidden');
            }
        }
    }

    // ИСПРАВЛЕНИЕ: Если переключились на аудит, восстанавливаем из кэша
    // Блок удален так как логика перенесена выше и консолидирована.
};

if (typeof window.initAuditLoading === 'undefined') window.initAuditLoading = false;

function __legacy_fennecInitAuditSafe() {
    try {
        if (typeof window.initAudit !== 'function') return null;
        const p = window.initAudit();
        try {
            if (p && typeof p.then === 'function') p.catch(() => false);
        } catch (_) {}
        return p;
    } catch (_) {
        return null;
    }
}

const __fennecInitAuditSafe = window.__fennecInitAuditSafe || __legacy_fennecInitAuditSafe;
window.__fennecInitAuditSafe = __fennecInitAuditSafe;

try {
    if (window.__fennecSpaRouter) {
        if (window.__fennecUseHashRouter !== false) window.__fennecUseHashRouter = false;
        window.__fennecSectionRouterSetup = true;
    }
} catch (_) {}

if (!window.__fennecSectionRouterSetup && !window.__fennecSpaRouter) {
    window.__fennecSectionRouterSetup = true;

    try {
        const secs = document.querySelectorAll('.page-section');
        if (window.__fennecUseHashRouter !== false) {
            window.__fennecUseHashRouter = !!(secs && secs.length > 1);
        }
    } catch (_) {
        if (window.__fennecUseHashRouter !== false) {
            window.__fennecUseHashRouter = true;
        }
    }

    const readHashSection = () => {
        const h = String(window.location.hash || '')
            .replace(/^#/, '')
            .trim();
        return h ? h : '';
    };

    window.addEventListener('hashchange', () => {
        if (window.__fennecSectionHashWrite) return;
        if (window.__fennecUseHashRouter === false) return;
        const id = readHashSection();
        if (!id) return;
        try {
            const sec = document.getElementById('sec-' + id);
            if (!sec) return;
        } catch (_) {}
        try {
            window.showSection(id);
        } catch (_) {}
    });

    setTimeout(() => {
        if (window.__fennecUseHashRouter === false) return;
        const id = readHashSection();
        if (id) {
            try {
                const sec = document.getElementById('sec-' + id);
                if (!sec) return;
            } catch (_) {}
            try {
                window.showSection(id);
            } catch (_) {}
            return;
        }

        const activeId = String(document.querySelector('.page-section.active')?.id || '').trim();
        const activeSection = activeId.startsWith('sec-') ? activeId.slice(4) : '';
        if (!activeSection) {
            try {
                window.showSection('home');
            } catch (_) {}
        }
    }, 0);
}

window.__isTerminalPage = function () {
    try {
        const p = String(window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
        return p.endsWith('/terminal.html') || p.endsWith('terminal.html');
    } catch (_) {
        return false;
    }
};

window.__ensureAuditUi =
    window.__ensureAuditUi ||
    function () {
        try {
            if (!document.getElementById('auditContainer')) return;
        } catch (_) {
            return;
        }

        const attempt = () => {
            try {
                if (typeof window.initAudit === 'function') {
                    try {
                        const p = window.initAudit();
                        if (p && typeof p.then === 'function') p.catch(() => false);
                    } catch (_) {}
                    return true;
                }
            } catch (_) {}
            return false;
        };

        if (attempt()) return;
        let tries = 0;
        const t = setInterval(() => {
            tries += 1;
            if (attempt() || tries >= 30) {
                try {
                    clearInterval(t);
                } catch (_) {}
            }
        }, 100);
    };

window.__syncFennecIdButtonsUI = function () {
    try {
        const openBtn = document.getElementById('fidOpenBtn');
        const wrap = document.getElementById('fidActionButtons');
        const updBtn = document.getElementById('fidUpdateBtn');
        const refBtn = document.getElementById('fidRefreshBtn');
        const openTxt = document.getElementById('fidOpenBtnText');
        const addr = String(window.userAddress || userAddress || '').trim();
        const ui = window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object' ? window.__fennecAuditUi : null;
        const mode = String((ui && ui.mode) || 'idle');
        const uiAddr = String((ui && ui.addr) || '').trim();
        const hasIframe = !!document.getElementById('fennecIdIframe');
        const isOpened = !!(addr && uiAddr && addr === uiAddr && mode === 'opened' && hasIframe);

        if (openBtn) {
            openBtn.style.display = isOpened ? 'none' : '';
            openBtn.disabled = false;
            openBtn.style.pointerEvents = '';
            openBtn.style.visibility = '';
        }
        if (openTxt && !isOpened) openTxt.textContent = 'OPEN ID';
        if (wrap) wrap.style.display = isOpened ? '' : 'none';
        if (updBtn) updBtn.style.display = isOpened ? '' : 'none';
        if (refBtn) refBtn.style.display = isOpened ? '' : 'none';
    } catch (_) {}
};

// ИСПРАВЛЕНИЕ: Определяем window.connectWallet сразу после showSection
window.__dedupeWalletButtons = function () {
    try {
        const c = Array.from(document.querySelectorAll('#connectBtn'));
        for (let i = 1; i < c.length; i++) {
            try {
                c[i].remove();
            } catch (_) {}
        }
    } catch (_) {}
    try {
        const d = Array.from(document.querySelectorAll('#disconnectBtn'));
        for (let i = 1; i < d.length; i++) {
            try {
                d[i].remove();
            } catch (_) {}
        }
    } catch (_) {}
};

window.__getWalletButtonsHost = function () {
    return (
        document.getElementById('connectBtn')?.parentElement ||
        document.getElementById('disconnectBtn')?.parentElement ||
        document.querySelector('header .justify-self-end') ||
        null
    );
};

window.__resetConnectBtn = function (show = true) {
    try {
        if (typeof window.__dedupeWalletButtons === 'function') window.__dedupeWalletButtons();
    } catch (_) {}
    let old = document.getElementById('connectBtn');
    if (!old) {
        const host = (typeof window.__getWalletButtonsHost === 'function' && window.__getWalletButtonsHost()) || null;
        if (!host) return null;
        old = document.createElement('button');
        old.id = 'connectBtn';
        old.setAttribute('data-t', 'connect');
        old.className =
            'bg-gradient-to-r from-fennec to-orange-600 text-black px-4 py-2 rounded-lg font-bold hover:brightness-110 transition text-xs shadow-[0_0_20px_rgba(255,107,53,0.4)] flex items-center gap-2';
        try {
            host.appendChild(old);
        } catch (_) {
            return null;
        }
    }
    const fresh = old.cloneNode(false);
    try {
        fresh.removeAttribute('onclick');
        fresh.onclick = function () {
            try {
                return window.connectWallet();
            } catch (_) {}
        };
    } catch (_) {}
    fresh.innerHTML = '<i class="fas fa-wallet"></i> <span>CONNECT</span>';
    try {
        fresh.disabled = false;
        fresh.removeAttribute('disabled');
    } catch (_) {}
    if (show) fresh.classList.remove('hidden');
    else fresh.classList.add('hidden');
    old.replaceWith(fresh);
    return fresh;
};

window.__resetDisconnectBtn = function (show = true) {
    try {
        if (typeof window.__dedupeWalletButtons === 'function') window.__dedupeWalletButtons();
    } catch (_) {}
    let old = document.getElementById('disconnectBtn');
    if (!old) {
        const host = (typeof window.__getWalletButtonsHost === 'function' && window.__getWalletButtonsHost()) || null;
        if (!host) return null;
        old = document.createElement('button');
        old.id = 'disconnectBtn';
        old.setAttribute('data-t', 'disconnect');
        old.className =
            'bg-red-600/20 text-red-400 px-4 py-2 rounded-lg font-bold hover:bg-red-600/30 transition text-xs border border-red-500/50 flex items-center gap-2';
        try {
            host.appendChild(old);
        } catch (_) {
            return null;
        }
    }

    const fresh = old.cloneNode(false);
    try {
        fresh.removeAttribute('onclick');
        fresh.onclick = function () {
            try {
                return window.disconnectWallet();
            } catch (_) {}
        };
    } catch (_) {}
    fresh.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span id="disconnectBtnText">DISCONNECT</span>';
    if (show) fresh.classList.remove('hidden');
    else fresh.classList.add('hidden');
    old.replaceWith(fresh);
    return fresh;
};

window.__syncWalletButtonsUI = function () {
    try {
        if (typeof window.__dedupeWalletButtons === 'function') window.__dedupeWalletButtons();
    } catch (_) {}
    const addr = String(window.userAddress || '').trim();
    if (!addr) {
        try {
            document.getElementById('disconnectBtn')?.remove();
        } catch (_) {}
        const connectBtn = window.__resetConnectBtn(true) || document.getElementById('connectBtn');
        if (connectBtn) connectBtn.classList.remove('hidden');
    } else {
        try {
            document.getElementById('connectBtn')?.remove();
        } catch (_) {}
        const disconnectBtn = window.__resetDisconnectBtn(true) || document.getElementById('disconnectBtn');
        const disconnectBtnText = document.getElementById('disconnectBtnText');
        if (disconnectBtn) disconnectBtn.classList.remove('hidden');
        if (disconnectBtnText) disconnectBtnText.textContent = `...${addr.slice(-4)}`;
    }
};

window.__restoreAuditFromCache = function (addr) {
    try {
        const a = String(addr || '').trim();
        if (!a) return false;
        const cacheKey = `audit_v3_${a}`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return false;
        try {
            const cachedData = JSON.parse(cached);
            const ts = Number(cachedData?.timestamp || 0) || 0;
            const ttlMs = 7 * 24 * 60 * 60 * 1000;
            if (ts > 0 && Date.now() - ts > ttlMs) return false;
            if (cachedData && cachedData.identity && !window.auditIdentity) {
                window.auditIdentity = cachedData.identity;
                try {
                    window.auditIdentity.metrics =
                        window.auditIdentity.metrics && typeof window.auditIdentity.metrics === 'object'
                            ? window.auditIdentity.metrics
                            : {};
                    window.auditIdentity.metrics.address = String(window.auditIdentity.metrics.address || a).trim();
                } catch (_) {}
                return true;
            }
        } catch (_) {}
        return false;
    } catch (_) {
        return false;
    }
};

window.tryRestoreWalletSession = async function () {
    try {
        if (localStorage.getItem('fennec_wallet_manual_disconnect') === '1') return false;
    } catch (_) {}
    try {
        if (window.__walletConnecting) return false;
    } catch (_) {}
    if (typeof window.unisat === 'undefined') return false;

    try {
        await window.unisat.switchChain('FRACTAL_BITCOIN_MAINNET');
    } catch (_) {}

    let acc = null;
    try {
        if (typeof window.unisat.getAccounts === 'function') {
            acc = await window.unisat.getAccounts();
        }
    } catch (_) {
        acc = null;
    }

    if (!acc || !Array.isArray(acc) || acc.length === 0) return false;
    const addr = String(acc[0] || '').trim();
    if (!addr) return false;

    userAddress = addr;
    window.userAddress = addr;

    try {
        localStorage.setItem('fennec_last_wallet', addr);
        localStorage.removeItem('fennec_wallet_manual_disconnect');
    } catch (_) {}

    try {
        if (!userPubkey && typeof window.unisat.getPublicKey === 'function') {
            userPubkey = await window.unisat.getPublicKey();
            window.userPubkey = userPubkey;
        }
    } catch (_) {}

    try {
        if (typeof window.__syncWalletButtonsUI === 'function') window.__syncWalletButtonsUI();
    } catch (_) {}

    try {
        if (typeof window.updateVisionFennecIdCta === 'function') window.updateVisionFennecIdCta();
    } catch (_) {}

    try {
        if (typeof window.__restoreAuditFromCache === 'function') window.__restoreAuditFromCache(addr);
    } catch (_) {}

    try {
        if (document.getElementById('auditContainer')) __fennecInitAuditSafe();
    } catch (_) {}

    try {
        if (typeof window.prefetchFennecAudit === 'function') window.prefetchFennecAudit(true);
    } catch (_) {}

    try {
        if (typeof window.refreshFennecIdStatus === 'function') window.refreshFennecIdStatus(false);
    } catch (_) {}

    return true;
};

try {
    if (!window.__fennecWalletRestoreBoot) {
        window.__fennecWalletRestoreBoot = true;

        const __attemptRestore = async () => {
            try {
                if (localStorage.getItem('fennec_wallet_manual_disconnect') === '1') return true;
            } catch (_) {}

            try {
                const addrNow = String(window.userAddress || userAddress || '').trim();
                if (addrNow) return true;
            } catch (_) {}

            try {
                if (typeof window.unisat === 'undefined') return false;
            } catch (_) {}

            try {
                if (typeof window.tryRestoreWalletSession !== 'function') return false;
                const ok = await window.tryRestoreWalletSession();
                return !!ok;
            } catch (_) {}
            return false;
        };

        const __startRestoreLoop = () => {
            let tries = 0;
            const t = setInterval(() => {
                tries += 1;
                if (tries > 80) {
                    try {
                        clearInterval(t);
                    } catch (_) {}
                    return;
                }
                __attemptRestore().then(didAttempt => {
                    if (didAttempt) {
                        try {
                            clearInterval(t);
                        } catch (_) {}
                    }
                });
            }, 250);

            __attemptRestore().then(didAttempt => {
                if (didAttempt) {
                    try {
                        clearInterval(t);
                    } catch (_) {}
                }
            });
        };

        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => setTimeout(__startRestoreLoop, 0));
            } else {
                setTimeout(__startRestoreLoop, 0);
            }
        } catch (_) {
            setTimeout(__startRestoreLoop, 0);
        }
    }
} catch (_) {}

window.connectWallet = async function () {
    if (typeof window.unisat === 'undefined') {
        window.open('https://unisat.io/download', '_blank');
        return;
    }
    try {
        if (window.__walletConnecting) return;
        window.__walletConnecting = true;
        try {
            const connectBtn = window.__resetConnectBtn(true) || document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) {
                connectBtn.disabled = true;
                connectBtn.classList.remove('hidden');
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>CONNECTING</span>';
            }
            if (disconnectBtn) disconnectBtn.classList.add('hidden');
        } catch (_) {}

        console.log('=== CONNECTING WALLET ===');
        try {
            await window.unisat.switchChain('FRACTAL_BITCOIN_MAINNET');
            console.log('Switched to Fractal Bitcoin Mainnet');
        } catch (e) {
            console.warn('Switch chain warning:', e);
        }
        console.log('Requesting accounts...');
        const acc =
            typeof window.unisat.requestAccounts === 'function'
                ? await window.unisat.requestAccounts()
                : typeof window.unisat.getAccounts === 'function'
                  ? await window.unisat.getAccounts()
                  : null;
        if (!acc || acc.length === 0) {
            throw new Error('No accounts returned from wallet');
        }

        // ИСПРАВЛЕНИЕ: Проверяем, не переключается ли кошелек
        const newAddr = acc[0];
        if (userAddress && userAddress !== newAddr && !switchWalletConfirmed) {
            // Показываем модалку подтверждения
            const currentAddrEl = document.getElementById('currentWalletAddress');
            if (currentAddrEl) {
                currentAddrEl.textContent = userAddress;
            }
            document.getElementById('switchWalletModal').classList.remove('hidden');
            try {
                window.__walletConnecting = false;
                if (typeof window.__syncWalletButtonsUI === 'function') window.__syncWalletButtonsUI();
            } catch (_) {}
            return; // Ждем подтверждения
        }

        // Set userAddress - use window for global access
        const addr = newAddr;
        userAddress = addr;
        window.userAddress = addr;

        try {
            localStorage.setItem('fennec_last_wallet', addr);
            localStorage.removeItem('fennec_wallet_manual_disconnect');
        } catch (_) {}

        try {
            if (typeof window.__syncWalletButtonsUI === 'function') window.__syncWalletButtonsUI();
        } catch (_) {}
        // ВСЕГДА скрываем кнопку REFRESH в секции Fennec ID
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('hidden'); // Всегда скрываем в Fennec ID секции
        }

        console.log('Wallet connected');

        try {
            if (typeof window.prefetchFennecAudit === 'function') window.prefetchFennecAudit(true);
        } catch (_) {}

        try {
            if (typeof window.refreshFennecIdStatus === 'function') window.refreshFennecIdStatus(false);
        } catch (_) {}

        try {
            if (typeof prewarmBackendCaches === 'function') prewarmBackendCaches();
        } catch (_) {}

        // ИСПРАВЛЕНИЕ: Всегда обновляем UI FENNEC ID после подключения кошелька.
        // Раньше проверялся tab-audit, которого может не быть/не быть active.
        if (typeof window.initAudit === 'function') {
            setTimeout(() => window.initAudit(), 100);
        }
        try {
            if (typeof window.updateVisionFennecIdCta === 'function') window.updateVisionFennecIdCta();
        } catch (e) {}

        // ИСПРАВЛЕНИЕ: Сбрасываем флаг подтверждения
        switchWalletConfirmed = false;

        // ИСПРАВЛЕНИЕ: Запускаем автообновление данных каждую минуту
        // ИСПРАВЛЕНИЕ: Автообновление отключено - пользователь обновляет вручную
        // startAutoUpdate();

        if (typeof checkBalance === 'function') checkBalance();
        if (typeof refreshTransactionHistory === 'function') {
            setTimeout(refreshTransactionHistory, 2000);
        }

        // Подгрузить LP позицию если модалка Add Liquidity открыта
        try {
            const modal = document.getElementById('addLiquidityModal');
            if (modal && !modal.classList.contains('hidden')) {
                console.log('Reloading LP position after wallet connection...');
                setTimeout(() => refreshMyLiquidityForSelectedPair(false), 500);
            }
        } catch (e) {
            console.error('Failed to reload LP position:', e);
        }

        // Setup account change listener
        if (!window.__unisatAccountListenerSetup && window.unisat) {
            window.__unisatAccountListenerSetup = true;
            try {
                window.unisat.on('accountsChanged', accounts => {
                    console.log('Unisat account changed:', accounts);

                    try {
                        if (localStorage.getItem('fennec_wallet_manual_disconnect') === '1') return;
                    } catch (_) {}

                    const cur = String(userAddress || window.userAddress || '').trim();
                    if (!accounts || accounts.length === 0) {
                        console.log('Account event: empty accounts, re-checking...');
                        setTimeout(async () => {
                            try {
                                if (localStorage.getItem('fennec_wallet_manual_disconnect') === '1') return;
                            } catch (_) {}

                            try {
                                if (typeof window.unisat === 'undefined') {
                                    window.disconnectWallet({
                                        manual: false,
                                        clearCache: false,
                                        reason: 'accounts_empty'
                                    });
                                    return;
                                }
                            } catch (_) {
                                window.disconnectWallet({ manual: false, clearCache: false, reason: 'accounts_empty' });
                                return;
                            }

                            let acc2 = null;
                            try {
                                if (typeof window.unisat.getAccounts === 'function') {
                                    acc2 = await window.unisat.getAccounts();
                                }
                            } catch (_) {
                                acc2 = null;
                            }

                            const nextAddr2 =
                                acc2 && Array.isArray(acc2) && acc2.length > 0 ? String(acc2[0] || '').trim() : '';
                            const cur2 = String(userAddress || window.userAddress || '').trim();
                            if (nextAddr2) {
                                if (!cur2 || cur2 !== nextAddr2) {
                                    userAddress = nextAddr2;
                                    window.userAddress = nextAddr2;
                                    try {
                                        if (typeof window.__syncWalletButtonsUI === 'function')
                                            window.__syncWalletButtonsUI();
                                    } catch (_) {}
                                    try {
                                        if (typeof window.updateVisionFennecIdCta === 'function')
                                            window.updateVisionFennecIdCta();
                                    } catch (_) {}
                                    try {
                                        if (document.getElementById('auditContainer')) __fennecInitAuditSafe();
                                    } catch (_) {}
                                    try {
                                        if (typeof window.prefetchFennecAudit === 'function')
                                            window.prefetchFennecAudit(true);
                                    } catch (_) {}
                                    try {
                                        if (typeof window.refreshFennecIdStatus === 'function')
                                            window.refreshFennecIdStatus(false);
                                    } catch (_) {}
                                }
                                return;
                            }

                            window.disconnectWallet({ manual: false, clearCache: false, reason: 'accounts_empty' });
                        }, 350);
                        return;
                    }

                    const nextAddr = String(accounts[0] || '').trim();
                    if (!cur) {
                        if (nextAddr) {
                            userAddress = nextAddr;
                            window.userAddress = nextAddr;
                            try {
                                if (typeof window.__syncWalletButtonsUI === 'function') window.__syncWalletButtonsUI();
                            } catch (_) {}
                            try {
                                if (typeof window.updateVisionFennecIdCta === 'function')
                                    window.updateVisionFennecIdCta();
                            } catch (_) {}
                            try {
                                if (document.getElementById('auditContainer')) __fennecInitAuditSafe();
                            } catch (_) {}

                            try {
                                if (typeof window.prefetchFennecAudit === 'function') window.prefetchFennecAudit(true);
                            } catch (_) {}

                            try {
                                if (typeof window.refreshFennecIdStatus === 'function')
                                    window.refreshFennecIdStatus(false);
                            } catch (_) {}
                        }
                        return;
                    }

                    if (nextAddr && nextAddr !== cur) {
                        console.log('Account switch detected, resetting data...');
                        window.disconnectWallet({ manual: false, clearCache: true, reason: 'account_switch' });
                    }
                });
            } catch (e) {
                console.warn('Could not setup account listener:', e);
            }
        }
    } catch (e) {
        console.error('Wallet connection error:', e);
        alert(e.message || 'Failed to connect wallet');
    } finally {
        try {
            window.__walletConnecting = false;
        } catch (_) {}
        try {
            if (typeof window.__syncWalletButtonsUI === 'function') window.__syncWalletButtonsUI();
        } catch (_) {}
    }
};

// ИСПРАВЛЕНИЕ: Функция отключения кошелька
window.disconnectWallet = function (opts) {
    const manual = !(opts && typeof opts === 'object' && opts.manual === false);
    const clearCache = !(opts && typeof opts === 'object' && opts.clearCache === false);
    const currentAddr = String(userAddress || window.userAddress || '').trim();
    const hadAddr = !!currentAddr;

    try {
        if (manual) localStorage.setItem('fennec_wallet_manual_disconnect', '1');
    } catch (_) {}

    if (hadAddr) console.log('Disconnecting wallet:', currentAddr);
    else console.log('Disconnecting wallet: no active address');

    // Останавливаем автообновление
    stopAutoUpdate();

    // Очищаем данные
    userAddress = null;
    window.userAddress = null;
    userPubkey = null;
    window.userPubkey = null;

    try {
        if (window.currentAuditAbortController) window.currentAuditAbortController.abort();
    } catch (_) {}
    try {
        window.currentAuditRequestId++;
    } catch (_) {}
    try {
        window.initAuditLoading = false;
    } catch (_) {}

    // Очищаем UI данные
    userBalances = { sFB: 0, FENNEC: 0, BTC: 0 };
    walletBalances = { sFB: 0, FENNEC: 0, BTC: 0 };
    poolReserves = { sFB: 0, FENNEC: 0, BTC: 0, user_sBTC: 0 };
    window.auditIdentity = null;
    window.auditLoading = false;
    window.prefetchedFennecAudit = null;
    window.prefetchedFennecAuditAddr = null;
    window.prefetchedFennecAuditTs = 0;

    // ИСПРАВЛЕНИЕ: Очищаем кэш аудита при отключении кошелька
    if (hadAddr && clearCache) {
        const cacheKey = `audit_${currentAddr}`;
        localStorage.removeItem(cacheKey);
        const cacheKey2 = `audit_v3_${currentAddr}`;
        localStorage.removeItem(cacheKey2);
        try {
            localStorage.removeItem(`fennec_id_child_v2_${currentAddr}`);
            localStorage.removeItem(`fennec_id_child_v3_${currentAddr}`);
        } catch (_) {}
    }

    // ИСПРАВЛЕНИЕ: Сбрасываем состояние Fennec ID
    if (window.__fennecIdStatus && typeof window.__fennecIdStatus === 'object') {
        window.__fennecIdStatus.loading = false;
        window.__fennecIdStatus.hasId = false;
        window.__fennecIdStatus.inscriptionId = '';
        window.__fennecIdStatus.source = '';
        window.__fennecIdStatus.addr = '';
    }

    // Обновляем кнопки
    const refreshBtn = document.getElementById('refreshBtn');
    try {
        if (typeof window.__syncWalletButtonsUI === 'function') window.__syncWalletButtonsUI();
    } catch (_) {}
    if (refreshBtn) {
        refreshBtn.classList.add('hidden');
    }
    // Останавливаем таймер обновления
    if (refreshTimerInterval) {
        clearInterval(refreshTimerInterval);
        refreshTimerInterval = null;
    }

    // Обновляем UI балансов напрямую
    const balInEl = document.getElementById('balIn');
    if (balInEl) balInEl.innerText = 'Bal: 0.0000';

    // Очищаем контейнер аудита
    const auditContainer = document.getElementById('auditContainer');
    if (auditContainer) {
        auditContainer.innerHTML = '';
    }

    // ИСПРАВЛЕНИЕ: Восстанавливаем кнопку "CONNECT & SCAN ID" в секции аудита
    if (typeof window.initAudit === 'function') {
        __fennecInitAuditSafe();
    }

    // Очищаем историю транзакций
    const historyList = document.getElementById('historyList');
    if (historyList) {
        historyList.innerHTML = '';
    }

    // Обновляем вкладки, если нужно
    if (typeof checkBalance === 'function') {
        checkBalance();
    }

    console.log('Wallet disconnected');
    if (typeof showNotification === 'function') {
        showNotification('Wallet disconnected', 'info');
    } else {
        alert('Wallet disconnected');
    }

    try {
        if (window.__fennecIdStatus && typeof window.__fennecIdStatus === 'object') {
            window.__fennecIdStatus.loading = false;
            window.__fennecIdStatus.hasId = false;
            window.__fennecIdStatus.inscriptionId = '';
            window.__fennecIdStatus.source = '';
        }
    } catch (_) {}
    try {
        if (typeof window.updateVisionFennecIdCta === 'function') window.updateVisionFennecIdCta();
    } catch (_) {}
};

setTimeout(() => {
    try {
        if (typeof window.__syncWalletButtonsUI === 'function') window.__syncWalletButtonsUI();
    } catch (_) {}
}, 0);

window.__fennecIdStatus = window.__fennecIdStatus || {
    loading: false,
    hasId: false,
    inscriptionId: '',
    source: '',
    addr: ''
};

window.__fennecAuditUi = window.__fennecAuditUi || {
    addr: '',
    mode: 'idle',
    openedAt: 0,
    scannedAt: 0
};

// FENNEC LORE DATABASE - Premium tweet content
const FENNEC_LORE_DB = {
    DRIFTER: {
        0: {
            title: 'Desert Runner',
            text: 'Just a silhouette on the horizon. Searching for the first signal.'
        },
        1: {
            title: 'Sand Wanderer',
            text: 'The dunes are shifting. I have found my path through the static.'
        },
        2: { title: 'Dune Nomad', text: "Speed is survival. I don't just cross the desert; I conquer it." },
        3: { title: 'Storm Surfer', text: 'I am the chaos. I ride the lightning of the Fractal storm.' }
    },
    MERCHANT: {
        0: { title: 'Caravan Merchant', text: 'Every great fortune starts with a single dust mote.' },
        1: { title: 'Gold Trader', text: 'The deals are flowing. My ledger grows with every block.' },
        2: { title: 'Oasis King', text: "I don't chase liquidity. Liquidity comes to me." },
        3: { title: 'Desert Tycoon', text: 'I am the market. The golden city shines at my command.' }
    },
    ENGINEER: {
        0: {
            title: 'The Tinkerer',
            text: "Fixing what's broken. The code is raw, but potential is infinite."
        },
        1: {
            title: 'System Architect',
            text: 'Systems online. Building the infrastructure for the new world.'
        },
        2: { title: 'The Cyber-Forge', text: 'Merging with the machine. I forge the tools of tomorrow.' },
        3: { title: 'Reality Builder', text: 'Reality is just software. And I have admin access.' }
    },
    SHAMAN: {
        0: {
            title: 'Rune Shaman',
            text: 'The spirits are quiet. I paint the first rune on the cave wall.'
        },
        1: { title: 'Rune Seer', text: 'The inscriptions glow. I see the patterns in the mempool.' },
        2: { title: 'Rune Prophet', text: 'The chain whispers to me. I channel the energy of genesis.' },
        3: { title: 'Rune Deity', text: 'I am the starlight. The ancient runes obey my will.' }
    },
    KEEPER: {
        0: { title: 'Keeper of Lore', text: 'Dusting off old blocks. History begins here.' },
        1: { title: 'Chronicler', text: 'Recording the truth. Every transaction is a story told.' },
        2: {
            title: 'Grand Archivist',
            text: 'Guardian of the Library. Knowledge is the ultimate currency.'
        },
        3: { title: 'Omniscient', text: 'I am the data. Past, present, and future are one.' }
    },
    WALKER: {
        0: { title: 'First Walker', text: 'First footprints in the sand. I was there when it started.' },
        1: { title: 'Ancient Witness', text: 'Watching the ecosystem grow. I stand while others fall.' },
        2: { title: 'Primordial', text: 'Time means nothing. I am a pillar of the community.' },
        3: { title: 'Timeless Entity', text: 'I am the timeline. The Alpha and the Omega.' }
    },
    LORD: {
        0: { title: 'The Steward', text: 'A single drop of water in an endless desert. Hope remains.' },
        1: { title: 'The Gardener', text: 'Life returns. I nurture the flow of the first oasis.' },
        2: { title: 'Oasis King', text: 'The rivers obey. I bring abundance to the wasteland.' },
        3: {
            title: 'Eternal Sovereign',
            text: 'I am the source. Where I step, the desert turns to paradise.'
        }
    },
    PRIME: {
        0: { title: 'Solar Sovereign', text: 'Absolute perfection. The convergence of light and order.' },
        1: { title: 'Solar Sovereign', text: 'Absolute perfection. The convergence of light and order.' },
        2: { title: 'Solar Sovereign', text: 'Absolute perfection. The convergence of light and order.' },
        3: { title: 'Solar Sovereign', text: 'Absolute perfection. The convergence of light and order.' }
    },
    SINGULARITY: {
        0: { title: 'Event Horizon', text: 'The code ends with me. I am the void.' },
        1: { title: 'Event Horizon', text: 'The code ends with me. I am the void.' },
        2: { title: 'Event Horizon', text: 'The code ends with me. I am the void.' },
        3: { title: 'Event Horizon', text: 'The code ends with me. I am the void.' }
    }
};

const __loadScriptOnce = async (src, globalKey) => {
    try {
        if (globalKey && window[globalKey]) return window[globalKey];
    } catch (_) {}

    window.__fennecScriptOnce =
        window.__fennecScriptOnce && typeof window.__fennecScriptOnce === 'object' ? window.__fennecScriptOnce : {};

    const key = String(src || '').trim();
    if (!key) return null;
    if (window.__fennecScriptOnce[key]) return await window.__fennecScriptOnce[key];

    window.__fennecScriptOnce[key] = new Promise((resolve, reject) => {
        try {
            const existing = document.querySelector(`script[src="${key}"]`);
            if (existing) {
                const done = () => {
                    try {
                        if (globalKey && window[globalKey]) resolve(window[globalKey]);
                        else resolve(true);
                    } catch (_) {
                        resolve(true);
                    }
                };
                if (existing.dataset.loaded === '1') return done();
                existing.addEventListener('load', () => {
                    existing.dataset.loaded = '1';
                    done();
                });
                existing.addEventListener('error', () => reject(new Error('script load failed')));
                return;
            }

            const s = document.createElement('script');
            s.src = key;
            s.async = true;
            s.crossOrigin = 'anonymous';
            s.onload = () => {
                s.dataset.loaded = '1';
                try {
                    if (globalKey && window[globalKey]) resolve(window[globalKey]);
                    else resolve(true);
                } catch (_) {
                    resolve(true);
                }
            };
            s.onerror = () => reject(new Error('script load failed'));
            document.head.appendChild(s);
        } catch (e) {
            reject(e);
        }
    });

    return await window.__fennecScriptOnce[key];
};

const __captureFennecIdPng = async () => {
    try {
        const html2canvas = await __loadScriptOnce(
            'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
            'html2canvas'
        );
        if (typeof html2canvas !== 'function') return null;

        const iframe = document.getElementById('fennecIdIframe');
        if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return null;

        try {
            if (iframe.contentWindow.__fennecTiltGlobalResetAll) iframe.contentWindow.__fennecTiltGlobalResetAll();
        } catch (_) {}

        await new Promise(r => setTimeout(r, 60));

        const doc = iframe.contentDocument;
        const root = doc.querySelector('.card-object') || doc.querySelector('.card-scene') || doc.body;
        if (!root) return null;

        const prev = {
            transform: root.style.transform,
            transition: root.style.transition,
            willChange: root.style.willChange
        };
        try {
            root.style.transform = 'none';
            root.style.transition = 'none';
            root.style.willChange = 'auto';
        } catch (_) {}

        const scale = Math.min(2, window.devicePixelRatio || 1);
        const canvas = await html2canvas(root, {
            backgroundColor: null,
            scale,
            useCORS: true,
            allowTaint: false,
            logging: false
        });

        try {
            root.style.transform = prev.transform;
            root.style.transition = prev.transition;
            root.style.willChange = prev.willChange;
        } catch (_) {}

        const rounded = document.createElement('canvas');
        rounded.width = canvas.width;
        rounded.height = canvas.height;
        const ctx = rounded.getContext('2d');
        if (!ctx) return null;

        const radius = Math.max(8, Math.round(32 * scale));
        ctx.clearRect(0, 0, rounded.width, rounded.height);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(rounded.width - radius, 0);
        ctx.quadraticCurveTo(rounded.width, 0, rounded.width, radius);
        ctx.lineTo(rounded.width, rounded.height - radius);
        ctx.quadraticCurveTo(rounded.width, rounded.height, rounded.width - radius, rounded.height);
        ctx.lineTo(radius, rounded.height);
        ctx.quadraticCurveTo(0, rounded.height, 0, rounded.height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();

        const blob = await new Promise(resolve => {
            try {
                rounded.toBlob(resolve, 'image/png');
            } catch (_) {
                resolve(null);
            }
        });
        if (!blob) return null;
        return blob;
    } catch (e) {
        return null;
    }
};

// Premium Twitter Share Function (with image on mobile via Web Share API)
async function shareIdentityOnX() {
    if (!window.auditIdentity || !window.auditIdentity.archetype) {
        try {
            if (typeof showNotification === 'function') showNotification('Please load your ID first!', 'warning');
            else alert('Please load your ID first!');
        } catch (_) {}
        return;
    }

    const btns = document.querySelectorAll('.share-x-btn');
    btns.forEach(b => {
        try {
            if (!b.dataset.original) b.dataset.original = b.innerHTML;
            b.disabled = true;
            b.innerHTML =
                '<i class="fas fa-spinner fa-spin"></i><span class="tracking-widest text-xs">PREPARING SHARE</span>';
        } catch (_) {}
    });

    try {
        const arch = window.auditIdentity.archetype;
        const metrics = window.auditIdentity.metrics || {};
        const baseKey = String(arch.baseKey || 'DRIFTER').toUpperCase();
        const tier = Math.min(Math.max(Number(arch.tierLevel || 0) || 0, 0), 3);

        const classData = FENNEC_LORE_DB[baseKey] || FENNEC_LORE_DB.DRIFTER;
        const tierTitle = classData && classData[tier] ? classData[tier].title : String(arch.title || baseKey);
        const tierText = classData && classData[tier] ? classData[tier].text : 'Legacy verified.';

        const rarityName = String(metrics.rarityName || 'CUB').toUpperCase();
        const score = Number(metrics.activityScore || 0) || 0;

        const rarityMap = {
            CUB: { icon: '⚪' },
            SCOUT: { icon: '🟢' },
            HUNTER: { icon: '🔵' },
            ALPHA: { icon: '🔴' },
            ELDER: { icon: '🟡' },
            SPIRIT: { icon: '🌈' }
        };
        const rInfo = rarityMap[rarityName] || { icon: '⚪' };

        const classIcons = {
            DRIFTER: '🌪️',
            MERCHANT: '💰',
            ENGINEER: '🛠️',
            SHAMAN: '🔮',
            KEEPER: '📚',
            WALKER: '🚶',
            LORD: '👑',
            PRIME: '🌟',
            SINGULARITY: '🌌'
        };
        const cIcon = classIcons[baseKey] || '🦊';

        let text = 'FENNEC ID // IDENTITY CONFIRMED 🦊\n\n';
        text += `🧬 Class: ${baseKey} ${cIcon}\n`;
        text += `⚡ Title: ${String(tierTitle || '').toUpperCase()} (Tier ${tier})\n`;
        text += `${rInfo.icon} Evolution: ${rarityName} (${score}/100)\n\n`;
        text += `"${tierText}"\n\n`;
        text += 'Verified by @FennecBTC on @fractal_bitcoin\n';
        text += 'fennecbtc.xyz';

        try {
            const imageBlob = await __captureFennecIdPng();
            if (imageBlob && navigator.clipboard && typeof navigator.clipboard.write === 'function') {
                try {
                    if (window.ClipboardItem) {
                        await navigator.clipboard.write([
                            new ClipboardItem({
                                'image/png': imageBlob
                            })
                        ]);
                        try {
                            if (typeof showNotification === 'function')
                                showNotification('Card screenshot copied to clipboard', 'success', 1800);
                        } catch (_) {}
                    }
                } catch (_) {
                    try {
                        const url = URL.createObjectURL(imageBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'fennec-id.png';
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                            try {
                                URL.revokeObjectURL(url);
                            } catch (_) {}
                            try {
                                a.remove();
                            } catch (_) {}
                        }, 200);
                        try {
                            if (typeof showNotification === 'function')
                                showNotification('Clipboard blocked — downloaded PNG instead', 'warning', 2200);
                        } catch (_) {}
                    } catch (_) {}
                }
            }
        } catch (_) {}

        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'width=550,height=420');
    } finally {
        setTimeout(() => {
            btns.forEach(b => {
                try {
                    b.disabled = false;
                    b.innerHTML = b.dataset.original || '<i class="fab fa-x-twitter"></i> SHARE';
                } catch (_) {}
            });
        }, 450);
    }
}
window.shareIdentityOnX = shareIdentityOnX;

// Prefetch Fennec Audit - background silent loading (dedup + returns identity)
async function __legacy_prefetchFennecAudit(silent = true) {
    try {
        try {
            if (localStorage.getItem('fennec_wallet_manual_disconnect') === '1') return null;
        } catch (_) {}

        const addr = String(window.userAddress || userAddress || '').trim();
        if (!addr) return null;

        const cacheKey = `audit_v3_${addr}`;
        const now = Date.now();

        if (
            window.prefetchedFennecAuditAddr === addr &&
            window.prefetchedFennecAudit &&
            now - window.prefetchedFennecAuditTs < 300000
        ) {
            return window.prefetchedFennecAudit;
        }

        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const cachedData = JSON.parse(cached);
                if (cachedData && cachedData.identity && now - Number(cachedData.timestamp || 0) < 5 * 60 * 1000) {
                    window.prefetchedFennecAudit = cachedData.identity;
                    window.prefetchedFennecAuditAddr = addr;
                    window.prefetchedFennecAuditTs = now;
                    return window.prefetchedFennecAudit;
                }
            }
        } catch (_) {}

        window.__fennecPrefetchAudit =
            window.__fennecPrefetchAudit && typeof window.__fennecPrefetchAudit === 'object'
                ? window.__fennecPrefetchAudit
                : { promise: null, addr: '', failTs: 0, failAddr: '' };

        try {
            const failAddr = String(window.__fennecPrefetchAudit.failAddr || '').trim();
            const failTs = Number(window.__fennecPrefetchAudit.failTs || 0) || 0;
            if (failAddr && failAddr === addr && failTs > 0 && now - failTs < 60000) {
                return null;
            }
        } catch (_) {}

        if (window.__fennecPrefetchAudit.promise && window.__fennecPrefetchAudit.addr === addr) {
            return await window.__fennecPrefetchAudit.promise;
        }

        if (typeof fetchAuditData !== 'function' || typeof calculateFennecIdentity !== 'function') return null;

        window.__fennecPrefetchAudit.addr = addr;
        window.__fennecPrefetchAudit.promise = (async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 90000);
            try {
                const data = await fetchAuditData(controller.signal, true).catch(() => null);
                if (!data) {
                    try {
                        if (window.__fennecPrefetchAudit && typeof window.__fennecPrefetchAudit === 'object') {
                            window.__fennecPrefetchAudit.failTs = Date.now();
                            window.__fennecPrefetchAudit.failAddr = addr;
                        }
                    } catch (_) {}
                    return null;
                }

                const identity = calculateFennecIdentity(data);
                if (!identity || typeof identity !== 'object') {
                    try {
                        if (window.__fennecPrefetchAudit && typeof window.__fennecPrefetchAudit === 'object') {
                            window.__fennecPrefetchAudit.failTs = Date.now();
                            window.__fennecPrefetchAudit.failAddr = addr;
                        }
                    } catch (_) {}
                    return null;
                }

                identity.metrics = identity.metrics && typeof identity.metrics === 'object' ? identity.metrics : {};
                identity.metrics.address = addr;

                window.prefetchedFennecAudit = identity;
                window.prefetchedFennecAuditAddr = addr;
                window.prefetchedFennecAuditTs = Date.now();

                try {
                    localStorage.setItem(cacheKey, JSON.stringify({ identity, timestamp: Date.now() }));
                } catch (_) {}

                return identity;
            } finally {
                clearTimeout(timeout);
            }
        })().finally(() => {
            try {
                window.__fennecPrefetchAudit.promise = null;
                window.__fennecPrefetchAudit.addr = '';
            } catch (_) {}
        });

        return await window.__fennecPrefetchAudit.promise;
    } catch (e) {
        try {
            if (!silent) console.log('Prefetch audit fail:', e?.message || String(e));
        } catch (_) {}
        return null;
    }
}
window.prefetchFennecAudit = window.prefetchFennecAudit || __legacy_prefetchFennecAudit;

window.__fidRateLimit = window.__fidRateLimit || {};
window.__fidCanRun = function (action, addr, minMs) {
    try {
        const a = String(addr || '').trim();
        if (!a) return { ok: true, waitMs: 0 };
        const key = String(action || '').trim() || 'action';
        const now = Date.now();
        const ms = Number(minMs || 0) || 30000;
        window.__fidRateLimit[a] =
            window.__fidRateLimit[a] && typeof window.__fidRateLimit[a] === 'object' ? window.__fidRateLimit[a] : {};
        const last = Number(window.__fidRateLimit[a][key] || 0) || 0;
        const dt = now - last;
        if (dt < ms) return { ok: false, waitMs: ms - dt };
        window.__fidRateLimit[a][key] = now;
        return { ok: true, waitMs: 0 };
    } catch (_) {
        return { ok: true, waitMs: 0 };
    }
};

window.openFennecIdInternal = async function (event) {
    try {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
    } catch (_) {}
    const addr = String(window.userAddress || userAddress || '').trim();
    if (!addr) {
        try {
            if (typeof showNotification === 'function') {
                showNotification('Connect wallet first', 'warning', 2000);
            }
        } catch (_) {}
        try {
            if (typeof window.initAudit === 'function') await window.initAudit();
        } catch (_) {}
        return;
    }

    {
        let shouldResetSuppress = false;
        try {
            const ui =
                window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object' ? window.__fennecAuditUi : null;
            const uiAddr = String((ui && ui.addr) || '').trim();
            const uiMode = String((ui && ui.mode) || 'idle');
            const uiScannedAt = Number((ui && ui.scannedAt) || 0) || 0;
            const scannedOk = !!(
                uiAddr &&
                uiAddr === addr &&
                (uiMode === 'scanned' || uiMode === 'opening' || uiMode === 'opened') &&
                uiScannedAt > 0 &&
                !window.auditLoading
            );
            if (!scannedOk && typeof window.runAudit === 'function') {
                try {
                    window.__fennecSuppressAutoOpenAfterScan = true;
                    shouldResetSuppress = true;
                } catch (_) {}
                await window.runAudit(true);
            }
            const start = Date.now();
            while (window.auditLoading && Date.now() - start < 95000) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        } catch (_) {
        } finally {
            if (shouldResetSuppress) {
                try {
                    window.__fennecSuppressAutoOpenAfterScan = false;
                } catch (_) {}
            }
        }
    }

    {
        let shouldResetSuppress = false;
        try {
            const hasIdentityForAddr = () => {
                try {
                    const curAddr = String(addr || '').trim();
                    const ai =
                        window.auditIdentity && typeof window.auditIdentity === 'object' ? window.auditIdentity : null;
                    const aiAddr = String(ai?.metrics?.address || ai?.address || '').trim();
                    return !!(ai && curAddr && (!aiAddr || aiAddr === curAddr));
                } catch (_) {
                    return false;
                }
            };

            if (!hasIdentityForAddr()) {
                try {
                    window.__fennecSuppressAutoOpenAfterScan = true;
                    shouldResetSuppress = true;
                } catch (_) {}

                try {
                    if (window.auditLoading) {
                        const start = Date.now();
                        while (window.auditLoading && Date.now() - start < 95000) {
                            await new Promise(resolve => setTimeout(resolve, 250));
                        }
                    }
                } catch (_) {}

                if (!hasIdentityForAddr()) {
                    try {
                        if (typeof window.runAudit === 'function') {
                            await window.runAudit(false);
                        }
                    } catch (_) {}

                    try {
                        if (window.auditLoading) {
                            const start = Date.now();
                            while (window.auditLoading && Date.now() - start < 95000) {
                                await new Promise(resolve => setTimeout(resolve, 250));
                            }
                        }
                    } catch (_) {}
                }
            }
        } catch (_) {
        } finally {
            if (shouldResetSuppress) {
                try {
                    window.__fennecSuppressAutoOpenAfterScan = false;
                } catch (_) {}
            }
        }
    }

    try {
        const curAddr = String(addr || '').trim();
        const ai = window.auditIdentity && typeof window.auditIdentity === 'object' ? window.auditIdentity : null;
        const aiAddr = String(ai?.metrics?.address || ai?.address || '').trim();
        const haveIdentity = !!(ai && curAddr && (!aiAddr || aiAddr === curAddr));
        if (!haveIdentity) {
            try {
                if (typeof showNotification === 'function') {
                    showNotification('Please scan your ID first', 'warning', 2200);
                }
            } catch (_) {}
            return;
        }
    } catch (_) {}

    // ВАЖНО: сначала рисуем opening UI, затем выполняем любые долгие await
    try {
        window.__fennecAuditUi =
            window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object' ? window.__fennecAuditUi : {};
        window.__fennecAuditUi.addr = addr;
        window.__fennecAuditUi.mode = 'opening';
        window.__fennecAuditUi.openedAt = Date.now();
    } catch (_) {}

    try {
        if (typeof window.initAudit === 'function') await window.initAudit();
    } catch (_) {}

    try {
        await new Promise(resolve =>
            window.requestAnimationFrame ? window.requestAnimationFrame(resolve) : setTimeout(resolve, 0)
        );
    } catch (_) {}

    let id = String((window.__fennecIdStatus && window.__fennecIdStatus.inscriptionId) || '').trim();
    if (!id) {
        try {
            if (typeof window.refreshFennecIdStatus === 'function') {
                await window.refreshFennecIdStatus(false);
                id = String((window.__fennecIdStatus && window.__fennecIdStatus.inscriptionId) || '').trim();
            }
        } catch (_) {}
    }
    if (!id) {
        try {
            if (typeof window.refreshFennecIdStatus === 'function') {
                await window.refreshFennecIdStatus(true, true);
                id = String((window.__fennecIdStatus && window.__fennecIdStatus.inscriptionId) || '').trim();
            }
        } catch (_) {}
    }

    if (!id) {
        try {
            if (typeof showNotification === 'function') {
                showNotification('No Fennec ID found for this wallet', 'warning', 2500);
            } else {
                alert('No Fennec ID found for this wallet');
            }
        } catch (_) {}
        return;
    }

    try {
        const btn = document.getElementById('fidOpenBtn');
        if (btn) {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.style.visibility = 'hidden';
        }
    } catch (_) {}

    let openedOk = false;
    try {
        let identityForOpen = null;
        try {
            const curAddr = String(addr || '').trim();
            const ai = window.auditIdentity && typeof window.auditIdentity === 'object' ? window.auditIdentity : null;
            const aiAddr = String(ai?.metrics?.address || ai?.address || '').trim();
            if (ai && curAddr && (!aiAddr || aiAddr === curAddr)) {
                try {
                    ai.metrics = ai.metrics && typeof ai.metrics === 'object' ? ai.metrics : {};
                    ai.metrics.address = curAddr;
                } catch (_) {}
                identityForOpen = ai;
            }
        } catch (_) {}
        if (!identityForOpen && typeof window.prefetchFennecAudit === 'function') {
            try {
                identityForOpen = await Promise.race([
                    window.prefetchFennecAudit(true),
                    new Promise(resolve => setTimeout(() => resolve(null), 900))
                ]);
            } catch (_) {}
        }

        await loadExistingCardIntoIframe(id, identityForOpen);
        openedOk = true;
        window.__fennecAuditUi.mode = 'opened';
    } catch (e) {
        try {
            showNotification('Failed to open ID', 'error', 2500);
        } catch (_) {}
        window.__fennecAuditUi.mode = 'idle';
        throw e;
    } finally {
        try {
            const openBtn = document.getElementById('fidOpenBtn');
            if (openBtn) openBtn.style.display = openedOk ? 'none' : '';
            if (openBtn) openBtn.disabled = openedOk ? true : false;
            if (openBtn && !openedOk) {
                openBtn.style.pointerEvents = '';
                openBtn.style.visibility = '';
            }
            const openTxt = document.getElementById('fidOpenBtnText') || openBtn;
            if (openTxt && !openedOk) openTxt.textContent = 'OPEN ID';

            const wrap = document.getElementById('fidActionButtons');
            if (wrap) wrap.style.display = openedOk ? '' : 'none';
            const updBtn = document.getElementById('fidUpdateBtn');
            const refBtn = document.getElementById('fidRefreshBtn');
            if (updBtn) updBtn.style.display = openedOk ? '' : 'none';
            if (refBtn) refBtn.style.display = openedOk ? '' : 'none';
        } catch (_) {}
    }
};

window.refreshScannedIdentity = async function (event) {
    try {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
    } catch (_) {}
    const addr = String(window.userAddress || userAddress || '').trim();
    const rl = window.__fidCanRun('scan_refresh', addr, 30000);
    if (!rl.ok) {
        try {
            showNotification(`Please wait ${Math.ceil(rl.waitMs / 1000)}s`, 'warning', 1800);
        } catch (_) {}
        return;
    }
    try {
        if (typeof window.runAudit === 'function') await window.runAudit(true);
    } catch (_) {}
};

window.getLastMintedCardForAddress = function (addr) {
    try {
        const a = String(addr || '').trim();
        if (!a) return null;
        const all = JSON.parse(localStorage.getItem(fennecMintedCardsKey()) || '[]');
        if (!Array.isArray(all) || all.length === 0) return null;
        const filtered = all
            .filter(x => x && typeof x === 'object' && String(x.address || '').trim() === a)
            .sort((x, y) => (Number(y.timestamp || 0) || 0) - (Number(x.timestamp || 0) || 0));
        return filtered[0] || null;
    } catch (_) {
        return null;
    }
};

window.updateVisionFennecIdCta = function () {
    const btn = document.getElementById('visionFennecIdBtn');
    const textEl = document.getElementById('visionFennecIdBtnText');
    if (!btn || !textEl) return;

    const addr = (userAddress || window.userAddress || '').trim();
    const st = window.__fennecIdStatus && typeof window.__fennecIdStatus === 'object' ? window.__fennecIdStatus : null;

    if (!addr) {
        textEl.textContent = 'FENNEC ID';
        btn.disabled = false;
        return;
    }

    if (st && st.loading) {
        textEl.textContent = 'SYNCING…';
        btn.disabled = true;
        return;
    }

    if (st && st.hasId) {
        textEl.textContent = 'OPEN MY ID';
        btn.disabled = false;
        return;
    }

    textEl.textContent = 'SCAN MY IDENTITY';
    btn.disabled = false;
};

window.refreshFennecIdStatus = async function (force = false, allowWalletScan = false) {
    const addr = (userAddress || window.userAddress || '').trim();
    if (!addr) {
        if (window.__fennecIdStatus) {
            window.__fennecIdStatus.loading = false;
            window.__fennecIdStatus.hasId = false;
            window.__fennecIdStatus.inscriptionId = '';
            window.__fennecIdStatus.source = '';
            window.__fennecIdStatus.addr = '';
            try {
                window.__fennecIdStatus.promise = null;
            } catch (_) {}
        }
        if (typeof window.updateVisionFennecIdCta === 'function') window.updateVisionFennecIdCta();
        return;
    }

    const st = window.__fennecIdStatus;
    if (!st || typeof st !== 'object') return;
    const walletScanAllowed = !!allowWalletScan;
    if (st.addr && st.addr !== addr) {
        st.loading = false;
        st.hasId = false;
        st.inscriptionId = '';
        st.source = '';
        try {
            st.promise = null;
        } catch (_) {}
    }
    if (st.loading) {
        try {
            if (st.promise) return await st.promise;
        } catch (_) {}
        return;
    }
    st.addr = addr;

    st.loading = true;
    if (typeof window.updateVisionFennecIdCta === 'function') window.updateVisionFennecIdCta();

    st.promise = (async () => {
        const lsKey = fennecIdKeyV2(addr);
        const nfKey = `fennec_id_child_v3_nf_${FENNEC_ID_EPOCH}_${addr}`;

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const tryKvLookup = async cacheOpt => {
            try {
                const kvRes = await fetch(
                    `${BACKEND_URL}?action=fennec_id_lookup&address=${encodeURIComponent(addr)}`,
                    cacheOpt
                )
                    .then(r => (r.ok ? r.json().catch(() => null) : null))
                    .catch(() => null);
                const kvId = String(kvRes?.data?.inscriptionId || '').trim();
                const kvUpdatedAt = Number(kvRes?.data?.updatedAt || 0) || 0;
                const epochMs = Date.parse(`${FENNEC_ID_EPOCH}T00:00:00Z`) || 0;
                const kvOk = kvUpdatedAt > 0 && epochMs > 0 ? kvUpdatedAt >= epochMs : true;
                const kvNull = !!(kvRes && kvRes.code === 0 && !kvRes.data);
                return { kvId, kvOk, kvNull };
            } catch (_) {
                return { kvId: '', kvOk: false, kvNull: false };
            }
        };

        let kvId = '';
        let kvOk = false;
        let skipKvLookup = false;
        try {
            if (!force) {
                const nfTs = Number(localStorage.getItem(nfKey) || 0) || 0;
                if (nfTs > 0 && Date.now() - nfTs < 10 * 60 * 1000) {
                    skipKvLookup = true;
                }
            }
        } catch (_) {}

        try {
            const rl =
                typeof window.__fidCanRun === 'function'
                    ? window.__fidCanRun(force ? 'kv_lookup_force' : 'kv_lookup', addr, force ? 30000 : 600000)
                    : { ok: true, waitMs: 0 };
            if (!rl.ok) skipKvLookup = true;
        } catch (_) {}

        if (!skipKvLookup) {
            for (let attempt = 0; attempt < 3; attempt++) {
                const cacheOpt = force || attempt > 0 ? { cache: 'no-store' } : { cache: 'force-cache' };
                const r = await tryKvLookup(cacheOpt);
                kvId = String(r?.kvId || '').trim();
                kvOk = !!r?.kvOk;
                if (kvId) break;
                if (r && r.kvNull) {
                    try {
                        localStorage.setItem(nfKey, String(Date.now()));
                    } catch (_) {}
                    break;
                }
                if (attempt < 2) await sleep(650);
            }
        }

        if (kvId) {
            st.hasId = true;
            st.inscriptionId = kvId;
            st.source = 'kv';
            try {
                localStorage.setItem(lsKey, kvId);
            } catch (_) {}
            try {
                localStorage.removeItem(nfKey);
            } catch (_) {}
            return;
        }

        if (!force) {
            const localKnown = String(localStorage.getItem(lsKey) || '').trim();
            if (localKnown) {
                st.hasId = true;
                st.inscriptionId = localKnown;
                st.source = 'localStorage_cache';
                return;
            }
        }
        const lastMint =
            typeof window.getLastMintedCardForAddress === 'function' ? window.getLastMintedCardForAddress(addr) : null;
        const lastMintId = String(lastMint?.inscriptionId || lastMint?.inscription_id || '').trim();

        if (lastMintId) {
            st.hasId = true;
            st.inscriptionId = lastMintId;
            st.source = 'minted_v2';
            try {
                localStorage.setItem(lsKey, lastMintId);
            } catch (_) {}
            return;
        }

        if (walletScanAllowed && window.unisat && typeof window.unisat.getInscriptions === 'function') {
            try {
                const inscriptions = await window.unisat.getInscriptions(0, 100);
                const list = Array.isArray(inscriptions?.list) ? inscriptions.list : [];
                const htmlCards = list.filter(
                    i =>
                        i &&
                        String(i.contentType || '')
                            .toLowerCase()
                            .includes('text/html')
                );
                const isFennecChildHtml = html => {
                    const s = String(html || '');
                    if (!s) return false;
                    const hasLib = /<meta\s+name=["']fennec-lib["']\s+content=/i.test(s);
                    const hasCfg = /<meta\s+name=["']fennec-config["']\s+content=/i.test(s);
                    if (hasLib && hasCfg) return true;
                    if (/<title>\s*Fennec\s*ID\s*<\/title>/i.test(s) && /id=["']fennec-root["']/i.test(s)) return true;
                    return false;
                };
                const fetchInscriptionHtml = async inscriptionId => {
                    const id = String(inscriptionId || '').trim();
                    if (!id) return '';
                    const url = `${BACKEND_URL}?action=inscription_content&inscriptionId=${encodeURIComponent(id)}`;
                    const res = await fetch(url, { cache: 'force-cache' });
                    if (!res.ok) return '';
                    const j = await res.json().catch(() => null);
                    const data = j && typeof j === 'object' ? j.data || null : null;
                    const html = String(data?.body || data?.contentBody || data?.content_body || '');
                    return html;
                };
                for (const it of htmlCards.slice(0, 50)) {
                    const id = String(it.inscriptionId || '').trim();
                    if (!id) continue;
                    const html = await fetchInscriptionHtml(id);
                    if (isFennecChildHtml(html)) {
                        st.hasId = true;
                        st.inscriptionId = id;
                        st.source = 'wallet_scan';
                        try {
                            localStorage.setItem(lsKey, id);
                        } catch (_) {}
                        return;
                    }
                }
            } catch (_) {}
        }

        st.hasId = false;
        st.inscriptionId = '';
        st.source = '';
    })().catch(e => {
        st.hasId = false;
        st.inscriptionId = '';
        st.source = '';
    });

    try {
        await st.promise;
    } finally {
        st.loading = false;
        try {
            st.promise = null;
        } catch (_) {}
        if (typeof window.updateVisionFennecIdCta === 'function') window.updateVisionFennecIdCta();
    }
};

window.onVisionFennecIdClick = async function () {
    try {
        if (typeof window.__fennecNavigate === 'function') {
            window.__fennecNavigate('id.html');
            return;
        }
        window.location.href = 'id.html';
    } catch (_) {}

    return;

    // ИСПРАВЛЕНИЕ: Проверяем подключение кошелька ПЕРЕД любыми действиями
    let addr = (userAddress || window.userAddress || '').trim();
    if (!addr) {
        try {
            if (typeof window.connectWallet === 'function') {
                await window.connectWallet();
            }
        } catch (_) {}
        addr = (userAddress || window.userAddress || '').trim();
        if (!addr) {
            // Кошелек не подключен - показываем UI с кнопками
            try {
                if (typeof window.initAudit === 'function') await window.initAudit();
            } catch (_) {}
            return;
        }

        // ВАЖНО: если кошелек был подключен ТОЛЬКО ЧТО, не запускаем ни OPEN, ни SCAN автоматически.
        // Пользователь должен явно нажать Open ID / Scan ID.
        try {
            if (typeof window.initAudit === 'function') await window.initAudit();
        } catch (_) {}
        return;
    }

    try {
        if (addr && typeof window.refreshFennecIdStatus === 'function') {
            await window.refreshFennecIdStatus(false);
        }
    } catch (_) {}

    try {
        const st =
            window.__fennecIdStatus && typeof window.__fennecIdStatus === 'object' ? window.__fennecIdStatus : null;
        const hasId = !!(st && st.hasId && String(st.inscriptionId || '').trim());
        if (hasId) {
            try {
                if (typeof window.initAudit === 'function') await window.initAudit();
            } catch (_) {}
            setTimeout(() => {
                try {
                    if (typeof window.openFennecIdInternal === 'function') window.openFennecIdInternal();
                } catch (_) {}
            }, 80);
            return;
        }
    } catch (_) {}

    setTimeout(() => {
        try {
            if (typeof window.runAudit === 'function') window.runAudit(false);
        } catch (_) {}
    }, 80);
};

try {
    if (typeof window.updateVisionFennecIdCta === 'function') window.updateVisionFennecIdCta();
} catch (_) {}

// ИСПРАВЛЕНИЕ: Функция запуска автообновления данных каждую минуту
function startAutoUpdate() {
    // Останавливаем предыдущий интервал, если есть
    stopAutoUpdate();

    window.__autoUpdateWanted = true;
    console.log('Starting auto-update (120s interval)');

    autoUpdateInterval = setInterval(async () => {
        if (!userAddress) {
            stopAutoUpdate();
            return;
        }

        console.log('Auto-updating data...');
        try {
            // ИСПРАВЛЕНИЕ: Блокируем загрузку терминала пока загружается аудит
            if (window.auditLoading) {
                console.log('Skipping terminal data load: audit is loading');
                return;
            }

            // Обновляем все данные параллельно
            await Promise.all([
                typeof checkBalance === 'function' ? checkBalance() : Promise.resolve(),
                typeof fetchReserves === 'function' ? fetchReserves() : Promise.resolve(),
                typeof updatePriceData === 'function' ? updatePriceData() : Promise.resolve(),
                typeof refreshTransactionHistory === 'function' ? refreshTransactionHistory() : Promise.resolve()
            ]);

            // ИСПРАВЛЕНИЕ: Если открыта вкладка аудита, НЕ обновляем аудит - только по кнопке пользователя
            const auditTab = document.getElementById('tab-audit');
            if (auditTab && auditTab.classList.contains('active')) {
                console.log('Audit tab active but auto-update disabled');
            }

            console.log('Auto-update completed');
        } catch (e) {
            console.warn('Auto-update error:', e);
        }
    }, 120000); // 60 секунд = 1 минута
}

// ИСПРАВЛЕНИЕ: Функция остановки автообновления
function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        console.log('Auto-update stopped');
    }
}

// ИСПРАВЛЕНИЕ: Функция обновления аудита (принудительное)
window.refreshAudit =
    window.refreshAudit ||
    function () {
        if (!userAddress) {
            if (typeof showNotification === 'function') {
                showNotification('Connect wallet first', 'warning', 2000);
            }
            return;
        }
        if (window.auditLoading) {
            if (typeof showNotification === 'function') {
                showNotification('Audit is already loading', 'warning', 2000);
            }
            return;
        }
        // Очищаем кэш и запускаем загрузку
        const cacheKey = `audit_${userAddress}`;
        localStorage.removeItem(cacheKey);
        window.runAudit(true); // forceRefresh = true
    };

// ИСПРАВЛЕНИЕ: Ручное обновление данных (с защитой от слишком частых обновлений)
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 60000; // 60 секунд между обновлениями
let refreshTimerInterval = null;

window.manualRefresh = async function () {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;

    // Проверяем, прошло ли достаточно времени
    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
        const remainingSeconds = Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000);
        showNotification(`Please wait ${remainingSeconds}s before refreshing again`, 'warning', 2000);
        return;
    }

    if (!userAddress && !window.userAddress) {
        showNotification('Connect wallet first', 'warning', 2000);
        return;
    }

    // Обновляем время последнего обновления
    lastRefreshTime = now;

    // Обновляем UI кнопки (header)
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    const refreshText = document.getElementById('refreshText');
    const refreshTimer = document.getElementById('refreshTimer');

    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (refreshIcon) {
        refreshIcon.classList.add('fa-spin');
    }
    if (refreshText) {
        refreshText.textContent = 'UPDATING...';
    }

    try {
        console.log('Manual refresh started...');

        // Обновляем все данные (БЕЗ аудита - аудит обновляется отдельно)
        await Promise.all([
            typeof checkBalance === 'function' ? checkBalance() : Promise.resolve(),
            typeof fetchReserves === 'function' ? fetchReserves() : Promise.resolve(),
            typeof updatePriceData === 'function' ? updatePriceData() : Promise.resolve(),
            typeof refreshTransactionHistory === 'function' ? refreshTransactionHistory() : Promise.resolve()
        ]);

        // ИСПРАВЛЕНИЕ: Аудит НЕ обновляется автоматически - пользователь обновляет его отдельной кнопкой

        showNotification('Data refreshed successfully', 'success', 2000);
        console.log('Manual refresh completed');

        // Запускаем таймер обратного отсчета
        startRefreshTimer();
    } catch (e) {
        console.error('Manual refresh error:', e);
        showNotification('Refresh failed: ' + (e.message || 'Unknown error'), 'error', 3000);
    } finally {
        // Восстанавливаем UI кнопки (но оставляем disabled до окончания таймера)
        if (refreshIcon) {
            refreshIcon.classList.remove('fa-spin');
        }
        if (refreshText) {
            refreshText.textContent = 'REFRESH';
        }
    }
};

// Таймер обратного отсчета для кнопки обновления
function startRefreshTimer() {
    if (refreshTimerInterval) {
        clearInterval(refreshTimerInterval);
    }

    const refreshTimer = document.getElementById('refreshTimer');
    const refreshBtn = document.getElementById('refreshBtn');

    if (!refreshTimer || !refreshBtn) return;

    let remainingSeconds = MIN_REFRESH_INTERVAL / 1000;
    refreshTimer.classList.remove('hidden');
    refreshTimer.textContent = `(${remainingSeconds}s)`;
    refreshBtn.disabled = true;
    refreshBtn.classList.add('opacity-50', 'cursor-not-allowed');

    refreshTimerInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            clearInterval(refreshTimerInterval);
            refreshTimerInterval = null;
            refreshTimer.classList.add('hidden');
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            refreshTimer.textContent = `(${remainingSeconds}s)`;
        }
    }, 1000);
}

window.toggleChat = function () {
    const win = document.getElementById('chatWindow');
    if (!win) return;
    win.classList.toggle('hidden');
    if (!win.classList.contains('hidden')) {
        win.classList.remove('scale-90', 'opacity-0');
        if (typeof renderChatHistory === 'function') {
            renderChatHistory();
        }
        const input = document.getElementById('chatInput');
        if (input) input.focus();
    } else {
        win.classList.add('scale-90', 'opacity-0');
    }
};

// Now define constants and variables
const BACKEND_URL = window.location.hostname.includes('vercel.app')
    ? '/api/proxy' // Vercel serverless function
    : window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
      ? 'http://127.0.0.1:8787' // Local wrangler dev
      : 'https://fennec-api.warninghejo.workers.dev'; // Cloudflare Worker fallback
const FENNEC_ID_VERSION = '6.0';
const PRIMARY_CHILD_LIB = '961a15289f9ec4fb594a7543a5bc4cd94ce6feed2c7df994e8bfa456ada28a5ai0';
const PRIMARY_CHILD_CONFIG = 'ffc50199c26d7037f82ef6a3d8406e6eb483c8a24a3dc396a39768e171f58225i0';
const PRIMARY_MANIFEST_REF = '9327b39aa5676ce0be200ce41e3eebe91569fddb0e6c92ec946f996618a54d45i0';
const DEFAULT_MANIFEST_URL = '/recursive_inscriptions/fennec_manifest_live.json';
const T_SFB = 'sFB___000';
const T_FENNEC = 'FENNEC';
const T_BTC = 'BTC';
const T_SBTC = 'sBTC___000'; // ВАЖНО: Правильный тикер для пула sBTC/FB

async function safeFetchJson(url, options = {}) {
    const method = options.method || 'GET';
    const headers = options.headers;
    const body = options.body;
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 12000;
    const retries = typeof options.retries === 'number' ? options.retries : 2;
    const retryDelayMs = typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 700;

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { method, headers, body, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) {
                lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
                    continue;
                }
                return null;
            }

            return await res.json();
        } catch (e) {
            clearTimeout(timeoutId);
            lastErr = e;
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
                continue;
            }
            console.warn('safeFetchJson failed:', url, lastErr);
            return null;
        }
    }
    return null;
}

try {
    window.safeFetchJson = window.safeFetchJson || safeFetchJson;
} catch (_) {}

function __fennecDedupe(key, fn) {
    try {
        const k = String(key || '').trim();
        const f = typeof fn === 'function' ? fn : null;
        if (!k || !f) return Promise.resolve().then(() => (f ? f() : null));
        window.__fennecInflight =
            window.__fennecInflight && typeof window.__fennecInflight === 'object' ? window.__fennecInflight : {};
        const inflight = window.__fennecInflight;
        if (inflight[k]) return inflight[k];
        const p = Promise.resolve()
            .then(() => f())
            .finally(() => {
                try {
                    delete inflight[k];
                } catch (_) {}
            });
        inflight[k] = p;
        return p;
    } catch (_) {
        try {
            return Promise.resolve().then(() => (typeof fn === 'function' ? fn() : null));
        } catch (e) {
            return Promise.reject(e);
        }
    }
}

function __looksLikeTxid(v) {
    const s = String(v || '').trim();
    return /^[0-9a-fA-F]{64}$/.test(s);
}

function __pickTxid(candidate) {
    if (!candidate) return '';
    if (typeof candidate === 'string') {
        const s = candidate.trim();
        return __looksLikeTxid(s) ? s : '';
    }
    if (typeof candidate === 'object') {
        const fields = [
            candidate.txid,
            candidate.txId,
            candidate.hash,
            candidate.tx_hash,
            candidate.receiveTxid,
            candidate.receiveTxId,
            candidate.receive_txid,
            candidate.approveTxid,
            candidate.approveTxId,
            candidate.approve_txid,
            candidate.rollUpTxid,
            candidate.rollUpTxId,
            candidate.rollUp_txid,
            candidate.paymentTxid,
            candidate.paymentTxId,
            candidate.inscribeTxid,
            candidate.inscribeTxId
        ];
        for (const f of fields) {
            const s = String(f || '').trim();
            if (__looksLikeTxid(s)) return s;
        }
    }
    return '';
}

let __prewarmCacheAt = 0;
async function prewarmBackendCaches() {
    const now = Date.now();
    if (now - __prewarmCacheAt < 30000) return;
    __prewarmCacheAt = now;
    try {
        const tasks = [];
        tasks.push(safeFetchJson(`${BACKEND_URL}?action=get_prices`, { timeoutMs: 8000, retries: 0 }));
        const addr = String(userAddress || window.userAddress || '').trim();
        if (addr) {
            tasks.push(
                safeFetchJson(`${BACKEND_URL}?action=summary&address=${encodeURIComponent(addr)}`, {
                    timeoutMs: 8000,
                    retries: 0
                })
            );
        }
        await Promise.all(tasks);
    } catch (_) {}
}

const FENNEC_REF_MODE_KEY = 'fennec_ref_mode_v1';
const FENNEC_REF_MODE_LOCAL_FIRST = 'local-first';
const FENNEC_REF_MODE_INSCRIPTION_FIRST = 'inscription-first';
const LOCAL_RECURSIVE_BASE = '/recursive_inscriptions';
const LOCAL_CHILD_LIB_URL = `${LOCAL_RECURSIVE_BASE}/fennec_lib_v2.js`;
const LOCAL_CHILD_CONFIG_URL = `${LOCAL_RECURSIVE_BASE}/fennec_config_v1.json`;
const LOCAL_MANIFEST_URL = `${LOCAL_RECURSIVE_BASE}/fennec_manifest_live.json`;
const LOCAL_CHILD_TEMPLATE_URL = `${LOCAL_RECURSIVE_BASE}/fennec_child_template_v1.html`;

function getFennecRefMode() {
    try {
        const v = String(localStorage.getItem(FENNEC_REF_MODE_KEY) || '').trim();
        if (v === FENNEC_REF_MODE_INSCRIPTION_FIRST) return FENNEC_REF_MODE_INSCRIPTION_FIRST;
        if (v === FENNEC_REF_MODE_LOCAL_FIRST) return FENNEC_REF_MODE_LOCAL_FIRST;
    } catch (_) {}
    try {
        const h = String(window.location.hostname || '').toLowerCase();
        if (h === '127.0.0.1' || h === 'localhost') return FENNEC_REF_MODE_LOCAL_FIRST;
        if (h.endsWith('.pages.dev')) return FENNEC_REF_MODE_LOCAL_FIRST;
    } catch (_) {}
    return FENNEC_REF_MODE_INSCRIPTION_FIRST;
}

window.setFennecRefMode = function (mode) {
    try {
        const m = String(mode || '').trim();
        const normalized =
            m === FENNEC_REF_MODE_INSCRIPTION_FIRST ? FENNEC_REF_MODE_INSCRIPTION_FIRST : FENNEC_REF_MODE_LOCAL_FIRST;
        try {
            localStorage.setItem(FENNEC_REF_MODE_KEY, normalized);
        } catch (_) {}
        if (typeof window.refreshFennecCoreRefs === 'function') {
            try {
                window.refreshFennecCoreRefs();
            } catch (_) {}
        }
    } catch (_) {}
};

function parseMetaFromHtml(html, name) {
    try {
        const s = String(html || '');
        const n = String(name || '').trim();
        if (!s || !n) return '';
        const re = new RegExp(
            '<meta[^>]*\\bname=["\\\']' + n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '["\\\'][^>]*>',
            'i'
        );
        const m = s.match(re);
        const tag = m && m[0] ? String(m[0]) : '';
        if (!tag) return '';
        const cm = tag.match(/\\bcontent=["\\']([^"\\']*)["\\']/i);
        return cm && cm[1] ? String(cm[1]).trim() : '';
    } catch (_) {
        return '';
    }
}

async function safeFetchText(url, options = {}) {
    const method = options.method || 'GET';
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 12000;
    const retries = typeof options.retries === 'number' ? options.retries : 1;
    const retryDelayMs = typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 700;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { method, signal: controller.signal, cache: 'no-store' });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            return await res.text();
        } catch (e) {
            clearTimeout(timeoutId);
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt)));
                continue;
            }
            return '';
        }
    }
    return '';
}

window.refreshFennecCoreRefs = async function () {
    const mode = getFennecRefMode();
    const cacheBust = `?t=${Date.now()}`;

    const local = {
        mode: FENNEC_REF_MODE_LOCAL_FIRST,
        manifestRef: LOCAL_MANIFEST_URL,
        libRef: LOCAL_CHILD_LIB_URL,
        configRef: LOCAL_CHILD_CONFIG_URL
    };

    let chainManifestRef = String(PRIMARY_MANIFEST_REF || '').trim();
    try {
        const html = await safeFetchText(`${LOCAL_CHILD_TEMPLATE_URL}${cacheBust}`, {
            timeoutMs: 4500,
            retries: 1
        });
        const m = parseMetaFromHtml(html, 'fennec-manifest');
        if (m) chainManifestRef = String(m).trim();
    } catch (_) {}
    if (!chainManifestRef) chainManifestRef = String(PRIMARY_MANIFEST_REF || '').trim();

    let chainLibRef = String(PRIMARY_CHILD_LIB || '').trim();
    let chainConfigRef = String(PRIMARY_CHILD_CONFIG || '').trim();
    try {
        const mj = await safeFetchJson(`${LOCAL_MANIFEST_URL}${cacheBust}`, {
            timeoutMs: 4500,
            retries: 1
        });
        const latest = mj && typeof mj === 'object' && mj.latest && typeof mj.latest === 'object' ? mj.latest : mj;
        const l = String(latest?.lib || latest?.libId || latest?.libraryId || '').trim();
        const c = String(latest?.config || latest?.configId || latest?.configurationId || '').trim();
        if (l) chainLibRef = l;
        if (c) chainConfigRef = c;
    } catch (_) {}

    const chain = {
        mode: FENNEC_REF_MODE_INSCRIPTION_FIRST,
        manifestRef: chainManifestRef,
        libRef: chainLibRef,
        configRef: chainConfigRef
    };

    const effective = mode === FENNEC_REF_MODE_INSCRIPTION_FIRST ? chain : local;

    window.__fennecCoreRefs = {
        mode,
        updatedAt: Date.now(),
        local,
        chain,
        effective
    };

    return window.__fennecCoreRefs;
};

window.getFennecCoreRefs = function (purpose) {
    const p = String(purpose || '').trim();
    const st = window.__fennecCoreRefs && typeof window.__fennecCoreRefs === 'object' ? window.__fennecCoreRefs : null;
    const chainFallback = {
        mode: FENNEC_REF_MODE_INSCRIPTION_FIRST,
        manifestRef: String(PRIMARY_MANIFEST_REF || DEFAULT_MANIFEST_URL || '').trim(),
        libRef: String(PRIMARY_CHILD_LIB || '').trim(),
        configRef: String(PRIMARY_CHILD_CONFIG || '').trim()
    };
    const localFallback = {
        mode: FENNEC_REF_MODE_LOCAL_FIRST,
        manifestRef: LOCAL_MANIFEST_URL,
        libRef: LOCAL_CHILD_LIB_URL,
        configRef: LOCAL_CHILD_CONFIG_URL
    };
    if (!st) return localFallback;
    if (p === 'mint') return st.local || localFallback;
    return (
        st.effective ||
        (getFennecRefMode() === FENNEC_REF_MODE_INSCRIPTION_FIRST ? st.chain : st.local) ||
        localFallback
    );
};

try {
    window.refreshFennecCoreRefs();
} catch (_) {}

const REQUIRED_NETWORK = 'FRACTAL_BITCOIN_MAINNET';
let userAddress = null,
    userPubkey = null,
    isBuying = true;
let switchWalletConfirmed = false; // Флаг подтверждения переключения кошелька
let autoUpdateInterval = null; // Интервал автообновления данных
let depositToken = 'BTC',
    withdrawToken = 'sFB';
let poolReserves = { sFB: 0, FENNEC: 0, BTC: 0, user_sBTC: 0 };
let currentSwapPair = 'FB_FENNEC'; // 'FB_FENNEC' or 'BTC_FB'
let userBalances = { sFB: 0, FENNEC: 0, BTC: 0 };
let walletBalances = { sFB: 0, FENNEC: 0, BTC: 0 };
const selectedInscriptions = [];
let chartTimeframe = '7d';
let priceChart = null;
const priceHistory = [];
const burrowLoop = null;
if (typeof window.auditIdentity === 'undefined') window.auditIdentity = null;
if (typeof window.auditLoading === 'undefined') window.auditLoading = false; // ИСПРАВЛЕНИЕ: Флаг активного аудита, чтобы не запускать повторно во время выполнения
if (typeof window.currentAuditRequestId === 'undefined') window.currentAuditRequestId = 0; // ИСПРАВЛЕНИЕ: Отслеживание текущего запроса для предотвращения race condition
if (typeof window.currentAuditAbortController === 'undefined') window.currentAuditAbortController = null; // ИСПРАВЛЕНИЕ: AbortController для отмены предыдущих запросов
if (typeof window.prefetchedFennecAudit === 'undefined') window.prefetchedFennecAudit = null;
if (typeof window.prefetchedFennecAuditAddr === 'undefined') window.prefetchedFennecAuditAddr = null;
if (typeof window.prefetchedFennecAuditTs === 'undefined') window.prefetchedFennecAuditTs = 0;

try {
    if (typeof window.isBuying === 'boolean') isBuying = window.isBuying;
} catch (_) {}
try {
    Object.defineProperty(window, 'isBuying', {
        get: () => isBuying,
        set: v => {
            isBuying = !!v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.isBuying = isBuying;
    } catch (_) {}
}

try {
    if (typeof window.currentSwapPair === 'string' && window.currentSwapPair) currentSwapPair = window.currentSwapPair;
} catch (_) {}
try {
    Object.defineProperty(window, 'currentSwapPair', {
        get: () => currentSwapPair,
        set: v => {
            currentSwapPair = String(v || '');
        },
        configurable: true
    });
} catch (_) {
    try {
        window.currentSwapPair = currentSwapPair;
    } catch (_) {}
}

try {
    if (typeof window.depositToken === 'string' && window.depositToken) depositToken = window.depositToken;
} catch (_) {}
try {
    Object.defineProperty(window, 'depositToken', {
        get: () => depositToken,
        set: v => {
            depositToken = String(v || '');
        },
        configurable: true
    });
} catch (_) {
    try {
        window.depositToken = depositToken;
    } catch (_) {}
}

try {
    if (typeof window.withdrawToken === 'string' && window.withdrawToken) withdrawToken = window.withdrawToken;
} catch (_) {}
try {
    Object.defineProperty(window, 'withdrawToken', {
        get: () => withdrawToken,
        set: v => {
            withdrawToken = String(v || '');
        },
        configurable: true
    });
} catch (_) {
    try {
        window.withdrawToken = withdrawToken;
    } catch (_) {}
}

try {
    if (window.userBalances && typeof window.userBalances === 'object') userBalances = window.userBalances;
} catch (_) {}
try {
    Object.defineProperty(window, 'userBalances', {
        get: () => userBalances,
        set: v => {
            if (v && typeof v === 'object') userBalances = v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.userBalances = userBalances;
    } catch (_) {}
}

try {
    if (window.walletBalances && typeof window.walletBalances === 'object') walletBalances = window.walletBalances;
} catch (_) {}
try {
    Object.defineProperty(window, 'walletBalances', {
        get: () => walletBalances,
        set: v => {
            if (v && typeof v === 'object') walletBalances = v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.walletBalances = walletBalances;
    } catch (_) {}
}

try {
    if (window.poolReserves && typeof window.poolReserves === 'object') poolReserves = window.poolReserves;
} catch (_) {}
try {
    Object.defineProperty(window, 'poolReserves', {
        get: () => poolReserves,
        set: v => {
            if (v && typeof v === 'object') poolReserves = v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.poolReserves = poolReserves;
    } catch (_) {}
}

try {
    window.BACKEND_URL = BACKEND_URL;
    window.T_SFB = T_SFB;
    window.T_FENNEC = T_FENNEC;
    window.T_BTC = T_BTC;
    window.T_SBTC = T_SBTC;
} catch (_) {}

const FENNEC_ID_EPOCH = '2026-01-02';
const fennecIdKeyV2 = addr => `fennec_id_child_v3_${String(addr || '').trim()}`;
const fennecMintedCardsKey = () => `fennec_minted_cards_v3_${FENNEC_ID_EPOCH}`;

function ensureMetaTag(name, value) {
    if (!name) return;
    const v = String(value || '').trim();
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
    }
    el.setAttribute('content', v);
}

window.setDebugAuditIdentity = function (identity) {
    try {
        window.auditIdentity = identity;
        if (identity && identity.metrics) {
            identity.metrics.address = identity.metrics.address || userAddress || window.userAddress || '';
        }
        if (typeof window.initAudit === 'function') {
            __fennecInitAuditSafe();
        }
        if (typeof switchTab === 'function') {
            switchTab('audit');
        }
    } catch (e) {
        console.error('setDebugAuditIdentity error:', e);
    }
};
let currentLang = 'en';
let depositFeeRate = 2; // Default medium fee
let withdrawFeeRate = 2; // Default medium fee
let fractalFees = { fastestFee: 1, halfHourFee: 1, hourFee: 1 }; // Cached fees

// Language translations
const LANG = {
    en: {
        swap_action: 'GET FENNEC',
        swap_sell: 'SELL FENNEC',
        swap_bridge: 'BRIDGE BTC'
    },
    cn: {
        swap_action: '获取 FENNEC',
        swap_sell: '卖出 FENNEC',
        swap_bridge: '桥接 BTC'
    }
};

// ===== NETWORK CHECK FUNCTION (NO AUTO-SWITCH) =====
async function checkFractalNetwork() {
    try {
        const currentChain = await window.unisat.getChain();
        console.log('Current network:', currentChain);

        // UniSat returns string or object with enum property
        const chainName = typeof currentChain === 'string' ? currentChain : currentChain?.enum || currentChain;

        if (chainName !== REQUIRED_NETWORK) {
            throw new Error(`Please switch to Fractal Bitcoin Mainnet in your UniSat wallet.\nCurrent: ${chainName}`);
        }

        console.log('Network OK:', REQUIRED_NETWORK);
        return true;
    } catch (e) {
        console.error('Network check failed:', e);
        throw e;
    }
}

// ===== FORCE SWITCH NETWORK =====
async function switchToFractal() {
    try {
        console.log('Switching to Fractal mainnet...');
        await window.unisat.switchChain(REQUIRED_NETWORK);
        await new Promise(r => setTimeout(r, 2000)); // Wait 2 sec

        const verify = await window.unisat.getChain();
        console.log('Network after switch:', verify);
        return verify.enum === REQUIRED_NETWORK;
    } catch (e) {
        console.error('Switch failed:', e);
        return false;
    }
}
const activeTickers = { tick0: '', tick1: '' };

try {
    window.activeTickers = activeTickers;
} catch (_) {}

try {
    window.poolCache = { data: null, timestamp: 0, ttl: 30000 }; // 30 сек
} catch (_) {}

const poolCache = window.poolCache;
const balanceCache = { data: null, timestamp: 0, ttl: 60000 }; // 60 сек
let currentTheme = localStorage.getItem('fennec_theme') || 'dark';

// Переводы
const translations = {
    en: {
        connect: 'Connect',
        swap: 'Swap',
        deposit: 'Deposit',
        withdraw: 'Withdraw',
        youPay: 'YOU PAY',
        youReceive: 'YOU RECEIVE',
        balance: 'Balance',
        rate: 'Rate',
        pool: 'Pool',
        active: 'Active',
        swapTokens: 'SWAP TOKENS',
        depositBtn: 'DEPOSIT',
        withdrawBtn: 'WITHDRAW',
        recentActivity: 'Recent Activity',
        roadmap: 'Roadmap',
        priceChart: 'Price Chart'
    },
    cn: {
        connect: '连接',
        swap: '兑换',
        deposit: '存入',
        withdraw: '提取',
        youPay: '支付',
        youReceive: '接收',
        balance: '余额',
        rate: '汇率',
        pool: '池',
        active: '活跃',
        swapTokens: '兑换代币',
        depositBtn: '存入',
        withdrawBtn: '提取',
        recentActivity: '最近活动',
        roadmap: '路线图',
        priceChart: '价格图表'
    }
};

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('fennec_theme', currentTheme);

    const icon = document.getElementById('themeIcon');
    icon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    // Уведомление
    showNotification(currentTheme === 'dark' ? 'Dark Mode' : 'Light Mode');
}

function toggleLanguage() {
    currentLang = 'en';
    localStorage.setItem('fennec_lang', 'en');
    updateLanguage();
    // Обновляем элементы с data-t
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (LANG && LANG.en && LANG.en[key]) el.innerText = LANG.en[key];
    });
    showNotification('English only');
}

function updateLanguage() {
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.getAttribute('data-lang-key');
        if (translations[currentLang][key]) {
            el.innerText = translations[currentLang][key];
        }
    });
}

// Инициализация темы
document.documentElement.setAttribute('data-theme', currentTheme);
const themeIcon = document.getElementById('themeIcon');
if (themeIcon) {
    themeIcon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}
const langBtn = document.getElementById('langBtn');
if (langBtn) {
    langBtn.innerText = currentLang.toUpperCase();
}

// UI language is EN-only
currentLang = 'en';
localStorage.setItem('fennec_lang', 'en');
updateLanguage();
document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.getAttribute('data-t');
    if (LANG && LANG.en && LANG.en[key]) el.innerText = LANG.en[key];
});

// История транзакций
function addToHistory(type, amount, token, txid) {
    const history = JSON.parse(localStorage.getItem('fennec_history') || '[]');
    history.unshift({
        type,
        amount,
        token,
        txid: txid || 'pending',
        timestamp: Date.now()
    });
    // Храним только последние 5
    if (history.length > 5) history.pop();
    localStorage.setItem('fennec_history', JSON.stringify(history));
}

function showHistory() {
    const history = JSON.parse(localStorage.getItem('fennec_history') || '[]');
    if (history.length === 0) return '';
    return history
        .map(tx => {
            const time = new Date(tx.timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const typeLabel = __escapeHtml(String(tx.type || '').toUpperCase());
            const amountLabel = __escapeHtml(String(tx.amount ?? ''));
            const tokenLabel = __escapeHtml(String(tx.token ?? ''));
            const timeLabel = __escapeHtml(String(time || ''));
            return `<div class="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                                                                                                                        <span>${typeLabel}</span>
                                                                                                                        <span class="text-fennec">${amountLabel} ${tokenLabel}</span>
                                                                                                                        <span class="text-gray-500">${timeLabel}</span>
                                                                                                                    </div>`;
        })
        .join('');
}

function updateHistoryUI() {
    const html = showHistory();
    const section = document.getElementById('historySection');
    const list = document.getElementById('historyList');
    if (html) {
        list.innerHTML = html;
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
}

// Улучшенная валидация
function validateAmount(amount, type, token) {
    if (!amount || isNaN(amount) || amount <= 0) {
        return { valid: false, error: 'Please enter a valid amount' };
    }

    // Минимальные суммы
    const minAmounts = { swap: 0.00001, deposit: 1, withdraw: 1 };
    if (amount < minAmounts[type]) {
        return { valid: false, error: `Minimum ${type} amount: ${minAmounts[type]} ${token}` };
    }

    // Проверка баланса
    if (type === 'swap') {
        const bal = isBuying ? userBalances.sFB : userBalances.FENNEC;
        if (amount > bal) {
            return { valid: false, error: 'Insufficient balance. Go to Deposit tab.' };
        }
    } else if (type === 'withdraw') {
        const bal = token === 'FB' ? userBalances.sFB : userBalances.FENNEC;
        if (amount > bal) {
            return { valid: false, error: 'Insufficient balance on InSwap' };
        }
    }

    return { valid: true };
}

function showError(message) {
    document.getElementById('errorMsg').innerText = message;
    document.getElementById('errorModal').classList.remove('hidden');
}

function showSuccess(message, isMintEvent = false) {
    const modal = document.getElementById('successModal');
    const msgEl = document.getElementById('successTxId');
    msgEl.innerText = message;

    const modalBox = modal.querySelector('.modal-box');
    if (!modalBox) {
        modal.classList.remove('hidden');
        return;
    }

    const oldBtns = modalBox.querySelectorAll('button');
    oldBtns.forEach(b => b.remove());

    if (isMintEvent) {
        const shareBtn = document.createElement('button');
        shareBtn.className =
            'share-x-btn w-full px-6 py-4 bg-fennec/15 border border-fennec/50 rounded-xl text-white font-black shadow-[inset_0_0_18px_rgba(255,107,53,0.22),0_0_28px_rgba(255,107,53,0.10)] hover:bg-fennec/20 hover:border-orange-300 hover:shadow-[inset_0_0_22px_rgba(255,107,53,0.30),0_0_36px_rgba(255,107,53,0.16)] hover:scale-[1.01] transition-all flex items-center justify-center gap-3 mb-3 text-sm tracking-widest';
        shareBtn.innerHTML =
            '<i class="fab fa-x-twitter text-xl" style="color:#ffffff;opacity:0.95"></i><span>SHARE REVEAL</span>';
        shareBtn.onclick = () => {
            if (typeof window.shareIdentityOnX === 'function') window.shareIdentityOnX();
        };
        modalBox.appendChild(shareBtn);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'w-full text-xs text-gray-500 hover:text-white py-2 transition';
        closeBtn.innerText = 'CLOSE';
        closeBtn.onclick = () => modal.classList.add('hidden');
        modalBox.appendChild(closeBtn);
    } else {
        const okBtn = document.createElement('button');
        okBtn.className = 'w-full bg-green-600 text-black font-bold py-2 rounded-lg hover:bg-green-500 transition';
        okBtn.innerText = 'OK';
        okBtn.onclick = () => modal.classList.add('hidden');
        modalBox.appendChild(okBtn);
    }

    modal.classList.remove('hidden');
}

async function refreshBalancesInline() {
    try {
        await Promise.all([
            typeof fetchReserves === 'function' ? fetchReserves() : Promise.resolve(),
            userAddress && typeof checkBalance === 'function' ? checkBalance() : Promise.resolve()
        ]);
    } catch (_) {}
}

// Система уведомлений
function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notificationsContainer');
    const notification = document.createElement('div');
    notification.className = 'notification';

    const icons = {
        success: '',
        error: '',
        info: '',
        warning: '',
        swap: '',
        deposit: '',
        withdraw: ''
    };

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b',
        swap: '#FF6B35',
        deposit: '#10b981',
        withdraw: '#f59e0b'
    };

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.gap = '2px';
    wrap.style.width = '100%';

    const title = document.createElement('div');
    title.className = 'notification-title';
    title.style.color = colors[type] || colors.info;
    title.textContent = String(message || '');

    const timeEl = document.createElement('div');
    timeEl.className = 'notification-time';
    timeEl.textContent = new Date().toLocaleTimeString();

    wrap.appendChild(title);
    wrap.appendChild(timeEl);
    notification.appendChild(wrap);

    container.appendChild(notification);

    // Auto-remove
    setTimeout(() => {
        notification.classList.add('exit');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

const __terminalTabRefreshState = { last: { swap: 0, deposit: 0, withdraw: 0 } };
async function __refreshTerminalTab(tab, force = false) {
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
                typeof fetchReserves === 'function' ? fetchReserves() : Promise.resolve(),
                typeof refreshTransactionHistory === 'function' ? refreshTransactionHistory(false) : Promise.resolve(),
                typeof checkWhales === 'function' ? checkWhales() : Promise.resolve(),
                typeof checkBalance === 'function' ? checkBalance(false) : Promise.resolve()
            ]);
        } catch (_) {}
        return;
    }

    if (tab === 'deposit') {
        try {
            if (typeof loadFees === 'function') await loadFees('deposit');
        } catch (_) {}
        try {
            if (typeof checkBalance === 'function') await checkBalance(false);
        } catch (_) {}
        try {
            if (typeof refreshTransactionHistory === 'function') await refreshTransactionHistory(false);
        } catch (_) {}
        return;
    }

    if (tab === 'withdraw') {
        try {
            if (typeof loadFees === 'function') await loadFees('withdraw');
        } catch (_) {}
        try {
            if (typeof checkBalance === 'function') await checkBalance(false);
        } catch (_) {}
        try {
            if (typeof refreshTransactionHistory === 'function') await refreshTransactionHistory(false);
        } catch (_) {}
        return;
    }
}

function __legacy_switchTab(tab) {
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
        setDepositToken(depositToken, { skipFetch: true, skipFees: true });
        __refreshTerminalTab('deposit', false);
    }
    if (tab === 'withdraw') {
        updateWithdrawUI();
        __refreshTerminalTab('withdraw', false);
    }
    if (tab === 'swap') {
        __refreshTerminalTab('swap', false);
    }
    if (tab === 'pending') {
        refreshPendingOperations();
    }
}

var switchTab = window.switchTab || __legacy_switchTab;
try {
    window.switchTab = switchTab;
} catch (_) {}

// ИСПРАВЛЕНИЕ: Функция для добавления pending операции (минт, инскрипции и т.д.)
function addPendingOperation(operation) {
    try {
        const pendingOps = JSON.parse(localStorage.getItem('pending_operations') || '[]');
        // Проверяем, нет ли уже такой операции
        const opOrderId = String(operation?.orderId || '').trim();
        const opTxid = String(operation?.txid || '').trim();
        const opId = String(operation?.id || '').trim();
        const opKey = opOrderId || opTxid || opId;
        const exists = pendingOps.find(op => {
            if (!op || typeof op !== 'object') return false;
            if (String(op.type || '') !== String(operation?.type || '')) return false;
            const existingOrderId = String(op.orderId || '').trim();
            const existingTxid = String(op.txid || '').trim();
            const existingId = String(op.id || '').trim();
            const existingKey = existingOrderId || existingTxid || existingId;
            if (!existingKey || !opKey) return false;
            return existingKey === opKey;
        });
        if (!exists) {
            pendingOps.push(operation);
            localStorage.setItem('pending_operations', JSON.stringify(pendingOps));
            // Обновляем UI
            if (typeof refreshPendingOperations === 'function') {
                refreshPendingOperations();
            }
            try {
                if (typeof checkPendingMints === 'function') {
                    setTimeout(() => {
                        try {
                            checkPendingMints();
                        } catch (_) {}
                    }, 2500);
                }
            } catch (_) {}
        }
    } catch (e) {
        console.error('Failed to add pending operation:', e);
    }
}

function queueFennecIdRegister(entry) {
    try {
        const address = String(entry?.address || '').trim();
        const inscriptionId = String(entry?.inscriptionId || entry?.inscription_id || '').trim();
        if (!address || !inscriptionId) return;
        const key = 'fennec_id_register_queue_v2';
        const q = JSON.parse(localStorage.getItem(key) || '[]');
        const arr = Array.isArray(q) ? q : [];
        const exists = arr.some(
            x =>
                x &&
                String(x.address || '').trim() === address &&
                String(x.inscriptionId || '').trim() === inscriptionId
        );
        if (exists) return;
        arr.push({ address, inscriptionId, ts: Date.now(), attempts: 0 });
        localStorage.setItem(key, JSON.stringify(arr));

        try {
            if (typeof processFennecIdRegisterQueue === 'function') {
                setTimeout(() => {
                    try {
                        processFennecIdRegisterQueue();
                    } catch (_) {}
                }, 1200);
            }
        } catch (_) {}
    } catch (_) {}
}

async function processFennecIdRegisterQueue() {
    try {
        const key = 'fennec_id_register_queue_v2';
        const raw = localStorage.getItem(key) || '[]';
        const q = JSON.parse(raw);
        const arr = Array.isArray(q) ? q : [];
        if (!arr.length) return;

        const now = Date.now();
        const keep = [];
        for (const it of arr) {
            const address = String(it?.address || '').trim();
            const inscriptionId = String(it?.inscriptionId || '').trim();
            const attempts = Number(it?.attempts || 0) || 0;
            const ts = Number(it?.ts || 0) || now;
            const ageMs = now - ts;
            if (!address || !inscriptionId) continue;
            if (attempts >= 10 || ageMs > 24 * 60 * 60 * 1000) continue;

            try {
                const res = await fetch(`${BACKEND_URL}?action=fennec_id_register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address, inscriptionId })
                }).catch(() => null);
                const j = res ? await res.json().catch(() => null) : null;
                if (j && j.code === 0) {
                    try {
                        const lsKey = fennecIdKeyV2(address);
                        localStorage.setItem(lsKey, inscriptionId);
                    } catch (_) {}
                    continue;
                }

                try {
                    const msg = String(j?.msg || j?.error || '').trim();
                    if (msg) {
                        console.warn('[fennec_id_register] failed:', {
                            address,
                            inscriptionId,
                            attempts,
                            msg,
                            status: res?.status
                        });
                        if (!window.__fennecWarnedKvMissing && /FENNEC_DB\s+is\s+not\s+configured/i.test(msg)) {
                            window.__fennecWarnedKvMissing = 1;
                            if (typeof showNotification === 'function') {
                                showNotification(
                                    'Server KV (FENNEC_DB) is not configured — ID sync disabled.',
                                    'error',
                                    6500
                                );
                            }
                        }

                        if (
                            !window.__fennecWarnedUniSatKeyMissing &&
                            /UNISAT_API_KEY\s+is\s+not\s+configured/i.test(msg)
                        ) {
                            window.__fennecWarnedUniSatKeyMissing = 1;
                            if (typeof showNotification === 'function') {
                                showNotification('Server UNISAT_API_KEY is missing — ID sync disabled.', 'error', 6500);
                            }
                        }
                    }
                } catch (_) {}

                keep.push({ address, inscriptionId, ts, attempts: attempts + 1 });
            } catch (_) {}
        }
        localStorage.setItem(key, JSON.stringify(keep));
    } catch (_) {}
}

// Проверка статуса минт-ордеров
async function checkPendingMints() {
    try {
        try {
            await processFennecIdRegisterQueue();
        } catch (_) {}
        const pendingOps = JSON.parse(localStorage.getItem('pending_operations') || '[]');
        const mints = pendingOps.filter(
            op => op.type === 'mint' && (op.status === 'pending' || op.status === 'inscribing')
        );

        if (mints.length === 0) return;

        for (const mint of mints) {
            try {
                const res = await fetch(`${BACKEND_URL}?action=inscription_status&orderId=${mint.orderId}`);

                // Проверяем статус ответа
                if (!res.ok) {
                    // 400/404 бывает временно сразу после создания ордера.
                    // Не удаляем мгновенно, а ждём несколько попыток/таймаут.
                    if (res.status === 400 || res.status === 404) {
                        const idx = pendingOps.findIndex(
                            op => op && op.type === 'mint' && String(op.orderId || '') === String(mint.orderId || '')
                        );
                        if (idx >= 0) {
                            const now = Date.now();
                            const ts = Number(pendingOps[idx].timestamp || 0) || now;
                            const ageMs = now - ts;
                            const prev = Number(pendingOps[idx].notFoundCount || 0) || 0;
                            pendingOps[idx].notFoundCount = prev + 1;
                            pendingOps[idx].lastNotFoundAt = now;
                            localStorage.setItem('pending_operations', JSON.stringify(pendingOps));

                            const MAX_NOT_FOUND = 6;
                            const MIN_AGE_TO_DROP_MS = 10 * 60 * 1000;
                            if (pendingOps[idx].notFoundCount >= MAX_NOT_FOUND && ageMs > MIN_AGE_TO_DROP_MS) {
                                const updated = pendingOps.filter(
                                    op => !(op.orderId === mint.orderId && op.type === 'mint')
                                );
                                localStorage.setItem('pending_operations', JSON.stringify(updated));
                                console.log(
                                    `Order ${mint.orderId} not found after ${pendingOps[idx].notFoundCount} attempts, removed from pending`
                                );
                            }
                            if (typeof refreshPendingOperations === 'function') {
                                refreshPendingOperations();
                            }
                        }
                    }
                    continue;
                }

                const data = await res.json();

                if (data.code === 0 && data.data) {
                    const status = data.data.status;
                    const files = data.data.files || [];
                    let inscriptionId = null;
                    if (files.length > 0 && files[0].inscriptionId) {
                        inscriptionId = files[0].inscriptionId;
                    } else {
                        inscriptionId =
                            data.data.inscriptionId ||
                            data.data.inscription?.inscriptionId ||
                            data.data.inscriptionIdList?.[0];
                    }

                    if (status === 'minted' || (inscriptionId && inscriptionId.length > 10)) {
                        // Минт завершен - удаляем из pending
                        const updated = pendingOps.filter(op => !(op.orderId === mint.orderId && op.type === 'mint'));
                        localStorage.setItem('pending_operations', JSON.stringify(updated));
                        console.log(`Mint order ${mint.orderId} completed with inscription ${inscriptionId}`);

                        try {
                            const mintAddr = String(mint.address || '').trim();
                            if (mintAddr && inscriptionId) {
                                localStorage.setItem(fennecIdKeyV2(mintAddr), String(inscriptionId));
                            }
                        } catch (_) {}

                        try {
                            const mintAddr = String(mint.address || '').trim();
                            if (mintAddr && inscriptionId) queueFennecIdRegister({ address: mintAddr, inscriptionId });
                        } catch (_) {}

                        try {
                            if (typeof window.refreshFennecIdStatus === 'function') {
                                window.refreshFennecIdStatus(true, false);
                            }
                        } catch (_) {}

                        try {
                            const allMints = JSON.parse(localStorage.getItem(fennecMintedCardsKey()) || '[]');
                            if (Array.isArray(allMints) && allMints.length) {
                                let changed = false;
                                for (const m of allMints) {
                                    if (!m || typeof m !== 'object') continue;
                                    if (String(m.orderId || '') !== String(mint.orderId || '')) continue;
                                    if (inscriptionId && inscriptionId.length > 10) {
                                        m.inscriptionId = inscriptionId;
                                    }
                                    m.status = 'minted';
                                    changed = true;
                                }
                                if (changed) {
                                    localStorage.setItem(fennecMintedCardsKey(), JSON.stringify(allMints));
                                }
                            }
                        } catch (e) {}

                        // Обновляем UI
                        if (typeof refreshPendingOperations === 'function') {
                            refreshPendingOperations();
                        }
                        if (typeof window.initAudit === 'function') {
                            __fennecInitAuditSafe();
                        }
                    } else if (status === 'inscribing') {
                        // Обновляем статус
                        const idx = pendingOps.findIndex(op => op.orderId === mint.orderId && op.type === 'mint');
                        if (idx >= 0) {
                            pendingOps[idx].status = 'inscribing';
                            if (inscriptionId && inscriptionId.length > 10) {
                                pendingOps[idx].inscriptionId = inscriptionId;
                            }
                            localStorage.setItem('pending_operations', JSON.stringify(pendingOps));
                        }

                        try {
                            const allMints = JSON.parse(localStorage.getItem(fennecMintedCardsKey()) || '[]');
                            if (Array.isArray(allMints) && allMints.length) {
                                let changed = false;
                                for (const m of allMints) {
                                    if (!m || typeof m !== 'object') continue;
                                    if (String(m.orderId || '') !== String(mint.orderId || '')) continue;
                                    m.status = 'inscribing';
                                    if (inscriptionId && inscriptionId.length > 10) {
                                        m.inscriptionId = inscriptionId;
                                    }
                                    changed = true;
                                }
                                if (changed) {
                                    localStorage.setItem(fennecMintedCardsKey(), JSON.stringify(allMints));
                                }
                            }
                        } catch (e) {}
                    } else if (status === 'closed' || status === 'refunded') {
                        const updated = pendingOps.filter(op => !(op.orderId === mint.orderId && op.type === 'mint'));
                        localStorage.setItem('pending_operations', JSON.stringify(updated));
                        if (typeof refreshPendingOperations === 'function') {
                            refreshPendingOperations();
                        }

                        try {
                            const allMints = JSON.parse(localStorage.getItem(fennecMintedCardsKey()) || '[]');
                            if (Array.isArray(allMints) && allMints.length) {
                                let changed = false;
                                for (const m of allMints) {
                                    if (!m || typeof m !== 'object') continue;
                                    if (String(m.orderId || '') !== String(mint.orderId || '')) continue;
                                    m.status = status;
                                    changed = true;
                                }
                                if (changed) {
                                    localStorage.setItem(fennecMintedCardsKey(), JSON.stringify(allMints));
                                }
                            }
                        } catch (e) {}
                    }
                }
            } catch (err) {
                // Тихо пропускаем ошибки сети
            }
        }
    } catch (e) {
        // Игнорируем ошибки парсинга localStorage
    }
}

// Запускаем проверку каждые 2 минуты (экономим воркер)
setInterval(checkPendingMints, 120000);
// Проверяем сразу при загрузке
setTimeout(checkPendingMints, 3000);

// REFRESH PENDING OPERATIONS
async function refreshPendingOperations() {
    const pendingEl = document.getElementById('pendingOperations');
    if (!pendingEl) return;

    try {
        // Get pending inscriptions from localStorage
        const pendingInscriptions = JSON.parse(localStorage.getItem('pending_inscriptions') || '[]');
        const activeInscriptions = pendingInscriptions.filter(p => p.status !== 'ready' && p.status !== 'failed');

        // ИСПРАВЛЕНИЕ: Get pending operations (минты) from localStorage
        let pendingOperations = JSON.parse(localStorage.getItem('pending_operations') || '[]');

        try {
            const ops = Array.isArray(pendingOperations) ? pendingOperations : [];
            const txOps = ops.filter(
                op =>
                    op &&
                    typeof op === 'object' &&
                    (op.type === 'swap' || op.type === 'deposit' || op.type === 'withdraw') &&
                    (op.status === 'pending' || op.status === 'broadcasted' || op.status === 'created')
            );
            const limited = txOps
                .slice()
                .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
                .slice(0, 5);

            if (limited.length > 0) {
                let changed = false;
                const toRemove = new Set();
                for (const op of limited) {
                    const txid = String(op.txid || '').trim();
                    if (!__looksLikeTxid(txid)) continue;
                    const chain = String(op.chain || 'FRACTAL')
                        .trim()
                        .toUpperCase();
                    const json = await safeFetchJson(
                        `${BACKEND_URL}?action=tx_info&txid=${encodeURIComponent(txid)}&chain=${encodeURIComponent(chain)}`,
                        {
                            timeoutMs: 9000,
                            retries: 0
                        }
                    );
                    const detail = json?.data?.detail || json?.data?.data?.detail || json?.data?.tx || null;
                    const confirmations = Number(detail?.confirmations || json?.data?.confirmations || 0) || 0;
                    const height = Number(detail?.height || json?.data?.height || 0) || 0;
                    if (confirmations >= 1 || height > 0) {
                        const orderId = String(op.orderId || '').trim();
                        const id = String(op.id || '').trim();
                        const key = orderId || txid || id;
                        if (key) {
                            toRemove.add(`${String(op.type || '')}:${key}`);
                        }
                    }
                }

                if (toRemove.size > 0) {
                    const updated = ops.filter(op => {
                        if (!op || typeof op !== 'object') return false;
                        const type = String(op.type || '');
                        const orderId = String(op.orderId || '').trim();
                        const txid = String(op.txid || '').trim();
                        const id = String(op.id || '').trim();
                        const key = orderId || txid || id;
                        if (!type || !key) return true;
                        return !toRemove.has(`${type}:${key}`);
                    });
                    pendingOperations = updated;
                    localStorage.setItem('pending_operations', JSON.stringify(updated));
                    changed = true;
                }

                if (changed) {
                    try {
                        setTimeout(() => {
                            try {
                                if (typeof checkBalance === 'function') checkBalance();
                            } catch (_) {}
                            try {
                                if (typeof refreshTransactionHistory === 'function') refreshTransactionHistory();
                            } catch (_) {}
                        }, 1200);
                    } catch (_) {}
                }
            }
        } catch (_) {}

        const activeMints = (Array.isArray(pendingOperations) ? pendingOperations : []).filter(
            p =>
                p && typeof p === 'object' && p.type === 'mint' && (p.status === 'pending' || p.status === 'inscribing')
        );

        const activeSwaps = (Array.isArray(pendingOperations) ? pendingOperations : []).filter(
            p =>
                p &&
                typeof p === 'object' &&
                p.type === 'swap' &&
                (p.status === 'pending' || p.status === 'broadcasted')
        );

        const activeLocalDeposits = (Array.isArray(pendingOperations) ? pendingOperations : []).filter(
            p =>
                p &&
                typeof p === 'object' &&
                p.type === 'deposit' &&
                (p.status === 'pending' || p.status === 'broadcasted')
        );

        const activeLocalWithdrawals = (Array.isArray(pendingOperations) ? pendingOperations : []).filter(
            p =>
                p &&
                typeof p === 'object' &&
                p.type === 'withdraw' &&
                (p.status === 'pending' || p.status === 'broadcasted')
        );

        // Get pending deposits/withdrawals from API (if user is connected)
        let pendingDeposits = [];
        let pendingWithdrawals = [];

        if (userAddress) {
            try {
                const depositRes = await fetch(
                    `${BACKEND_URL}?action=deposit_list&address=${userAddress}&start=0&limit=10`
                ).then(r => r.json());
                if (depositRes.code === 0 && depositRes.data?.list) {
                    pendingDeposits = depositRes.data.list.filter(d => {
                        const cur = d.cur || 0;
                        const sum = d.sum || 0;
                        return cur < sum; // Not fully confirmed
                    });
                }
            } catch (e) {
                console.warn('Failed to fetch pending deposits:', e);
            }

            try {
                const withdrawRes = await fetch(
                    `${BACKEND_URL}?action=withdraw_history&address=${userAddress}&start=0&limit=10`
                ).then(r => r.json());
                if (withdrawRes.code === 0 && withdrawRes.data?.list) {
                    pendingWithdrawals = withdrawRes.data.list.filter(w => {
                        const cur = w.cur || 0;
                        const sum = w.sum || 0;
                        return cur < sum; // Not fully confirmed
                    });
                }
            } catch (e) {
                console.warn('Failed to fetch pending withdrawals:', e);
            }
        }

        const apiDepositTxids = new Set((pendingDeposits || []).map(d => __pickTxid(d)).filter(Boolean));
        const apiWithdrawTxids = new Set((pendingWithdrawals || []).map(w => __pickTxid(w)).filter(Boolean));

        const localDeposits = (activeLocalDeposits || []).filter(op => {
            const txid = String(op.txid || '').trim();
            if (!txid) return true;
            return !apiDepositTxids.has(txid);
        });

        const localWithdrawals = (activeLocalWithdrawals || []).filter(op => {
            const txid = String(op.txid || '').trim();
            if (!txid) return true;
            return !apiWithdrawTxids.has(txid);
        });

        const allPending = [
            ...activeInscriptions.map(p => ({ ...p, type: 'inscription', sortTime: p.createdAt || 0 })),
            ...activeMints.map(m => ({ ...m, type: 'mint', sortTime: m.timestamp || 0 })),
            ...activeSwaps.map(s => ({ ...s, type: 'swap', sortTime: s.timestamp || 0 })),
            ...localDeposits.map(d => ({ ...d, type: 'local_deposit', sortTime: d.timestamp || 0 })),
            ...localWithdrawals.map(w => ({ ...w, type: 'local_withdraw', sortTime: w.timestamp || 0 })),
            ...pendingDeposits.map(d => ({ ...d, type: 'deposit', sortTime: (d.ts || 0) * 1000 })),
            ...pendingWithdrawals.map(w => ({ ...w, type: 'withdraw', sortTime: (w.ts || 0) * 1000 }))
        ].sort((a, b) => b.sortTime - a.sortTime); // Sort by time, newest first

        if (allPending.length === 0) {
            pendingEl.innerHTML = `
                                                                                                                            <div class="text-center py-8 text-gray-500 text-xs">
                                                                                                                                <i class="fas fa-check-circle text-3xl mb-3 opacity-50 text-green-500"></i>
                                                                                                                                <p>No pending operations</p>
                                                                                                                                <p class="text-[10px] mt-2 text-gray-600">All operations are completed</p>
                                                                                                                            </div>
                                                                                                                        `;
            return;
        }

        // Group by type
        const inscriptions = allPending.filter(o => o.type === 'inscription');
        const mints = allPending.filter(o => o.type === 'mint');
        const swaps = allPending.filter(o => o.type === 'swap');
        const localDeposits2 = allPending.filter(o => o.type === 'local_deposit');
        const localWithdrawals2 = allPending.filter(o => o.type === 'local_withdraw');
        const deposits = allPending.filter(o => o.type === 'deposit');
        const withdrawals = allPending.filter(o => o.type === 'withdraw');

        let html = '';

        // ИСПРАВЛЕНИЕ: Mints (минт карточек)
        if (mints.length > 0) {
            html += '<div class="text-xs text-gray-500 mb-2 font-bold uppercase">Minting ID Cards</div>';
            html += mints
                .map(op => {
                    const statusIcon =
                        op.status === 'pending'
                            ? 'fa-clock'
                            : op.status === 'inscribing'
                              ? 'fa-spinner fa-spin'
                              : 'fa-hourglass-half';
                    const statusColor =
                        op.status === 'pending'
                            ? 'text-yellow-500'
                            : op.status === 'inscribing'
                              ? 'text-blue-500'
                              : 'text-gray-500';
                    let sizeKB = '';
                    try {
                        const base64Content = btoa(unescape(encodeURIComponent(op.htmlCode || '')));
                        const base64SizeBytes = (base64Content.length * 3) / 4;
                        sizeKB = (base64SizeBytes / 1024).toFixed(2);
                    } catch (e) {}
                    return `
                                                                                                                                <div class="bg-black/30 border border-white/5 rounded-lg p-4 mb-2">
                                                                                                                                    <div class="flex items-center justify-between">
                                                                                                                                        <div class="flex items-center gap-3">
                                                                                                                                            <i class="fas ${statusIcon} ${statusColor} text-xl"></i>
                                                                                                                                            <div>
                                                                                                                                                <div class="text-sm font-bold text-white">Minting Fennec ID Card</div>
                                                                                                                                                <div class="text-xs text-gray-400">Order ID: ${__escapeHtml(String(op.orderId || '').slice(-8) || 'N/A')}</div>
                                                                                                                                                <div class="text-[10px] text-gray-500 mt-1">Status: ${__escapeHtml(op.status || '')}${sizeKB ? ` • HTML: ${sizeKB} KB` : ''}</div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                        <div class="text-right">
                                                                                                                                            <div class="text-[10px] text-gray-500">Amount</div>
                                                                                                                                            <div class="text-xs font-mono text-fennec">${(op.amount / 100000000).toFixed(8)} FB</div>
                                                                                                                                            <button class="open-mint-html mt-2 text-[10px] font-black bg-fennec/15 text-fennec border border-fennec/30 px-3 py-1 rounded-lg hover:bg-fennec/25 transition" data-order-id="${__escapeHtml(op.orderId || '')}">OPEN CARD</button>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            `;
                })
                .join('');
        }

        if (swaps.length > 0) {
            html += '<div class="text-xs text-gray-500 mb-2 mt-4 font-bold uppercase">Swaps</div>';
            html += swaps
                .map(op => {
                    const txid = String(op.txid || '').trim();
                    const shortTx = __looksLikeTxid(txid) ? txid.slice(0, 8) : '';
                    const inTick = op.tickIn || '';
                    const outTick = op.tickOut || '';
                    const amountIn = Number(op.amountIn || 0) || 0;
                    const amountInStr = amountIn ? amountIn.toFixed(8).replace(/\.?0+$/, '') : '';
                    const title =
                        inTick && outTick && amountInStr
                            ? `Swap ${__escapeHtml(amountInStr)} ${__escapeHtml(inTick)} → ${__escapeHtml(outTick)}`
                            : 'Swap Pending';
                    const txLine = shortTx ? `TXID: ${__escapeHtml(shortTx)}…` : 'TXID: N/A';
                    return `
                                                                                                                                <div class="bg-black/30 border border-white/5 rounded-lg p-4 mb-2">
                                                                                                                                    <div class="flex items-center justify-between">
                                                                                                                                        <div class="flex items-center gap-3">
                                                                                                                                            <i class="fas fa-clock text-yellow-500 text-xl"></i>
                                                                                                                                            <div>
                                                                                                                                                <div class="text-sm font-bold text-white">${title}</div>
                                                                                                                                                <div class="text-xs text-gray-400">${txLine}</div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            `;
                })
                .join('');
        }

        if (localDeposits2.length > 0) {
            html += '<div class="text-xs text-gray-500 mb-2 mt-4 font-bold uppercase">Deposits (Pending)</div>';
            html += localDeposits2
                .map(op => {
                    const txid = String(op.txid || '').trim();
                    const shortTx = __looksLikeTxid(txid) ? txid.slice(0, 8) : '';
                    const amount = Number(op.amount || 0) || 0;
                    const amountStr = amount ? amount.toFixed(8).replace(/\.?0+$/, '') : '--';
                    let displayTick = op.tick || 'FB';
                    if (String(displayTick).includes('sFB') || displayTick === 'sFB___000') displayTick = 'FB';
                    if (String(displayTick).includes('sBTC') || displayTick === 'sBTC___000') displayTick = 'BTC';
                    if (String(displayTick).includes('FENNEC')) displayTick = 'FENNEC';
                    return `
                                                                                                                                <div class="bg-black/30 border border-white/5 rounded-lg p-4 mb-2">
                                                                                                                                    <div class="flex items-center justify-between">
                                                                                                                                        <div class="flex items-center gap-3">
                                                                                                                                            <i class="fas fa-arrow-down text-green-500 text-xl"></i>
                                                                                                                                           <div>
                                                                                                                                                <div class="text-sm font-bold text-white">Deposit ${__escapeHtml(amountStr)} ${__escapeHtml(displayTick)}</div>
                                                                                                                                                <div class="text-xs text-gray-400">${shortTx ? `TXID: ${__escapeHtml(shortTx)}…` : 'TXID: N/A'}</div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            `;
                })
                .join('');
        }

        if (localWithdrawals2.length > 0) {
            html += '<div class="text-xs text-gray-500 mb-2 mt-4 font-bold uppercase">Withdrawals (Pending)</div>';
            html += localWithdrawals2
                .map(op => {
                    const txid = String(op.txid || '').trim();
                    const shortTx = __looksLikeTxid(txid) ? txid.slice(0, 8) : '';
                    const amount = Number(op.amount || 0) || 0;
                    const amountStr = amount ? amount.toFixed(8).replace(/\.?0+$/, '') : '--';
                    let displayTick = op.tick || 'FB';
                    if (String(displayTick).includes('sFB') || displayTick === 'sFB___000') displayTick = 'FB';
                    if (String(displayTick).includes('sBTC') || displayTick === 'sBTC___000') displayTick = 'BTC';
                    if (String(displayTick).includes('FENNEC')) displayTick = 'FENNEC';
                    const id = String(op.id || '').trim();
                    return `
                                                                                                                                <div class="bg-black/30 border border-white/5 rounded-lg p-4 mb-2">
                                                                                                                                    <div class="flex items-center justify-between">
                                                                                                                                        <div class="flex items-center gap-3">
                                                                                                                                            <i class="fas fa-arrow-up text-fennec text-xl"></i>
                                                                                                                                           <div>
                                                                                                                                                <div class="text-sm font-bold text-white">Withdraw ${__escapeHtml(amountStr)} ${__escapeHtml(displayTick)}</div>
                                                                                                                                                <div class="text-xs text-gray-400">${shortTx ? `TXID: ${__escapeHtml(shortTx)}…` : id ? `ID: ${__escapeHtml(String(id).slice(-8))}` : 'TXID: N/A'}</div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            `;
                })
                .join('');
        }

        // Inscriptions
        if (inscriptions.length > 0) {
            html += '<div class="text-xs text-gray-500 mb-2 font-bold uppercase">Inscriptions</div>';
            html += inscriptions
                .map(op => {
                    const statusIcon =
                        op.status === 'pending'
                            ? 'fa-clock'
                            : op.status === 'inscribing'
                              ? 'fa-spinner fa-spin'
                              : 'fa-hourglass-half';
                    const statusColor =
                        op.status === 'pending'
                            ? 'text-yellow-500'
                            : op.status === 'inscribing'
                              ? 'text-blue-500'
                              : 'text-gray-500';
                    // Нормализуем тикер: убираем префиксы sFB, sBTC и т.д.
                    let displayTick = op.tick || 'FB';
                    if (displayTick.includes('sFB') || displayTick === 'sFB___000') displayTick = 'FB';
                    if (displayTick.includes('sBTC') || displayTick === 'sBTC___000') displayTick = 'BTC';
                    if (displayTick.includes('FENNEC')) displayTick = 'FENNEC';
                    return `
                                                                                                                                <div class="bg-black/30 border border-white/5 rounded-lg p-4 mb-2">
                                                                                                                                    <div class="flex items-center justify-between">
                                                                                                                                        <div class="flex items-center gap-3">
                                                                                                                                            <i class="fas ${statusIcon} ${statusColor} text-xl"></i>
                                                                                                                                            <div>
                                                                                                                                                <div class="text-sm font-bold text-white">Creating Transfer Inscription</div>
                                                                                                                                                <div class="text-xs text-gray-400">${__escapeHtml(op.amount)} ${__escapeHtml(displayTick)}</div>
                                                                                                                                                <div class="text-[10px] text-gray-500 mt-1">Status: ${__escapeHtml(op.status || '')}</div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                        <div class="text-right">
                                                                                                                                            <div class="text-[10px] text-gray-500">Order ID</div>
                                                                                                                                            <div class="text-xs font-mono text-fennec">${__escapeHtml(String(op.orderId || '').slice(-8) || 'N/A')}</div>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            `;
                })
                .join('');
        }

        // Deposits
        if (deposits.length > 0) {
            html += '<div class="text-xs text-gray-500 mb-2 mt-4 font-bold uppercase">Deposits</div>';
            html += deposits
                .map(op => {
                    const cur = op.cur || 0;
                    const sum = op.sum || 0;
                    const percent = Math.round((cur / sum) * 100);
                    const amount = parseFloat(op.amount || 0);
                    const amountStr = amount % 1 === 0 ? amount.toString() : amount.toFixed(8).replace(/\.?0+$/, '');
                    // Нормализуем тикер: убираем префиксы sFB, sBTC и т.д.
                    let displayTick = op.tick || 'FB';
                    if (displayTick.includes('sFB') || displayTick === 'sFB___000') displayTick = 'FB';
                    if (displayTick.includes('sBTC') || displayTick === 'sBTC___000') displayTick = 'BTC';
                    if (displayTick.includes('FENNEC')) displayTick = 'FENNEC';
                    return `
                                                                                                                                <div class="bg-black/30 border border-white/5 rounded-lg p-4 mb-2">
                                                                                                                                    <div class="flex items-center justify-between">
                                                                                                                                        <div class="flex items-center gap-3">
                                                                                                                                            <i class="fas fa-arrow-down text-green-500 text-xl"></i>
                                                                                                                                           <div>
                                                                                                                                                <div class="text-sm font-bold text-white">Deposit ${__escapeHtml(amountStr)} ${__escapeHtml(displayTick)}</div>
                                                                                                                                                <div class="text-xs text-gray-400">${cur}/${sum} confirmations</div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                        <div class="text-right">
                                                                                                                                            <div class="text-xs font-bold text-green-400">${percent}%</div>
                                                                                                                                            <div class="w-20 bg-white/10 rounded-full h-2 mt-1">
                                                                                                                                                <div class="bg-green-500 h-2 rounded-full" style="width: ${percent}%"></div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            `;
                })
                .join('');
        }

        // Withdrawals
        if (withdrawals.length > 0) {
            html += '<div class="text-xs text-gray-500 mb-2 mt-4 font-bold uppercase">Withdrawals</div>';
            html += withdrawals
                .map(op => {
                    const cur = op.cur || 0;
                    const sum = op.sum || 0;
                    const percent = Math.round((cur / sum) * 100);
                    const amount = parseFloat(op.amount || 0);
                    const amountStr = amount % 1 === 0 ? amount.toString() : amount.toFixed(8).replace(/\.?0+$/, '');
                    // Нормализуем тикер: убираем префиксы sFB, sBTC и т.д.
                    let displayTick = op.tick || 'FB';
                    if (displayTick.includes('sFB') || displayTick === 'sFB___000') displayTick = 'FB';
                    if (displayTick.includes('sBTC') || displayTick === 'sBTC___000') displayTick = 'BTC';
                    if (displayTick.includes('FENNEC')) displayTick = 'FENNEC';
                    return `
                                                                                                                                <div class="bg-black/30 border border-white/5 rounded-lg p-4 mb-2">
                                                                                                                                    <div class="flex items-center justify-between">
                                                                                                                                        <div class="flex items-center gap-3">
                                                                                                                                            <i class="fas fa-arrow-up text-fennec text-xl"></i>
                                                                                                                                           <div>
                                                                                                                                                <div class="text-sm font-bold text-white">Withdraw ${__escapeHtml(amountStr)} ${__escapeHtml(displayTick)}</div>
                                                                                                                                                <div class="text-xs text-gray-400">${cur}/${sum} confirmations</div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                        <div class="text-right">
                                                                                                                                            <div class="text-xs font-bold text-fennec">${percent}%</div>
                                                                                                                                            <div class="w-20 bg-white/10 rounded-full h-2 mt-1">
                                                                                                                                                <div class="bg-fennec h-2 rounded-full" style="width: ${percent}%"></div>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            `;
                })
                .join('');
        }

        pendingEl.innerHTML = html;

        pendingEl.querySelectorAll('.open-mint-html').forEach(btn => {
            btn.addEventListener('click', event => {
                event.stopPropagation();
                const orderId = btn.dataset.orderId;
                if (!orderId) return;
                const pendingOps = JSON.parse(localStorage.getItem('pending_operations') || '[]');
                const op = pendingOps.find(o => o.type === 'mint' && o.orderId === orderId);
                const htmlCode = op && op.htmlCode ? op.htmlCode : '';
                if (!htmlCode) return;
                const blob = new Blob([htmlCode], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => {
                    try {
                        URL.revokeObjectURL(url);
                    } catch (e) {}
                }, 60000);
            });
        });
    } catch (e) {
        console.error('Error refreshing pending operations:', e);
        pendingEl.innerHTML = `
                                                                                                                        <div class="text-center py-8 text-red-500 text-xs">
                                                                                                                            <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                                                                                                                            <p>Error loading pending operations</p>
                                                                                                                        </div>
                                                                                                                    `;
    }
}

function __legacy_switchDir() {
    isBuying = !isBuying;
    document.getElementById('swapIn').value = '';
    document.getElementById('swapOut').value = '';
    updateUI();
}

// switchDir is now imported as module

// Set swap pair (FB_FENNEC or BTC_FB)
function __legacy_setSwapPair(pair) {
    currentSwapPair = pair;
    isBuying = true; // Reset direction
    document.getElementById('swapIn').value = '';
    document.getElementById('swapOut').value = '';

    // Update button states (новые ID из предоставленного HTML)
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
    // Старые ID для совместимости
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

    // Update activeTickers based on pair
    if (pair === 'FB_FENNEC') {
        activeTickers.tick0 = T_SFB;
        activeTickers.tick1 = T_FENNEC;
    } else if (pair === 'BTC_FB') {
        // Для пула используем правильные тикеры InSwap
        activeTickers.tick0 = T_SBTC;
        activeTickers.tick1 = T_SFB;
    }

    updateUI();
    fetchReserves(); // Загружаем резервы выбранного пула

    // Обновляем историю свапов для выбранной пары
    if (userAddress) {
        setTimeout(refreshTransactionHistory, 500);
    }
}

// setSwapPair is now imported as module

function __legacy_setMaxAmount() {
    if (!userAddress) return window.connectWallet();
    let bal;
    if (currentSwapPair === 'FB_FENNEC') {
        bal = isBuying ? userBalances.sFB : userBalances.FENNEC;
    } else {
        // BTC_FB
        bal = isBuying ? poolReserves.user_sBTC || 0 : userBalances.sFB;
    }
    if (bal > 0) {
        let feeBuffer = 0;
        if (currentSwapPair === 'FB_FENNEC' && isBuying) feeBuffer = 0.05;
        const maxAmount = Math.max(0, bal - feeBuffer);
        if (maxAmount <= 0) {
            if (typeof showNotification === 'function') {
                showNotification('Not enough FB after reserving 0.05 for fees', 'warning', 2500);
            }
            return;
        }
        document.getElementById('swapIn').value = maxAmount.toFixed(8);
        calc();
    }
}

const setMaxAmount = window.setMaxAmount || __legacy_setMaxAmount;
try {
    window.setMaxAmount = setMaxAmount;
} catch (_) {}

function triggerSwapSuccessFx() {
    const btn = document.getElementById('swapBtn');
    if (btn) {
        btn.classList.remove('swap-success-pulse');
        void btn.offsetWidth;
        btn.classList.add('swap-success-pulse');
    }

    const overlay = document.getElementById('swapSuccessOverlay');
    if (overlay) {
        overlay.classList.remove('swap-success-overlay');
        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.add('swap-success-overlay');
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.classList.remove('swap-success-overlay');
        }, 980);
    }
}

function openAddLiquidityFromSwap() {
    const pair = typeof currentSwapPair === 'string' && currentSwapPair === 'BTC_FB' ? 'BTC_FB' : 'FB_FENNEC';
    openAddLiquidityModal(pair);
}

function __legacy_closeAddLiquidityModal() {
    const modal = document.getElementById('addLiquidityModal');
    if (modal) modal.classList.add('hidden');
    // Reset to Add tab
    switchLiquidityTab('add');
}

function __legacy_switchLiquidityTab(tab) {
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
        // Load LP data when switching to remove tab
        const ctx = window.__liqWithdrawCtx || null;
        const lpBalEl = document.getElementById('removeLpBalance');
        if (lpBalEl) {
            const lpAvail = Number(ctx?.lp || 0) || 0;
            lpBalEl.textContent = lpAvail > 0 ? lpAvail.toString() : '--';
        }
        const inp = document.getElementById('removeLpAmount');
        if (inp) {
            inp.value = '';
            inp.addEventListener('input', updateRemoveLiquidityEstimate);
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

async function __legacy_openAddLiquidityModal(pair) {
    if (!userAddress) {
        try {
            await window.connectWallet();
        } catch (_) {}
        if (!userAddress) return;
    }

    const modal = document.getElementById('addLiquidityModal');
    if (modal) modal.classList.remove('hidden');

    try {
        switchLiquidityTab('add');
    } catch (_) {}

    const p = pair === 'BTC_FB' ? 'BTC_FB' : 'FB_FENNEC';

    // Update fixed pair display
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
            currentLiquidityPair = p;
            await loadLiquidityPoolData(currentLiquidityPair);
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

let currentLiquidityPair = 'FB_FENNEC';
let __liqSyncGuard = false;
let liquidityPoolData = {
    pair: 'FB_FENNEC',
    apiTick0: T_FENNEC,
    apiTick1: T_SFB,
    apiReserve0: 0,
    apiReserve1: 0,
    uiReserve0: 0,
    uiReserve1: 0,
    poolLp: 0
};

try {
    if (typeof window.currentLiquidityPair === 'string' && window.currentLiquidityPair)
        currentLiquidityPair = window.currentLiquidityPair;
} catch (_) {}
try {
    Object.defineProperty(window, 'currentLiquidityPair', {
        get: () => currentLiquidityPair,
        set: v => {
            currentLiquidityPair = String(v || '');
        },
        configurable: true
    });
} catch (_) {
    try {
        window.currentLiquidityPair = currentLiquidityPair;
    } catch (_) {}
}

try {
    if (window.liquidityPoolData && typeof window.liquidityPoolData === 'object')
        liquidityPoolData = window.liquidityPoolData;
} catch (_) {}
try {
    Object.defineProperty(window, 'liquidityPoolData', {
        get: () => liquidityPoolData,
        set: v => {
            liquidityPoolData = v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.liquidityPoolData = liquidityPoolData;
    } catch (_) {}
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

async function __legacy_loadLiquidityPoolData(pair) {
    const p = pair === 'BTC_FB' ? 'BTC_FB' : 'FB_FENNEC';
    const queryTick0 = p === 'BTC_FB' ? T_SBTC : T_FENNEC;
    const queryTick1 = T_SFB;

    try {
        const now = Date.now();
        const url = `${BACKEND_URL}?action=quote&tick0=${encodeURIComponent(queryTick0)}&tick1=${encodeURIComponent(queryTick1)}&t=${now}`;
        const json = await safeFetchJson(url, { timeoutMs: 12000, retries: 2 });
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
            uiReserve0 = isApi0Fennec ? apiReserve0 : apiReserve1; // UI0 = FENNEC
            uiReserve1 = isApi0Fennec ? apiReserve1 : apiReserve0; // UI1 = FB
        } else {
            const isApi0Btc = (apiTick0 || '').toString().toUpperCase().includes('SBTC');
            uiReserve0 = isApi0Btc ? apiReserve0 : apiReserve1; // UI0 = BTC
            uiReserve1 = isApi0Btc ? apiReserve1 : apiReserve0; // UI1 = FB
        }

        liquidityPoolData = {
            pair: p,
            apiTick0,
            apiTick1,
            apiReserve0,
            apiReserve1,
            uiReserve0,
            uiReserve1,
            poolLp
        };
    } catch (e) {
        console.error('loadLiquidityPoolData failed:', e);
    }
}

async function __legacy_selectLiquidityPair(pair) {
    currentLiquidityPair = pair === 'BTC_FB' ? 'BTC_FB' : 'FB_FENNEC';
    const btn0 = document.getElementById('liqPairFBF');
    const btn1 = document.getElementById('liqPairBFB');
    if (btn0 && btn1) {
        btn0.className =
            currentLiquidityPair === 'FB_FENNEC'
                ? 'px-4 py-3 rounded-xl bg-fennec/10 border border-fennec/25 text-white font-black hover:bg-fennec/15 hover:border-fennec/45 transition'
                : 'px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black hover:bg-white/10 hover:border-white/20 transition';
        btn1.className =
            currentLiquidityPair === 'BTC_FB'
                ? 'px-4 py-3 rounded-xl bg-fennec/10 border border-fennec/25 text-white font-black hover:bg-fennec/15 hover:border-fennec/45 transition'
                : 'px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black hover:bg-white/10 hover:border-white/20 transition';
    }

    const tick0El = document.getElementById('liqTick0Label');
    const tick1El = document.getElementById('liqTick1Label');
    if (tick0El && tick1El) {
        if (currentLiquidityPair === 'FB_FENNEC') {
            tick0El.innerText = 'FENNEC';
            tick1El.innerText = 'FB';
        } else {
            tick0El.innerText = 'BTC';
            tick1El.innerText = 'FB';
        }
    }

    await loadLiquidityPoolData(currentLiquidityPair);
    updateLiquidityBalancesUI();
    syncLiquidityAmounts(0);
    refreshMyLiquidityForSelectedPair(false);
}

let __myLiqCache = null;
let __myLiqCacheAt = 0;

async function __legacy_fetchMyLiquiditySummary(force) {
    if (!userAddress) return null;
    const now = Date.now();
    if (!force && __myLiqCache && now - __myLiqCacheAt < 15000) return __myLiqCache;
    try {
        const pubkey = typeof userPubkey === 'string' && userPubkey ? userPubkey : '';
        const url = pubkey
            ? `${BACKEND_URL}?action=inswap_summary&address=${encodeURIComponent(userAddress)}&pubkey=${encodeURIComponent(pubkey)}&t=${now}`
            : `${BACKEND_URL}?action=inswap_summary&address=${encodeURIComponent(userAddress)}&t=${now}`;
        const json = await safeFetchJson(url, { timeoutMs: 15000, retries: 1 });
        const data = json && typeof json === 'object' ? json.data || null : null;
        __myLiqCache = data;
        __myLiqCacheAt = now;
        return data;
    } catch (_) {
        return __myLiqCache;
    }
}

function __normalizeTickLabel(tick) {
    const t = String(tick || '').toUpperCase();
    if (t.includes('FENNEC')) return 'FENNEC';
    if (t.includes('SBTC') || t === 'BTC') return 'BTC';
    if (t.includes('SFB') || t === 'FB') return 'FB';
    return String(tick || '');
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

function __collectEarningFields(obj) {
    const out = { claimed: [], unclaimed: [] };
    if (!obj || typeof obj !== 'object') return out;
    const keys = Object.keys(obj);
    for (const k of keys) {
        const lk = k.toLowerCase();
        const v = obj[k];
        if (v === null || v === undefined) continue;
        const numStr = __formatMaybeNum(v);
        if (!numStr) continue;
        if (
            lk.includes('unclaimed') ||
            lk.includes('unclaim') ||
            lk.includes('claimable') ||
            lk.includes('pending') ||
            lk.includes('owed')
        ) {
            out.unclaimed.push({ k, v: numStr });
            continue;
        }
        if (lk.includes('claimed')) {
            out.claimed.push({ k, v: numStr });
            continue;
        }
    }
    return out;
}

function __prettyRewardLabel(key, tick0, tick1) {
    const k = String(key || '');
    const lk = k.toLowerCase();
    const isUnclaimed = lk.includes('unclaimed') || lk.includes('unclaim') || lk.includes('claimable');
    const idx = lk.endsWith('0') ? 0 : lk.endsWith('1') ? 1 : null;
    const t = idx === 0 ? String(tick0 || '') : idx === 1 ? String(tick1 || '') : '';
    const base = isUnclaimed ? 'Claimable rewards' : 'Claimed rewards';
    return t ? `${base} (${t})` : base;
}

async function __legacy_refreshMyLiquidityForSelectedPair(force) {
    const box = document.getElementById('liqMyPos');
    const body = document.getElementById('liqMyPosBody');
    const withdrawBox = document.getElementById('liqWithdrawPanel');
    if (!box || !body) return;

    if (!userAddress) {
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
        const key = `liq:${String(userAddress || '').trim()}:${String(currentLiquidityPair || '').trim()}`;
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

    const pair = currentLiquidityPair === 'BTC_FB' ? 'BTC_FB' : 'FB_FENNEC';
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
        const key = `liq:${String(userAddress || '').trim()}:${String(currentLiquidityPair || '').trim()}`;
        if (window.__fennecUiCache && window.__fennecUiCache.liquidityHtml) {
            window.__fennecUiCache.liquidityHtml[key] = String(body.innerHTML || '');
        }
    } catch (_) {}

    try {
        const cfg = typeof getLiquidityConfig === 'function' ? getLiquidityConfig() : null;
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

async function __legacy_openRemoveLiquidityModal() {
    if (!userAddress) {
        try {
            await window.connectWallet();
        } catch (_) {}
        if (!userAddress) return;
    }
    const modal = document.getElementById('addLiquidityModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    // Switch to Remove tab
    switchLiquidityTab('remove');
}

function __legacy_closeRemoveLiquidityModal() {
    const modal = document.getElementById('removeLiquidityModal');
    if (modal) modal.classList.add('hidden');
}

function __legacy_setMaxRemoveLp() {
    const ctx = window.__liqWithdrawCtx || null;
    const lpAvail = Number(ctx?.lp || 0) || 0;
    const inp = document.getElementById('removeLpAmount');
    if (!inp) return;
    inp.value = lpAvail ? __normalizeAmountStr(lpAvail, 8) : '';
    updateRemoveLiquidityEstimate();
}

let __removeQuoteTimeout = null;
async function __legacy_updateRemoveLiquidityEstimate() {
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
            const lpStr = __normalizeAmountStr(lpVal, 8);
            const qUrl =
                `${BACKEND_URL}?action=quote_remove_liq` +
                `&address=${encodeURIComponent(userAddress)}` +
                `&tick0=${encodeURIComponent(ctx.apiTick0)}` +
                `&tick1=${encodeURIComponent(ctx.apiTick1)}` +
                `&lp=${encodeURIComponent(lpStr)}`;
            const q = await fetch(qUrl, {
                headers: {
                    'x-public-key': userPubkey,
                    'x-address': userAddress
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
                    // Округлить до 2 знаков после запятой
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
        } catch (e) {
            recv.textContent = 'Error';
        }
    }, 500);
}

async function __legacy_doRemoveLiquidity() {
    if (!userAddress) return window.connectWallet();

    const btn = document.getElementById('removeLiqBtn');
    const originalText = btn ? btn.innerText : '';
    try {
        await checkFractalNetwork();

        if (!userPubkey)
            try {
                userPubkey = await window.unisat.getPublicKey();
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

        const qUrl =
            `${BACKEND_URL}?action=quote_remove_liq` +
            `&address=${encodeURIComponent(userAddress)}` +
            `&tick0=${encodeURIComponent(ctx.apiTick0)}` +
            `&tick1=${encodeURIComponent(ctx.apiTick1)}` +
            `&lp=${encodeURIComponent(lpStr)}`;
        const q = await fetch(qUrl, {
            headers: {
                'x-public-key': userPubkey,
                'x-address': userAddress
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
            `&address=${encodeURIComponent(userAddress)}` +
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
                'x-public-key': userPubkey,
                'x-address': userAddress
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
            address: userAddress,
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

        console.log('Submitting remove_liq with body:', body);

        const sub = await fetch(`${BACKEND_URL}?action=remove_liq`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(body)
        }).then(r => r.json());

        if (!sub || sub.code !== 0) throw new Error(sub?.msg || sub?.error || 'remove_liq failed');

        showSuccess(`Liquidity withdrawn! ID: ${sub.data?.id || 'OK'}`);
        if (typeof showNotification === 'function')
            showNotification('Liquidity withdrawn successfully', 'success', 3200);
        closeAddLiquidityModal();
        setTimeout(() => {
            try {
                refreshMyLiquidityForSelectedPair(true);
            } catch (_) {}
            try {
                checkBalance();
            } catch (_) {}
        }, 1200);
    } catch (e) {
        console.error('Remove liquidity error:', e);
        if (typeof showNotification === 'function') showNotification(e?.message || String(e), 'error', 4500);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

function __legacy_getBalanceForTick(tick) {
    const t = (tick || '').toString().toUpperCase();
    if (t.includes('FENNEC')) return Number(userBalances.FENNEC || 0) || 0;
    if (t.includes('SBTC') || t === 'BTC') return Number(poolReserves.user_sBTC || 0) || 0;
    if (t.includes('SFB') || t === 'FB') return Number(userBalances.sFB || 0) || 0;
    return 0;
}

function __legacy_getLiquidityConfig() {
    const p = currentLiquidityPair === 'BTC_FB' ? 'BTC_FB' : 'FB_FENNEC';
    const uiTick0 = p === 'BTC_FB' ? T_SBTC : T_FENNEC;
    const uiTick1 = T_SFB;

    const apiTick0 = liquidityPoolData?.pair === p ? liquidityPoolData.apiTick0 : uiTick0;
    const apiTick1 = liquidityPoolData?.pair === p ? liquidityPoolData.apiTick1 : uiTick1;
    const uiReserve0 = liquidityPoolData?.pair === p ? Number(liquidityPoolData.uiReserve0 || 0) || 0 : 0;
    const uiReserve1 = liquidityPoolData?.pair === p ? Number(liquidityPoolData.uiReserve1 || 0) || 0 : 0;
    const poolLp = liquidityPoolData?.pair === p ? Number(liquidityPoolData.poolLp || 0) || 0 : 0;

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

function __legacy_updateLiquidityBalancesUI() {
    const cfg = getLiquidityConfig();
    const b0 = document.getElementById('liqBal0');
    const b1 = document.getElementById('liqBal1');
    if (b0) b0.innerText = Number(cfg.bal0 || 0).toFixed(8);
    if (b1) b1.innerText = Number(cfg.bal1 || 0).toFixed(8);
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

function __legacy__normalizeAmountStr(value, maxDecimals) {
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

function __legacy_computeExpectedLp(amount0, amount1, reserve0, reserve1, poolLp) {
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

function __legacy_syncLiquidityAmounts(changedIndex) {
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

        // Активировать кнопку SUPPLY если введены суммы
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

function __legacy_setMaxLiqAmount(which) {
    if (!userAddress) return window.connectWallet();
    updateLiquidityBalancesUI();
    const cfg = getLiquidityConfig();
    const el0 = document.getElementById('liqAmount0');
    const el1 = document.getElementById('liqAmount1');
    if (!el0 || !el1) return;

    const feeBuffer = 0.05;
    const max0 = Math.max(0, Number(cfg.bal0 || 0) - (cfg.uiTick0 === T_SFB ? feeBuffer : 0));
    const max1 = Math.max(0, Number(cfg.bal1 || 0) - (cfg.uiTick1 === T_SFB ? feeBuffer : 0));

    if (which === 0) {
        el0.value = max0.toFixed(8);
        syncLiquidityAmounts(0);
        return;
    }

    el1.value = max1.toFixed(8);
    syncLiquidityAmounts(1);
}

async function __legacy_copyLiquidityPairForSearch() {
    const cfg = getLiquidityConfig();
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(cfg.label);
        }
    } catch (e) {}
}

async function __legacy_doAddLiquidity() {
    if (!userAddress) return window.connectWallet();
    try {
        await checkFractalNetwork();
    } catch (e) {
        document.getElementById('errorMsg').innerText = e.message;
        document.getElementById('errorModal').classList.remove('hidden');
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
        if (typeof showNotification === 'function') showNotification('Enter amounts', 'warning', 2000);
        return;
    }

    // Leave small FB buffer for fees
    const feeBuffer = 0.05;
    if (cfg.uiTick0 === T_SFB && amount0 > Math.max(0, cfg.bal0 - feeBuffer)) {
        if (typeof showNotification === 'function') showNotification('Reserved 0.05 FB for fees', 'info', 2200);
        el0.value = Math.max(0, cfg.bal0 - feeBuffer).toFixed(8);
        syncLiquidityAmounts(0);
        return;
    }
    if (cfg.uiTick1 === T_SFB && amount1 > Math.max(0, cfg.bal1 - feeBuffer)) {
        if (typeof showNotification === 'function') showNotification('Reserved 0.05 FB for fees', 'info', 2200);
        el1.value = Math.max(0, cfg.bal1 - feeBuffer).toFixed(8);
        syncLiquidityAmounts(1);
        return;
    }

    if (amount0 > (cfg.bal0 || 0) || amount1 > (cfg.bal1 || 0)) {
        document.getElementById('depositLinkModal').classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = 'PREPARING…';

    try {
        if (!userPubkey)
            try {
                userPubkey = await window.unisat.getPublicKey();
            } catch (e) {}

        const ts = Math.floor(Date.now() / 1000);

        // Estimate expected LP using poolLp if available
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
            `&address=${encodeURIComponent(userAddress)}` +
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
                'x-public-key': userPubkey,
                'x-address': userAddress
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
            // IMPORTANT: do not trim/normalize; signature verification requires exact bytes
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

        // API body по документации: address, tick0, tick1, amount0, amount1, lp, slippage, ts, feeTick, feeAmount, feeTickPrice, sigs, payType, rememberPayType
        const body = {
            address: userAddress,
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

        console.log('Submitting add_liq with body:', body);

        const sub = await fetch(`${BACKEND_URL}?action=add_liq`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(body)
        }).then(r => r.json());

        if (!sub || sub.code !== 0) throw new Error(sub?.msg || sub?.error || 'add_liq failed');

        showSuccess(`Liquidity supplied! ID: ${sub.data?.id || 'OK'}`);
        if (typeof showNotification === 'function')
            showNotification('Liquidity supplied successfully', 'success', 3200);
        setTimeout(checkBalance, 2000);
    } catch (e) {
        console.error('Add liquidity error:', e);
        if (typeof showNotification === 'function') showNotification(e?.message || String(e), 'error', 4500);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// closeAddLiquidityModal is now imported as module

// switchLiquidityTab is now imported as module

// openAddLiquidityModal is now imported as module

// loadLiquidityPoolData is now imported as module

// selectLiquidityPair is now imported as module

// fetchMyLiquiditySummary is now imported as module

// refreshMyLiquidityForSelectedPair is now imported as module

// openRemoveLiquidityModal is now imported as module

// closeRemoveLiquidityModal is now imported as module

// setMaxRemoveLp is now imported as module

// updateRemoveLiquidityEstimate is now imported as module

// doRemoveLiquidity is now imported as module

// getBalanceForTick is now imported as module

// getLiquidityConfig is now imported as module

// updateLiquidityBalancesUI is now imported as module

// __normalizeAmountStr is now imported as module

// computeExpectedLp is now imported as module

// syncLiquidityAmounts is now imported as module

// setMaxLiqAmount is now imported as module

// copyLiquidityPairForSearch is now imported as module

// doAddLiquidity is now imported as module
function updateUI() {
    // Update UI based on current swap pair
    let inTick, outTick, inIcon, outIcon, bal;
    if (currentSwapPair === 'FB_FENNEC') {
        inTick = isBuying ? 'FB' : 'FENNEC';
        outTick = isBuying ? 'FENNEC' : 'FB';
        inIcon = isBuying ? 'img/FB.png' : 'img/phav.png';
        outIcon = isBuying ? 'img/phav.png' : 'img/FB.png';
        bal = isBuying ? userBalances.sFB : userBalances.FENNEC;
    } else {
        // BTC_FB (sBTC <-> FB, но отображаем как BTC)
        inTick = isBuying ? 'BTC' : 'FB';
        outTick = isBuying ? 'FB' : 'BTC';
        // SVG иконка для BTC
        inIcon = isBuying ? 'img/BTC.svg' : 'img/FB.png';
        outIcon = isBuying ? 'img/FB.png' : 'img/BTC.svg';

        if (isBuying) {
            // Продаем sBTC -> получаем FB. Нужен баланс sBTC на InSwap
            bal = poolReserves.user_sBTC || 0;
        } else {
            // Продаем FB -> получаем sBTC. Нужен баланс FB на InSwap
            bal = userBalances.sFB || 0;
        }
    }

    const iconInEl = document.getElementById('iconIn');
    const tickerInEl = document.getElementById('tickerIn');
    const iconOutEl = document.getElementById('iconOut');
    const tickerOutEl = document.getElementById('tickerOut');
    const balInEl = document.getElementById('balIn');

    if (iconInEl) iconInEl.src = inIcon;
    if (tickerInEl) tickerInEl.innerText = inTick;
    if (iconOutEl) iconOutEl.src = outIcon;
    if (tickerOutEl) tickerOutEl.innerText = outTick;
    if (balInEl) balInEl.innerText = `Bal: ${bal.toFixed(4)}`;

    // UPDATE BUTTON TEXT - просто "SWAP" для всех пар
    const btn = document.getElementById('swapBtn');
    if (btn) {
        btn.innerText = 'SWAP';
    }

    updateWithdrawUI();
}

// window.connectWallet is already defined at the top of the script

async function fetchReserves() {
    const __pairKey = String(currentSwapPair || '').trim() || 'default';
    return await __fennecDedupe(`fetchReserves:${__pairKey}`, async () => {
        try {
            // Проверяем кэш
            const now = Date.now();
            if (poolCache.data && now - poolCache.timestamp < poolCache.ttl) {
                console.log('Using cached pool data');
                return poolCache.data;
            }

            // Fetch pool info based on current swap pair
            let queryParams = '';
            if (currentSwapPair === 'BTC_FB') {
                // Пробуем прямой порядок
                queryParams = `tick0=${T_SBTC}&tick1=${T_SFB}`;
            } else {
                queryParams = `tick0=${T_FENNEC}&tick1=${T_SFB}`;
            }

            let poolUrl = `${BACKEND_URL}?action=quote&${queryParams}`;

            const json = await safeFetchJson(poolUrl, { timeoutMs: 12000, retries: 2 });
            if (!json) throw new Error('Failed to fetch pool data');
            console.log(`Pool response for ${currentSwapPair}:`, json);

            let data = null;
            // Логика извлечения данных
            if (json.data) {
                if (json.data.tick0)
                    data = json.data; // Одиночный объект
                else if (Array.isArray(json.data.list) && json.data.list.length > 0) data = json.data.list[0];
            } else if (json.pool) {
                data = json.pool;
            }

            // Если данных нет, и это пара BTC_FB, пробуем поменять тикеры местами
            if (!data && currentSwapPair === 'BTC_FB') {
                console.log('Retrying pool fetch with swapped tickers...');
                queryParams = `tick0=${T_SFB}&tick1=${T_SBTC}`;
                poolUrl = `${BACKEND_URL}?action=quote&${queryParams}&t=${now}`;
                const retryJson = await safeFetchJson(poolUrl, { timeoutMs: 12000, retries: 1 });
                if (retryJson.data && retryJson.data.tick0) {
                    data = retryJson.data;
                } else if (retryJson.pool) {
                    data = retryJson.pool;
                }
            }

            if (data) {
                // Сохраняем активные тикеры, как они вернулись из API
                activeTickers.tick0 = data.tick0;
                activeTickers.tick1 = data.tick1;

                console.log(
                    `Pool data: tick0=${data.tick0}, tick1=${data.tick1}, amount0=${data.amount0}, amount1=${data.amount1}`
                );

                // Парсим резервы
                if (currentSwapPair === 'FB_FENNEC') {
                    if (data.tick0.includes('FENNEC')) {
                        poolReserves.FENNEC = parseFloat(data.amount0);
                        poolReserves.sFB = parseFloat(data.amount1);
                    } else {
                        poolReserves.sFB = parseFloat(data.amount0);
                        poolReserves.FENNEC = parseFloat(data.amount1);
                    }
                } else {
                    // sBTC - FB pair
                    // Проверяем точное совпадение или частичное
                    const isTick0BTC = data.tick0 === T_SBTC || data.tick0.includes('sBTC');

                    if (isTick0BTC) {
                        poolReserves.BTC = parseFloat(data.amount0);
                        poolReserves.sFB = parseFloat(data.amount1);
                    } else {
                        poolReserves.sFB = parseFloat(data.amount0);
                        poolReserves.BTC = parseFloat(data.amount1);
                    }
                }

                console.log(
                    `Pool reserves: BTC=${poolReserves.BTC}, sFB=${poolReserves.sFB}, FENNEC=${poolReserves.FENNEC}`
                );

                const statusEl = document.getElementById('statusVal');
                if (statusEl) statusEl.innerText = 'Active';
                // Кэшируем данные
                poolCache.data = data;
                poolCache.timestamp = now;
                // Если есть введенное значение, пересчитываем
                const swapInEl = document.getElementById('swapIn');
                if (swapInEl && swapInEl.value) calc();
            } else {
                console.warn('Pool data not found for query:', queryParams);
                const statusEl2 = document.getElementById('statusVal');
                if (statusEl2) statusEl2.innerText = 'Empty';
            }
        } catch (e) {
            console.warn('Pool fetch error', e);
            const statusEl3 = document.getElementById('statusVal');
            if (statusEl3) statusEl3.innerText = 'Offline';
        }
    });
}
async function checkBalance(force = false) {
    if (!userAddress) return;
    const __addrKey = String(userAddress || '').trim();
    return await __fennecDedupe(`checkBalance:${__addrKey}:${force ? 1 : 0}`, async () => {
        const now = Date.now();
        try {
            if (!force && balanceCache && balanceCache.data && now - balanceCache.timestamp < balanceCache.ttl) {
                const cached = balanceCache.data;
                if (cached && typeof cached === 'object') {
                    try {
                        if (cached.userBalances && typeof cached.userBalances === 'object') {
                            userBalances.sFB = Number(cached.userBalances.sFB || 0) || 0;
                            userBalances.FENNEC = Number(cached.userBalances.FENNEC || 0) || 0;
                            userBalances.BTC = Number(cached.userBalances.BTC || 0) || 0;
                        }
                    } catch (_) {}
                    try {
                        if (cached.walletBalances && typeof cached.walletBalances === 'object') {
                            walletBalances.sFB = Number(cached.walletBalances.sFB || 0) || 0;
                            walletBalances.FENNEC = Number(cached.walletBalances.FENNEC || 0) || 0;
                            walletBalances.BTC = Number(cached.walletBalances.BTC || 0) || 0;
                        }
                    } catch (_) {}
                    try {
                        if (cached.poolReserves && typeof cached.poolReserves === 'object') {
                            poolReserves.user_sBTC = Number(cached.poolReserves.user_sBTC || 0) || 0;
                        }
                    } catch (_) {}

                    updatePnL();
                    updateUI();
                    try {
                        if (typeof updateLiquidityBalancesUI === 'function') updateLiquidityBalancesUI();
                    } catch (_) {}

                    try {
                        const liqModal = document.getElementById('addLiquidityModal');
                        if (liqModal && !liqModal.classList.contains('hidden')) {
                            if (typeof loadLiquidityPoolData === 'function') {
                                loadLiquidityPoolData(currentLiquidityPair);
                            }
                        }
                    } catch (_) {}

                    return;
                }
            }
        } catch (e) {
            console.warn('Balance check failed', e);
            return;
        }

        // ОПТИМИЗАЦИЯ: Используем batch endpoint для получения всех балансов за один запрос
        const ticks = [T_SFB, T_FENNEC, T_SBTC].join(',');
        const batchRes = await fetch(`${BACKEND_URL}?action=balance_batch&address=${userAddress}&ticks=${ticks}`).then(
            r => r.json()
        );

        // Парсим результаты из batch ответа
        const rFB = batchRes.data?.[T_SFB] || {};
        const rFennec = batchRes.data?.[T_FENNEC] || {};
        const rBTC = batchRes.data?.[T_SBTC] || {};

        userBalances.sFB = parseFloat(
            rFB.data?.balance?.swap ?? rFB.data?.balance?.available ?? rFB.data?.balance?.total ?? 0
        );
        userBalances.FENNEC = parseFloat(rFennec.data?.balance?.swap || rFennec.data?.balance?.available || 0);
        // Баланс sBTC внутри InSwap (для свапа)
        poolReserves.user_sBTC = parseFloat(rBTC.data?.balance?.swap || rBTC.data?.balance?.available || 0);

        try {
            const currentChain = await window.unisat.getChain();
            const wasOnBitcoin = currentChain === 'BITCOIN_MAINNET';

            if (wasOnBitcoin) {
                await window.unisat.switchChain('FRACTAL_BITCOIN_MAINNET');
            }

            const nativeBal = await window.unisat.getBalance();
            walletBalances.sFB = nativeBal.total / 100000000;

            if (wasOnBitcoin) {
                await window.unisat.switchChain('BITCOIN_MAINNET');
            }
        } catch (e) {
            console.warn('Failed to refresh FB wallet balance (checkBalance):', e);
            walletBalances.sFB = 0;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                try {
                    controller.abort();
                } catch (_) {}
            }, 6000);
            const btcBalanceRes = await fetch(`${BACKEND_URL}?action=btc_balance&address=${userAddress}`, {
                signal: controller.signal,
                headers: { Accept: 'application/json' }
            })
                .then(r => (r.ok ? r.json().catch(() => null) : null))
                .catch(() => null);
            clearTimeout(timeoutId);
            const b = Number(btcBalanceRes?.data?.balance || 0) || 0;
            walletBalances.BTC = b;
        } catch (e) {
            console.warn('Failed to refresh BTC wallet balance (checkBalance):', e);
            walletBalances.BTC = Number(walletBalances.BTC || 0) || 0;
        }

        // 2. Native FB Balance (Wallet) - уже загружен выше

        // Get FENNEC wallet balance (BRC-20 in wallet) via UniSat API
        try {
            const fennecBalanceUrl = `${BACKEND_URL}?action=balance&address=${userAddress}&tick=${T_FENNEC}&walletOnly=true`;
            const fennecWalletRes = await fetch(fennecBalanceUrl).then(r => r.json());
            console.log('FENNEC balance response:', fennecWalletRes);
            // Try multiple possible fields for balance
            const balance =
                fennecWalletRes.data?.availableBalance ||
                fennecWalletRes.data?.transferableBalance ||
                fennecWalletRes.data?.balance?.availableBalance ||
                fennecWalletRes.data?.balance?.transferableBalance ||
                fennecWalletRes.data?.balance?.available ||
                fennecWalletRes.data?.balance?.transferable ||
                0;
            walletBalances.FENNEC = parseFloat(balance);
            console.log('FENNEC wallet balance:', walletBalances.FENNEC);
        } catch (e) {
            console.warn('Failed to load FENNEC wallet balance:', e);
            walletBalances.FENNEC = 0;
        }

        updatePnL();
        updateUI();
        if (typeof updateLiquidityBalancesUI === 'function') {
            updateLiquidityBalancesUI();
        }
        const liqModal = document.getElementById('addLiquidityModal');
        if (liqModal && !liqModal.classList.contains('hidden')) {
            if (typeof loadLiquidityPoolData === 'function') {
                loadLiquidityPoolData(currentLiquidityPair);
            }
        }

        try {
            balanceCache.data = {
                userBalances: {
                    sFB: Number(userBalances.sFB || 0) || 0,
                    FENNEC: Number(userBalances.FENNEC || 0) || 0,
                    BTC: Number(userBalances.BTC || 0) || 0
                },
                walletBalances: {
                    sFB: Number(walletBalances.sFB || 0) || 0,
                    FENNEC: Number(walletBalances.FENNEC || 0) || 0,
                    BTC: Number(walletBalances.BTC || 0) || 0
                },
                poolReserves: {
                    user_sBTC: Number(poolReserves.user_sBTC || 0) || 0
                }
            };
            balanceCache.timestamp = now;
        } catch (_) {}
    });
}

// ===== PERSONAL PNL (MY STASH) =====
function updatePnL() {
    try {
        const pnlCard = document.getElementById('pnlCard');
        if (!pnlCard) return; // Element doesn't exist, skip

        // Check if user has FENNEC balance
        const fennecBalance = userBalances.FENNEC || 0;

        if (fennecBalance < 0.01) {
            pnlCard.classList.add('hidden');
            return;
        }

        // Show card
        pnlCard.classList.remove('hidden');
        const pnlAmount = document.getElementById('pnlAmount');
        if (pnlAmount) {
            const fennecBalNum = typeof fennecBalance === 'number' ? fennecBalance : parseFloat(fennecBalance || 0);
            pnlAmount.innerText = fennecBalNum.toFixed(2);
        }

        // Get current price from chart
        const currentPriceEl = document.getElementById('chartPrice');
        if (currentPriceEl && currentPriceEl.innerText !== '--') {
            // ИСПРАВЛЕНИЕ: Используем точное значение из data-атрибута если есть, иначе парсим
            const currentPrice = currentPriceEl.dataset.price
                ? parseFloat(currentPriceEl.dataset.price)
                : parseFloat(currentPriceEl.innerText);
            if (!isNaN(currentPrice)) {
                const valueInFB = fennecBalance * currentPrice;
                const pnlPercent = document.getElementById('pnlPercent');
                if (pnlPercent) {
                    pnlPercent.innerText = `≈ ${valueInFB.toFixed(2)} FB`;
                    pnlPercent.className = 'text-lg font-bold font-mono text-fennec';
                }
            }
        }
    } catch (e) {
        console.warn('PnL update error:', e);
    }
}

// ===== THE DIG ANIMATION =====
let digInterval = null;
function startDiggingAnimation() {
    const btn = document.getElementById('swapBtn');
    if (!btn) return;

    // Save original text
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;

    // Change button
    btn.innerHTML = `
                                                                                                                    <div class="flex items-center justify-center gap-3">
                                                                                                                        <span class="text-xl digging-fox"></span>
                                                                                                                        <span>DIGGING FOR TOKENS...</span>
                                                                                                                    </div>
                                                                                                                `;

    // Clear previous interval if exists
    if (digInterval) clearInterval(digInterval);

    // Flying dirt effect
    digInterval = setInterval(() => {
        if (!btn.disabled) {
            clearInterval(digInterval);
            digInterval = null;
            return;
        }

        const rect = btn.getBoundingClientRect();
        const dirt = document.createElement('div');
        dirt.className = 'dirt-particle';
        // Random position around button
        dirt.style.left = rect.left + rect.width / 2 + (Math.random() * 40 - 20) + 'px';
        dirt.style.top = rect.top + 20 + 'px';
        dirt.style.animation = `dirtFly ${0.5 + Math.random()}s ease-out forwards`;
        document.body.appendChild(dirt);

        setTimeout(() => dirt.remove(), 1000);
    }, 100);
}

function stopDiggingAnimation() {
    const btn = document.getElementById('swapBtn');
    if (digInterval) {
        clearInterval(digInterval);
        digInterval = null;
    }
    if (btn && btn.dataset.originalText) {
        btn.innerText = btn.dataset.originalText;
    }
}

// ===== WHALE WATCHER =====
let lastWhaleTx = '';

// ИСПРАВЛЕНИЕ: Кэш для swap_history чтобы не делать дублирующиеся запросы
const swapHistoryCache = {
    data: null,
    timestamp: 0,
    ttl: 45000 // 45 секунд кэш
};

// ИСПРАВЛЕНИЕ: Единая функция загрузки swap_history для всех вкладок
async function loadSwapHistory(useCache = true) {
    const now = Date.now();
    const __lsKey = 'fennec_swap_history_cache_v2';
    const __readLs = () => {
        try {
            const raw = localStorage.getItem(__lsKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            const ts = Number(parsed.ts || 0) || 0;
            if (!ts || now - ts > swapHistoryCache.ttl) return null;
            const data = parsed.data;
            if (!data || typeof data !== 'object') return null;
            return data;
        } catch (_) {
            return null;
        }
    };

    return await __fennecDedupe(`loadSwapHistory:${useCache ? 1 : 0}`, async () => {
        // 1) memory cache
        if (useCache && swapHistoryCache.data && now - swapHistoryCache.timestamp < swapHistoryCache.ttl) {
            return swapHistoryCache.data;
        }

        // 2) localStorage cache (warm-start)
        if (useCache) {
            const cached = __readLs();
            if (cached) {
                swapHistoryCache.data = cached;
                swapHistoryCache.timestamp = now;
                return cached;
            }
        }

        try {
            const limit = 50;
            const [sResFB_FENNEC, sResBTC_FB] = await Promise.all([
                safeFetchJson(`${BACKEND_URL}?action=swap_history&start=0&limit=${limit}&tick=sFB___000/FENNEC`, {
                    timeoutMs: 12000,
                    retries: 2
                }).then(r => r || { code: -1 }),
                safeFetchJson(`${BACKEND_URL}?action=swap_history&start=0&limit=${limit}&tick=sBTC___000/sFB___000`, {
                    timeoutMs: 12000,
                    retries: 2
                }).then(r => r || { code: -1 })
            ]);

            const result = {
                fbFennec: sResFB_FENNEC,
                btcFb: sResBTC_FB,
                timestamp: now
            };

            swapHistoryCache.data = result;
            swapHistoryCache.timestamp = now;

            try {
                localStorage.setItem(__lsKey, JSON.stringify({ ts: now, data: result }));
            } catch (_) {}

            return result;
        } catch (e) {
            return swapHistoryCache.data || { fbFennec: { code: -1 }, btcFb: { code: -1 } };
        }
    });
}

try {
    window.fetchReserves = fetchReserves;
} catch (_) {}
try {
    window.checkBalance = checkBalance;
} catch (_) {}
try {
    window.refreshTransactionHistory = refreshTransactionHistory;
} catch (_) {}
try {
    window.loadSwapHistory = loadSwapHistory;
} catch (_) {}
try {
    window.checkWhales = checkWhales;
} catch (_) {}
try {
    window.updateUI = updateUI;
} catch (_) {}

async function checkWhales() {
    try {
        // ИСПРАВЛЕНИЕ: Используем кэшированные данные вместо нового запроса
        const swapData = await loadSwapHistory(true);
        const sResFB_FENNEC = swapData.fbFennec;

        if (sResFB_FENNEC.code === 0 && sResFB_FENNEC.data?.list?.length > 0) {
            const tx = sResFB_FENNEC.data.list[0]; // Most recent

            // If this is a new transaction (not the one we saw last time)
            if (tx.txid !== lastWhaleTx) {
                lastWhaleTx = tx.txid;

                // Determine direction and amounts
                const tickIn = tx.tickIn || tx.tick0 || '';
                const tickOut = tx.tickOut || tx.tick1 || '';
                const amountIn = parseFloat(tx.amountIn || tx.amount0 || tx.amount || 0);
                const amountOut = parseFloat(tx.amountOut || tx.amount1 || 0);

                const isFennecToFB = tickIn.includes('FENNEC');
                const fennecAmount = isFennecToFB ? amountIn : amountOut;
                const fbAmount = isFennecToFB ? amountOut : amountIn;

                // Whale threshold: > 1000 FENNEC or > 10 FB
                if (fennecAmount > 1000 || fbAmount > 10) {
                    showWhaleAlert(fennecAmount, fbAmount, isFennecToFB);
                }
            }
        }
    } catch (e) {
        console.warn('Whale check error:', e);
    }
}

function showWhaleAlert(fennecAmount, fbAmount, isFennecToFB) {
    const el = document.getElementById('whaleWatcher');
    const msg = document.getElementById('whaleMsg');

    el.classList.remove('hidden');
    // Small delay for slide-in animation
    setTimeout(() => el.classList.remove('translate-y-[200%]'), 100);

    // Format message
    const direction = isFennecToFB ? 'FENNEC → FB' : 'FB → FENNEC';
    const mainAmount = isFennecToFB ? fennecAmount : fbAmount;
    const mainTick = isFennecToFB ? 'FENNEC' : 'FB';

    try {
        msg.innerHTML = '';
        msg.appendChild(document.createTextNode('Wow! Someone just swapped '));
        const strong = document.createElement('span');
        strong.className = 'text-fennec font-bold';
        strong.textContent = `${mainAmount.toFixed(0)} ${mainTick}`;
        msg.appendChild(strong);
        msg.appendChild(document.createTextNode(`! (${direction})`));
    } catch (_) {
        msg.textContent = `Wow! Someone just swapped ${mainAmount.toFixed(0)} ${mainTick}! (${direction})`;
    }

    // Hide after 7 seconds
    setTimeout(() => {
        el.classList.add('translate-y-[200%]');
    }, 7000);
}

// ИСПРАВЛЕНИЕ: Отключен автоматический whale watching для снижения нагрузки на API
// Whale watching теперь происходит только при обновлении истории транзакций
// setInterval(checkWhales, 10000); // Отключено

// ИСПРАВЛЕНИЕ: Увеличен debounce для снижения количества запросов к API
let timer, reverseTimer;
function debounceQuote() {
    clearTimeout(timer);
    timer = setTimeout(() => calc(), 500);
} // Увеличено с 100ms до 500ms
function debounceReverse() {
    clearTimeout(reverseTimer);
    reverseTimer = setTimeout(() => calcReverse(), 500);
} // Увеличено с 100ms до 500ms

async function calc() {
    const val = parseFloat(document.getElementById('swapIn').value);
    if (!val) {
        document.getElementById('swapOut').value = '';
        return 0;
    }

    // Определяем тикеры для запроса
    let tickIn, tickOut;
    if (currentSwapPair === 'FB_FENNEC') {
        tickIn = isBuying ? T_SFB : T_FENNEC;
        tickOut = isBuying ? T_FENNEC : T_SFB;
    } else {
        // BTC_FB
        tickIn = isBuying ? T_SBTC : T_SFB;
        tickOut = isBuying ? T_SFB : T_SBTC;
    }

    // Используем quote_swap API для получения точного курса
    try {
        // Формируем URL правильно - проверяем, есть ли уже параметры в BACKEND_URL
        const separator = BACKEND_URL.includes('?') ? '&' : '?';
        // ВАЖНО: address обязателен для quote_swap, если нет - используем пустую строку или подключаем кошелек
        if (!userAddress) {
            console.warn('No address for quote_swap, connecting wallet...');
            window.connectWallet();
            // Используем fallback расчет если адрес недоступен
            throw new Error('Address required');
        }
        const quoteUrl = `${BACKEND_URL}${separator}action=quote_swap&exactType=exactIn&tickIn=${tickIn}&tickOut=${tickOut}&amount=${val}&address=${userAddress}`;
        console.log('Quote request:', quoteUrl);
        const quoteRes = await fetch(quoteUrl).then(r => {
            if (!r.ok) {
                console.error('Quote API error:', r.status, r.statusText);
                return r.json().catch(() => ({ code: -1, msg: `HTTP ${r.status}`, error: 'Unknown action' }));
            }
            return r.json();
        });

        console.log('Quote response:', quoteRes);

        if (quoteRes.code === 0 && quoteRes.data) {
            // ЛОГИРУЕМ СЫРОЕ ЗНАЧЕНИЕ ДЛЯ ОТЛАДКИ
            console.log('Raw expect value:', quoteRes.data.expect);

            // ЯВНАЯ ПРОВЕРКА: Сначала ищем expect
            let rawAmount = quoteRes.data.expect;

            // Если expect нет, ищем другие поля
            if (!rawAmount) {
                rawAmount =
                    quoteRes.data.amountOut ||
                    quoteRes.data.outAmount ||
                    quoteRes.data.receiveAmount ||
                    quoteRes.data.amount;
            }

            const amountOut = parseFloat(rawAmount);

            console.log(`Parsed amountOut: ${amountOut} from raw: ${rawAmount}`);

            if (amountOut > 0) {
                document.getElementById('swapOut').value = amountOut.toFixed(6);

                // Обновляем курс
                const rate = amountOut / val;
                let rateText;
                if (currentSwapPair === 'FB_FENNEC') {
                    rateText = `1 ${isBuying ? 'FB' : 'FENNEC'} ≈ ${rate.toFixed(2)} ${isBuying ? 'FENNEC' : 'FB'}`;
                } else {
                    // BTC_FB
                    rateText = `1 ${isBuying ? 'BTC' : 'FB'} ≈ ${rate.toFixed(2)} ${isBuying ? 'FB' : 'BTC'}`;
                }
                document.getElementById('rateVal').innerText = rateText;
                return amountOut;
            } else {
                console.warn('quote_swap returned invalid amountOut:', quoteRes.data);
            }
        } else {
            console.warn('quote_swap failed:', quoteRes);
        }
    } catch (e) {
        console.error('quote_swap error:', e);
        console.warn('quote_swap failed, using fallback calculation:', e);
    }

    // Fallback: расчет из резервов (аналогично FB-FENNEC)
    let rIn, rOut;
    if (currentSwapPair === 'FB_FENNEC') {
        rIn = isBuying ? poolReserves.sFB : poolReserves.FENNEC;
        rOut = isBuying ? poolReserves.FENNEC : poolReserves.sFB;
    } else {
        // BTC_FB - используем резервы из пула sBTC/sFB
        rIn = isBuying ? poolReserves.BTC : poolReserves.sFB;
        rOut = isBuying ? poolReserves.sFB : poolReserves.BTC;
    }
    if (rIn === 0 || rOut === 0) {
        console.warn('Pool reserves are zero, cannot calculate');
        return 0;
    }
    // AMM формула: out = (amountIn * 985 * rOut) / (rIn * 1000 + amountIn * 985)
    const fee = val * 985;
    const out = (fee * rOut) / (rIn * 1000 + fee);
    const rate = out / val;
    document.getElementById('swapOut').value = out.toFixed(6);
    // Update rate display based on current pair
    let rateText;
    if (currentSwapPair === 'FB_FENNEC') {
        rateText = `1 ${isBuying ? 'FB' : 'FENNEC'} ≈ ${rate.toFixed(2)} ${isBuying ? 'FENNEC' : 'FB'}`;
    } else {
        // BTC_FB
        rateText = `1 ${isBuying ? 'BTC' : 'FB'} ≈ ${rate.toFixed(2)} ${isBuying ? 'FB' : 'BTC'}`;
    }
    document.getElementById('rateVal').innerText = rateText;
    return out;
}

async function calcReverse() {
    const desiredOut = parseFloat(document.getElementById('swapOut').value);
    if (!desiredOut) {
        document.getElementById('swapIn').value = '';
        return;
    }

    // Определяем тикеры для запроса
    let tickIn, tickOut;
    if (currentSwapPair === 'FB_FENNEC') {
        tickIn = isBuying ? T_SFB : T_FENNEC;
        tickOut = isBuying ? T_FENNEC : T_SFB;
    } else {
        // BTC_FB
        tickIn = isBuying ? T_SBTC : T_SFB;
        tickOut = isBuying ? T_SFB : T_SBTC;
    }

    // Используем quote_swap API с exactType=exactOut для обратного расчета
    try {
        const separator = BACKEND_URL.includes('?') ? '&' : '?';
        // ВАЖНО: address обязателен для quote_swap
        if (!userAddress) {
            console.warn('No address for quote_swap, connecting wallet...');
            window.connectWallet();
            throw new Error('Address required');
        }
        const quoteUrl = `${BACKEND_URL}${separator}action=quote_swap&exactType=exactOut&tickIn=${tickIn}&tickOut=${tickOut}&amount=${desiredOut}&address=${userAddress}`;
        const quoteRes = await fetch(quoteUrl).then(r => {
            if (!r.ok) {
                console.error('Quote API error (reverse):', r.status, r.statusText);
                return r.json().catch(() => ({ code: -1, msg: `HTTP ${r.status}` }));
            }
            return r.json();
        });

        if (quoteRes.code === 0 && quoteRes.data) {
            // ЛОГИРУЕМ СЫРОЕ ЗНАЧЕНИЕ ДЛЯ ОТЛАДКИ
            console.log('Raw expect value (reverse):', quoteRes.data.expect);

            // ЯВНАЯ ПРОВЕРКА: Сначала ищем expect
            let rawAmount = quoteRes.data.expect;

            // Если expect нет, ищем другие поля
            if (!rawAmount) {
                rawAmount =
                    quoteRes.data.amountIn || quoteRes.data.inAmount || quoteRes.data.payAmount || quoteRes.data.amount;
            }

            const amountIn = parseFloat(rawAmount);

            console.log(`Parsed amountIn: ${amountIn} from raw: ${rawAmount}`);

            if (amountIn > 0) {
                document.getElementById('swapIn').value = amountIn.toFixed(6);

                // Обновляем курс
                const rate = desiredOut / amountIn;
                let rateText;
                if (currentSwapPair === 'FB_FENNEC') {
                    rateText = `1 ${isBuying ? 'FB' : 'FENNEC'} ≈ ${rate.toFixed(2)} ${isBuying ? 'FENNEC' : 'FB'}`;
                } else {
                    // BTC_FB
                    rateText = `1 ${isBuying ? 'BTC' : 'FB'} ≈ ${rate.toFixed(2)} ${isBuying ? 'FB' : 'BTC'}`;
                }
                document.getElementById('rateVal').innerText = rateText;
                return;
            } else {
                console.warn('quote_swap returned invalid amountIn:', quoteRes.data);
            }
        } else {
            console.warn('quote_swap failed:', quoteRes);
        }
    } catch (e) {
        console.warn('quote_swap failed, using fallback calculation:', e);
    }

    // Fallback: расчет из резервов (старый метод)
    let rIn, rOut;
    if (currentSwapPair === 'FB_FENNEC') {
        rIn = isBuying ? poolReserves.sFB : poolReserves.FENNEC;
        rOut = isBuying ? poolReserves.FENNEC : poolReserves.sFB;
    } else {
        // BTC_FB
        rIn = isBuying ? poolReserves.BTC : poolReserves.sFB;
        rOut = isBuying ? poolReserves.sFB : poolReserves.BTC;
    }
    if (rOut === 0) return;

    // Обратная формула AMM: amountIn = (desiredOut * rIn * 1000) / ((rOut - desiredOut) * 985)
    const numerator = desiredOut * rIn * 1000;
    const denominator = (rOut - desiredOut) * 985;
    if (denominator <= 0) return alert('Amount too large for pool');

    const amountIn = numerator / denominator;
    document.getElementById('swapIn').value = amountIn.toFixed(6);

    const rate = desiredOut / amountIn;
    // Update rate display based on current pair
    let rateText;
    if (currentSwapPair === 'FB_FENNEC') {
        rateText = `1 ${isBuying ? 'FB' : 'FENNEC'} ≈ ${rate.toFixed(2)} ${isBuying ? 'FENNEC' : 'FB'}`;
    } else {
        // BTC_FB
        rateText = `1 ${isBuying ? 'BTC' : 'FB'} ≈ ${rate.toFixed(2)} ${isBuying ? 'FB' : 'BTC'}`;
    }
    document.getElementById('rateVal').innerText = rateText;
}

async function doSwap() {
    if (!userAddress) return window.connectWallet();

    // CHECK NETWORK FIRST
    try {
        await checkFractalNetwork();
    } catch (e) {
        document.getElementById('errorMsg').innerText = e.message;
        document.getElementById('errorModal').classList.remove('hidden');
        return;
    }

    let amount = parseFloat(document.getElementById('swapIn').value);
    if (!amount) {
        if (typeof showNotification === 'function') showNotification('Enter amount', 'warning', 2000);
        return;
    }

    // Check balance
    let bal;
    if (currentSwapPair === 'FB_FENNEC') {
        bal = isBuying ? userBalances.sFB : userBalances.FENNEC;
    } else {
        // BTC_FB
        bal = isBuying ? poolReserves.user_sBTC || 0 : userBalances.sFB;
    }

    if (currentSwapPair === 'FB_FENNEC' && isBuying) {
        const feeBuffer = 0.05;
        const maxAllowed = Math.max(0, bal - feeBuffer);
        if (maxAllowed <= 0) {
            if (typeof showNotification === 'function') {
                showNotification('Not enough FB after reserving 0.05 for fees', 'warning', 2500);
            }
            return;
        }
        if (amount > maxAllowed) {
            amount = maxAllowed;
            document.getElementById('swapIn').value = amount.toFixed(8);
            calc();
            if (typeof showNotification === 'function') {
                showNotification('Reserved 0.05 FB for fees', 'info', 2200);
            }
        }
    }

    if (bal < amount) {
        document.getElementById('depositLinkModal').classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('swapBtn');
    btn.disabled = true;
    startDiggingAnimation();

    try {
        if (!userPubkey)
            try {
                userPubkey = await window.unisat.getPublicKey();
            } catch (e) {}

        // Determine tickers - упрощенная логика
        let tickIn, tickOut;

        // Для пары BTC_FB всегда используем правильные тикеры
        if (currentSwapPair === 'BTC_FB') {
            tickIn = isBuying ? T_SBTC : T_SFB;
            tickOut = isBuying ? T_SFB : T_SBTC;
        } else {
            // Для пары FB_FENNEC
            if (isBuying) {
                tickIn = T_SFB; // Платим FB
                tickOut = T_FENNEC; // Получаем FENNEC
            } else {
                tickIn = T_FENNEC; // Платим FENNEC
                tickOut = T_SFB; // Получаем FB
            }
        }

        // 1. Получаем актуальный Quote перед созданием свапа
        // Это критично для избежания slippage error
        const quoteUrl = `${BACKEND_URL}?action=quote_swap&exactType=exactIn&tickIn=${tickIn}&tickOut=${tickOut}&amount=${amount}${userAddress ? `&address=${userAddress}` : ''}`;
        console.log('Getting fresh quote for swap:', quoteUrl);
        const quoteRes = await fetch(quoteUrl).then(r => {
            if (!r.ok) {
                console.error('Quote API error:', r.status, r.statusText);
                return r.json().catch(() => ({ code: -1, msg: `HTTP ${r.status}` }));
            }
            return r.json();
        });
        console.log('Quote response:', quoteRes);

        let expectedOut = 0;
        if (quoteRes.code === 0 && quoteRes.data) {
            // ЯВНАЯ ПРОВЕРКА: Сначала ищем expect
            let rawAmount = quoteRes.data.expect;

            // Если expect нет, ищем другие поля
            if (!rawAmount) {
                rawAmount =
                    quoteRes.data.amountOut ||
                    quoteRes.data.outAmount ||
                    quoteRes.data.receiveAmount ||
                    quoteRes.data.amount;
            }

            expectedOut = parseFloat(rawAmount);
            console.log(`Got quote expect: ${expectedOut} from raw: ${rawAmount}`);
        }

        if (!expectedOut || expectedOut <= 0) {
            // Если quote не сработал, берем из поля ввода, но это рискованно
            expectedOut = parseFloat(document.getElementById('swapOut').value);
            console.warn('Using value from input field:', expectedOut);
        }

        if (!expectedOut || isNaN(expectedOut) || expectedOut <= 0) {
            throw new Error('Invalid amount: Please enter a valid swap amount');
        }

        console.log(`Swapping ${amount} ${tickIn} -> Expecting ${expectedOut} ${tickOut}`);

        // 2. Create Swap
        const ts = Math.floor(Date.now() / 1000);
        // IMPORTANT: feeTick always sFB___000 (not FENNEC!)
        // ВАЖНО: Передаем ОЖИДАЕМУЮ сумму (без вычета слиппейджа)
        // InSwap сам применит slippage к amountOut на основе параметра slippage
        const params = new URLSearchParams({
            address: userAddress,
            tickIn: tickIn,
            tickOut: tickOut,
            amountIn: amount.toString(),
            amountOut: expectedOut.toString(), // ВАЖНО: Передаем ОЖИДАЕМУЮ сумму (без вычета слиппейджа)
            slippage: '0.005', // InSwap сам применит этот % к amountOut
            exactType: 'exactIn',
            ts: ts,
            feeTick: T_SFB, // Always sFB___000 for fees!
            payType: 'tick'
        });

        const url = `${BACKEND_URL}?action=create_swap&${params.toString()}`;
        console.log('=== SWAP CREATE ===');
        console.log('URL:', url);
        const res = await fetch(url).then(r => r.json());
        console.log('Response:', res);

        // Обработка ошибки -11 (System recovery in progress)
        if (res.code === -11) {
            throw new Error(
                'InSwap is currently under maintenance (System Recovery). Please try again in 5-10 seconds.'
            );
        }

        if (res.code !== 0) throw new Error(res.msg || 'Swap Error');
        const preSwap = res.data;

        const signatures = [];
        showNotification(`✍️ Signing ${preSwap.signMsgs.length} message(s)...`, 'info', 2000);
        for (const msg of preSwap.signMsgs) {
            const m = typeof msg === 'object' ? msg.text || msg.id : msg;
            await new Promise(r => setTimeout(r, 500));
            const sig = await window.unisat.signMessage(m, 'bip322-simple');
            signatures.push(sig);
        }

        // 3. Submit (pubkey goes in HEADERS, not body!)
        const body = {
            address: userAddress,
            tickIn: tickIn,
            tickOut: tickOut,
            amountIn: amount.toString(),
            amountOut: expectedOut.toString(), // ИСПРАВЛЕНО: используем expectedOut вместо minOut
            slippage: '0.005',
            exactType: 'exactIn',
            ts: ts,
            feeTick: T_SFB, // Always sFB___000 for fees!
            payType: 'tick',
            feeAmount: preSwap.feeAmount,
            feeTickPrice: preSwap.feeTickPrice,
            sigs: signatures,
            rememberPayType: false
        };

        console.log('Submit body:', JSON.stringify(body, null, 2));
        const sub = await fetch(`${BACKEND_URL}?action=submit_swap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(body)
        }).then(r => r.json());

        console.log('Submit response:', sub);
        if (sub.code === 0) {
            triggerSwapSuccessFx();
            if (typeof showNotification === 'function') showNotification('Swap successful', 'swap', 3200);
            const swapTxid = __pickTxid(sub?.data) || __pickTxid(sub);
            document.getElementById('successTxId').innerText = swapTxid || sub.data || sub.txid || 'Swap success!';
            document.getElementById('successModal').classList.remove('hidden');
            setTimeout(checkBalance, 2000);
            try {
                if (typeof addPendingOperation === 'function') {
                    addPendingOperation({
                        type: 'swap',
                        status: 'pending',
                        txid: swapTxid,
                        address: userAddress,
                        tickIn,
                        tickOut,
                        amountIn: amount,
                        amountOut: expectedOut,
                        chain: 'FRACTAL',
                        timestamp: Date.now()
                    });
                }
            } catch (_) {}
        } else throw new Error(sub.msg || 'Submission failed');
    } catch (e) {
        console.error('Swap error:', e);
        if (typeof showNotification === 'function') showNotification(e?.message || String(e), 'error', 4500);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        stopDiggingAnimation();
        btn.disabled = false;
    }
}

// DEPOSIT (STRICTLY FOLLOWS SCREENSHOT PARAMS)
async function setDepositToken(tok, opts) {
    const o = opts && typeof opts === 'object' ? opts : { skipFetch: !!opts, skipFees: false };
    const skipFetch = !!(o && o.skipFetch);
    const skipFees = !!(o && o.skipFees);
    depositToken = tok;
    document.getElementById('dep-btc').className =
        `flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${tok === 'BTC' ? 'border-fennec text-fennec bg-fennec/10' : 'border-gray-700 text-gray-500 hover:text-white'}`;
    document.getElementById('dep-sfb').className =
        `flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${tok === 'sFB' ? 'border-fennec text-fennec bg-fennec/10' : 'border-gray-700 text-gray-500 hover:text-white'}`;
    document.getElementById('dep-fennec').className =
        `flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${tok === 'FENNEC' ? 'border-fennec text-fennec bg-fennec/10' : 'border-gray-700 text-gray-500 hover:text-white'}`;
    document.getElementById('dep-native-ui').style.display = tok === 'sFB' || tok === 'BTC' ? 'block' : 'none';
    document.getElementById('dep-brc20-ui').style.display = tok === 'FENNEC' ? 'block' : 'none';

    // Update label based on token
    const labelEl = document.getElementById('depTickerLabel');
    if (labelEl) labelEl.innerText = tok === 'BTC' ? 'BTC' : 'FB';

    const depAmountEl = document.getElementById('depAmount');
    if (depAmountEl) {
        if (tok === 'BTC') {
            depAmountEl.placeholder = '0.001';
            depAmountEl.min = '0.00001';
        } else if (tok === 'sFB') {
            depAmountEl.placeholder = '1.0';
            depAmountEl.min = '1';
        }
    }

    const depositBtnEl = document.getElementById('btnDeposit');
    if (depositBtnEl) {
        depositBtnEl.innerText = 'DEPOSIT';
    }

    if (!skipFees) {
        if (tok === 'sFB' || tok === 'BTC') {
            await loadFees('deposit');
        }
    }

    // Update balance display
    const balanceDisplayEl = document.getElementById('depBalance');

    if (skipFetch) {
        if (balanceDisplayEl) {
            if (tok === 'BTC') {
                balanceDisplayEl.innerText = walletBalances.BTC
                    ? `Balance: ${(walletBalances.BTC || 0).toFixed(8)} BTC`
                    : 'Balance: -- BTC';
            } else if (tok === 'sFB') {
                balanceDisplayEl.innerText = walletBalances.sFB
                    ? `Balance: ${(walletBalances.sFB || 0).toFixed(8)} FB`
                    : 'Balance: -- FB';
            } else {
                balanceDisplayEl.innerText = walletBalances.FENNEC
                    ? `Balance: ${(walletBalances.FENNEC || 0).toFixed(8)} FENNEC`
                    : 'Balance: --';
            }
        }
    } else if (userAddress) {
        if (tok === 'FENNEC') {
            // Load FENNEC inscriptions (cards)
            loadFennecInscriptions();
        } else if (tok === 'BTC') {
            // For BTC, get balance from Bitcoin Mainnet via Worker API (no network switch needed)
            try {
                const btcBalanceRes = await fetch(`${BACKEND_URL}?action=btc_balance&address=${userAddress}`).then(r =>
                    r.json()
                );
                walletBalances.BTC = parseFloat(btcBalanceRes.data?.balance || 0);
                if (balanceDisplayEl) {
                    balanceDisplayEl.innerText = `Balance: ${walletBalances.BTC.toFixed(8)} BTC`;
                }
            } catch (e) {
                console.warn('Failed to refresh BTC balance:', e);
                walletBalances.BTC = 0;
                if (balanceDisplayEl) {
                    balanceDisplayEl.innerText = 'Balance: 0.00000000 BTC';
                }
            }
        } else {
            // For sFB (Fractal Bitcoin)
            try {
                const currentChain = await window.unisat.getChain();
                const wasOnBitcoin = currentChain === 'BITCOIN_MAINNET';

                if (wasOnBitcoin) {
                    await window.unisat.switchChain('FRACTAL_BITCOIN_MAINNET');
                }

                const nativeBal = await window.unisat.getBalance();
                walletBalances.sFB = nativeBal.total / 100000000;

                if (balanceDisplayEl) {
                    balanceDisplayEl.innerText = `Balance: ${walletBalances.sFB.toFixed(8)} FB`;
                }

                // Switch back to Bitcoin if we were on it
                if (wasOnBitcoin) {
                    await window.unisat.switchChain('BITCOIN_MAINNET');
                }
            } catch (e) {
                console.warn('Failed to refresh FB balance:', e);
                walletBalances.sFB = 0;
                if (balanceDisplayEl) {
                    balanceDisplayEl.innerText = 'Balance: 0.00000000 FB';
                }
            }
        }
    } else {
        // No wallet connected
        if (balanceDisplayEl) {
            balanceDisplayEl.innerText = tok === 'BTC' ? 'Balance: -- BTC' : 'Balance: -- FB';
        }
    }

    let bal = 0;
    if (tok === 'BTC') {
        bal = walletBalances.BTC || 0;
    } else if (tok === 'sFB') {
        bal = walletBalances.sFB;
    } else {
        bal = walletBalances.FENNEC;
    }
    const minText = tok === 'sFB' ? ' (Min: 1 FB)' : tok === 'BTC' ? ' (Min: 0.00001 BTC)' : '';
    const balEl = document.getElementById('dep-bal');
    if (balEl) balEl.innerText = `Wallet Balance: ${bal.toFixed(8)}${minText}`;
}

function setDepositFee(speed) {
    // Reset all buttons first
    const mediumEl = document.getElementById('dep-fee-medium');
    const fastEl = document.getElementById('dep-fee-fast');
    const customEl = document.getElementById('dep-fee-custom');
    const customInput = document.getElementById('dep-fee-custom-input');

    if (speed === 'custom') {
        if (customInput) {
            customInput.style.display = 'block';
            customInput.focus();
        }
        // Highlight custom button, reset others
        if (customEl)
            customEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-fennec bg-fennec/10 text-fennec';
        if (mediumEl)
            mediumEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
        if (fastEl)
            fastEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
        return;
    }

    depositFeeRate = speed === 'fast' ? fractalFees.fastestFee : fractalFees.halfHourFee;
    // Update UI - only one button active
    if (mediumEl)
        mediumEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer ${speed === 'medium' ? 'border-fennec bg-fennec/10 text-fennec' : 'border-white/10 text-gray-500 hover:text-white'}`;
    if (fastEl)
        fastEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer ${speed === 'fast' ? 'border-fennec bg-fennec/10 text-fennec' : 'border-white/10 text-gray-500 hover:text-white'}`;
    if (customEl)
        customEl.className =
            'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
    if (customInput) customInput.style.display = 'none';
}

function setDepositFeeCustom(value) {
    const fee = parseFloat(value);
    if (fee && fee >= 1) {
        depositFeeRate = fee;
        const customEl = document.getElementById('dep-fee-custom');
        const mediumEl = document.getElementById('dep-fee-medium');
        const fastEl = document.getElementById('dep-fee-fast');
        if (customEl)
            customEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-fennec bg-fennec/10 text-fennec';
        if (mediumEl)
            mediumEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
        if (fastEl)
            fastEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
    }
}

function setWithdrawFee(speed) {
    // Reset all buttons first
    const mediumEl = document.getElementById('wd-fee-medium');
    const fastEl = document.getElementById('wd-fee-fast');
    const customEl = document.getElementById('wd-fee-custom');
    const customInput = document.getElementById('wd-fee-custom-input');

    if (speed === 'custom') {
        if (customInput) {
            customInput.style.display = 'block';
            customInput.focus();
        }
        // Highlight custom button, reset others
        if (customEl)
            customEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-fennec bg-fennec/10 text-fennec';
        if (mediumEl)
            mediumEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
        if (fastEl)
            fastEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
        return;
    }

    withdrawFeeRate = speed === 'fast' ? fractalFees.fastestFee : fractalFees.halfHourFee;
    // Update UI - only one button active
    if (mediumEl)
        mediumEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer ${speed === 'medium' ? 'border-fennec bg-fennec/10 text-fennec' : 'border-white/10 text-gray-500 hover:text-white'}`;
    if (fastEl)
        fastEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer ${speed === 'fast' ? 'border-fennec bg-fennec/10 text-fennec' : 'border-white/10 text-gray-500 hover:text-white'}`;
    if (customEl)
        customEl.className =
            'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
    if (customInput) customInput.style.display = 'none';
}

function setWithdrawFeeCustom(value) {
    const fee = parseFloat(value);
    if (fee && fee >= 1) {
        withdrawFeeRate = fee;
        const customEl = document.getElementById('wd-fee-custom');
        const mediumEl = document.getElementById('wd-fee-medium');
        const fastEl = document.getElementById('wd-fee-fast');
        if (customEl)
            customEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-fennec bg-fennec/10 text-fennec';
        if (mediumEl)
            mediumEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
        if (fastEl)
            fastEl.className =
                'flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white';
    }
}

// Functions are now imported as modules

let __feesLastLoadedAt = 0;
async function loadFees(type) {
    try {
        const now = Date.now();
        let res = null;
        if (
            __feesLastLoadedAt > 0 &&
            now - __feesLastLoadedAt < 60000 &&
            fractalFees &&
            fractalFees.fastestFee &&
            fractalFees.halfHourFee &&
            fractalFees.hourFee
        ) {
            res = fractalFees;
        } else {
            res = await fetch(`${BACKEND_URL}?action=gas`)
                .then(r => r.json())
                .catch(() => ({}));
        }

        if (res && res.fastestFee && res.halfHourFee && res.hourFee) {
            fractalFees = res;
            __feesLastLoadedAt = now;
            // Update fee display
            if (type === 'deposit' || type === 'both') {
                const mediumEl = document.getElementById('dep-fee-medium-value');
                const fastEl = document.getElementById('dep-fee-fast-value');
                if (mediumEl) mediumEl.innerText = `${res.halfHourFee} sat/vB`;
                if (fastEl) fastEl.innerText = `${res.fastestFee} sat/vB`;
            }
            if (type === 'withdraw' || type === 'both') {
                const mediumEl = document.getElementById('wd-fee-medium-value');
                const fastEl = document.getElementById('wd-fee-fast-value');
                if (mediumEl) mediumEl.innerText = `${res.halfHourFee} sat/vB`;
                if (fastEl) fastEl.innerText = `${res.fastestFee} sat/vB`;
            }
            // Set default to medium
            if (type === 'deposit' || type === 'both') {
                setDepositFee('medium');
            }
            if (type === 'withdraw' || type === 'both') {
                setWithdrawFee('medium');
            }
        }
    } catch (e) {
        console.warn('Failed to load fees:', e);
    }
}

// Make fee functions globally available
// Functions are now imported as modules
async function doDeposit() {
    // Route to correct function based on token
    if (depositToken === 'FENNEC') {
        return window.doDepositFennec();
    }

    if (depositToken === 'BTC') {
        return doDepositBTC();
    }

    // FB deposit (native)
    if (!userAddress) return window.connectWallet();

    // CHECK NETWORK FIRST
    try {
        await checkFractalNetwork();
    } catch (e) {
        document.getElementById('errorMsg').innerText = e.message;
        document.getElementById('errorModal').classList.remove('hidden');
        return;
    }

    const amount = parseFloat(document.getElementById('depAmount').value);
    if (!amount || amount < 1) return alert('Enter amount (min 1 FB)');
    const btn = document.getElementById('btnDeposit');
    btn.innerText = 'SIGNING...';
    btn.disabled = true;
    try {
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();
        const url = `${BACKEND_URL}?action=create_deposit&pubkey=${userPubkey}&address=${userAddress}&tick=FB&amount=${amount}&assetType=btc&networkType=FRACTAL_BITCOIN_MAINNET&feeRate=${depositFeeRate}`;
        console.log('=== DEPOSIT CREATE ===');
        console.log('URL:', url);
        const res = await fetch(url).then(r => r.json());
        console.log('Response:', res);
        if (res.code !== 0) throw new Error(res.msg || 'Failed to create deposit');
        if (!res.data?.psbt) throw new Error('No PSBT in response');

        // Подписываем PSBT - пусть UniSat сам определит какие входы подписывать
        console.log('Signing PSBT...');
        const signedPsbt = await window.unisat.signPsbt(res.data.psbt, { autoFinalized: false });
        console.log('PSBT signed');

        const confirmBody = {
            address: userAddress,
            amount: amount.toString(),
            assetType: 'btc',
            networkType: 'FRACTAL_BITCOIN_MAINNET',
            psbt: signedPsbt,
            pubkey: userPubkey,
            tick: 'FB'
        };

        console.log('Confirming deposit...');
        const conf = await fetch(`${BACKEND_URL}?action=confirm_deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(confirmBody)
        }).then(r => r.json());

        console.log('Confirm response:', conf);
        if (conf.code === 0) {
            const txid =
                __pickTxid(conf?.data) || __pickTxid(conf) || (typeof conf?.data === 'string' ? conf.data : '');

            // Auto-swap BTC to FB after deposit (only for BTC deposits)
            if (depositToken === 'BTC') {
                btn.innerText = 'SWAPPING BTC TO FB...';
                try {
                    // Wait a bit for deposit to be processed
                    await new Promise(r => setTimeout(r, 3000));

                    // Get current balance after deposit
                    await checkBalance();
                    const availableBTC = userBalances.sFB; // After deposit, BTC becomes FB balance

                    if (availableBTC > 0.1) {
                        // If we have at least 0.1 FB
                        console.log(`Auto-swapping ${availableBTC} FB (from BTC deposit)...`);
                        // No swap needed - BTC deposit already becomes FB
                        console.log('BTC deposit converted to FB automatically!');
                    }
                } catch (swapError) {
                    console.warn('Auto-conversion check failed (deposit still successful):', swapError);
                }
            }

            trackDepositProgress(txid, depositToken);
            try {
                if (typeof addPendingOperation === 'function') {
                    addPendingOperation({
                        type: 'deposit',
                        status: 'pending',
                        txid: __looksLikeTxid(txid) ? txid : '',
                        address: userAddress,
                        tick: 'FB',
                        amount: amount,
                        chain: 'FRACTAL',
                        timestamp: Date.now()
                    });
                }
            } catch (_) {}
        } else throw new Error(conf.msg || 'Deposit confirmation failed');
    } catch (e) {
        console.error('Deposit error:', e);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        btn.innerText = 'DEPOSIT';
        btn.disabled = false;
    }
}

async function doDepositBTC() {
    if (!userAddress) return window.connectWallet();

    // For BTC deposit from Bitcoin Mainnet, we need to switch to Bitcoin Mainnet first
    // Then use Simple Bridge to deposit to Fractal Bitcoin

    const amount = parseFloat(document.getElementById('depAmount').value);
    if (!amount || amount < 0.00001) return alert('Enter amount (min 0.00001 BTC)');
    const btn = document.getElementById('btnDeposit');
    btn.innerText = 'SWITCHING TO BITCOIN MAINNET...';
    btn.disabled = true;

    try {
        // Switch to Bitcoin Mainnet for BTC deposit
        try {
            await window.unisat.switchChain('BITCOIN_MAINNET');
            console.log('Switched to Bitcoin Mainnet');
        } catch (switchError) {
            console.warn('Switch chain warning:', switchError);
            // Continue anyway - user might already be on Bitcoin Mainnet
        }

        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        // Deposit BTC from Bitcoin Mainnet via Simple Bridge
        // networkType=BITCOIN_MAINNET for Simple Bridge
        btn.innerText = 'CREATING DEPOSIT...';
        const url = `${BACKEND_URL}?action=create_deposit&pubkey=${userPubkey}&address=${userAddress}&tick=BTC&amount=${amount}&assetType=btc&networkType=BITCOIN_MAINNET&feeRate=${depositFeeRate}`;
        console.log('=== BTC DEPOSIT CREATE (Simple Bridge) ===');
        console.log('URL:', url);
        const res = await fetch(url).then(r => r.json());
        console.log('Response:', res);
        if (res.code !== 0) throw new Error(res.msg || 'Failed to create deposit');
        if (!res.data?.psbt) throw new Error('No PSBT in response');

        // Подписываем PSBT - пусть UniSat сам определит какие входы подписывать
        btn.innerText = 'SIGNING...';
        console.log('Signing PSBT...');
        const signedPsbt = await window.unisat.signPsbt(res.data.psbt, { autoFinalized: false });
        console.log('PSBT signed');

        const confirmBody = {
            address: userAddress,
            amount: amount.toString(),
            assetType: 'btc',
            networkType: 'BITCOIN_MAINNET', // Bitcoin Mainnet for Simple Bridge
            psbt: signedPsbt,
            pubkey: userPubkey,
            tick: 'BTC'
        };

        btn.innerText = 'CONFIRMING...';
        console.log('Confirming deposit...');
        const conf = await fetch(`${BACKEND_URL}?action=confirm_deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(confirmBody)
        }).then(r => r.json());

        console.log('Confirm response:', conf);
        if (conf.code === 0) {
            const txid = __pickTxid(conf?.data) || __pickTxid(conf) || conf.data || 'Deposit sent!';

            // Switch back to Fractal Bitcoin
            try {
                await window.unisat.switchChain('FRACTAL_BITCOIN_MAINNET');
            } catch (e) {
                console.warn('Failed to switch back to Fractal:', e);
            }

            trackDepositProgress(txid, depositToken);
            try {
                if (typeof addPendingOperation === 'function') {
                    addPendingOperation({
                        type: 'deposit',
                        status: 'pending',
                        txid: __looksLikeTxid(txid) ? txid : '',
                        address: userAddress,
                        tick: 'BTC',
                        amount: amount,
                        chain: 'BITCOIN',
                        timestamp: Date.now()
                    });
                }
            } catch (_) {}
        } else throw new Error(conf.msg || 'Deposit confirmation failed');
    } catch (e) {
        console.error('BTC Deposit error:', e);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');

        // Try to switch back to Fractal on error
        try {
            await window.unisat.switchChain('FRACTAL_BITCOIN_MAINNET');
        } catch (switchError) {
            console.warn('Failed to switch back:', switchError);
        }
    } finally {
        btn.innerText = 'DEPOSIT';
        btn.disabled = false;
    }
}

async function doDepositOLD() {
    if (!userAddress) return window.connectWallet();
    const amount = parseFloat(document.getElementById('depAmount').value);
    if (!amount) return alert('Enter amount');
    const btn = document.getElementById('btnDeposit');
    btn.innerText = 'CREATING...';
    btn.disabled = true;
    try {
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        // Deposit FB через bridge (по инструкции разработчика)
        // tick=FB, assetType=btc, networkType=FRACTAL_BITCOIN_MAINNET
        const params = new URLSearchParams({
            address: userAddress,
            pubkey: userPubkey,
            tick: 'FB',
            amount: amount.toString(),
            assetType: 'btc',
            networkType: 'FRACTAL_BITCOIN_MAINNET'
        });

        const url = `${BACKEND_URL}?action=create_deposit&${params.toString()}`;
        const res = await fetch(url).then(r => r.json());

        console.log('=== DEPOSIT CREATE RESPONSE ===');
        console.log('Full response:', JSON.stringify(res, null, 2));
        console.log('res.data:', res.data);
        console.log('res.data.psbtKey:', res.data?.psbtKey);
        console.log('res.data.id:', res.data?.id);

        if (res.code !== 0) throw new Error(res.msg || 'Failed to create deposit');
        if (!res.data?.psbt) throw new Error('No PSBT returned from bridge');

        btn.innerText = 'SIGN IN WALLET...';

        // Подписываем PSBT с правильными параметрами
        const signOptions = {};

        // Если API вернул параметры подписи - используем их
        if (res.data.toSignInputs) {
            signOptions.toSignInputs = res.data.toSignInputs;
        }
        if (res.data.autoFinalized !== undefined) {
            signOptions.autoFinalized = res.data.autoFinalized;
        }

        console.log('Signing with options:', signOptions);

        const signedPsbt = await window.unisat.signPsbt(
            res.data.psbt,
            Object.keys(signOptions).length > 0 ? signOptions : undefined
        );

        btn.innerText = 'CONFIRMING...';

        // Confirm deposit - для нативного BTC отправляем только PSBT
        const confirmBody = {
            psbt: signedPsbt
        };

        // Для BRC-20 может потребоваться inscriptionId (но для FB это не нужно)

        console.log('=== DEPOSIT CONFIRM REQUEST ===');
        console.log('Confirm body:', JSON.stringify(confirmBody, null, 2));

        const conf = await fetch(`${BACKEND_URL}?action=confirm_deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(confirmBody)
        }).then(r => r.json());

        console.log('=== DEPOSIT CONFIRM RESPONSE ===');
        console.log('Full response:', JSON.stringify(conf, null, 2));

        // Если ошибка "No signatures" - пробуем через GET параметры
        if (conf.code !== 0 && conf.msg && conf.msg.includes('signature')) {
            console.warn('Signature error, trying GET method with params...');

            // Альтернативный метод: через URL параметры
            const confirmParams = new URLSearchParams({
                psbt: signedPsbt,
                address: userAddress,
                pubkey: userPubkey
            });

            console.log('Trying GET confirm...');

            const altConf = await fetch(`${BACKEND_URL}?action=confirm_deposit&${confirmParams.toString()}`, {
                method: 'GET',
                headers: {
                    'x-public-key': userPubkey,
                    'x-address': userAddress
                }
            }).then(r => r.json());

            console.log('GET confirm response:', JSON.stringify(altConf, null, 2));

            if (altConf.code === 0) {
                document.getElementById('successTxId').innerText =
                    altConf.data || altConf.txid || 'Deposit sent to bridge!';
                document.getElementById('successModal').classList.remove('hidden');
                setTimeout(checkBalance, 4000);
                return;
            } else {
                throw new Error(altConf.msg || 'Deposit confirmation failed');
            }
        }

        // Если основной метод успешен
        if (conf.code === 0) {
            document.getElementById('successTxId').innerText = conf.data || conf.txid || 'Deposit sent to bridge!';
            document.getElementById('successModal').classList.remove('hidden');
            setTimeout(checkBalance, 4000);
        } else if (!conf.msg || !conf.msg.includes('signature')) {
            // Если ошибка НЕ связана с подписью - выбрасываем
            throw new Error(conf.msg || 'Deposit confirmation failed');
        }
        // Если ошибка подписи - альтернативный метод выше уже обработал
    } catch (e) {
        console.error('Deposit error:', e);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        btn.innerText = 'DEPOSIT';
        btn.disabled = false;
    }
}
// LOAD FENNEC INSCRIPTIONS (InSwap style - cards with checkboxes)
async function loadFennecInscriptions(force = false) {
    if (!userAddress) return window.connectWallet();

    const cardsEl = document.getElementById('inscriptionCards');

    try {
        window.__fennecUiCache =
            window.__fennecUiCache && typeof window.__fennecUiCache === 'object'
                ? window.__fennecUiCache
                : { historyHtml: {}, inscriptionsHtml: {}, liquidityHtml: {} };
    } catch (_) {}

    try {
        const key = `insc:${String(userAddress || '').trim()}`;
        const cached = window.__fennecUiCache?.inscriptionsHtml?.[key];
        if (!force && cached) {
            cardsEl.innerHTML = String(cached);
        } else {
            cardsEl.innerHTML = '<div class="text-center py-4 text-gray-500 text-xs col-span-3">Loading...</div>';
        }
    } catch (_) {
        cardsEl.innerHTML = '<div class="text-center py-4 text-gray-500 text-xs col-span-3">Loading...</div>';
    }

    try {
        // Get FENNEC balance info
        const balanceRes = await fetch(
            `${BACKEND_URL}?action=balance&address=${userAddress}&tick=${T_FENNEC}&walletOnly=true`
        ).then(r => r.json());
        const available =
            balanceRes.data?.availableBalance ||
            balanceRes.data?.transferableBalance ||
            balanceRes.data?.balance?.availableBalance ||
            balanceRes.data?.balance?.transferableBalance ||
            0;
        const transferable = balanceRes.data?.transferableBalance || balanceRes.data?.balance?.transferableBalance || 0;

        document.getElementById('fennecAvailable').innerText = parseFloat(available).toFixed(2);
        document.getElementById('fennecTransferable').innerText = parseFloat(transferable).toFixed(2);

        // Get pending inscriptions from localStorage
        const pendingInscriptions = JSON.parse(localStorage.getItem('pending_inscriptions') || '[]');
        const readyInscriptions = pendingInscriptions.filter(p => p.status === 'ready' && p.inscriptionId);

        // Get blocked inscriptions (those already in deposit)
        const blockedInscriptions = JSON.parse(localStorage.getItem('pendingDepositInscriptions') || '[]');

        // Get transferable inscriptions from Worker proxy (uses UniSat API)
        let walletInscriptions = [];
        try {
            // Use Worker proxy which now uses UniSat API (no signature required)
            const transferableRes = await fetch(
                `${BACKEND_URL}?action=transferable_inscriptions&address=${userAddress}&tick=FENNEC&limit=512&start=0`
            );
            if (transferableRes.ok) {
                const transferableData = await transferableRes.json();

                // CRITICAL FIX: UniSat returns list in 'detail', InSwap in 'list'
                // We check all possible locations
                const rawList =
                    transferableData.data?.detail ||
                    transferableData.data?.list ||
                    transferableData.data?.inscriptions ||
                    (Array.isArray(transferableData.data) ? transferableData.data : []);

                if (Array.isArray(rawList) && rawList.length > 0) {
                    walletInscriptions = rawList.map(item => {
                        // Check all possible fields for amount
                        const amountValue =
                            item.amount ||
                            item.amt ||
                            item.amountValue ||
                            item.value ||
                            item.balance ||
                            (item.data && (item.data.amount || item.data.amt)) ||
                            0;

                        const parsedAmount = parseFloat(amountValue);

                        // Check all possible fields for inscription number
                        const inscriptionNum =
                            item.inscriptionNumber ||
                            item.number ||
                            item.inscriptionNum ||
                            item.num ||
                            (item.inscriptionId ? item.inscriptionId.split('i')[1] : null) ||
                            'N/A';

                        return {
                            inscriptionId: item.inscriptionId || item.id,
                            amount: parsedAmount,
                            inscriptionNumber: inscriptionNum,
                            // Check all possible "spent" flags
                            spent: item.spent === true || item.isSpent === true || item.status === 'spent'
                        };
                    });
                    console.log(`Loaded ${walletInscriptions.length} inscriptions from API`);
                }
            } else {
                console.error('Transferable inscriptions API failed:', transferableRes.status);
                // Fallback to UniSat API directly
                console.log('Falling back to UniSat API directly...');
                let cursor = 0;
                let hasMore = true;
                const limit = 100;

                // Оптимизация: ограничиваем количество запросов и добавляем таймаут
                const maxRequests = 5; // Максимум 5 запросов (500 инскрипций)
                let requestCount = 0;

                while (hasMore && walletInscriptions.length < 500 && requestCount < maxRequests) {
                    requestCount++;
                    const res = await window.unisat.getInscriptions(cursor, limit);
                    const filtered = res.list.filter(i => {
                        if (i.tick !== 'FENNEC') return false;
                        if (i.contentType !== 'text/plain') return false;
                        if (i.spent === true) return false;
                        return true;
                    });
                    walletInscriptions = walletInscriptions.concat(
                        filtered.map(i => ({
                            inscriptionId: i.inscriptionId,
                            amount: parseFloat(i.amount),
                            inscriptionNumber: i.inscriptionNumber || i.inscriptionId?.split('i')[1] || 'N/A',
                            spent: false
                        }))
                    );

                    if (res.list.length < limit || res.total <= cursor + limit) {
                        hasMore = false;
                    } else {
                        cursor += limit;
                    }

                    // Небольшая задержка между запросами для снижения нагрузки
                    if (hasMore && requestCount < maxRequests) {
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
                console.log(`Loaded ${walletInscriptions.length} FENNEC inscriptions from UniSat API (fallback)`);
            }

            // Also try deposit_balance API to get balance info (for display)
            try {
                const depositBalanceRes = await fetch(
                    `${BACKEND_URL}?action=deposit_balance&pubkey=${userPubkey}&address=${userAddress}&tick=FENNEC`
                );
                if (depositBalanceRes.ok) {
                    const depositBalanceData = await depositBalanceRes.json();
                    console.log('=== DEPOSIT BALANCE ===');
                    console.log(
                        'Transferable balance:',
                        depositBalanceData.data?.externalBalance?.brc20?.transferable || 0
                    );
                }
            } catch (e) {
                console.warn('deposit_balance API error (non-critical):', e);
            }
        } catch (e) {
            console.error('Failed to get wallet inscriptions:', e);
        }

        // Filter and Render
        // Filter out: Spent, Used, already selected locally, or blocked (in deposit)
        const validInscriptions = walletInscriptions.filter(item => {
            if (item.spent) return false;
            if (blockedInscriptions.includes(item.inscriptionId)) return false; // Blocked (already in deposit)
            if (selectedInscriptions.find(s => s.inscriptionId === item.inscriptionId)) return false; // Don't show if selected
            return true;
        });

        // Add already selected ones back to the top (from local state)
        const displayList = [...selectedInscriptions, ...validInscriptions];

        if (displayList.length === 0) {
            cardsEl.innerHTML =
                '<div class="text-center py-8 text-gray-500 text-xs col-span-3">No transfer inscriptions.<br><button onclick="createFennecInscription()" class="text-fennec hover:text-white mt-2">Create one</button></div>';

            try {
                const key = `insc:${String(userAddress || '').trim()}`;
                if (window.__fennecUiCache && window.__fennecUiCache.inscriptionsHtml) {
                    window.__fennecUiCache.inscriptionsHtml[key] = String(cardsEl.innerHTML || '');
                }
            } catch (_) {}
            return;
        }

        cardsEl.innerHTML = displayList
            .map(insc => {
                const isSelected = selectedInscriptions.find(s => s.inscriptionId === insc.inscriptionId);
                const isBlocked = blockedInscriptions.includes(insc.inscriptionId);
                return `
                                                                                                                            <div class="bg-black/40 border-2 ${isSelected ? 'border-fennec' : isBlocked ? 'border-red-500/50 opacity-50' : 'border-white/10'} rounded-lg p-3 ${isBlocked ? 'cursor-not-allowed' : 'cursor-pointer hover:border-fennec/50'} transition relative" ${isBlocked ? '' : `onclick="toggleInscription('${insc.inscriptionId}', ${insc.amount})"`}>
                                                                                                                                ${isBlocked ? '<div class="absolute top-2 right-2 bg-red-500/80 text-white text-[8px] px-1 rounded">IN USE</div>' : ''}
                                                                                                                                <div class="absolute top-2 right-2">
                                                                                                                                    <div class="w-5 h-5 rounded ${isSelected ? 'bg-fennec' : 'bg-white/10 border border-white/20'} flex items-center justify-center">
                                                                                                                                        ${isSelected ? '<i class="fas fa-check text-black text-xs"></i>' : ''}
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                                <div class="text-xs text-gray-400 mb-1">FENNEC</div>
                                                                                                                                <div class="text-2xl font-bold text-white mb-1">${insc.amount}</div>
                                                                                                                                <div class="text-[10px] text-fennec font-mono">#${insc.inscriptionNumber}</div>
                                                                                                                            </div>
                                                                                                                        `;
            })
            .join('');

        try {
            const key = `insc:${String(userAddress || '').trim()}`;
            if (window.__fennecUiCache && window.__fennecUiCache.inscriptionsHtml) {
                window.__fennecUiCache.inscriptionsHtml[key] = String(cardsEl.innerHTML || '');
            }
        } catch (_) {}
    } catch (e) {
        console.error('Error loading inscriptions:', e);
        cardsEl.innerHTML =
            '<div class="text-center py-4 text-red-500 text-xs col-span-3">Error loading inscriptions</div>';
    }
}

// SET MAX FENNEC AMOUNT FOR INSCRIPTION CREATION (use wallet balance, not transferable)
function setMaxFennecAmount() {
    // Use available balance from wallet (not transferable inscriptions)
    const available = parseFloat(document.getElementById('fennecAvailable').innerText) || 0;
    if (available > 0) {
        document.getElementById('depFennecAmount').value = available.toFixed(8);
    } else {
        // Fallback to transferable if available is 0
        const transferable = parseFloat(document.getElementById('fennecTransferable').innerText) || 0;
        if (transferable > 0) {
            document.getElementById('depFennecAmount').value = transferable.toFixed(8);
        } else {
            alert('No FENNEC available in wallet');
        }
    }
}

// TOGGLE INSCRIPTION SELECTION
function toggleInscription(inscriptionId, amount) {
    const index = selectedInscriptions.findIndex(s => s.inscriptionId === inscriptionId);
    if (index >= 0) {
        selectedInscriptions.splice(index, 1);
    } else {
        selectedInscriptions.push({ inscriptionId, amount });
    }
    updateSelectedAmount();
    // Optimize: Only update checkboxes without full reload
    updateInscriptionCheckboxes();
}

// Update checkboxes without full reload
function updateInscriptionCheckboxes() {
    const cardsEl = document.getElementById('inscriptionCards');
    if (!cardsEl) return;

    // Update only the checkbox states without reloading all data
    const cards = cardsEl.querySelectorAll('[onclick*="toggleInscription"]');
    cards.forEach(card => {
        const onclickAttr = card.getAttribute('onclick');
        const match = onclickAttr.match(/toggleInscription\('([^']+)',\s*([\d.]+)\)/);
        if (match) {
            const inscId = match[1];
            const isSelected = selectedInscriptions.find(s => s.inscriptionId === inscId);
            const checkbox = card.querySelector('.w-5.h-5.rounded');
            if (checkbox) {
                if (isSelected) {
                    checkbox.className = 'w-5 h-5 rounded bg-fennec flex items-center justify-center';
                    checkbox.innerHTML = '<i class="fas fa-check text-black text-xs"></i>';
                    card.className = card.className.replace('border-white/10', 'border-fennec');
                } else {
                    checkbox.className =
                        'w-5 h-5 rounded bg-white/10 border border-white/20 flex items-center justify-center';
                    checkbox.innerHTML = '';
                    card.className = card.className.replace('border-fennec', 'border-white/10');
                }
            }
        }
    });
}

// UPDATE SELECTED AMOUNT
function updateSelectedAmount() {
    const total = selectedInscriptions.reduce((sum, s) => sum + s.amount, 0);
    document.getElementById('selectedAmount').innerText = total.toFixed(2);
    document.getElementById('btnDepositSelected').disabled = selectedInscriptions.length === 0;
}

// DEPOSIT SELECTED INSCRIPTIONS
async function depositSelectedInscriptions() {
    if (selectedInscriptions.length === 0) return;
    if (selectedInscriptions.length > 1) {
        return alert('Please select only one inscription at a time');
    }

    const insc = selectedInscriptions[0];
    await executeDeposit(insc.inscriptionId);
    selectedInscriptions.length = 0;
    updateSelectedAmount();
}

// Keep old modal function for backward compatibility
async function openInscriptionModal() {
    // Redirect to deposit tab and load inscriptions
    switchTab('deposit');
    setDepositToken('FENNEC');
    setTimeout(loadFennecInscriptions, 300);
}
// CREATE FENNEC TRANSFER INSCRIPTION
async function createFennecInscription() {
    if (!userAddress) return window.connectWallet();

    // Try to get amount from input field (may not exist if UI changed)
    const amountInput =
        document.getElementById('depFennecAmount') || document.querySelector('#dep-brc20-ui input[type="number"]');
    if (!amountInput) {
        const amountStr = prompt('Enter FENNEC amount to create transfer inscription:');
        if (!amountStr) return;
        const amount = parseFloat(amountStr);
        if (!amount || amount <= 0) return alert('Enter valid amount');
        await createInscriptionWithAmount(amount);
        return;
    }

    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) return alert('Enter amount');
    await createInscriptionWithAmount(amount);
}

async function createInscriptionWithAmount(amount) {
    const btn = document.getElementById('btnCreateInscription');
    btn.innerText = 'CREATING...';
    btn.disabled = true;

    try {
        await checkFractalNetwork();
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        // Step 1: Create BRC-20 TRANSFER inscription
        btn.innerText = 'CREATING TRANSFER...';
        console.log('=== CREATING BRC-20 TRANSFER INSCRIPTION ===');
        console.log(`Amount: ${amount} FENNEC`);

        // Create transfer JSON
        const transferData = {
            p: 'brc-20',
            op: 'transfer',
            tick: 'FENNEC',
            amt: amount.toString()
        };

        const transferJson = JSON.stringify(transferData);
        const base64Content = btoa(transferJson);

        // Create inscription via Worker API
        const createRes = await fetch(`${BACKEND_URL}?action=create_inscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receiveAddress: userAddress,
                feeRate: 2,
                outputValue: 546,
                files: [
                    {
                        filename: 'transfer.json',
                        dataURL: `data:application/json;base64,${base64Content}`
                    }
                ]
            })
        }).then(r => r.json());

        console.log('Create inscription response:', createRes);

        if (createRes.code !== 0) {
            throw new Error(createRes.msg || 'Failed to create inscription');
        }

        const orderId = createRes.data?.orderId || createRes.data?.id;
        if (!orderId) {
            throw new Error('No orderId returned');
        }

        // Step 2: Auto-pay for inscription
        const payAddress = createRes.data?.payAddress;
        const payAmountSatoshis = createRes.data?.amount || 0;
        const paidAmountSatoshis = createRes.data?.paidAmount || 0;
        const payAmountFB = payAmountSatoshis / 100000000;

        if (payAddress && payAmountSatoshis > 0 && paidAmountSatoshis < payAmountSatoshis) {
            btn.innerText = `PAYING ${payAmountFB.toFixed(8)} FB...`;

            try {
                if (typeof window.unisat.sendBitcoin === 'function') {
                    const txid = await window.unisat.sendBitcoin(payAddress, payAmountSatoshis, {
                        feeRate: createRes.data?.feeRate || 2
                    });
                    console.log('Payment sent automatically, TXID:', txid);
                    await new Promise(r => setTimeout(r, 3000));
                } else {
                    alert(
                        `Please pay ${payAmountFB.toFixed(8)} FB to:\n${payAddress}\n\nAfter payment, the inscription will be created automatically.`
                    );
                }
            } catch (payError) {
                console.error('Payment error:', payError);
                alert(`Auto-payment failed. Please pay ${payAmountFB.toFixed(8)} FB to:\n${payAddress}`);
            }
        }

        // Step 3: Save inscription order to localStorage for tracking
        const pendingInscriptions = JSON.parse(localStorage.getItem('pending_inscriptions') || '[]');
        pendingInscriptions.push({
            orderId: orderId,
            amount: amount,
            tick: 'FENNEC',
            status: 'pending',
            createdAt: Date.now()
        });
        localStorage.setItem('pending_inscriptions', JSON.stringify(pendingInscriptions));

        // Step 4: Start tracking inscription status in background
        trackInscriptionStatus(orderId, amount);

        btn.innerText = 'CREATING...';
        showSuccess(`Inscription order created! It will appear in the list when ready. Order ID: ${orderId}`);
    } catch (e) {
        console.error('Inscription creation error:', e);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
        btn.innerText = 'CREATE TRANSFER INSCRIPTION';
        btn.disabled = false;
    }
}

// TRACK INSCRIPTION STATUS (background polling)
async function trackInscriptionStatus(orderId, amount) {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    const checkStatus = async () => {
        attempts++;

        try {
            const statusRes = await fetch(`${BACKEND_URL}?action=inscription_status&orderId=${orderId}`).then(r =>
                r.json()
            );

            if (statusRes.code === 0 && statusRes.data) {
                const status = statusRes.data.status;
                const files = statusRes.data.files || [];

                let inscriptionId = null;
                if (files.length > 0 && files[0].inscriptionId) {
                    inscriptionId = files[0].inscriptionId;
                } else {
                    inscriptionId =
                        statusRes.data.inscriptionId ||
                        statusRes.data.inscription?.inscriptionId ||
                        statusRes.data.inscriptionIdList?.[0];
                }

                // Update localStorage
                const pendingInscriptions = JSON.parse(localStorage.getItem('pending_inscriptions') || '[]');
                const index = pendingInscriptions.findIndex(p => p.orderId === orderId);

                if (inscriptionId && (status === 'minted' || (status === 'inscribing' && inscriptionId))) {
                    // Inscription is ready!
                    if (index >= 0) {
                        pendingInscriptions[index].status = 'ready';
                        pendingInscriptions[index].inscriptionId = inscriptionId;
                        pendingInscriptions[index].readyAt = Date.now();
                    }
                    localStorage.setItem('pending_inscriptions', JSON.stringify(pendingInscriptions));
                    console.log('Inscription ready:', inscriptionId);

                    // Refresh inscription modal if open
                    if (!document.getElementById('inscriptionModal').classList.contains('hidden')) {
                        openInscriptionModal();
                    }
                    return; // Stop polling
                } else if (status === 'closed' || status === 'refunded') {
                    // Failed
                    if (index >= 0) {
                        pendingInscriptions[index].status = 'failed';
                    }
                    localStorage.setItem('pending_inscriptions', JSON.stringify(pendingInscriptions));
                    return; // Stop polling
                } else {
                    // Still processing
                    if (index >= 0) {
                        pendingInscriptions[index].status = status;
                    }
                    localStorage.setItem('pending_inscriptions', JSON.stringify(pendingInscriptions));
                }
            }
        } catch (e) {
            console.error('Status check error:', e);
        }

        // Continue polling if not ready and not exceeded max attempts
        if (attempts < maxAttempts) {
            setTimeout(checkStatus, 5000); // Check every 5 seconds
        } else {
            console.log('Inscription tracking timeout');
        }
    };

    // Start checking
    setTimeout(checkStatus, 5000);
}

async function executeDeposit(inscriptionId) {
    const btn = document.getElementById('btnDepositSelected') || document.getElementById('btnDepositFennec');
    if (!btn) {
        console.error('Deposit button not found');
        return;
    }

    // Find the inscription data to get amount
    const insc = selectedInscriptions.find(i => i.inscriptionId === inscriptionId);
    const amount = insc ? insc.amount : 0;

    try {
        if (document.getElementById('inscriptionModal')) {
            document.getElementById('inscriptionModal').classList.add('hidden');
        }
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        // Deposit FENNEC inscription (BRC-20 transfer)
        btn.innerText = 'SIGNING...';
        btn.disabled = true;
        const params = new URLSearchParams({
            inscriptionId: inscriptionId,
            pubkey: userPubkey,
            address: userAddress
        });

        const url = `${BACKEND_URL}?action=create_deposit&${params.toString()}`;
        console.log('=== FENNEC DEPOSIT CREATE ===');
        console.log('URL:', url);

        const res = await fetch(url).then(r => r.json());
        console.log('Response:', JSON.stringify(res, null, 2));

        if (res.code !== 0) throw new Error(res.msg || 'Failed to create deposit');
        if (!res.data?.psbt) throw new Error('No PSBT returned');

        console.log('=== SIGNING FENNEC DEPOSIT PSBT ===');
        const signedPsbt = await window.unisat.signPsbt(res.data.psbt, { autoFinalized: false });
        console.log('PSBT signed');

        // Confirm для BRC-20: ТРЕБУЕТСЯ inscriptionId по документации
        btn.innerText = 'CONFIRMING...';
        const confirmBody = {
            psbt: signedPsbt,
            inscriptionId: inscriptionId
        };

        console.log('=== FENNEC DEPOSIT CONFIRM ===');
        console.log('Body:', JSON.stringify(confirmBody, null, 2));

        const conf = await fetch(`${BACKEND_URL}?action=confirm_deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(confirmBody)
        }).then(r => r.json());

        console.log('Confirm response:', JSON.stringify(conf, null, 2));

        if (conf.code === 0) {
            const txid = __pickTxid(conf?.data) || __pickTxid(conf) || conf.data || 'FENNEC deposited!';
            // Block inscription from being used again
            const pendingInscriptions = JSON.parse(localStorage.getItem('pendingDepositInscriptions') || '[]');
            if (!pendingInscriptions.includes(inscriptionId)) {
                pendingInscriptions.push(inscriptionId);
                localStorage.setItem('pendingDepositInscriptions', JSON.stringify(pendingInscriptions));
            }
            trackDepositProgress(txid, 'FENNEC');
            showSuccess(`FENNEC deposit successful! TXID: ${txid}`);
            try {
                if (typeof addPendingOperation === 'function') {
                    const amt = Number(amount || 0) || 0;
                    addPendingOperation({
                        type: 'deposit',
                        status: 'pending',
                        txid: __looksLikeTxid(txid) ? txid : '',
                        address: userAddress,
                        tick: 'FENNEC',
                        amount: amt,
                        chain: 'FRACTAL',
                        timestamp: Date.now()
                    });
                }
            } catch (_) {}
            selectedInscriptions.length = 0;
            updateSelectedAmount();
            loadFennecInscriptions(); // Refresh list
            setTimeout(checkBalance, 2000);
        } else throw new Error(conf.msg || 'Confirmation failed');
    } catch (e) {
        console.error('FENNEC deposit error:', e);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        if (btn) {
            btn.innerText = 'DEPOSIT';
            btn.disabled = false;
        }
    }
}

// WITHDRAW (FIXED: NetworkType + Smart Sign)
async function setWithdrawToken(tok) {
    withdrawToken = tok;
    document.getElementById('wd-sfb').className =
        `flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${tok === 'sFB' ? 'border-fennec text-fennec bg-fennec/10' : 'border-gray-700 text-gray-500 hover:text-white'}`;
    document.getElementById('wd-fennec').className =
        `flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${tok === 'FENNEC' ? 'border-fennec text-fennec bg-fennec/10' : 'border-gray-700 text-gray-500 hover:text-white'}`;
    document.getElementById('wdTickerLabel').innerText = tok === 'sFB' ? 'FB' : 'FENNEC';
    // Load fees when switching tokens
    await loadFees('withdraw');
    // Placeholder и min только для FB (min 1), для BRC-20 нет минимума
    if (tok === 'sFB') {
        document.getElementById('wdAmount').placeholder = '1.0';
        document.getElementById('wdAmount').min = '1';
    } else {
        document.getElementById('wdAmount').placeholder = '0.0';
        document.getElementById('wdAmount').min = '0';
    }
    updateWithdrawUI();
}
function updateWithdrawUI() {
    const bal = withdrawToken === 'sFB' ? userBalances.sFB : userBalances.FENNEC;
    const token = withdrawToken === 'sFB' ? 'FB' : 'FENNEC';
    const balEl = document.getElementById('wd-bal');
    const minText = withdrawToken === 'sFB' ? ` (Min: 1 ${token})` : '';
    if (balEl) balEl.innerText = `Available: ${bal.toFixed(4)}${minText}`;
}

function setMaxWithdrawAmount() {
    if (!userAddress) {
        window.connectWallet();
        return;
    }
    const bal = withdrawToken === 'sFB' ? userBalances.sFB : userBalances.FENNEC;
    const wdAmountEl = document.getElementById('wdAmount');
    if (wdAmountEl && bal > 0) {
        wdAmountEl.value = bal.toFixed(8);
    } else if (wdAmountEl) {
        wdAmountEl.value = '0';
    }
}

function setMaxDepositAmount() {
    if (!userAddress) {
        window.connectWallet();
        return;
    }
    const depAmountEl = document.getElementById('depAmount');
    if (!depAmountEl) return;

    let bal = 0;
    if (depositToken === 'BTC') {
        // BTC balance from wallet
        bal = walletBalances.BTC || 0;
    } else if (depositToken === 'sFB') {
        // FB balance from wallet
        bal = walletBalances.sFB || 0;
    }

    if (bal > 0) {
        depAmountEl.value = bal.toFixed(8);
    } else {
        depAmountEl.value = '0';
    }
}
async function doWithdraw() {
    if (!userAddress) return window.connectWallet();

    const amount = parseFloat(document.getElementById('wdAmount').value);
    // ИСПРАВЛЕНИЕ ОТ GEMINI: Определяем параметры правильно
    const isFennec = withdrawToken === 'FENNEC';
    const tick = isFennec ? T_FENNEC : T_SFB;
    const assetType = isFennec ? 'brc20' : 'btc';

    // Проверки минимума
    if (!isFennec && (!amount || amount < 1)) return alert('Enter amount (min 1 FB)');
    if (isFennec && (!amount || amount <= 0)) return alert('Enter amount');

    const btn = document.getElementById('btnWithdraw');
    btn.innerText = 'INITIALIZING...';
    btn.disabled = true;

    try {
        await checkFractalNetwork();
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        const ts = Math.floor(Date.now() / 1000);

        // ИСПРАВЛЕНИЕ ОТ GEMINI: API PARAMS (FIXED)
        const params = new URLSearchParams({
            address: userAddress,
            pubkey: userPubkey,
            tick: tick,
            amount: amount.toString(),
            ts: ts.toString(),
            feeTick: T_SFB, // Комиссия всегда в FB
            payType: 'tick',
            assetType: assetType, // "brc20" или "btc"
            networkType: 'FRACTAL_BITCOIN_MAINNET',
            feeRate: withdrawFeeRate.toString()
        });

        const url = `${BACKEND_URL}?action=create_withdraw&${params.toString()}`;
        console.log('=== CREATE WITHDRAW ===');
        console.log('URL:', url);

        const res = await fetch(url, {
            headers: {
                'x-public-key': userPubkey,
                'x-address': userAddress
            }
        }).then(r => r.json());

        console.log('Response:', JSON.stringify(res, null, 2));

        if (res.code === -2 && res.msg && res.msg.includes('commit in progress')) {
            throw new Error('InSwap is processing another transaction. Please wait 10-30 seconds and try again.');
        }

        if (res.code !== 0) throw new Error(res.msg || 'Failed to create withdraw');
        if (!res.data) throw new Error('No data returned');

        const { paymentPsbt, approvePsbt, approvePsbtSignIndexes, id, signMsgs, feeAmount, feeTickPrice } = res.data;

        console.log('=== WITHDRAW DATA ===');
        console.log('id:', id);
        console.log('Has signMsgs:', signMsgs ? signMsgs.length : 0);
        console.log('Has paymentPsbt:', !!paymentPsbt);
        console.log('Has approvePsbt:', !!approvePsbt);
        console.log('approvePsbtSignIndexes:', approvePsbtSignIndexes);

        // For FB (btc): PSBTs can be null - only signMsgs needed
        // For FENNEC (brc20): PSBTs are required
        if (assetType === 'brc20' && !paymentPsbt && !approvePsbt) {
            throw new Error('No PSBTs returned for BRC-20 withdrawal');
        }

        let signedPayment = '',
            signedApprove = '';
        const signatures = [];

        // 2. Sign messages (if any)
        if (signMsgs && Array.isArray(signMsgs) && signMsgs.length > 0) {
            console.log(`=== SIGNING ${signMsgs.length} MESSAGES ===`);
            for (let i = 0; i < signMsgs.length; i++) {
                btn.innerText = `SIGN MESSAGE (${i + 1}/${signMsgs.length})...`;
                let msgToSign = signMsgs[i];
                if (typeof msgToSign === 'object') msgToSign = msgToSign.text || msgToSign.id;
                await new Promise(r => setTimeout(r, 300));
                const sig = await window.unisat.signMessage(msgToSign, 'bip322-simple');
                signatures.push(sig);
                console.log(`Message ${i + 1} signed`);
            }
        }

        // --- GEMINI'S BYPASS: BROADCAST FIRST! ---
        if (assetType === 'brc20') {
            console.log('=== FENNEC BYPASS: BROADCAST-FIRST METHOD ===');

            // 3. Sign PAYMENT PSBT (NO BROADCAST - let server handle it)
            if (paymentPsbt) {
                btn.innerText = 'SIGN FEE TX (1/2)...';
                await new Promise(r => setTimeout(r, 500));

                // Sign without finalizing (let server finalize)
                signedPayment = await window.unisat.signPsbt(paymentPsbt, { autoFinalized: false });
                console.log('Payment PSBT signed (not finalized - server will handle)');
            }

            // 4. Sign APPROVE PSBT - EXACTLY LIKE DEPOSIT (no params!)
            if (approvePsbt) {
                if (approvePsbt === paymentPsbt) {
                    signedApprove = signedPayment;
                } else {
                    btn.innerText = 'SIGNING (2/2)...';
                    console.log('SIGNING APPROVE PSBT (EXACTLY LIKE DEPOSIT - NO PARAMS)...');

                    // Domain is whitelisted - sign with autoFinalized: false (like paymentPsbt)
                    signedApprove = await window.unisat.signPsbt(approvePsbt, { autoFinalized: false });
                    console.log('APPROVE PSBT SIGNED! (Domain whitelisted, autoFinalized: false)');
                }
            }
        } else {
            // For FB: Just sign normally (no bypass needed)
            console.log('=== FB WITHDRAWAL (NORMAL METHOD) ===');
            // This path shouldn't execute PSBTs for FB, only messages
        }

        // 5. Confirm withdrawal
        btn.innerText = 'FINALIZING...';

        const confirmBody = {
            id,
            address: userAddress,
            amount: amount.toString(),
            assetType: assetType,
            feeAmount: feeAmount,
            feeTick: T_SFB,
            feeTickPrice: feeTickPrice,
            networkType: 'FRACTAL_BITCOIN_MAINNET',
            payType: 'tick',
            pubkey: userPubkey,
            rememberPayType: false,
            tick: tick,
            ts: ts
        };

        if (signatures.length > 0) {
            confirmBody.sigs = signatures;
            if (assetType === 'btc') {
                confirmBody.paymentPsbt = 'test';
                confirmBody.approvePsbt = 'test';
            } else {
                if (!signedPayment || !signedApprove) {
                    throw new Error('Missing signed PSBTs for BRC-20 withdrawal');
                }
                confirmBody.paymentPsbt = signedPayment;
                confirmBody.approvePsbt = signedApprove;
            }
        }

        console.log('=== CONFIRM WITHDRAW ===');
        console.log('Body:', JSON.stringify(confirmBody, null, 2));

        const sub = await fetch(`${BACKEND_URL}?action=confirm_withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-public-key': userPubkey,
                'x-address': userAddress
            },
            body: JSON.stringify(confirmBody)
        }).then(r => r.json());

        console.log('=== CONFIRM RESPONSE ===');
        console.log('Response:', JSON.stringify(sub, null, 2));

        if (sub.code === 0) {
            // Get the correct txid from response
            // Withdraw creates 2 transactions: payment (fee) and approve (withdrawal)
            // The actual withdrawal transaction is the RECEIVE txid (not payment funcId)
            console.log('=== FULL WITHDRAW CONFIRM RESPONSE ===');
            console.log('sub.data:', JSON.stringify(sub.data, null, 2));

            // Try all possible field names for receive txid
            let txid =
                sub.data?.approveTxid ||
                sub.data?.approveTxId ||
                sub.data?.approve_txid ||
                sub.data?.approveTxHash ||
                sub.data?.rollUpTxid ||
                sub.data?.rollUpTxId ||
                sub.data?.rollUp_txid ||
                sub.data?.paymentTxid ||
                sub.data?.paymentTxId ||
                sub.data?.inscribeTxid ||
                sub.data?.inscribeTxId ||
                sub.data?.receiveTxid ||
                sub.data?.receiveTxId ||
                sub.data?.receive_txid ||
                sub.data?.receiveTxHash ||
                sub.data?.txid ||
                sub.data?.hash ||
                sub.txid ||
                (typeof sub.data === 'string' ? sub.data : '') ||
                '';
            console.log('Withdraw txid from confirm response:', txid);

            // If no txid in confirm response, try to get from withdraw_history
            if (!txid || txid === '') {
                console.log('No txid in confirm response, checking withdraw_history...');
                try {
                    const historyRes = await fetch(
                        `${BACKEND_URL}?action=withdraw_history&address=${userAddress}&start=0&limit=10`
                    ).then(r => r.json());
                    console.log('Withdraw history response:', historyRes);
                    if (historyRes.code === 0 && historyRes.data?.list && historyRes.data.list.length > 0) {
                        // Find the most recent withdraw that matches our amount/tick
                        const matchingWithdraw =
                            historyRes.data.list.find(w => {
                                const wAmount = parseFloat(w.amount || 0);
                                const wTick = w.tick || '';
                                return (
                                    Math.abs(wAmount - parseFloat(amount)) < 0.0001 &&
                                    (wTick === tick || wTick.includes(tick) || tick.includes(wTick))
                                );
                            }) || historyRes.data.list[0];

                        console.log('Matching withdraw from history:', matchingWithdraw);
                        console.log('All fields in withdraw object:', Object.keys(matchingWithdraw));

                        // Try all possible fields for receive txid in history
                        txid =
                            matchingWithdraw.receiveTxid ||
                            matchingWithdraw.receiveTxId ||
                            matchingWithdraw.receive_txid ||
                            matchingWithdraw.receiveTxHash ||
                            matchingWithdraw.receiveHash ||
                            matchingWithdraw.receiveTx ||
                            matchingWithdraw.txid ||
                            matchingWithdraw.hash ||
                            matchingWithdraw.id ||
                            '';
                        console.log('History txid found:', txid);
                    }
                } catch (e) {
                    console.warn('Failed to get txid from history:', e);
                }
            }

            // Progress polling must use withdraw order id (withdraw_process expects id).
            trackWithdrawProgress(id, tick);
            showSuccess(txid && txid !== '' ? `Withdrawal initiated! TXID: ${txid}` : 'Withdrawal initiated!');
            try {
                if (typeof addPendingOperation === 'function') {
                    addPendingOperation({
                        type: 'withdraw',
                        status: 'pending',
                        id: id,
                        txid: __looksLikeTxid(txid) ? txid : '',
                        address: userAddress,
                        tick: tick,
                        amount: amount,
                        chain: 'FRACTAL',
                        timestamp: Date.now()
                    });
                }
            } catch (_) {}
        } else {
            throw new Error(sub.msg || 'Withdrawal confirmation failed');
        }
    } catch (e) {
        console.error('Withdraw error:', e);
        let msg = e.message || String(e);
        if (msg.includes('User rejected')) {
            msg =
                'Signature Rejected!\n\nNote: If you signed the first transaction (fee), it was already broadcasted.\nYou may need to complete the withdrawal manually or wait for a refund.';
        }
        document.getElementById('errorMsg').innerText = msg;
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        btn.innerText = 'WITHDRAW';
        btn.disabled = false;
    }
}

// ===== PRICE CHART =====
// chartTimeframe and priceChart already defined above

function __legacy_seedChartPriceFromCache() {
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

function __legacy_initChart() {
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

    priceChart = new window.Chart(ctx, {
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

    console.log('Chart initialized');

    // Load data and update chart
    loadHistoricalPrices().then(() => {
        updatePriceData();
    });
}

async function __legacy_loadHistoricalPrices() {
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
                    const timestamp = (item.ts || 0) * 1000; // Convert seconds to milliseconds

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
                const now = Date.now();

                // For all timeframes, merge existing data with new API data
                // Don't remove existing data - it might be needed for current timeframe
                // Just merge and deduplicate
                const merged = [...existing, ...apiData].sort((a, b) => a.timestamp - b.timestamp);

                // Remove duplicates by timestamp (within 5 minutes for better deduplication)
                // Also limit points to reasonable number for each timeframe
                const deduplicated = [];
                merged.forEach(p => {
                    const exists = deduplicated.find(d => Math.abs(d.timestamp - p.timestamp) < 300000); // 5 minutes
                    if (!exists) deduplicated.push(p);
                });

                // For 90d/all timeframe, limit to max 200 points to avoid overcrowding
                // For shorter timeframes, use fewer points
                let maxPoints = 200;
                if (chartTimeframe === '1h')
                    maxPoints = 360; // До 360 точек для детального графика
                else if (chartTimeframe === '24h')
                    maxPoints = 96; // 1 point per 15 minutes max
                else if (chartTimeframe === '7d')
                    maxPoints = 168; // 1 point per hour max
                else if (chartTimeframe === '30d') maxPoints = 180; // 1 point per 4 hours max

                // If we have too many points, sample them evenly
                if (deduplicated.length > maxPoints) {
                    const step = Math.ceil(deduplicated.length / maxPoints);
                    const sampled = [];
                    for (let i = 0; i < deduplicated.length; i += step) {
                        sampled.push(deduplicated[i]);
                    }
                    // Always include the last point
                    if (sampled[sampled.length - 1] !== deduplicated[deduplicated.length - 1]) {
                        sampled.push(deduplicated[deduplicated.length - 1]);
                    }
                    deduplicated.length = 0;
                    deduplicated.push(...sampled);
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

async function __legacy_updatePriceData(force = false) {
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
                    if (stored.length > 500) stored.shift();
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

function __legacy_updateChart() {
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
    else if (chartTimeframe === 'all')
        cutoff = now - 90 * 24 * 60 * 60 * 1000; // 90 days max (InSwap limit)
    else cutoff = 0;

    const filtered = stored.filter(p => p.timestamp > cutoff);

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
    let maxPoints = 200;
    if (chartTimeframe === '1h') {
        dedupInterval = 10000; // 10 секунд для более детального графика
        maxPoints = 360; // До 360 точек (1 точка каждые 10 секунд)
    } else if (chartTimeframe === '24h') {
        dedupInterval = 15 * 60000; // 15 минут
        maxPoints = 96;
    } else if (chartTimeframe === '7d') {
        dedupInterval = 60 * 60000; // 1 час
        maxPoints = 168;
    } else if (chartTimeframe === '30d') {
        dedupInterval = 4 * 60 * 60000; // 4 часа
        maxPoints = 180;
    } else if (chartTimeframe === 'all') {
        dedupInterval = 12 * 60 * 60000; // 12 часов
        maxPoints = 200;
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
async function updateMarketStats(fennecPriceInFB) {
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

        const formatUsdFixed = (n, digits) => {
            const v = Number(n);
            if (!Number.isFinite(v) || v <= 0) return '--';
            return `$${v.toLocaleString('en-US', {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits
            })}`;
        };

        const formatUsdInt = n => {
            const v = Number(n);
            if (!Number.isFinite(v) || v <= 0) return '--';
            return `$${Math.round(v).toLocaleString('en-US')}`;
        };

        const formatUsdExactRaw = raw => {
            const s = raw === null || raw === undefined ? '' : String(raw).trim();
            if (!s) return '--';
            const cleaned = s.replace(/^\$/, '').trim();
            return cleaned ? `$${cleaned}` : '--';
        };

        let poolData = poolCache && poolCache.data ? poolCache.data : null;
        if (!poolData) {
            await (typeof fetchReserves === 'function' ? fetchReserves() : Promise.resolve());
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

function __legacy_setChartTimeframe(tf) {
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

function updateChartTimeframe(tf, event) {
    chartTimeframe = tf;
    // Reload historical data for new timeframe
    loadHistoricalPrices();
    // Update button states
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
}

// showSection is already defined at the top of script, no need to redefine

// Live ticker update with prices and fees
// GLOBAL VARIABLES FOR PRICES
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

function __getTickerBaseTs() {
    try {
        const k = 'fennec_ticker_base_ts';
        const v = Number(sessionStorage.getItem(k) || 0) || 0;
        if (v > 0) return v;
        const now = Date.now();
        sessionStorage.setItem(k, String(now));
        return now;
    } catch (_) {
        return Date.now();
    }
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

// UPDATED TICKER FUNCTION - Использует CoinMarketCap через worker
async function __legacy_updateLiveTicker() {
    return await __fennecDedupe('updateLiveTicker', async () => {
        try {
            const tickerEl = document.getElementById('liveTicker');
            if (!tickerEl) return;

            const tickerContent = tickerEl.querySelector('#ticker-content') || tickerEl;

            // Seed instantly from cache so it never stays blank on slow API
            seedChartPriceFromCache();
            __seedDashboardPricesFromCache();

            const dash = await fetch(`${BACKEND_URL}?action=get_dashboard_data`, {
                cache: 'force-cache'
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
function __legacy_startPublicTickerUpdates() {
    // ИСПРАВЛЕНИЕ: Проверяем guard переменную из module implementation
    if (window.__fennecTickerSetup || __publicTickerInterval) return;
    __publicTickerInterval = setInterval(() => {
        try {
            updateLiveTicker();
        } catch (_) {}
    }, 600000);
}

function __legacy_stopPublicTickerUpdates() {
    if (__publicTickerInterval) {
        clearInterval(__publicTickerInterval);
        __publicTickerInterval = null;
    }
}

// Chart functions are now imported as modules

let __fennecSmartPollInterval = null;
let __fennecLastTipHeight = 0;

async function __fennecGetTipHeight() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        try {
            controller.abort();
        } catch (_) {}
    }, 6000);
    try {
        const res = await fetch('https://mempool.fractalbitcoin.io/api/blocks/tip/height', {
            signal: controller.signal,
            cache: 'no-store'
        });
        if (!res.ok) return 0;
        const text = await res.text().catch(() => '');
        const n = Number(String(text || '').trim() || 0) || 0;
        return Number.isFinite(n) && n > 0 ? n : 0;
    } catch (_) {
        return 0;
    } finally {
        try {
            clearTimeout(timeoutId);
        } catch (_) {}
    }
}

async function __fennecSmartPollOnce() {
    try {
        if (document.hidden) return;
        if (!userAddress) return;
        const h = await __fennecGetTipHeight();
        if (!(h > 0)) return;
        const prev = Number(__fennecLastTipHeight || 0) || 0;
        __fennecLastTipHeight = h;
        if (prev > 0 && h !== prev) {
            try {
                await Promise.all([
                    typeof checkBalance === 'function' ? checkBalance(true) : Promise.resolve(),
                    typeof refreshTransactionHistory === 'function'
                        ? refreshTransactionHistory(true)
                        : Promise.resolve(),
                    typeof fetchReserves === 'function' ? fetchReserves() : Promise.resolve(),
                    typeof updatePriceData === 'function' ? updatePriceData(false) : Promise.resolve()
                ]);
            } catch (_) {}
        }
    } catch (_) {}
}

function __fennecStartSmartPolling() {
    if (__fennecSmartPollInterval) return;
    __fennecSmartPollInterval = setInterval(() => {
        try {
            __fennecSmartPollOnce();
        } catch (_) {}
    }, 25000);
    try {
        __fennecSmartPollOnce();
    } catch (_) {}
}

function __fennecStopSmartPolling() {
    if (__fennecSmartPollInterval) {
        clearInterval(__fennecSmartPollInterval);
        __fennecSmartPollInterval = null;
    }
}

// Polling functions are now imported as modules

// ===== PROGRESS TRACKING =====
let progressInterval = null;

function closeProgress() {
    document.getElementById('progressModal').classList.add('hidden');
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

async function trackWithdrawProgress(withdrawId, tick) {
    document.getElementById('progressModal').classList.remove('hidden');
    document.getElementById('progressTitle').innerText = `Withdrawing ${tick}`;
    document.getElementById('progressTxId').innerText = withdrawId;
    document.getElementById('progressStep').innerText = 'Initializing...';
    document.getElementById('progressPercent').innerText = '0%';
    document.getElementById('progressBar').style.width = '0%';

    let attempts = 0;
    const maxAttempts = 60; // 5 минут (каждые 5 сек)

    progressInterval = setInterval(async () => {
        attempts++;

        try {
            const res = await fetch(`${BACKEND_URL}?action=withdraw_process&id=${withdrawId}`);
            const json = await res.json();

            if (json.code === 0 && json.data) {
                const data = json.data;
                const total = data.totalNum || 1;
                const confirmed = data.totalConfirmedNum || 0;
                const percent = Math.min(Math.round((confirmed / total) * 100), 100);

                document.getElementById('progressPercent').innerText = `${percent}%`;
                document.getElementById('progressBar').style.width = `${percent}%`;

                // Статусы
                if (data.status === 'completed') {
                    document.getElementById('progressStep').innerText = 'Completed!';
                    document.getElementById('progressTitle').innerText = 'Withdrawal Complete!';
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        closeProgress();
                        checkBalance();
                    }, 3000);
                } else if (data.status === 'pendingOrder') {
                    document.getElementById('progressStep').innerText =
                        `Processing... (${confirmed}/${total} confirmed)`;
                } else if (data.status === 'cancelled') {
                    document.getElementById('progressStep').innerText = 'Cancelled';
                    clearInterval(progressInterval);
                } else {
                    document.getElementById('progressStep').innerText = `Status: ${data.status}`;
                }

                console.log(`Withdraw progress: ${confirmed}/${total} (${percent}%) - ${data.status}`);
            }
        } catch (e) {
            console.error('Progress tracking error:', e);
        }

        // Таймаут после 5 минут
        if (attempts >= maxAttempts) {
            document.getElementById('progressStep').innerText = 'Timeout - check InSwap manually';
            clearInterval(progressInterval);
        }
    }, 5000); // Проверяем каждые 5 секунд
}

async function trackDepositProgress(depositId, tick) {
    document.getElementById('progressModal').classList.remove('hidden');
    document.getElementById('progressTitle').innerText = `Depositing ${tick}`;
    document.getElementById('progressTxId').innerText = depositId;
    document.getElementById('progressStep').innerText = 'Waiting for confirmations...';
    document.getElementById('progressPercent').innerText = '0%';
    document.getElementById('progressBar').style.width = '0%';

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes

    progressInterval = setInterval(async () => {
        attempts++;

        try {
            // Use deposit_process API to get confirmation status
            const res = await fetch(`${BACKEND_URL}?action=deposit_process&id=${depositId}`);
            const json = await res.json();

            if (json.code === 0 && json.data) {
                const data = json.data;
                const total = data.totalNum || 1;
                const confirmed = data.totalConfirmedNum || 0;
                const percent = Math.min(Math.round((confirmed / total) * 100), 100);

                document.getElementById('progressPercent').innerText = `${percent}%`;
                document.getElementById('progressBar').style.width = `${percent}%`;

                // Status updates
                if (data.status === 'completed') {
                    document.getElementById('progressStep').innerText = 'Completed!';
                    document.getElementById('progressTitle').innerText = 'Deposit Complete!';
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        closeProgress();
                        checkBalance();
                        refreshTransactionHistory();
                    }, 3000);
                } else if (data.status === 'pendingOrder' || data.status === 'pending') {
                    document.getElementById('progressStep').innerText =
                        `Processing... (${confirmed}/${total} confirmations)`;
                } else if (data.status === 'cancelled') {
                    document.getElementById('progressStep').innerText = 'Cancelled';
                    clearInterval(progressInterval);
                } else {
                    document.getElementById('progressStep').innerText =
                        `Status: ${data.status} (${confirmed}/${total})`;
                }

                console.log(`Deposit progress: ${confirmed}/${total} (${percent}%) - ${data.status}`);
            } else {
                // Fallback: check balance if API doesn't return status
                await checkBalance();
                const expectedAmount = parseFloat(document.getElementById('depAmount')?.value || 0);
                const currentBalance =
                    depositToken === 'sFB'
                        ? userBalances.sFB
                        : depositToken === 'FENNEC'
                          ? userBalances.FENNEC
                          : userBalances.BTC;

                if (expectedAmount > 0 && currentBalance > expectedAmount * 0.9) {
                    document.getElementById('progressStep').innerText = 'Deposit received!';
                    document.getElementById('progressPercent').innerText = '100%';
                    document.getElementById('progressBar').style.width = '100%';
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        closeProgress();
                        refreshTransactionHistory();
                    }, 3000);
                }
            }
        } catch (e) {
            console.error('Deposit tracking error:', e);
        }

        if (attempts >= maxAttempts) {
            document.getElementById('progressStep').innerText = 'Timeout - check InSwap manually';
            clearInterval(progressInterval);
        }
    }, 5000); // Check every 5 seconds
}

// --- REAL HISTORY (FIP-101) ---
async function fetchHistory() {
    if (!userAddress) return;
    const listEl = document.getElementById('txList');
    if (!listEl) return; // Если элемента нет в верстке

    try {
        // Определяем, какую историю грузить
        const isNative = (activeTickers.tick0 && activeTickers.tick0.includes('FB')) || true; // Пока грузим общую или по тикеру

        // 1. Грузим историю FENNEC
        let resFennec = { code: -1 };
        try {
            const fennecRes = await fetch(`${BACKEND_URL}?action=history&address=${userAddress}&tick=${T_FENNEC}`);
            if (fennecRes.ok) {
                resFennec = await fennecRes.json();
            }
        } catch (e) {
            console.warn('Failed to fetch FENNEC history:', e);
        }

        // 2. Грузим историю FB (Native)
        let resFB = { code: -1 };
        try {
            const api =
                (window.__fennecApi && typeof window.__fennecApi === 'object' ? window.__fennecApi : null) ||
                (await (window.__fennecApiModulePromise || (window.__fennecApiModulePromise = import('/js/api.js'))));
            const txsNative = api && typeof api.getHistory === 'function' ? await api.getHistory(userAddress) : [];
            resFB = { code: 0, data: { detail: Array.isArray(txsNative) ? txsNative : [] } };
        } catch (e) {
            console.warn('Failed to fetch FB history:', e);
        }

        let txs = [];

        // Парсим FENNEC (BRC-20)
        if (resFennec.code === 0 && resFennec.data && resFennec.data.detail) {
            txs = txs.concat(
                resFennec.data.detail.map(item => ({
                    type: item.type === 'transfer' ? 'Send' : 'Receive',
                    amount: item.amount,
                    tick: 'FENNEC',
                    time: item.blocktime,
                    txid: item.txid
                }))
            );
        }

        // Парсим FB (Native)
        if (resFB.code === 0 && resFB.data && resFB.data.detail) {
            const addr = String(userAddress || '').trim();
            const arr = Array.isArray(resFB.data.detail) ? resFB.data.detail : [];
            txs = txs.concat(
                arr
                    .map(tx => {
                        try {
                            const status = tx && tx.status && typeof tx.status === 'object' ? tx.status : null;
                            const ts = Number(status?.block_time || 0) || 0;
                            const vin = Array.isArray(tx?.vin) ? tx.vin : [];
                            const vout = Array.isArray(tx?.vout) ? tx.vout : [];
                            let inSum = 0;
                            let outSum = 0;
                            for (const v of vin) {
                                const p = v?.prevout;
                                const a = String(p?.scriptpubkey_address || '').trim();
                                if (a && a === addr) {
                                    inSum += Number(p?.value || 0) || 0;
                                }
                            }
                            for (const o of vout) {
                                const a = String(o?.scriptpubkey_address || '').trim();
                                if (a && a === addr) {
                                    outSum += Number(o?.value || 0) || 0;
                                }
                            }
                            const net = outSum - inSum;
                            const typ = net > 0 ? 'Receive' : net < 0 ? 'Send' : 'Tx';
                            const amount = (Math.abs(net) / 1e8).toFixed(4);
                            return {
                                type: typ,
                                amount,
                                tick: 'FB',
                                time: ts,
                                txid: String(tx?.txid || '').trim()
                            };
                        } catch (_) {
                            return null;
                        }
                    })
                    .filter(Boolean)
            );
        }

        // Сортируем по времени (новые сверху) и берем топ 5
        txs.sort((a, b) => b.time - a.time);
        txs = txs.slice(0, 5);

        // Рендерим
        if (txs.length === 0) {
            listEl.innerHTML = '<div class="text-center py-2 opacity-50">No recent transactions</div>';
        } else {
            const isLikelyHash = value => {
                const v = (value || '').toString();
                return v.length >= 32 && v.length <= 128 && /^[a-fA-F0-9]+$/.test(v);
            };
            listEl.innerHTML = txs
                .map(tx => {
                    const date = new Date(tx.time * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    const isFennec = tx.tick === 'FENNEC';
                    const colorClass = isFennec ? 'text-fennec' : 'text-white';

                    const rawTick = (tx.tick || '').toString().toUpperCase();
                    const isBtc = rawTick.includes('BTC');
                    const txid = String(tx.txid || '').trim();
                    const safeTxid = isLikelyHash(txid) ? txid : '';
                    const txExplorerUrl = safeTxid
                        ? isBtc
                            ? `https://mempool.space/tx/${safeTxid}`
                            : `https://uniscan.cc/fractal/tx/${safeTxid}`
                        : '';
                    const viewLink = txExplorerUrl
                        ? `<a href="${txExplorerUrl}" target="_blank" rel="noopener noreferrer" class="text-[9px] text-gray-600 hover:text-white underline decoration-dotted">View</a>`
                        : '';

                    return `
                                                                                                                            <div class="flex justify-between items-center py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition px-2 rounded">
                                                                                                                                <div class="flex items-center gap-3">
                                                                                                                                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs">
                                                                                                                                        ${tx.tick === 'FENNEC' ? '<img src="img/phav.png" class="w-4 h-4 inline-block object-contain">' : '<span class="text-[10px] font-mono text-gray-300">FB</span>'}
                                                                                                                                    </div>
                                                                                                                                    <div>
                                                                                                                                        <div class="text-xs font-bold text-gray-300">${__escapeHtml(tx.type)}</div>
                                                                                                                                        <div class="text-[10px] text-gray-600 font-mono">${__escapeHtml(date)}</div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                                <div class="text-right">
                                                                                                                                    <div class="text-xs font-bold ${colorClass}">${__escapeHtml(tx.amount)} ${__escapeHtml(tx.tick)}</div>
                                                                                                                                    ${viewLink}
                                                                                                                                </div>
                                                                                                                            </div>
                                                                                                                            `;
                })
                .join('');
        }
    } catch (e) {
        console.error('History error', e);
        const listEl = document.getElementById('txList');
        if (listEl) {
            listEl.innerHTML = '<div class="text-center py-2 opacity-50 text-red-500">Error loading history</div>';
        }
    }
}

// ===== TRANSACTION HISTORY (FIXED) =====
async function refreshTransactionHistory(force = false) {
    const __tabKey = String(document.querySelector('.tab-btn.active')?.id?.replace('tab-', '') || 'swap');
    const __addrKey = String(userAddress || '').trim() || 'public';
    const __vKey =
        __tabKey === 'swap'
            ? String(currentSwapPair || '').trim()
            : __tabKey === 'deposit'
              ? String(depositToken || '').trim()
              : __tabKey === 'withdraw'
                ? String(withdrawToken || '').trim()
                : '';
    return await __fennecDedupe(`refreshTxHistory:${__addrKey}:${__tabKey}:${__vKey}:${force ? 1 : 0}`, async () => {
        const __historyDebug =
            (typeof window !== 'undefined' &&
                (window.__fennecHistoryDebug === true || window.__debugHistory === true)) ||
            (typeof localStorage !== 'undefined' && localStorage.getItem('fennec_debug_history') === '1') ||
            (typeof location !== 'undefined' && /[?&]debug_history=1/.test(location.search));

        const currentTab = document.querySelector('.tab-btn.active')?.id?.replace('tab-', '') || 'swap';

        // Find the correct history element based on current tab
        let historyEl;
        if (currentTab === 'swap') {
            historyEl = document.getElementById('swapHistory') || document.getElementById('transactionHistory');
        } else if (currentTab === 'deposit') {
            historyEl = document.getElementById('depositHistory') || document.getElementById('transactionHistory');
        } else if (currentTab === 'withdraw') {
            historyEl = document.getElementById('withdrawHistory') || document.getElementById('transactionHistory');
        } else {
            historyEl = document.getElementById('transactionHistory');
        }

        if (!historyEl) {
            // For pending tab, it's normal - it has its own content
            if (currentTab === 'pending') return;
            if (__historyDebug) console.warn('History element not found for tab:', currentTab);
            return;
        }

        try {
            window.__fennecUiCache =
                window.__fennecUiCache && typeof window.__fennecUiCache === 'object'
                    ? window.__fennecUiCache
                    : { historyHtml: {}, inscriptionsHtml: {}, liquidityHtml: {} };
            const v =
                currentTab === 'swap'
                    ? String(currentSwapPair || '').trim()
                    : currentTab === 'deposit'
                      ? String(depositToken || '').trim()
                      : '';
            const key = `hist:${String(currentTab || '').trim()}:${v}`;
            const cached = window.__fennecUiCache?.historyHtml?.[key];
            if (!force && cached && (!historyEl.innerHTML || historyEl.innerHTML.length < 32)) {
                historyEl.innerHTML = String(cached);
            }
        } catch (_) {}

        // For swap history, load immediately without wallet
        if (!userAddress && currentTab !== 'swap') {
            historyEl.innerHTML =
                '<div class="text-center py-4 text-gray-500 text-xs">Connect wallet to view history</div>';
            return;
        }

        // Load swap history immediately even without wallet
        if (currentTab === 'swap' || !currentTab) {
            // Continue to load swap history
        }

        try {
            let filterTick = null;
            const filterType = currentTab === 'deposit' ? 'deposit' : currentTab === 'withdraw' ? 'withdraw' : 'swap';

            if (filterType === 'deposit')
                filterTick = depositToken === 'BTC' ? 'BTC' : depositToken === 'FENNEC' ? 'FENNEC' : 'FB';
            // For withdraw, show both FB and FENNEC together (no filter)
            else if (filterType === 'withdraw') filterTick = null; // Show all withdraws

            // Загружаем данные параллельно
            let deposits = [],
                withdrawals = [];
            if (userAddress) {
                try {
                    // Запрашиваем все withdrawals без фильтра по tick (API может не поддерживать параметр tick)
                    const [dRes, wRes] = await Promise.all([
                        safeFetchJson(`${BACKEND_URL}?action=deposit_list&address=${userAddress}&start=0&limit=20`, {
                            timeoutMs: 12000,
                            retries: 2
                        }).then(r => r || { code: -1 }),
                        safeFetchJson(
                            `${BACKEND_URL}?action=withdraw_history&address=${userAddress}&start=0&limit=50`,
                            {
                                timeoutMs: 12000,
                                retries: 2
                            }
                        ).then(r => r || { code: -1 })
                    ]);
                    if (dRes.code === 0) deposits = dRes.data?.list || [];
                    if (wRes.code === 0) withdrawals = wRes.data?.list || [];
                } catch (e) {
                    console.warn('Fetch history error', e);
                }
            }

            let allTxs = [];

            // --- ЛОГИКА DEPOSIT (показываем последние 10 для всех токенов) ---
            if (filterType === 'deposit') {
                // Показываем все депозиты (BTC, FB, FENNEC) вместе, последние 10
                allTxs = deposits
                    .map(d => {
                        let tick = d.tick || 'FB';
                        if (tick.includes('sFB')) tick = 'FB';
                        if (tick === 'FENNEC') tick = 'FENNEC';
                        if (tick === 'BTC' || tick.includes('BTC')) tick = 'BTC';
                        return { ...d, type: 'deposit', tick };
                    })
                    .sort((a, b) => (b.ts || b.timestamp || 0) - (a.ts || a.timestamp || 0)) // Сортируем по времени (новые первые)
                    .slice(0, 10); // Берем последние 10
            }
            // --- ЛОГИКА WITHDRAW (ИСПРАВЛЕНО: Строгая фильтрация на клиенте по полю tick) ---
            else if (filterType === 'withdraw') {
                if (__historyDebug)
                    console.log(`Loading withdraw history: ${withdrawals.length} total entries from API`);

                // 1. Строгая фильтрация на клиенте - только FB и FENNEC withdrawals для текущего адреса
                const basicList = withdrawals
                    .filter(w => {
                        // Проверяем адрес (если есть в ответе API)
                        if (w.address && w.address.toLowerCase() !== userAddress.toLowerCase()) {
                            if (__historyDebug)
                                console.log(
                                    `Skipping withdraw - wrong address. Expected: ${userAddress}, Got: ${w.address}`
                                );
                            return false;
                        }

                        // Проверяем поле tick в ответе API
                        const tick = (w.tick || '').toString();

                        // Только FB (sFB___000, sFB, FB) и FENNEC
                        const isFB =
                            tick === 'sFB___000' ||
                            tick === 'sFB' ||
                            tick === 'FB' ||
                            tick.toUpperCase() === 'SFB___000' ||
                            tick.toUpperCase() === 'SFB';
                        const isFENNEC = tick === 'FENNEC' || tick.toUpperCase() === 'FENNEC';

                        // Allow sBTC for BTC withdrawals
                        const isBTC = tick === 'sBTC___000' || tick === 'sBTC' || tick === 'BTC';
                        if (!isFB && !isFENNEC && !isBTC) {
                            if (__historyDebug)
                                console.log(`Skipping withdraw - not FB/FENNEC/BTC. Tick: "${tick}"`, w);
                            return false;
                        }

                        // Логируем успешный withdrawal для отладки
                        if (__historyDebug) console.log(`Valid withdraw: ${w.amount || 0} ${tick} (ID: ${w.id})`);
                        return true;
                    })
                    .map(w => {
                        // Нормализуем тикер для отображения
                        let tick = (w.tick || '').toString();
                        if (
                            tick === 'sFB___000' ||
                            tick === 'sFB' ||
                            tick.toUpperCase() === 'SFB___000' ||
                            tick.toUpperCase() === 'SFB'
                        ) {
                            tick = 'FB';
                        } else if (tick === 'FENNEC' || tick.toUpperCase() === 'FENNEC') {
                            tick = 'FENNEC';
                        } else if (tick === 'sBTC___000' || tick === 'sBTC' || tick === 'BTC') {
                            // sBTC is valid for BTC withdrawals
                            tick = 'BTC';
                        } else {
                            // Fallback - если не распознали, но прошли фильтр, оставляем как есть
                            if (__historyDebug) console.warn(`Unknown tick format but passed filter: "${tick}"`, w);
                        }
                        return { ...w, tick };
                    });

                const isLikelyHash = value => {
                    const v = (value || '').toString();
                    return v.length >= 32 && v.length <= 128 && /^[a-fA-F0-9]+$/.test(v);
                };

                const limitedList = basicList
                    .sort((a, b) => (b.ts || b.timestamp || 0) - (a.ts || a.timestamp || 0))
                    .slice(0, 10);
                if (__historyDebug) {
                    console.log(
                        `Filtered to ${basicList.length} valid withdrawals (FB + FENNEC) from ${withdrawals.length} total`
                    );
                }

                // 2. Обогащаем данные: запрашиваем детали для получения реального TXID
                // Используем Promise.all для параллельной загрузки (быстро)
                allTxs = await Promise.all(
                    limitedList.map(async w => {
                        let tick = w.tick || 'FB';
                        if (tick.includes('sFB') || tick === 'sFB___000') tick = 'FB';
                        if (tick === 'FENNEC' || tick.includes('FENNEC')) tick = 'FENNEC';
                        if (tick === 'BTC' || tick.includes('BTC')) tick = 'BTC';

                        // По умолчанию берем то, что есть (часто это ID ордера)
                        let displayTxid =
                            w.receiveTxid ||
                            w.receiveTxId ||
                            w.receive_txid ||
                            w.receiveTxHash ||
                            w.txid ||
                            w.hash ||
                            w.approveTxid ||
                            w.approveTxId ||
                            w.approve_txid ||
                            w.rollUpTxid ||
                            w.rollUpTxId ||
                            w.rollUp_txid ||
                            w.inscribeTxid ||
                            w.inscribeTxId ||
                            w.inscribe_txid ||
                            w.paymentTxid ||
                            w.paymentTxId ||
                            w.payment_txid ||
                            '';
                        const status = w.status;

                        const needsResolution = !isLikelyHash(displayTxid);

                        // ИСПРАВЛЕНИЕ: Всегда запрашиваем детали для получения receiveTxid (не payTxid)
                        // Для withdraw транзакций нужно использовать receiveTxid, а не payTxid
                        if (needsResolution) {
                            try {
                                // Запрашиваем детали БЕЗ параметра address (только ID)
                                const detailRes = await safeFetchJson(
                                    `${BACKEND_URL}?action=withdraw_process&id=${w.id}`,
                                    {
                                        timeoutMs: 12000,
                                        retries: 2
                                    }
                                );

                                if (detailRes && detailRes.code === 0 && detailRes.data) {
                                    // ИСПРАВЛЕНИЕ: Приоритет receiveTxid (это транзакция получения на Bitcoin Mainnet)
                                    // НЕ используем payTxid (это транзакция сжигания на Fractal)
                                    const realHash =
                                        detailRes.data.receiveTxid ||
                                        detailRes.data.receiveTxId ||
                                        detailRes.data.receive_txid ||
                                        detailRes.data.receiveTxHash ||
                                        detailRes.data.txid ||
                                        detailRes.data.hash ||
                                        detailRes.data.approveTxid ||
                                        detailRes.data.approveTxId ||
                                        detailRes.data.approve_txid ||
                                        detailRes.data.rollUpTxid ||
                                        detailRes.data.rollUpTxId ||
                                        detailRes.data.rollUp_txid ||
                                        detailRes.data.inscribeTxid ||
                                        detailRes.data.inscribeTxId ||
                                        detailRes.data.inscribe_txid ||
                                        detailRes.data.paymentTxid ||
                                        detailRes.data.paymentTxId ||
                                        detailRes.data.payment_txid ||
                                        displayTxid;

                                    // НЕ используем payTxid, так как это транзакция сжигания, а не получения
                                    // payTxid = транзакция сжигания на Fractal
                                    // receiveTxid = транзакция получения на Bitcoin Mainnet (это то, что нужно)

                                    if (isLikelyHash(realHash)) {
                                        displayTxid = realHash;
                                        // console.log(`Using receiveTxid for withdraw ${w.id} (${tick}) -> ${realHash}`);
                                    }
                                }
                            } catch (err) {
                                if (__historyDebug) console.warn(`Failed to verify withdraw ${w.id}`, err);
                            }
                        }

                        return {
                            ...w,
                            type: 'withdraw',
                            tick,
                            txid: displayTxid, // Теперь тут реальный хеш
                            status: status,
                            ts: w.ts || w.timestamp || Math.floor(Date.now() / 1000) // Добавляем timestamp для сортировки
                        };
                    })
                );

                // Сортируем по времени (новые первые)
                allTxs.sort((a, b) => (b.ts || 0) - (a.ts || 0));
                if (__historyDebug) console.log(`Processed ${allTxs.length} withdrawals (sorted by time)`);
            }
            // --- ЛОГИКА SWAP (ИСПРАВЛЕНО: Используем кэшированные данные) ---
            else if (filterType === 'swap') {
                let swapList = [];

                // ИСПРАВЛЕНИЕ: Используем единую функцию загрузки с кэшем
                try {
                    const swapData = await loadSwapHistory(true);
                    const sResFB_FENNEC = swapData.fbFennec;
                    const sResBTC_FB = swapData.btcFb;

                    // Обрабатываем историю FB-FENNEC
                    if (sResFB_FENNEC.code === 0 && sResFB_FENNEC.data?.list) {
                        const fbFennecSwaps = sResFB_FENNEC.data.list.map(s => {
                            const tickIn = s.tickIn || s.tick0 || '';
                            const tickOut = s.tickOut || s.tick1 || '';
                            const amountIn = parseFloat(s.amountIn || s.amount0 || s.amount || 0);
                            const amountOut = parseFloat(s.amountOut || s.amount1 || 0);

                            let payTick, receiveTick;
                            if (tickIn.includes('FENNEC')) {
                                payTick = 'FENNEC';
                                receiveTick = tickOut.includes('FB') || tickOut.includes('sFB') ? 'FB' : tickOut;
                            } else if (tickIn.includes('FB') || tickIn.includes('sFB')) {
                                payTick = 'FB';
                                receiveTick = tickOut.includes('FENNEC') ? 'FENNEC' : tickOut;
                            } else {
                                payTick = tickIn;
                                receiveTick = tickOut;
                            }

                            return {
                                ...s,
                                type: 'swap',
                                ts: s.ts || s.timestamp || Math.floor(Date.now() / 1000),
                                payAmount: amountIn,
                                receiveAmount: amountOut,
                                payTick: payTick,
                                receiveTick: receiveTick,
                                txid: s.txid || s.hash || s.id
                            };
                        });
                        swapList = swapList.concat(fbFennecSwaps);
                    }

                    // Обрабатываем историю BTC-FB
                    if (sResBTC_FB.code === 0 && sResBTC_FB.data?.list) {
                        const btcFbSwaps = sResBTC_FB.data.list.map(s => {
                            const tickIn = s.tickIn || s.tick0 || '';
                            const tickOut = s.tickOut || s.tick1 || '';
                            const amountIn = parseFloat(s.amountIn || s.amount0 || s.amount || 0);
                            const amountOut = parseFloat(s.amountOut || s.amount1 || 0);

                            let payTick, receiveTick;
                            if (tickIn.includes('BTC') || tickIn.includes('sBTC')) {
                                payTick = 'BTC'; // Отображаем как BTC, не sBTC
                                receiveTick = tickOut.includes('FB') || tickOut.includes('sFB') ? 'FB' : tickOut;
                            } else if (tickIn.includes('FB') || tickIn.includes('sFB')) {
                                payTick = 'FB';
                                receiveTick = tickOut.includes('BTC') || tickOut.includes('sBTC') ? 'BTC' : tickOut; // Отображаем как BTC
                            } else {
                                payTick = tickIn.includes('sBTC') ? 'BTC' : tickIn;
                                receiveTick = tickOut.includes('sBTC') ? 'BTC' : tickOut;
                            }

                            return {
                                ...s,
                                type: 'swap',
                                ts: s.ts || s.timestamp || Math.floor(Date.now() / 1000),
                                payAmount: amountIn,
                                receiveAmount: amountOut,
                                payTick: payTick,
                                receiveTick: receiveTick,
                                txid: s.txid || s.hash || s.id
                            };
                        });
                        swapList = swapList.concat(btcFbSwaps);
                    }

                    console.log(`Loaded ${swapList.length} swaps from API (FB-FENNEC + BTC-FB)`);
                } catch (e) {
                    console.error('Failed to fetch swap history:', e);
                }

                // 2. Fallback на LocalStorage (ТОЛЬКО SWAP)
                if (swapList.length === 0) {
                    const localHist = JSON.parse(localStorage.getItem('fennec_history') || '[]');
                    // !!! ФИЛЬТРУЕМ СТРОГО ПО ТИПУ SWAP !!!
                    swapList = localHist
                        .filter(tx => tx.type === 'swap')
                        .map(tx => ({
                            ...tx,
                            ts: Math.floor((tx.timestamp || Date.now()) / 1000)
                        }));
                }

                // 3. ФИЛЬТРАЦИЯ ПО ТЕКУЩЕЙ ПАРЕ (ИСПРАВЛЕНО)
                // Показываем только свапы для выбранной пары
                if (currentSwapPair === 'FB_FENNEC') {
                    // Для пары FB-FENNEC показываем только свапы между FB и FENNEC (без BTC)
                    swapList = swapList.filter(s => {
                        const payTick = s.payTick || '';
                        const receiveTick = s.receiveTick || '';
                        // Исключаем свапы с BTC
                        const hasBTC = payTick.includes('BTC') || receiveTick.includes('BTC');
                        // Включаем только свапы между FB и FENNEC
                        const hasFB = payTick.includes('FB') || receiveTick.includes('FB');
                        const hasFENNEC = payTick.includes('FENNEC') || receiveTick.includes('FENNEC');
                        return !hasBTC && hasFB && hasFENNEC;
                    });
                } else if (currentSwapPair === 'BTC_FB') {
                    // Для пары BTC-FB показываем только свапы между BTC и FB (без FENNEC)
                    swapList = swapList.filter(s => {
                        const payTick = s.payTick || '';
                        const receiveTick = s.receiveTick || '';
                        // Исключаем свапы с FENNEC
                        const hasFENNEC = payTick.includes('FENNEC') || receiveTick.includes('FENNEC');
                        // Включаем только свапы между BTC и FB
                        const hasBTC = payTick.includes('BTC') || receiveTick.includes('BTC');
                        const hasFB = payTick.includes('FB') || receiveTick.includes('FB');
                        return !hasFENNEC && hasBTC && hasFB;
                    });
                }

                console.log(`Filtered to ${swapList.length} swaps for pair ${currentSwapPair}`);
                allTxs = swapList;
            }

            // Рендер
            allTxs.sort((a, b) => (b.ts || 0) - (a.ts || 0));

            if (allTxs.length === 0) {
                if (historyEl) {
                    historyEl.innerHTML = '';
                    const empty = document.createElement('div');
                    empty.className = 'text-center py-4 text-gray-500 text-xs';
                    empty.textContent = `No ${filterType} history found`;
                    historyEl.appendChild(empty);
                }

                try {
                    const v =
                        currentTab === 'swap'
                            ? String(currentSwapPair || '').trim()
                            : currentTab === 'deposit'
                              ? String(depositToken || '').trim()
                              : '';
                    const key = `hist:${String(currentTab || '').trim()}:${v}`;
                    if (window.__fennecUiCache && window.__fennecUiCache.historyHtml) {
                        window.__fennecUiCache.historyHtml[key] = String(historyEl.innerHTML || '');
                    }
                } catch (_) {}
                return;
            }

            // ИСПРАВЛЕНИЕ: Проверяем что historyEl существует перед рендером
            if (!historyEl) {
                console.warn('History element not found for rendering');
                return;
            }

            historyEl.innerHTML = allTxs
                .map(tx => {
                    const date = new Date((tx.ts || 0) * 1000);
                    const dateStr =
                        date.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        }) +
                        ', ' +
                        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    const isDeposit = tx.type === 'deposit';
                    const isSwap = tx.type === 'swap';

                    // Статус
                    const status = tx.status || 'completed';
                    let statusColor = 'text-green-400';
                    let statusText = status;

                    // Для вывода обрабатываем подтверждения
                    if (tx.type === 'withdraw') {
                        if (status === 'completed' || status === 'success' || tx.isSuccess) {
                            statusText = 'Success';
                            statusColor = 'text-green-400';
                        } else {
                            const cur = tx.cur || tx.totalConfirmedNum || 0;
                            const sum = tx.sum || tx.totalNum || 1;
                            statusText = `${cur}/${sum} confirm`;
                            statusColor = 'text-yellow-400';
                        }
                    }

                    // Получаем реальный TXID (улучшенная логика для всех типов транзакций)
                    let realTxid = '';

                    if (tx.type === 'withdraw') {
                        realTxid =
                            tx.receiveTxid ||
                            tx.receiveTxId ||
                            tx.receive_txid ||
                            tx.receiveTxHash ||
                            tx.txid ||
                            tx.approveTxid ||
                            tx.approveTxId ||
                            tx.approve_txid ||
                            tx.rollUpTxid ||
                            tx.rollUpTxId ||
                            tx.rollUp_txid ||
                            tx.inscribeTxid ||
                            tx.inscribeTxId ||
                            tx.inscribe_txid ||
                            tx.paymentTxid ||
                            tx.paymentTxId ||
                            tx.payment_txid ||
                            tx.hash ||
                            '';
                    } else if (tx.type === 'deposit') {
                        // Для депозита: txid, hash, id
                        realTxid = tx.txid || tx.hash || tx.id || '';
                    } else {
                        // Для других типов (swap и т.д.)
                        realTxid = tx.txid || tx.hash || tx.id || '';
                    }

                    // Проверяем, что это валидный хеш транзакции (минимум 32 символа hex, максимум 128)
                    // Bitcoin/Fractal транзакции обычно 64 символа, но могут быть и другие форматы
                    const isHash =
                        realTxid &&
                        realTxid.length >= 32 &&
                        realTxid.length <= 128 &&
                        /^[a-fA-F0-9]+$/.test(realTxid) &&
                        !realTxid.includes('_') && // Исключаем ID ордеров с подчеркиваниями
                        !realTxid.includes('-'); // Исключаем UUID

                    let txLink = '';
                    if (tx.type !== 'swap' && isHash) {
                        // ИСПРАВЛЕНО: Все действия происходят во Fractal, кроме депозита BTC
                        // Для вывода: всегда Uniscan (Fractal), так как вывод происходит из Fractal
                        // Для депозита: только BTC депозиты ведут на mempool.space, остальное - Uniscan
                        const rawTick = (tx.tick || '').toString().toUpperCase();
                        const tickNorm =
                            rawTick.includes('SBTC') || rawTick === 'BTC' || rawTick.includes('BTC')
                                ? 'BTC'
                                : rawTick.includes('SFB') || rawTick === 'FB'
                                  ? 'FB'
                                  : rawTick.includes('FENNEC')
                                    ? 'FENNEC'
                                    : rawTick;
                        const useMempool = tickNorm === 'BTC';

                        txLink = useMempool
                            ? `<a href="https://mempool.space/tx/${realTxid}" target="_blank" class="text-[10px] text-fennec hover:text-white mt-1 block truncate w-20">View TX</a>`
                            : `<a href="https://uniscan.cc/fractal/tx/${realTxid}" target="_blank" class="text-[10px] text-fennec hover:text-white mt-1 block truncate w-20">View TX</a>`;
                    }

                    // Format amounts with proper separators
                    const formatAmount = amt => {
                        const num = parseFloat(amt || 0);
                        if (num === 0) return '0';
                        // Use comma for thousands, period for decimals
                        const parts = num
                            .toFixed(8)
                            .replace(/\.?0+$/, '')
                            .split('.');
                        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                        return parts.join('.');
                    };

                    // For swap, show Pay/Receive format with icons
                    if (isSwap) {
                        const payAmt = formatAmount(tx.payAmount || tx.amountIn || tx.amount);
                        const receiveAmt = formatAmount(tx.receiveAmount || tx.amountOut || 0);
                        const payTick = tx.payTick || (tx.tickIn?.includes('FENNEC') ? 'FENNEC' : 'FB');
                        const receiveTick = tx.receiveTick || (tx.tickOut?.includes('FENNEC') ? 'FENNEC' : 'FB');

                        const safePayAmt = __escapeHtml(payAmt);
                        const safeReceiveAmt = __escapeHtml(receiveAmt);
                        const safeDateStr = __escapeHtml(dateStr);

                        // Icons for tokens (using site assets from img folder)
                        const payIcon =
                            payTick === 'FENNEC'
                                ? '<img src="img/phav.png" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">'
                                : payTick === 'BTC'
                                  ? '<img src="img/BTC.svg" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">'
                                  : '<img src="img/FB.png" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">';
                        const receiveIcon =
                            receiveTick === 'FENNEC'
                                ? '<img src="img/phav.png" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">'
                                : receiveTick === 'BTC'
                                  ? '<img src="img/BTC.svg" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">'
                                  : '<img src="img/FB.png" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">';

                        return `
                                                                                                                                <div class="bg-black/30 border border-white/5 rounded-lg p-3 mb-2 hover:bg-black/40 transition">
                                                                                                                                    <div class="grid grid-cols-3 gap-2 text-xs">
                                                                                                                                        <div>
                                                                                                                                            <div class="text-gray-500 text-[10px] mb-1">Pay</div>
                                                                                                                                            <div class="flex items-center gap-1">
                                                                                                                                                ${payIcon}
                                                                                                                                                <span class="font-bold text-white">${safePayAmt}</span>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                        <div>
                                                                                                                                            <div class="text-gray-500 text-[10px] mb-1">Receive</div>
                                                                                                                                            <div class="flex items-center gap-1">
                                                                                                                                                ${receiveIcon}
                                                                                                                                                <span class="font-bold text-white">${safeReceiveAmt}</span>
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                        <div class="text-right">
                                                                                                                                            <div class="text-gray-500 text-[10px] mb-1">Time</div>
                                                                                                                                            <div class="text-[10px] text-gray-400">${safeDateStr}</div>
                                                                                                                                            ${txLink}
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            `;
                    }

                    // For deposit/withdraw, show simple format
                    const amount = formatAmount(tx.amount || tx.totalAmount || 0);

                    // Нормализуем тикер: убираем префиксы sFB, sBTC и т.д.
                    let displayTick = tx.tick || 'FB';
                    if (displayTick.includes('sFB') || displayTick === 'sFB___000') displayTick = 'FB';
                    if (displayTick.includes('sBTC') || displayTick === 'sBTC___000') displayTick = 'BTC';
                    if (displayTick.includes('FENNEC')) displayTick = 'FENNEC';

                    const safeType = __escapeHtml(String(tx.type || '').toUpperCase());
                    const safeAmount = __escapeHtml(String(amount || ''));
                    const safeDisplayTick = __escapeHtml(String(displayTick || ''));
                    const safeDateStr = __escapeHtml(String(dateStr || ''));
                    const safeStatusText = __escapeHtml(String(statusText || ''));

                    return `
                                                                                                                            <div class="bg-black/30 border border-white/5 rounded-lg p-3 mb-2 hover:bg-black/40 transition">
                                                                                                                                <div class="flex items-center justify-between">
                                                                                                                                    <div class="flex items-center gap-2">
                                                                                                                                        <div class="w-8 h-8 rounded-full flex items-center justify-center ${isDeposit ? 'bg-green-500/20 text-green-400' : 'bg-fennec/20 text-fennec'}">
                                                                                                                                            <i class="fas ${isDeposit ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i>
                                                                                                                                        </div>
                                                                                                                                        <div>
                                                                                                                                            <div class="text-xs font-bold text-white">${safeType} ${safeAmount} ${safeDisplayTick}</div>
                                                                                                                                            <div class="text-[10px] text-gray-500">${safeDateStr}</div>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                    <div class="text-right">
                                                                                                                                        <div class="text-[10px] ${statusColor} mt-1">${safeStatusText}</div>
                                                                                                                                        ${txLink}
                                                                                                                                    </div>
                                                                                                                                </div>
                                                                                                                            </div>
                                                                                                                        `;
                })
                .join('');

            try {
                const v =
                    currentTab === 'swap'
                        ? String(currentSwapPair || '').trim()
                        : currentTab === 'deposit'
                          ? String(depositToken || '').trim()
                          : '';
                const key = `hist:${String(currentTab || '').trim()}:${v}`;
                if (window.__fennecUiCache && window.__fennecUiCache.historyHtml) {
                    window.__fennecUiCache.historyHtml[key] = String(historyEl.innerHTML || '');
                }
            } catch (_) {}
        } catch (e) {
            console.error('Hist Error', e);
            historyEl.innerHTML = '<div class="text-center py-4 text-red-500 text-xs">Error loading history</div>';
        }
    });
}

// ===== FENNEC ORACLE LOGIC =====
const isOracleOpen = false;

// toggleChat is already defined at top, no need to redefine

const CHAT_HISTORY_KEY = 'fennec_oracle_history_v1';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderOracleMarkdown(text) {
    let t = String(text || '');
    t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(
        /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    t = t.replace(/(^|\n)\s*-\s+(.*?)(?=\n|$)/g, '$1<ul><li>$2</li></ul>');
    t = t.replace(/<\/ul>\s*<ul>/g, '');
    t = t.replace(/\n/g, '<br>');
    return t;
}

function pushChatHistory(role, text) {
    try {
        const raw = localStorage.getItem(CHAT_HISTORY_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        arr.push({ role, text, ts: Date.now() });
        while (arr.length > 30) arr.shift();
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(arr));
    } catch (e) {}
}

function loadChatHistory() {
    try {
        const raw = localStorage.getItem(CHAT_HISTORY_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

function renderChatHistory() {
    const chat = document.getElementById('chatMessages');
    if (!chat) return;
    const items = loadChatHistory();
    if (!items.length) return;

    chat.innerHTML = '';
    const appendUser = text => {
        const row = document.createElement('div');
        row.className = 'flex justify-end msg-anim';
        const bubble = document.createElement('div');
        bubble.className = 'bg-fennec/20 p-3 rounded-lg text-white max-w-[75%] text-xs leading-relaxed';
        bubble.textContent = String(text || '');
        row.appendChild(bubble);
        chat.appendChild(row);
    };
    const appendAssistant = text => {
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-start msg-anim';

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'w-6 h-6 flex-shrink-0';
        const img = document.createElement('img');
        img.src = 'img/FENNECAI.png';
        img.className = 'w-full h-full object-contain ai-avatar';
        avatarWrap.appendChild(img);

        const bubble = document.createElement('div');
        bubble.className = 'bg-white/5 p-3 rounded-lg text-gray-300 flex-1 text-xs leading-relaxed oracle-md';
        bubble.innerHTML = renderOracleMarkdown(escapeHtml(String(text || '')));

        row.appendChild(avatarWrap);
        row.appendChild(bubble);
        chat.appendChild(row);
    };
    for (const it of items) {
        if (it.role === 'user') {
            appendUser(it.text);
        } else {
            appendAssistant(it.text);
        }
    }
    chat.scrollTop = chat.scrollHeight;
}

function setChatLoading(isLoading) {
    const el = document.getElementById('chatLoading');
    const btn = document.getElementById('chatSendBtn');
    if (el) el.classList.toggle('hidden', !isLoading);
    if (btn) btn.disabled = !!isLoading;
}

function windowOracleQuick(type) {
    if (type === 'help') {
        const input = document.getElementById('chatInput');
        if (input) input.value = 'What can you do?';
        return sendMessage();
    }
    if (type === 'prices') {
        const input = document.getElementById('chatInput');
        if (input) input.value = 'Show current price and explain how it is calculated.';
        return sendMessage();
    }
    if (type === 'id') {
        const input = document.getElementById('chatInput');
        if (input) input.value = 'Open my Fennec ID and explain my tier.';
        return sendMessage();
    }
    if (type === 'deposit') {
        const input = document.getElementById('chatInput');
        if (input) input.value = 'How do deposits work? What explorer link should I use?';
        return sendMessage();
    }
    if (type === 'withdraw') {
        const input = document.getElementById('chatInput');
        if (input) input.value = 'How do withdrawals work and how do I verify them?';
        return sendMessage();
    }
    if (type === 'swap') {
        const input = document.getElementById('chatInput');
        if (input) input.value = 'How do I swap tokens? Explain the swap process.';
        return sendMessage();
    }
    if (type === 'clear') {
        try {
            localStorage.removeItem(CHAT_HISTORY_KEY);
        } catch (e) {}
        const chat = document.getElementById('chatMessages');
        if (chat) {
            chat.innerHTML =
                '<div class="flex gap-3"><div class="w-6 h-6 flex items-center"><img src="img/FENNECAI.png" class="w-full h-full object-contain ai-avatar"></div><div class="bg-white/5 p-2 rounded-lg rounded-tl-none">Ask me anything about Fennec.</div></div>';
        }
        const input = document.getElementById('chatInput');
        if (input) input.focus();
        return;
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    const chat = document.getElementById('chatMessages');
    try {
        const row = document.createElement('div');
        row.className = 'flex justify-end msg-anim';
        const bubble = document.createElement('div');
        bubble.className = 'bg-fennec/20 p-3 rounded-lg text-white max-w-[75%] text-xs leading-relaxed';
        bubble.textContent = String(msg || '');
        row.appendChild(bubble);
        chat.appendChild(row);
    } catch (_) {}
    pushChatHistory('user', msg);
    input.value = '';
    try {
        setChatLoading(true);
        const activeSectionId = document.querySelector('.page-section.active')?.id || '';
        const currentTab = document.querySelector('.tab-btn.active')?.id?.replace('tab-', '') || '';
        const history = loadChatHistory()
            .slice(-12)
            .map(it => ({
                role: it.role === 'assistant' ? 'assistant' : 'user',
                content: String(it.text || '')
            }));

        const payload = {
            message: msg,
            history,
            context: {
                section: activeSectionId,
                tab: currentTab,
                swapPair: typeof currentSwapPair !== 'undefined' ? currentSwapPair : '',
                depositToken: typeof depositToken !== 'undefined' ? depositToken : '',
                withdrawToken: typeof withdrawToken !== 'undefined' ? withdrawToken : '',
                isBuying: typeof isBuying !== 'undefined' ? !!isBuying : null,
                address: typeof userAddress !== 'undefined' ? userAddress : null
            }
        };

        const json = await safeFetchJson(`${BACKEND_URL}?action=chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeoutMs: 20000,
            retries: 1
        });
        const reply = String(json && json.reply ? json.reply : '');
        if (!reply) {
            throw new Error('Empty reply');
        }
        // --- AI ACTION PARSER ---
        const commandRegex = /\|\|\|(.*?)\|\|\|/;
        const match = reply.match(commandRegex);
        let cleanReply = reply;
        if (match) {
            const commandJson = match[1];
            cleanReply = reply.replace(match[0], '');
            try {
                const action = JSON.parse(commandJson);
                console.log('AI Action detected:', action);
                executeAIAction(action);
            } catch (err) {
                console.error('Failed to parse AI action:', err, 'Command JSON:', commandJson);
            }
        } else {
            console.log('No AI action command found in reply');
        }
        // ---------------------------
        const cleanText = cleanReply.trim();
        pushChatHistory('assistant', cleanText);
        try {
            const row = document.createElement('div');
            row.className = 'flex gap-2 items-start msg-anim';
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'w-6 h-6 flex-shrink-0';
            const img = document.createElement('img');
            img.src = 'img/FENNECAI.png';
            img.className = 'w-full h-full object-contain ai-avatar';
            avatarWrap.appendChild(img);
            const bubble = document.createElement('div');
            bubble.className = 'bg-white/5 p-3 rounded-lg text-gray-300 flex-1 text-xs leading-relaxed oracle-md';
            bubble.innerHTML = renderOracleMarkdown(escapeHtml(String(cleanText || '')));
            row.appendChild(avatarWrap);
            row.appendChild(bubble);
            chat.appendChild(row);
        } catch (_) {}
        chat.scrollTop = chat.scrollHeight;
    } catch (e) {
        chat.innerHTML += '<div class="text-red-500 text-center text-[10px]">Error</div>';
    } finally {
        setChatLoading(false);
    }
}

// ===== AI ACTION EXECUTOR =====
async function executeAIAction(action) {
    console.log('Executing AI action:', action.type, action.params);

    // 1. НАВИГАЦИЯ ПО ВКЛАДКАМ
    if (action.type === 'NAVIGATE') {
        const tab = action.params.tab;
        // Расширенный список вкладок
        if (['swap', 'deposit', 'withdraw'].includes(tab)) {
            switchTab(tab);
            highlightElement(`tab-${tab}`);
        }
        // Открытие Fennec ID
        if (tab === 'audit' || tab === 'id' || tab === 'fennecid') {
            // Скроллим к секции ID
            const auditSection =
                document.getElementById('auditContainer') || document.querySelector('[onclick*="refreshAudit"]');
            if (auditSection) {
                auditSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // Запускаем аудит если есть кошелек
            if (false && userAddress && typeof window.refreshAudit === 'function') {
                window.refreshAudit();
            }
            highlightElement('auditContainer');
        }
        // Переход на главную
        if (tab === 'home' || tab === 'main') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // 2. ПОДСВЕТКА ЭЛЕМЕНТОВ
    if (action.type === 'HIGHLIGHT') {
        const elId = action.params.elementId;
        highlightElement(elId);
        const el = document.getElementById(elId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 3. ПОДКЛЮЧЕНИЕ КОШЕЛЬКА
    if (action.type === 'CONNECT_WALLET') {
        if (!userAddress) {
            await window.connectWallet();
        }
        highlightElement('connectBtn');
    }

    // 4. ВЫПОЛНЕНИЕ СВАПА (полный цикл)
    if (action.type === 'EXECUTE_SWAP') {
        // Проверяем кошелек
        if (!userAddress) {
            await window.connectWallet();
            await new Promise(r => setTimeout(r, 1000));
            if (!userAddress) return;
        }

        switchTab('swap');
        const params = action.params;

        // Устанавливаем параметры
        if (params.pair) setSwapPair(params.pair);
        if (params.buy !== undefined && window.isBuying !== params.buy) {
            switchDir();
        }

        await new Promise(r => setTimeout(r, 300));

        const input = document.getElementById('swapIn');
        if (input && params.amount) {
            input.value = params.amount;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
                if (typeof calc === 'function') calc();
            }, 300);
        }

        // Автоматически нажимаем кнопку свапа если указано
        if (params.autoExecute) {
            await new Promise(r => setTimeout(r, 500));
            const swapBtn = document.getElementById('swapBtn');
            if (swapBtn) swapBtn.click();
        }

        highlightElement('swapBtn');
    }

    // 5. ЗАПОЛНЕНИЕ ФОРМЫ СВАПА (без выполнения)
    if (action.type === 'FILL_SWAP') {
        if (!userAddress) {
            await window.connectWallet();
            await new Promise(r => setTimeout(r, 1000));
            if (!userAddress) return;
        }

        switchTab('swap');
        const params = action.params;
        const amount = params.amount;
        // ИСПРАВЛЕНИЕ: buy=true означает покупку FENNEC (отдаем FB)
        // buy=false означает продажу FENNEC (отдаем FENNEC)
        const isBuy = params.buy !== undefined ? params.buy : true;

        const pair = params.pair || 'FB_FENNEC';
        setSwapPair(pair);

        // isBuying=true => отдаем FB, получаем FENNEC
        // isBuying=false => отдаем FENNEC, получаем FB
        if (window.isBuying !== isBuy) {
            switchDir();
        }

        await new Promise(r => setTimeout(r, 300));

        const input = document.getElementById('swapIn');
        if (input) {
            input.value = amount;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
                if (typeof calc === 'function') calc();
            }, 300);
        }

        highlightElement('swapBtn');
    }

    // 6. ОТКРЫТИЕ FENNEC ID
    if (action.type === 'OPEN_ID' || action.type === 'GET_ID') {
        if (!userAddress) {
            await window.connectWallet();
            if (typeof switchTab === 'function') {
                switchTab('audit');
            }
        }
        if (userAddress && typeof window.refreshAudit === 'function') {
            if (false) window.refreshAudit();
        }
        const container = document.getElementById('auditContainer');
        if (container) container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 7. ПЕРЕКЛЮЧЕНИЕ НАПРАВЛЕНИЯ СВАПА
    if (action.type === 'SWITCH_DIRECTION') {
        if (typeof switchDir === 'function') {
            switchDir();
        }
    }

    // 8. УСТАНОВКА ПАРЫ
    if (action.type === 'SET_PAIR') {
        const pair = action.params.pair;
        if (typeof setSwapPair === 'function') {
            setSwapPair(pair);
        }
    }

    // 9. ОТКРЫТИЕ ДЕПОЗИТА
    if (action.type === 'OPEN_DEPOSIT') {
        switchTab('deposit');
        highlightElement('tab-deposit');
    }

    // 10. ОТКРЫТИЕ ВЫВОДА
    if (action.type === 'OPEN_WITHDRAW') {
        switchTab('withdraw');
        highlightElement('tab-withdraw');
    }

    // 11. ОБНОВЛЕНИЕ БАЛАНСОВ
    if (action.type === 'REFRESH_BALANCES') {
        if (typeof window.fetchBalances === 'function') {
            await window.fetchBalances();
        }
    }
}

// Хелпер для подсветки
function highlightElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element with id "${id}" not found`);
        return;
    }

    el.classList.add('ai-highlight');

    // Убираем подсветку через 3 секунды
    setTimeout(() => {
        el.classList.remove('ai-highlight');
    }, 3000);
}

// ===== THE BURROW ANIMATION =====
// REMOVED - Burrow section disabled per user request

// ===== FENNEC GRAND AUDIT =====
// window.auditIdentity already defined above

// Calculate Fennec Identity (Logic from React component)
// Функция расчета (Использует готовые stats)
function calculateFennecIdentity(data) {
    const {
        netWorth,
        txCount,
        utxoCount,
        first_tx_ts,
        stats,
        prices,
        lpValueFB,
        lpValueUSD,
        stakedFB,
        abandoned_utxo_count
    } = data;

    // ИСПРАВЛЕНИЕ: НЕ используем fallback - только реальные данные
    const now = Math.floor(Date.now() / 1000);
    const MIN_VALID = 1700000000; // Ноябрь 2023
    let daysAlive = 0;
    let validFirstTxTs = first_tx_ts || 0;

    // ИСПРАВЛЕНИЕ: Проверяем, не в миллисекундах ли timestamp
    if (validFirstTxTs > 1000000000000) {
        // Если timestamp > 1000000000000, это миллисекунды, конвертируем в секунды
        validFirstTxTs = Math.floor(validFirstTxTs / 1000);
        console.log(`Converted timestamp from milliseconds: ${validFirstTxTs}`);
    }

    // ИСПРАВЛЕНИЕ: Строгая валидация - проверяем что timestamp не в будущем
    if (validFirstTxTs > 0) {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const currentDay = currentDate.getDate();

        const tsDate = new Date(validFirstTxTs * 1000);
        const tsYear = tsDate.getFullYear();
        const tsMonth = tsDate.getMonth();
        const tsDay = tsDate.getDate();

        const isFutureYear = tsYear > currentYear;
        const isFutureMonth = tsYear === currentYear && tsMonth > currentMonth;
        const isFutureDay = tsYear === currentYear && tsMonth === currentMonth && tsDay > currentDay;
        const isFuture = isFutureYear || isFutureMonth || isFutureDay || validFirstTxTs > now;

        if (validFirstTxTs >= MIN_VALID && validFirstTxTs <= now && !isFuture) {
            // Валидный timestamp - вычисляем возраст точно
            daysAlive = Math.ceil((now - validFirstTxTs) / 86400);
            if (daysAlive < 1) daysAlive = 1; // Минимум 1 день
        } else if (isFuture) {
            // Timestamp в будущем - возвращаем 0
            console.error(
                `Invalid first_tx_ts in calculateFennecIdentity: ${validFirstTxTs} (date: ${new Date(validFirstTxTs * 1000).toISOString()}, year: ${tsYear}, month: ${tsMonth + 1}, day: ${tsDay}). Current: ${currentYear}-${currentMonth + 1}-${currentDay}, now: ${now}, validFirstTxTs > now: ${validFirstTxTs > now}`
            );
            validFirstTxTs = 0;
            daysAlive = 0;
        } else {
            // Timestamp неправильный по другим причинам - возвращаем 0
            console.error(
                `Invalid first_tx_ts in calculateFennecIdentity: ${validFirstTxTs} (date: ${new Date(validFirstTxTs * 1000).toISOString()}). Valid range: ${MIN_VALID} - ${now}`
            );
            validFirstTxTs = 0;
            daysAlive = 0;
        }
    } else {
        // Нет timestamp - возвращаем 0
        daysAlive = 0;
    }

    // 1. GENESIS CHECK (СТРОГО 24 ЧАСА)
    // Fractal Mainnet Launch: Sept 9, 2024
    const LAUNCH_DATE = 1725840000;
    const ONE_DAY = 86400;
    const isGenesis = validFirstTxTs > 0 && validFirstTxTs >= LAUNCH_DATE && validFirstTxTs < LAUNCH_DATE + ONE_DAY;

    // 2. ОПРЕДЕЛЕНИЕ РОЛЕЙ (Без стейкера - отключен)
    const isNativeStaker = false; // Стейкинг отключен
    const netWorthUSD = Number(netWorth) || 0;
    const lpCount = stats && typeof stats.lp !== 'undefined' ? Number(stats.lp) || 0 : 0;
    const providerValueUSD = Number(lpValueUSD) || 0;
    const isLiquidityProvider = providerValueUSD >= 50;
    const isWhale = netWorthUSD >= 1000;
    const brc20Count = stats && typeof stats.brc20 !== 'undefined' ? Number(stats.brc20) || 0 : 0;
    const runesCount = stats && typeof stats.runes !== 'undefined' ? Number(stats.runes) || 0 : 0;
    const ordinalsCount = stats && typeof stats.ordinals !== 'undefined' ? Number(stats.ordinals) || 0 : 0;
    const totalInscriptions = brc20Count + runesCount + ordinalsCount;
    const isArtifactHunter = totalInscriptions >= 50;
    const isRuneKeeper = runesCount >= 20;

    // 3. РАСЧЕТ ВОЗРАСТА
    const avgTxPerDay = daysAlive > 0 ? txCount / daysAlive : 0;

    // 4. СИСТЕМА БЕЙДЖЕЙ (BADGES)
    let archetype = {
        baseKey: 'DRIFTER',
        title: 'DESERT RUNNER',
        tierLevel: 0,
        desc: 'Passing through the fractal dunes.',
        color: 'text-gray-400',
        badges: [],
        icon: ''
    };

    // НОВАЯ ПРОВЕРКА: FENNEC SOUL (Холдер или LP)
    // Проверяем общий баланс FENNEC (Native + Swap)
    // ИСПРАВЛЕНИЕ: fennecBalance может быть строкой (toFixed), парсим
    const fennecTotal =
        typeof data.fennecBalance === 'string' ? parseFloat(data.fennecBalance) : data.fennecBalance || 0;
    const fennecWalletOnly = Number(data.fennec_wallet_balance || 0) || 0;
    const hasFennecInLP = data.has_fennec_in_lp || false; // ИСПРАВЛЕНИЕ: Проверяем есть ли LP с FENNEC
    const fennecLpValueUSD = Number(data.fennec_lp_value_usd || 0) || 0;
    const hasFennecSoul = fennecWalletOnly >= 100 || fennecLpValueUSD >= 1;

    const nativeFB = Number(data.nativeBalance || 0) || 0;
    const isMempoolRider = (Number(txCount) || 0) >= 10000;
    const abandonedUtxoCountNum = Number.isFinite(Number(abandoned_utxo_count)) ? Number(abandoned_utxo_count) : 0;
    const abandonedUtxoCountMissing = !!data.abandoned_utxo_count_missing;
    const isSandSweeper = !abandonedUtxoCountMissing && abandonedUtxoCountNum < 100;

    // Collection of all earned badges (v6)
    const badges = [];
    if (isGenesis)
        badges.push({
            name: 'GENESIS',
            icon: '',
            desc: 'You witnessed the first sunrise over the Fractal dunes.'
        });
    if (isWhale)
        badges.push({
            name: 'WHALE',
            icon: '',
            desc: 'When you move, the sands shift beneath you.'
        });
    if (isLiquidityProvider)
        badges.push({
            name: 'PROVIDER',
            icon: '',
            desc: 'The desert is thirsty, but your well runs deep.'
        });
    if (fennecTotal >= 10000 || hasFennecInLP)
        badges.push({
            name: 'FENNEC MAXI',
            icon: '',
            desc: 'The Spirit of the Fox guides your path.'
        });
    if (isArtifactHunter)
        badges.push({
            name: 'ARTIFACT HUNTER',
            icon: '',
            desc: 'Your pockets are heavy with echoes of the chain.'
        });
    if (isRuneKeeper)
        badges.push({
            name: 'RUNE KEEPER',
            icon: '',
            desc: 'You decipher the glyphs. The stones speak to you.'
        });
    if (isMempoolRider)
        badges.push({
            name: 'MEMPOOL RIDER',
            icon: '',
            desc: 'Surfing the chaos of the 30-second block waves.'
        });
    if (isSandSweeper)
        badges.push({
            name: 'SAND SWEEPER',
            icon: '',
            desc: 'Your UTXO set is clean. No trash left in the dunes.'
        });

    // Assign badges to archetype
    archetype.badges = badges;
    const badgeCount = badges.length;

    // --- 3. DETERMINE BASE ARCHETYPE ---
    // Сначала определяем "ветку развития" (Base Class)
    let baseKey = 'DRIFTER'; // default

    if (isGenesis && isLiquidityProvider && isWhale) baseKey = 'PRIME';
    else if (providerValueUSD >= 200) baseKey = 'LORD';
    else if (isGenesis) baseKey = 'WALKER';
    else if (isArtifactHunter && isRuneKeeper) baseKey = 'KEEPER';
    else if (netWorthUSD >= 100) baseKey = 'MERCHANT';
    else if (txCount > 1000) baseKey = 'ENGINEER';
    else if (runesCount >= 20) baseKey = 'SHAMAN';
    else baseKey = 'DRIFTER';

    if (badgeCount >= 7) baseKey = 'SINGULARITY';

    // --- 4. EVOLVE TITLE BASED ON BADGES (TIER SYSTEM) ---
    // Определяем уровень на основе количества бейджей
    let tierLevel = 0;
    if (badgeCount >= 6)
        tierLevel = 3; // God Tier
    else if (badgeCount >= 4)
        tierLevel = 2; // Elite
    else if (badgeCount >= 2)
        tierLevel = 1; // Advanced
    else tierLevel = 0; // Basic

    if (baseKey === 'PRIME' || baseKey === 'SINGULARITY') tierLevel = 3;

    // База данных эволюций
    const tierNames = {
        DRIFTER: ['DESERT RUNNER', 'SAND WANDERER', 'DUNE NOMAD', 'STORM SURFER'],
        MERCHANT: ['CARAVAN MERCHANT', 'GOLD TRADER', 'OASIS KING', 'DESERT TYCOON'],
        ENGINEER: ['CODE ENGINEER', 'SYSTEM BUILDER', 'NEURAL ARCHITECT', 'QUANTUM ENGINEER'],
        SHAMAN: ['RUNE SHAMAN', 'RUNE SEER', 'RUNE PROPHET', 'RUNE DEITY'],
        KEEPER: ['KEEPER OF LORE', 'CHRONICLER', 'GRAND ARCHIVIST', 'OMNISCIENT'],
        WALKER: ['FIRST WALKER', 'ANCIENT WALKER', 'PRIMORDIAL', 'TIMELESS ENTITY'],
        LORD: ['OASIS LORD', 'TERMINAL BARON', 'FRACTAL KING', 'EMPEROR'],
        PRIME: ['FRACTAL PRIME', 'APEX PRIME', 'OMEGA PRIME', 'PRIME ABSOLUTE'],
        SINGULARITY: ['THE SINGULARITY', 'THE SINGULARITY', 'THE SINGULARITY', 'THE SINGULARITY']
    };

    // Получаем финальное название
    const evolutionPath = tierNames[baseKey] || tierNames['DRIFTER'];
    // Защита от выхода за пределы массива
    const finalTitle = evolutionPath[Math.min(tierLevel, evolutionPath.length - 1)];

    // Формируем объект архетипа
    archetype = {
        baseKey: baseKey, // Для выбора картинки
        title: finalTitle, // Для отображения
        tierLevel: tierLevel, // Для стилей текста (0-3)
        tierLabel: '', // Подпись над именем
        tier: '', // Для совместимости
        badges: badges
    };

    // --- 4. SCORE & RARITY ---
    // --- 4. SCORE & RARITY (v6.0: 4 baskets + Soul Multiplier) ---
    const txCountNum = Number(txCount) || 0;
    const activityPoints = Math.round(25 * (Math.log10(1 + Math.min(txCountNum, 10000)) / Math.log10(1 + 10000)));
    const wealthPoints = Math.round(25 * Math.sqrt(Math.min(netWorthUSD, 1000) / 1000));
    const timePoints = Math.round(15 * (Math.min(daysAlive, 365) / 365));

    const badgeWeights = {
        GENESIS: 15,
        WHALE: 10,
        PROVIDER: 8,
        'ARTIFACT HUNTER': 3,
        'RUNE KEEPER': 3,
        'MEMPOOL RIDER': 7,
        'SAND SWEEPER': 3,
        'FENNEC MAXI': 0
    };
    const badgesPointsRaw = badges.reduce((sum, b) => sum + (badgeWeights[b.name] || 0), 0);
    const badgesPoints = Math.min(35, badgesPointsRaw);
    const baseScoreRaw = activityPoints + wealthPoints + timePoints + badgesPoints;
    const baseScore = Math.min(100, baseScoreRaw);
    const hasMaxi = badges.some(b => b.name === 'FENNEC MAXI');
    const multiplier = hasMaxi ? 1.15 : 1;
    const finalScoreRaw = baseScore * multiplier;
    const activityScore = Math.min(100, Math.round(finalScoreRaw));

    let rarityName = 'CUB';
    let rarityClass = 'card-common';
    let rarityColor = 'text-gray-500'; // ИСПРАВЛЕНИЕ: Определяем rarityColor

    if (activityScore >= 95) {
        rarityName = 'SPIRIT';
        rarityClass = 'card-spirit';
        rarityColor = 'text-spirit';
    } else if (activityScore >= 80) {
        rarityName = 'ELDER';
        rarityClass = 'card-elder';
        rarityColor = 'text-elder';
    } else if (activityScore >= 65) {
        rarityName = 'ALPHA';
        rarityClass = 'card-alpha';
        rarityColor = 'text-alpha';
    } else if (activityScore >= 50) {
        rarityName = 'HUNTER';
        rarityClass = 'card-hunter';
        rarityColor = 'text-hunter';
    } else if (activityScore >= 30) {
        rarityName = 'SCOUT';
        rarityClass = 'card-scout';
        rarityColor = 'text-scout';
    }

    // Статус для UI (дублирует эволюцию для ясности)
    const activityStatus = rarityName;
    const activityColor = rarityColor; // ИСПРАВЛЕНИЕ: Определяем activityColor

    // ИСПРАВЛЕНИЕ: hasFennecSoul уже объявлен выше (строка 6329), не дублируем

    return {
        archetype,
        metrics: {
            address: String(data && (data.address || data.addr) ? data.address || data.addr : '').trim(),
            wealth: netWorth.toFixed(2), // ИСПРАВЛЕНИЕ: Используем netWorth напрямую (уже рассчитан правильно)
            daysAlive, // ИСПРАВЛЕНИЕ: Используем daysAlive (уже рассчитан правильно)
            first_tx_ts: validFirstTxTs,
            txCount,
            utxoCount,
            activityScore,
            scoreBreakdown: {
                activityPoints,
                wealthPoints,
                timePoints,
                badgesPoints,
                baseScore,
                multiplier,
                scoreAfterMultiplier: finalScoreRaw
            },
            fennecBalance: fennecTotal.toFixed(2), // ИСПРАВЛЕНИЕ: Используем fennecTotal (уже определен выше)
            fennecNativeBalance: data.fennec_native_balance || 0, // Количество FENNEC на кошельке (для обратной стороны карточки)
            fennecWalletBalance: data.fennec_wallet_balance || 0,
            fennecInSwapBalance: data.fennec_inswap_balance || 0,
            fbTotal: (parseFloat(data.nativeBalance) + (data.fbSwapBalance || 0) + (stakedFB || 0)).toFixed(2),
            nativeBalance: (data.nativeBalance || 0).toFixed(4), // ИСПРАВЛЕНИЕ: Используем данные из data
            rarity: {
                // Объект редкости для нового дизайна
                name: rarityName,
                class: rarityClass,
                color: rarityColor
            },
            rarityName, // Сохраняем для совместимости
            rarityColor, // Сохраняем для совместимости
            activityStatus,
            activityColor,
            avgTxPerDay: avgTxPerDay.toFixed(2),
            inscriptionStats: stats,
            abandonedUtxoCount: abandonedUtxoCountNum,
            fbSwapBalance: data.fbSwapBalance || 0,
            stakedFB: stakedFB || 0,
            lpValueFB: lpValueFB || 0,
            lpValueUSD: lpValueUSD || 0, // Сохраняем для совместимости
            // Передаем флаг души
            hasFennecSoul,
            hasFennecInLP,
            fennecLpValueUSD,
            hasFennecBoxes: !!(data.hasFennecBoxes || data.has_fennec_boxes),
            has_fennec_boxes: !!(data.hasFennecBoxes || data.has_fennec_boxes),
            fennecBoxesCount: Math.max(
                0,
                Math.floor(Number(data.fennecBoxesCount ?? data.fennec_boxes_count ?? 0) || 0)
            ),
            fennec_boxes_count: Math.max(
                0,
                Math.floor(Number(data.fennecBoxesCount ?? data.fennec_boxes_count ?? 0) || 0)
            ),
            hasFennecMaxi: hasMaxi,
            badgeCount // Передаем кол-во для UI
        }
    };
}

// Fetch Fennec ID data (v5 - Exact Counts from API)
async function __legacy_fetchAuditData(abortSignal = null, silent = false) {
    let addr = String(userAddress || window.userAddress || '').trim();
    if (!addr) {
        const shouldConnect = confirm('Please connect your wallet first. Would you like to connect now?');
        if (shouldConnect) {
            await window.connectWallet();
            addr = String(userAddress || window.userAddress || '').trim();
            if (!addr) {
                const err = new Error('Wallet connection cancelled');
                err.name = 'WalletConnectionCancelled';
                throw err;
            }
        } else {
            const err = new Error('Connect wallet first');
            err.name = 'WalletConnectionCancelled';
            throw err;
        }
    }
    try {
        if (!silent) console.log('Scanning Fennec ID (v5 - Exact Counts)...', addr);
    } catch (_) {}

    try {
        // ИСПРАВЛЕНИЕ: Проверяем, не отменен ли запрос
        if (abortSignal?.aborted) {
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';
            throw abortError;
        }
        // Call the updated Worker endpoint
        // ИСПРАВЛЕНИЕ: Добавляем pubkey для запросов к InSwap
        const pubkey = userPubkey || '';
        // ИСПРАВЛЕНИЕ: Убрана подпись пользователя - не требуется для API запросов
        const url = pubkey
            ? `${BACKEND_URL}?action=fractal_audit&address=${addr}&pubkey=${pubkey}`
            : `${BACKEND_URL}?action=fractal_audit&address=${addr}`;

        let workerRes = null;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                if (abortSignal?.aborted) {
                    const abortError = new Error('Request aborted');
                    abortError.name = 'AbortError';
                    throw abortError;
                }

                const localController = new AbortController();
                const localTimeoutId = setTimeout(() => {
                    try {
                        localController.abort();
                    } catch (_) {}
                }, 90000);
                try {
                    if (abortSignal) {
                        if (abortSignal.aborted) localController.abort();
                        else abortSignal.addEventListener('abort', () => localController.abort(), { once: true });
                    }
                } catch (_) {}

                const response = await fetch(url, {
                    signal: localController.signal,
                    cache: retryCount > 0 ? 'no-cache' : 'default',
                    headers: {
                        Accept: 'application/json'
                    }
                });
                try {
                    clearTimeout(localTimeoutId);
                } catch (_) {}

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                workerRes = await response.json();

                if (workerRes && typeof workerRes === 'object') {
                    break;
                }

                throw new Error('Invalid response format');
            } catch (e) {
                if (abortSignal?.aborted || e.name === 'AbortError') {
                    const abortError = new Error('Request aborted');
                    abortError.name = 'AbortError';
                    throw abortError;
                }

                console.warn(`Audit fetch attempt ${retryCount + 1} failed:`, e);

                if (retryCount >= maxRetries) {
                    workerRes = null;
                    break;
                }

                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }

        if (workerRes && typeof workerRes === 'object') {
            if (workerRes.error) {
                throw new Error(String(workerRes.error || 'Oracle error'));
            }
            if (workerRes.code !== undefined && Number(workerRes.code) !== 0) {
                throw new Error(String(workerRes.msg || workerRes.message || workerRes.error || 'Oracle error'));
            }
        }

        const apiData =
            workerRes && typeof workerRes === 'object'
                ? workerRes.data && typeof workerRes.data === 'object'
                    ? workerRes.data
                    : workerRes
                : {};

        try {
            const svRaw = apiData && apiData.schema_version;
            if (svRaw !== undefined) {
                const sv = Number(svRaw);
                if (!Number.isFinite(sv)) throw new Error('invalid schema_version');
                if (sv !== 1) throw new Error(`unsupported schema_version: ${sv}`);
            }
        } catch (e) {
            throw new Error('Oracle schema mismatch');
        }

        // ИСПРАВЛЕНИЕ: Сохраняем данные для использования в минте
        window.lastAuditApiData = apiData;

        const fennecWalletFromWorker = parseFloat(apiData.fennec_wallet_balance || 0);
        const fennecInSwapFromWorker = parseFloat(apiData.fennec_inswap_balance || 0);

        // Prices (from Worker, calculated correctly via Pools)
        const prices = apiData.prices || { btc: 98000, fb: 4.5, fennec_in_fb: 0 };

        // Stats
        let utxoCount = apiData.utxo_count || 0;
        let txCount = apiData.tx_count || 0;
        let nativeBalance = apiData.native_balance || 0;

        try {
            const api =
                (window.__fennecApi && typeof window.__fennecApi === 'object' ? window.__fennecApi : null) ||
                (await (window.__fennecApiModulePromise || (window.__fennecApiModulePromise = import('/js/api.js'))));

            if (api && typeof api.getNativeBalance === 'function') {
                const [sat, utxos, st] = await Promise.all([
                    api.getNativeBalance(addr, { signal: abortSignal, timeoutMs: 6500, retries: 1 }).catch(() => 0),
                    api.getUtxos(addr, { signal: abortSignal, timeoutMs: 7000, retries: 1 }).catch(() => []),
                    api.getAddressStats(addr, { signal: abortSignal, timeoutMs: 6500, retries: 1 }).catch(() => null)
                ]);
                const nativeSat = Number(sat || 0) || 0;
                if (nativeSat > 0) {
                    nativeBalance = nativeSat / 100000000;
                }
                if (Array.isArray(utxos)) {
                    utxoCount = utxos.length;
                }
                if (st && typeof st === 'object') {
                    const c = st.chain_stats && typeof st.chain_stats === 'object' ? st.chain_stats : {};
                    const m = st.mempool_stats && typeof st.mempool_stats === 'object' ? st.mempool_stats : {};
                    const t = Number(c.tx_count || 0) + Number(m.tx_count || 0);
                    if (Number.isFinite(t) && t > 0) txCount = t;
                }
            }
        } catch (_) {}

        // Age
        // ИСПРАВЛЕНИЕ: Без fallback - возвращаем ошибку если timestamp невалидный
        let daysAlive = 0; // 0 = ошибка
        const now = Math.floor(Date.now() / 1000);
        const MIN_VALID = 1700000000; // Ноябрь 2023

        // ИСПРАВЛЕНИЕ: НЕ используем fallback - только реальные данные
        let firstTxTs = apiData.first_tx_ts || 0;

        try {
            void abortSignal;
        } catch (_) {}

        // ИСПРАВЛЕНИЕ: Проверяем, не в миллисекундах ли timestamp
        if (firstTxTs > 1000000000000) {
            firstTxTs = Math.floor(firstTxTs / 1000);
            console.log(`Converted timestamp from milliseconds: ${firstTxTs}`);
        }

        if (firstTxTs > 0) {
            // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Строгая валидация - отклоняем timestamp в будущем
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth();
            const currentDay = currentDate.getDate();

            const tsDate = new Date(firstTxTs * 1000);
            const tsYear = tsDate.getFullYear();
            const tsMonth = tsDate.getMonth();
            const tsDay = tsDate.getDate();

            const isFutureYear = tsYear > currentYear;
            const isFutureMonth = tsYear === currentYear && tsMonth > currentMonth;
            const isFutureDay = tsYear === currentYear && tsMonth === currentMonth && tsDay > currentDay;
            const isFuture = isFutureYear || isFutureMonth || isFutureDay || firstTxTs > now;

            if (firstTxTs >= MIN_VALID && firstTxTs <= now && !isFuture) {
                daysAlive = Math.floor((now - firstTxTs) / 86400);
                if (daysAlive < 1) daysAlive = 1;
            } else if (isFuture) {
                // Timestamp в будущем - отклоняем
                console.error(
                    `Rejected future timestamp: ${firstTxTs} (date: ${new Date(firstTxTs * 1000).toISOString()}, year: ${tsYear}, month: ${tsMonth + 1}, day: ${tsDay}). Current: ${currentYear}-${currentMonth + 1}-${currentDay}, now: ${now}, firstTxTs > now: ${firstTxTs > now}`
                );
                firstTxTs = 0;
                daysAlive = 0;
            } else {
                // Timestamp неправильный по другим причинам - возвращаем 0
                console.error(
                    `Invalid first_tx_ts: ${firstTxTs} (date: ${new Date(firstTxTs * 1000).toISOString()}). Valid range: ${MIN_VALID} - ${now}`
                );
                firstTxTs = 0;
                daysAlive = 0;
            }
        } else {
            // Нет timestamp - возвращаем 0
            daysAlive = 0;
        }

        // ИСПРАВЛЕНИЕ: Запрашиваем стейкинг с фронтенда (из браузера), так как API требует подпись
        // Headers для стейкинга (имитация браузера)
        const stakingHeaders = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'x-appid': '1adcd7969603261753f1812c9461cd36',
            'x-front-version': '2125',
            Referer: 'https://fractal.unisat.io/farming',
            Origin: 'https://fractal.unisat.io'
        };

        // ИСПРАВЛЕНИЕ: Убран frontend fetch для staking - вызывает CORS ошибку
        // Используем только данные из worker (stakingData)
        // ИСПРАВЛЕНИЕ: Используем уже загруженные данные из checkBalance() для ускорения
        // Если данные есть в глобальных переменных, используем их, иначе делаем запрос
        let fennecBalRes = null;
        let sFbBalRes = null;

        // Проверяем, есть ли уже загруженные данные (из checkBalance)
        if (userBalances && (userBalances.FENNEC > 0 || walletBalances.FENNEC > 0)) {
            // Используем данные из памяти
            fennecBalRes = {
                data: { balance: { swap: userBalances.FENNEC || 0, available: walletBalances.FENNEC || 0 } }
            };
            console.log('Using cached FENNEC balance:', fennecBalRes);
        } else {
            // Загружаем только если данных нет
            fennecBalRes = {
                data: {
                    balance: {
                        swap: fennecInSwapFromWorker || 0,
                        available: fennecWalletFromWorker || 0
                    }
                }
            };
        }

        if (userBalances && userBalances.sFB > 0) {
            // Используем данные из памяти
            sFbBalRes = {
                data: {
                    balance: {
                        swap: userBalances.sFB || 0,
                        available: userBalances.sFB || 0,
                        total: userBalances.sFB || 0
                    }
                }
            };
            console.log('Using cached sFB balance:', sFbBalRes);
        } else {
            // Загружаем только если данных нет
            const fbInSwapFromWorker = parseFloat(apiData.fb_inswap_balance || apiData.fbInSwapBalance || 0);
            const fbNativeFromWorker = parseFloat(apiData.native_balance || apiData.nativeBalance || 0);
            sFbBalRes = {
                data: {
                    balance: {
                        swap: fbInSwapFromWorker || 0,
                        available: fbInSwapFromWorker || 0,
                        total: fbInSwapFromWorker || 0
                    }
                }
            };
        }

        // Staking берем только из worker (не делаем frontend fetch из-за CORS)
        const stakingRes = null;

        // Расширенная обработка балансов InSwap (проверяем разные форматы ответа)
        let fennecSwapBal = fennecInSwapFromWorker;
        let fennecWalletBal = fennecWalletFromWorker;
        let fbSwapBal = 0;

        // FENNEC баланс
        if (fennecBalRes?.data) {
            const balData = fennecBalRes.data;
            // Вариант 1: { balance: { available: X, swap: Y } }
            if (balData.balance) {
                if (fennecWalletBal === 0) {
                    fennecWalletBal = parseFloat(balData.balance.available || 0);
                }
                if (fennecSwapBal === 0) {
                    fennecSwapBal = parseFloat(balData.balance.swap || balData.balance.total || 0);
                }
            }
            // Вариант 2: { available: X, swap: Y } напрямую
            else if (balData.available !== undefined || balData.swap !== undefined) {
                if (fennecWalletBal === 0) {
                    fennecWalletBal = parseFloat(balData.available || 0);
                }
                if (fennecSwapBal === 0) {
                    fennecSwapBal = parseFloat(balData.swap || 0);
                }
            }
            // Вариант 3: { balance: X } (число напрямую)
            else if (typeof balData.balance === 'number') {
                if (fennecSwapBal === 0) {
                    fennecSwapBal = balData.balance;
                }
            }
        }

        // FB баланс (ИСПРАВЛЕНИЕ: Учитываем и кошелек, и InSwap)
        let fbWalletBal = 0; // Баланс на кошельке
        if (sFbBalRes?.data) {
            const balData = sFbBalRes.data;
            // Вариант 1: { balance: { available: X, swap: Y } }
            if (balData.balance) {
                fbSwapBal = parseFloat(balData.balance.swap || balData.balance.available || balData.balance.total || 0);
                // Баланс на кошельке (не в swap)
                fbWalletBal = parseFloat(balData.balance.available || 0) - fbSwapBal;
                if (fbWalletBal < 0) fbWalletBal = 0;
            }
            // Вариант 2: { available: X, swap: Y } напрямую
            else if (balData.available !== undefined || balData.swap !== undefined) {
                fbSwapBal = parseFloat(balData.swap || 0);
                fbWalletBal = parseFloat(balData.available || 0) - fbSwapBal;
                if (fbWalletBal < 0) fbWalletBal = 0;
            }
            // Вариант 3: { balance: X } (число напрямую)
            else if (typeof balData.balance === 'number') {
                fbSwapBal = balData.balance;
            }
        }

        // Debug логирование (временно)
        console.log('InSwap Balances Debug:', {
            fennecRes: fennecBalRes,
            sFbRes: sFbBalRes,
            fennecSwapBal,
            fbSwapBal
        });

        // ИСПРАВЛЕНИЕ ОТ GEMINI: WEALTH CALCULATION (REAL DATA SUM)
        // Net Worth = Кошелек + InSwap + Стейкинг + LP

        // 1. FENNEC: Кошелек (native) + InSwap (swap)
        // ИСПРАВЛЕНИЕ: fennecSwapBal уже объявлен выше (строка 5199), используем его
        const fennecNativeBal = parseFloat(apiData.fennec_native_balance || 0);
        const fennecTotalBal = fennecNativeBal > 0 ? fennecNativeBal : fennecWalletBal + fennecSwapBal;

        // 2. FB: Кошелек (native) + InSwap (swap) + Staking (native)
        // ИСПРАВЛЕНИЕ: fbSwapBal уже объявлен выше (строка 5200), используем его
        const fbNativeBal = nativeBalance;
        // fbSwapBal уже определен выше из sFbBalRes

        // ИСПРАВЛЕНИЕ: Стейкинг отключен (временно) - убран из расчетов
        const fbStakedBal = 0; // Всегда 0, так как стейкинг отключен

        // --- WEALTH CALCULATION (NO STAKING) ---
        const fbTotalBal = fbNativeBal + fbSwapBal; // Без стейкинга

        // 3. LP (Liquidity Pools) - ИСПРАВЛЕНИЕ: Используем данные из API, если они есть
        const lpValueFB = parseFloat(apiData.lp_value_fb || 0);
        const lpValueUSD = parseFloat(apiData.lp_value_usd || 0);

        // ИСПРАВЛЕНИЕ: Если LP не загрузились из my_pool_list, но есть в all_balance, используем их
        // Это fallback для случаев, когда my_pool_list возвращает null
        if (lpValueFB === 0 && lpValueUSD === 0) {
            // Попытка получить LP из других источников (если есть в debug или других полях)
            // Пока используем значения из API, которые должны быть рассчитаны в worker
            console.warn('LP values are 0, but should be calculated in worker from all_balance or my_pool_list');
        }

        // 4. Расчет в USD
        const fbPrice = prices.fb || 0;

        // FB Value (ВКЛЮЧАЯ LP - LP обязателен в net worth)
        const fbValueUSD = (fbTotalBal + lpValueFB) * fbPrice;

        // ИСПРАВЛЕНИЕ: Цена FENNEC - берем из терминала (poolReserves) если доступна
        let fennecPriceInFB = parseFloat(apiData.prices?.fennec_in_fb || 0);
        if (fennecPriceInFB === 0 && poolReserves && poolReserves.FENNEC > 0 && poolReserves.sFB > 0) {
            // Рассчитываем цену из резервов пула терминала
            fennecPriceInFB = poolReserves.sFB / poolReserves.FENNEC;
            console.log('Using FENNEC price from terminal reserves:', fennecPriceInFB);
        }
        // ИСПРАВЛЕНИЕ: Убран fallback 0.0005 - показываем реальную цену или 0
        // Если цена 0, это означает что данные не загрузились - не используем фейковые значения
        if (fennecPriceInFB === 0) {
            console.warn('FENNEC price is 0 - data not loaded');
        }

        // ИСПРАВЛЕНИЕ: Логика расчета Net Worth согласно требованиям:
        // Net Worth = all_tokens_value_usd + lp_value_usd + токены с кошелька, которых нет в InSwap
        const allTokensValueUSD = parseFloat(apiData.all_tokens_value_usd || 0);
        // ИСПРАВЛЕНИЕ: lpValueUSD уже объявлен выше (строка 6537), используем существующую переменную
        // const lpValueUSD = parseFloat(apiData.lp_value_usd || 0); // УДАЛЕНО: дублирование объявления

        // ИСПРАВЛЕНИЕ: Токены с кошелька, которых нет в InSwap, уже добавлены в worker.js в all_tokens_value_usd
        // Они включены в all_tokens_value_usd, если имеют цену

        // 5. ИТОГ: Net Worth = all_tokens_value_usd + lp_value_usd
        const netWorthUSD = allTokensValueUSD + lpValueUSD;

        console.log('NET WORTH DEBUG:', {
            fbNative: fbNativeBal,
            fbSwap: fbSwapBal,
            fbStaked: fbStakedBal,
            fbTotal: fbTotalBal,
            fbPrice: prices.fb,
            fennecNative: fennecNativeBal,
            fennecSwap: fennecSwapBal,
            fennecTotal: fennecTotalBal,
            fennecPriceInFB: fennecPriceInFB,
            lpValueFB: lpValueFB,
            lpValueUSD: lpValueUSD,
            allTokensValueUSD: allTokensValueUSD, // sBTC, wangcai, FENNEC и т.д. (все токены из InSwap)
            fbValueUSD: fbValueUSD,
            netWorth: netWorthUSD // = fbValueUSD + allTokensValueUSD (FENNEC включен в allTokensValueUSD)
        });

        // Counts (Now EXACT from Worker)
        const runesCount = apiData.runes_count || 0; // Теперь это точное число UTXO (1465)
        const brc20Count = apiData.brc20_count || 0;
        const ordinalsCount = apiData.ordinals_count || 0;
        const totalInscriptionsCount =
            Number(
                apiData.total_inscriptions_count ??
                    apiData.totalInscriptionsCount ??
                    apiData.total_inscriptions ??
                    apiData.totalInscriptions ??
                    0
            ) || 0;
        const ordinalsByCollection =
            apiData.collection_inscriptions_by_collection || apiData.collectionInscriptionsByCollection || null;
        const totalCollectionsRaw =
            apiData.total_collections ??
            apiData.totalCollections ??
            apiData.collections_count ??
            apiData.collectionsCount ??
            (apiData.stats && (apiData.stats.totalCollections ?? apiData.stats.total_collections));
        const totalCollections = Number.isFinite(Number(totalCollectionsRaw)) ? Number(totalCollectionsRaw) : undefined;
        const lpCount = apiData.lp_count || 0;

        // ИСПРАВЛЕНИЕ: BRC-20 count - учитываем и InSwap балансы
        // Если есть BRC-20 токены в InSwap, которые не учтены в brc20Count, добавляем их
        const brc20CountFinal = brc20Count;
        // Проверяем есть ли BRC-20 токены в InSwap балансах (через all_balance или отдельные запросы)
        // Пока используем brc20Count из API, но можно расширить логику

        // ИСПРАВЛЕНИЕ: Убеждаемся, что значения - числа
        const finalRunesCount = Number(runesCount) || 0;
        const finalBrc20Count = Number(brc20CountFinal) || 0;

        // Debug logging
        console.log(
            `Stats preparation: runesCount=${runesCount} (final=${finalRunesCount}), brc20Count=${brc20Count} (final=${finalBrc20Count})`
        );

        // Формируем данные для передачи
        const auditInput = {
            address: addr,
            nativeBalance: nativeBalance,
            fennecBalance: fennecTotalBal.toFixed(2),
            fennec_native_balance: fennecNativeBal, // ИСПРАВЛЕНИЕ: Добавляем нативный баланс FENNEC
            fennec_wallet_balance: fennecWalletBal,
            fennec_inswap_balance: fennecSwapBal,
            fbSwapBalance: fbSwapBal,
            stakedFB: fbStakedBal, // Стейкинг
            lpValueFB: lpValueFB, // LP в FB
            lpValueUSD: lpValueUSD, // ИСПРАВЛЕНИЕ: LP в долларах
            inswapValueUSD: allTokensValueUSD,
            netWorth: netWorthUSD,
            utxoCount,
            txCount,
            first_tx_ts: firstTxTs || apiData.first_tx_ts || 0, // ИСПРАВЛЕНИЕ: Используем исправленный timestamp
            abandoned_utxo_count: Number.isFinite(Number(apiData.abandoned_utxo_count))
                ? Number(apiData.abandoned_utxo_count)
                : 0,
            abandoned_utxo_count_missing:
                typeof apiData.abandoned_utxo_count_missing === 'boolean'
                    ? apiData.abandoned_utxo_count_missing
                    : !Number.isFinite(Number(apiData.abandoned_utxo_count)),
            has_fennec_in_lp: apiData.has_fennec_in_lp || false, // ИСПРАВЛЕНИЕ: Передаем флаг наличия LP с FENNEC
            fennec_lp_value_usd: apiData.fennec_lp_value_usd || 0,
            hasFennecBoxes: !!(apiData.hasFennecBoxes || apiData.has_fennec_boxes),
            has_fennec_boxes: !!(apiData.hasFennecBoxes || apiData.has_fennec_boxes),
            fennecBoxesCount: Math.max(
                0,
                Math.floor(Number(apiData.fennecBoxesCount ?? apiData.fennec_boxes_count ?? 0) || 0)
            ),
            fennec_boxes_count: Math.max(
                0,
                Math.floor(Number(apiData.fennecBoxesCount ?? apiData.fennec_boxes_count ?? 0) || 0)
            ),
            stats: {
                total: finalRunesCount + finalBrc20Count + totalInscriptionsCount,
                runes: finalRunesCount,
                brc20: finalBrc20Count,
                ordinals: ordinalsCount,
                totalCollections: totalCollections,
                lp: lpCount
            },
            total_inscriptions_count: totalInscriptionsCount,
            collection_inscriptions_by_collection: ordinalsByCollection,
            prices: {
                ...prices,
                fennec_in_fb: fennecPriceInFB // ИСПРАВЛЕНИЕ: Используем цену из терминала
            }
        };

        // Debug logging для проверки передачи
        console.log('auditInput.stats:', JSON.stringify(auditInput.stats));
        console.log(
            'FENNEC price:',
            fennecPriceInFB,
            `(from terminal: ${poolReserves && poolReserves.FENNEC > 0 ? 'yes' : 'no'})`
        );

        return auditInput;
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log('Audit fetch aborted');
            throw e; // пробрасываем, чтобы window.runAudit корректно обработал отмену
        }
        console.error('Audit Fatal:', e);
        throw e;
    }
}

// fetchAuditData is now imported as module

// Initialize Audit UI
window.initAuditLoading = false;
async function __legacy_initAudit() {
    const container = document.getElementById('auditContainer');
    if (!container) return;

    // ПРИНУДИТЕЛЬНАЯ ОЧИСТКА при смене кошелька или любом вызове
    const addrNow = String(window.userAddress || userAddress || '').trim();
    if (window.initAuditLoading) return;
    try {
        const uiModeNow = String((window.__fennecAuditUi && window.__fennecAuditUi.mode) || 'idle');
        if (window.auditLoading && uiModeNow !== 'opening' && uiModeNow !== 'scanning') return;
    } catch (_) {
        if (window.auditLoading) return;
    }
    const prevAddr = String(window.__auditUiAddr || '').trim();

    try {
        window.__fennecAuditUi =
            window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object'
                ? window.__fennecAuditUi
                : { addr: '', mode: 'idle', openedAt: 0, scannedAt: 0 };
        const keepMode = (() => {
            const m = String(window.__fennecAuditUi.mode || 'idle');
            return m === 'scanning' || m === 'opening';
        })();
        if (!addrNow) {
            window.__fennecAuditUi.addr = '';
            if (!keepMode) window.__fennecAuditUi.mode = 'idle';
            if (!keepMode) window.__fennecAuditUi.openedAt = 0;
            if (!keepMode) window.__fennecAuditUi.scannedAt = 0;
        } else if (String(window.__fennecAuditUi.addr || '').trim() !== addrNow) {
            window.__fennecAuditUi.addr = addrNow;
            window.__fennecAuditUi.mode = 'idle';
            window.__fennecAuditUi.openedAt = 0;
            window.__fennecAuditUi.scannedAt = 0;
        }
    } catch (_) {}

    // Если адрес изменился - всегда очищаем и сбрасываем window.auditIdentity
    if (addrNow !== prevAddr) {
        console.log('Wallet changed, clearing audit state');
        try {
            const idAddr = String(window.auditIdentity?.metrics?.address || '').trim();
            if (!(idAddr && addrNow && idAddr === addrNow)) {
                window.auditIdentity = null;
            }
        } catch (_) {
            window.auditIdentity = null;
        }
    } else {
        // Даже если адрес тот же, очищаем legacy сцены
        const hasLegacyScene = !!container.querySelector('.card-scene');
        if (hasLegacyScene) {
            console.log('Clearing legacy scene');
        } else if (container.querySelector('#fennecIdIframe')) {
            console.log('Audit UI already present, skipping window.initAudit');
            try {
                if (typeof window.__syncFennecIdButtonsUI === 'function') window.__syncFennecIdButtonsUI();
            } catch (_) {}
            return;
        }
    }
    window.__auditUiAddr = addrNow;

    window.initAuditLoading = true;

    try {
        let currentAddr = window.userAddress || userAddress || null;
        if (currentAddr && typeof window.refreshFennecIdStatus === 'function') {
            if (window.__fennecAuditUi.mode === 'opening' || window.__fennecAuditUi.mode === 'scanning') {
                try {
                    window.refreshFennecIdStatus(false);
                } catch (_) {}
            } else {
                try {
                    await Promise.race([
                        window.refreshFennecIdStatus(false),
                        new Promise(resolve => setTimeout(() => resolve(null), 650))
                    ]);
                } catch (_) {}
            }
        }
        currentAddr = window.userAddress || userAddress || null;
        const existingId = String((window.__fennecIdStatus && window.__fennecIdStatus.inscriptionId) || '').trim();
        const existingCard = !!(existingId && window.__fennecIdStatus && window.__fennecIdStatus.hasId);

        const previewOk = (() => {
            try {
                if (!window.auditIdentity || typeof window.auditIdentity !== 'object') return false;
                if (!currentAddr) return false;
                const a1 = String(currentAddr || '').trim();
                const a2 = String(window.auditIdentity?.metrics?.address || '').trim();
                return !!(a1 && a2 && a1 === a2);
            } catch (_) {
                return false;
            }
        })();

        const getLastMintedCardForAddress = addr => {
            try {
                const a = String(addr || '').trim();
                if (!a) return null;
                const all = JSON.parse(localStorage.getItem(fennecMintedCardsKey()) || '[]');
                if (!Array.isArray(all) || all.length === 0) return null;
                const filtered = all
                    .filter(x => x && typeof x === 'object' && String(x.address || '').trim() === a)
                    .sort((x, y) => (Number(y.timestamp || 0) || 0) - (Number(x.timestamp || 0) || 0));
                return filtered[0] || null;
            } catch (_) {
                return null;
            }
        };

        const lastMint = currentAddr ? getLastMintedCardForAddress(currentAddr) : null;
        window.__lastMintedCard = lastMint;

        const ui =
            window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object'
                ? window.__fennecAuditUi
                : { addr: '', mode: 'idle', openedAt: 0, scannedAt: 0 };
        const uiMode = String(ui.mode || 'idle');
        const canRenderScanned = uiMode === 'scanned' && previewOk;
        const hasWallet = !!String(currentAddr || '').trim();

        try {
            if (uiMode !== 'scanning' && window.__scanProgressInterval) {
                clearInterval(window.__scanProgressInterval);
                window.__scanProgressInterval = null;
            }
        } catch (_) {}

        try {
            if (uiMode !== 'opening' && window.__openProgressInterval) {
                clearInterval(window.__openProgressInterval);
                window.__openProgressInterval = null;
            }
        } catch (_) {}

        if (uiMode === 'opening' && !existingCard) {
            try {
                if (
                    existingCard &&
                    (container.querySelector('#fennecIdIframeContainer') ||
                        container.querySelector('#fennecIdLoadingRoot'))
                ) {
                    return;
                }
            } catch (_) {}
            container.innerHTML = `
                                            <div class="w-full flex items-start justify-center" style="min-height: 560px;">
                                                <div class="flex flex-col items-center justify-center" style="max-width: 360px; width: 100%; padding: 0px 20px; gap: 32px;">
                                                    <div style="position: relative; width: 300px; height: 420px; overflow: hidden; border-radius: 24px; border: 4px solid rgba(255,160,0,0.45); box-shadow: inset 0 0 40px rgba(255,160,0,0.15), 0 0 60px rgba(255,160,0,0.18); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6);">
                                                        <img src="/img/FENNECID.png" style="width: 110%; height: 110%; object-fit: cover; object-position: center; filter: drop-shadow(0 0 40px rgba(255,160,0,0.35));" onerror="this.style.display='none';" />
                                                        <div style="position: absolute; top: 0; left: -25%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent 0%, rgba(255,160,0,0) 20%, rgba(255,160,0,0.18) 35%, rgba(255,160,0,0.95) 50%, rgba(255,160,0,0.18) 65%, rgba(255,160,0,0) 80%, transparent 100%); animation: openSweep 2.5s ease-in-out infinite;"></div>
                                                    </div>
                                                    <div style="width: 100%; max-width: 320px;">
                                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 12px;">
                                                            <div style="font-size: 11px; letter-spacing: 0.2em; color: #ffa030; font-weight: 900; text-transform: uppercase; text-align: center;">OPENING ID</div>
                                                        </div>
                                                        <div style="position: relative; width: 100%; height: 8px; background: rgba(0,0,0,0.5); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,160,0,0.30);">
                                                            <div id="openProgress" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: linear-gradient(90deg, #ffa030, #ffd070); border-radius: 999px; transition: width 0.3s ease-out;"></div>
                                                        </div>
                                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                                            <div id="openMessage" style="font-size: 9px; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); font-weight: 600;">Fetching inscription...</div>
                                                            <div id="openPercent" style="font-size: 10px; font-weight: 900; color: #ffa030;">0%</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <style>
                                                @keyframes openSweep {
                                                    0% { left: -25%; opacity: 0; }
                                                    12% { opacity: 1; }
                                                    88% { opacity: 1; }
                                                    100% { left: 110%; opacity: 0; }
                                                }
                                            </style>
                                        `;
            try {
                if (window.__openProgressInterval) {
                    clearInterval(window.__openProgressInterval);
                    window.__openProgressInterval = null;
                }

                const messages = [
                    'Fetching inscription...',
                    'Patching embedded lib...',
                    'Rendering ID frame...',
                    'Finalizing...'
                ];

                let progress = 0;
                let msgIndex = 0;
                const progressBar = document.getElementById('openProgress');
                const progressPercent = document.getElementById('openPercent');
                const progressMessage = document.getElementById('openMessage');

                window.__openProgressInterval = setInterval(() => {
                    progress = Math.min(95, progress + Math.random() * 3 + 1);
                    if (progressBar) progressBar.style.width = progress + '%';
                    if (progressPercent) progressPercent.textContent = Math.floor(progress) + '%';
                    if (progress >= (msgIndex + 1) * (95 / messages.length) && msgIndex < messages.length - 1) {
                        msgIndex++;
                        if (progressMessage) progressMessage.textContent = messages[msgIndex];
                    }
                }, 300);
            } catch (_) {}
            return;
        }

        if (uiMode === 'scanning') {
            try {
                if (container.querySelector('#scanProgress') && container.querySelector('#scanPercent')) {
                    return;
                }
            } catch (_) {}
            container.innerHTML = `
                                            <div class="w-full flex items-start justify-center" style="min-height: 560px;">
                                                <div class="flex flex-col items-center justify-center" style="max-width: 360px; width: 100%; padding: 0px 20px; gap: 32px;">
                                                    <div style="position: relative; width: 300px; height: 420px; overflow: hidden; border-radius: 24px; border: 4px solid rgba(255,107,53,0.35); box-shadow: inset 0 0 40px rgba(255,107,53,0.15), 0 0 60px rgba(255,107,53,0.25); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6);">
                                                        <img src="/img/FENNECID.png" style="width: 110%; height: 110%; object-fit: cover; object-position: center; filter: drop-shadow(0 0 40px rgba(255,107,53,0.4));" onerror="this.style.display='none';" />
                                                        <div id="scanSweep" style="position: absolute; top: 0; left: -25%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent 0%, rgba(255,107,53,0) 20%, rgba(255,107,53,0.18) 35%, rgba(255,107,53,0.92) 50%, rgba(255,107,53,0.18) 65%, rgba(255,107,53,0) 80%, transparent 100%); animation: scanSweep 2.5s ease-in-out infinite;"></div>
                                                    </div>
                                                    <div style="width: 100%; max-width: 320px;">
                                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 12px;">
                                                            <div style="font-size: 11px; letter-spacing: 0.2em; color: #ff6b35; font-weight: 900; text-transform: uppercase; text-align: center;">SCANNING IDENTITY</div>
                                                        </div>
                                                        <div style="position: relative; width: 100%; height: 8px; background: rgba(0,0,0,0.5); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,107,53,0.3);">
                                                            <div id="scanProgress" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: linear-gradient(90deg, #ff6b35, #ff8c35); border-radius: 999px; transition: width 0.3s ease-out;"></div>
                                                        </div>
                                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                                            <div id="scanMessage" style="font-size: 9px; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); font-weight: 600;">Connecting to the oasis...</div>
                                                            <div id="scanPercent" style="font-size: 10px; font-weight: 900; color: #ff6b35;">0%</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <style>
                                                @keyframes scanSweep {
                                                    0% { left: -25%; opacity: 0; }
                                                    12% { opacity: 1; }
                                                    88% { opacity: 1; }
                                                    100% { left: 110%; opacity: 0; }
                                                }
                                            </style>
                                        `;
            return;
        }

        console.log(
            'Rendering UI, existingCard:',
            !!existingCard,
            'uiMode:',
            uiMode,
            'canRenderScanned:',
            canRenderScanned
        );

        if (existingCard) {
            const opened = uiMode === 'opened' && String(ui.addr || '').trim() === String(currentAddr || '').trim();
            container.innerHTML = `
                                                                                    <div class="w-full max-w-5xl">
                                                                                        <div class="text-center">
                                                                                            <div class="w-full flex justify-center mb-1">
                                                                                                <div id="fennecIdIframeContainer" class="relative" style="width:360px;height:520px;min-width:360px;min-height:520px;background:transparent;border-radius:32px;overflow:visible;">
                                                                                                    <div id="fennecIdIframeSlot" class="absolute inset-0 z-0">
                                                                                                        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                                                                                                            <div style="position: relative; width: 300px; height: 420px; overflow: hidden; border-radius: 24px; border: 4px solid rgba(255,107,53,0.35); box-shadow: inset 0 0 40px rgba(255,107,53,0.15), 0 0 60px rgba(255,107,53,0.25); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6);">
                                                                                                                <img src="/img/FENNECID.png" style="width: 110%; height: 110%; object-fit: cover; object-position: center; filter: drop-shadow(0 0 40px rgba(255,107,53,0.35));" onerror="this.style.display='none';" />
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div id="fennecIdLoadingRoot" class="absolute inset-0 z-10 pointer-events-none"></div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div class="flex flex-col gap-3 w-full max-w-md mx-auto" style="margin-top: 32px;">
                                                                                                <button onclick="window.openFennecIdInternal(event)" id="fidOpenBtn" style="${opened ? 'display:none;' : ''};backdrop-filter: blur(10px);"
                                                                                                    class="px-6 py-4 bg-fennec/15 border border-fennec rounded-lg text-white font-bold shadow-[inset_0_0_15px_rgba(255,107,53,0.3)] hover:bg-fennec/25 hover:border-orange-300 hover:shadow-[inset_0_0_20px_rgba(255,107,53,0.4)] hover:scale-[1.02] transition-all text-base uppercase tracking-widest">
                                                                                                    <span id="fidOpenBtnText">OPEN ID</span>
                                                                                                </button>
                                                                                                <div id="fidActionButtons" style="${opened ? '' : 'display:none;'}" class="flex gap-2 justify-center">
                                                                                                    <button onclick="window.burnAndRemintAuditCard(event)" id="fidUpdateBtn"
                                                                                                        class="flex-1 px-4 py-3 bg-fennec/15 border border-fennec rounded-lg text-white font-bold shadow-[inset_0_0_15px_rgba(255,107,53,0.3)] hover:bg-fennec/25 hover:border-orange-300 hover:shadow-[inset_0_0_20px_rgba(255,107,53,0.4)] hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-widest"
                                                                                                        style="backdrop-filter: blur(10px);">
                                                                                                        <span id="fidUpdateBtnText">UPDATE</span>
                                                                                                    </button>
                                                                                                    <button onclick="window.refreshCardMetadata(event)" id="fidRefreshBtn"
                                                                                                        class="flex-1 px-4 py-3 bg-cyan-500/15 border border-cyan-400 rounded-lg text-white font-bold shadow-[inset_0_0_15px_rgba(6,182,212,0.3)] hover:bg-cyan-500/25 hover:border-cyan-300 hover:shadow-[inset_0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-widest"
                                                                                                        style="backdrop-filter: blur(10px);">
                                                                                                        <span id="fidRefreshBtnText">REFRESH</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                                <button id="fidShareBtn" onclick="shareIdentityOnX()" style="display:none;" class="share-x-btn mt-3 w-full max-w-md mx-auto px-6 py-4 bg-fennec/15 border border-fennec/50 rounded-xl text-white font-black shadow-[inset_0_0_18px_rgba(255,107,53,0.22),0_0_28px_rgba(255,107,53,0.10)] hover:bg-fennec/20 hover:border-orange-300 hover:shadow-[inset_0_0_22px_rgba(255,107,53,0.30),0_0_36px_rgba(255,107,53,0.16)] hover:scale-[1.01] transition-all flex items-center justify-center gap-3">
                                                                                                    <i class="fab fa-x-twitter text-xl" style="color:#ffffff;opacity:0.95"></i>
                                                                                                    <span class="tracking-widest text-xs">SHARE ON X</span>
                                                                                                </button>
                                                                                            </div>
                                                                                            <div id="fennecIdEmbedStatus" class="text-[10px] text-gray-500 mt-2"></div>
                                                                                        </div>
                                                                                    </div>
                                                                                `;

            try {
                if (typeof window.__syncFennecIdButtonsUI === 'function') window.__syncFennecIdButtonsUI();
            } catch (_) {}

            if (opened && existingId) {
                setTimeout(() => {
                    try {
                        if (document.getElementById('fennecIdIframe')) {
                            if (typeof window.__syncFennecIdButtonsUI === 'function') window.__syncFennecIdButtonsUI();
                            return;
                        }
                    } catch (_) {}

                    try {
                        window.__fennecAutoOpenInFlight = window.__fennecAutoOpenInFlight || {};
                        const key = String(existingId);
                        const last = Number(window.__fennecAutoOpenInFlight[key] || 0) || 0;
                        const now = Date.now();
                        if (now - last < 2500) return;
                        window.__fennecAutoOpenInFlight[key] = now;
                    } catch (_) {}

                    Promise.resolve(loadExistingCardIntoIframe(existingId))
                        .then(() => {
                            try {
                                if (typeof window.__syncFennecIdButtonsUI === 'function')
                                    window.__syncFennecIdButtonsUI();
                            } catch (_) {}
                        })
                        .catch(() => null);

                    setTimeout(() => {
                        try {
                            if (document.getElementById('fennecIdIframe')) return;
                            const openBtn = document.getElementById('fidOpenBtn');
                            const wrap = document.getElementById('fidActionButtons');
                            if (openBtn) openBtn.style.display = '';
                            if (wrap) wrap.style.display = 'none';
                        } catch (_) {}
                    }, 2200);
                }, 0);
            }
        } else if (canRenderScanned) {
            container.innerHTML = `
                                                                                    <div class="w-full max-w-5xl">
                                                                                        <div class="text-center">
                                                                                            <div class="w-full flex justify-center mb-1">
                                                                                                <div id="fennecIdIframeContainer" class="relative" style="width:360px;height:520px;min-width:360px;min-height:520px;background:transparent;border-radius:32px;overflow:visible;">
                                                                                                    <div id="fennecIdIframeSlot" class="absolute inset-0 z-0">
                                                                                                        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                                                                                                            <div style="position: relative; width: 300px; height: 420px; overflow: hidden; border-radius: 24px; border: 4px solid rgba(255,107,53,0.22); box-shadow: inset 0 0 40px rgba(255,107,53,0.10), 0 0 60px rgba(255,107,53,0.14); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.55);">
                                                                                                                <img src="/img/FENNECID.png" style="width: 110%; height: 110%; object-fit: cover; object-position: center; filter: drop-shadow(0 0 40px rgba(255,107,53,0.25));" onerror="this.style.display='none';" />
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div id="fennecIdLoadingRoot" class="absolute inset-0 z-10 pointer-events-none"></div>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div id="discountWhy" class="text-[11px] text-gray-500 mb-4"></div>

                                                                                            <div class="flex flex-col gap-3 w-full max-w-md mx-auto" style="margin-top: 32px;">
                                                                                                <button onclick="mintAuditCard(event)" id="mintBtn"
                                                                                                    class="px-6 py-4 bg-fennec/15 border border-fennec rounded-lg text-white font-bold shadow-[inset_0_0_15px_rgba(255,107,53,0.3)] hover:bg-fennec/25 hover:border-orange-300 hover:shadow-[inset_0_0_20px_rgba(255,107,53,0.4)] hover:scale-[1.02] transition-all duration-200 text-base uppercase tracking-widest"
                                                                                                    style="backdrop-filter: blur(10px);">
                                                                                                    <span id="mintBtnText">MINT ID • 1 FB</span>
                                                                                                </button>
                                                                                                <div class="flex gap-2 justify-center">
                                                                                                    <button onclick="window.checkDiscountEligibility()" id="discountBtn"
                                                                                                        class="flex-1 px-4 py-3 bg-fennec/15 border border-fennec rounded-lg text-white font-bold shadow-[inset_0_0_15px_rgba(255,107,53,0.3)] hover:bg-fennec/25 hover:border-orange-300 hover:shadow-[inset_0_0_20px_rgba(255,107,53,0.4)] hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-widest"
                                                                                                        style="backdrop-filter: blur(10px);">
                                                                                                        CHECK DISCOUNT
                                                                                                    </button>
                                                                                                    <button onclick="window.refreshScannedIdentity(event)" id="scanRefreshBtn"
                                                                                                        class="flex-1 px-4 py-3 bg-cyan-500/15 border border-cyan-400 rounded-lg text-white font-bold shadow-[inset_0_0_15px_rgba(6,182,212,0.3)] hover:bg-cyan-500/25 hover:border-cyan-300 hover:shadow-[inset_0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-widest"
                                                                                                        style="backdrop-filter: blur(10px);">
                                                                                                        REFRESH
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                `;

            try {
                await loadPreviewCardIntoIframe(window.auditIdentity);
            } catch (_) {}
        } else {
            container.innerHTML = `
                                                                                    <div class="w-full max-w-5xl">
                                                                                        <div class="text-center">
                                                                                            <div class="w-full flex justify-center mb-2">
                                                                                                <div id="fennecIdIframeContainer" class="relative" style="width:360px;height:520px;min-width:360px;min-height:520px;background:transparent;border-radius:32px;overflow:visible;">
                                                                                                    <div id="fennecIdIframeSlot" class="absolute inset-0 z-0">
                                                                                                        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                                                                                                            <div style="position: relative; width: 300px; height: 420px; overflow: hidden; border-radius: 24px; border: 4px solid rgba(255,107,53,0.35); box-shadow: inset 0 0 40px rgba(255,107,53,0.15), 0 0 60px rgba(255,107,53,0.25); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6);">
                                                                                                                <img src="/img/FENNECID.png" style="width: 110%; height: 110%; object-fit: cover; object-position: center; filter: drop-shadow(0 0 40px rgba(255,107,53,0.30));" onerror="this.style.display='none';" />
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div id="fennecIdLoadingRoot" class="absolute inset-0 z-10 pointer-events-none"></div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div class="flex flex-col gap-3 w-full max-w-md mx-auto" style="margin-top: 32px;">
                                                                                                <button onclick="${hasWallet ? 'window.runAudit();' : 'window.connectWallet();'}" id="getYourIdBtn"
                                                                                                    class="px-6 py-4 bg-fennec/15 border border-fennec rounded-lg text-white font-bold shadow-[inset_0_0_15px_rgba(255,107,53,0.3)] hover:bg-fennec/25 hover:border-orange-300 hover:shadow-[inset_0_0_20px_rgba(255,107,53,0.4)] hover:scale-[1.02] transition-all text-base uppercase tracking-widest flex items-center justify-center"
                                                                                                    style="backdrop-filter: blur(10px);">
                                                                                                    <span id="getYourIdBtnText">${hasWallet ? 'SCAN ID' : 'CONNECT WALLET'}</span>
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                `;
        }

        if (currentAddr && typeof window.prefetchFennecAudit === 'function') {
            setTimeout(() => {
                try {
                    window.prefetchFennecAudit(false);
                } catch (_) {}
            }, 0);
        }
    } finally {
        window.initAuditLoading = false;
    }
}

// initAudit is now imported as module

// Helper functions for child HTML processing - MUST be defined BEFORE usage
const parseDnaFromChildHtml = html => {
    try {
        const s = String(html || '');
        if (!s) return null;
        const mk = id =>
            '<scrip' +
            't[^>]*id=["\\\']' +
            String(id || '').replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') +
            '["\\\'][^>]*>([\\s\\S]*?)<\\/scrip' +
            't>';
        const tryId = id => {
            const m = s.match(new RegExp(mk(id), 'i'));
            if (!m || !m[1]) return null;
            const raw = String(m[1] || '').trim();
            if (!raw) return null;
            return JSON.parse(raw);
        };
        return tryId('dna-data') || tryId('user-data');
    } catch (_) {
        return null;
    }
};

const readMetaFromHtml = (html, name) => {
    try {
        const s = String(html || '');
        const n = String(name || '').trim();
        if (!s || !n) return '';
        const re = new RegExp(
            '<meta[^>]*\\bname=["\\\']' + n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '["\\\'][^>]*>',
            'i'
        );
        const m = s.match(re);
        const tag = m && m[0] ? String(m[0]) : '';
        if (!tag) return '';
        const cm = tag.match(/\\bcontent=["\\']([^"\\']*)["\\']/i);
        return cm && cm[1] ? String(cm[1]).trim() : '';
    } catch (_) {
        return '';
    }
};

async function resolveLatestRefsFromManifest(manifestRef) {
    try {
        const ref = String(manifestRef || '').trim();
        if (!ref || ref === 'inline') return { libRef: '', configRef: '' };

        const isId = /^[a-f0-9]{64}i\d+$/i.test(ref);
        let json = null;
        if (isId) {
            const apiUrl = `${BACKEND_URL}?action=inscription_content&inscriptionId=${encodeURIComponent(ref)}`;
            const j = await safeFetchJson(apiUrl, { timeoutMs: 4500, retries: 0 });
            const data = j && typeof j === 'object' ? j.data || null : null;
            const body = String(data?.body || data?.contentBody || data?.content_body || '').trim();
            if (body) {
                try {
                    json = JSON.parse(body);
                } catch (_) {
                    json = null;
                }
            }
        }

        if (!json) {
            const url = ref.startsWith('/recursive_inscriptions/')
                ? ref
                : ref.startsWith('/content/')
                  ? `https://uniscan.cc/fractal${ref}`
                  : ref.startsWith('/fractal/content/')
                    ? `https://uniscan.cc${ref}`
                    : isId
                      ? `https://uniscan.cc/fractal/content/${ref}`
                      : ref;

            json = await safeFetchJson(url, { timeoutMs: 4500, retries: 0 });
        }

        if (!json || typeof json !== 'object') return { libRef: '', configRef: '' };
        const latest = json.latest && typeof json.latest === 'object' ? json.latest : json;

        const libRef = String(
            latest.lib || latest.libId || latest.library || latest.libraryId || latest.fennecLib || ''
        ).trim();
        const configRef = String(
            latest.config ||
                latest.configId ||
                latest.configuration ||
                latest.configurationId ||
                latest.fennecConfig ||
                ''
        ).trim();

        return { libRef, configRef };
    } catch (_) {
        return { libRef: '', configRef: '' };
    }
}

function patchChildHtmlForEmbed(html, opts) {
    try {
        const s = String(html || '');
        const parsed = typeof parseDnaFromChildHtml === 'function' ? parseDnaFromChildHtml(s) : null;
        const dna = parsed && typeof parsed === 'object' ? parsed : null;

        const o = opts && typeof opts === 'object' ? opts : {};
        const readMeta = name => {
            try {
                const n = String(name || '').trim();
                if (!n) return '';
                const re = new RegExp(
                    '<meta[^>]*\\bname=["\\\']' + n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '["\\\'][^>]*>',
                    'i'
                );
                const m = s.match(re);
                const tag = m && m[0] ? String(m[0]) : '';
                if (!tag) return '';
                const cm = tag.match(/\\bcontent=["\\']([^"\\']*)["\\']/i);
                return cm && cm[1] ? String(cm[1]).trim() : '';
            } catch (_) {
                return '';
            }
        };

        if (dna && typeof generateRecursiveChildHTML === 'function') {
            return generateRecursiveChildHTML(dna, {
                ...o,
                libRef: String(o.libRef || readMeta('fennec-lib') || '').trim(),
                configRef: String(o.configRef || readMeta('fennec-config') || '').trim(),
                manifestRef: String(o.manifestRef || readMeta('fennec-manifest') || '').trim(),
                parentRef: String(o.parentRef || readMeta('fennec-parent') || '').trim()
            });
        }
    } catch (e) {
        console.warn('Failed to patch child HTML:', e);
    }
    try {
        const s2 = String(html || '');
        const cb = (() => {
            try {
                const ep = String((opts && opts.oracleEndpoint) || BACKEND_URL || '').trim();
                if (!ep) return '';
                if (ep.indexOf('http://') === 0 || ep.indexOf('https://') === 0) {
                    return ep.replace(/\/+$/, '') + '/content';
                }
                if (ep.indexOf('/') === 0) {
                    return /\/content\/?$/i.test(ep) ? ep.replace(/\/+$/, '') : ep.replace(/\/+$/, '') + '/content';
                }
            } catch (_) {}
            return '';
        })();
        if (cb) {
            return s2.replace(/(https?:\/\/[^"'\s>]*?pages\.dev\/)([a-f0-9]{64}i\d+)/gi, function (_m, _p1, _id) {
                return cb.replace(/\/+$/, '') + '/' + String(_id);
            });
        }
        return s2;
    } catch (_) {
        return html || '';
    }
}

function generateRecursiveChildHTML(identity, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const coreRefs =
        window.getFennecCoreRefs && typeof window.getFennecCoreRefs === 'function'
            ? window.getFennecCoreRefs('embed')
            : null;
    const libRef = String(
        o.libRef ||
            (coreRefs && coreRefs.libRef) ||
            PRIMARY_CHILD_LIB ||
            localStorage.getItem('fennec_mint_child_lib') ||
            ''
    ).trim();
    const configRef = String(
        o.configRef ||
            (coreRefs && coreRefs.configRef) ||
            PRIMARY_CHILD_CONFIG ||
            localStorage.getItem('fennec_mint_child_config') ||
            ''
    ).trim();
    const manifestRef = String(
        o.manifestRef ||
            (coreRefs && coreRefs.manifestRef) ||
            PRIMARY_MANIFEST_REF ||
            DEFAULT_MANIFEST_URL ||
            localStorage.getItem('fennec_mint_child_manifest') ||
            ''
    ).trim();
    const parentRef = String(o.parentRef || '').trim();
    const oracleEndpoint = String(o.oracleEndpoint || BACKEND_URL || '').trim();
    const oracleAction = String(o.oracleAction || 'fractal_audit').trim();
    const pubkey = String(o.pubkey || userPubkey || '').trim();

    const contentBase = (() => {
        try {
            const ep = String(oracleEndpoint || '').trim();
            if (!ep) return '';
            if (ep.indexOf('http://') === 0 || ep.indexOf('https://') === 0) {
                return ep.replace(/\/+$/, '') + '/content';
            }
            if (ep.indexOf('/') === 0) {
                return /\/content\/?$/i.test(ep) ? ep.replace(/\/+$/, '') : ep.replace(/\/+$/, '') + '/content';
            }
        } catch (_) {}
        return 'https://uniscan.cc/fractal/content';
    })();

    if (!libRef && !manifestRef) {
        throw new Error('Missing mint ref: provide fennec-lib (or fennec-manifest)');
    }
    if (!configRef && !manifestRef) {
        throw new Error('Missing fennec-config (or fennec-manifest)');
    }

    const dna = identity && typeof identity === 'object' ? identity : {};
    const dnaJson = JSON.stringify(dna).replace(/</g, '\\u003c');
    const closeScriptTag = '</scr' + 'ipt>';

    const metaManifest = manifestRef
        ? `<meta name="fennec-manifest" content="${manifestRef.replace(/"/g, '&quot;')}" />`
        : '';
    const metaParent = parentRef ? `<meta name="fennec-parent" content="${parentRef.replace(/"/g, '&quot;')}" />` : '';
    const metaOracleEndpoint = oracleEndpoint
        ? `<meta name="fennec-oracle-endpoint" content="${oracleEndpoint.replace(/"/g, '&quot;')}" />`
        : '';
    const metaOracleAction = oracleAction
        ? `<meta name="fennec-oracle-action" content="${oracleAction.replace(/"/g, '&quot;')}" />`
        : '';
    const metaPubkey = pubkey ? `<meta name="fennec-pubkey" content="${pubkey.replace(/"/g, '&quot;')}" />` : '';

    return `<!doctype html>
                                                        <html lang="en">
                                                        <head>
                                                        <meta charset="UTF-8"/>
                                                        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
                                                        <meta name="fennec-content-base" content="${contentBase.replace(/"/g, '&quot;')}"/>
                                                        <meta name="fennec-lib" content="${libRef.replace(/"/g, '&quot;')}"/>
                                                        <meta name="fennec-config" content="${configRef.replace(/"/g, '&quot;')}"/>
                                                        ${metaManifest}
                                                        ${metaParent}
                                                        ${metaOracleEndpoint}
                                                        ${metaOracleAction}
                                                        ${metaPubkey}
                                                        <title>Fennec ID</title>
                                                        <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent !important;}</style>
                                                        </head>
                                                        <body style="margin:0;background:transparent;overflow:hidden;width:100%;height:100%;position:relative;">
                                                        <div id="fennec-root" style="width:100%;height:100%;overflow:visible;"></div>
                                                        <script id="dna-data" type="application/json">${dnaJson}${closeScriptTag}
                                                        <script>
                                                            (function () {
                                                                try {
                                                                    if (window.__fennecBoot2) return;
                                                                    window.__fennecBoot2 = 1;

                                                                    var libRef = ${JSON.stringify(libRef)};
                                                                    var base = '';
                                                                    try {
                                                                        var mm = document.querySelector('meta[name="fennec-content-base"]');
                                                                        base = mm ? String(mm.getAttribute('content') || '').trim() : '';
                                                                    } catch (_) {}

                                                                    if (base) {
                                                                        while (base.endsWith('/')) base = base.slice(0, -1);
                                                                    }

                                                                    var id = String(libRef || '').trim();
                                                                    var src = '';
                                                                    var isId = new RegExp('^[a-f0-9]{64}i\\\\d+$', 'i').test(id);
                                                                    var isUrl = new RegExp('^https?:\\\\/\\\\/', 'i').test(id);
                                                                    var isPath = id.indexOf('/') === 0 || id.indexOf('./') === 0 || id.indexOf('../') === 0;

                                                                    if (isId && base) {
                                                                        src = base + '/' + id;
                                                                    } else if (isUrl) {
                                                                        var m2 = id.match(new RegExp('\\\\/([a-f0-9]{64}i\\\\d+)$', 'i'));
                                                                        if (m2 && m2[1] && base) {
                                                                            src = base + '/' + String(m2[1]);
                                                                        } else {
                                                                            src = id;
                                                                        }
                                                                    } else if (isPath) {
                                                                        src = id;
                                                                    } else if (id) {
                                                                        src = isId ? 'https://uniscan.cc/fractal/content/' + id : id;
                                                                    }

                                                                    if (!src) {
                                                                        try {
                                                                            (document.getElementById('fennec-root') || document.body).textContent =
                                                                                'Missing fennec-lib';
                                                                        } catch (_) {}
                                                                        return;
                                                                    }

                                                                    if (typeof window.initFennecID === 'function') {
                                                                        try {
                                                                            window.initFennecID();
                                                                        } catch (_) {}
                                                                        return;
                                                                    }

                                                                    var s = document.createElement('script');
                                                                    s.src = src;
                                                                    s.onload = function () {
                                                                        try {
                                                                            if (typeof window.initFennecID === 'function') {
                                                                                window.initFennecID();
                                                                            }
                                                                        } catch (_) {}
                                                                    };
                                                                    s.onerror = function () {
                                                                        try {
                                                                            (document.getElementById('fennec-root') || document.body).textContent =
                                                                                'Failed to load fennec lib. src=' + String(src || '');
                                                                        } catch (_) {}
                                                                    };
                                                                    document.head.appendChild(s);
                                                                } catch (e) {
                                                                    try {
                                                                        (document.getElementById('fennec-root') || document.body).textContent =
                                                                            'Boot error: ' + String((e && e.message) || e);
                                                                    } catch (_) {}
                                                                }
                                                            })();
                                                        ${closeScriptTag}
                                                        </body>
                                                        </html>`;
}

async function loadExistingCardIntoIframe(inscriptionId, identityOverride = null) {
    const id = String(inscriptionId || '').trim();
    if (!id) return;

    const iframeContainer = document.getElementById('fennecIdIframeContainer');
    const iframeSlot =
        (iframeContainer && iframeContainer.querySelector('#fennecIdIframeSlot')) ||
        document.getElementById('fennecIdIframeSlot') ||
        iframeContainer;
    const loadingRoot =
        (iframeContainer && iframeContainer.querySelector('#fennecIdLoadingRoot')) ||
        document.getElementById('fennecIdLoadingRoot');
    const statusEl = document.getElementById('fennecIdEmbedStatus');
    if (statusEl) statusEl.textContent = '';
    const openStartAt = Date.now();

    try {
        if (loadingRoot) {
            loadingRoot.innerHTML = `
                                        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                                            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;width:100%;">
                                                <div style="position: relative; width: 300px; height: 420px; overflow: hidden; border-radius: 24px; border: 4px solid rgba(255,160,0,0.45); box-shadow: inset 0 0 40px rgba(255,160,0,0.15), 0 0 60px rgba(255,160,0,0.18); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6);">
                                                    <img src="/img/FENNECID.png" style="width: 110%; height: 110%; object-fit: cover; object-position: center; filter: drop-shadow(0 0 40px rgba(255,160,0,0.35));" onerror="this.style.display='none';" />
                                                    <div style="position: absolute; top: 0; left: -25%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent 0%, rgba(255,160,0,0) 20%, rgba(255,160,0,0.18) 35%, rgba(255,160,0,0.95) 50%, rgba(255,160,0,0.18) 65%, rgba(255,160,0,0) 80%, transparent 100%); animation: openSweep 2.5s ease-in-out infinite;"></div>
                                                </div>
                                                <div style="width: 100%; max-width: 320px;">
                                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 12px;">
                                                        <div style="font-size: 11px; letter-spacing: 0.2em; color: #ffa030; font-weight: 900; text-transform: uppercase; text-align: center;">OPENING ID</div>
                                                    </div>
                                                    <div style="position: relative; width: 100%; height: 8px; background: rgba(0,0,0,0.5); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,160,0,0.30);">
                                                        <div id="openProgress" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: linear-gradient(90deg, #ffa030, #ffd070); border-radius: 999px; transition: width 0.3s ease-out;"></div>
                                                    </div>
                                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                                        <div id="openMessage" style="font-size: 9px; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); font-weight: 600;">Fetching inscription...</div>
                                                        <div id="openPercent" style="font-size: 10px; font-weight: 900; color: #ffa030;">0%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <style>
                                            @keyframes openSweep {
                                                0% { left:-25%;opacity:0; }
                                                12% { opacity:1; }
                                                88% { opacity:1; }
                                                100% { left:110%;opacity:0; }
                                            }
                                        </style>
                                    `;
        }
    } catch (_) {}

    try {
        if (window.__openProgressInterval) {
            clearInterval(window.__openProgressInterval);
            window.__openProgressInterval = null;
        }
        const messages = [
            'Fetching inscription...',
            'Patching embedded lib...',
            'Rendering ID frame...',
            'Finalizing...'
        ];
        let progress = 0;
        let msgIndex = 0;
        const progressBar = loadingRoot ? loadingRoot.querySelector('#openProgress') : null;
        const progressPercent = loadingRoot ? loadingRoot.querySelector('#openPercent') : null;
        const progressMessage = loadingRoot ? loadingRoot.querySelector('#openMessage') : null;
        window.__openProgressInterval = setInterval(() => {
            progress = Math.min(95, progress + Math.random() * 3 + 1);
            if (progressBar) progressBar.style.width = progress + '%';
            if (progressPercent) progressPercent.textContent = Math.floor(progress) + '%';
            if (progress >= (msgIndex + 1) * (95 / messages.length) && msgIndex < messages.length - 1) {
                msgIndex++;
                if (progressMessage) progressMessage.textContent = messages[msgIndex];
            }
        }, 300);
    } catch (_) {}

    try {
        try {
            await new Promise(resolve =>
                window.requestAnimationFrame ? window.requestAnimationFrame(resolve) : setTimeout(resolve, 0)
            );
        } catch (_) {}
        const url = `${BACKEND_URL}?action=inscription_content&inscriptionId=${encodeURIComponent(id)}&raw=1`;
        const res = await fetch(url, { cache: 'no-store' });
        let html = '';
        try {
            const ct = String(res.headers.get('content-type') || '').toLowerCase();
            if (res.ok && ct && ct.indexOf('application/json') >= 0) {
                const j = await res.json().catch(() => null);
                const data = j && typeof j === 'object' ? j.data || null : null;
                html = String(data?.body || data?.contentBody || data?.content_body || '');
            } else if (res.ok) {
                html = await res.text().catch(() => '');
            }
        } catch (_) {
            html = '';
        }

        if (!html) {
            try {
                const url2 = `${BACKEND_URL}?action=inscription_content&inscriptionId=${encodeURIComponent(id)}`;
                const res2 = await fetch(url2, { cache: 'no-store' });
                const j2 = res2.ok ? await res2.json().catch(() => null) : null;
                const data2 = j2 && typeof j2 === 'object' ? j2.data || null : null;
                html = String(data2?.body || data2?.contentBody || data2?.content_body || '');
            } catch (_) {
                html = '';
            }
        }

        if (!html) {
            if (statusEl) statusEl.textContent = 'Failed to load card HTML.';
            return;
        }

        const identityFromHtml = parseDnaFromChildHtml(html);
        let identityToRender = identityFromHtml && typeof identityFromHtml === 'object' ? identityFromHtml : null;
        try {
            const override = identityOverride && typeof identityOverride === 'object' ? identityOverride : null;
            const addrNow = String(window.userAddress || userAddress || '').trim();
            const overrideAddr = String(override?.metrics?.address || override?.address || '').trim();
            if (override && addrNow && overrideAddr && overrideAddr === addrNow) {
                identityToRender = JSON.parse(JSON.stringify(override));
                if (identityFromHtml && typeof identityFromHtml === 'object') {
                    if (identityFromHtml.inscriptionNumber && !identityToRender.inscriptionNumber) {
                        identityToRender.inscriptionNumber = identityFromHtml.inscriptionNumber;
                    }
                    if (identityFromHtml.inscriptionId && !identityToRender.inscriptionId) {
                        identityToRender.inscriptionId = identityFromHtml.inscriptionId;
                    }
                }
            }
        } catch (_) {}

        if (identityToRender && typeof identityToRender === 'object') {
            try {
                identityToRender.metrics =
                    identityToRender.metrics && typeof identityToRender.metrics === 'object'
                        ? identityToRender.metrics
                        : {};
                const addrNow = String(window.userAddress || userAddress || '').trim();
                if (addrNow) identityToRender.metrics.address = addrNow;
            } catch (_) {}
            window.auditIdentity = identityToRender;
        }

        const fromHtmlManifest = readMetaFromHtml(html, 'fennec-manifest');
        try {
            if (typeof window.refreshFennecCoreRefs === 'function') {
                await window.refreshFennecCoreRefs();
            }
        } catch (_) {}
        const core =
            window.getFennecCoreRefs && typeof window.getFennecCoreRefs === 'function'
                ? window.getFennecCoreRefs('embed')
                : null;
        const isLocalFirst = core && core.mode === 'local-first';

        const manifestRef = String(
            (core && core.manifestRef) ||
                fromHtmlManifest ||
                PRIMARY_MANIFEST_REF ||
                DEFAULT_MANIFEST_URL ||
                localStorage.getItem('fennec_mint_child_manifest') ||
                ''
        ).trim();

        const embedCacheBust = `?t=${Date.now()}`;
        const forceLocalEmbedLib = `${LOCAL_CHILD_LIB_URL}${embedCacheBust}`;
        const forceLocalEmbedConfig = `${LOCAL_CHILD_CONFIG_URL}${embedCacheBust}`;

        const latestRefs = { libRef: '', configRef: '' };
        const fromHtmlLib = readMetaFromHtml(html, 'fennec-lib');
        const fromHtmlConfig = readMetaFromHtml(html, 'fennec-config');

        let chosenLibRef = '';
        let chosenConfigRef = '';
        if (isLocalFirst) {
            chosenLibRef = String(forceLocalEmbedLib).trim();
            chosenConfigRef = String(forceLocalEmbedConfig).trim();
        } else {
            chosenLibRef = String((core && core.libRef) || fromHtmlLib || PRIMARY_CHILD_LIB || '').trim();
            chosenConfigRef = String((core && core.configRef) || fromHtmlConfig || PRIMARY_CHILD_CONFIG || '').trim();
            if (!chosenLibRef) chosenLibRef = String(forceLocalEmbedLib).trim();
            if (!chosenConfigRef) chosenConfigRef = String(forceLocalEmbedConfig).trim();
        }

        try {
            console.log('[FennecID][embed] resolved refs', {
                parentRef: id,
                manifestRef,
                latestRefs,
                fromHtmlLib,
                fromHtmlConfig,
                chosenLibRef,
                chosenConfigRef
            });
        } catch (_) {}

        const rebuilt =
            identityToRender && typeof identityToRender === 'object' && typeof generateRecursiveChildHTML === 'function'
                ? generateRecursiveChildHTML(identityToRender, {
                      parentRef: id,
                      manifestRef,
                      libRef: chosenLibRef,
                      configRef: chosenConfigRef,
                      oracleEndpoint: BACKEND_URL,
                      oracleAction: 'fractal_audit'
                  })
                : html;

        const patched = patchChildHtmlForEmbed(rebuilt, {
            parentRef: id,
            manifestRef,
            libRef: chosenLibRef,
            configRef: chosenConfigRef
        });
        if (iframeSlot) {
            // Create iframe dynamically with proper sandbox
            iframeSlot.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.id = 'fennecIdIframe';
            iframe.title = 'Fennec ID';
            iframe.className = 'w-full h-full border-0';
            iframe.style.outline = 'none';
            iframe.style.background = 'transparent';
            iframe.style.borderRadius = '32px';
            iframe.style.opacity = '0';
            iframe.style.transition = 'opacity 420ms ease-in-out';
            iframe.setAttribute('allowtransparency', 'true');
            iframe.setAttribute(
                'sandbox',
                'allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads'
            );
            iframe.srcdoc = patched;

            // ИСПРАВЛЕНИЕ: Показываем кнопку Share только после загрузки iframe
            iframe.onload = function () {
                try {
                    const shareBtn = document.getElementById('fidShareBtn');
                    if (shareBtn) {
                        shareBtn.style.display = 'flex';
                    }
                } catch (_) {}
            };

            iframeSlot.appendChild(iframe);
        }
        if (statusEl) statusEl.textContent = '';
        try {
            if (window.__openProgressInterval) {
                clearInterval(window.__openProgressInterval);
                window.__openProgressInterval = null;
            }
        } catch (_) {}
        try {
            const minDuration = 1400;
            const elapsed = Date.now() - openStartAt;
            if (elapsed < minDuration) {
                await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
            }
        } catch (_) {}
        try {
            const bar = loadingRoot ? loadingRoot.querySelector('#openProgress') : null;
            const pct = loadingRoot ? loadingRoot.querySelector('#openPercent') : null;
            const msg = loadingRoot ? loadingRoot.querySelector('#openMessage') : null;
            if (bar) bar.style.width = '100%';
            if (pct) pct.textContent = '100%';
            if (msg) msg.textContent = 'Opening complete...';
        } catch (_) {}
        try {
            setTimeout(() => {
                try {
                    const iframe = document.getElementById('fennecIdIframe');
                    if (loadingRoot) {
                        loadingRoot.style.transition = 'opacity 380ms ease-out';
                        loadingRoot.style.opacity = '0';
                    }
                    setTimeout(() => {
                        try {
                            if (iframe) iframe.style.opacity = '1';
                        } catch (_) {}
                    }, 150);
                    setTimeout(() => {
                        try {
                            if (loadingRoot) {
                                loadingRoot.innerHTML = '';
                                loadingRoot.style.opacity = '1';
                                loadingRoot.style.transition = '';
                            }
                        } catch (_) {}
                    }, 520);
                } catch (_) {}
            }, 180);
        } catch (_) {}
    } catch (e) {
        console.error('loadExistingCardIntoIframe error:', e);
        if (statusEl) statusEl.textContent = 'Failed to load card.';
        try {
            if (window.__openProgressInterval) {
                clearInterval(window.__openProgressInterval);
                window.__openProgressInterval = null;
            }
        } catch (_) {}
        try {
            if (loadingRoot) loadingRoot.innerHTML = '';
        } catch (_) {}
    }
}
async function loadPreviewCardIntoIframe(identity) {
    const iframeContainer = document.getElementById('fennecIdIframeContainer');
    const iframeSlot =
        (iframeContainer && iframeContainer.querySelector('#fennecIdIframeSlot')) ||
        document.getElementById('fennecIdIframeSlot') ||
        iframeContainer;
    const loadingRoot =
        (iframeContainer && iframeContainer.querySelector('#fennecIdLoadingRoot')) ||
        document.getElementById('fennecIdLoadingRoot');
    const statusEl = document.getElementById('fennecIdEmbedStatus');
    if (statusEl) statusEl.textContent = '';

    try {
        if (typeof window.refreshFennecCoreRefs === 'function') {
            window.refreshFennecCoreRefs();
        }
    } catch (_) {}
    try {
        if (loadingRoot) {
            loadingRoot.innerHTML = `
                                        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                                            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;width:100%;">
                                                <div style="position: relative; width: 300px; height: 420px; overflow: hidden; border-radius: 24px; border: 4px solid rgba(255,107,53,0.35); box-shadow: inset 0 0 40px rgba(255,107,53,0.15), 0 0 60px rgba(255,107,53,0.22); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6);">
                                                    <img src="/img/FENNECID.png" style="width: 110%; height: 110%; object-fit: cover; object-position: center; filter: drop-shadow(0 0 40px rgba(255,107,53,0.35));" onerror="this.style.display='none';" />
                                                    <div style="position: absolute; top: 0; left: -25%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent 0%, rgba(255,107,53,0) 20%, rgba(255,107,53,0.18) 35%, rgba(255,107,53,0.92) 50%, rgba(255,107,53,0.18) 65%, rgba(255,107,53,0) 80%, transparent 100%); animation: previewSweep 2.5s ease-in-out infinite;"></div>
                                                </div>
                                                <div style="font-size: 11px; letter-spacing: 0.2em; color: #ff6b35; font-weight: 900; text-transform: uppercase; text-align: center;">LOADING PREVIEW</div>
                                            </div>
                                        </div>
                                        <style>
                                            @keyframes previewSweep {
                                                0% { left:-25%;opacity:0; }
                                                12% { opacity:1; }
                                                88% { opacity:1; }
                                                100% { left:110%;opacity:0; }
                                            }
                                        </style>
                                    `;
        }
    } catch (_) {}

    try {
        try {
            if (typeof window.refreshFennecCoreRefs === 'function') {
                await window.refreshFennecCoreRefs();
            }
        } catch (_) {}
        const core =
            window.getFennecCoreRefs && typeof window.getFennecCoreRefs === 'function'
                ? window.getFennecCoreRefs('embed')
                : null;
        const isLocalFirst = core && core.mode === 'local-first';
        const manifestRef = String(
            (core && core.manifestRef) ||
                PRIMARY_MANIFEST_REF ||
                DEFAULT_MANIFEST_URL ||
                localStorage.getItem('fennec_mint_child_manifest') ||
                ''
        ).trim();

        const embedCacheBust = `?t=${Date.now()}`;
        const forceLocalEmbedLib = `${LOCAL_CHILD_LIB_URL}${embedCacheBust}`;
        const forceLocalEmbedConfig = `${LOCAL_CHILD_CONFIG_URL}${embedCacheBust}`;
        const childOpts = { manifestRef };
        const latestRefs = null;
        if (isLocalFirst) {
            childOpts.libRef = forceLocalEmbedLib;
            childOpts.configRef = forceLocalEmbedConfig;
        } else {
            childOpts.libRef = String((core && core.libRef) || PRIMARY_CHILD_LIB || '').trim();
            childOpts.configRef = String((core && core.configRef) || PRIMARY_CHILD_CONFIG || '').trim();
            if (!childOpts.libRef) childOpts.libRef = forceLocalEmbedLib;
            if (!childOpts.configRef) childOpts.configRef = forceLocalEmbedConfig;
        }

        try {
            console.log('[FennecID][preview] resolved refs', {
                manifestRef,
                latestRefs,
                childOpts
            });
        } catch (_) {}

        const html =
            typeof generateRecursiveChildHTML === 'function' ? generateRecursiveChildHTML(identity, childOpts) : '';
        if (!html) {
            if (statusEl) statusEl.textContent = 'Failed to build card HTML.';
            return;
        }

        const patched = patchChildHtmlForEmbed(html);
        if (iframeSlot) {
            iframeSlot.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.id = 'fennecIdIframe';
            iframe.title = 'Fennec ID Preview';
            iframe.className = 'w-full h-full border-0';
            iframe.style.outline = 'none';
            iframe.style.background = 'transparent';
            iframe.style.borderRadius = '32px';
            iframe.setAttribute('allowtransparency', 'true');
            iframe.setAttribute(
                'sandbox',
                'allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads'
            );
            iframe.srcdoc = patched;

            iframeSlot.appendChild(iframe);
        }

        if (statusEl) statusEl.textContent = '';
        try {
            if (loadingRoot) loadingRoot.innerHTML = '';
        } catch (_) {}
    } catch (e) {
        console.error('loadPreviewCardIntoIframe error:', e);
        if (statusEl) statusEl.textContent = 'Failed to load card.';
        try {
            if (loadingRoot) loadingRoot.innerHTML = '';
        } catch (_) {}
    }
}

// Duplicate definitions removed - functions are now defined earlier before usage

function calculateFennecIdentityLegacy(data) {
    const {
        netWorth,
        txCount,
        utxoCount,
        first_tx_ts,
        stats,
        prices,
        lpValueFB,
        lpValueUSD,
        stakedFB,
        abandoned_utxo_count
    } = data;

    const now = Math.floor(Date.now() / 1000);
    const MIN_VALID = 1700000000;
    let daysAlive = 0;
    let validFirstTxTs = first_tx_ts || 0;

    if (validFirstTxTs > 1000000000000) {
        validFirstTxTs = Math.floor(validFirstTxTs / 1000);
    }

    if (validFirstTxTs > 0) {
        const currentDate = new Date();
        const tsDate = new Date(validFirstTxTs * 1000);
        const isFuture = validFirstTxTs > now || tsDate > currentDate;

        if (validFirstTxTs >= MIN_VALID && !isFuture) {
            daysAlive = Math.ceil((now - validFirstTxTs) / 86400);
            if (daysAlive < 1) daysAlive = 1;
        } else {
            validFirstTxTs = 0;
            daysAlive = 0;
        }
    }

    const LAUNCH_DATE = 1725840000;
    const ONE_DAY = 86400;
    const isGenesis = validFirstTxTs > 0 && validFirstTxTs >= LAUNCH_DATE && validFirstTxTs < LAUNCH_DATE + ONE_DAY;

    const netWorthUSD = Number(netWorth) || 0;
    const providerValueUSD = Number(lpValueUSD) || 0;
    const isLiquidityProvider = providerValueUSD >= 50;
    const isWhale = netWorthUSD >= 1000;
    const brc20Count = stats?.brc20 || 0;
    const runesCount = stats?.runes || 0;
    const ordinalsCount = stats?.ordinals || 0;
    const totalInscriptions = brc20Count + runesCount + ordinalsCount;
    const isArtifactHunter = totalInscriptions >= 50;
    const isRuneKeeper = runesCount >= 20;

    const fennecTotal = parseFloat(data.fennecBalance || 0);
    const fennecWalletOnly = Number(data.fennec_wallet_balance || 0);
    const hasFennecInLP = !!data.has_fennec_in_lp;
    const fennecLpValueUSD = Number(data.fennec_lp_value_usd || 0);
    const hasFennecSoul = fennecWalletOnly >= 100 || fennecLpValueUSD >= 1;

    const abandonedUtxoCountNum = Number.isFinite(Number(abandoned_utxo_count)) ? Number(abandoned_utxo_count) : 0;
    const abandonedUtxoCountMissing = !!data.abandoned_utxo_count_missing;
    const isSandSweeper = !abandonedUtxoCountMissing && abandonedUtxoCountNum < 100;
    const isMempoolRider = (Number(txCount) || 0) >= 10000;

    const badges = [];
    if (isGenesis)
        badges.push({
            name: 'GENESIS',
            icon: '',
            desc: 'You witnessed the first sunrise over the Fractal dunes.'
        });
    if (isWhale)
        badges.push({
            name: 'WHALE',
            icon: '',
            desc: 'When you move, the sands shift beneath you.'
        });
    if (isLiquidityProvider)
        badges.push({
            name: 'PROVIDER',
            icon: '',
            desc: 'The desert is thirsty, but your well runs deep.'
        });
    if (fennecTotal >= 10000 || hasFennecInLP)
        badges.push({
            name: 'FENNEC MAXI',
            icon: '',
            desc: 'The Spirit of the Fox guides your path.'
        });
    if (isArtifactHunter)
        badges.push({
            name: 'ARTIFACT HUNTER',
            icon: '',
            desc: 'Your pockets are heavy with echoes of the chain.'
        });
    if (isRuneKeeper)
        badges.push({
            name: 'RUNE KEEPER',
            icon: '',
            desc: 'You decipher the glyphs. The stones speak to you.'
        });
    if (isMempoolRider)
        badges.push({
            name: 'MEMPOOL RIDER',
            icon: '',
            desc: 'Surfing the chaos of the 30-second block waves.'
        });
    if (isSandSweeper)
        badges.push({
            name: 'SAND SWEEPER',
            icon: '',
            desc: 'Your UTXO set is clean. No trash left in the dunes.'
        });

    let baseKey = 'DRIFTER';
    if (isGenesis && isLiquidityProvider && isWhale) baseKey = 'PRIME';
    else if (providerValueUSD >= 200) baseKey = 'LORD';
    else if (isGenesis) baseKey = 'WALKER';
    else if (isArtifactHunter && isRuneKeeper) baseKey = 'KEEPER';
    else if (netWorthUSD >= 100) baseKey = 'MERCHANT';
    else if (txCount > 1000) baseKey = 'ENGINEER';
    else if (runesCount >= 20) baseKey = 'SHAMAN';

    if (badges.length >= 7) baseKey = 'SINGULARITY';

    let tierLevel = 0;
    if (badges.length >= 6) tierLevel = 3;
    else if (badges.length >= 4) tierLevel = 2;
    else if (badges.length >= 2) tierLevel = 1;

    if (baseKey === 'PRIME' || baseKey === 'SINGULARITY') tierLevel = 3;

    const tierNames = {
        DRIFTER: ['DESERT RUNNER', 'SAND WANDERER', 'DUNE NOMAD', 'STORM SURFER'],
        MERCHANT: ['CARAVAN MERCHANT', 'GOLD TRADER', 'OASIS KING', 'DESERT TYCOON'],
        ENGINEER: ['CODE ENGINEER', 'SYSTEM BUILDER', 'NEURAL ARCHITECT', 'QUANTUM ENGINEER'],
        SHAMAN: ['RUNE SHAMAN', 'RUNE SEER', 'RUNE PROPHET', 'RUNE DEITY'],
        KEEPER: ['KEEPER OF LORE', 'CHRONICLER', 'GRAND ARCHIVIST', 'OMNISCIENT'],
        WALKER: ['FIRST WALKER', 'ANCIENT WALKER', 'PRIMORDIAL', 'TIMELESS ENTITY'],
        LORD: ['OASIS LORD', 'TERMINAL BARON', 'FRACTAL KING', 'EMPEROR'],
        PRIME: ['FRACTAL PRIME', 'APEX PRIME', 'OMEGA PRIME', 'PRIME ABSOLUTE'],
        SINGULARITY: ['THE SINGULARITY', 'THE SINGULARITY', 'THE SINGULARITY', 'THE SINGULARITY']
    };

    const evolutionPath = tierNames[baseKey] || tierNames.DRIFTER;
    const finalTitle = evolutionPath[Math.min(tierLevel, evolutionPath.length - 1)];

    const txCountNum = Number(txCount) || 0;
    const activityPoints = Math.round(25 * (Math.log10(1 + Math.min(txCountNum, 10000)) / Math.log10(1 + 10000)));
    const wealthPoints = Math.round(25 * Math.sqrt(Math.min(netWorthUSD, 1000) / 1000));
    const timePoints = Math.round(15 * (Math.min(daysAlive, 365) / 365));

    const badgeWeights = {
        GENESIS: 15,
        WHALE: 10,
        PROVIDER: 8,
        'ARTIFACT HUNTER': 3,
        'RUNE KEEPER': 3,
        'MEMPOOL RIDER': 7,
        'SAND SWEEPER': 3,
        'FENNEC MAXI': 0
    };
    const badgesPointsRaw = badges.reduce((sum, b) => sum + (badgeWeights[b.name] || 0), 0);
    const badgesPoints = Math.min(35, badgesPointsRaw);
    const baseScore = Math.min(100, activityPoints + wealthPoints + timePoints + badgesPoints);
    const hasMaxi = badges.some(b => b.name === 'FENNEC MAXI');
    const activityScore = Math.min(100, Math.round(baseScore * (hasMaxi ? 1.15 : 1)));

    let rarityName = 'CUB',
        rarityClass = 'card-cub',
        rarityColor = 'text-gray-500';
    if (activityScore >= 95) {
        rarityName = 'SPIRIT';
        rarityClass = 'card-spirit';
        rarityColor = 'text-spirit';
    } else if (activityScore >= 80) {
        rarityName = 'ELDER';
        rarityClass = 'card-elder';
        rarityColor = 'text-elder';
    } else if (activityScore >= 65) {
        rarityName = 'ALPHA';
        rarityClass = 'card-alpha';
        rarityColor = 'text-alpha';
    } else if (activityScore >= 50) {
        rarityName = 'HUNTER';
        rarityClass = 'card-hunter';
        rarityColor = 'text-hunter';
    } else if (activityScore >= 30) {
        rarityName = 'SCOUT';
        rarityClass = 'card-scout';
        rarityColor = 'text-scout';
    }

    return {
        archetype: { baseKey, title: finalTitle, tierLevel, badges },
        metrics: {
            wealth: netWorthUSD.toFixed(2),
            daysAlive,
            first_tx_ts: validFirstTxTs,
            txCount,
            utxoCount,
            activityScore,
            scoreBreakdown: {
                activityPoints,
                wealthPoints,
                timePoints,
                badgesPoints,
                baseScore,
                multiplier: hasMaxi ? 1.15 : 1
            },
            fennecBalance: fennecTotal.toFixed(2),
            fennecNativeBalance: data.fennec_native_balance || 0,
            fennecWalletBalance: fennecWalletOnly,
            fennecInSwapBalance: data.fennec_inswap_balance || 0,
            fbTotal: (parseFloat(data.nativeBalance || 0) + (data.fbSwapBalance || 0) + (lpValueFB || 0)).toFixed(2),
            nativeBalance: parseFloat(data.nativeBalance || 0).toFixed(4),
            rarity: { name: rarityName, class: rarityClass, color: rarityColor },
            rarityName,
            rarityColor,
            activityStatus: rarityName,
            activityColor: rarityColor,
            avgTxPerDay: (daysAlive > 0 ? txCount / daysAlive : 0).toFixed(2),
            inscriptionStats: stats,
            abandonedUtxoCount: abandonedUtxoCountNum,
            fbSwapBalance: data.fbSwapBalance || 0,
            stakedFB: stakedFB || 0,
            lpValueFB: lpValueFB || 0,
            lpValueUSD: providerValueUSD,
            hasFennecSoul,
            hasFennecInLP,
            fennecLpValueUSD,
            hasFennecMaxi: hasMaxi,
            badgeCount: badges.length
        }
    };
}

window.openLastMintedCard = function () {
    try {
        const m = window.__lastMintedCard;
        if (!m || typeof m !== 'object') return;
        const htmlCode = m.htmlCode || '';
        if (htmlCode) {
            const patched = patchChildHtmlForEmbed(htmlCode);
            const blob = new Blob([patched], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {}
            }, 60000);
            return;
        }
        const insc = String(m.inscriptionId || m.inscription_id || '').trim();
        if (insc) {
            window.open(`https://uniscan.cc/fractal/content/${insc}`, '_blank');
        }
    } catch (e) {}
};

// Run the audit
async function __legacy_runAudit(forceRefresh = false) {
    if (window.auditLoading) {
        console.log('Audit already running');
        return;
    }

    const addrConnected = String(window.userAddress || userAddress || '').trim();
    if (!addrConnected) {
        try {
            if (typeof showNotification === 'function') {
                showNotification('Connect wallet first', 'warning', 2000);
            } else {
                alert('Connect wallet first');
            }
        } catch (_) {}
        try {
            if (typeof window.initAudit === 'function') __fennecInitAuditSafe();
        } catch (_) {}
        return;
    }

    try {
        const now = Date.now();
        const last = Number(window.__lastAuditClickAt || 0) || 0;
        if (now - last < 900) return;
        window.__lastAuditClickAt = now;
    } catch (_) {}

    try {
        window.__fennecAuditUi =
            window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object'
                ? window.__fennecAuditUi
                : { addr: '', mode: 'idle', openedAt: 0, scannedAt: 0 };
        window.__fennecAuditUi.addr = addrConnected;
        window.__fennecAuditUi.mode = 'scanning';
        window.__fennecAuditUi.openedAt = 0;
        window.__fennecAuditUi.scannedAt = 0;
    } catch (_) {}
    const container = document.getElementById('auditContainer');

    const hasContainer = !!container;

    window.auditLoading = true;
    const requestId = ++window.currentAuditRequestId;
    if (window.currentAuditAbortController) window.currentAuditAbortController.abort();
    window.currentAuditAbortController = new AbortController();

    // ПРИНУДИТЕЛЬНО показываем лоадер в контейнере СРАЗУ
    try {
        if (!hasContainer) throw new Error('no_container');
        container.innerHTML = `
                                            <div class="w-full flex items-start justify-center" style="min-height: 560px;">
                                                <div class="flex flex-col items-center justify-center" style="max-width: 360px; width: 100%; padding: 0px 20px; gap: 32px;">
                                                    <div style="position: relative; width: 300px; height: 420px; overflow: hidden; border-radius: 24px; border: 4px solid rgba(255,107,53,0.35); box-shadow: inset 0 0 40px rgba(255,107,53,0.15), 0 0 60px rgba(255,107,53,0.25); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6);">
                                                        <img src="/img/FENNECID.png" style="width: 110%; height: 110%; object-fit: cover; object-position: center; filter: drop-shadow(0 0 40px rgba(255,107,53,0.4));" onerror="this.style.display='none';" />
                                                        <div id="scanSweep" style="position: absolute; top: 0; left: -25%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent 0%, rgba(255,107,53,0) 20%, rgba(255,107,53,0.18) 35%, rgba(255,107,53,0.92) 50%, rgba(255,107,53,0.18) 65%, rgba(255,107,53,0) 80%, transparent 100%); animation: scanSweep 2.5s ease-in-out infinite;"></div>
                                                    </div>
                                                    <div style="width: 100%; max-width: 320px;">
                                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 12px;">
                                                            <div style="font-size: 11px; letter-spacing: 0.2em; color: #ff6b35; font-weight: 900; text-transform: uppercase; text-align: center;">SCANNING IDENTITY</div>
                                                        </div>
                                                        <div style="position: relative; width: 100%; height: 8px; background: rgba(0,0,0,0.5); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,107,53,0.3);">
                                                            <div id="scanProgress" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: linear-gradient(90deg, #ff6b35, #ff8c35); border-radius: 999px; transition: width 0.3s ease-out;"></div>
                                                        </div>
                                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                                            <div id="scanMessage" style="font-size: 9px; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); font-weight: 600;">Connecting to the oasis...</div>
                                                            <div id="scanPercent" style="font-size: 10px; font-weight: 900; color: #ff6b35;">0%</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <style>
                                                @keyframes scanSweep {
                                                    0% { left: -25%; opacity: 0; }
                                                    12% { opacity: 1; }
                                                    88% { opacity: 1; }
                                                    100% { left: 110%; opacity: 0; }
                                                }
                                            </style>
                                        `;
        // Анимируем прогресс
        const messages = [
            'Connecting to the oasis...',
            'Analyzing wallet footprint...',
            'Scanning blockchain data...',
            'Calculating activity score...',
            'Identifying badges...',
            'Determining archetype...',
            'Finalizing identity...'
        ];
        let progress = 0;
        let msgIndex = 0;
        const progressBar = document.getElementById('scanProgress');
        const progressPercent = document.getElementById('scanPercent');
        const progressMessage = document.getElementById('scanMessage');

        const startTime = Date.now();
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;

            // Slowly increment progress but never reach 100 until data is ready
            progress = Math.min(95, progress + Math.random() * 3 + 1);

            if (progressBar) progressBar.style.width = progress + '%';
            if (progressPercent) progressPercent.textContent = Math.floor(progress) + '%';

            if (progress >= (msgIndex + 1) * (95 / messages.length) && msgIndex < messages.length - 1) {
                msgIndex++;
                if (progressMessage) progressMessage.textContent = messages[msgIndex];
            }
        }, 300);

        window.__scanProgressInterval = progressInterval;
    } catch (_) {}

    // Также обновляем кнопку если она есть
    try {
        const getBtn = document.getElementById('getYourIdBtn');
        const getIcon = document.getElementById('getYourIdBtnIcon');
        const getText = document.getElementById('getYourIdBtnText');

        if (getBtn) {
            getBtn.disabled = true;
            getBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (getIcon) {
            getIcon.className = 'fas fa-spinner fa-spin';
        }
        if (getText) {
            getText.textContent = 'SCANNING...';
        }
    } catch (_) {}

    // Wallet is required (scan/open must not auto-start before connect)
    // (handled above)

    if (typeof generateRecursiveChildHTML !== 'function' && hasContainer) {
        container.innerHTML = `
                                                                                                    <div class="w-full max-w-md bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-red-200">
                                                                                                        <p class="font-bold mb-2">Fennec ID library missing</p>
                                                                                                        <p class="text-sm mb-4">generateRecursiveChildHTML() is not available.</p>
                                                                                                    </div>
                                                                                                `;
        window.auditLoading = false;
        return;
    }

    try {
        const addr = (userAddress || window.userAddress || '').trim();

        // ИСПРАВЛЕНИЕ: Сначала проверяем in-flight prefetch и window.prefetchedFennecAudit
        if (!forceRefresh) {
            // 1. Проверяем in-flight prefetch promise
            try {
                const inFlight =
                    window.__fennecPrefetchAudit &&
                    typeof window.__fennecPrefetchAudit === 'object' &&
                    window.__fennecPrefetchAudit.promise &&
                    window.__fennecPrefetchAudit.addr === addr
                        ? window.__fennecPrefetchAudit.promise
                        : null;
                if (inFlight) {
                    console.log('window.runAudit: Using in-flight prefetch promise');
                    const idFromPrefetch = await inFlight.catch(() => null);
                    if (idFromPrefetch && typeof idFromPrefetch === 'object') {
                        window.auditIdentity = idFromPrefetch;
                        try {
                            window.auditIdentity.metrics =
                                window.auditIdentity.metrics && typeof window.auditIdentity.metrics === 'object'
                                    ? window.auditIdentity.metrics
                                    : {};
                            window.auditIdentity.metrics.address = String(addr || '').trim();
                        } catch (_) {}
                        if (window.__scanProgressInterval) {
                            clearInterval(window.__scanProgressInterval);
                            window.__scanProgressInterval = null;
                        }
                        try {
                            const finalProgressBar = document.getElementById('scanProgress');
                            const finalProgressPercent = document.getElementById('scanPercent');
                            if (finalProgressBar) finalProgressBar.style.width = '100%';
                            if (finalProgressPercent) finalProgressPercent.textContent = '100%';
                        } catch (_) {}
                        window.auditLoading = false;
                        try {
                            if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                                window.__fennecAuditUi.addr = addr;
                                window.__fennecAuditUi.mode = 'scanned';
                                window.__fennecAuditUi.scannedAt = Date.now();
                            }
                        } catch (_) {}
                        if (typeof window.initAudit === 'function') __fennecInitAuditSafe();
                        return;
                    }
                }
            } catch (_) {}

            // 2. Проверяем уже завершенный prefetch (window.prefetchedFennecAudit)
            try {
                if (
                    window.prefetchedFennecAudit &&
                    window.prefetchedFennecAuditAddr === addr &&
                    Date.now() - window.prefetchedFennecAuditTs < 300000
                ) {
                    console.log('window.runAudit: Using prefetched audit data');
                    window.auditIdentity = window.prefetchedFennecAudit;
                    try {
                        window.auditIdentity.metrics =
                            window.auditIdentity.metrics && typeof window.auditIdentity.metrics === 'object'
                                ? window.auditIdentity.metrics
                                : {};
                        window.auditIdentity.metrics.address = String(addr || '').trim();
                    } catch (_) {}
                    if (window.__scanProgressInterval) {
                        clearInterval(window.__scanProgressInterval);
                        window.__scanProgressInterval = null;
                    }
                    try {
                        const finalProgressBar = document.getElementById('scanProgress');
                        const finalProgressPercent = document.getElementById('scanPercent');
                        if (finalProgressBar) finalProgressBar.style.width = '100%';
                        if (finalProgressPercent) finalProgressPercent.textContent = '100%';
                    } catch (_) {}
                    window.auditLoading = false;
                    try {
                        if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                            window.__fennecAuditUi.addr = addr;
                            window.__fennecAuditUi.mode = 'scanned';
                            window.__fennecAuditUi.scannedAt = Date.now();
                        }
                    } catch (_) {}
                    if (typeof window.initAudit === 'function') __fennecInitAuditSafe();
                    return;
                }
            } catch (_) {}

            // 3. Проверяем localStorage кэш
            const cacheKey = `audit_v3_${addr}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const cachedData = JSON.parse(cached);
                    if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
                        console.log('Using cached audit data');
                        window.auditIdentity = cachedData.identity;
                        try {
                            if (window.auditIdentity && typeof window.auditIdentity === 'object') {
                                window.auditIdentity.metrics =
                                    window.auditIdentity.metrics && typeof window.auditIdentity.metrics === 'object'
                                        ? window.auditIdentity.metrics
                                        : {};
                                window.auditIdentity.metrics.address = String(
                                    window.auditIdentity.metrics.address || addr
                                ).trim();
                            }
                        } catch (_) {}
                        if (window.__scanProgressInterval) {
                            clearInterval(window.__scanProgressInterval);
                            window.__scanProgressInterval = null;
                        }
                        try {
                            const finalProgressBar = document.getElementById('scanProgress');
                            const finalProgressPercent = document.getElementById('scanPercent');
                            if (finalProgressBar) finalProgressBar.style.width = '100%';
                            if (finalProgressPercent) finalProgressPercent.textContent = '100%';
                        } catch (_) {}
                        window.auditLoading = false;
                        try {
                            if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                                window.__fennecAuditUi.addr = addr;
                                window.__fennecAuditUi.mode = 'scanned';
                                window.__fennecAuditUi.scannedAt = Date.now();
                            }
                        } catch (_) {}
                        if (typeof window.initAudit === 'function') __fennecInitAuditSafe();
                        return;
                    }
                } catch (e) {}
            }
        }

        console.log(`Starting audit scan #${requestId}...`);
        const startTime = Date.now();
        const data = await Promise.race([
            fetchAuditData(window.currentAuditAbortController.signal),
            new Promise((_, reject) => {
                const tid = setTimeout(() => reject(new Error('Timeout')), 90000);
                window.currentAuditAbortController.signal.addEventListener('abort', () => clearTimeout(tid));
            })
        ]);

        if (requestId !== window.currentAuditRequestId) {
            try {
                if (window.__scanProgressInterval) {
                    clearInterval(window.__scanProgressInterval);
                    window.__scanProgressInterval = null;
                }
            } catch (_) {}
            window.auditLoading = false;
            return;
        }

        // Complete progress to 100% when data is ready
        if (window.__scanProgressInterval) {
            clearInterval(window.__scanProgressInterval);
            window.__scanProgressInterval = null;
        }

        // Animate to 100%
        const finalProgressBar = document.getElementById('scanProgress');
        const finalProgressPercent = document.getElementById('scanPercent');
        if (finalProgressBar && finalProgressPercent) {
            let finalProgress = parseFloat(finalProgressBar.style.width) || 0;
            const finalInterval = setInterval(() => {
                finalProgress = Math.min(100, finalProgress + 5);
                finalProgressBar.style.width = finalProgress + '%';
                finalProgressPercent.textContent = Math.floor(finalProgress) + '%';
                if (finalProgress >= 100) {
                    clearInterval(finalInterval);
                }
            }, 50);
        }

        const elapsed = Date.now() - startTime;
        const minDuration = 2000;
        if (elapsed < minDuration) {
            await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
        }

        const identity = calculateFennecIdentity(data);
        try {
            if (identity && typeof identity === 'object') {
                identity.metrics = identity.metrics && typeof identity.metrics === 'object' ? identity.metrics : {};
                identity.metrics.address = String(identity.metrics.address || addr).trim();
            }
        } catch (_) {}
        window.auditIdentity = identity;

        localStorage.setItem(
            `audit_v3_${addr}`,
            JSON.stringify({
                identity: identity,
                timestamp: Date.now()
            })
        );

        window.auditLoading = false;
        try {
            if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                window.__fennecAuditUi.addr = addr;
                window.__fennecAuditUi.mode = 'scanned';
                window.__fennecAuditUi.scannedAt = Date.now();
            }
        } catch (_) {}

        if (typeof window.initAudit === 'function') __fennecInitAuditSafe();

        // Auto-open existing ID after a successful scan
        try {
            const currentAddr = (userAddress || window.userAddress || '').trim();
            if (currentAddr && typeof window.refreshFennecIdStatus === 'function') {
                await window.refreshFennecIdStatus(false);
            }
            const st =
                window.__fennecIdStatus && typeof window.__fennecIdStatus === 'object' ? window.__fennecIdStatus : null;
            const hasId = !!(st && st.hasId && String(st.inscriptionId || '').trim());
            const suppressAutoOpen = !!(window && window.__fennecSuppressAutoOpenAfterScan);
            if (hasId && !suppressAutoOpen) {
                setTimeout(() => {
                    try {
                        if (typeof window.openFennecIdInternal === 'function') {
                            window.openFennecIdInternal();
                        }
                    } catch (_) {}
                }, 300);
            }
        } catch (_) {}
    } catch (e) {
        const msg = String((e && e.message) || '').toLowerCase();
        const isWalletCancelled =
            e &&
            (e.name === 'WalletConnectionCancelled' ||
                msg.includes('wallet connection cancelled') ||
                msg.includes('connect wallet first'));
        if (isWalletCancelled) {
            try {
                if (typeof showNotification === 'function') {
                    showNotification(e.message || 'Wallet connection cancelled', 'warning', 2000);
                }
            } catch (_) {}
            try {
                if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                    window.__fennecAuditUi.mode = 'idle';
                }
            } catch (_) {}
            try {
                window.auditLoading = false;
                if (typeof window.initAudit === 'function') __fennecInitAuditSafe();
            } catch (_) {}
            return;
        }

        if (e && e.name === 'AbortError') {
            try {
                if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                    if (String(window.__fennecAuditUi.mode || '') === 'scanning') window.__fennecAuditUi.mode = 'idle';
                }
            } catch (_) {}
            return;
        }

        console.error('Audit error:', e);
        try {
            if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                window.__fennecAuditUi.mode = 'idle';
            }
        } catch (_) {}
        try {
            if (hasContainer) {
                container.innerHTML = `
                                                                                                    <div class="w-full max-w-md bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-red-200">
                                                                                                        <p class="font-bold mb-2">Loading Error</p>
                                                                                                        <p class="text-sm mb-4">${e.message || 'Failed to load data.'}</p>
                                                                                                        <button onclick="window.runAudit(true)" class="w-full px-4 py-3 bg-fennec text-black font-bold rounded hover:bg-orange-600 transition">
                                                                                                            Try Again
                                                                                                        </button>
                                                                                                    </div>
                                                                                                `;
            }
        } catch (_) {}
    } finally {
        try {
            if (window.__scanProgressInterval) {
                clearInterval(window.__scanProgressInterval);
                window.__scanProgressInterval = null;
            }
        } catch (_) {}
        if (requestId === window.currentAuditRequestId) {
            window.auditLoading = false;
        }
    }
}

// runAudit is now imported as module

// Helper: Get progressive animation class
function getAnimationClass(baseKey, tier) {
    // Tier 0: Спящий (общий для всех)
    if (tier === 0) return 'img-tier-0';

    // Tier 1: Пробуждение (общий)
    if (tier === 1) return 'anim-tier-1';

    // Tier 2: Усиление (Группировка по типу эффекта)
    if (tier === 2) {
        if (baseKey === 'ENGINEER') return 'anim-tier-2-glitch';
        if (['MERCHANT', 'LORD'].includes(baseKey)) return 'anim-tier-2-shine';
        if (['SHAMAN', 'KEEPER', 'PRIME', 'SINGULARITY'].includes(baseKey)) return 'anim-tier-2-magic';
        return 'anim-tier-2-heat'; // Drifter, Walker
    }

    // Tier 3: Полная мощь (Уникальный класс для каждого архетипа)
    if (tier === 3) {
        if (baseKey === 'ENGINEER') return 'anim-tier-2-glitch';
        if (baseKey === 'KEEPER') return 'anim-tier-2-magic';
        if (baseKey === 'DRIFTER') return 'anim-tier-2-heat';
        return `anim-${baseKey}`;
    }

    return '';
}

function formatAddrForCard(addr) {
    if (!addr) return '';
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function applyParentOverridesToIdentity(identity) {
    try {
        const raw = localStorage.getItem('fennec_parent_overrides') || '';
        if (!raw) return identity;
        const map = JSON.parse(raw);
        if (!map || typeof map !== 'object') return identity;

        const baseKey = identity?.archetype?.baseKey;
        if (!baseKey) return identity;
        const override = map[baseKey] || map['*'];
        if (!override || typeof override !== 'object') return identity;

        const out = {
            ...identity,
            archetype: { ...(identity.archetype || {}) },
            metrics: { ...(identity.metrics || {}) }
        };
        if (override.archetype && typeof override.archetype === 'object') {
            Object.assign(out.archetype, override.archetype);
        }
        if (override.metrics && typeof override.metrics === 'object') {
            Object.assign(out.metrics, override.metrics);
        }
        return out;
    } catch (e) {
        return identity;
    }
}

// Share Audit
function shareAudit() {
    if (!window.auditIdentity) return;
    const text = `I am ${window.auditIdentity.archetype.title} (${window.auditIdentity.archetype.tier}) on Fennec Swap!\n\nNet Worth: $${window.auditIdentity.metrics.wealth}\nAge: ${window.auditIdentity.metrics.daysAlive} Days\nActivity: ${window.auditIdentity.metrics.txCount} Transactions\n\n${window.auditIdentity.archetype.desc}`;

    if (navigator.share) {
        navigator.share({ text, title: 'Fennec Grand Audit' });
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    }
}

// ИСПРАВЛЕНИЕ: Отдельное обновление аудита (не сбрасывает карточку без желания пользователя)
if (typeof window.lastAuditRefreshTime === 'undefined') window.lastAuditRefreshTime = 0;
if (typeof window.MIN_AUDIT_REFRESH_INTERVAL === 'undefined') window.MIN_AUDIT_REFRESH_INTERVAL = 60000; // 60 секунд между обновлениями аудита
if (typeof window.auditRefreshTimerInterval === 'undefined') window.auditRefreshTimerInterval = null;

window.refreshAudit =
    window.refreshAudit ||
    async function () {
        const now = Date.now();
        const timeSinceLastRefresh = now - window.lastAuditRefreshTime;

        // Проверяем, прошло ли достаточно времени
        if (timeSinceLastRefresh < window.MIN_AUDIT_REFRESH_INTERVAL) {
            const remainingSeconds = Math.ceil((window.MIN_AUDIT_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000);
            showNotification(`Please wait ${remainingSeconds}s before refreshing ID again`, 'warning', 2000);
            return;
        }

        if (!userAddress && !window.userAddress) {
            showNotification('Connect wallet first', 'warning', 2000);
            return;
        }

        if (window.auditLoading) {
            showNotification('Audit is already loading, please wait', 'warning', 2000);
            return;
        }

        // Обновляем время последнего обновления
        window.lastAuditRefreshTime = now;

        // Обновляем UI кнопки
        const refreshAuditBtn = document.getElementById('refreshAuditBtn');
        const refreshAuditIcon = document.getElementById('refreshAuditIcon');
        const refreshAuditText = document.getElementById('refreshAuditText');

        if (refreshAuditBtn) {
            refreshAuditBtn.disabled = true;
        }
        if (refreshAuditIcon) {
            refreshAuditIcon.classList.add('fa-spin');
        }
        if (refreshAuditText) {
            refreshAuditText.textContent = 'UPDATING...';
        }

        try {
            console.log('Manual audit refresh started...');
            await window.runAudit(true);
            showNotification('Audit refreshed successfully', 'success', 2000);
            console.log('Manual audit refresh completed');

            // Запускаем таймер обратного отсчета
            window.startAuditRefreshTimer();
        } catch (e) {
            console.error('Manual audit refresh error:', e);
            showNotification('Audit refresh failed: ' + (e.message || 'Unknown error'), 'error', 3000);
        } finally {
            // Восстанавливаем UI кнопки (но оставляем disabled до окончания таймера)
            if (refreshAuditIcon) {
                refreshAuditIcon.classList.remove('fa-spin');
            }
            if (refreshAuditText) {
                refreshAuditText.textContent = 'Refresh Metadata';
            }
        }
    };

// Таймер обратного отсчета для кнопки обновления аудита
function __legacy_startAuditRefreshTimer() {
    if (window.auditRefreshTimerInterval) {
        clearInterval(window.auditRefreshTimerInterval);
    }

    const refreshAuditTimer = document.getElementById('refreshAuditTimer');
    const refreshAuditBtn = document.getElementById('refreshAuditBtn');

    if (!refreshAuditBtn) return;

    let remainingSeconds = window.MIN_AUDIT_REFRESH_INTERVAL / 1000;
    refreshAuditBtn.disabled = true;

    if (!refreshAuditTimer) {
        setTimeout(() => {
            refreshAuditBtn.disabled = false;
        }, window.MIN_AUDIT_REFRESH_INTERVAL);
        return;
    }

    refreshAuditTimer.classList.remove('hidden');
    refreshAuditTimer.textContent = `(${remainingSeconds}s)`;

    window.auditRefreshTimerInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            clearInterval(window.auditRefreshTimerInterval);
            window.auditRefreshTimerInterval = null;
            refreshAuditTimer.classList.add('hidden');
            refreshAuditBtn.disabled = false;
        } else {
            refreshAuditTimer.textContent = `(${remainingSeconds}s)`;
        }
    }, 1000);
}

// startAuditRefreshTimer is now imported as module

async function mintAuditCard(event) {
    if (!window.auditIdentity) {
        alert('Please load your Fennec ID first!');
        return;
    }

    window.auditIdentity = applyParentOverridesToIdentity(window.auditIdentity);

    const btn = document.getElementById('mintBtn') || document.getElementById('fidUpdateBtn');
    if (!btn) {
        if (typeof showNotification === 'function') showNotification('Mint/Evolve button not found', 'error', 2500);
        return;
    }

    const btnTextEl = document.getElementById('mintBtnText') || document.getElementById('fidUpdateBtnText') || btn;
    const originalText = btnTextEl.innerHTML;
    let restoreHtml = originalText;
    btnTextEl.textContent = 'GENERATING HTML...';
    btn.disabled = true;

    try {
        const fetchWithTimeout = async (url, options, timeoutMs) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, { ...(options || {}), signal: controller.signal });
                return res;
            } finally {
                clearTimeout(timer);
            }
        };

        // ИСПРАВЛЕНИЕ: Проверяем доступность BACKEND_URL
        if (typeof BACKEND_URL === 'undefined') {
            throw new Error('BACKEND_URL is not defined. Please refresh the page.');
        }

        // ИСПРАВЛЕНИЕ: Проверяем доступность userAddress
        if (!userAddress && !window.userAddress) {
            throw new Error('Wallet not connected. Please connect your wallet first.');
        }

        await checkFractalNetwork();
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        const currentUserAddress = userAddress || window.userAddress;
        // 2. Генерируем HTML код карточки
        const discountWhyEl = document.getElementById('discountWhy');
        const fennecWalletOnly =
            Number(
                window.auditIdentity?.metrics?.fennecWalletBalance ??
                    window.auditIdentity?.metrics?.fennec_wallet_balance ??
                    0
            ) || 0;
        const fennecLpValueUSD =
            Number(
                window.auditIdentity?.metrics?.fennecLpValueUSD ??
                    window.auditIdentity?.metrics?.fennec_lp_value_usd ??
                    window.auditIdentity?.metrics?.fennecLpValueUsd ??
                    0
            ) || 0;
        const hasBoxes = !!(
            window.auditIdentity?.metrics?.hasFennecBoxes ||
            window.auditIdentity?.metrics?.has_fennec_boxes ||
            window.auditIdentity?.metrics?.fennecBoxesCount > 0 ||
            window.auditIdentity?.metrics?.fennec_boxes_count > 0
        );
        const eligibleNow = hasBoxes || fennecWalletOnly >= 1000 || fennecLpValueUSD >= 1;
        if (discountWhyEl && window.__discountCheckPassed !== true && eligibleNow) {
            discountWhyEl.textContent = 'Discount available: click CHECK DISCOUNT ELIGIBILITY to unlock.';
        }

        const memRefs =
            window.__fennecMintChildRefs && typeof window.__fennecMintChildRefs === 'object'
                ? window.__fennecMintChildRefs
                : {};

        const mintChildManifestRef = String(
            memRefs.manifest ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).manifestRef ||
                PRIMARY_MANIFEST_REF ||
                DEFAULT_MANIFEST_URL ||
                localStorage.getItem('fennec_mint_child_manifest') ||
                ''
        ).trim();
        const mintChildLibRef = String(
            memRefs.lib ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).libRef ||
                PRIMARY_CHILD_LIB ||
                localStorage.getItem('fennec_mint_child_lib') ||
                ''
        ).trim();
        const mintChildConfigRef = String(
            memRefs.config ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).configRef ||
                PRIMARY_CHILD_CONFIG ||
                localStorage.getItem('fennec_mint_child_config') ||
                ''
        ).trim();

        const latestRefs = mintChildManifestRef
            ? await resolveLatestRefsFromManifest(mintChildManifestRef)
            : { libRef: '', configRef: '' };

        const resolvedLibRef = String(
            latestRefs.libRef ||
                mintChildLibRef ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).libRef ||
                PRIMARY_CHILD_LIB ||
                ''
        ).trim();
        const resolvedConfigRef = String(
            latestRefs.configRef ||
                mintChildConfigRef ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).configRef ||
                PRIMARY_CHILD_CONFIG ||
                ''
        ).trim();

        showNotification('🎨 Generating your Fennec ID...', 'info', 2000);
        const htmlCode = generateRecursiveChildHTML(window.auditIdentity, {
            libRef: resolvedLibRef,
            configRef: resolvedConfigRef,
            manifestRef: mintChildManifestRef,
            oracleEndpoint: BACKEND_URL,
            oracleAction: 'fractal_audit',
            pubkey: userPubkey
        });
        showNotification('✅ ID design generated successfully', 'success', 1500);

        // 2.1 Provenance: hash HTML + request server signature
        const htmlBytes = new TextEncoder().encode(htmlCode);
        const htmlHashBuf = await crypto.subtle.digest('SHA-256', htmlBytes);
        const htmlHashHex = Array.from(new Uint8Array(htmlHashBuf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const auditSnapshot =
            window.lastAuditApiData && typeof window.lastAuditApiData === 'object' ? window.lastAuditApiData : null;
        const provenanceClaim = {
            schema: 'fennec.provenance.v1',
            kind: 'mint',
            chain: 'fractal-bitcoin',
            address: currentUserAddress,
            html_sha256: htmlHashHex,
            ...(auditSnapshot ? { audit_data: auditSnapshot } : {})
        };

        btnTextEl.textContent = 'SIGNING PROVENANCE...';
        showNotification('🔏 Requesting provenance signature...', 'info', 2000);

        const provHttpRes = await fetchWithTimeout(
            `${BACKEND_URL}?action=sign_provenance&debug=1`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-public-key': userPubkey,
                    'x-address': currentUserAddress
                },
                body: JSON.stringify({ payload: provenanceClaim })
            },
            25000
        );

        if (!provHttpRes.ok) {
            const errorText = await provHttpRes.text().catch(() => '');
            let errorPayload = null;
            try {
                errorPayload = JSON.parse(errorText);
            } catch (_) {}
            throw new Error(
                `sign_provenance failed: ${provHttpRes.status} ${provHttpRes.statusText}. ${
                    errorPayload && typeof errorPayload === 'object' ? JSON.stringify(errorPayload) : errorText
                }`
            );
        }

        const provRes = await provHttpRes.json().catch(e => {
            throw new Error(`Failed to parse sign_provenance response: ${e.message || e.toString()}`);
        });

        if (!provRes || provRes.code !== 0 || !provRes.data) {
            const baseMsg = provRes?.error || provRes?.msg || 'Failed to sign provenance';
            let extra = '';
            try {
                if (provRes && typeof provRes === 'object' && provRes.details) {
                    extra = ` Details: ${JSON.stringify(provRes.details)}`;
                }
            } catch (_) {}
            throw new Error(`${baseMsg}${extra}`);
        }

        const provData = provRes.data;
        const provAlg = String(provData?.alg || '')
            .trim()
            .toUpperCase();
        const provSig = provData?.signature || null;
        if (provAlg === 'NONE' || !provSig) {
            try {
                const k = 'fennec_provenance_alg_none_warned';
                if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(k) === '1') {
                    // already warned
                } else {
                    try {
                        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, '1');
                    } catch (_) {}
                    if (typeof showNotification === 'function') {
                        showNotification(
                            '⚠️ Provenance signer not configured (alg NONE). Continuing without signature.',
                            'warning',
                            2600
                        );
                    }
                }
            } catch (_) {}
        } else {
            const stableSortObject = value => {
                if (value == null || typeof value !== 'object') return value;
                if (Array.isArray(value)) return value.map(stableSortObject);
                const keys = Object.keys(value).sort();
                const out = {};
                for (const k of keys) out[k] = stableSortObject(value[k]);
                return out;
            };
            const stableStringify = value => JSON.stringify(stableSortObject(value));
            const base64ToBytes = b64 => {
                const bin = atob(String(b64 || ''));
                const out = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
                return out;
            };

            const pubHttpRes = await fetchWithTimeout(
                `${BACKEND_URL}?action=provenance_pubkey`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json'
                    }
                },
                10000
            );
            const pubRes = await pubHttpRes.json().catch(() => null);
            const pubKeyId = String(pubRes?.data?.key_id || '').trim();
            const pubJwk = pubRes?.data?.public_key_jwk || null;
            const provKeyId = String(provData?.payload?.key_id || '').trim();
            if (!pubJwk || !pubKeyId) throw new Error('Missing provenance public key');
            if (!provData?.payload || !provData?.signature) throw new Error('Missing provenance signature');
            if (pubKeyId && provKeyId && pubKeyId !== provKeyId) throw new Error('Provenance key mismatch');
            if (String(provData?.payload?.address || '').trim() !== String(currentUserAddress || '').trim()) {
                throw new Error('Provenance address mismatch');
            }
            if (String(provData?.payload?.html_sha256 || '').trim() !== String(htmlHashHex || '').trim()) {
                throw new Error('Provenance HTML hash mismatch');
            }
            const verifyKey = await crypto.subtle.importKey(
                'jwk',
                pubJwk,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['verify']
            );
            const canonical = stableStringify(provData.payload);
            const ok = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                verifyKey,
                base64ToBytes(provData.signature),
                new TextEncoder().encode(canonical)
            );
            if (!ok) throw new Error('Invalid provenance signature');
            showNotification('✅ Provenance verified successfully', 'success', 1500);
        }

        const provenanceJson = JSON.stringify(provRes.data);
        const provenanceJsonSafe = provenanceJson.replace(/</g, '\\u003c');

        // 3. Кодируем HTML в Base64 для отправки
        const provenanceTag =
            '<scr' + 'ipt type="application/json" id="fennec-provenance">' + provenanceJsonSafe + '</scr' + 'ipt>';

        const htmlCodeWithProvenance = htmlCode.includes('</body>')
            ? htmlCode.replace('</body>', `${provenanceTag}</body>`)
            : htmlCode + provenanceTag;

        const base64Content = btoa(unescape(encodeURIComponent(htmlCodeWithProvenance)));
        const base64SizeBytes = (base64Content.length * 3) / 4;
        const maxSizeBytes = 365 * 1024;
        const sizeKB = (base64SizeBytes / 1024).toFixed(2);

        if (base64SizeBytes > maxSizeBytes) {
            throw new Error(`Card too large: ${sizeKB} KB (max: 365 KB).`);
        }

        btnTextEl.textContent = `CREATING ORDER... (${sizeKB} KB)`;
        showNotification(`📦 Creating inscription order (${sizeKB} KB)...`, 'info', 2000);

        const YOUR_WALLET = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        const BASE_PRICE_FB = 1;
        const hasDiscount = window.__discountCheckPassed === true && eligibleNow;
        const SERVICE_FEE = 0;

        restoreHtml =
            btn && btn.id === 'fidUpdateBtn'
                ? originalText
                : hasDiscount
                  ? 'MINT ID • <span style="text-decoration: line-through; opacity: 0.6;">1 FB</span> <span style="font-weight: bold;">0.5 FB (50% OFF!)</span>'
                  : 'MINT ID • 1 FB';

        const inscriptionBody = {
            receiveAddress: currentUserAddress,
            feeRate: 5,
            outputValue: 546,
            files: [
                {
                    filename: 'fennec_id.html',
                    dataURL: `data:text/html;base64,${base64Content}`
                }
            ]
        };

        if (SERVICE_FEE > 0) {
            inscriptionBody.devAddress = YOUR_WALLET;
            inscriptionBody.devFee = SERVICE_FEE;
        }

        const res = await fetchWithTimeout(
            `${BACKEND_URL}?action=create_inscription`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-public-key': userPubkey,
                    'x-address': currentUserAddress
                },
                body: JSON.stringify(inscriptionBody)
            },
            25000
        );

        if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unknown error');
            throw new Error(`API request failed: ${res.status} ${res.statusText}. ${errorText}`);
        }

        const json = await res.json().catch(e => {
            throw new Error(`Failed to parse API response: ${e.message || e.toString()}`);
        });

        if (json.code === 0) {
            if (!json.data) {
                throw new Error('API response missing data field');
            }

            const orderId = json.data.orderId;
            const payAddress = json.data.payAddress;
            const totalAmount = json.data.amount;

            if (!orderId || !payAddress || !totalAmount) {
                throw new Error(
                    `API response missing required fields. OrderId: ${orderId}, PayAddress: ${payAddress}, Amount: ${totalAmount}`
                );
            }

            if (typeof addPendingOperation === 'function') {
                addPendingOperation({
                    type: 'mint',
                    orderId: orderId,
                    address: currentUserAddress,
                    payAddress: payAddress,
                    amount: totalAmount,
                    status: 'pending',
                    timestamp: Date.now(),
                    htmlCode: htmlCodeWithProvenance,
                    html_sha256: htmlHashHex,
                    provenance: provRes.data
                });
            }

            if (typeof window.unisat === 'undefined') {
                throw new Error('UniSat wallet not found. Please install UniSat wallet extension.');
            }

            btnTextEl.textContent = 'OPENING WALLET...';
            showNotification('💳 Opening wallet for payment...', 'info', 2000);
            try {
                await new Promise(resolve =>
                    window.requestAnimationFrame ? window.requestAnimationFrame(resolve) : setTimeout(resolve, 0)
                );
            } catch (_) {}
            const feeRateOpt = Number(json.data?.feeRate || 0) || 0;
            if (feeRateOpt > 0) {
                await window.unisat.sendBitcoin(payAddress, totalAmount, { feeRate: feeRateOpt });
            } else {
                await window.unisat.sendBitcoin(payAddress, totalAmount);
            }

            const mintInfo = {
                orderId: orderId,
                address: currentUserAddress,
                timestamp: Date.now(),
                status: 'pending',
                htmlCode: htmlCodeWithProvenance,
                html_sha256: htmlHashHex,
                provenance: provRes.data
            };

            const allMints = JSON.parse(localStorage.getItem(fennecMintedCardsKey()) || '[]');
            mintInfo.id = `mint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            allMints.push(mintInfo);
            localStorage.setItem(fennecMintedCardsKey(), JSON.stringify(allMints));

            btnTextEl.innerHTML = restoreHtml;
            btn.disabled = false;

            showSuccess("Payment sent! Your Interactive ID is being minted. Check 'Pending Operations' tab.", true);
            showNotification(
                "🎉 Payment sent! Your Fennec ID is being minted on-chain. Track progress in 'Pending Operations' tab.",
                'success',
                5000
            );
        } else {
            throw new Error(json.msg || 'Order failed');
        }
    } catch (e) {
        console.error('Minting error:', e);
        let errorMessage = 'Unknown error occurred';

        if (e instanceof Event) {
            console.warn('Ignoring image loading event error - already handled');
            if (btn) {
                btnTextEl.innerHTML = restoreHtml;
                btn.disabled = false;
            }
            return;
        } else if (e && typeof e === 'object') {
            const candidates = [
                e.message,
                e.msg,
                e.error,
                e?.data?.message,
                e?.data?.msg,
                e?.data?.error,
                e?.details?.message,
                e?.details?.msg,
                e?.details?.error
            ].filter(Boolean);
            if (candidates.length) {
                errorMessage = String(candidates[0]);
            } else if (e.toString && typeof e.toString === 'function') {
                const str = e.toString();
                if (str !== '[object Event]' && str !== '[object Object]' && str !== '[object Error]') {
                    errorMessage = str;
                }
            } else {
                try {
                    const json = JSON.stringify(e);
                    if (json && json !== '{}' && json.length < 600) errorMessage = json;
                } catch (_) {}
            }
        } else if (typeof e === 'string') {
            errorMessage = e;
        }

        if (typeof showNotification === 'function') {
            showNotification('Minting failed: ' + errorMessage, 'error', 5000);
        } else {
            alert('Minting failed: ' + errorMessage);
        }
        if (btn) {
            btnTextEl.innerHTML = restoreHtml;
            btn.disabled = false;
        }
    }
}

window.burnAndRemintAuditCard = async function (event) {
    const btn = document.getElementById('fidUpdateBtn') || document.getElementById('mintBtn');
    const btnTextEl = document.getElementById('fidUpdateBtnText') || document.getElementById('mintBtnText') || btn;
    const originalText = btnTextEl ? btnTextEl.innerHTML : '';

    try {
        if (!userAddress && !window.userAddress) return window.connectWallet();
        if (!window.unisat) {
            alert('UniSat wallet not found');
            return;
        }

        const currentAddr = String(userAddress || window.userAddress || '').trim();

        try {
            const rl =
                typeof window.__fidCanRun === 'function'
                    ? window.__fidCanRun('update_id', currentAddr, 30000)
                    : { ok: true, waitMs: 0 };
            if (!rl.ok) {
                if (typeof showNotification === 'function') {
                    showNotification(`Please wait ${Math.ceil(rl.waitMs / 1000)}s`, 'warning', 1800);
                } else {
                    alert(`Please wait ${Math.ceil(rl.waitMs / 1000)}s`);
                }
                return;
            }
        } catch (_) {}

        window.__fennecChildDetectCache = window.__fennecChildDetectCache || {};

        const isFennecChildHtml = html => {
            const s = String(html || '');
            if (!s) return false;
            const hasLib = /<meta\s+name=["']fennec-lib["']\s+content=/i.test(s);
            const hasCfg = /<meta\s+name=["']fennec-config["']\s+content=/i.test(s);
            if (hasLib && hasCfg) return true;
            if (/<title>\s*Fennec\s*ID\s*<\/title>/i.test(s) && /id=["']fennec-root["']/i.test(s)) return true;
            return false;
        };

        const fetchInscriptionHtml = async inscriptionId => {
            const id = String(inscriptionId || '').trim();
            if (!id) return '';
            if (
                window.__fennecChildDetectCache &&
                window.__fennecChildDetectCache[id] &&
                window.__fennecChildDetectCache[id].html
            )
                return window.__fennecChildDetectCache[id].html;

            const url = `${BACKEND_URL}?action=inscription_content&inscriptionId=${encodeURIComponent(id)}`;
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) return '';
            const j = await res.json().catch(() => null);
            const data = j && typeof j === 'object' ? j.data || null : null;
            const ct = String(data?.contentType || data?.content_type || '');
            const html = String(data?.body || data?.contentBody || data?.content_body || '');
            if (!html) return '';
            const looksHtml = /<\s*!doctype\s+html/i.test(html) || /<html\b/i.test(html) || /<meta\b/i.test(html);
            if (
                !looksHtml &&
                !String(ct || '')
                    .toLowerCase()
                    .includes('text/')
            )
                return '';
            try {
                window.__fennecChildDetectCache[id] = window.__fennecChildDetectCache[id] || {};
                window.__fennecChildDetectCache[id].html = html;
            } catch (_) {}
            return html;
        };

        let pickedHtml = '';
        let inscriptionId = '';
        let cachedWalletInscriptions = null;
        let cachedWalletInscriptionsTotal = null;

        try {
            const stId = String((window.__fennecIdStatus && window.__fennecIdStatus.inscriptionId) || '').trim();
            if (stId) {
                inscriptionId = stId;
            }
        } catch (_) {}

        try {
            const m0 = window.__lastMintedCard;
            if (!inscriptionId) {
                const mId = String(m0?.inscriptionId || m0?.inscription_id || '').trim();
                if (mId) {
                    inscriptionId = mId;
                }
            }
        } catch (_) {}

        if (inscriptionId) {
            try {
                if (
                    window.__fennecChildDetectCache[inscriptionId] &&
                    'isChild' in window.__fennecChildDetectCache[inscriptionId]
                ) {
                    const ok = !!window.__fennecChildDetectCache[inscriptionId].isChild;
                    if (!ok) {
                        inscriptionId = '';
                    }
                }
            } catch (_) {}
        }

        if (!inscriptionId && currentAddr) {
            try {
                const inscriptions = await window.unisat.getInscriptions(0, 100);
                cachedWalletInscriptions = inscriptions;
                cachedWalletInscriptionsTotal = Number(inscriptions?.total);
                const list = Array.isArray(inscriptions?.list) ? inscriptions.list : [];
                const htmlCards = list
                    .filter(
                        x =>
                            x &&
                            (function () {
                                const ct = String(x.contentType || '').toLowerCase();
                                return !ct || ct.startsWith('text/');
                            })() &&
                            x.inscriptionId &&
                            x.spent !== true
                    )
                    .sort((a, b) => (Number(b.timestamp || 0) || 0) - (Number(a.timestamp || 0) || 0));

                const defaultScan = 8;
                for (const it of htmlCards.slice(0, defaultScan)) {
                    const id = String(it.inscriptionId || '').trim();
                    if (!id) continue;
                    if (window.__fennecChildDetectCache[id] && window.__fennecChildDetectCache[id].isChild === false)
                        continue;
                    const html = await fetchInscriptionHtml(id);
                    if (isFennecChildHtml(html)) {
                        inscriptionId = id;
                        pickedHtml = html;
                        window.__fennecChildDetectCache[id] = window.__fennecChildDetectCache[id] || {};
                        window.__fennecChildDetectCache[id].isChild = true;
                        break;
                    } else {
                        window.__fennecChildDetectCache[id] = window.__fennecChildDetectCache[id] || {};
                        window.__fennecChildDetectCache[id].isChild = false;
                    }
                }

                if (!inscriptionId) {
                    const scanMore =
                        localStorage.getItem('fennec_scan_more') === '1' ||
                        confirm('Could not auto-detect your Fennec ID yet. Scan more inscriptions? (may use more API)');
                    if (scanMore) {
                        for (const it of htmlCards.slice(defaultScan, 30)) {
                            const id = String(it.inscriptionId || '').trim();
                            if (!id) continue;
                            if (
                                window.__fennecChildDetectCache[id] &&
                                window.__fennecChildDetectCache[id].isChild === false
                            )
                                continue;
                            const html = await fetchInscriptionHtml(id);
                            if (isFennecChildHtml(html)) {
                                inscriptionId = id;
                                pickedHtml = html;
                                window.__fennecChildDetectCache[id] = window.__fennecChildDetectCache[id] || {};
                                window.__fennecChildDetectCache[id].isChild = true;
                                break;
                            } else {
                                window.__fennecChildDetectCache[id] = window.__fennecChildDetectCache[id] || {};
                                window.__fennecChildDetectCache[id].isChild = false;
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to scan inscriptions for Fennec child:', e);
            }
        }

        const verifyOwnedInWallet = async id => {
            const targetId = String(id || '').trim();
            if (!targetId) return null;

            const matchInList = list => {
                const arr = Array.isArray(list) ? list : [];
                for (const it of arr) {
                    const iid = String(it?.inscriptionId || '').trim();
                    if (!iid || iid !== targetId) continue;
                    if (it?.spent === true) return null;
                    const ownerAddr = String(it?.address || '').trim();
                    if (ownerAddr && currentAddr && ownerAddr !== currentAddr) return null;
                    return it;
                }
                return null;
            };

            try {
                const hitCached = matchInList(cachedWalletInscriptions?.list);
                if (hitCached) return hitCached;
            } catch (_) {}

            const PAGE = 100;
            let cursor = 0;
            let total =
                typeof cachedWalletInscriptionsTotal === 'number' && Number.isFinite(cachedWalletInscriptionsTotal)
                    ? cachedWalletInscriptionsTotal
                    : null;
            const maxScan = 300;
            while (cursor < maxScan && (total === null || cursor < total)) {
                const res = await window.unisat.getInscriptions(cursor, PAGE);
                if (total === null) {
                    total = typeof res?.total === 'number' && Number.isFinite(res.total) ? res.total : null;
                }
                try {
                    cachedWalletInscriptions = res;
                    cachedWalletInscriptionsTotal = total;
                } catch (_) {}
                const hit = matchInList(res?.list);
                if (hit) return hit;
                cursor += PAGE;
            }
            return null;
        };

        if (!inscriptionId) {
            const manual = String(
                prompt(
                    'Could not find your Fennec ID inscription to burn.\n\nPaste inscriptionId manually (or Cancel):',
                    ''
                ) || ''
            ).trim();

            if (manual) {
                inscriptionId = manual;
                try {
                    const html = await fetchInscriptionHtml(inscriptionId);
                    if (!isFennecChildHtml(html)) {
                        const force = confirm('This inscription does not look like a Fennec ID card. Burn anyway?');
                        if (!force) return;
                    } else {
                        pickedHtml = html;
                    }
                } catch (e) {
                    alert('Failed to load inscription content for the provided id.');
                    return;
                }
            } else {
                alert('Could not find your Fennec ID inscription to burn.');
                return;
            }
        }

        try {
            window.__lastMintedCard = {
                ...(window.__lastMintedCard || {}),
                inscriptionId,
                address: currentAddr,
                htmlCode: pickedHtml || (window.__lastMintedCard || {}).htmlCode
            };
        } catch (_) {}

        if (!confirm('This will BURN your current Fennec ID inscription and REMINT a new one. Continue?')) {
            return;
        }

        try {
            const owned = await verifyOwnedInWallet(inscriptionId);
            if (!owned) {
                alert(
                    'Safety check failed: this inscriptionId was not found in your wallet as an unspent inscription for the current address.\n\nRefusing to burn.'
                );
                return;
            }
        } catch (e) {
            alert('Safety check failed: could not verify inscription ownership via wallet API.\n\nRefusing to burn.');
            return;
        }

        const burnAddr = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';

        if (btn) btn.disabled = true;
        if (btnTextEl) btnTextEl.textContent = 'BUILDING TX...';
        await checkFractalNetwork();

        const fetchWithTimeout = async (url, options, timeoutMs) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, { ...(options || {}), signal: controller.signal });
                return res;
            } finally {
                clearTimeout(timer);
            }
        };

        if (!window.auditIdentity) {
            try {
                await window.runAudit(true);
            } catch (_) {}

            if (!window.auditIdentity && (pickedHtml || inscriptionId)) {
                try {
                    const tryParse = html => {
                        try {
                            const s = String(html || '');
                            const pattern =
                                '<scrip' + 't[^>]*id=["\\\']dna-data["\\\'][^>]*>([\\s\\S]*?)<\\/scrip' + 't>';
                            const m = s.match(new RegExp(pattern, 'i'));
                            if (!m || !m[1]) return null;
                            const raw = String(m[1] || '').trim();
                            if (!raw) return null;
                            return JSON.parse(raw);
                        } catch (_) {
                            return null;
                        }
                    };
                    let idObj = null;
                    if (pickedHtml) idObj = tryParse(pickedHtml);
                    if (!idObj && inscriptionId) {
                        const h = await fetchInscriptionHtml(inscriptionId);
                        if (h) {
                            pickedHtml = pickedHtml || h;
                            idObj = tryParse(h);
                        }
                    }
                    if (idObj && typeof idObj === 'object') {
                        window.auditIdentity = idObj;
                    }
                } catch (_) {}
            }

            if (!window.auditIdentity) {
                throw new Error('Unable to load your Fennec ID. Please click GET YOUR ID first.');
            }
        }

        window.auditIdentity = applyParentOverridesToIdentity(window.auditIdentity);

        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();
        const currentUserAddress = currentAddr;

        const memRefs =
            window.__fennecMintChildRefs && typeof window.__fennecMintChildRefs === 'object'
                ? window.__fennecMintChildRefs
                : {};

        const mintChildManifestRef = String(
            memRefs.manifest ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).manifestRef ||
                PRIMARY_MANIFEST_REF ||
                DEFAULT_MANIFEST_URL ||
                localStorage.getItem('fennec_mint_child_manifest') ||
                ''
        ).trim();
        const mintChildLibRef = String(
            memRefs.lib ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).libRef ||
                PRIMARY_CHILD_LIB ||
                localStorage.getItem('fennec_mint_child_lib') ||
                ''
        ).trim();
        const mintChildConfigRef = String(
            memRefs.config ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).configRef ||
                PRIMARY_CHILD_CONFIG ||
                localStorage.getItem('fennec_mint_child_config') ||
                ''
        ).trim();

        const latestRefs = mintChildManifestRef
            ? await resolveLatestRefsFromManifest(mintChildManifestRef)
            : { libRef: '', configRef: '' };

        const resolvedLibRef = String(
            latestRefs.libRef ||
                mintChildLibRef ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).libRef ||
                PRIMARY_CHILD_LIB ||
                ''
        ).trim();
        const resolvedConfigRef = String(
            latestRefs.configRef ||
                mintChildConfigRef ||
                ((window.getFennecCoreRefs && window.getFennecCoreRefs('mint')) || {}).configRef ||
                PRIMARY_CHILD_CONFIG ||
                ''
        ).trim();

        const htmlCode = generateRecursiveChildHTML(window.auditIdentity, {
            libRef: resolvedLibRef,
            configRef: resolvedConfigRef,
            manifestRef: mintChildManifestRef,
            oracleEndpoint: BACKEND_URL,
            oracleAction: 'fractal_audit',
            pubkey: userPubkey
        });

        const htmlBytes = new TextEncoder().encode(htmlCode);
        const htmlHashBuf = await crypto.subtle.digest('SHA-256', htmlBytes);
        const htmlHashHex = Array.from(new Uint8Array(htmlHashBuf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const provenanceClaim = {
            schema: 'fennec.provenance.v1',
            kind: 'mint',
            chain: 'fractal-bitcoin',
            address: currentUserAddress,
            html_sha256: htmlHashHex,
            ...(window.lastAuditApiData && typeof window.lastAuditApiData === 'object'
                ? { audit_data: window.lastAuditApiData }
                : {})
        };

        if (btnTextEl) btnTextEl.textContent = 'SIGNING PROVENANCE...';
        const provHttpRes = await fetchWithTimeout(
            `${BACKEND_URL}?action=sign_provenance&debug=1`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-public-key': userPubkey,
                    'x-address': currentUserAddress
                },
                body: JSON.stringify({ payload: provenanceClaim })
            },
            25000
        );
        if (!provHttpRes.ok) {
            const errorText = await provHttpRes.text().catch(() => '');
            let errorPayload = null;
            try {
                errorPayload = JSON.parse(errorText);
            } catch (_) {}
            throw new Error(
                `sign_provenance failed: ${provHttpRes.status} ${provHttpRes.statusText}. ${
                    errorPayload && typeof errorPayload === 'object' ? JSON.stringify(errorPayload) : errorText
                }`
            );
        }

        const provRes = await provHttpRes.json().catch(e => {
            throw new Error(`Failed to parse sign_provenance response: ${e.message || e.toString()}`);
        });

        if (!provRes || provRes.code !== 0 || !provRes.data) {
            throw new Error(provRes?.error || provRes?.msg || 'Failed to sign provenance');
        }

        const provData = provRes.data;
        const provAlg = String(provData?.alg || '')
            .trim()
            .toUpperCase();
        const provSig = provData?.signature || null;
        if (provAlg === 'NONE' || !provSig) {
            try {
                const k = 'fennec_provenance_alg_none_warned';
                if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(k) === '1') {
                    // already warned
                } else {
                    try {
                        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, '1');
                    } catch (_) {}
                    if (typeof showNotification === 'function') {
                        showNotification(
                            '⚠️ Provenance signer not configured (alg NONE). Continuing without signature.',
                            'warning',
                            2600
                        );
                    }
                }
            } catch (_) {}
        } else {
            const stableSortObject = value => {
                if (value == null || typeof value !== 'object') return value;
                if (Array.isArray(value)) return value.map(stableSortObject);
                const keys = Object.keys(value).sort();
                const out = {};
                for (const k of keys) out[k] = stableSortObject(value[k]);
                return out;
            };
            const stableStringify = value => JSON.stringify(stableSortObject(value));
            const base64ToBytes = b64 => {
                const bin = atob(String(b64 || ''));
                const out = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
                return out;
            };

            const pubHttpRes = await fetchWithTimeout(
                `${BACKEND_URL}?action=provenance_pubkey`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json'
                    }
                },
                10000
            );
            const pubRes = await pubHttpRes.json().catch(() => null);
            const pubKeyId = String(pubRes?.data?.key_id || '').trim();
            const pubJwk = pubRes?.data?.public_key_jwk || null;
            const provKeyId = String(provData?.payload?.key_id || '').trim();
            if (!pubJwk || !pubKeyId) throw new Error('Missing provenance public key');
            if (!provData?.payload || !provData?.signature) throw new Error('Missing provenance signature');
            if (pubKeyId && provKeyId && pubKeyId !== provKeyId) throw new Error('Provenance key mismatch');
            if (String(provData?.payload?.address || '').trim() !== String(currentUserAddress || '').trim()) {
                throw new Error('Provenance address mismatch');
            }
            if (String(provData?.payload?.html_sha256 || '').trim() !== String(htmlHashHex || '').trim()) {
                throw new Error('Provenance HTML hash mismatch');
            }
            const verifyKey = await crypto.subtle.importKey(
                'jwk',
                pubJwk,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['verify']
            );
            const canonical = stableStringify(provData.payload);
            const ok = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                verifyKey,
                base64ToBytes(provData.signature),
                new TextEncoder().encode(canonical)
            );
            if (!ok) throw new Error('Invalid provenance signature');
        }

        const provenanceJson = JSON.stringify(provRes.data);
        const provenanceJsonSafe = provenanceJson.replace(/</g, '\\u003c');
        const provenanceTag =
            '<scr' + 'ipt type="application/json" id="fennec-provenance">' + provenanceJsonSafe + '</scr' + 'ipt>';

        const htmlCodeWithProvenance = htmlCode.includes('</body>')
            ? htmlCode.replace('</body>', `${provenanceTag}</body>`)
            : htmlCode + provenanceTag;

        const base64Content = btoa(unescape(encodeURIComponent(htmlCodeWithProvenance)));
        const base64SizeBytes = (base64Content.length * 3) / 4;
        const maxSizeBytes = 365 * 1024;
        const sizeKB = (base64SizeBytes / 1024).toFixed(2);
        if (base64SizeBytes > maxSizeBytes) {
            throw new Error(`Card too large: ${sizeKB} KB (max: 365 KB).`);
        }

        const YOUR_WALLET = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        const BASE_PRICE_FB = 1;
        const SERVICE_FEE = 0;
        const inscriptionBody = {
            receiveAddress: currentUserAddress,
            feeRate: 5,
            outputValue: 546,
            files: [
                {
                    filename: 'fennec_id.html',
                    dataURL: `data:text/html;base64,${base64Content}`
                }
            ]
        };

        if (SERVICE_FEE > 0) {
            inscriptionBody.devAddress = YOUR_WALLET;
            inscriptionBody.devFee = SERVICE_FEE;
        }

        const burnFeeRate = Number(localStorage.getItem('fennec_burn_fee_rate') || '') || 0;
        const psbtFeeRate = burnFeeRate > 0 ? burnFeeRate : 5;

        if (btnTextEl) btnTextEl.textContent = 'CREATING ORDER + PSBT...';
        const psbtRes = await fetchWithTimeout(
            `${BACKEND_URL}?action=burn_remint_psbt`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-public-key': userPubkey,
                    'x-address': currentUserAddress
                },
                body: JSON.stringify({
                    address: currentUserAddress,
                    pubkey: userPubkey,
                    burnAddress: burnAddr,
                    burnInscriptionId: inscriptionId,
                    feeRate: psbtFeeRate,
                    inscriptionBody
                })
            },
            25000
        );
        if (!psbtRes.ok) {
            const t = await psbtRes.text().catch(() => '');
            throw new Error(`burn_remint_psbt failed: ${psbtRes.status}. ${t}`);
        }
        const psbtJson = await psbtRes.json().catch(e => {
            throw new Error(`Failed to parse burn_remint_psbt response: ${e.message || e.toString()}`);
        });
        if (!psbtJson || psbtJson.code !== 0 || !psbtJson.data?.psbt) {
            throw new Error(psbtJson?.msg || psbtJson?.error || 'burn_remint_psbt failed');
        }

        const orderId = psbtJson.data?.order?.orderId;
        const payAddress = psbtJson.data?.order?.payAddress;
        const totalAmount = psbtJson.data?.order?.amount;

        if (typeof addPendingOperation === 'function' && orderId) {
            addPendingOperation({
                type: 'mint',
                orderId: orderId,
                address: currentUserAddress,
                payAddress: payAddress,
                amount: totalAmount,
                status: 'pending',
                timestamp: Date.now(),
                htmlCode: htmlCodeWithProvenance,
                html_sha256: htmlHashHex,
                provenance: provRes.data,
                burnInscriptionId: inscriptionId,
                burnTo: burnAddr
            });
        }

        if (btnTextEl) btnTextEl.textContent = 'SIGNING TX...';
        try {
            await new Promise(resolve =>
                window.requestAnimationFrame ? window.requestAnimationFrame(resolve) : setTimeout(resolve, 0)
            );
        } catch (_) {}
        const signedPsbt = await window.unisat.signPsbt(psbtJson.data.psbt, { autoFinalized: true });

        if (btnTextEl) btnTextEl.textContent = 'BROADCASTING...';
        let broadcastTxid = '';
        if (typeof window.unisat.pushPsbt === 'function') {
            broadcastTxid = await window.unisat.pushPsbt(signedPsbt);
        } else {
            const pushRes = await fetch(`${BACKEND_URL}?action=push_psbt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-public-key': userPubkey,
                    'x-address': currentUserAddress
                },
                body: JSON.stringify({ psbt: signedPsbt })
            });
            const pushJson = await pushRes.json().catch(() => null);
            broadcastTxid = String(pushJson?.data?.txid || pushJson?.data || pushJson?.txid || '').trim();
        }

        try {
            const addr = (userAddress || window.userAddress || '').trim();
            const all = JSON.parse(localStorage.getItem(fennecMintedCardsKey()) || '[]');
            if (Array.isArray(all) && all.length) {
                let changed = false;
                for (const rec of all) {
                    if (!rec || typeof rec !== 'object') continue;
                    if (String(rec.address || '').trim() !== addr) continue;
                    if (String(rec.inscriptionId || '').trim() !== inscriptionId) continue;
                    if (!rec.burned) {
                        rec.burned = true;
                        rec.burnedAt = new Date().toISOString();
                        rec.burnedTo = burnAddr;
                        rec.burnedTxid = broadcastTxid || rec.burnedTxid;
                        changed = true;
                    }
                }
                if (changed) localStorage.setItem(fennecMintedCardsKey(), JSON.stringify(all));
            }
        } catch (e) {}

        try {
            if (window.__lastMintedCard && typeof window.__lastMintedCard === 'object') {
                window.__lastMintedCard.burned = true;
                window.__lastMintedCard.burnedTo = burnAddr;
                window.__lastMintedCard.burnedTxid = broadcastTxid || window.__lastMintedCard.burnedTxid;
            }
        } catch (e) {}

        try {
            const mintInfo = {
                orderId: orderId,
                address: currentUserAddress,
                timestamp: Date.now(),
                status: 'pending',
                htmlCode: htmlCodeWithProvenance,
                html_sha256: htmlHashHex,
                provenance: provRes.data,
                burnedFrom: inscriptionId,
                burnedTo: burnAddr,
                burnTxid: broadcastTxid
            };
            const allMints = JSON.parse(localStorage.getItem(fennecMintedCardsKey()) || '[]');
            mintInfo.id = `mint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            allMints.push(mintInfo);
            localStorage.setItem(fennecMintedCardsKey(), JSON.stringify(allMints));
        } catch (e) {}

        try {
            if (typeof checkPendingMints === 'function') {
                setTimeout(() => {
                    try {
                        checkPendingMints();
                    } catch (_) {}
                }, 5000);
            }
        } catch (_) {}

        showSuccess(
            `Transaction sent${broadcastTxid ? `: ${broadcastTxid}` : ''}. Mint order created. Check Pending Operations.`,
            true
        );
        showNotification(
            '🎉 ID Update Complete! Old card burned, new card minting. Track in Pending Operations.',
            'success',
            6000
        );
    } catch (e) {
        console.error('burnAndRemintAuditCard failed:', e);
        alert('Upgrade failed: ' + (e?.message || String(e)));
        try {
            if (btnTextEl) btnTextEl.innerHTML = originalText || 'UPGRADE YOUR ID';
        } catch (_) {}
        try {
            if (btn) btn.disabled = false;
        } catch (_) {}
    }
};

window.saveMintChildRefs = function () {
    try {
        const libEl = document.getElementById('mintChildLibRef');
        const cfgEl = document.getElementById('mintChildConfigRef');
        const manEl = document.getElementById('mintChildManifestRef');
        const statusEl = document.getElementById('mintRefsStatus');

        const lib = String(libEl?.value || '').trim();
        const cfg = String(cfgEl?.value || '').trim();
        const man = String(manEl?.value || '').trim();

        if (!window.__fennecMintChildRefs || typeof window.__fennecMintChildRefs !== 'object') {
            window.__fennecMintChildRefs = {};
        }
        window.__fennecMintChildRefs.lib = lib;
        window.__fennecMintChildRefs.config = cfg;
        window.__fennecMintChildRefs.manifest = man;

        const ok = (!!lib || !!man) && (!!cfg || !!man);
        if (statusEl) {
            statusEl.textContent = ok
                ? 'Saved (session only).'
                : 'Saved. Need (lib or manifest) AND (config or manifest).';
        }
    } catch (e) {}
};

window.usePrimaryMintChildRefs = function () {
    try {
        const core =
            window.getFennecCoreRefs && typeof window.getFennecCoreRefs === 'function'
                ? window.getFennecCoreRefs('mint')
                : null;
        const lib = String((core && core.libRef) || PRIMARY_CHILD_LIB || '').trim();
        const cfg = String((core && core.configRef) || PRIMARY_CHILD_CONFIG || '').trim();
        const man = String((core && core.manifestRef) || PRIMARY_MANIFEST_REF || DEFAULT_MANIFEST_URL || '').trim();

        if (!window.__fennecMintChildRefs || typeof window.__fennecMintChildRefs !== 'object') {
            window.__fennecMintChildRefs = {};
        }
        window.__fennecMintChildRefs.lib = lib;
        window.__fennecMintChildRefs.config = cfg;
        window.__fennecMintChildRefs.manifest = man;

        try {
            const libEl = document.getElementById('mintChildLibRef');
            const cfgEl = document.getElementById('mintChildConfigRef');
            const manEl = document.getElementById('mintChildManifestRef');
            if (libEl) libEl.value = lib;
            if (cfgEl) cfgEl.value = cfg;
            if (manEl) manEl.value = man;
        } catch (_) {}

        try {
            const statusEl = document.getElementById('mintRefsStatus');
            if (statusEl) statusEl.textContent = 'Primary on-chain refs applied.';
        } catch (_) {}
    } catch (_) {}
};

window.useFallbackMintChildRefs = window.usePrimaryMintChildRefs;

window.clearMintChildRefs = function () {
    try {
        if (!window.__fennecMintChildRefs || typeof window.__fennecMintChildRefs !== 'object') {
            window.__fennecMintChildRefs = {};
        }
        window.__fennecMintChildRefs.lib = '';
        window.__fennecMintChildRefs.config = '';
        window.__fennecMintChildRefs.manifest = '';
        try {
            const libEl = document.getElementById('mintChildLibRef');
            const cfgEl = document.getElementById('mintChildConfigRef');
            const manEl = document.getElementById('mintChildManifestRef');
            if (libEl) libEl.value = '';
            if (cfgEl) cfgEl.value = '';
            if (manEl) manEl.value = '';
        } catch (_) {}
        try {
            const statusEl = document.getElementById('mintRefsStatus');
            if (statusEl) statusEl.textContent = 'Refs cleared.';
        } catch (_) {}
    } catch (_) {}
};

window.refreshCardMetadata = async function (event) {
    const btn = document.getElementById('fidRefreshBtn');
    const btnTextEl = document.getElementById('fidRefreshBtnText') || btn;
    const originalText = btnTextEl ? btnTextEl.innerHTML : 'Refresh Metadata';

    try {
        const addr = String(window.userAddress || userAddress || '').trim();
        try {
            const rl =
                typeof window.__fidCanRun === 'function'
                    ? window.__fidCanRun('refresh_metadata', addr, 30000)
                    : { ok: true, waitMs: 0 };
            if (!rl.ok) {
                if (typeof showNotification === 'function') {
                    showNotification(`Please wait ${Math.ceil(rl.waitMs / 1000)}s`, 'warning', 1800);
                } else {
                    alert(`Please wait ${Math.ceil(rl.waitMs / 1000)}s`);
                }
                return;
            }
        } catch (_) {}

        if (btn) btn.disabled = true;
        if (btnTextEl) btnTextEl.innerHTML = 'Refreshing...';

        const existingId = String((window.__fennecIdStatus && window.__fennecIdStatus.inscriptionId) || '').trim();

        if (!existingId) {
            alert('No Fennec ID found to refresh');
            return;
        }

        await loadExistingCardIntoIframe(existingId);

        if (btnTextEl) btnTextEl.innerHTML = 'Refreshed!';
        setTimeout(() => {
            if (btnTextEl) btnTextEl.innerHTML = originalText;
            if (btn) btn.disabled = false;
        }, 2000);
    } catch (e) {
        console.error('refreshCardMetadata failed:', e);
        alert('Failed to refresh metadata: ' + (e?.message || String(e)));
        if (btnTextEl) btnTextEl.innerHTML = originalText;
        if (btn) btn.disabled = false;
    }
};

window.inscribeFennecCorePack = async function () {
    const statusEl = document.getElementById('mintRefsStatus');
    const setStatus = t => {
        try {
            if (statusEl) statusEl.textContent = String(t || '');
        } catch (e) {}
    };

    try {
        if (!userAddress && !window.userAddress) {
            setStatus('Connect wallet first.');
            if (typeof window.connectWallet === 'function') window.connectWallet();
            return;
        }

        await checkFractalNetwork();
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const toDataUrlFromText = (text, mime) => {
            const mt = String(mime || 'text/plain');
            const b64 = btoa(unescape(encodeURIComponent(String(text || ''))));
            return `data:${mt};base64,${b64}`;
        };
        const fetchText = async url => {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
            return await res.text();
        };
        const createOrder = async files => {
            const createRes = await fetch(`${BACKEND_URL}?action=create_inscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiveAddress: userAddress || window.userAddress,
                    feeRate: 2,
                    outputValue: 546,
                    files
                })
            }).then(r => r.json());
            if (!createRes || createRes.code !== 0) throw new Error(createRes?.msg || 'Failed to create inscription');
            return createRes;
        };
        const autoPayIfNeeded = async createRes => {
            const payAddress = createRes?.data?.payAddress;
            const payAmountSatoshis = createRes?.data?.amount || 0;
            const paidAmountSatoshis = createRes?.data?.paidAmount || 0;
            if (payAddress && payAmountSatoshis > 0 && paidAmountSatoshis < payAmountSatoshis) {
                if (typeof window.unisat?.sendBitcoin === 'function') {
                    await window.unisat.sendBitcoin(payAddress, payAmountSatoshis, {
                        feeRate: createRes?.data?.feeRate || 2
                    });
                } else {
                    throw new Error(`Pay ${payAmountSatoshis / 100000000} FB to ${payAddress}`);
                }
            }
        };
        const waitForOrder = async (orderId, timeoutMs) => {
            const deadline = Date.now() + (Number(timeoutMs || 0) || 12 * 60 * 1000);
            while (Date.now() < deadline) {
                const statusRes = await fetch(
                    `${BACKEND_URL}?action=inscription_status&orderId=${encodeURIComponent(orderId)}`,
                    { cache: 'no-store' }
                ).then(r => r.json());
                const d = statusRes && statusRes.data ? statusRes.data : null;
                const files = d && Array.isArray(d.files) ? d.files : [];
                const status = String(d?.status || '').toLowerCase();
                const hasAnyId = files.some(f => f && (f.inscriptionId || f.inscription_id));
                if (status === 'minted' || hasAnyId) {
                    return { statusRes, files };
                }
                if (status === 'closed' || status === 'refunded') {
                    throw new Error('Order closed/refunded');
                }
                await sleep(4000);
            }
            throw new Error('Timeout waiting for inscription');
        };
        const pickFileId = (files, pred, fallbackIndex) => {
            const f = (files || []).find(x => {
                const name = String(x?.filename || x?.fileName || '').toLowerCase();
                return pred(name);
            });
            const id = f?.inscriptionId || f?.inscription_id;
            if (id) return String(id);
            const fallback = (files || [])[fallbackIndex];
            return String(fallback?.inscriptionId || fallback?.inscription_id || '').trim();
        };

        const downloadTextFile = (text, filename, mimeType) => {
            const blob = new Blob([String(text || '')], { type: String(mimeType || 'application/json') });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };

        setStatus('Fetching lib/config…');
        const libText = await fetchText('/recursive_inscriptions/fennec_lib_v2.js');
        const cfgText = await fetchText('/recursive_inscriptions/fennec_config_v1.json');

        setStatus('Creating order (lib + config)…');
        const coreCreate = await createOrder([
            { filename: 'fennec_lib_v2.js', dataURL: toDataUrlFromText(libText, 'application/javascript') },
            { filename: 'fennec_config_v1.json', dataURL: toDataUrlFromText(cfgText, 'application/json') }
        ]);

        const coreOrderId = coreCreate?.data?.orderId || coreCreate?.data?.id;
        if (!coreOrderId) throw new Error('No orderId returned');

        setStatus('Paying…');
        await autoPayIfNeeded(coreCreate);

        setStatus('Waiting for lib/config inscriptions…');
        const coreReady = await waitForOrder(coreOrderId);
        const libId = pickFileId(coreReady.files, n => n.includes('lib') && n.endsWith('.js'), 0);
        const cfgId = pickFileId(coreReady.files, n => n.includes('config') && n.endsWith('.json'), 1);
        if (!libId || !cfgId) throw new Error('Missing lib/config inscriptionId');

        if (!window.__fennecMintChildRefs || typeof window.__fennecMintChildRefs !== 'object') {
            window.__fennecMintChildRefs = {};
        }
        window.__fennecMintChildRefs.lib = libId;
        window.__fennecMintChildRefs.config = cfgId;

        try {
            const libEl = document.getElementById('mintChildLibRef');
            const cfgEl = document.getElementById('mintChildConfigRef');
            if (libEl) libEl.value = libId;
            if (cfgEl) cfgEl.value = cfgId;
        } catch (e) {}

        const manifestUrl = String(DEFAULT_MANIFEST_URL || '').trim();
        if (!manifestUrl) {
            throw new Error('No DEFAULT_MANIFEST_URL (run on your production domain, not localhost).');
        }

        const manifestObj = {
            schema: 'fennec.manifest.v1',
            version: 1,
            updated_at: new Date().toISOString(),
            latest: {
                lib: libId,
                config: cfgId
            }
        };
        const manifestJsonPretty = JSON.stringify(manifestObj, null, 2);
        downloadTextFile(manifestJsonPretty, 'fennec_manifest_live.json', 'application/json');

        if (!window.__fennecMintChildRefs || typeof window.__fennecMintChildRefs !== 'object') {
            window.__fennecMintChildRefs = {};
        }
        window.__fennecMintChildRefs.manifest = manifestUrl;
        try {
            const manEl = document.getElementById('mintChildManifestRef');
            if (manEl) manEl.value = manifestUrl;
        } catch (e) {}

        setStatus(
            'Done. Deploy downloaded fennec_manifest_live.json to /recursive_inscriptions/fennec_manifest_live.json, then mint.'
        );
    } catch (e) {
        setStatus('ERROR: ' + (e?.message || String(e)));
    }
};

window.inscribeFennecManifestOnly = async function () {
    const statusEl = document.getElementById('mintRefsStatus');
    const setStatus = t => {
        try {
            if (statusEl) statusEl.textContent = String(t || '');
        } catch (e) {}
    };

    try {
        if (!userAddress && !window.userAddress) {
            setStatus('Connect wallet first.');
            if (typeof window.connectWallet === 'function') window.connectWallet();
            return;
        }

        await checkFractalNetwork();
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        const libEl = document.getElementById('mintChildLibRef');
        const cfgEl = document.getElementById('mintChildConfigRef');
        const manEl = document.getElementById('mintChildManifestRef');
        const memRefs =
            window.__fennecMintChildRefs && typeof window.__fennecMintChildRefs === 'object'
                ? window.__fennecMintChildRefs
                : {};
        const libId = String(libEl?.value || memRefs.lib || localStorage.getItem('fennec_mint_child_lib') || '').trim();
        const cfgId = String(
            cfgEl?.value || memRefs.config || localStorage.getItem('fennec_mint_child_config') || ''
        ).trim();
        if (!libId || !cfgId) throw new Error('Need lib + config refs first.');

        const toDataUrlFromText = (text, mime) => {
            const mt = String(mime || 'text/plain');
            const b64 = btoa(unescape(encodeURIComponent(String(text || ''))));
            return `data:${mt};base64,${b64}`;
        };
        const createOrder = async files => {
            const createRes = await fetch(`${BACKEND_URL}?action=create_inscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiveAddress: userAddress || window.userAddress,
                    feeRate: 2,
                    outputValue: 546,
                    files
                })
            }).then(r => r.json());
            if (!createRes || createRes.code !== 0) throw new Error(createRes?.msg || 'Failed to create inscription');
            return createRes;
        };
        const autoPayIfNeeded = async createRes => {
            const payAddress = createRes?.data?.payAddress;
            const payAmountSatoshis = createRes?.data?.amount || 0;
            const paidAmountSatoshis = createRes?.data?.paidAmount || 0;
            if (payAddress && payAmountSatoshis > 0 && paidAmountSatoshis < payAmountSatoshis) {
                if (typeof window.unisat?.sendBitcoin === 'function') {
                    await window.unisat.sendBitcoin(payAddress, payAmountSatoshis, {
                        feeRate: createRes?.data?.feeRate || 2
                    });
                } else {
                    throw new Error(`Pay ${payAmountSatoshis / 100000000} FB to ${payAddress}`);
                }
            }
        };
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const waitForOrder = async (orderId, timeoutMs) => {
            const deadline = Date.now() + (Number(timeoutMs || 0) || 12 * 60 * 1000);
            while (Date.now() < deadline) {
                const statusRes = await fetch(
                    `${BACKEND_URL}?action=inscription_status&orderId=${encodeURIComponent(orderId)}`,
                    { cache: 'no-store' }
                ).then(r => r.json());
                const d = statusRes && statusRes.data ? statusRes.data : null;
                const files = d && Array.isArray(d.files) ? d.files : [];
                const status = String(d?.status || '').toLowerCase();
                const hasAnyId = files.some(f => f && (f.inscriptionId || f.inscription_id));
                if (status === 'minted' || hasAnyId) {
                    return { statusRes, files };
                }
                if (status === 'closed' || status === 'refunded') {
                    throw new Error('Order closed/refunded');
                }
                await sleep(4000);
            }
            throw new Error('Timeout waiting for inscription');
        };

        const manifestObj = {
            schema: 'fennec.manifest.v1',
            version: 1,
            updated_at: new Date().toISOString(),
            latest: {
                lib: libId,
                config: cfgId
            }
        };
        const manifestJsonPretty = JSON.stringify(manifestObj, null, 2);

        setStatus('Creating order (manifest)…');
        const createRes = await createOrder([
            {
                filename: 'fennec_manifest_live.json',
                dataURL: toDataUrlFromText(manifestJsonPretty, 'application/json')
            }
        ]);
        const orderId = createRes?.data?.orderId || createRes?.data?.id;
        if (!orderId) throw new Error('No orderId returned');

        setStatus('Paying…');
        await autoPayIfNeeded(createRes);

        setStatus('Waiting for manifest inscription…');
        const ready = await waitForOrder(orderId);
        const files = ready.files || [];
        const f0 = files[0];
        const manId = String(f0?.inscriptionId || f0?.inscription_id || '').trim();
        if (!manId) throw new Error('Missing manifest inscriptionId');

        if (!window.__fennecMintChildRefs || typeof window.__fennecMintChildRefs !== 'object') {
            window.__fennecMintChildRefs = {};
        }
        window.__fennecMintChildRefs.manifest = manId;
        try {
            if (manEl) manEl.value = manId;
        } catch (_) {}

        setStatus('Manifest inscribed and applied.');
    } catch (e) {
        setStatus('ERROR: ' + (e?.message || String(e)));
    }
};

window.inscribeFennecAssetsAndConfig = async function () {
    const statusEl = document.getElementById('mintRefsStatus');
    const setStatus = t => {
        try {
            if (statusEl) statusEl.textContent = String(t || '');
        } catch (e) {}
    };

    try {
        const filesList = Array.isArray(window.__fennecMintAssetsFiles) ? window.__fennecMintAssetsFiles : [];
        if (!filesList.length) {
            throw new Error('No assets selected. Use the folder picker first.');
        }

        if (!userAddress && !window.userAddress) {
            setStatus('Connect wallet first.');
            if (typeof window.connectWallet === 'function') window.connectWallet();
            return;
        }

        await checkFractalNetwork();
        if (!userPubkey) userPubkey = await window.unisat.getPublicKey();

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const readAsDataUrl = file =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('Failed to read file: ' + (file?.name || '')));
                reader.readAsDataURL(file);
            });
        const toDataUrlFromText = (text, mime) => {
            const mt = String(mime || 'text/plain');
            const b64 = btoa(unescape(encodeURIComponent(String(text || ''))));
            return `data:${mt};base64,${b64}`;
        };
        const fetchText = async url => {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
            return await res.text();
        };
        const createOrder = async files => {
            const createRes = await fetch(`${BACKEND_URL}?action=create_inscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiveAddress: userAddress || window.userAddress,
                    feeRate: 2,
                    outputValue: 546,
                    files
                })
            }).then(r => r.json());
            if (!createRes || createRes.code !== 0) throw new Error(createRes?.msg || 'Failed to create inscription');
            return createRes;
        };
        const autoPayIfNeeded = async createRes => {
            const payAddress = createRes?.data?.payAddress;
            const payAmountSatoshis = createRes?.data?.amount || 0;
            const paidAmountSatoshis = createRes?.data?.paidAmount || 0;
            if (payAddress && payAmountSatoshis > 0 && paidAmountSatoshis < payAmountSatoshis) {
                if (typeof window.unisat?.sendBitcoin === 'function') {
                    await window.unisat.sendBitcoin(payAddress, payAmountSatoshis, {
                        feeRate: createRes?.data?.feeRate || 2
                    });
                } else {
                    throw new Error(`Pay ${payAmountSatoshis / 100000000} FB to ${payAddress}`);
                }
            }
        };
        const waitForOrder = async (orderId, timeoutMs) => {
            const deadline = Date.now() + (Number(timeoutMs || 0) || 18 * 60 * 1000);
            while (Date.now() < deadline) {
                const statusRes = await fetch(
                    `${BACKEND_URL}?action=inscription_status&orderId=${encodeURIComponent(orderId)}`,
                    { cache: 'no-store' }
                ).then(r => r.json());
                const d = statusRes && statusRes.data ? statusRes.data : null;
                const files = d && Array.isArray(d.files) ? d.files : [];
                const status = String(d?.status || '').toLowerCase();
                const readyCount = files.filter(f => f && (f.inscriptionId || f.inscription_id)).length;
                if (readyCount === files.length && files.length > 0) {
                    return { statusRes, files };
                }
                if (status === 'minted' && files.length > 0) {
                    return { statusRes, files };
                }
                if (status === 'closed' || status === 'refunded') {
                    throw new Error('Order closed/refunded');
                }
                await sleep(4500);
            }
            throw new Error('Timeout waiting for inscription');
        };
        const downloadTextFile = (text, filename, mimeType) => {
            const blob = new Blob([String(text || '')], { type: String(mimeType || 'application/json') });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };

        const lower = s => String(s || '').toLowerCase();
        const allFiles = filesList.slice();
        const findByRegex = re => allFiles.find(f => re.test(lower(f?.name || '')));
        const extOf = name => {
            const m = String(name || '')
                .toLowerCase()
                .match(/\.(png|jpg|jpeg|webp|gif)$/);
            return m ? m[1] : 'png';
        };

        const bgDefs = [
            {
                key: 'DRIFTER',
                prefer: /^bg_drifter_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^drifter\.(png|jpg|jpeg|webp)$/i
            },
            {
                key: 'WALKER',
                prefer: /^bg_walker_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^walker\.(png|jpg|jpeg|webp)$/i
            },
            {
                key: 'KEEPER',
                prefer: /^bg_keeper_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^keeper\.(png|jpg|jpeg|webp)$/i
            },
            {
                key: 'ENGINEER',
                prefer: /^bg_engineer_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^engineer\.(png|jpg|jpeg|webp)$/i
            },
            {
                key: 'MERCHANT',
                prefer: /^bg_merchant_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^merchant\.(png|jpg|jpeg|webp)$/i
            },
            {
                key: 'SHAMAN',
                prefer: /^bg_shaman_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^shaman\.(png|jpg|jpeg|webp)$/i
            },
            {
                key: 'LORD',
                prefer: /^bg_lord_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^oasis\.(png|jpg|jpeg|webp)$/i
            },
            {
                key: 'PRIME',
                prefer: /^bg_prime_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^prime\.(png|jpg|jpeg|webp)$/i
            },
            {
                key: 'SINGULARITY',
                prefer: /^bg_singularity_.*\.(png|jpg|jpeg|webp)$/i,
                fallback: /^singularity\.(png|jpg|jpeg|webp)$/i
            }
        ];
        const badgeDefs = [
            {
                cfg: 'GENESIS',
                prefer: /^badge_genesis_.*\.(png|webp)$/i,
                fallback: /^badge_genesis\.(png|jpg|jpeg|webp)$/i
            },
            {
                cfg: 'WHALE',
                prefer: /^badge_whale_.*\.(png|webp)$/i,
                fallback: /^badge_whale\.(png|jpg|jpeg|webp)$/i
            },
            {
                cfg: 'PROVIDER',
                prefer: /^badge_provider_.*\.(png|webp)$/i,
                fallback: /^badge_provider\.(png|jpg|jpeg|webp)$/i
            },
            {
                cfg: 'FENNEC MAXI',
                prefer: /^badge_fennec_maxi_.*\.(png|webp)$/i,
                fallback: /^badge_maxi\.(png|jpg|jpeg|webp)$/i
            },
            {
                cfg: 'ARTIFACT HUNTER',
                prefer: /^badge_artifact_hunter_.*\.(png|webp)$/i,
                fallback: /^badge_collector\.(png|jpg|jpeg|webp)$/i
            },
            {
                cfg: 'RUNE KEEPER',
                prefer: /^badge_rune_keeper_.*\.(png|webp)$/i,
                fallback: /^badge_rune\.(png|jpg|jpeg|webp)$/i
            },
            {
                cfg: 'MEMPOOL RIDER',
                prefer: /^badge_mempool_rider_.*\.(png|webp)$/i,
                fallback: /^badge_mempool_rider\.(png|jpg|jpeg|webp)$/i
            },
            {
                cfg: 'SAND SWEEPER',
                prefer: /^badge_sand_sweeper_.*\.(png|webp)$/i,
                fallback: /^badge_sweeper\.(png|jpg|jpeg|webp)$/i
            }
        ];

        const assetsToInscribe = [];
        for (const d of bgDefs) {
            const f = findByRegex(d.prefer) || findByRegex(d.fallback);
            if (!f) continue;
            const ext = extOf(f.name);
            assetsToInscribe.push({
                kind: 'bg',
                key: d.key,
                file: f,
                filename: `bg_${d.key.toLowerCase()}.${ext}`
            });
        }
        for (const d of badgeDefs) {
            const f = findByRegex(d.prefer) || findByRegex(d.fallback);
            if (!f) continue;
            const ext = extOf(f.name);
            assetsToInscribe.push({
                kind: 'badge',
                key: d.cfg,
                file: f,
                filename: `badge_${d.cfg.toLowerCase().replace(/\s+/g, '_')}.${ext}`
            });
        }

        const logoFile = findByRegex(/^phav\.(png|jpg|jpeg|webp)$/i);
        if (logoFile) {
            assetsToInscribe.push({
                kind: 'misc',
                key: 'LOGO',
                file: logoFile,
                filename: `logo.${extOf(logoFile.name)}`
            });
        }
        const heartFile = findByRegex(/^heart\.(png|jpg|jpeg|webp)$/i);
        if (heartFile) {
            assetsToInscribe.push({
                kind: 'misc',
                key: 'HEART',
                file: heartFile,
                filename: `heart.${extOf(heartFile.name)}`
            });
        }
        const watermarkFile = findByRegex(/^phav\.(png|jpg|jpeg|webp)$/i);
        if (watermarkFile) {
            assetsToInscribe.push({
                kind: 'misc',
                key: 'WATERMARK',
                file: watermarkFile,
                filename: `watermark.${extOf(watermarkFile.name)}`
            });
        }

        if (!assetsToInscribe.length) {
            throw new Error(
                'No known assets found in selected folder. Use asset_prep output + include phav.png/heart.png if you want misc.'
            );
        }

        const tooBig = assetsToInscribe.find(a => (a.file?.size || 0) > 370 * 1024);
        if (tooBig) {
            throw new Error(`File too large (>370KB): ${tooBig.file?.name || ''}. Use asset_prep to compress.`);
        }

        setStatus(`Encoding assets (${assetsToInscribe.length})…`);
        for (const a of assetsToInscribe) {
            a.dataURL = await readAsDataUrl(a.file);
        }

        const chunk = (arr, n) => {
            const out = [];
            for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
            return out;
        };

        const inscribedIdsByFilename = {};
        const batches = chunk(assetsToInscribe, 9);
        let batchNum = 0;
        for (const b of batches) {
            batchNum++;
            setStatus(`Creating assets order ${batchNum}/${batches.length}…`);
            const createRes = await createOrder(b.map(x => ({ filename: x.filename, dataURL: x.dataURL })));
            const orderId = createRes?.data?.orderId || createRes?.data?.id;
            if (!orderId) throw new Error('No assets orderId returned');
            setStatus(`Paying assets order ${batchNum}/${batches.length}…`);
            await autoPayIfNeeded(createRes);
            setStatus(`Waiting assets order ${batchNum}/${batches.length}…`);
            const ready = await waitForOrder(orderId);
            for (const f of ready.files || []) {
                const fn = String(f?.filename || f?.fileName || '');
                const id = String(f?.inscriptionId || f?.inscription_id || '').trim();
                if (fn && id) inscribedIdsByFilename[fn] = id;
            }
        }

        const bgMap = {};
        const badgeMap = {};
        const miscMap = {};
        for (const a of assetsToInscribe) {
            const id = String(inscribedIdsByFilename[a.filename] || '').trim();
            if (!id) continue;
            if (a.kind === 'bg') bgMap[a.key] = id;
            if (a.kind === 'badge') badgeMap[a.key] = id;
            if (a.kind === 'misc') miscMap[a.key] = id;
        }

        setStatus('Building config…');
        const baseCfgText = await fetchText('/recursive_inscriptions/fennec_config_v1.json');
        const baseCfg = JSON.parse(baseCfgText);
        baseCfg.assets = baseCfg.assets || {};
        baseCfg.assets.backgrounds = baseCfg.assets.backgrounds || {};
        baseCfg.assets.badges = baseCfg.assets.badges || {};
        baseCfg.assets.misc = baseCfg.assets.misc || {};

        for (const [k, v] of Object.entries(bgMap)) baseCfg.assets.backgrounds[k] = v;
        if (bgMap.DRIFTER) baseCfg.assets.backgrounds['*'] = bgMap.DRIFTER;
        for (const [k, v] of Object.entries(badgeMap)) baseCfg.assets.badges[k] = v;
        for (const [k, v] of Object.entries(miscMap)) baseCfg.assets.misc[k] = v;

        setStatus('Inscribing config…');
        const cfgCreate = await createOrder([
            {
                filename: 'fennec_config_v1.json',
                dataURL: toDataUrlFromText(JSON.stringify(baseCfg), 'application/json')
            }
        ]);
        const cfgOrderId = cfgCreate?.data?.orderId || cfgCreate?.data?.id;
        if (!cfgOrderId) throw new Error('No config orderId');
        setStatus('Paying config…');
        await autoPayIfNeeded(cfgCreate);
        setStatus('Waiting config…');
        const cfgReady = await waitForOrder(cfgOrderId);
        const cfgFile0 = (cfgReady.files || [])[0] || null;
        const cfgId = String(cfgFile0?.inscriptionId || cfgFile0?.inscription_id || '').trim();
        if (!cfgId) throw new Error('Missing config inscriptionId');

        if (!window.__fennecMintChildRefs || typeof window.__fennecMintChildRefs !== 'object') {
            window.__fennecMintChildRefs = {};
        }
        window.__fennecMintChildRefs.config = cfgId;
        try {
            const cfgEl = document.getElementById('mintChildConfigRef');
            if (cfgEl) cfgEl.value = cfgId;
        } catch (e) {}

        const libId = String(
            (window.__fennecMintChildRefs && typeof window.__fennecMintChildRefs === 'object'
                ? window.__fennecMintChildRefs.lib
                : '') ||
                localStorage.getItem('fennec_mint_child_lib') ||
                ''
        ).trim();
        if (!libId) {
            setStatus('Config ready. Now run INSCRIBE CORE PACK to inscribe lib, then deploy manifest.');
            return;
        }

        const manifestUrl = String(DEFAULT_MANIFEST_URL || '').trim();
        if (!manifestUrl) throw new Error('No DEFAULT_MANIFEST_URL');

        const manifestObj = {
            schema: 'fennec.manifest.v1',
            version: 1,
            updated_at: new Date().toISOString(),
            latest: {
                lib: libId,
                config: cfgId
            }
        };
        downloadTextFile(JSON.stringify(manifestObj, null, 2), 'fennec_manifest_live.json', 'application/json');

        if (!window.__fennecMintChildRefs || typeof window.__fennecMintChildRefs !== 'object') {
            window.__fennecMintChildRefs = {};
        }
        window.__fennecMintChildRefs.manifest = manifestUrl;
        try {
            const manEl = document.getElementById('mintChildManifestRef');
            if (manEl) manEl.value = manifestUrl;
        } catch (e) {}

        setStatus('Done. Deploy downloaded fennec_manifest_live.json (overwriting existing), then mint.');
    } catch (e) {
        setStatus('ERROR: ' + (e?.message || String(e)));
    }
};

window.checkDiscountEligibility = function () {
    try {
        if (!window.auditIdentity || !window.auditIdentity.metrics) {
            return;
        }
        const metrics = window.auditIdentity.metrics;
        const fennecWalletOnly = Number(metrics.fennecWalletBalance ?? metrics.fennec_wallet_balance ?? 0) || 0;
        const fennecLpValueUSD =
            Number(metrics.fennecLpValueUSD ?? metrics.fennec_lp_value_usd ?? metrics.fennecLpValueUsd ?? 0) || 0;
        const hasBoxes = !!(
            metrics.hasFennecBoxes ||
            metrics.has_fennec_boxes ||
            metrics.fennecBoxesCount > 0 ||
            metrics.fennec_boxes_count > 0
        );
        const eligible = hasBoxes || fennecWalletOnly >= 1000 || fennecLpValueUSD >= 1;

        const mintBtnText = document.getElementById('mintBtnText');
        const why = document.getElementById('discountWhy');
        if (eligible) {
            window.__discountCheckPassed = true;
            if (mintBtnText) {
                mintBtnText.innerHTML =
                    'MINT ID • <span style="text-decoration: line-through; opacity: 0.6;">1 FB</span> <span style="font-weight: bold;">0.5 FB (50% OFF!)</span>';
            }
            if (why) {
                why.textContent = 'Discount active: 50% OFF unlocked.';
            }
        } else {
            window.__discountCheckPassed = false;
            if (mintBtnText) {
                mintBtnText.innerHTML = 'MINT ID • 1 FB';
            }
            if (why) {
                why.textContent =
                    'Discount inactive: need 1000+ FENNEC in wallet, $1+ FENNEC LP, or be a Fennec Box Holder.';
            }
        }
    } catch (e) {
        // silent
    }
};

// Force Scroll to Top (Final)
if (!window.__fennecScrollTopFinalSetup) {
    window.__fennecScrollTopFinalSetup = true;
    try {
        window.addEventListener('beforeunload', () => {
            try {
                window.scrollTo(0, 0);
            } catch (_) {}
        });
    } catch (_) {}
    try {
        window.addEventListener(
            'load',
            () => {
                try {
                    window.scrollTo(0, 0);
                    setTimeout(() => window.scrollTo(0, 0), 10);
                    setTimeout(() => window.scrollTo(0, 0), 100);
                } catch (_) {}
            },
            { once: true }
        );
    } catch (_) {}
}

// Chat Widget Functions
function toggleChatLegacy() {
    const chatWindow = document.getElementById('chatWindow');
    const chatTrigger = document.getElementById('chatTrigger');
    if (!chatWindow) return;

    if (chatWindow.classList.contains('hidden')) {
        chatWindow.classList.remove('hidden');
        setTimeout(() => {
            chatWindow.style.transform = 'scale(1)';
            chatWindow.style.opacity = '1';
        }, 10);
    } else {
        chatWindow.style.transform = 'scale(0.9)';
        chatWindow.style.opacity = '0';
        setTimeout(() => chatWindow.classList.add('hidden'), 300);
    }
}

function sendMessageLegacy() {
    const input = document.getElementById('chatInput');
    const messages = document.getElementById('chatMessages');
    if (!input || !messages) return;

    const text = input.value.trim();
    if (!text) return;

    // Legacy renderer disabled (XSS hardening). Use the main oracle sendMessage() implementation.
    try {
        if (typeof sendMessage === 'function') return sendMessage();
    } catch (_) {}
    return;

    input.value = '';
    messages.scrollTop = messages.scrollHeight;

    setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'flex gap-2 items-start';
        botMsg.innerHTML =
            '<div class="w-6 h-6 flex-shrink-0"><img src="img/FENNECAI.png" class="w-full h-full object-contain ai-avatar"></div><div class="bg-white/5 p-3 rounded-lg rounded-tl-none flex-1">I\'m here to help! Visit our docs or ask the community.</div>';
        messages.appendChild(botMsg);
        messages.scrollTop = messages.scrollHeight;
    }, 500);
}

function oracleQuickLegacy(action) {
    const messages = document.getElementById('chatMessages');
    if (!messages) return;

    let response = 'Let me help you with that!';
    if (action === 'help')
        response = 'Browse the site using the top navigation. Connect your wallet to access all features.';
    else if (action === 'prices') response = 'Check the Terminal section for live FENNEC price and market data.';
    else if (action === 'swap') response = 'Visit the Terminal to swap FB for FENNEC tokens.';
    else if (action === 'id')
        response = 'Connect your wallet and visit Fennec ID to generate your unique on-chain identity card.';
    else if (action === 'deposit') response = 'Use the Terminal Deposit tab to fund your account with FB or BTC.';
    else if (action === 'withdraw') response = 'Use the Terminal Withdraw tab to move your funds back to your wallet.';
    else if (action === 'clear') {
        try {
            if (typeof window.oracleQuick === 'function') return window.oracleQuick('clear');
        } catch (_) {}
        return;
    }

    try {
        const input = document.getElementById('chatInput');
        if (input) input.value = String(response || '');
        if (typeof sendMessage === 'function') return sendMessage();
    } catch (_) {}
}
