// ИСПРАВЛЕНИЕ: Предварительно объявляем функции на window, чтобы они были доступны для inline onclick
// Это предотвращает ошибки "function is not defined" при парсинге HTML
// ВАЖНО: Определяем функции сразу, чтобы они были доступны при парсинге HTML
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
        const currentAddr = userAddress || window.userAddress;
        if (currentAddr && !auditLoading) {
            const cacheKey = `audit_${currentAddr}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached && !auditIdentity) {
                try {
                    const cachedData = JSON.parse(cached);
                    if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
                        console.log('✅ Restoring audit from cache');
                        auditIdentity = cachedData.identity;
                        renderAudit(cachedData.identity);
                        return; // Если восстановили из кэша, не показываем кнопку
                    }
                } catch (e) {
                    console.warn('Failed to restore from cache:', e);
                }
            }
        }
        // ИСПРАВЛЕНИЕ: Обновляем UI (показываем кнопку CONNECT WALLET или GET YOUR ID)
        if (typeof initAudit === 'function') {
            setTimeout(() => initAudit(), 100);
        }
    }

    const target = document.getElementById(`sec-${id}`);
    if (target) {
        target.style.display = 'flex'; // Используем flex для работы классов flex-col justify-start
        // Небольшой таймаут для плавности
        setTimeout(() => target.classList.add('active'), 10);

        // ВАЖНО: Принудительный скролл в самый верх
        window.scrollTo({ top: 0, behavior: 'instant' });

        if (id === 'audit' && typeof initAudit === 'function') {
            setTimeout(initAudit, 100);
        }
    }

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const navLink = document.getElementById(`nav-${id}`);
    if (navLink) navLink.classList.add('active');

    // ИСПРАВЛЕНИЕ: Скрываем кнопку REFRESH в header когда открыт Fennec ID
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        if (id === 'audit') {
            refreshBtn.classList.add('hidden');
        } else {
            // Показываем только если кошелек подключен
            if (userAddress) {
                refreshBtn.classList.remove('hidden');
            }
        }
    }

    // ИСПРАВЛЕНИЕ: Если переключились на аудит, восстанавливаем из кэша
    if (id === 'audit' && userAddress && !auditLoading) {
        const cacheKey = `audit_${userAddress}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached && !auditIdentity) {
            try {
                const cachedData = JSON.parse(cached);
                if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
                    console.log('✅ Restoring audit from cache');
                    auditIdentity = cachedData.identity;
                    renderAudit(cachedData.identity);
                    return;
                }
            } catch (e) {
                console.warn('Failed to restore from cache:', e);
            }
        }
        // ИСПРАВЛЕНИЕ: НЕ запускаем автоматическую загрузку - пользователь должен нажать кнопку
        // if(!auditIdentity && !auditLoading) {
        //     setTimeout(() => runAudit(), 100);
        // }
    }
};

// ИСПРАВЛЕНИЕ: Определяем connectWallet сразу после showSection
window.connectWallet = async function () {
    if (typeof window.unisat === 'undefined') {
        window.open('https://unisat.io/download', '_blank');
        return;
    }
    try {
        console.log('=== CONNECTING WALLET ===');
        try {
            await window.unisat.switchChain('FRACTAL_BITCOIN_MAINNET');
            console.log('✅ Switched to Fractal Bitcoin Mainnet');
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
            return; // Ждем подтверждения
        }

        // Set userAddress - use window for global access
        const addr = newAddr;
        window.userAddress = addr;
        // Also try to set in local scope if variable exists
        try {
            if (typeof userAddress !== 'undefined') {
                userAddress = addr;
            }
        } catch (e) {}
        console.log('Got address:', addr);
        try {
            const pubkey = typeof window.unisat.getPublicKey === 'function' ? await window.unisat.getPublicKey() : null;
            window.userPubkey = pubkey;
            try {
                if (typeof userPubkey !== 'undefined') {
                    userPubkey = pubkey;
                }
            } catch (e) {}
        } catch (e) {}
        // ИСПРАВЛЕНИЕ: Обновляем UI кнопок
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        if (connectBtn) {
            connectBtn.classList.add('hidden');
        }
        if (disconnectBtn) {
            disconnectBtn.classList.remove('hidden');
            disconnectBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> <span>...${addr.slice(-4)}</span>`;
        }
        // ВСЕГДА скрываем кнопку REFRESH в секции Fennec ID
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('hidden'); // Всегда скрываем в Fennec ID секции
        }

        console.log('✅ Wallet connected');

        // ИСПРАВЛЕНИЕ: Обновляем UI на странице FENNEC ID после подключения кошелька
        const auditTab = document.getElementById('tab-audit');
        if (auditTab && auditTab.classList.contains('active')) {
            // Если открыта вкладка FENNEC ID, обновляем кнопку
            if (typeof initAudit === 'function') {
                setTimeout(() => initAudit(), 100);
            }
        }

        // ИСПРАВЛЕНИЕ: Сбрасываем флаг подтверждения
        switchWalletConfirmed = false;

        // ИСПРАВЛЕНИЕ: Запускаем автообновление данных каждую минуту
        // ИСПРАВЛЕНИЕ: Автообновление отключено - пользователь обновляет вручную
        // startAutoUpdate();

        // ИСПРАВЛЕНИЕ: Начинаем предзагрузку данных для Fennec ID сразу после подключения кошелька
        // Это ускорит загрузку при открытии Fennec ID
        if (typeof window.preloadAuditData === 'function') {
            console.log('🔄 Preloading audit data...');
            window.preloadAuditData(addr);
        }

        if (typeof checkBalance === 'function') checkBalance();
        if (typeof refreshTransactionHistory === 'function') {
            setTimeout(refreshTransactionHistory, 2000);
        }
    } catch (e) {
        console.error('Wallet connection error:', e);
        alert(e.message || 'Failed to connect wallet');
    }
};

// ИСПРАВЛЕНИЕ: Функция отключения кошелька
window.disconnectWallet = function () {
    const currentAddr = userAddress || window.userAddress;
    if (!currentAddr) {
        console.log('No wallet to disconnect');
        return;
    }

    console.log('Disconnecting wallet:', currentAddr);

    // Останавливаем автообновление
    stopAutoUpdate();

    // Очищаем данные
    userAddress = null;
    window.userAddress = null;
    userPubkey = null;
    window.userPubkey = null;

    // Очищаем UI данные
    userBalances = { sFB: 0, FENNEC: 0, BTC: 0 };
    walletBalances = { sFB: 0, FENNEC: 0, BTC: 0 };
    poolReserves = { sFB: 0, FENNEC: 0, BTC: 0, user_sBTC: 0 };
    auditIdentity = null;
    auditLoading = false;

    // ИСПРАВЛЕНИЕ: Очищаем кэш аудита при отключении кошелька
    if (currentAddr) {
        const cacheKey = `audit_${currentAddr}`;
        localStorage.removeItem(cacheKey);
    }

    // Обновляем кнопки
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    if (connectBtn) {
        connectBtn.classList.remove('hidden');
        connectBtn.innerHTML = `<i class="fas fa-wallet"></i> <span>CONNECT</span>`;
    }
    if (disconnectBtn) {
        disconnectBtn.classList.add('hidden');
    }
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
    if (typeof initAudit === 'function') {
        initAudit();
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

    console.log('✅ Wallet disconnected');
    if (typeof showNotification === 'function') {
        showNotification('Wallet disconnected', 'info');
    } else {
        alert('Wallet disconnected');
    }
};

// ИСПРАВЛЕНИЕ: Функция запуска автообновления данных каждую минуту
function startAutoUpdate() {
    // Останавливаем предыдущий интервал, если есть
    stopAutoUpdate();

    console.log('🔄 Starting auto-update (60s interval)');

    autoUpdateInterval = setInterval(async () => {
        if (!userAddress) {
            stopAutoUpdate();
            return;
        }

        console.log('🔄 Auto-updating data...');
        try {
            // ИСПРАВЛЕНИЕ: При ручном обновлении сбрасываем кэш swap_history
            swapHistoryCache.data = null;
            swapHistoryCache.timestamp = 0;

            // ИСПРАВЛЕНИЕ: Блокируем загрузку терминала пока загружается аудит
            if (auditLoading) {
                console.log('⏳ Skipping terminal data load: audit is loading');
                return;
            }

            // Обновляем все данные параллельно
            await Promise.all([
                typeof checkBalance === 'function' ? checkBalance() : Promise.resolve(),
                typeof fetchReserves === 'function' ? fetchReserves() : Promise.resolve(),
                typeof updatePriceData === 'function' ? updatePriceData() : Promise.resolve(),
                typeof refreshTransactionHistory === 'function' ? refreshTransactionHistory() : Promise.resolve()
            ]);

            // ИСПРАВЛЕНИЕ: Если открыта вкладка аудита, обновляем и её (но только если не идет загрузка и карточка уже была загружена)
            const auditTab = document.getElementById('tab-audit');
            if (auditTab && auditTab.classList.contains('active')) {
                // Проверяем, что аудит не загружается и карточка уже была отображена
                if (typeof runAudit === 'function' && !auditLoading && auditIdentity) {
                    console.log('🔄 Auto-updating audit (card already loaded)...');
                    runAudit();
                } else if (auditLoading) {
                    console.log('⏳ Skipping auto-update: audit is already loading');
                } else if (!auditIdentity) {
                    console.log('⏳ Skipping auto-update: audit card not loaded yet');
                }
            }

            console.log('✅ Auto-update completed');
        } catch (e) {
            console.warn('Auto-update error:', e);
        }
    }, 60000); // 60 секунд = 1 минута
}

// ИСПРАВЛЕНИЕ: Функция остановки автообновления
function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        console.log('⏹️ Auto-update stopped');
    }
}

// ИСПРАВЛЕНИЕ: Функция обновления аудита (принудительное)
window.refreshAudit = function () {
    if (!userAddress) {
        if (typeof showNotification === 'function') {
            showNotification('Connect wallet first', 'warning', 2000);
        }
        return;
    }
    if (auditLoading) {
        if (typeof showNotification === 'function') {
            showNotification('Audit is already loading', 'warning', 2000);
        }
        return;
    }
    // Очищаем кэш и запускаем загрузку
    const cacheKey = `audit_${userAddress}`;
    localStorage.removeItem(cacheKey);
    runAudit(true); // forceRefresh = true
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
        console.log('🔄 Manual refresh started...');

        // ИСПРАВЛЕНИЕ: При ручном обновлении сбрасываем кэш swap_history
        swapHistoryCache.data = null;
        swapHistoryCache.timestamp = 0;

        // Обновляем все данные (БЕЗ аудита - аудит обновляется отдельно)
        await Promise.all([
            typeof checkBalance === 'function' ? checkBalance() : Promise.resolve(),
            typeof fetchReserves === 'function' ? fetchReserves() : Promise.resolve(),
            typeof updatePriceData === 'function' ? updatePriceData() : Promise.resolve(),
            typeof refreshTransactionHistory === 'function' ? refreshTransactionHistory() : Promise.resolve()
        ]);

        // ИСПРАВЛЕНИЕ: Аудит НЕ обновляется автоматически - пользователь обновляет его отдельной кнопкой

        showNotification('Data refreshed successfully', 'success', 2000);
        console.log('✅ Manual refresh completed');

        // Запускаем таймер обратного отсчета
        startRefreshTimer();
    } catch (e) {
        console.error('❌ Manual refresh error:', e);
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
    : 'https://fennec-api.warninghejo.workers.dev'; // Cloudflare Worker fallback
const FENNEC_ID_VERSION = '6.0';
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

    console.warn('safeFetchJson failed:', url, lastErr);
    return null;
}

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
let selectedInscriptions = [];
let chartTimeframe = '7d';
let priceChart = null;
let priceHistory = [];
let burrowLoop = null;
let auditIdentity = null;
let auditLoading = false; // ИСПРАВЛЕНИЕ: Флаг активного аудита, чтобы не запускать повторно во время выполнения
let currentAuditRequestId = 0; // ИСПРАВЛЕНИЕ: Отслеживание текущего запроса для предотвращения race condition
let currentAuditAbortController = null; // ИСПРАВЛЕНИЕ: AbortController для отмены предыдущих запросов

window.setDebugAuditIdentity = function (identity) {
    try {
        auditIdentity = identity;
        if (identity && identity.metrics) {
            identity.metrics.address = identity.metrics.address || userAddress || window.userAddress || '';
        }
        if (typeof renderAudit === 'function') {
            renderAudit(identity);
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
        swap_bridge: 'BRIDGE BTC 🌉'
    },
    cn: {
        swap_action: '获取 FENNEC',
        swap_sell: '卖出 FENNEC',
        swap_bridge: '桥接 BTC 🌉'
    }
};

// ===== NETWORK CHECK FUNCTION (NO AUTO-SWITCH) =====
async function checkFractalNetwork() {
    try {
        const currentChain = await window.unisat.getChain();
        console.log('🌐 Current network:', currentChain);

        // UniSat returns string or object with enum property
        const chainName = typeof currentChain === 'string' ? currentChain : currentChain?.enum || currentChain;

        if (chainName !== REQUIRED_NETWORK) {
            throw new Error(
                `⚠️ Please switch to Fractal Bitcoin Mainnet in your UniSat wallet.\nCurrent: ${chainName}`
            );
        }

        console.log('✅ Network OK:', REQUIRED_NETWORK);
        return true;
    } catch (e) {
        console.error('❌ Network check failed:', e);
        throw e;
    }
}

// ===== FORCE SWITCH NETWORK =====
async function switchToFractal() {
    try {
        console.log('🔄 Switching to Fractal mainnet...');
        await window.unisat.switchChain(REQUIRED_NETWORK);
        await new Promise(r => setTimeout(r, 2000)); // Wait 2 sec

        const verify = await window.unisat.getChain();
        console.log('✅ Network after switch:', verify);
        return verify.enum === REQUIRED_NETWORK;
    } catch (e) {
        console.error('❌ Switch failed:', e);
        return false;
    }
}
let activeTickers = { tick0: '', tick1: '' };

// Кэширование для оптимизации
let poolCache = { data: null, timestamp: 0, ttl: 30000 }; // 30 сек
let balanceCache = { data: {}, timestamp: {}, ttl: 15000 }; // 15 сек
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
    showNotification(currentTheme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode');
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
            const time = new Date(tx.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const emoji = tx.type === 'swap' ? '🔄' : tx.type === 'deposit' ? '⬇️' : '⬆️';
            return `<div class="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span>${emoji} ${tx.type.toUpperCase()}</span>
                    <span class="text-fennec">${tx.amount} ${tx.token}</span>
                    <span class="text-gray-500">${time}</span>
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
        return { valid: false, error: '❌ Please enter a valid amount' };
    }

    // Минимальные суммы
    const minAmounts = { swap: 0.00001, deposit: 1, withdraw: 1 };
    if (amount < minAmounts[type]) {
        return { valid: false, error: `⚠️ Minimum ${type} amount: ${minAmounts[type]} ${token}` };
    }

    // Проверка баланса
    if (type === 'swap') {
        const bal = isBuying ? userBalances.sFB : userBalances.FENNEC;
        if (amount > bal) {
            return { valid: false, error: '💰 Insufficient balance. Go to Deposit tab.' };
        }
    } else if (type === 'withdraw') {
        const bal = token === 'FB' ? userBalances.sFB : userBalances.FENNEC;
        if (amount > bal) {
            return { valid: false, error: '💰 Insufficient balance on InSwap' };
        }
    }

    return { valid: true };
}

function showError(message) {
    document.getElementById('errorMsg').innerText = message;
    document.getElementById('errorModal').classList.remove('hidden');
}

function showSuccess(message) {
    document.getElementById('successTxId').innerText = message;
    document.getElementById('successModal').classList.remove('hidden');
}

// Система уведомлений
function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notificationsContainer');
    const notification = document.createElement('div');
    notification.className = 'notification';

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️',
        swap: '🔄',
        deposit: '⬇️',
        withdraw: '⬆️'
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

    notification.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="text-2xl">${icons[type] || icons.info}</div>
                    <div class="flex-1">
                        <div class="font-bold text-sm" style="color: ${colors[type] || colors.info}">${message}</div>
                        <div class="text-xs" style="color: var(--text-muted)">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
            `;

    container.appendChild(notification);

    // Auto-remove
    setTimeout(() => {
        notification.classList.add('exit');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function switchTab(tab) {
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
    // ИСПРАВЛЕНИЕ: Обновляем данные только при переключении табов (действие пользователя)
    if (tab === 'deposit') {
        setDepositToken(depositToken);
        loadFees('deposit');
        checkBalance(); // Обновляем баланс при переключении на deposit
        refreshTransactionHistory();
    }
    if (tab === 'withdraw') {
        updateWithdrawUI();
        loadFees('withdraw');
        checkBalance(); // Обновляем баланс при переключении на withdraw
        refreshTransactionHistory();
    }
    if (tab === 'swap') {
        fetchReserves(); // Обновляем резервы при переключении на swap
        checkBalance(); // Обновляем баланс
        refreshTransactionHistory();
        checkWhales(); // Проверяем whale транзакции
    }
    if (tab === 'pending') {
        refreshPendingOperations();
    }
}

// ИСПРАВЛЕНИЕ: Функция для добавления pending операции (минт, инскрипции и т.д.)
function addPendingOperation(operation) {
    try {
        const pendingOps = JSON.parse(localStorage.getItem('pending_operations') || '[]');
        // Проверяем, нет ли уже такой операции
        const exists = pendingOps.find(op => op.orderId === operation.orderId && op.type === operation.type);
        if (!exists) {
            pendingOps.push(operation);
            localStorage.setItem('pending_operations', JSON.stringify(pendingOps));
            // Обновляем UI
            if (typeof refreshPendingOperations === 'function') {
                refreshPendingOperations();
            }
        }
    } catch (e) {
        console.error('Failed to add pending operation:', e);
    }
}

// Проверка статуса минт-ордеров
async function checkPendingMints() {
    try {
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
                    // 400/404 = ордер не найден, удаляем из списка
                    if (res.status === 400 || res.status === 404) {
                        const updated = pendingOps.filter(op => !(op.orderId === mint.orderId && op.type === 'mint'));
                        localStorage.setItem('pending_operations', JSON.stringify(updated));
                        console.log(`⚠️ Order ${mint.orderId} not found, removed from pending`);
                        if (typeof refreshPendingOperations === 'function') {
                            refreshPendingOperations();
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
                        console.log(`✅ Mint order ${mint.orderId} completed with inscription ${inscriptionId}`);

                        // Обновляем UI
                        if (typeof refreshPendingOperations === 'function') {
                            refreshPendingOperations();
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
                    } else if (status === 'closed' || status === 'refunded') {
                        const updated = pendingOps.filter(op => !(op.orderId === mint.orderId && op.type === 'mint'));
                        localStorage.setItem('pending_operations', JSON.stringify(updated));
                        if (typeof refreshPendingOperations === 'function') {
                            refreshPendingOperations();
                        }
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

// Запускаем проверку каждые 30 секунд
setInterval(checkPendingMints, 30000);
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
        const pendingOperations = JSON.parse(localStorage.getItem('pending_operations') || '[]');
        const activeMints = pendingOperations.filter(p => p.status === 'pending' || p.status === 'inscribing');

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

        const allPending = [
            ...activeInscriptions.map(p => ({ ...p, type: 'inscription', sortTime: p.createdAt || 0 })),
            ...activeMints.map(m => ({ ...m, type: 'mint', sortTime: m.timestamp || 0 })),
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
                    return `
                            <div class="bg-black/30 border border-white/5 rounded-lg p-4 mb-2">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <i class="fas ${statusIcon} ${statusColor} text-xl"></i>
                                        <div>
                                            <div class="text-sm font-bold text-white">Minting Fennec ID Card</div>
                                            <div class="text-xs text-gray-400">Order ID: ${op.orderId?.slice(-8) || 'N/A'}</div>
                                            <div class="text-[10px] text-gray-500 mt-1">Status: ${op.status}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-[10px] text-gray-500">Amount</div>
                                        <div class="text-xs font-mono text-fennec">${(op.amount / 100000000).toFixed(8)} FB</div>
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
                                            <div class="text-xs text-gray-400">${op.amount} ${displayTick}</div>
                                            <div class="text-[10px] text-gray-500 mt-1">Status: ${op.status}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-[10px] text-gray-500">Order ID</div>
                                        <div class="text-xs font-mono text-fennec">${op.orderId?.slice(-8) || 'N/A'}</div>
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
                                            <div class="text-sm font-bold text-white">Deposit ${amountStr} ${displayTick}</div>
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
                                            <div class="text-sm font-bold text-white">Withdraw ${amountStr} ${displayTick}</div>
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
function switchDir() {
    isBuying = !isBuying;
    document.getElementById('swapIn').value = '';
    document.getElementById('swapOut').value = '';
    updateUI();
}

// Set swap pair (FB_FENNEC or BTC_FB)
function setSwapPair(pair) {
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

function setMaxAmount() {
    if (!userAddress) return connectWallet();
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

function toggleLiquidityPanel() {
    const panel = document.getElementById('liquidityPanel');
    if (!panel) return;
    panel.classList.toggle('hidden');
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

async function loadLiquidityPoolData(pair) {
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
        console.warn('loadLiquidityPoolData failed:', e);
    }
}

async function selectLiquidityPair(pair) {
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
}

function getBalanceForTick(tick) {
    const t = (tick || '').toString().toUpperCase();
    if (t.includes('FENNEC')) return Number(userBalances.FENNEC || 0) || 0;
    if (t.includes('SBTC') || t === 'BTC') return Number(poolReserves.user_sBTC || 0) || 0;
    if (t.includes('SFB') || t === 'FB') return Number(userBalances.sFB || 0) || 0;
    return 0;
}

function getLiquidityConfig() {
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

function updateLiquidityBalancesUI() {
    const cfg = getLiquidityConfig();
    const b0 = document.getElementById('liqBal0');
    const b1 = document.getElementById('liqBal1');
    if (b0) b0.innerText = Number(cfg.bal0 || 0).toFixed(8);
    if (b1) b1.innerText = Number(cfg.bal1 || 0).toFixed(8);
}

function computeExpectedLp(amount0, amount1, reserve0, reserve1, poolLp) {
    const a0 = Number(amount0 || 0);
    const a1 = Number(amount1 || 0);
    const r0 = Number(reserve0 || 0);
    const r1 = Number(reserve1 || 0);
    const p = Number(poolLp || 0);
    if (!a0 || !a1) return 0;

    if (p > 0 && r0 > 0 && r1 > 0) {
        return Math.max(0, Math.min((a0 * p) / r0, (a1 * p) / r1));
    }
    return Math.max(0, Math.sqrt(a0 * a1) - 1000);
}

function syncLiquidityAmounts(changedIndex) {
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
    } finally {
        __liqSyncGuard = false;
    }
}

function setMaxLiqAmount(which) {
    if (!userAddress) return connectWallet();
    updateLiquidityBalancesUI();
    const cfg = getLiquidityConfig();
    const el0 = document.getElementById('liqAmount0');
    const el1 = document.getElementById('liqAmount1');
    if (!el0 || !el1) return;

    const feeBuffer = 0.05;
    const max0 = Math.max(0, Number(cfg.bal0 || 0) - (cfg.tick0 === T_SFB ? feeBuffer : 0));
    const max1 = Math.max(0, Number(cfg.bal1 || 0) - (cfg.tick1 === T_SFB ? feeBuffer : 0));

    if (which === 0) {
        el0.value = max0.toFixed(8);
        syncLiquidityAmounts(0);
        return;
    }

    el1.value = max1.toFixed(8);
    syncLiquidityAmounts(1);
}

async function copyLiquidityPairForSearch() {
    const cfg = getLiquidityConfig();
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(cfg.label);
        }
    } catch (e) {}
}

async function doAddLiquidity() {
    if (!userAddress) return connectWallet();
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
        const lpStr = (expectedLp || 0).toString();

        const apiAmounts = cfg.mapUiToApiAmounts(amount0, amount1);
        const preUrl = `${BACKEND_URL}?action=pre_add_liq&address=${userAddress}&tick0=${encodeURIComponent(cfg.apiTick0)}&tick1=${encodeURIComponent(cfg.apiTick1)}&amount0=${apiAmounts.amount0}&amount1=${apiAmounts.amount1}&lp=${lpStr}&slippage=0.005&ts=${ts}`;
        const pre = await fetch(preUrl).then(r => r.json());
        if (!pre || pre.code !== 0 || !pre.data) throw new Error(pre?.msg || pre?.error || 'pre_add_liq failed');

        const signMsg = pre.data.signMsg || pre.data.sign_msg || pre.data.msg || pre.data.signMsgs?.[0] || '';
        if (!signMsg) throw new Error('pre_add_liq returned empty signMsg');

        btn.innerText = 'SIGNING…';
        const sig = await window.unisat.signMessage(signMsg, 'bip322-simple');

        btn.innerText = 'SUBMITTING…';
        const body = {
            address: userAddress,
            tick0: cfg.apiTick0,
            tick1: cfg.apiTick1,
            amount0: apiAmounts.amount0.toString(),
            amount1: apiAmounts.amount1.toString(),
            lp: lpStr,
            slippage: '0.005',
            ts,
            sig
        };

        const sub = await fetch(`${BACKEND_URL}?action=add_liq`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-public-key': userPubkey, 'x-address': userAddress },
            body: JSON.stringify(body)
        }).then(r => r.json());

        if (!sub || sub.code !== 0) throw new Error(sub?.msg || sub?.error || 'add_liq failed');

        showSuccess(`Liquidity supplied! ID: ${sub.data?.id || 'OK'}`);
        setTimeout(checkBalance, 2000);
    } catch (e) {
        console.error('Add liquidity error:', e);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}
function updateUI() {
    // Update UI based on current swap pair
    let inTick, outTick, inIcon, outIcon, bal;
    if (currentSwapPair === 'FB_FENNEC') {
        inTick = isBuying ? 'FB' : 'FENNEC';
        outTick = isBuying ? 'FENNEC' : 'FB';
        inIcon = isBuying ? 'img/FB.png' : 'img/fennec.jpg';
        outIcon = isBuying ? 'img/fennec.jpg' : 'img/FB.png';
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

// connectWallet is already defined at the top of the script

async function fetchReserves() {
    try {
        // Проверяем кэш
        const now = Date.now();
        if (poolCache.data && now - poolCache.timestamp < poolCache.ttl) {
            console.log('📦 Using cached pool data');
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

        let poolUrl = `${BACKEND_URL}?action=quote&${queryParams}&t=${now}`;

        const json = await safeFetchJson(poolUrl, { timeoutMs: 12000, retries: 2 });
        if (!json) throw new Error('Failed to fetch pool data');
        console.log(`📊 Pool response for ${currentSwapPair}:`, json);

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
                `📊 Pool data: tick0=${data.tick0}, tick1=${data.tick1}, amount0=${data.amount0}, amount1=${data.amount1}`
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
                `📊 Pool reserves: BTC=${poolReserves.BTC}, sFB=${poolReserves.sFB}, FENNEC=${poolReserves.FENNEC}`
            );

            const statusEl = document.getElementById('statusVal');
            if (statusEl) statusEl.innerText = 'Active';
            // Кэшируем данные
            poolCache.data = data;
            poolCache.timestamp = now;
            // Если есть введенное значение, пересчитываем
            if (document.getElementById('swapIn').value) calc();
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
}
async function checkBalance() {
    if (!userAddress) return;
    try {
        // ОПТИМИЗАЦИЯ: Используем batch endpoint для получения всех балансов за один запрос
        const ticks = [T_SFB, T_FENNEC, T_SBTC].join(',');
        const batchRes = await fetch(`${BACKEND_URL}?action=balance_batch&address=${userAddress}&ticks=${ticks}`).then(
            r => r.json()
        );

        // Парсим результаты из batch ответа
        const rFB = batchRes.data?.[T_SFB] || {};
        const rFennec = batchRes.data?.[T_FENNEC] || {};
        const rBTC = batchRes.data?.[T_SBTC] || {};

        userBalances.sFB = parseFloat(rFB.data?.balance?.swap || rFB.data?.balance?.available || 0);
        userBalances.FENNEC = parseFloat(rFennec.data?.balance?.swap || rFennec.data?.balance?.available || 0);
        // Баланс sBTC внутри InSwap (для свапа)
        poolReserves.user_sBTC = parseFloat(rBTC.data?.balance?.swap || rBTC.data?.balance?.available || 0);

        const nativeBal = await window.unisat.getBalance();
        walletBalances.sFB = nativeBal.total / 100000000;

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
        const liqPanel = document.getElementById('liquidityPanel');
        if (liqPanel && !liqPanel.classList.contains('hidden')) {
            if (typeof loadLiquidityPoolData === 'function') {
                loadLiquidityPoolData(currentLiquidityPair);
            }
        }
    } catch (e) {
        console.warn('Balance check failed', e);
    }
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
                    <span class="text-xl digging-fox">⛏️</span>
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
let swapHistoryCache = {
    data: null,
    timestamp: 0,
    ttl: 30000 // 30 секунд кэш
};

// ИСПРАВЛЕНИЕ: Единая функция загрузки swap_history для всех вкладок
async function loadSwapHistory(useCache = true) {
    const now = Date.now();

    // Используем кэш если он свежий
    if (useCache && swapHistoryCache.data && now - swapHistoryCache.timestamp < swapHistoryCache.ttl) {
        console.log('📦 Using cached swap history');
        return swapHistoryCache.data;
    }

    try {
        console.log('📡 Loading swap history (all pairs)...');
        // ИСПРАВЛЕНИЕ: Загружаем обе пары одним запросом (параллельно)
        const [sResFB_FENNEC, sResBTC_FB] = await Promise.all([
            safeFetchJson(`${BACKEND_URL}?action=swap_history&start=0&limit=10&tick=sFB___000/FENNEC`, {
                timeoutMs: 12000,
                retries: 2
            }).then(r => r || { code: -1 }),
            safeFetchJson(`${BACKEND_URL}?action=swap_history&start=0&limit=10&tick=sBTC___000/sFB___000`, {
                timeoutMs: 12000,
                retries: 2
            }).then(r => r || { code: -1 })
        ]);

        const result = {
            fbFennec: sResFB_FENNEC,
            btcFb: sResBTC_FB,
            timestamp: now
        };

        // Сохраняем в кэш
        swapHistoryCache.data = result;
        swapHistoryCache.timestamp = now;

        console.log('✅ Swap history loaded and cached');
        return result;
    } catch (e) {
        console.warn('Swap history load error', e);
        return swapHistoryCache.data || { fbFennec: { code: -1 }, btcFb: { code: -1 } };
    }
}

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

    msg.innerHTML = `Wow! Someone just swapped <span class="text-fennec font-bold">${mainAmount.toFixed(0)} ${mainTick}</span>! (${direction})`;

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
            console.warn('⚠️ No address for quote_swap, connecting wallet...');
            connectWallet();
            // Используем fallback расчет если адрес недоступен
            throw new Error('Address required');
        }
        const quoteUrl = `${BACKEND_URL}${separator}action=quote_swap&exactType=exactIn&tickIn=${tickIn}&tickOut=${tickOut}&amount=${val}&address=${userAddress}`;
        console.log('📊 Quote request:', quoteUrl);
        const quoteRes = await fetch(quoteUrl).then(r => {
            if (!r.ok) {
                console.error('Quote API error:', r.status, r.statusText);
                return r.json().catch(() => ({ code: -1, msg: `HTTP ${r.status}`, error: 'Unknown action' }));
            }
            return r.json();
        });

        console.log('📊 Quote response:', quoteRes);

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
            console.warn('⚠️ No address for quote_swap, connecting wallet...');
            connectWallet();
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
    if (!userAddress) return connectWallet();

    // CHECK NETWORK FIRST
    try {
        await checkFractalNetwork();
    } catch (e) {
        document.getElementById('errorMsg').innerText = e.message;
        document.getElementById('errorModal').classList.remove('hidden');
        return;
    }

    let amount = parseFloat(document.getElementById('swapIn').value);
    if (!amount) return alert('Enter amount');

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
        console.log('🔄 Getting fresh quote for swap:', quoteUrl);
        const quoteRes = await fetch(quoteUrl).then(r => {
            if (!r.ok) {
                console.error('Quote API error:', r.status, r.statusText);
                return r.json().catch(() => ({ code: -1, msg: `HTTP ${r.status}` }));
            }
            return r.json();
        });
        console.log('🔄 Quote response:', quoteRes);

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
            console.log(`✅ Got quote expect: ${expectedOut} from raw: ${rawAmount}`);
        }

        if (!expectedOut || expectedOut <= 0) {
            // Если quote не сработал, берем из поля ввода, но это рискованно
            expectedOut = parseFloat(document.getElementById('swapOut').value);
            console.warn('⚠️ Using value from input field:', expectedOut);
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
                '⚠️ InSwap is currently under maintenance (System Recovery). Please try again in 10-15 minutes.'
            );
        }

        if (res.code !== 0) throw new Error(res.msg || 'Swap Error');
        const preSwap = res.data;

        const signatures = [];
        for (let msg of preSwap.signMsgs) {
            let m = typeof msg === 'object' ? msg.text || msg.id : msg;
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
            headers: { 'Content-Type': 'application/json', 'x-public-key': userPubkey, 'x-address': userAddress },
            body: JSON.stringify(body)
        }).then(r => r.json());

        console.log('Submit response:', sub);
        if (sub.code === 0) {
            triggerSwapSuccessFx();
            document.getElementById('successTxId').innerText = sub.data || sub.txid || 'Swap success!';
            document.getElementById('successModal').classList.remove('hidden');
            setTimeout(checkBalance, 2000);
        } else throw new Error(sub.msg || 'Submission failed');
    } catch (e) {
        console.error('❌ Swap error:', e);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        stopDiggingAnimation();
        btn.disabled = false;
    }
}

// DEPOSIT (STRICTLY FOLLOWS SCREENSHOT PARAMS)
async function setDepositToken(tok) {
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
    const labelEl = document.querySelector('#dep-native-ui span');
    if (labelEl) labelEl.innerText = tok === 'BTC' ? 'BTC' : 'FB';

    // Load fees when switching tokens
    if (tok === 'sFB' || tok === 'BTC') {
        await loadFees('deposit');
    }

    // Update balance display
    const balanceDisplayEl = document.getElementById('depBalance');

    // Refresh balance for the selected token
    if (userAddress) {
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
                    balanceDisplayEl.innerText = `Balance: 0.00000000 BTC`;
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
                    balanceDisplayEl.innerText = `Balance: 0.00000000 FB`;
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
            customEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-fennec bg-fennec/10 text-fennec`;
        if (mediumEl)
            mediumEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
        if (fastEl)
            fastEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
        return;
    }

    depositFeeRate = speed === 'fast' ? fractalFees.fastestFee : fractalFees.halfHourFee;
    // Update UI - only one button active
    if (mediumEl)
        mediumEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer ${speed === 'medium' ? 'border-fennec bg-fennec/10 text-fennec' : 'border-white/10 text-gray-500 hover:text-white'}`;
    if (fastEl)
        fastEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer ${speed === 'fast' ? 'border-fennec bg-fennec/10 text-fennec' : 'border-white/10 text-gray-500 hover:text-white'}`;
    if (customEl)
        customEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
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
            customEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-fennec bg-fennec/10 text-fennec`;
        if (mediumEl)
            mediumEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
        if (fastEl)
            fastEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
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
            customEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-fennec bg-fennec/10 text-fennec`;
        if (mediumEl)
            mediumEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
        if (fastEl)
            fastEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
        return;
    }

    withdrawFeeRate = speed === 'fast' ? fractalFees.fastestFee : fractalFees.halfHourFee;
    // Update UI - only one button active
    if (mediumEl)
        mediumEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer ${speed === 'medium' ? 'border-fennec bg-fennec/10 text-fennec' : 'border-white/10 text-gray-500 hover:text-white'}`;
    if (fastEl)
        fastEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer ${speed === 'fast' ? 'border-fennec bg-fennec/10 text-fennec' : 'border-white/10 text-gray-500 hover:text-white'}`;
    if (customEl)
        customEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
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
            customEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-fennec bg-fennec/10 text-fennec`;
        if (mediumEl)
            mediumEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
        if (fastEl)
            fastEl.className = `flex-1 py-2 text-xs font-bold border transition cursor-pointer border-white/10 text-gray-500 hover:text-white`;
    }
}

window.setDepositFeeCustom = setDepositFeeCustom;
window.setWithdrawFeeCustom = setWithdrawFeeCustom;

async function loadFees(type) {
    try {
        const res = await fetch(`${BACKEND_URL}?action=gas`)
            .then(r => r.json())
            .catch(() => ({}));
        if (res.fastestFee && res.halfHourFee && res.hourFee) {
            fractalFees = res;
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
window.setDepositFee = setDepositFee;
window.setWithdrawFee = setWithdrawFee;
window.loadFees = loadFees;
async function doDeposit() {
    // Route to correct function based on token
    if (depositToken === 'FENNEC') {
        return doDepositFennec();
    }

    if (depositToken === 'BTC') {
        return doDepositBTC();
    }

    // FB deposit (native)
    if (!userAddress) return connectWallet();

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
        console.log('✅ PSBT signed');

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
            headers: { 'Content-Type': 'application/json', 'x-public-key': userPubkey, 'x-address': userAddress },
            body: JSON.stringify(confirmBody)
        }).then(r => r.json());

        console.log('Confirm response:', conf);
        if (conf.code === 0) {
            const txid = conf.data?.txid || conf.data || 'Deposit sent!';

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
                        console.log('✅ BTC deposit converted to FB automatically!');
                    }
                } catch (swapError) {
                    console.warn('Auto-conversion check failed (deposit still successful):', swapError);
                }
            }

            trackDepositProgress(txid, depositToken);
        } else throw new Error(conf.msg || 'Deposit confirmation failed');
    } catch (e) {
        console.error('❌ Deposit error:', e);
        document.getElementById('errorMsg').innerText = e.message || String(e);
        document.getElementById('errorModal').classList.remove('hidden');
    } finally {
        btn.innerText = 'DEPOSIT';
        btn.disabled = false;
    }
}

async function doDepositBTC() {
    if (!userAddress) return connectWallet();

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
            console.log('✅ Switched to Bitcoin Mainnet');
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
        console.log('✅ PSBT signed');

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
            headers: { 'Content-Type': 'application/json', 'x-public-key': userPubkey, 'x-address': userAddress },
            body: JSON.stringify(confirmBody)
        }).then(r => r.json());

        console.log('Confirm response:', conf);
        if (conf.code === 0) {
            const txid = conf.data?.txid || conf.data || 'Deposit sent!';

            // Switch back to Fractal Bitcoin
            try {
                await window.unisat.switchChain('FRACTAL_BITCOIN_MAINNET');
            } catch (e) {
                console.warn('Failed to switch back to Fractal:', e);
            }

            trackDepositProgress(txid, depositToken);
        } else throw new Error(conf.msg || 'Deposit confirmation failed');
    } catch (e) {
        console.error('❌ BTC Deposit error:', e);
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
    if (!userAddress) return connectWallet();
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
        let signOptions = {};

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
            console.warn('⚠️ Signature error, trying GET method with params...');

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
async function loadFennecInscriptions() {
    if (!userAddress) return connectWallet();

    const cardsEl = document.getElementById('inscriptionCards');
    cardsEl.innerHTML = '<div class="text-center py-4 text-gray-500 text-xs col-span-3">Loading...</div>';

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
                    console.log(`✅ Loaded ${walletInscriptions.length} inscriptions from API`);
                }
            } else {
                console.error('Transferable inscriptions API failed:', transferableRes.status);
                // Fallback to UniSat API directly
                console.log('Falling back to UniSat API directly...');
                let cursor = 0;
                let hasMore = true;
                const limit = 100;

                // Оптимизация: ограничиваем количество запросов и добавляем таймаут
                let maxRequests = 5; // Максимум 5 запросов (500 инскрипций)
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
                console.log(`✅ Loaded ${walletInscriptions.length} FENNEC inscriptions from UniSat API (fallback)`);
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
    if (!userAddress) return connectWallet();

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
                    console.log('✅ Payment sent automatically, TXID:', txid);
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
                    console.log('✅ Inscription ready:', inscriptionId);

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
        console.log('✅ PSBT signed');

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
            const txid = conf.data?.txid || conf.data || 'FENNEC deposited!';
            // Block inscription from being used again
            let pendingInscriptions = JSON.parse(localStorage.getItem('pendingDepositInscriptions') || '[]');
            if (!pendingInscriptions.includes(inscriptionId)) {
                pendingInscriptions.push(inscriptionId);
                localStorage.setItem('pendingDepositInscriptions', JSON.stringify(pendingInscriptions));
            }
            trackDepositProgress(txid, 'FENNEC');
            showSuccess(`FENNEC deposit successful! TXID: ${txid}`);
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
    if (balEl) balEl.innerText = `Available: ${bal.toFixed(4)} (Min: 1 ${token})`;
}

function setMaxWithdrawAmount() {
    if (!userAddress) {
        connectWallet();
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
        connectWallet();
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
    if (!userAddress) return connectWallet();

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
            throw new Error('⏳ InSwap is processing another transaction. Please wait 10-30 seconds and try again.');
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
                console.log(`✅ Message ${i + 1} signed`);
            }
        }

        // --- 🔥 GEMINI'S BYPASS: BROADCAST FIRST! ---
        if (assetType === 'brc20') {
            console.log('=== 🔥 FENNEC BYPASS: BROADCAST-FIRST METHOD ===');

            // 3. Sign PAYMENT PSBT (NO BROADCAST - let server handle it)
            if (paymentPsbt) {
                btn.innerText = 'SIGN FEE TX (1/2)...';
                await new Promise(r => setTimeout(r, 500));

                // Sign without finalizing (let server finalize)
                signedPayment = await window.unisat.signPsbt(paymentPsbt, { autoFinalized: false });
                console.log('✅ Payment PSBT signed (not finalized - server will handle)');
            }

            // 4. Sign APPROVE PSBT - EXACTLY LIKE DEPOSIT (no params!)
            if (approvePsbt) {
                if (approvePsbt === paymentPsbt) {
                    signedApprove = signedPayment;
                } else {
                    btn.innerText = 'SIGNING (2/2)...';
                    console.log('🔥 SIGNING APPROVE PSBT (EXACTLY LIKE DEPOSIT - NO PARAMS)...');

                    // Domain is whitelisted - sign with autoFinalized: false (like paymentPsbt)
                    signedApprove = await window.unisat.signPsbt(approvePsbt, { autoFinalized: false });
                    console.log('✅ APPROVE PSBT SIGNED! (Domain whitelisted, autoFinalized: false)');
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
        } else {
            throw new Error(sub.msg || 'Withdrawal confirmation failed');
        }
    } catch (e) {
        console.error('Withdraw error:', e);
        let msg = e.message || String(e);
        if (msg.includes('User rejected')) {
            msg =
                '⚠️ Signature Rejected!\n\nNote: If you signed the first transaction (fee), it was already broadcasted.\nYou may need to complete the withdrawal manually or wait for a refund.';
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

    console.log('✅ Chart initialized');

    // Load data and update chart
    loadHistoricalPrices().then(() => {
        updatePriceData();
    });
}

async function loadHistoricalPrices() {
    try {
        console.log('📊 Loading history from InSwap...', chartTimeframe);

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

        console.log('Price line API response:', json);

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
                console.log(`✅ Chart data saved: ${apiData.length} new points, ${deduplicated.length} total points`);
                console.log(`Timeframe: ${chartTimeframe}, timeRange: ${timeRange}`);
            } else {
                console.warn(`No valid price data from API for ${timeRange}`);
            }
        } else {
            console.warn(`No data from price_line API for ${timeRange}, code: ${json.code}`);
        }

        // Always update chart after loading (even if no new data)
        updateChart();
    } catch (e) {
        console.error('Failed to load prices:', e);
        // Still try to update chart with existing data
        updateChart();
    }
}

async function updatePriceData() {
    try {
        const json = await safeFetchJson(`${BACKEND_URL}?action=quote&t=${Date.now()}`, {
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
                console.log(`💰 New price: ${price.toFixed(6)} FB/FENNEC`);
                updateChart();
            }
        }
    } catch (e) {
        console.error('Price update error:', e);
    }
}

function updateChart() {
    if (!priceChart) return;

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

    console.log(`📊 Chart: ${chartTimeframe} | ${filtered.length} points`);

    // Если нет данных за выбранный период - показываем последнюю известную цену
    if (filtered.length === 0 && stored.length > 0) {
        // Показываем последнюю цену из всей истории
        const lastPoint = stored[stored.length - 1];
        priceChart.data.labels = ['Now'];
        priceChart.data.datasets[0].data = [lastPoint.price];
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

    console.log(
        `📊 Chart: ${filtered.length} points -> ${deduplicated.length} deduplicated -> ${finalData.length} final`
    );

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
        console.log('✅ Chart updated with', finalData.length, 'points');
    } else {
        console.warn('⚠️ No data to display on chart');
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
            changeEl.className = changeEl.className.includes('text-xs')
                ? `text-xs ${change >= 0 ? 'text-green-500' : 'text-red-500'}`
                : `text-sm ${change >= 0 ? 'text-green-500' : 'text-red-500'}`;
        }
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
let globalPrices = { btc: 0, fb: 0, fennec: 0 };

// UPDATED TICKER FUNCTION - Использует CoinMarketCap через worker
async function updateLiveTicker() {
    try {
        const tickerEl = document.getElementById('liveTicker');
        if (!tickerEl) return;

        // ИСПРАВЛЕНИЕ ОТ GEMINI: Очищаем контейнер перед добавлением (убирает дублирование)
        const tickerContent = tickerEl.querySelector('#ticker-content') || tickerEl;
        if (tickerContent) {
            tickerContent.innerHTML = '';
        }

        // 1. Параллельно получаем цены и газ для ускорения
        const [priceRes, fractalFee, btcFeeRes] = await Promise.all([
            fetch(`${BACKEND_URL}?action=get_prices`, { signal: AbortSignal.timeout(8000) })
                .then(r => r.json())
                .catch(() => null),
            fetch(`${BACKEND_URL}?action=gas`)
                .then(r => r.json())
                .catch(() => ({ fastestFee: 1 })),
            fetch('https://mempool.space/api/v1/fees/recommended')
                .then(r => r.json())
                .catch(() => ({ fastestFee: 1 }))
        ]);

        if (priceRes) {
            globalPrices.btc = priceRes.btc || globalPrices.btc || 0;
            globalPrices.fb = priceRes.fb || globalPrices.fb || 0;
            globalPrices.fennec = priceRes.fennec_in_fb || globalPrices.fennec || 0;

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
                `<span class="text-white inline-flex items-center gap-2 font-bold"><img src="img/BTC.svg" class="w-4 h-4 rounded-full" onerror="this.style.display='none'"> BTC: $${globalPrices.btc.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>`
            );
        }

        // FB (показываем 2 знака, если цена > 1, иначе 4)
        if (globalPrices.fb > 0) {
            const fbDecimals = globalPrices.fb >= 1 ? 2 : 4;
            items.push(
                `<span class="text-white inline-flex items-center gap-2 font-bold"><img src="img/FB.png" class="w-4 h-4 rounded-full" onerror="this.style.display='none'"> FB: $${globalPrices.fb.toFixed(fbDecimals)}</span>`
            );
        } else {
            items.push(
                `<span class="text-white inline-flex items-center gap-2 font-bold"><img src="img/FB.png" class="w-4 h-4 rounded-full" onerror="this.style.display='none'"> FB: Loading...</span>`
            );
        }

        // FENNEC - всегда показываем последнюю известную цену
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
                `<span class="text-fennec inline-flex items-center gap-2 font-bold"><img src="img/fennec.jpg" class="w-4 h-4 rounded-full" onerror="this.style.display='none'"> FENNEC: ${fennecPrice.toFixed(6)} FB</span>`
            );
        } else {
            items.push(
                `<span class="text-fennec inline-flex items-center gap-2 font-bold"><img src="img/fennec.jpg" class="w-4 h-4 rounded-full" onerror="this.style.display='none'"> FENNEC: --</span>`
            );
        }

        // Gas
        const fractalGas = fractalFee.fastestFee || 1;
        const btcGas = btcFeeRes.fastestFee || 1;
        items.push(`<span class="text-gray-400 inline-flex items-center gap-2">⛽ Bitcoin: ${btcGas} sat/vB</span>`);
        items.push(
            `<span class="text-gray-400 inline-flex items-center gap-2">⛽ Fractal: ${fractalGas} sat/vB</span>`
        );

        const tickerHtml = items.join('<span class="mx-6 text-gray-700">|</span>');

        // ИСПРАВЛЕНИЕ: Убираем дублирование - показываем только один раз
        if (tickerContent) {
            tickerContent.innerHTML = tickerHtml;
        } else {
            tickerEl.innerHTML = tickerHtml;
        }
    } catch (e) {
        console.error('❌ Ticker update error:', e);
        const tickerEl = document.getElementById('liveTicker');
        if (tickerEl) {
            tickerEl.innerHTML =
                '<span class="text-fennec font-bold inline-flex items-center gap-1"><img src="img/fennec.jpg" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'"> FENNEC SYSTEM ONLINE</span>';
        }
    }
}

// ИСПРАВЛЕНИЕ: Оптимизированные автоматические обновления с правильными интервалами
// Баланс обновляется чаще, остальное - реже

// Функция для ручного обновления всех данных
async function manualRefresh() {
    const btn = document.getElementById('refreshBtn');
    if (btn) {
        btn.classList.add('animate-spin');
        btn.disabled = true;
    }

    try {
        // Обновляем все данные параллельно
        await Promise.all([
            fetchReserves(),
            userAddress ? checkBalance() : Promise.resolve(),
            userAddress ? refreshTransactionHistory() : Promise.resolve(),
            updateLiveTicker(),
            updatePriceData()
        ]);

        // Показываем уведомление
        if (typeof showNotification === 'function') {
            showNotification('✅ Данные обновлены', 'success', 2000);
        }
    } catch (e) {
        console.error('Refresh error:', e);
        if (typeof showNotification === 'function') {
            showNotification('❌ Ошибка обновления', 'error', 2000);
        }
    } finally {
        if (btn) {
            btn.classList.remove('animate-spin');
            btn.disabled = false;
        }
    }
}

// Инициализация - загружаем данные один раз при загрузке страницы
fetchReserves();
updateLiveTicker(); // Первый запуск тикера

// Load transaction history on page load if wallet connected (только один раз)
if (userAddress) {
    setTimeout(() => {
        checkBalance();
        refreshTransactionHistory();
    }, 2000);
}

// ИСПРАВЛЕНИЕ: Автоматические обновления с оптимизированными интервалами
// Баланс обновляется чаще (каждые 20 секунд), остальное - реже
if (userAddress) {
    setInterval(checkBalance, 20000); // Баланс каждые 20 секунд (чаще)
}
setInterval(fetchReserves, 30000); // Резервы каждые 30 секунд
setInterval(refreshTransactionHistory, 60000); // История каждую минуту (увеличено с 30 сек)
setInterval(updateLiveTicker, 60000); // Тикер каждую минуту (увеличено с 30 сек)
setInterval(updatePriceData, 60000); // Цены каждую минуту
// Force Scroll to Top Logic
window.onbeforeunload = function () {
    window.scrollTo(0, 0);
};
window.onload = function () {
    setTimeout(() => window.scrollTo(0, 0), 10);
    setTimeout(() => window.scrollTo(0, 0), 100);
};

// Scroll to top on page load
window.scrollTo({ top: 0, behavior: 'instant' });
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        setTimeout(() => window.scrollTo(0, 0), 10);
        setTimeout(initChart, 1000);
    });
} else {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setTimeout(() => window.scrollTo(0, 0), 10);
    setTimeout(initChart, 1000);
}

// Also scroll to top when page becomes visible (handles back button)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
});

console.log('📊 Chart loading historical data from InSwap API...');

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
                    document.getElementById('progressStep').innerText = '✅ Completed!';
                    document.getElementById('progressTitle').innerText = 'Withdrawal Complete!';
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        closeProgress();
                        checkBalance();
                    }, 3000);
                } else if (data.status === 'pendingOrder') {
                    document.getElementById('progressStep').innerText =
                        `⏳ Processing... (${confirmed}/${total} confirmed)`;
                } else if (data.status === 'cancelled') {
                    document.getElementById('progressStep').innerText = '❌ Cancelled';
                    clearInterval(progressInterval);
                } else {
                    document.getElementById('progressStep').innerText = `Status: ${data.status}`;
                }

                console.log(`📊 Withdraw progress: ${confirmed}/${total} (${percent}%) - ${data.status}`);
            }
        } catch (e) {
            console.error('Progress tracking error:', e);
        }

        // Таймаут после 5 минут
        if (attempts >= maxAttempts) {
            document.getElementById('progressStep').innerText = '⏱️ Timeout - check InSwap manually';
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
                    document.getElementById('progressStep').innerText = '✅ Completed!';
                    document.getElementById('progressTitle').innerText = 'Deposit Complete!';
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        closeProgress();
                        checkBalance();
                        refreshTransactionHistory();
                    }, 3000);
                } else if (data.status === 'pendingOrder' || data.status === 'pending') {
                    document.getElementById('progressStep').innerText =
                        `⏳ Processing... (${confirmed}/${total} confirmations)`;
                } else if (data.status === 'cancelled') {
                    document.getElementById('progressStep').innerText = '❌ Cancelled';
                    clearInterval(progressInterval);
                } else {
                    document.getElementById('progressStep').innerText =
                        `Status: ${data.status} (${confirmed}/${total})`;
                }

                console.log(`📊 Deposit progress: ${confirmed}/${total} (${percent}%) - ${data.status}`);
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
                    document.getElementById('progressStep').innerText = '✅ Deposit received!';
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
            document.getElementById('progressStep').innerText = '⏱️ Timeout - check InSwap manually';
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
            const fbRes = await fetch(`${BACKEND_URL}?action=history&address=${userAddress}&tick=FB`);
            if (fbRes.ok) {
                resFB = await fbRes.json();
            }
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
            txs = txs.concat(
                resFB.data.detail.map(item => {
                    // Вычисляем изменение баланса для определения типа
                    const netAmount = item.inSatoshi - item.outSatoshi; // Грубая оценка
                    return {
                        type: 'Tx',
                        amount: (Math.abs(item.inSatoshi || item.outSatoshi || 0) / 1e8).toFixed(4), // Просто показываем объем
                        tick: 'FB',
                        time: item.timestamp || item.blocktime,
                        txid: item.txid
                    };
                })
            );
        }

        // Сортируем по времени (новые сверху) и берем топ 5
        txs.sort((a, b) => b.time - a.time);
        txs = txs.slice(0, 5);

        // Рендерим
        if (txs.length === 0) {
            listEl.innerHTML = '<div class="text-center py-2 opacity-50">No recent transactions</div>';
        } else {
            listEl.innerHTML = txs
                .map(tx => {
                    const date = new Date(tx.time * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    const isFennec = tx.tick === 'FENNEC';
                    const colorClass = isFennec ? 'text-fennec' : 'text-white';

                    const txExplorerUrl = `https://uniscan.cc/fractal/tx/${tx.txid}`;

                    return `
                        <div class="flex justify-between items-center py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition px-2 rounded">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs">
                                    ${tx.tick === 'FENNEC' ? '<img src="img/fennec.jpg" class="w-4 h-4 inline-block object-contain">' : '⚡'}
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-gray-300">${tx.type}</div>
                                    <div class="text-[10px] text-gray-600 font-mono">${date}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs font-bold ${colorClass}">${tx.amount} ${tx.tick}</div>
                                <a href="${txExplorerUrl}" target="_blank" class="text-[9px] text-gray-600 hover:text-white underline decoration-dotted">View</a>
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
async function refreshTransactionHistory() {
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
        console.warn('History element not found for tab:', currentTab);
        return;
    }

    // For swap history, load immediately without wallet
    if (!userAddress && currentTab !== 'swap') {
        historyEl.innerHTML = `<div class="text-center py-4 text-gray-500 text-xs">Connect wallet to view history</div>`;
        return;
    }

    // Load swap history immediately even without wallet
    if (currentTab === 'swap' || !currentTab) {
        // Continue to load swap history
    }

    try {
        let filterTick = null;
        let filterType = currentTab === 'deposit' ? 'deposit' : currentTab === 'withdraw' ? 'withdraw' : 'swap';

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
                    safeFetchJson(`${BACKEND_URL}?action=withdraw_history&address=${userAddress}&start=0&limit=50`, {
                        timeoutMs: 12000,
                        retries: 2
                    }).then(r => r || { code: -1 })
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
            console.log(`📤 Loading withdraw history: ${withdrawals.length} total entries from API`);

            // 1. Строгая фильтрация на клиенте - только FB и FENNEC withdrawals для текущего адреса
            const basicList = withdrawals
                .filter(w => {
                    // Проверяем адрес (если есть в ответе API)
                    if (w.address && w.address.toLowerCase() !== userAddress.toLowerCase()) {
                        console.log(
                            `⚠️ Skipping withdraw - wrong address. Expected: ${userAddress}, Got: ${w.address}`
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
                        console.log(`⚠️ Skipping withdraw - not FB/FENNEC/BTC. Tick: "${tick}"`, w);
                        return false;
                    }

                    // Логируем успешный withdrawal для отладки
                    console.log(`✅ Valid withdraw: ${w.amount || 0} ${tick} (ID: ${w.id})`);
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
                        console.warn(`⚠️ Unknown tick format but passed filter: "${tick}"`, w);
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

            console.log(
                `✅ Filtered to ${basicList.length} valid withdrawals (FB + FENNEC) from ${withdrawals.length} total`
            );

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
                        w.id ||
                        '';
                    let status = w.status;

                    const needsResolution = !isLikelyHash(displayTxid);

                    // ИСПРАВЛЕНИЕ: Всегда запрашиваем детали для получения receiveTxid (не payTxid)
                    // Для withdraw транзакций нужно использовать receiveTxid, а не payTxid
                    if (needsResolution) {
                        try {
                            // Запрашиваем детали БЕЗ параметра address (только ID)
                            const detailRes = await safeFetchJson(`${BACKEND_URL}?action=withdraw_process&id=${w.id}`, {
                                timeoutMs: 12000,
                                retries: 2
                            });

                            if (detailRes && detailRes.code === 0 && detailRes.data) {
                                // ИСПРАВЛЕНИЕ: Приоритет receiveTxid (это транзакция получения на Bitcoin Mainnet)
                                // НЕ используем payTxid (это транзакция сжигания на Fractal)
                                const realHash =
                                    detailRes.data.receiveTxid ||
                                    detailRes.data.receiveTxId ||
                                    detailRes.data.receive_txid ||
                                    detailRes.data.receiveTxHash ||
                                    detailRes.data.approveTxid ||
                                    detailRes.data.rollUpTxid ||
                                    detailRes.data.inscribeTxid ||
                                    detailRes.data.paymentTxid ||
                                    displayTxid;

                                // НЕ используем payTxid, так как это транзакция сжигания, а не получения
                                // payTxid = транзакция сжигания на Fractal
                                // receiveTxid = транзакция получения на Bitcoin Mainnet (это то, что нужно)

                                if (isLikelyHash(realHash)) {
                                    displayTxid = realHash;
                                    // console.log(`✅ Using receiveTxid for withdraw ${w.id} (${tick}) -> ${realHash}`);
                                }
                            }
                        } catch (err) {
                            console.warn(`Failed to verify withdraw ${w.id}`, err);
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
            console.log(`✅ Processed ${allTxs.length} withdrawals (sorted by time)`);
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

                console.log(`✅ Loaded ${swapList.length} swaps from API (FB-FENNEC + BTC-FB)`);
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

            console.log(`✅ Filtered to ${swapList.length} swaps for pair ${currentSwapPair}`);
            allTxs = swapList;
        }

        // Рендер
        allTxs.sort((a, b) => (b.ts || 0) - (a.ts || 0));

        if (allTxs.length === 0) {
            if (historyEl) {
                historyEl.innerHTML = `<div class="text-center py-4 text-gray-500 text-xs">No ${filterType} history found</div>`;
            }
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
                    date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
                    ', ' +
                    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                const isDeposit = tx.type === 'deposit';
                const isSwap = tx.type === 'swap';

                // Статус
                let status = tx.status || 'completed';
                let statusColor = 'text-green-400';
                let statusText = status;

                // Для вывода обрабатываем подтверждения
                if (tx.type === 'withdraw') {
                    if (status === 'completed' || tx.isSuccess) {
                        statusText = 'Completed';
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
                        tx.approveTxid ||
                        tx.rollUpTxid ||
                        tx.inscribeTxid ||
                        tx.paymentTxid ||
                        tx.receiveTxid ||
                        tx.receiveTxId ||
                        tx.receive_txid ||
                        tx.receiveTxHash ||
                        tx.txid ||
                        tx.hash ||
                        tx.id ||
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
                    const netRaw = (tx.networkType || tx.network_type || tx.network || '').toString().toUpperCase();
                    const isBitcoinMainnet = netRaw.includes('BITCOIN') && !netRaw.includes('FRACTAL');
                    const useMempool = tx.type === 'deposit' && (isBitcoinMainnet || tickNorm === 'BTC');

                    txLink = useMempool
                        ? `<a href="https://mempool.space/tx/${realTxid}" target="_blank" class="text-[10px] text-fennec hover:text-white mt-1 block truncate w-20">View TX ↗</a>`
                        : `<a href="https://uniscan.cc/fractal/tx/${realTxid}" target="_blank" class="text-[10px] text-fennec hover:text-white mt-1 block truncate w-20">View TX ↗</a>`;
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

                    // Icons for tokens (using site assets from img folder)
                    const payIcon =
                        payTick === 'FENNEC'
                            ? '<img src="img/fennec.jpg" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">'
                            : payTick === 'BTC'
                              ? '<img src="img/BTC.svg" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">'
                              : '<img src="img/FB.png" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">';
                    const receiveIcon =
                        receiveTick === 'FENNEC'
                            ? '<img src="img/fennec.jpg" class="w-4 h-4 rounded-full" onerror="this.style.display=\'none\'">'
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
                                            <span class="font-bold text-white">${payAmt}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-gray-500 text-[10px] mb-1">Receive</div>
                                        <div class="flex items-center gap-1">
                                            ${receiveIcon}
                                            <span class="font-bold text-white">${receiveAmt}</span>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-gray-500 text-[10px] mb-1">Time</div>
                                        <div class="text-[10px] text-gray-400">${dateStr}</div>
                                        ${txLink}
                                    </div>
                                </div>
                            </div>
                        `;
                }

                // For deposit/withdraw, show simple format
                let amount = formatAmount(tx.amount || tx.totalAmount || 0);

                // Нормализуем тикер: убираем префиксы sFB, sBTC и т.д.
                let displayTick = tx.tick || 'FB';
                if (displayTick.includes('sFB') || displayTick === 'sFB___000') displayTick = 'FB';
                if (displayTick.includes('sBTC') || displayTick === 'sBTC___000') displayTick = 'BTC';
                if (displayTick.includes('FENNEC')) displayTick = 'FENNEC';

                return `
                        <div class="bg-black/30 border border-white/5 rounded-lg p-3 mb-2 hover:bg-black/40 transition">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-full flex items-center justify-center ${isDeposit ? 'bg-green-500/20 text-green-400' : 'bg-fennec/20 text-fennec'}">
                                        <i class="fas ${isDeposit ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i>
                                    </div>
                                    <div>
                                        <div class="text-xs font-bold text-white">${tx.type.toUpperCase()} ${amount} ${displayTick}</div>
                                        <div class="text-[10px] text-gray-500">${dateStr}</div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs font-bold ${isDeposit ? 'text-green-400' : 'text-fennec'}">${amount}</div>
                                    <div class="text-[10px] ${statusColor} mt-1">${statusText}</div>
                                    ${txLink}
                                </div>
                            </div>
                        </div>
                    `;
            })
            .join('');
    } catch (e) {
        console.error('Hist Error', e);
        historyEl.innerHTML = `<div class="text-center py-4 text-red-500 text-xs">Error loading history</div>`;
    }
}

// ===== FENNEC ORACLE LOGIC =====
let isOracleOpen = false;

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
    for (const it of items) {
        if (it.role === 'user') {
            chat.innerHTML += `<div class="flex justify-end msg-anim"><div class="bg-fennec/20 p-3 rounded-lg text-white max-w-[75%] text-xs leading-relaxed">${escapeHtml(it.text)}</div></div>`;
        } else {
            chat.innerHTML += `<div class="flex gap-2 items-start msg-anim"><div class="w-6 h-6 flex-shrink-0"><img src="img/FENNECAI.png" class="w-full h-full object-contain ai-avatar"></div><div class="bg-white/5 p-3 rounded-lg text-gray-300 flex-1 text-xs leading-relaxed oracle-md">${renderOracleMarkdown(escapeHtml(it.text))}</div></div>`;
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

window.oracleQuick = function (type) {
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
            chat.innerHTML = `<div class="flex gap-3"><div class="w-6 h-6 flex items-center"><img src="img/FENNECAI.png" class="w-full h-full object-contain ai-avatar"></div><div class="bg-white/5 p-2 rounded-lg rounded-tl-none">Ask me anything about Fennec.</div></div>`;
        }
        const input = document.getElementById('chatInput');
        if (input) input.focus();
        return;
    }
};

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    const chat = document.getElementById('chatMessages');
    chat.innerHTML += `<div class="flex justify-end msg-anim"><div class="bg-fennec/20 p-3 rounded-lg text-white max-w-[75%] text-xs leading-relaxed">${escapeHtml(msg)}</div></div>`;
    pushChatHistory('user', msg);
    input.value = '';
    try {
        setChatLoading(true);
        const activeSectionId = document.querySelector('.page-section.active')?.id || '';
        const currentTab = document.querySelector('.tab-btn.active')?.id?.replace('tab-', '') || '';
        const history = loadChatHistory()
            .slice(-12)
            .map(it => ({ role: it.role === 'assistant' ? 'assistant' : 'user', content: String(it.text || '') }));

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
                console.log('🤖 AI Action detected:', action);
                executeAIAction(action);
            } catch (err) {
                console.error('❌ Failed to parse AI action:', err, 'Command JSON:', commandJson);
            }
        } else {
            console.log('⚠️ No AI action command found in reply');
        }
        // ---------------------------
        const cleanText = cleanReply.trim();
        pushChatHistory('assistant', cleanText);
        chat.innerHTML += `<div class="flex gap-2 items-start msg-anim"><div class="w-6 h-6 flex-shrink-0"><img src="img/FENNECAI.png" class="w-full h-full object-contain ai-avatar"></div><div class="bg-white/5 p-3 rounded-lg text-gray-300 flex-1 text-xs leading-relaxed oracle-md">${renderOracleMarkdown(escapeHtml(cleanText))}</div></div>`;
        chat.scrollTop = chat.scrollHeight;
    } catch (e) {
        chat.innerHTML += `<div class="text-red-500 text-center text-[10px]">Error</div>`;
    } finally {
        setChatLoading(false);
    }
}

// ===== AI ACTION EXECUTOR =====
async function executeAIAction(action) {
    console.log('🤖 Executing AI action:', action.type, action.params);

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
            if (userAddress && typeof window.refreshAudit === 'function') {
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
            await connectWallet();
        }
        highlightElement('connectBtn');
    }

    // 4. ВЫПОЛНЕНИЕ СВАПА (полный цикл)
    if (action.type === 'EXECUTE_SWAP') {
        // Проверяем кошелек
        if (!userAddress) {
            await connectWallet();
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
            await connectWallet();
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
            await connectWallet();
            await new Promise(r => setTimeout(r, 1000));
        }
        if (userAddress && typeof window.refreshAudit === 'function') {
            window.refreshAudit();
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
        if (typeof fetchBalances === 'function') {
            await fetchBalances();
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
// auditIdentity already defined above

// Calculate Fennec Identity (Logic from React component)
// Функция расчета (Использует готовые stats)
function calculateFennecIdentity(data) {
    const { netWorth, txCount, utxoCount, first_tx_ts, stats, prices, lpValueFB, lpValueUSD, stakedFB } = data;

    // ИСПРАВЛЕНИЕ: НЕ используем fallback - только реальные данные
    const now = Math.floor(Date.now() / 1000);
    const MIN_VALID = 1700000000; // Ноябрь 2023
    let daysAlive = 0;
    let validFirstTxTs = first_tx_ts || 0;

    // ИСПРАВЛЕНИЕ: Проверяем, не в миллисекундах ли timestamp
    if (validFirstTxTs > 1000000000000) {
        // Если timestamp > 1000000000000, это миллисекунды, конвертируем в секунды
        validFirstTxTs = Math.floor(validFirstTxTs / 1000);
        console.log(`⚠️ Converted timestamp from milliseconds: ${validFirstTxTs}`);
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
                `❌ Invalid first_tx_ts in calculateFennecIdentity: ${validFirstTxTs} (date: ${new Date(validFirstTxTs * 1000).toISOString()}, year: ${tsYear}, month: ${tsMonth + 1}, day: ${tsDay}). Current: ${currentYear}-${currentMonth + 1}-${currentDay}, now: ${now}, validFirstTxTs > now: ${validFirstTxTs > now}`
            );
            validFirstTxTs = 0;
            daysAlive = 0;
        } else {
            // Timestamp неправильный по другим причинам - возвращаем 0
            console.error(
                `❌ Invalid first_tx_ts in calculateFennecIdentity: ${validFirstTxTs} (date: ${new Date(validFirstTxTs * 1000).toISOString()}). Valid range: ${MIN_VALID} - ${now}`
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
    const isWhale = netWorthUSD >= 500;
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
        title: 'THE DRIFTER',
        tier: 'Nomad',
        desc: 'Passing through the fractal dunes.',
        color: 'text-gray-400',
        badges: [],
        icon: '<img src="img/drifter.png" class="w-full h-full object-contain">' // Drifter
    };

    // ✅ НОВАЯ ПРОВЕРКА: FENNEC SOUL (Холдер или LP)
    // Проверяем общий баланс FENNEC (Native + Swap)
    // ИСПРАВЛЕНИЕ: fennecBalance может быть строкой (toFixed), парсим
    const fennecTotal =
        typeof data.fennecBalance === 'string' ? parseFloat(data.fennecBalance) : data.fennecBalance || 0;
    const hasFennecInLP = data.has_fennec_in_lp || false; // ИСПРАВЛЕНИЕ: Проверяем есть ли LP с FENNEC
    const hasFennecSoul = fennecTotal > 1 || isLiquidityProvider || hasFennecInLP; // Если есть хоть 1 токен или LP (включая LP с FENNEC)

    const nativeFB = Number(data.nativeBalance || 0) || 0;
    const isMempoolRider = (Number(txCount) || 0) >= 10000;
    const isDustDevil = (Number(txCount) || 0) >= 1000 && nativeFB < 2;

    // Collection of all earned badges (v6)
    let badges = [];
    if (isGenesis)
        badges.push({
            name: 'GENESIS',
            icon: '💎',
            desc: 'You witnessed the first sunrise over the Fractal dunes.',
            img: 'img/badge_genesis.png'
        });
    if (isWhale)
        badges.push({
            name: 'WHALE',
            icon: '🐋',
            desc: 'When you move, the sands shift beneath you.',
            img: 'img/badge_whale.png'
        });
    if (isLiquidityProvider)
        badges.push({
            name: 'PROVIDER',
            icon: '💧',
            desc: 'The desert is thirsty, but your well runs deep.',
            img: 'img/badge_provider.png'
        });
    if (fennecTotal >= 10000 || hasFennecInLP)
        badges.push({
            name: 'FENNEC MAXI',
            icon: '🔥',
            desc: 'The Spirit of the Fox guides your path.',
            img: 'img/badge_maxi.png'
        });
    if (isArtifactHunter)
        badges.push({
            name: 'ARTIFACT HUNTER',
            icon: '🏺',
            desc: 'Your pockets are heavy with echoes of the chain.',
            img: 'img/badge_collector.png'
        });
    if (isRuneKeeper)
        badges.push({
            name: 'RUNE KEEPER',
            icon: '🧿',
            desc: 'You decipher the glyphs. The stones speak to you.',
            img: 'img/badge_rune.png'
        });
    if (isMempoolRider)
        badges.push({
            name: 'MEMPOOL RIDER',
            icon: '⚡',
            desc: 'Surfing the chaos of the 30-second block waves.',
            img: 'img/badge_mempool_rider.png'
        });
    if (isDustDevil)
        badges.push({ name: 'DUST DEVIL', icon: '🌪️', desc: 'A whirlwind of activity that left only dust behind.' });

    // Assign badges to archetype
    archetype.badges = badges;
    const badgeCount = badges.length;

    // --- 3. DETERMINE BASE ARCHETYPE ---
    // Сначала определяем "ветку развития" (Base Class)
    let baseKey = 'DRIFTER'; // default

    if (isGenesis && isLiquidityProvider && isWhale) baseKey = 'PRIME';
    else if (isLiquidityProvider && lpValueFB > 500) baseKey = 'LORD';
    else if (isGenesis) baseKey = 'WALKER';
    else if (isArtifactHunter && isRuneKeeper) baseKey = 'KEEPER';
    else if (runesCount > 100) baseKey = 'SHAMAN';
    else if (txCount > 1000) baseKey = 'ENGINEER';
    else if (netWorth > 200) baseKey = 'MERCHANT';
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
        WALKER: ['PATHFINDER', 'STONE WALKER', 'IRON WALKER', 'ETERNAL WALKER'],
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
    const activityPoints = Math.round(30 * (Math.log10(1 + Math.min(txCountNum, 10000)) / Math.log10(1 + 10000)));
    const wealthPoints = Math.round(20 * Math.sqrt(Math.min(netWorthUSD, 500) / 500));
    const timePoints = Math.round(15 * (Math.min(daysAlive, 365) / 365));

    const badgeWeights = {
        GENESIS: 15,
        WHALE: 10,
        PROVIDER: 8,
        'ARTIFACT HUNTER': 3,
        'RUNE KEEPER': 3,
        'MEMPOOL RIDER': 7,
        'DUST DEVIL': 3,
        'FENNEC MAXI': 0
    };
    const badgesPointsRaw = badges.reduce((sum, b) => sum + (badgeWeights[b.name] || 0), 0);
    const badgesPoints = Math.min(35, badgesPointsRaw);
    const baseScoreRaw = activityPoints + wealthPoints + timePoints + badgesPoints;
    const baseScore = Math.min(100, baseScoreRaw);
    const hasMaxi = badges.some(b => b.name === 'FENNEC MAXI');
    const multiplier = hasMaxi ? 1.2 : 1;
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
    let activityStatus = rarityName;
    let activityColor = rarityColor; // ИСПРАВЛЕНИЕ: Определяем activityColor

    // ИСПРАВЛЕНИЕ: hasFennecSoul уже объявлен выше (строка 6329), не дублируем

    return {
        archetype,
        metrics: {
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
            fbTotal: ((data.nativeBalance || 0) + (data.fbSwapBalance || 0) + lpValueFB).toFixed(2), // ИСПРАВЛЕНИЕ: Используем данные из data
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
            nativeBalance: data.nativeBalance.toFixed(4),
            fennecBalance: data.fennecBalance,
            fbSwapBalance: data.fbSwapBalance || 0,
            stakedFB: stakedFB || 0,
            lpValueFB: lpValueFB || 0,
            lpValueUSD: lpValueUSD || 0, // Сохраняем для совместимости
            fbTotal: (parseFloat(data.nativeBalance) + (data.fbSwapBalance || 0) + (stakedFB || 0)).toFixed(2),
            // ✅ Передаем флаг души
            hasFennecSoul,
            hasFennecInLP,
            hasFennecMaxi: hasMaxi,
            badgeCount // Передаем кол-во для UI
        }
    };
}

// Fetch Fennec ID data (v5 - Exact Counts from API)
async function fetchAuditData(abortSignal = null) {
    if (!userAddress) {
        // ИСПРАВЛЕНИЕ: Вместо ошибки, предлагаем подключить кошелек
        const shouldConnect = confirm('Please connect your wallet first. Would you like to connect now?');
        if (shouldConnect) {
            await window.connectWallet();
            if (!userAddress) {
                throw new Error('Wallet connection cancelled');
            }
        } else {
            throw new Error('Connect wallet first');
        }
    }
    console.log('🔍 Scanning Fennec ID (v5 - Exact Counts)...');

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
            ? `${BACKEND_URL}?action=fractal_audit&address=${userAddress}&pubkey=${pubkey}`
            : `${BACKEND_URL}?action=fractal_audit&address=${userAddress}`;
        // ИСПРАВЛЕНИЕ: Передаем abortSignal в fetch для возможности отмены запроса
        const workerRes = await fetch(url, { signal: abortSignal })
            .then(r => {
                if (abortSignal?.aborted) {
                    const abortError = new Error('Request aborted');
                    abortError.name = 'AbortError';
                    throw abortError;
                }
                return r.json();
            })
            .catch(e => {
                if (abortSignal?.aborted || e.name === 'AbortError') {
                    const abortError = new Error('Request aborted');
                    abortError.name = 'AbortError';
                    throw abortError;
                }
                return {};
            });
        const apiData = workerRes.data || {};
        // ИСПРАВЛЕНИЕ: Сохраняем данные для использования в минте
        window.lastAuditApiData = apiData;

        const fennecWalletFromWorker = parseFloat(apiData.fennec_wallet_balance || 0);
        const fennecInSwapFromWorker = parseFloat(apiData.fennec_inswap_balance || 0);

        // Prices (from Worker, calculated correctly via Pools)
        const prices = apiData.prices || { btc: 98000, fb: 4.5, fennec_in_fb: 0 };

        // Stats
        const utxoCount = apiData.utxo_count || 0;
        const txCount = apiData.tx_count || 0;
        const nativeBalance = apiData.native_balance || 0;

        // Age
        // ИСПРАВЛЕНИЕ: Без fallback - возвращаем ошибку если timestamp невалидный
        let daysAlive = 0; // 0 = ошибка
        const now = Math.floor(Date.now() / 1000);
        const MIN_VALID = 1700000000; // Ноябрь 2023

        // ИСПРАВЛЕНИЕ: НЕ используем fallback - только реальные данные
        let firstTxTs = apiData.first_tx_ts || 0;

        // ИСПРАВЛЕНИЕ: Проверяем, не в миллисекундах ли timestamp
        if (firstTxTs > 1000000000000) {
            firstTxTs = Math.floor(firstTxTs / 1000);
            console.log(`⚠️ Converted timestamp from milliseconds: ${firstTxTs}`);
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
                    `❌ Rejected future timestamp: ${firstTxTs} (date: ${new Date(firstTxTs * 1000).toISOString()}, year: ${tsYear}, month: ${tsMonth + 1}, day: ${tsDay}). Current: ${currentYear}-${currentMonth + 1}-${currentDay}, now: ${now}, firstTxTs > now: ${firstTxTs > now}`
                );
                firstTxTs = 0;
                daysAlive = 0;
            } else {
                // Timestamp неправильный по другим причинам - возвращаем 0
                console.error(
                    `❌ Invalid first_tx_ts: ${firstTxTs} (date: ${new Date(firstTxTs * 1000).toISOString()}). Valid range: ${MIN_VALID} - ${now}`
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
            console.log('✅ Using cached FENNEC balance:', fennecBalRes);
        } else {
            // Загружаем только если данных нет
            fennecBalRes = await fetch(`${BACKEND_URL}?action=balance&address=${userAddress}&tick=${T_FENNEC}`)
                .then(r => r.json())
                .catch(() => ({}));
        }

        if (userBalances && userBalances.sFB > 0) {
            // Используем данные из памяти
            sFbBalRes = { data: { balance: { swap: userBalances.sFB || 0, available: walletBalances.sFB || 0 } } };
            console.log('✅ Using cached sFB balance:', sFbBalRes);
        } else {
            // Загружаем только если данных нет
            sFbBalRes = await fetch(`${BACKEND_URL}?action=balance&address=${userAddress}&tick=${T_SFB}`)
                .then(r => r.json())
                .catch(() => ({}));
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
        console.log('📊 InSwap Balances Debug:', {
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
        let fbStakedBal = 0; // Всегда 0, так как стейкинг отключен

        // --- WEALTH CALCULATION (NO STAKING) ---
        const fbTotalBal = fbNativeBal + fbSwapBal; // Без стейкинга

        // 3. LP (Liquidity Pools) - ИСПРАВЛЕНИЕ: Используем данные из API, если они есть
        let lpValueFB = parseFloat(apiData.lp_value_fb || 0);
        let lpValueUSD = parseFloat(apiData.lp_value_usd || 0);

        // ИСПРАВЛЕНИЕ: Если LP не загрузились из my_pool_list, но есть в all_balance, используем их
        // Это fallback для случаев, когда my_pool_list возвращает null
        if (lpValueFB === 0 && lpValueUSD === 0) {
            // Попытка получить LP из других источников (если есть в debug или других полях)
            // Пока используем значения из API, которые должны быть рассчитаны в worker
            console.warn('⚠️ LP values are 0, but should be calculated in worker from all_balance or my_pool_list');
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
            console.log('✅ Using FENNEC price from terminal reserves:', fennecPriceInFB);
        }
        // ИСПРАВЛЕНИЕ: Убран fallback 0.0005 - показываем реальную цену или 0
        // Если цена 0, это означает что данные не загрузились - не используем фейковые значения
        if (fennecPriceInFB === 0) {
            console.warn('⚠️ FENNEC price is 0 - data not loaded');
        }

        // ИСПРАВЛЕНИЕ: Логика расчета Net Worth согласно требованиям:
        // Net Worth = all_tokens_value_usd + lp_value_usd + токены с кошелька, которых нет в InSwap
        let allTokensValueUSD = parseFloat(apiData.all_tokens_value_usd || 0);
        // ИСПРАВЛЕНИЕ: lpValueUSD уже объявлен выше (строка 6537), используем существующую переменную
        // const lpValueUSD = parseFloat(apiData.lp_value_usd || 0); // УДАЛЕНО: дублирование объявления

        // ИСПРАВЛЕНИЕ: Токены с кошелька, которых нет в InSwap, уже добавлены в worker.js в all_tokens_value_usd
        // Они включены в all_tokens_value_usd, если имеют цену

        // 5. ИТОГ: Net Worth = all_tokens_value_usd + lp_value_usd
        const netWorthUSD = allTokensValueUSD + lpValueUSD;

        console.log('💰 NET WORTH DEBUG:', {
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
        const ordinalsCount = apiData.ordinals_count || 0; // Total Inscriptions
        const lpCount = apiData.lp_count || 0;

        // ИСПРАВЛЕНИЕ: BRC-20 count - учитываем и InSwap балансы
        // Если есть BRC-20 токены в InSwap, которые не учтены в brc20Count, добавляем их
        let brc20CountFinal = brc20Count;
        // Проверяем есть ли BRC-20 токены в InSwap балансах (через all_balance или отдельные запросы)
        // Пока используем brc20Count из API, но можно расширить логику

        // ИСПРАВЛЕНИЕ: Убеждаемся, что значения - числа
        const finalRunesCount = Number(runesCount) || 0;
        const finalBrc20Count = Number(brc20CountFinal) || 0;

        // Debug logging
        console.log(
            `📊 Stats preparation: runesCount=${runesCount} (final=${finalRunesCount}), brc20Count=${brc20Count} (final=${finalBrc20Count})`
        );

        // Формируем данные для передачи
        const auditInput = {
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
            has_fennec_in_lp: apiData.has_fennec_in_lp || false, // ИСПРАВЛЕНИЕ: Передаем флаг наличия LP с FENNEC
            stats: {
                total: finalRunesCount + finalBrc20Count + ordinalsCount,
                runes: finalRunesCount,
                brc20: finalBrc20Count,
                ordinals: ordinalsCount,
                lp: lpCount
            },
            prices: {
                ...prices,
                fennec_in_fb: fennecPriceInFB // ИСПРАВЛЕНИЕ: Используем цену из терминала
            }
        };

        // Debug logging для проверки передачи
        console.log(`📦 auditInput.stats:`, JSON.stringify(auditInput.stats));
        console.log(
            `💰 FENNEC price:`,
            fennecPriceInFB,
            `(from terminal: ${poolReserves && poolReserves.FENNEC > 0 ? 'yes' : 'no'})`
        );

        return auditInput;
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log('Audit fetch aborted');
            throw e; // пробрасываем, чтобы runAudit корректно обработал отмену
        }
        console.error('Audit Fatal:', e);
        throw e;
    }
}

// Initialize Audit UI
function initAudit() {
    const container = document.getElementById('auditContainer');
    if (!container) return;

    // ИСПРАВЛЕНИЕ: Проверяем подключение кошелька - используем window.userAddress как основной источник
    // window.userAddress устанавливается в connectWallet() и всегда доступен глобально
    let currentAddr = window.userAddress || null;

    console.log('🔍 initAudit - currentAddr:', currentAddr, 'window.userAddress:', window.userAddress);

    // Дополнительная проверка через unisat API (если window.userAddress не установлен)
    if (!currentAddr && typeof window.unisat !== 'undefined' && window.unisat) {
        window.unisat
            .getAccounts()
            .then(accounts => {
                if (accounts && accounts.length > 0) {
                    const addr = accounts[0];
                    window.userAddress = addr;
                    console.log('✅ Got address from unisat API:', addr);
                    // Обновляем UI после получения адреса
                    setTimeout(() => initAudit(), 100);
                }
            })
            .catch(e => {
                console.log('⚠️ Could not get address from unisat:', e.message);
            });
        // Показываем кнопку CONNECT WALLET пока проверяем
        if (!currentAddr) {
            container.innerHTML = `
                        <div class="w-full max-w-md text-center">
                            <div class="mb-4 flex justify-center"><img src="img/FENNECID.png" class="w-24 h-24 object-contain drop-shadow-[0_0_20px_rgba(255,107,53,0.5)]"></div>
                            <h3 class="text-xl font-bold text-white mb-2">Discover Your Identity</h3>
                            <p class="text-gray-400 text-sm mb-6">Connect your wallet to reveal your Fennec ID</p>
                            <button onclick="window.connectWallet();"
                                    class="w-full px-6 py-4 bg-gradient-to-r from-fennec to-orange-600 hover:from-orange-500 hover:to-fennec text-black font-black rounded-xl shadow-[0_0_30px_rgba(255,107,53,0.4)] transition-all text-lg uppercase tracking-wider">
                                🦊 CONNECT WALLET
                            </button>
                        </div>
                    `;
            return;
        }
    }

    if (!currentAddr) {
        // Кошелек не подключен - показываем кнопку подключения
        container.innerHTML = `
                    <div class="w-full max-w-md text-center">
                        <div class="mb-4 flex justify-center"><img src="img/FENNECID.png" class="w-24 h-24 object-contain drop-shadow-[0_0_20px_rgba(255,107,53,0.5)]"></div>
                        <h3 class="text-xl font-bold text-white mb-2">Discover Your Identity</h3>
                        <p class="text-gray-400 text-sm mb-6">Connect your wallet to reveal your Fennec ID</p>
                        <button onclick="window.connectWallet();"
                                class="w-full px-6 py-4 bg-gradient-to-r from-fennec to-orange-600 hover:from-orange-500 hover:to-fennec text-black font-black rounded-xl shadow-[0_0_30px_rgba(255,107,53,0.4)] transition-all text-lg uppercase tracking-wider">
                            🦊 CONNECT WALLET
                        </button>
                    </div>
                `;
        return;
    }

    // ИСПРАВЛЕНИЕ: Кошелек подключен - показываем кнопку "GET YOUR ID" для запуска аудита
    // Показываем кнопку даже если аудит уже загружен (для обновления)
    container.innerHTML = `
                <div class="w-full max-w-md text-center">
                    <div class="mb-4 flex justify-center"><img src="img/FENNECID.png" class="w-24 h-24 object-contain drop-shadow-[0_0_20px_rgba(255,107,53,0.5)]"></div>
                    <h3 class="text-xl font-bold text-white mb-2">Discover Your Identity</h3>
                    <p class="text-gray-400 text-sm mb-6">Wallet connected: <span class="text-fennec font-mono text-xs">${currentAddr.substring(0, 10)}...${currentAddr.slice(-6)}</span></p>
                    <button onclick="runAudit();" id="getYourIdBtn"
                            class="w-full px-6 py-4 bg-gradient-to-r from-fennec to-orange-600 hover:from-orange-500 hover:to-fennec text-black font-black rounded-xl shadow-[0_0_30px_rgba(255,107,53,0.4)] transition-all text-lg uppercase tracking-wider">
                        🔍 GET YOUR ID
                    </button>
                </div>
            `;
}

// Run the audit
async function runAudit(forceRefresh = false) {
    // ИСПРАВЛЕНИЕ: Проверяем подключение кошелька перед запуском аудита
    if (!userAddress && !window.userAddress) {
        // Кошелек не подключен - автоматически подключаем
        if (typeof window.connectWallet === 'function') {
            try {
                await window.connectWallet();
                // После подключения показываем сообщение и обновляем UI
                if (window.userAddress) {
                    initAudit(); // Обновляем UI чтобы показать кнопку GET YOUR ID
                    alert('Wallet connected! Please click "GET YOUR ID" again to load your Fennec ID.');
                }
            } catch (e) {
                console.error('Failed to connect wallet:', e);
                alert('Failed to connect wallet. Please try again.');
            }
            return;
        } else {
            alert('Please connect your wallet first');
            return;
        }
    }

    // ИСПРАВЛЕНИЕ: Убрана подпись пользователя - не требуется для API запросов
    // let userSignature = null;

    const container = document.getElementById('auditContainer');
    if (!container) return;

    // ИСПРАВЛЕНИЕ: Проверяем кэш перед запросом (если не принудительное обновление)
    if (!forceRefresh && userAddress) {
        const cacheKey = `audit_v2_${userAddress}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const cachedData = JSON.parse(cached);
                // Проверяем что кэш не старше 5 минут
                if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
                    console.log('✅ Using cached audit data');
                    auditIdentity = cachedData.identity;
                    renderAudit(cachedData.identity);
                    return;
                }
            } catch (e) {
                console.warn('Failed to parse cached audit:', e);
            }
        }
    }

    // Если аудит уже идет — не запускаем новый до завершения/ошибки
    if (auditLoading) {
        console.log('⏳ Audit already running, wait for completion');
        return;
    }

    // ИСПРАВЛЕНИЕ: Отменяем предыдущий запрос, если он еще выполняется
    if (currentAuditAbortController) {
        currentAuditAbortController.abort();
    }

    // Создаем новый AbortController для текущего запроса
    currentAuditAbortController = new AbortController();
    const requestId = ++currentAuditRequestId;
    auditLoading = true;

    // ИСПРАВЛЕНИЕ: Сбрасываем данные только при принудительном обновлении
    if (forceRefresh) {
        auditIdentity = null;
    }

    container.innerHTML = `
                <div class="w-full max-w-md text-center">
                    <div class="mb-6 flex justify-center animate-pulse"><img src="img/FENNECID.png" class="w-32 h-32 object-contain drop-shadow-[0_0_30px_rgba(255,107,53,0.6)]"></div>
                    <div class="text-fennec text-xl font-bold mb-3 tracking-wide" style="animation: pulse 1.5s ease-in-out infinite;">🔍 Scanning Identity...</div>
                    <div class="progress-bar mb-3">
                        <div class="progress-fill indeterminate"></div>
                    </div>
                    <div class="text-gray-400 text-sm">Analyzing wallet activity and inscriptions</div>
                </div>
            `;

    try {
        console.log(`🔍 Starting audit scan (request #${requestId})...`);
        // ИСПРАВЛЕНИЕ: Таймаут 90 секунд (увеличен для надежности)
        const data = await Promise.race([
            fetchAuditData(currentAuditAbortController.signal),
            new Promise((_, reject) => {
                const timeoutId = setTimeout(() => {
                    if (requestId === currentAuditRequestId) {
                        reject(new Error('Loading took too long. Please try again later.'));
                    }
                }, 90000);
                // Отменяем таймаут если запрос отменен
                currentAuditAbortController.signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                });
            })
        ]);

        // ИСПРАВЛЕНИЕ: Проверяем, что это ответ на текущий запрос
        if (requestId !== currentAuditRequestId) {
            console.log(`⚠️ Ignoring stale response (request #${requestId}, current #${currentAuditRequestId})`);
            return;
        }

        console.log('📊 Audit data fetched:', data);
        const identity = calculateFennecIdentity(data);
        console.log('✅ Identity calculated:', identity);

        // ИСПРАВЛЕНИЕ: Еще раз проверяем перед рендерингом (на случай долгого расчета)
        if (requestId !== currentAuditRequestId) {
            console.log(`⚠️ Ignoring stale identity (request #${requestId}, current #${currentAuditRequestId})`);
            return;
        }

        auditIdentity = identity;

        // ИСПРАВЛЕНИЕ: Сохраняем в кэш
        if (userAddress) {
            const cacheKey = `audit_v2_${userAddress}`;
            localStorage.setItem(
                cacheKey,
                JSON.stringify({
                    identity: identity,
                    timestamp: Date.now()
                })
            );
        }

        renderAudit(identity);
        console.log('✅ Audit complete!');
    } catch (e) {
        // ИСПРАВЛЕНИЕ: Игнорируем ошибки от отмененных запросов
        if (e.name === 'AbortError' || requestId !== currentAuditRequestId) {
            console.log(`⚠️ Request #${requestId} was cancelled`);
            return;
        }

        console.error('❌ Audit error:', e);
        // ИСПРАВЛЕНИЕ: Показываем ошибку только если это текущий запрос
        if (requestId === currentAuditRequestId) {
            // ИСПРАВЛЕНИЕ: Убран авторефреш - только кнопка Retry now
            container.innerHTML = `
                        <div class="w-full max-w-md bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-red-200">
                            <p class="font-bold mb-2">Loading Error</p>
                            <p class="text-sm mb-4">${e.message || 'Failed to load data. Please try again later.'}</p>
                            <button onclick="runAudit()" class="w-full px-4 py-3 bg-fennec text-black font-bold rounded hover:bg-orange-600 transition">
                                Try Again
                            </button>
                        </div>
                    `;
        }
    } finally {
        // Сбрасываем флаг загрузки в любом случае (но если стартовал новый запрос, он снова выставит флаг)
        auditLoading = false;
    }
}

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

// Render Audit UI (3D CARD DESIGN - NEW CINEMATIC LAYOUT)
function renderAudit(identity) {
    const container = document.getElementById('auditContainer');
    if (!container) return;

    identity = applyParentOverridesToIdentity(identity);

    const { archetype, metrics } = identity;

    const k = archetype.baseKey || 'DRIFTER';
    const tier = archetype.tierLevel || 0;
    const visualKey = k;

    let bgImage = 'img/drifter.png';
    if (k === 'SINGULARITY') bgImage = 'img/singularity.png';
    else if (k === 'PRIME') bgImage = 'img/prime.png';
    else if (k === 'LORD') bgImage = 'img/oasis.png';
    else if (k === 'WALKER') bgImage = 'img/walker.png';
    else if (k === 'KEEPER') bgImage = 'img/keeper.png';
    else if (k === 'SHAMAN') bgImage = 'img/shaman.png';
    else if (k === 'ENGINEER') bgImage = 'img/engineer.png';
    else if (k === 'MERCHANT') bgImage = 'img/merchant.png';
    else bgImage = 'img/drifter.png';

    const imgClass = getAnimationClass(visualKey, tier);

    // Оверлей добавляем ТОЛЬКО для Tier 3 (максимальный эффект)
    let overlayHtml = '';
    let vfx3dHtml = '';
    let vfxWebglHtml = '';
    if (tier >= 1 && visualKey === 'ENGINEER') {
        const vfxOpacity = tier === 1 ? 0.18 : tier === 2 ? 0.34 : 0.64;
        vfx3dHtml = `<div class="vfx-3d" style="--vfx3d-opacity:${vfxOpacity};"></div>`;
        const vfxWebglOpacity = tier === 1 ? 0.12 : tier === 2 ? 0.18 : 0.32;
        vfxWebglHtml = `<div class="vfx-webgl" style="--vfxwebgl-opacity:${vfxWebglOpacity};"><canvas></canvas></div>`;
    }
    if (tier === 3) {
        overlayHtml = `<div class="overlay-${visualKey}" style="position:absolute;inset:0;"></div>${vfxWebglHtml}${vfx3dHtml}`;
    } else if (tier === 2) {
        overlayHtml = `<div class="overlay-${visualKey}" style="position:absolute;inset:0;opacity:0.30;"></div>${vfxWebglHtml}${vfx3dHtml}`;
    } else if (tier === 1) {
        overlayHtml = `<div class="overlay-${visualKey}" style="position:absolute;inset:0;opacity:0.18;"></div>${vfxWebglHtml}${vfx3dHtml}`;
    }

    // 3. ТЕКСТОВЫЕ СТИЛИ
    const titleClass = `text-tier-${tier}`;
    const rankBadgeClass = `rank-badge rank-badge-${tier}`;

    const maxiMultiplier = metrics.hasFennecMaxi ? 1.2 : 1.0;
    const maxiBoostPct = Math.round((maxiMultiplier - 1) * 100);

    const badgesFront = archetype.badges
        .slice(0, 6)
        .map(b => {
            const glow =
                'drop-shadow(0 0 14px rgba(255,107,53,0.85)) drop-shadow(0 0 22px rgba(255,255,255,0.22)) drop-shadow(0 0 40px rgba(168,85,247,0.16))';
            const frame =
                'background:linear-gradient(180deg,rgba(255,255,255,0.14),rgba(0,0,0,0.26));border:1px solid rgba(255,255,255,0.22);border-radius:9999px;box-sizing:border-box;backdrop-filter:blur(10px);box-shadow:0 0 0 1px rgba(255,107,53,0.16) inset,0 10px 18px rgba(0,0,0,0.35),0 0 18px rgba(255,107,53,0.12)';
            const content = b.img
                ? `<img src="${b.img}" style="width:100%;height:100%;object-fit:contain;filter:${glow}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"> <span style="display:none;font-size:14px;filter:${glow}">${b.icon}</span>`
                : `<span style="font-size:14px;filter:${glow}">${b.icon}</span>`;
            return `<div class="badge-medal" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;${frame}" title="${b.name}">${content}</div>`;
        })
        .join('');

    // 3. ВСЕ ВОЗМОЖНЫЕ БЕЙДЖИ (для отображения недоступных бледными)
    // ИСПРАВЛЕНИЕ: Используем данные из metrics для определения условий
    const inscriptionStatsData = metrics.inscriptionStats || { runes: 0, brc20: 0, ordinals: 0, total: 0 };
    const fennecTotal = parseFloat(metrics.fennecBalance || 0);
    const netWorth = parseFloat(metrics.wealth || 0);
    const daysAlive = metrics.daysAlive || 0;
    const txCount = metrics.txCount || 0;
    const lpValueFB = parseFloat(metrics.lpValueFB || 0);
    const hasFennecInLP = !!metrics.hasFennecInLP || lpValueFB > 0; // Fallback
    const nativeFB = parseFloat(metrics.nativeBalance || 0);

    // Проверяем условия для бейджей
    const LAUNCH_DATE = 1725840000;
    const firstTxTs = metrics.first_tx_ts || 0;
    const isGenesis = firstTxTs > 0 && firstTxTs >= LAUNCH_DATE && firstTxTs < LAUNCH_DATE + 86400;
    const isLiquidityProvider = parseFloat(metrics.lpValueUSD || 0) >= 50;
    const isWhale = netWorth >= 500;
    const isArtifactHunter =
        (Number(inscriptionStatsData.total || 0) ||
            Number(inscriptionStatsData.brc20 || 0) +
                Number(inscriptionStatsData.runes || 0) +
                Number(inscriptionStatsData.ordinals || 0)) >= 50;
    const isRuneKeeper = (Number(inscriptionStatsData.runes) || 0) >= 20;
    const isMempoolRider = (Number(txCount) || 0) >= 10000;
    const isDustDevil = (Number(txCount) || 0) >= 1000 && nativeFB < 2;

    const allPossibleBadges = [
        {
            name: 'GENESIS',
            icon: '💎',
            img: 'img/badge_genesis.png',
            desc: 'You witnessed the first sunrise over the Fractal dunes.',
            condition: isGenesis
        },
        {
            name: 'WHALE',
            icon: '🐋',
            img: 'img/badge_whale.png',
            desc: 'When you move, the sands shift beneath you.',
            condition: isWhale
        },
        {
            name: 'PROVIDER',
            icon: '💧',
            img: 'img/badge_provider.png',
            desc: 'The desert is thirsty, but your well runs deep.',
            condition: isLiquidityProvider
        },
        {
            name: 'FENNEC MAXI',
            icon: '🔥',
            img: 'img/badge_maxi.png',
            desc: 'The Spirit of the Fox guides your path.',
            condition: fennecTotal >= 10000 || hasFennecInLP
        },
        {
            name: 'ARTIFACT HUNTER',
            icon: '🏺',
            img: 'img/badge_collector.png',
            desc: 'Your pockets are heavy with echoes of the chain.',
            condition: isArtifactHunter
        },
        {
            name: 'RUNE KEEPER',
            icon: '🧿',
            img: 'img/badge_rune.png',
            desc: 'You decipher the glyphs. The stones speak to you.',
            condition: isRuneKeeper
        },
        {
            name: 'MEMPOOL RIDER',
            icon: '⚡',
            img: 'img/badge_mempool_rider.png',
            desc: 'Surfing the chaos of the 30-second block waves.',
            condition: isMempoolRider
        },
        {
            name: 'DUST DEVIL',
            icon: '🌪️',
            img: '',
            desc: 'A whirlwind of activity that left only dust behind.',
            condition: isDustDevil
        }
    ];

    // БЕЙДЖИ BACK (Все бейджи, недоступные бледные)
    const earnedBadgeNames = new Set((archetype.badges || []).map(earned => earned.name));
    const earnedBadges = allPossibleBadges.filter(b => earnedBadgeNames.has(b.name));
    const lockedBadges = allPossibleBadges.filter(b => !earnedBadgeNames.has(b.name));

    const badgesBack = [...earnedBadges, ...lockedBadges]
        .map(b => {
            const hasBadge = earnedBadgeNames.has(b.name);
            const iconOpacity = hasBadge ? '1' : '0.22';
            const nameOpacity = hasBadge ? '1' : '0.78';
            const descOpacity = hasBadge ? '0.7' : '0.55';
            const borderOpacity = hasBadge ? '0.18' : '0.10';
            const bgOpacity = hasBadge ? '0.06' : '0.035';
            const glow = hasBadge
                ? 'drop-shadow(0 0 10px rgba(255,107,53,0.28)) drop-shadow(0 0 18px rgba(255,255,255,0.12))'
                : 'drop-shadow(0 0 6px rgba(255,255,255,0.10))';
            const iconHtml = b.img
                ? `<img src="${b.img}" class="w-full h-full object-contain" style="filter:${glow}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span style="display:none;filter:${glow}">${b.icon}</span>`
                : `<span style="filter:${glow}">${b.icon}</span>`;
            return `<div title="${b.name} — ${b.desc}" style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,${bgOpacity});border:1px solid rgba(255,255,255,${borderOpacity});padding:10px 12px;border-radius:12px;width:100%;min-width:0;">
                    <div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:${iconOpacity}">${iconHtml}</div>
                    <div style="text-align:left;min-width:0;flex:1;">
                        <div style="font-size:9px;font-weight:900;color:rgba(255,255,255,${nameOpacity});text-transform:uppercase;letter-spacing:0.10em;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.name}</div>
                        <div style="margin-top:3px;font-size:9px;line-height:1.25;color:rgba(229,231,235,${descOpacity});">${b.desc || ''}</div>
                    </div>
                </div>`;
        })
        .join('');

    // Progress Bar Calculation (Макс 8 бейджей для 100%)
    const maxBadges = 8;
    const progressPercent = Math.min(100, (archetype.badges.length / maxBadges) * 100);

    // 4. КЛАССЫ ДЛЯ ЭФФЕКТОВ
    const soulClass = metrics.hasFennecSoul ? 'fennec-aura-border' : '';
    const rarityName = metrics.rarity?.name || metrics.rarityName || 'CUB';

    // Маппинг на новые классы для 3D карточки
    const rarityClassMap = {
        SPIRIT: 'card-spirit',
        ELDER: 'card-elder',
        ALPHA: 'card-alpha',
        HUNTER: 'card-hunter',
        SCOUT: 'card-scout',
        CUB: 'card-cub'
    };
    const rarityClass = metrics.rarity?.class || rarityClassMap[rarityName] || 'card-cub';

    // Цвет текста редкости
    let rarityTextClass = 'text-cub';
    if (rarityName === 'SPIRIT') rarityTextClass = 'text-spirit';
    else if (rarityName === 'ELDER') rarityTextClass = 'text-elder';
    else if (rarityName === 'ALPHA') rarityTextClass = 'text-alpha';
    else if (rarityName === 'HUNTER') rarityTextClass = 'text-hunter';
    else if (rarityName === 'SCOUT') rarityTextClass = 'text-scout';
    else rarityTextClass = 'text-cub';

    // Цвет заголовка
    const titleColor = archetype.color && archetype.color.includes('text-transparent') ? archetype.color : 'text-white';

    // ИСПРАВЛЕНИЕ: Определяем borderStyle для карточки
    const isSpirit = rarityName === 'SPIRIT';
    const borderColor = isSpirit
        ? 'transparent'
        : rarityName === 'ELDER'
          ? '#eab308'
          : rarityName === 'ALPHA'
            ? '#ef4444'
            : rarityName === 'HUNTER'
              ? '#3b82f6'
              : rarityName === 'SCOUT'
                ? '#22c55e'
                : '#555';

    const borderGlow = isSpirit
        ? 'transparent'
        : rarityName === 'ELDER'
          ? 'rgba(234,179,8,0.55)'
          : rarityName === 'ALPHA'
            ? 'rgba(239,68,68,0.55)'
            : rarityName === 'HUNTER'
              ? 'rgba(59,130,246,0.55)'
              : rarityName === 'SCOUT'
                ? 'rgba(34,197,94,0.55)'
                : 'rgba(120,120,120,0.35)';

    const borderStyle = isSpirit
        ? ''
        : `border: 3px solid ${borderColor}; box-shadow: 0 0 34px ${borderGlow}, inset 0 0 18px ${borderGlow}; outline: 1px solid rgba(255,255,255,0.10); outline-offset: -2px;`;

    // Безопасные значения для данных
    const fbTotal = metrics.fbTotal || '0.00';
    const lastApiData = window.lastAuditApiData || {};
    const inscriptionStatsForDisplay = {
        runes: Number(metrics.inscriptionStats?.runes ?? lastApiData.runes_count ?? 0) || 0,
        brc20: Number(metrics.inscriptionStats?.brc20 ?? lastApiData.brc20_count ?? 0) || 0,
        ordinals: Number(metrics.inscriptionStats?.ordinals ?? lastApiData.ordinals_count ?? 0) || 0,
        total: Number(metrics.inscriptionStats?.total ?? 0) || 0
    };

    try {
        container.innerHTML = `
                <div class="flex flex-col items-center animate-in fade-in zoom-in duration-500">

                    <div class="card-scene group cursor-pointer" onclick="toggleCardFlip(event, this)">
                        <div class="card-object ${rarityClass} ${metrics.hasFennecSoul ? 'fennec-pulse' : ''}" id="card3D" data-tier="${tier}" data-archetype="${visualKey}">

                            <!-- FRONT -->
                            <div class="card-face face-front flex flex-col" style="${borderStyle}">
                                <!-- Glare -->
                                <div class="card-glare"></div>

                                <!-- Background Image -->
                                <img src="${bgImage}" class="absolute inset-0 w-full h-full object-cover z-0 ${imgClass}" style="border-radius: 24px; width: 100%; height: 100%; object-position: center top;" onerror="console.error('Failed to load background image:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';">
                                <div class="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black z-0" style="border-radius: 24px; display:none; width: 100%; height: 100%;"></div>
                                ${overlayHtml}
                                <div class="card-holo-sheen"></div>
                                <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 z-10 rounded-3xl" style="clip-path: inset(0 round 24px);"></div>

                                <!-- Watermark убран по запросу -->

                                <!-- TOP -->
                                <div class="relative z-20 p-5 flex justify-center items-start">
                                    <div class="flex gap-2 flex-wrap justify-center" style="max-width:260px">${badgesFront}</div>
                                </div>

                                <!-- BOTTOM (Pushed Down) -->
                                <div class="relative z-20 mt-auto px-5 pb-6">
                                    <div class="text-center">
                                        ${archetype.tierLabel || archetype.tier ? `<div class="${rankBadgeClass} mb-2">${archetype.tierLabel || archetype.tier}</div>` : ''}
                                        <h2 class="text-3xl font-black uppercase italic leading-none drop-shadow-lg mb-4 ${titleClass} text-center">${archetype.title}</h2>

                                        <div class="mb-5"></div>
                                    </div>

                                    <div class="h-px w-full bg-gradient-to-r from-white/30 to-transparent mb-3"></div>

                                    <div class="flex items-center justify-between gap-2 mb-2" style="text-shadow: 0 2px 10px rgba(0,0,0,0.75);">
                                        ${metrics.hasFennecSoul ? '<div class="px-2 py-1 bg-fennec/20 backdrop-blur-md border border-fennec/50 rounded text-[9px] font-bold text-fennec flex items-center gap-1"><i class="fas fa-fire"></i> SOUL</div>' : '<div></div>'}
                                        <div class="text-right">
                                            <div class="text-[8px] text-white/70 font-mono tracking-widest mb-0.5">EVOLUTION</div>
                                            <div class="text-sm font-black italic tracking-widest uppercase ${rarityTextClass} drop-shadow-md">${rarityName}</div>
                                        </div>
                                    </div>

                                    <div class="text-[10px] text-gray-400 text-center tracking-widest">Tap card for details</div>
                                </div>
                            </div>

                            <!-- BACK -->
                            <div class="card-face face-back flex flex-col" style="${borderStyle}">
                                <div style="position:absolute;inset:0;opacity:0.06;background-image:url('img/FBSYM.png');background-repeat:no-repeat;background-position:center;background-size:70%;pointer-events:none;z-index:0;"></div>
                                <!-- Header with Tabs -->
                                <div class="p-4 border-b border-white/10 bg-white/5 relative z-10">
                                    <div class="flex justify-center items-center gap-2 mb-3">
                                        <img src="img/phav.png" class="w-5 h-5 rounded-full grayscale opacity-70">
                                        <span class="text-[10px] font-bold text-gray-300 tracking-widest">FENNEC ID SYSTEM</span>
                                    </div>

                                    <!-- Tabs -->
                                    <div class="flex gap-2 mb-3">
                                        <button class="card-tab-btn active flex-1 py-2 px-3 rounded-lg bg-fennec/20 text-fennec text-[9px] font-bold uppercase tracking-wider transition" data-tab="achievements" onclick="event.stopPropagation(); const root=this.closest('.face-back'); root.querySelectorAll('.card-tab-btn').forEach(b=>{b.classList.remove('active','bg-fennec/20','text-fennec'); b.classList.add('bg-white/5','text-gray-400');}); this.classList.remove('bg-white/5','text-gray-400'); this.classList.add('active','bg-fennec/20','text-fennec'); root.querySelectorAll('.card-tab-content').forEach(c=>c.classList.add('hidden')); root.querySelector('.card-tab-achievements').classList.remove('hidden');">
                                            BADGES
                                        </button>
                                        <button class="card-tab-btn flex-1 py-2 px-3 rounded-lg bg-white/5 text-gray-400 text-[9px] font-bold uppercase tracking-wider transition" data-tab="technical" onclick="event.stopPropagation(); const root=this.closest('.face-back'); root.querySelectorAll('.card-tab-btn').forEach(b=>{b.classList.remove('active','bg-fennec/20','text-fennec'); b.classList.add('bg-white/5','text-gray-400');}); this.classList.remove('bg-white/5','text-gray-400'); this.classList.add('active','bg-fennec/20','text-fennec'); root.querySelectorAll('.card-tab-content').forEach(c=>c.classList.add('hidden')); root.querySelector('.card-tab-technical').classList.remove('hidden');">
                                            STATS
                                        </button>
                                    </div>
                                </div>

                                <!-- Tab Content: Achievements -->
                                <div class="card-tab-content card-tab-achievements flex-1 custom-scroll p-4 relative z-10" style="direction: ltr; overflow-y: auto;">
                                    <div style="display:flex;flex-direction:column;gap:10px;align-content:start">
                                        ${badgesBack}
                                    </div>
                                </div>

                                <!-- Tab Content: Technical -->
                                <div class="card-tab-content card-tab-technical hidden flex-1 custom-scroll p-4 relative z-10" style="direction: ltr; overflow-y: auto;">
                                    <div class="space-y-3">
                                        <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                                            <div class="flex items-start justify-between gap-3">
                                                <div>
                                                    <div class="text-[8px] text-gray-400 uppercase tracking-wider mb-1">NET WORTH</div>
                                                    <div class="text-xl font-black text-white">$${metrics.wealth || '0.00'}</div>
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-[8px] text-gray-400 uppercase tracking-wider mb-1">LP VALUE</div>
                                                    <div class="text-sm font-black text-white">$${parseFloat(metrics.lpValueUSD || 0).toFixed(2)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-2">
                                            <div class="bg-white/5 rounded-lg p-2.5 border border-white/10">
                                                <div class="text-[8px] text-gray-400 uppercase tracking-wider mb-1">TXS</div>
                                                <div class="text-sm font-bold text-white">${metrics.txCount || 0}</div>
                                            </div>
                                            <div class="bg-white/5 rounded-lg p-2.5 border border-white/10">
                                                <div class="text-[8px] text-gray-400 uppercase tracking-wider mb-1">ON-CHAIN AGE</div>
                                                <div class="text-sm font-bold text-white">${metrics.daysAlive} <span class="text-[10px] font-normal text-gray-500">DAYS</span></div>
                                            </div>
                                        </div>

                                        <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                                            <div class="text-[8px] text-gray-400 uppercase tracking-wider mb-2 text-center">SCORE BREAKDOWN</div>
                                            <div class="space-y-2">
                                                ${(() => {
                                                    const sb = metrics.scoreBreakdown || {};
                                                    const clamp = (v, m) =>
                                                        Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
                                                    const rows = [
                                                        {
                                                            label: 'Activity',
                                                            value: clamp(sb.activityPoints, 30),
                                                            max: 30
                                                        },
                                                        { label: 'Wealth', value: clamp(sb.wealthPoints, 20), max: 20 },
                                                        { label: 'Time', value: clamp(sb.timePoints, 15), max: 15 },
                                                        { label: 'Badges', value: clamp(sb.badgesPoints, 35), max: 35 },
                                                        { label: 'Score', value: clamp(sb.baseScore, 100), max: 100 }
                                                    ];
                                                    return rows
                                                        .map(r => {
                                                            const pct = Math.max(
                                                                0,
                                                                Math.min(100, (r.value / r.max) * 100)
                                                            );
                                                            const pctText = `${Math.round(pct)}%`;
                                                            return `
                                                        <div>
                                                            <div class="flex justify-between items-center mb-1">
                                                                <span class="text-[9px] text-gray-400">${r.label}</span>
                                                                <span class="text-[10px] font-bold text-white">${pctText}</span>
                                                            </div>
                                                            <div class="h-1.5 w-full rounded-full bg-black/40 border border-white/10 overflow-hidden">
                                                                <div class="h-full rounded-full bg-gradient-to-r from-fennec via-orange-400 to-yellow-200" style="width:${pct}%;"></div>
                                                            </div>
                                                        </div>`;
                                                        })
                                                        .join('');
                                                })()}
                                                <div class="flex items-center justify-between mt-2 px-1">
                                                    <div class="text-[9px] text-gray-300 uppercase tracking-[0.32em]">MAXI BOOST</div>
                                                    <div class="flex items-center gap-2 text-right">
                                                        <span class="text-[11px] font-bold ${metrics.hasFennecMaxi ? 'text-white' : 'text-gray-500'}">${metrics.hasFennecMaxi ? 'ACTIVE' : 'OFF'}</span>
                                                        <span class="w-2 h-2 rounded-full ${metrics.hasFennecMaxi ? 'bg-fennec' : 'bg-gray-500'} inline-block shadow-[0_0_6px_currentColor]"></span>
                                                    </div>
                                                </div>
                                                <div class="flex justify-between items-center">
                                                    <span class="text-[9px] text-gray-400">Final Score</span>
                                                    <span class="text-[10px] font-black text-fennec">${metrics.activityScore || 0}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                                            <div class="text-[8px] text-gray-400 uppercase tracking-wider mb-2 text-center">ASSETS</div>
                                            <div class="grid grid-cols-2 gap-3">
                                                <div class="bg-black/20 rounded-lg p-2.5 border border-white/5">
                                                    <div class="text-[8px] text-gray-500 uppercase tracking-wider mb-2 text-center">FB</div>
                                                    <div class="space-y-1.5">
                                                        <div class="flex justify-between items-center">
                                                            <span class="text-[9px] text-gray-400">Wallet</span>
                                                            <span class="text-[10px] font-bold text-white">${parseFloat(metrics.nativeBalance || 0).toFixed(4)}</span>
                                                        </div>
                                                        <div class="flex justify-between items-center">
                                                            <span class="text-[9px] text-gray-400">InSwap</span>
                                                            <span class="text-[10px] font-bold text-white">${parseFloat(metrics.fbSwapBalance || 0).toFixed(4)}</span>
                                                        </div>
                                                        <div class="flex justify-between items-center">
                                                            <span class="text-[9px] text-gray-400">Total</span>
                                                            <span class="text-[10px] font-bold text-white">${parseFloat(metrics.fbTotal || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="bg-black/20 rounded-lg p-2.5 border border-white/5">
                                                    <div class="text-[8px] text-gray-500 uppercase tracking-wider mb-2 text-center">FENNEC</div>
                                                    <div class="space-y-1.5">
                                                        <div class="flex justify-between items-center">
                                                            <span class="text-[9px] text-gray-400">Wallet</span>
                                                            <span class="text-[10px] font-bold text-white">${parseFloat(metrics.fennecWalletBalance || 0).toFixed(2)}</span>
                                                        </div>
                                                        <div class="flex justify-between items-center">
                                                            <span class="text-[9px] text-gray-400">InSwap</span>
                                                            <span class="text-[10px] font-bold text-white">${parseFloat(metrics.fennecInSwapBalance || 0).toFixed(2)}</span>
                                                        </div>
                                                        <div class="flex justify-between items-center">
                                                            <span class="text-[9px] text-gray-400">Total</span>
                                                            <span class="text-[10px] font-bold text-white">${parseFloat(metrics.fennecBalance || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                                            <div class="text-[8px] text-gray-400 uppercase tracking-wider mb-2 text-center">INSCRIPTIONS</div>
                                            <div class="grid grid-cols-3 gap-2">
                                                <div class="bg-black/20 rounded-lg p-2.5 border border-white/5 text-center">
                                                    <div class="text-[8px] text-gray-500 uppercase tracking-wider mb-1">Runes</div>
                                                    <div class="text-sm font-bold text-white">${inscriptionStatsForDisplay.runes || 0}</div>
                                                </div>
                                                <div class="bg-black/20 rounded-lg p-2.5 border border-white/5 text-center">
                                                    <div class="text-[8px] text-gray-500 uppercase tracking-wider mb-1">BRC-20</div>
                                                    <div class="text-sm font-bold text-white">${inscriptionStatsForDisplay.brc20 || 0}</div>
                                                </div>
                                                <div class="bg-black/20 rounded-lg p-2.5 border border-white/5 text-center">
                                                    <div class="text-[8px] text-gray-500 uppercase tracking-wider mb-1">Ordinals</div>
                                                    <div class="text-sm font-bold text-white">${inscriptionStatsForDisplay.ordinals || 0}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- PARENT INSCRIPTION (OPTIONAL) -->
                    <div class="mt-6 w-full max-w-[320px]">
                        <label class="block text-xs text-gray-400 mb-2 uppercase tracking-wide">Parent Inscription ID (Optional)</label>
                        <input
                            type="text"
                            id="parentInscriptionId"
                            placeholder="Enter parent inscription ID..."
                            class="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:border-fennec focus:outline-none transition"
                            onchange="localStorage.setItem('fennec_parent_inscription_id', this.value)"
                        />
                        <p class="text-xs text-gray-500 mt-1">Link this card to a parent inscription for updates</p>
                    </div>

                    <!-- MINT BUTTON -->
                    <button onclick="mintAuditCard(event)" id="mintBtn" class="mt-6 w-full max-w-[320px] py-4 bg-gradient-to-r from-fennec to-orange-600 hover:brightness-110 text-black font-black text-xl rounded-xl shadow-[0_0_30px_rgba(255,107,53,0.3)] transition uppercase flex items-center justify-center gap-2 transform active:scale-95 group">
                        <i class="fas fa-cube group-hover:rotate-12 transition"></i> <span id="mintBtnText">MINT ID CARD</span>
                    </button>

                    <button onclick="window.refreshAudit()" id="refreshAuditBtn" class="mt-3 text-xs text-gray-500 hover:text-white transition flex items-center gap-1 opacity-70">
                        <i class="fas fa-sync-alt" id="refreshAuditIcon"></i> <span id="refreshAuditText">Refresh Metadata</span>
                    </button>

                </div>
            `;

        // Запуск эффекта наклона
        init3DTilt();

        // ИСПРАВЛЕНИЕ: Обновляем текст кнопки минта с ценой
        const mintBtnText = document.getElementById('mintBtnText');
        if (mintBtnText) {
            const lastApiData = window.lastAuditApiData || {};
            const fennecNativeBal = metrics.fennecNativeBalance || 0;
            const hasFennecInLP = lastApiData.has_fennec_in_lp || false;
            const hasDiscount = fennecNativeBal > 1000 || hasFennecInLP;

            if (hasDiscount) {
                // Показываем зачеркнутую цену 1 FB и новую цену 0.5 FB (без зеленого цвета)
                mintBtnText.innerHTML =
                    '<span style="text-decoration: line-through; opacity: 0.6;">1 FB</span> <span style="font-weight: bold;">0.5 FB (50% OFF!)</span>';
            } else {
                // Показываем обычную цену 1 FB
                mintBtnText.innerHTML = '1 FB';
            }
        }
    } catch (error) {
        console.error('❌ Error rendering audit card:', error);
        container.innerHTML = `
                    <div class="w-full max-w-md bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-red-200">
                        <p class="font-bold mb-2">Render Error</p>
                        <p class="text-sm">${error.message || 'Failed to render card'}</p>
                        <button onclick="runAudit()" class="mt-4 px-4 py-2 bg-fennec text-black font-bold rounded hover:bg-orange-600 transition">
                            Retry
                        </button>
                    </div>
                `;
    }
}

function toggleCardFlip(event, sceneEl) {
    const object = sceneEl?.querySelector('.card-object');
    if (!object) return;

    const willFlip = !object.classList.contains('is-flipped');

    object.__flipAnimating = true;
    const onFlipEnd = e => {
        if (e && e.propertyName && e.propertyName !== 'transform') return;
        object.__flipAnimating = false;
        object.removeEventListener('transitionend', onFlipEnd);
    };
    object.addEventListener('transitionend', onFlipEnd);
    setTimeout(() => {
        if (object.__flipAnimating) {
            object.__flipAnimating = false;
            object.removeEventListener('transitionend', onFlipEnd);
        }
    }, 1200);

    // ВАЖНО: 3D-tilt пишет inline style transform.
    // Inline transform перекрывает CSS transform из .card-object.is-flipped, из-за этого back может не открываться.
    // Делаем сброс наклона мгновенным (без transition), а сам flip — по CSS transition, чтобы скорость туда/обратно была одинаковая.
    object.style.removeProperty('transition');
    object.style.setProperty('--tiltX', '0deg');
    object.style.setProperty('--tiltY', '0deg');

    // Сбрасываем glare, чтобы не зависал при flip
    const glare = sceneEl.querySelector('.card-glare');
    if (glare) glare.style.opacity = willFlip ? 0 : glare.style.opacity;

    requestAnimationFrame(() => {
        object.classList.toggle('is-flipped');
    });
}

function initVfxWebgl(object) {
    if (!object || object.__vfxWebgl) return;
    const canvas = object.querySelector('.vfx-webgl canvas');
    const wrap = canvas ? canvas.parentElement : null;
    if (!canvas || !wrap) return;

    const gl =
        canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true }) ||
        canvas.getContext('experimental-webgl');
    if (!gl) {
        wrap.style.opacity = '0';
        return;
    }

    const vertSrc = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=(aPos+1.0)*0.5; gl_Position=vec4(aPos,0.0,1.0); }`;
    const fragSrc = `precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec2 uTilt;
uniform float uTime;
uniform vec3 uTint1;
uniform vec3 uTint2;
uniform float uStrength;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); float a=hash(i); float b=hash(i+vec2(1.0,0.0)); float c=hash(i+vec2(0.0,1.0)); float d=hash(i+vec2(1.0,1.0)); vec2 u=f*f*(3.0-2.0*f); return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y; }
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<4;i++){ v += a*noise(p); p*=2.0; a*=0.5; } return v; }

void main(){
    vec2 uv=vUv;
    vec2 p=uPointer;
    vec2 d=uv-p;
    float dist=length(d);
    vec2 e=vec2(1.0)/max(uResolution, vec2(1.0));

    float h0 = fbm(uv*7.0 + vec2(uTime*0.05, -uTime*0.04));
    float hx1 = fbm((uv+vec2(e.x,0.0))*7.0 + vec2(uTime*0.05, -uTime*0.04));
    float hx2 = fbm((uv-vec2(e.x,0.0))*7.0 + vec2(uTime*0.05, -uTime*0.04));
    float hy1 = fbm((uv+vec2(0.0,e.y))*7.0 + vec2(uTime*0.05, -uTime*0.04));
    float hy2 = fbm((uv-vec2(0.0,e.y))*7.0 + vec2(uTime*0.05, -uTime*0.04));
    vec2 g = vec2(hx1-hx2, hy1-hy2);
    vec3 n = normalize(vec3(-g*16.0, 1.0));

    vec3 v = vec3(0.0, 0.0, 1.0);
    vec3 l = normalize(vec3(-d*2.7 + uTilt*0.55, 0.65));
    float ndl = max(dot(n,l), 0.0);
    vec3 h = normalize(l+v);
    float spec = pow(max(dot(n,h), 0.0), 36.0);
    float fres = pow(1.0 - max(dot(n,v), 0.0), 4.0);

    float bands = sin((uv.x*6.0 + uv.y*4.0 + h0*1.4)*6.283 + uTime*0.85 + uTilt.x*0.6);
    float t = 0.5 + 0.5*bands;
    vec3 tint = mix(uTint1, uTint2, t);

    float grain = hash(uv * (uResolution*0.12) + vec2(uTime*0.9, -uTime*0.7));
    grain = pow(grain, 14.0) * (0.26 + 1.85*spec);

    float streak = exp(-abs(d.x*1.45 + d.y*0.22 + uTilt.y*0.12)*18.0) * exp(-dist*dist*9.0);
    float edge = smoothstep(0.0, 0.05, min(min(uv.x, 1.0-uv.x), min(uv.y, 1.0-uv.y)));

    float a = uStrength * edge * (spec*1.10 + ndl*0.10 + fres*0.30 + streak*0.22 + grain*0.62);
    a = clamp(a, 0.0, 1.0);

    vec3 col = tint*(spec*1.25 + fres*0.25 + ndl*0.12) + vec3(1.0)*spec*0.52 + tint*grain*0.9;
    col *= (0.55 + 0.45*smoothstep(0.42, 0.0, dist));
    gl_FragColor = vec4(col, a);
}`;

    function compile(type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            gl.deleteShader(sh);
            return null;
        }
        return sh;
    }

    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) {
        wrap.style.opacity = '0';
        return;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        wrap.style.opacity = '0';
        return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    const uResolution = gl.getUniformLocation(prog, 'uResolution');
    const uPointer = gl.getUniformLocation(prog, 'uPointer');
    const uTilt = gl.getUniformLocation(prog, 'uTilt');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uTint1 = gl.getUniformLocation(prog, 'uTint1');
    const uTint2 = gl.getUniformLocation(prog, 'uTint2');
    const uStrength = gl.getUniformLocation(prog, 'uStrength');

    const archetype = object.dataset && object.dataset.archetype ? object.dataset.archetype : '';
    const tier = object.dataset && object.dataset.tier ? Number(object.dataset.tier) || 0 : 0;

    let tint1 = [1, 1, 1];
    let tint2 = [1, 1, 1];
    let mult = 1;
    if (archetype === 'MERCHANT') {
        tint1 = [1.0, 0.82, 0.15];
        tint2 = [1.0, 1.0, 1.0];
        mult = 0.8;
    } else if (archetype === 'KEEPER') {
        tint1 = [0.98, 0.57, 0.24];
        tint2 = [1.0, 1.0, 1.0];
        mult = 0.6;
    } else if (archetype === 'SHAMAN') {
        tint1 = [0.66, 0.33, 0.97];
        tint2 = [0.23, 0.51, 0.96];
    } else if (archetype === 'LORD') {
        tint1 = [0.02, 0.71, 0.83];
        tint2 = [1.0, 1.0, 1.0];
    } else if (archetype === 'ENGINEER') {
        tint1 = [0.0, 1.0, 0.67];
        tint2 = [1.0, 0.0, 0.31];
    } else if (archetype === 'WALKER') {
        tint1 = [0.23, 0.51, 0.96];
        tint2 = [1.0, 1.0, 1.0];
    } else if (archetype === 'DRIFTER') {
        tint1 = [1.0, 0.63, 0.0];
        tint2 = [1.0, 1.0, 1.0];
    } else if (archetype === 'SINGULARITY') {
        tint1 = [1.0, 1.0, 1.0];
        tint2 = [0.66, 0.33, 0.97];
    }

    const tierStrength = tier === 1 ? 0.55 : tier === 2 ? 0.78 : 1.0;
    const strength = tierStrength * mult;

    const state = {
        gl,
        prog,
        buf,
        aPos,
        uResolution,
        uPointer,
        uTilt,
        uTime,
        uTint1,
        uTint2,
        uStrength,
        pointer: [0.5, 0.5],
        tilt: [0, 0],
        start: performance.now(),
        lastSize: [0, 0],
        dpr: Math.min(2, window.devicePixelRatio || 1),
        tint1,
        tint2,
        strength
    };

    object.__vfxWebgl = state;

    function render() {
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width * state.dpr));
        const h = Math.max(1, Math.round(rect.height * state.dpr));
        if (w !== state.lastSize[0] || h !== state.lastSize[1]) {
            canvas.width = w;
            canvas.height = h;
            state.lastSize[0] = w;
            state.lastSize[1] = h;
            gl.viewport(0, 0, w, h);
        }

        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform2f(uPointer, state.pointer[0], state.pointer[1]);
        gl.uniform2f(uTilt, state.tilt[0], state.tilt[1]);
        gl.uniform1f(uTime, (performance.now() - state.start) / 1000);
        gl.uniform3f(uTint1, state.tint1[0], state.tint1[1], state.tint1[2]);
        gl.uniform3f(uTint2, state.tint2[0], state.tint2[1], state.tint2[2]);
        gl.uniform1f(uStrength, state.strength);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        state.raf = requestAnimationFrame(render);
    }

    state.raf = requestAnimationFrame(render);
}

function updateVfxWebgl(object, xNorm, yNorm, tiltX, tiltY) {
    const s = object && object.__vfxWebgl;
    if (!s) return;
    s.pointer[0] = Math.max(0, Math.min(1, xNorm));
    s.pointer[1] = Math.max(0, Math.min(1, yNorm));
    s.tilt[0] = Math.max(-1, Math.min(1, tiltX));
    s.tilt[1] = Math.max(-1, Math.min(1, tiltY));
}

// Функция инициализации 3D наклона карточки
function init3DTilt() {
    const card = document.querySelector('.card-scene');
    const object = document.getElementById('card3D');
    const glare = document.querySelector('.card-glare');

    if (!card || !object) return;

    initVfxWebgl(object);

    const tier = object.dataset && object.dataset.tier ? Number(object.dataset.tier) || 0 : 0;
    const tiltStrength = tier === 0 ? 4 : tier === 1 ? 7 : tier === 2 ? 10 : 13;
    const idleAmp = tier === 0 ? 2 : tier === 1 ? 3 : tier === 2 ? 4.5 : 6;
    const glareIntensity = tier === 0 ? 0.025 : tier === 1 ? 0.035 : tier === 2 ? 0.045 : 0.055;

    const state = {
        hover: false,
        lastMove: 0,
        targetMxp: 50,
        targetMyp: 50,
        mxp: 50,
        myp: 50,
        raf: 0,
        start: performance.now()
    };

    function applyPose(mxp, myp) {
        if (object.__flipAnimating) return;
        if (object.classList.contains('is-flipped')) return;

        const nx = (mxp - 50) / 50;
        const ny = (myp - 50) / 50;
        object.style.setProperty('--mxp', `${mxp.toFixed(2)}%`);
        object.style.setProperty('--myp', `${myp.toFixed(2)}%`);
        object.style.setProperty('--px', `${(nx * 12).toFixed(2)}px`);
        object.style.setProperty('--py', `${(ny * 12).toFixed(2)}px`);
        object.style.setProperty('--npx', `${(nx * 5).toFixed(2)}px`);
        object.style.setProperty('--npy', `${(ny * 5).toFixed(2)}px`);

        const rx = (-ny * tiltStrength).toFixed(2);
        const ry = (nx * tiltStrength).toFixed(2);
        object.style.setProperty('--tiltX', `${rx}deg`);
        object.style.setProperty('--tiltY', `${ry}deg`);

        updateVfxWebgl(object, mxp / 100, 1 - myp / 100, nx, -ny);

        if (glare) {
            const dist = Math.min(1, Math.sqrt(nx * nx + ny * ny));
            glare.style.opacity = (glareIntensity * (0.25 + dist * 0.75)).toFixed(3);
        }
    }

    function tick() {
        state.raf = requestAnimationFrame(tick);
        if (!state.hover) return;
        if (object.__flipAnimating) return;
        if (object.classList.contains('is-flipped')) return;

        const now = performance.now();
        const t = (now - state.start) / 1000;
        const idle = now - state.lastMove > 180;

        const desiredMxp = idle ? 50 + Math.sin(t * 0.55) * idleAmp : state.targetMxp;
        const desiredMyp = idle ? 50 + Math.cos(t * 0.43) * (idleAmp * 0.85) : state.targetMyp;
        const lerp = idle ? 0.06 : 0.18;
        state.mxp += (desiredMxp - state.mxp) * lerp;
        state.myp += (desiredMyp - state.myp) * lerp;

        applyPose(state.mxp, state.myp);
    }

    card.addEventListener('mousemove', e => {
        if (object.__flipAnimating) return;
        if (object.classList.contains('is-flipped')) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        state.targetMxp = Math.max(0, Math.min(100, (x / rect.width) * 100));
        state.targetMyp = Math.max(0, Math.min(100, (y / rect.height) * 100));
        state.lastMove = performance.now();
    });

    card.addEventListener('mouseenter', () => {
        state.hover = true;
        state.lastMove = performance.now();
        object.style.transition = 'transform 90ms linear';
        if (!state.raf) tick();
    });

    card.addEventListener('mouseleave', () => {
        state.hover = false;
        object.style.removeProperty('transition');
        object.style.setProperty('--tiltX', '0deg');
        object.style.setProperty('--tiltY', '0deg');
        if (glare) glare.style.opacity = 0;
    });
}

// Share Audit
function shareAudit() {
    if (!auditIdentity) return;
    const text = `I am ${auditIdentity.archetype.title} (${auditIdentity.archetype.tier}) on Fennec Swap!\n\nNet Worth: $${auditIdentity.metrics.wealth}\nAge: ${auditIdentity.metrics.daysAlive} Days\nActivity: ${auditIdentity.metrics.txCount} Transactions\n\n${auditIdentity.archetype.desc}`;

    if (navigator.share) {
        navigator.share({ text, title: 'Fennec Grand Audit' });
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    }
}

// ИСПРАВЛЕНИЕ: Отдельное обновление аудита (не сбрасывает карточку без желания пользователя)
let lastAuditRefreshTime = 0;
const MIN_AUDIT_REFRESH_INTERVAL = 60000; // 60 секунд между обновлениями аудита
let auditRefreshTimerInterval = null;

window.refreshAudit = async function () {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastAuditRefreshTime;

    // Проверяем, прошло ли достаточно времени
    if (timeSinceLastRefresh < MIN_AUDIT_REFRESH_INTERVAL) {
        const remainingSeconds = Math.ceil((MIN_AUDIT_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000);
        showNotification(`Please wait ${remainingSeconds}s before refreshing ID again`, 'warning', 2000);
        return;
    }

    if (!userAddress && !window.userAddress) {
        showNotification('Connect wallet first', 'warning', 2000);
        return;
    }

    if (auditLoading) {
        showNotification('Audit is already loading, please wait', 'warning', 2000);
        return;
    }

    // Обновляем время последнего обновления
    lastAuditRefreshTime = now;

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
        console.log('🔄 Manual audit refresh started...');
        await runAudit();
        showNotification('Audit refreshed successfully', 'success', 2000);
        console.log('✅ Manual audit refresh completed');

        // Запускаем таймер обратного отсчета
        startAuditRefreshTimer();
    } catch (e) {
        console.error('❌ Manual audit refresh error:', e);
        showNotification('Audit refresh failed: ' + (e.message || 'Unknown error'), 'error', 3000);
    } finally {
        // Восстанавливаем UI кнопки (но оставляем disabled до окончания таймера)
        if (refreshAuditIcon) {
            refreshAuditIcon.classList.remove('fa-spin');
        }
        if (refreshAuditText) {
            refreshAuditText.textContent = 'REFRESH AUDIT';
        }
    }
};

// Таймер обратного отсчета для кнопки обновления аудита
function startAuditRefreshTimer() {
    if (auditRefreshTimerInterval) {
        clearInterval(auditRefreshTimerInterval);
    }

    const refreshAuditTimer = document.getElementById('refreshAuditTimer');
    const refreshAuditBtn = document.getElementById('refreshAuditBtn');

    if (!refreshAuditTimer || !refreshAuditBtn) return;

    let remainingSeconds = MIN_AUDIT_REFRESH_INTERVAL / 1000;
    refreshAuditTimer.classList.remove('hidden');
    refreshAuditTimer.textContent = `(${remainingSeconds}s)`;
    refreshAuditBtn.disabled = true;

    auditRefreshTimerInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            clearInterval(auditRefreshTimerInterval);
            auditRefreshTimerInterval = null;
            refreshAuditTimer.classList.add('hidden');
            refreshAuditBtn.disabled = false;
        } else {
            refreshAuditTimer.textContent = `(${remainingSeconds}s)`;
        }
    }, 1000);
}

// Mint Audit Card (placeholder)
// ГЕНЕРАТОР HTML-ИНСКРИПЦИИ
async function generateInteractiveHTML(identity, bgImageUrl) {
    // ИСПРАВЛЕНИЕ: Оптимизируем изображение для уменьшения размера
    const getOptimizedBase64 = async url => {
        try {
            // ИСПРАВЛЕНИЕ: Преобразуем относительный путь в абсолютный
            let imageUrl = url;
            if (url.startsWith('img/')) {
                // Если путь относительный, делаем его абсолютным относительно текущего домена
                imageUrl = new URL(url, window.location.origin).href;
            }
            const data = await fetch(imageUrl);
            if (!data.ok) {
                throw new Error(`Failed to fetch image: ${data.status} ${data.statusText}`);
            }
            const blob = await data.blob();

            // Создаем canvas для оптимизации изображения
            return new Promise((resolve, reject) => {
                const img = new Image();
                // ИСПРАВЛЕНИЕ: Обрабатываем ошибку загрузки изображения, чтобы она не всплывала
                img.onerror = errorEvent => {
                    // Предотвращаем всплытие события
                    if (errorEvent && errorEvent.stopPropagation) {
                        errorEvent.stopPropagation();
                    }
                    // Используем placeholder вместо reject, чтобы не прерывать процесс
                    console.warn('Failed to load image, using placeholder');
                    resolve(
                        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA=='
                    );
                };
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        // ИСПРАВЛЕНИЕ: Уменьшаем размер изображения для экономии места
                        // Максимальная ширина: 400px (достаточно для карточки 320px)
                        const maxWidth = 450;
                        const maxHeight = 700;
                        let width = img.width;
                        let height = img.height;

                        // Масштабируем если нужно
                        if (width > maxWidth || height > maxHeight) {
                            const ratio = Math.min(maxWidth / width, maxHeight / height);
                            width = Math.floor(width * ratio);
                            height = Math.floor(height * ratio);
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, width, height);

                        // ИСПРАВЛЕНИЕ: Используем JPEG с качеством 0.75 для уменьшения размера
                        // JPEG обычно меньше PNG для фотографий
                        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                        resolve(optimizedDataUrl);
                    } catch (canvasError) {
                        console.warn('Canvas error, using placeholder:', canvasError);
                        resolve(
                            'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA=='
                        );
                    }
                };
                img.src = URL.createObjectURL(blob);
            });
        } catch (e) {
            console.warn('Failed to load image, using placeholder:', e);
            // ИСПРАВЛЕНИЕ: Возвращаем placeholder вместо throw, чтобы не прерывать процесс
            return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==';
        }
    };

    // Загружаем и оптимизируем фон
    // ИСПРАВЛЕНИЕ: Обрабатываем ошибки загрузки изображения, чтобы они не всплывали
    let bgBase64;
    try {
        bgBase64 = await getOptimizedBase64(bgImageUrl);
    } catch (imageError) {
        // Игнорируем ошибки загрузки изображений - используем placeholder
        console.warn('Image loading error caught, using placeholder:', imageError);
        bgBase64 =
            'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==';
    }

    const { archetype, metrics } = identity;

    // Inline badge images as base64 for standalone minted card
    const badgeImgCache = new Map();
    for (const badge of archetype.badges || []) {
        if (badge.img && !badgeImgCache.has(badge.img)) {
            try {
                const optimized = await getOptimizedBase64(badge.img);
                badgeImgCache.set(badge.img, optimized);
                badge.img = optimized;
            } catch (e) {
                console.warn(`Failed to inline badge ${badge.name}:`, e);
            }
        }
    }

    const maxiMultiplier = metrics.hasFennecMaxi ? 1.2 : 1.0;
    const maxiBoostPct = Math.round((maxiMultiplier - 1) * 100);

    // ИСПРАВЛЕНИЕ: Используем ту же логику, что и в renderAudit
    const soulClass = metrics.hasFennecSoul ? 'fennec-aura-border' : '';
    const rarityName = metrics.rarity?.name || metrics.rarityName || 'CUB';

    const rarityClassMap = {
        SPIRIT: 'card-spirit',
        ELDER: 'card-elder',
        ALPHA: 'card-alpha',
        HUNTER: 'card-hunter',
        SCOUT: 'card-scout',
        CUB: 'card-cub'
    };
    const rarityClass = metrics.rarity?.class || rarityClassMap[rarityName] || 'card-cub';

    let rarityTextClass = 'text-cub';
    if (rarityName === 'SPIRIT') rarityTextClass = 'text-spirit';
    else if (rarityName === 'ELDER') rarityTextClass = 'text-elder';
    else if (rarityName === 'ALPHA') rarityTextClass = 'text-alpha';
    else if (rarityName === 'HUNTER') rarityTextClass = 'text-hunter';
    else if (rarityName === 'SCOUT') rarityTextClass = 'text-scout';
    else rarityTextClass = 'text-cub';

    // ИСПРАВЛЕНИЕ: Определяем анимацию для NFT версии
    const baseKey = archetype.baseKey || 'DRIFTER';
    const tier = archetype.tierLevel || 0;
    const visualKey = baseKey;

    // ВАЖНО: Тут нужно продублировать логику getAnimationClass, так как NFT автономна
    let imgClass = 'img-tier-0';
    if (tier === 1) imgClass = 'anim-tier-1';
    else if (tier === 2) {
        if (baseKey === 'ENGINEER') imgClass = 'anim-tier-2-glitch';
        else if (['MERCHANT', 'LORD'].includes(baseKey)) imgClass = 'anim-tier-2-shine';
        else if (['SHAMAN', 'KEEPER', 'PRIME', 'SINGULARITY'].includes(visualKey)) imgClass = 'anim-tier-2-magic';
        else imgClass = 'anim-tier-2-heat';
    } else if (tier === 3) {
        if (baseKey === 'ENGINEER') imgClass = 'anim-tier-2-glitch';
        else if (baseKey === 'KEEPER') imgClass = 'anim-tier-2-magic';
        else if (baseKey === 'DRIFTER') imgClass = 'anim-tier-2-heat';
        else imgClass = `anim-${visualKey}`;
    }

    let overlayHtml = '';
    let vfx3dHtml = '';
    if (tier >= 1 && visualKey === 'ENGINEER') {
        const vfxOpacity = tier === 1 ? 0.18 : tier === 2 ? 0.34 : 0.64;
        vfx3dHtml = `<div class="vfx-3d" style="--vfx3d-opacity:${vfxOpacity};"></div>`;
    }
    if (tier === 3)
        overlayHtml = `<div class="overlay-${visualKey}" style="position:absolute;inset:0;"></div>${vfx3dHtml}`;
    else if (tier === 2)
        overlayHtml = `<div class="overlay-${visualKey}" style="position:absolute;inset:0;opacity:0.22;"></div>${vfx3dHtml}`;
    else if (tier === 1)
        overlayHtml = `<div class="overlay-${visualKey}" style="position:absolute;inset:0;opacity:0.14;"></div>${vfx3dHtml}`;

    const titleClass = `text-tier-${tier}`;
    const tierLabelText = archetype.tierLabel || archetype.tier || '';
    const lastApiData = window.lastAuditApiData || {};
    const inscriptionStats = metrics.inscriptionStats || {
        runes: Number(lastApiData.runes_count || 0) || 0,
        brc20: Number(lastApiData.brc20_count || 0) || 0,
        ordinals: Number(lastApiData.ordinals_count || 0) || 0,
        total: 0
    };

    // БЕЙДЖИ ДЛЯ ЛИЦЕВОЙ СТОРОНЫ
    const badgesFront = archetype.badges
        .slice(0, 6)
        .map(b => {
            const glow =
                'drop-shadow(0 0 14px rgba(255,107,53,0.85)) drop-shadow(0 0 22px rgba(255,255,255,0.22)) drop-shadow(0 0 40px rgba(168,85,247,0.16))';
            const frame =
                'background:linear-gradient(180deg,rgba(255,255,255,0.14),rgba(0,0,0,0.26));border:1px solid rgba(255,255,255,0.22);border-radius:9999px;box-sizing:border-box;backdrop-filter:blur(10px);box-shadow:0 0 0 1px rgba(255,107,53,0.16) inset,0 10px 18px rgba(0,0,0,0.35),0 0 18px rgba(255,107,53,0.12)';
            const content = b.img
                ? `<img src="${b.img}" style="width:100%;height:100%;object-fit:contain;filter:${glow}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"> <span style="display:none;font-size:14px;filter:${glow}">${b.icon || ''}</span>`
                : `<span style="font-size:14px;filter:${glow}">${b.icon || ''}</span>`;
            return `<div class="badge-medal" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;${frame}" title="${b.name}">${content}</div>`;
        })
        .join('');

    // БЕЙДЖИ ДЛЯ ЗАДНЕЙ СТОРОНЫ (все, неактивные бледные и внизу)
    const earnedBadgeNames = new Set((archetype.badges || []).map(b => b.name));
    const allPossibleBadges = [
        {
            name: 'GENESIS',
            icon: '💎',
            img: 'img/badge_genesis.png',
            desc: 'You witnessed the first sunrise over the Fractal dunes.'
        },
        { name: 'WHALE', icon: '🐋', img: 'img/badge_whale.png', desc: 'When you move, the sands shift beneath you.' },
        {
            name: 'PROVIDER',
            icon: '💧',
            img: 'img/badge_provider.png',
            desc: 'The desert is thirsty, but your well runs deep.'
        },
        { name: 'FENNEC MAXI', icon: '🔥', img: 'img/badge_maxi.png', desc: 'The Spirit of the Fox guides your path.' },
        {
            name: 'ARTIFACT HUNTER',
            icon: '🏺',
            img: 'img/badge_collector.png',
            desc: 'Your pockets are heavy with echoes of the chain.'
        },
        {
            name: 'RUNE KEEPER',
            icon: '🧿',
            img: 'img/badge_rune.png',
            desc: 'You decipher the glyphs. The stones speak to you.'
        },
        {
            name: 'MEMPOOL RIDER',
            icon: '⚡',
            img: 'img/badge_mempool_rider.png',
            desc: 'Surfing the chaos of the 30-second block waves.'
        },
        { name: 'DUST DEVIL', icon: '🌪️', img: '', desc: 'A whirlwind of activity that left only dust behind.' }
    ];

    const earnedBadges = allPossibleBadges.filter(b => earnedBadgeNames.has(b.name));
    const lockedBadges = allPossibleBadges.filter(b => !earnedBadgeNames.has(b.name));

    const badgesBack = [...earnedBadges, ...lockedBadges]
        .map(b => {
            const hasBadge = earnedBadgeNames.has(b.name);
            const iconOpacity = hasBadge ? '1' : '0.22';
            const nameOpacity = hasBadge ? '1' : '0.78';
            const descOpacity = hasBadge ? '0.7' : '0.55';
            const borderOpacity = hasBadge ? '0.18' : '0.10';
            const bgOpacity = hasBadge ? '0.06' : '0.035';
            const glow = hasBadge
                ? 'drop-shadow(0 0 10px rgba(255,107,53,0.28)) drop-shadow(0 0 18px rgba(255,255,255,0.12))'
                : 'drop-shadow(0 0 6px rgba(255,255,255,0.10))';
            const iconHtml = b.img
                ? `<img src="${b.img}" style="width:22px;height:22px;object-fit:contain;filter:${glow}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span style="display:none;font-size:12px;filter:${glow}">${b.icon || ''}</span>`
                : `<span style="font-size:12px;filter:${glow}">${b.icon || ''}</span>`;
            return `<div title="${b.name} — ${b.desc}" style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,${bgOpacity});border:1px solid rgba(255,255,255,${borderOpacity});padding:10px 12px;border-radius:12px;width:100%;min-width:0;">
                    <div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:${iconOpacity}">${iconHtml}</div>
                    <div style="text-align:left;min-width:0;flex:1;">
                        <div style="font-size:9px;font-weight:900;color:rgba(255,255,255,${nameOpacity});text-transform:uppercase;letter-spacing:0.10em;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.name}</div>
                        <div style="margin-top:3px;font-size:9px;line-height:1.25;color:rgba(229,231,235,${descOpacity});">${b.desc || ''}</div>
                    </div>
                </div>`;
        })
        .join('');

    // ИСПРАВЛЕНИЕ: Полный CSS с радужной рамкой для SPIRIT, пульсацией для SOUL и всеми эффектами
    const isSpirit = rarityName === 'SPIRIT';
    const spiritBorder =
        `.card .face{position:absolute !important;inset:0 !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100% !important;height:100% !important}.card .face-front{position:absolute !important;inset:0 !important}.card .face-back{position:absolute !important;inset:0 !important}.bg-img{object-position:center top}.tier-class{background:rgba(0,0,0,0.35);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.10);padding:6px 10px;border-radius:10px;display:inline-block}.anim-WALKER{animation:walker-shift 6s ease-in-out infinite !important}@keyframes walker-shift{0%,100%{filter:contrast(1.15) brightness(1.05) hue-rotate(0deg)}50%{filter:contrast(1.25) brightness(1.15) hue-rotate(12deg)}}` +
        (isSpirit
            ? `.card{position:relative;overflow:visible}.card::before{content:'';position:absolute;inset:-4px;border-radius:28px;padding:4px;background:conic-gradient(from 0deg,#ff0000,#ff7f00,#ffff00,#00ff00,#00ffff,#0000ff,#4b0082,#9400d3,#ff0000);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;z-index:0;pointer-events:none;filter:brightness(1.35) saturate(1.15) drop-shadow(0 0 12px rgba(255,255,255,0.25));overflow:visible}.card .face{position:relative;z-index:2}`
            : '');
    const pulseAnimation = metrics.hasFennecSoul
        ? `@keyframes pulse{0%,100%{box-shadow:0 0 20px rgba(255,107,53,0.3),0 0 40px rgba(255,107,53,0.2)}50%{box-shadow:0 0 30px rgba(255,107,53,0.5),0 0 60px rgba(255,107,53,0.3)}}.card-pulse{animation:pulse 2s ease-in-out infinite}`
        : '';

    const borderColor =
        metrics.rarityColor && metrics.rarityColor.includes('yellow')
            ? '#eab308'
            : metrics.rarityColor && metrics.rarityColor.includes('purple')
              ? '#a855f7'
              : '#555';
    const rarityColorText =
        rarityName === 'SPIRIT'
            ? '#ff6b35'
            : rarityName === 'ELDER'
              ? '#a855f7'
              : rarityName === 'ALPHA'
                ? '#ef4444'
                : rarityName === 'HUNTER'
                  ? '#f59e0b'
                  : rarityName === 'SCOUT'
                    ? '#3b82f6'
                    : '#9ca3af';

    // ИСПРАВЛЕНИЕ: Добавляем CSS анимации для прогрессивной визуальной эволюции
    const imageEvolutionCSS = `.card-face img{transition:all 0.8s cubic-bezier(0.4,0,0.2,1);will-change:transform,filter}.img-tier-0{filter:grayscale(0.5) sepia(0.2) contrast(0.9) brightness(0.9);transform:scale(1)}.anim-tier-1{animation:breathe 6s ease-in-out infinite alternate}@keyframes breathe{0%{filter:grayscale(0.1) contrast(1) brightness(1);transform:scale(1)}100%{filter:grayscale(0) contrast(1.05) brightness(1.05);transform:scale(1.02)}}.anim-tier-2-heat{animation:heat-low 5s infinite alternate}@keyframes heat-low{0%{filter:sepia(0.1) contrast(1.1);transform:scale(1.02)}100%{filter:sepia(0.3) contrast(1.2);transform:scale(1.04)}}.anim-tier-2-shine{animation:shine-low 4s infinite alternate}@keyframes shine-low{0%{filter:brightness(1) saturate(1.1)}100%{filter:brightness(1.2) saturate(1.2)}}.anim-tier-2-glitch{animation:glitch-low 3s infinite}@keyframes glitch-low{0%,95%{filter:contrast(1.1) hue-rotate(0deg);transform:translate(0,0) scale(1.02)}96%{filter:contrast(1.3) hue-rotate(5deg);transform:translate(1px,0) scale(1.02)}100%{filter:contrast(1.1) hue-rotate(0deg);transform:translate(0,0) scale(1.02)}}.anim-tier-2-magic{animation:magic-low 4s infinite alternate}@keyframes magic-low{0%{filter:hue-rotate(0deg) saturate(1.1)}100%{filter:hue-rotate(-10deg) saturate(1.3)}}.anim-DRIFTER{animation:drifter-heat 8s ease-in-out infinite alternate}.overlay-DRIFTER{background:linear-gradient(to bottom,rgba(255,160,0,0.1),transparent 80%);mix-blend-mode:overlay;animation:sand-drift 10s linear infinite;pointer-events:none;z-index:5;position:absolute;inset:0}@keyframes drifter-heat{0%{filter:sepia(0.4) contrast(1.1) brightness(1);transform:scale(1)}50%{filter:sepia(0.6) contrast(1) brightness(1.1) blur(0.5px);transform:scale(1.05)}100%{filter:sepia(0.4) contrast(1.1) brightness(1);transform:scale(1)}}@keyframes sand-drift{0%{transform:translateY(0);opacity:0.3}100%{transform:translateY(-20px);opacity:0.6}}.anim-MERCHANT{animation:merchant-shine 5s ease-in-out infinite}.overlay-MERCHANT{background:linear-gradient(120deg,transparent 30%,rgba(255,215,0,0.4) 50%,transparent 70%);background-size:200% 200%;mix-blend-mode:color-dodge;animation:coin-glint 3s infinite linear;pointer-events:none;z-index:5;position:absolute;inset:0}@keyframes merchant-shine{0%,100%{filter:contrast(1.1) brightness(1) saturate(1.1);transform:scale(1)}50%{filter:contrast(1.2) brightness(1.3) saturate(1.4) drop-shadow(0 0 15px rgba(255,215,0,0.5));transform:scale(1.02)}}@keyframes coin-glint{0%{background-position:200% 0}100%{background-position:-200% 0}}.anim-ENGINEER{animation:engineer-glitch 4s infinite}.overlay-ENGINEER{background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,0,0.1) 3px);background-size:100% 4px;z-index:5;pointer-events:none;mix-blend-mode:hard-light;position:absolute;inset:0}@keyframes engineer-glitch{0%{filter:contrast(1.2);transform:translate(0,0)}92%{filter:contrast(1.2);transform:translate(0,0)}94%{filter:contrast(1.5) hue-rotate(90deg) saturate(2);transform:translate(2px,0)}96%{filter:contrast(1.5) hue-rotate(-90deg) saturate(2);transform:translate(-2px,0)}98%{filter:contrast(1.2);transform:translate(0,0)}100%{filter:contrast(1.2);transform:translate(0,0)}}.anim-SHAMAN{animation:shaman-pulse 6s ease-in-out infinite alternate}.overlay-SHAMAN{background:radial-gradient(circle,transparent 40%,rgba(147,51,234,0.3) 90%);mix-blend-mode:color-dodge;animation:rune-glow 4s ease-in-out infinite alternate;pointer-events:none;z-index:5;position:absolute;inset:0}@keyframes shaman-pulse{0%{filter:contrast(1.1) saturate(1.2);transform:scale(1)}100%{filter:contrast(1.3) saturate(1.6) hue-rotate(-10deg) drop-shadow(0 0 20px rgba(168,85,247,0.6));transform:scale(1.05)}}@keyframes rune-glow{0%{opacity:0.3}100%{opacity:0.6}}.anim-KEEPER{animation:keeper-eternal 8s ease-in-out infinite alternate}.overlay-KEEPER{background:radial-gradient(circle,rgba(251,146,60,0.1),transparent 60%);mix-blend-mode:screen;pointer-events:none;z-index:5;position:absolute;inset:0}@keyframes keeper-eternal{0%{filter:sepia(0.3) contrast(1.2) brightness(1)}100%{filter:sepia(0.1) contrast(1.3) brightness(1.2) drop-shadow(0 0 15px rgba(251,146,60,0.4))}}.anim-WALKER{animation:walker-shift 0.2s infinite alternate}.overlay-WALKER{background:linear-gradient(45deg,rgba(59,130,246,0.2),transparent);mix-blend-mode:overlay;pointer-events:none;z-index:5;position:absolute;inset:0}@keyframes walker-shift{0%{filter:contrast(1.2) brightness(1);opacity:0.95}100%{filter:contrast(1.3) brightness(1.1) hue-rotate(5deg);opacity:1}}.anim-LORD{animation:lord-tide 10s ease-in-out infinite alternate}.overlay-LORD{background:linear-gradient(180deg,transparent,rgba(6,182,212,0.2));mix-blend-mode:overlay;pointer-events:none;z-index:5;position:absolute;inset:0}@keyframes lord-tide{0%{transform:scale(1);filter:contrast(1.1) saturate(1.1)}100%{transform:scale(1.08);filter:contrast(1.2) saturate(1.4) drop-shadow(0 10px 20px rgba(6,182,212,0.4))}}.anim-PRIME{animation:prime-radiance 4s ease-in-out infinite alternate}.overlay-PRIME{background:radial-gradient(circle at 50% 0%,rgba(255,255,255,0.4),transparent 70%);mix-blend-mode:soft-light;animation:god-ray 8s linear infinite;pointer-events:none;z-index:5;position:absolute;inset:0}@keyframes prime-radiance{0%{filter:brightness(1.1) contrast(1.1)}100%{filter:brightness(1.4) contrast(1.2) drop-shadow(0 0 30px rgba(255,255,255,0.8))}}@keyframes god-ray{0%{transform:rotate(0deg);opacity:0.4}50%{opacity:0.6}100%{transform:rotate(360deg);opacity:0.4}}.anim-SINGULARITY{animation:singularity-chaos 10s linear infinite}.overlay-SINGULARITY{background:conic-gradient(from 0deg,#ff0000,#00ff00,#0000ff,#ff0000);mix-blend-mode:exclusion;opacity:0.2;animation:void-spin 20s linear infinite;pointer-events:none;z-index:5;position:absolute;inset:0}@keyframes singularity-chaos{0%{filter:hue-rotate(0deg) contrast(1.2);transform:scale(1)}50%{filter:hue-rotate(180deg) contrast(1.5);transform:scale(1.05)}100%{filter:hue-rotate(360deg) contrast(1.2);transform:scale(1)}}@keyframes void-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;

    const styles = `<style>*{margin:0;padding:0;box-sizing:border-box}body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}.scene{perspective:1000px;width:320px;height:500px;cursor:pointer;margin:0 auto}.card{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform 0.6s cubic-bezier(0.4,0,0.2,1);border-radius:24px;${isSpirit ? 'overflow:visible' : 'overflow:hidden'};transform-origin:center center;will-change:transform}${spiritBorder}${pulseAnimation}.card.flipped{transform:rotateY(180deg);transform-origin:center center}.card-glare{position:absolute;top:0;left:0;width:100%;height:100%;border-radius:24px;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.3) 0%,transparent 60%);pointer-events:none;mix-blend-mode:overlay;z-index:50;opacity:0;transition:opacity 0.1s}.badge-medal{transition:transform 160ms ease,filter 160ms ease;transform:translateZ(0);will-change:transform,filter}.badge-medal:hover{transform:translateY(-2px) scale(1.06);filter:drop-shadow(0 0 12px rgba(255,107,53,0.35)) drop-shadow(0 0 22px rgba(255,255,255,0.12))}.text-tier-0{color:#e5e7eb}.text-tier-1{color:#fff;text-shadow:0 0 10px rgba(255,255,255,0.4)}.text-tier-2{background:linear-gradient(to right,#fff,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 5px rgba(255,107,53,0.5))}.text-tier-3{background:linear-gradient(to right,#fb923c,#a855f7,#3b82f6);background-size:200% 200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmerText 3s linear infinite;filter:drop-shadow(0 0 8px rgba(255,255,255,0.5))}@keyframes shimmerText{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}${imageEvolutionCSS}.face{position:absolute;width:100%;height:100%;backface-visibility:hidden;border-radius:24px;overflow:hidden;top:0;left:0}.face-front{border:${isSpirit ? 'none' : '3px solid ' + borderColor};transform:rotateY(0deg);z-index:2;transform-origin:center center}.face-back{border:${isSpirit ? 'none' : '3px solid ' + borderColor};transform:rotateY(180deg);background:#000;color:#fff;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;z-index:1;position:absolute;top:0;left:0;width:100%;height:100%;transform-origin:center center}.bg-img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;filter:brightness(0.9);clip-path:inset(0 round 24px)}.overlay{position:absolute;bottom:0;left:0;width:100%;height:60%;background:linear-gradient(to top,#000,transparent);z-index:2;clip-path:inset(0 round 24px)}.content{position:relative;z-index:10;height:100%;display:flex;flex-direction:column;padding:20px}.top-row{display:flex;justify-content:space-between;align-items:flex-start;color:#fff;font-size:10px;font-weight:bold;text-transform:uppercase}.top-row-left{display:flex;align-items:center;gap:4px}.soul-badge{display:flex;align-items:center;gap:4px;color:#ff6b35;font-size:10px;font-weight:bold}.top-row-right{text-align:right}.evolution-label{font-size:8px;color:rgba(255,255,255,0.5);font-weight:900;margin-bottom:2px}.evolution-value{font-size:14px;font-weight:900;font-style:italic;text-transform:uppercase;color:${rarityColorText};text-shadow:0 2px 4px rgba(0,0,0,0.8);letter-spacing:0.05em}.main-info{margin-top:auto;color:#fff}.tier-class{font-size:10px;opacity:0.7;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:2px}.title{font-size:32px;font-weight:900;line-height:1;margin:0 0 8px 0;font-style:italic;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,0.8)}.badges-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;justify-content:center}.divider{width:100%;height:1px;background:linear-gradient(to right,rgba(255,255,255,0.5),transparent);margin:16px 0}.stats-row{display:flex;justify-content:space-between;align-items:flex-end}.stat-left,.stat-right{display:flex;flex-direction:column}.stat-label{font-size:8px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px}.stat-value{font-size:20px;font-weight:bold;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,0.8)}.stat-value-fennec{color:#ff6b35}.stat-value-small{font-size:10px;color:rgba(255,255,255,0.5)}.tap-hint{font-size:7px;text-align:center;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.1em;margin-top:12px}.back-header{width:100%;padding:20px;border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);text-align:center}.back-title{font-size:18px;font-weight:900;color:#ff6b35;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px}.back-subtitle{font-size:9px;color:rgba(255,255,255,0.5);font-family:monospace}.back-list{flex:1;width:100%;padding:20px;overflow-y:auto;overflow-x:hidden;direction:rtl;text-align:right}.back-list>*{direction:ltr;text-align:center}.back-list::-webkit-scrollbar{width:6px}.back-list::-webkit-scrollbar-track{background:rgba(0,0,0,0.3);border-radius:3px}.back-list::-webkit-scrollbar-thumb{background:rgba(255,107,53,0.5);border-radius:3px}.back-list::-webkit-scrollbar-thumb:hover{background:rgba(255,107,53,0.8)}.back-footer{width:100%;padding:20px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.1);margin-top:auto}.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:12px}.stat-box{text-align:center}.stat-box-label{font-size:8px;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:4px}.stat-box-value{font-size:12px;font-weight:bold;color:#fff}.address-box{background:rgba(0,0,0,0.6);padding:6px 8px;border-radius:4px;font-size:8px;font-family:monospace;color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.05);word-break:break-all;text-align:center}</style>`;

    // ИСПРАВЛЕНИЕ: Полный HTML с всеми элементами как на сайте
    const soulBadge = metrics.hasFennecSoul ? `<div class="soul-badge"><span>🔥</span><span>SOUL</span></div>` : '';
    const frontHTML = `<div class="face face-front ${rarityClass} ${soulClass}"><div class="card-glare"></div><img src="${bgBase64}" class="bg-img ${imgClass}">${overlayHtml}<div class="overlay"></div><div class="content"><div class="top-row"><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:260px">${badgesFront}</div><div></div></div><div class="main-info">${tierLabelText ? `<div class="tier-class">${tierLabelText} CLASS</div>` : ''}<h1 class="title ${titleClass}">${archetype.title}</h1><div class="divider"></div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px"><div>${soulBadge}</div><div style="text-align:right"><div class="evolution-label">EVOLUTION</div><div class="evolution-value ${rarityTextClass}">${rarityName}</div></div></div><div class="tap-hint">Tap card for details</div></div></div></div>`;

    const backHTML = `
            <div class="face face-back ${rarityClass}">
                <div style="position:absolute;inset:0;opacity:0.06;background-image:radial-gradient(rgba(255,255,255,0.8) 1px,transparent 1px);background-size:20px 20px;pointer-events:none;z-index:0"></div>

                <div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);position:relative;z-index:10">
                    <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:12px">
                        <div style="width:20px;height:20px;border-radius:9999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12)"></div>
                        <span style="font-size:10px;font-weight:700;color:rgba(209,213,219,1);letter-spacing:0.18em;white-space:nowrap">FENNEC ID SYSTEM</span>
                    </div>

                    <div style="display:flex;gap:8px">
                        <button class="card-tab-btn active" data-tab="achievements" onclick="event.stopPropagation(); const root=this.closest('.face-back'); root.querySelectorAll('.card-tab-btn').forEach(b=>{b.classList.remove('active'); b.style.background='rgba(255,255,255,0.05)'; b.style.color='rgba(156,163,175,1)';}); this.classList.add('active'); this.style.background='rgba(255,107,53,0.20)'; this.style.color='#FF6B35'; root.querySelectorAll('.card-tab-content').forEach(c=>{c.style.display='none';}); const el=root.querySelector('.card-tab-achievements'); if(el) el.style.display='block';" style="flex:1;padding:10px 12px;border-radius:10px;background:rgba(255,107,53,0.20);color:#FF6B35;border:1px solid rgba(255,107,53,0.25);font-size:11px;font-weight:800;letter-spacing:0.10em;text-transform:uppercase">BADGES</button>
                        <button class="card-tab-btn" data-tab="technical" onclick="event.stopPropagation(); const root=this.closest('.face-back'); root.querySelectorAll('.card-tab-btn').forEach(b=>{b.classList.remove('active'); b.style.background='rgba(255,255,255,0.05)'; b.style.color='rgba(156,163,175,1)';}); this.classList.add('active'); this.style.background='rgba(255,107,53,0.20)'; this.style.color='#FF6B35'; root.querySelectorAll('.card-tab-content').forEach(c=>{c.style.display='none';}); const el=root.querySelector('.card-tab-technical'); if(el) el.style.display='block';" style="flex:1;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.05);color:rgba(156,163,175,1);border:1px solid rgba(255,255,255,0.08);font-size:11px;font-weight:800;letter-spacing:0.10em;text-transform:uppercase">STATS</button>
                    </div>
                </div>

                <div class="card-tab-content card-tab-achievements" style="display:block;flex:1;overflow-y:auto;padding:16px;position:relative;z-index:10;direction:ltr">
                    <div style="display:flex;flex-direction:column;gap:10px;align-content:start">
                        ${badgesBack}
                    </div>
                </div>

                <div class="card-tab-content card-tab-technical" style="display:none;flex:1;overflow-y:auto;padding:16px;position:relative;z-index:10;direction:ltr">
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:12px">
                            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                                <div>
                                    <div style="font-size:10px;color:rgba(156,163,175,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">NET WORTH</div>
                                    <div style="font-size:22px;font-weight:900;color:#ffffff">$${metrics.wealth || '0.00'}</div>
                                </div>
                                <div style="text-align:right">
                                    <div style="font-size:10px;color:rgba(156,163,175,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">LP VALUE</div>
                                    <div style="font-size:14px;font-weight:900;color:#ffffff">$${parseFloat(metrics.lpValueUSD || 0).toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
                            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:10px">
                                <div style="font-size:10px;color:rgba(156,163,175,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">TXS</div>
                                <div style="font-size:14px;font-weight:800;color:#fff">${metrics.txCount || 0}</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:10px">
                                <div style="font-size:10px;color:rgba(156,163,175,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">ON-CHAIN AGE</div>
                                <div style="font-size:14px;font-weight:800;color:#fff">${metrics.daysAlive || 0} Days</div>
                            </div>
                        </div>

                        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:12px">
                            <div style="font-size:10px;color:rgba(156,163,175,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;text-align:center">SCORE BREAKDOWN</div>
                            <div style="display:flex;flex-direction:column;gap:10px">
                                ${(() => {
                                    const sb = metrics.scoreBreakdown || {};
                                    const clamp = (v, m) => Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
                                    const rows = [
                                        { label: 'Activity', value: clamp(sb.activityPoints, 30), max: 30 },
                                        { label: 'Wealth', value: clamp(sb.wealthPoints, 20), max: 20 },
                                        { label: 'Time', value: clamp(sb.timePoints, 15), max: 15 },
                                        { label: 'Badges', value: clamp(sb.badgesPoints, 35), max: 35 },
                                        { label: 'Score', value: clamp(sb.baseScore, 100), max: 100 }
                                    ];
                                    return rows
                                        .map(r => {
                                            const pct = Math.max(0, Math.min(100, (r.value / r.max) * 100));
                                            const pctText = `${Math.round(pct)}%`;
                                            return `
                                        <div>
                                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                                                <span style="font-size:11px;color:rgba(156,163,175,1)">${r.label}</span>
                                                <span style="font-size:12px;font-weight:800;color:#fff">${pctText}</span>
                                            </div>
                                            <div style="height:8px;border-radius:9999px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.10);overflow:hidden">
                                                <div style="height:100%;width:${pct}%;border-radius:9999px;background:linear-gradient(90deg,#FF6B35,#fb923c,#facc15)"></div>
                                            </div>
                                        </div>`;
                                        })
                                        .join('');
                                })()}
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding:8px 10px;border-radius:12px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.08)">
                                    <div style="font-size:9px;color:rgba(156,163,175,1);letter-spacing:0.32em;text-transform:uppercase;">MAXI BOOST</div>
                                    <div style="display:flex;align-items:center;gap:8px;text-align:right">
                                        <span style="font-size:12px;font-weight:800;color:${metrics.hasFennecMaxi ? '#ffffff' : 'rgba(156,163,175,0.6)'}">${metrics.hasFennecMaxi ? 'ACTIVE' : 'OFF'}</span>
                                        <span style="width:8px;height:8px;border-radius:9999px;display:inline-block;background:${metrics.hasFennecMaxi ? '#FF6B35' : 'rgba(156,163,175,0.6)'};box-shadow:0 0 6px ${metrics.hasFennecMaxi ? 'rgba(255,107,53,0.8)' : 'rgba(156,163,175,0.6)'}"></span>
                                    </div>
                                </div>
                                <div style="display:flex;justify-content:space-between;align-items:center">
                                    <span style="font-size:11px;color:rgba(156,163,175,1)">Final Score</span>
                                    <span style="font-size:14px;font-weight:900;color:#FF6B35">${metrics.activityScore || 0}%</span>
                                </div>
                            </div>
                        </div>

                        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:12px">
                            <div style="font-size:10px;color:rgba(156,163,175,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;text-align:center">ASSETS</div>
                            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
                                <div style="background:rgba(0,0,0,0.20);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px">
                                    <div style="font-size:10px;color:rgba(107,114,128,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;text-align:center">FB</div>
                                    <div style="display:flex;flex-direction:column;gap:6px">
                                        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;color:rgba(156,163,175,1)">Wallet</span><span style="font-size:12px;font-weight:800;color:#fff">${parseFloat(metrics.nativeBalance || 0).toFixed(4)}</span></div>
                                        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;color:rgba(156,163,175,1)">InSwap</span><span style="font-size:12px;font-weight:800;color:#fff">${parseFloat(metrics.fbSwapBalance || 0).toFixed(4)}</span></div>
                                        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;color:rgba(156,163,175,1)">Total</span><span style="font-size:12px;font-weight:800;color:#fff">${parseFloat(metrics.fbTotal || 0).toFixed(2)}</span></div>
                                    </div>
                                </div>

                                <div style="background:rgba(0,0,0,0.20);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px">
                                    <div style="font-size:10px;color:rgba(107,114,128,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;text-align:center">FENNEC</div>
                                    <div style="display:flex;flex-direction:column;gap:6px">
                                        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;color:rgba(156,163,175,1)">Wallet</span><span style="font-size:12px;font-weight:800;color:#fff">${parseFloat(metrics.fennecWalletBalance || 0).toFixed(2)}</span></div>
                                        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;color:rgba(156,163,175,1)">InSwap</span><span style="font-size:12px;font-weight:800;color:#fff">${parseFloat(metrics.fennecInSwapBalance || 0).toFixed(2)}</span></div>
                                        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;color:rgba(156,163,175,1)">Total</span><span style="font-size:12px;font-weight:800;color:#fff">${parseFloat(metrics.fennecBalance || 0).toFixed(2)}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:12px">
                            <div style="font-size:10px;color:rgba(156,163,175,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;text-align:center">INSCRIPTIONS</div>
                            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
                                <div style="background:rgba(0,0,0,0.20);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px;text-align:center">
                                    <div style="font-size:10px;color:rgba(107,114,128,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">Runes</div>
                                    <div style="font-size:16px;font-weight:900;color:#fff">${inscriptionStats.runes || 0}</div>
                                </div>
                                <div style="background:rgba(0,0,0,0.20);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px;text-align:center">
                                    <div style="font-size:10px;color:rgba(107,114,128,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">BRC-20</div>
                                    <div style="font-size:16px;font-weight:900;color:#fff">${inscriptionStats.brc20 || 0}</div>
                                </div>
                                <div style="background:rgba(0,0,0,0.20);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px;text-align:center">
                                    <div style="font-size:10px;color:rgba(107,114,128,1);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">Ordinals</div>
                                    <div style="font-size:16px;font-weight:900;color:#fff">${inscriptionStats.ordinals || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

    const imageEvolutionOverrideCSS = `<style>
            .img-tier-0{filter:grayscale(0.20) sepia(0.16) contrast(1.00) brightness(1.00) saturate(1.05);transform:scale(1.01)}
            .anim-tier-1{animation:breathe 10s ease-in-out infinite alternate}
            @keyframes breathe{0%{filter:grayscale(0.08) contrast(1.02) brightness(1.00) saturate(1.04)}100%{filter:grayscale(0) contrast(1.06) brightness(1.06) saturate(1.10)}}
            .anim-tier-2-heat{animation:heat-low 5s infinite alternate}
            @keyframes heat-low{0%{filter:sepia(0.14) contrast(1.10) brightness(1.03) saturate(1.08)}100%{filter:sepia(0.28) contrast(1.16) brightness(1.07) saturate(1.13)}}
            .anim-tier-2-shine{animation:shine-low 4s infinite alternate}
            @keyframes shine-low{0%{filter:brightness(1.06) contrast(1.06) saturate(1.14)}100%{filter:brightness(1.18) contrast(1.10) saturate(1.25)}}
            .anim-tier-2-glitch{animation:glitch-low 3s infinite}
            @keyframes glitch-low{0%,92%{filter:contrast(1.12) brightness(1.03) saturate(1.08);transform:translate3d(0,0,0)}93%{filter:contrast(1.28) brightness(1.06) saturate(1.15) hue-rotate(6deg);transform:translate3d(1px,0,0)}94%{filter:contrast(1.28) brightness(1.06) saturate(1.15) hue-rotate(-6deg);transform:translate3d(-1px,0,0)}100%{filter:contrast(1.12) brightness(1.03) saturate(1.08);transform:translate3d(0,0,0)}}
            .anim-tier-2-magic{animation:magic-low 4s infinite alternate}
            @keyframes magic-low{0%{filter:hue-rotate(0deg) saturate(1.15) contrast(1.06) brightness(1.03)}100%{filter:hue-rotate(-8deg) saturate(1.34) contrast(1.12) brightness(1.12)}}

            .overlay-DRIFTER{background:linear-gradient(to bottom,rgba(255,160,0,0.16),transparent 70%);mix-blend-mode:overlay;border-radius:inherit;overflow:hidden}
            .overlay-DRIFTER::before{content:'';position:absolute;inset:-10%;background:radial-gradient(circle,rgba(255,255,255,0.22) 0 1px,transparent 2px) 0 0/22px 22px,radial-gradient(circle,rgba(255,160,0,0.22) 0 1px,transparent 2px) 10px 12px/26px 26px,radial-gradient(circle,rgba(255,255,255,0.10) 0 1px,transparent 2px) 0 0/38px 38px;opacity:0.55;mix-blend-mode:overlay;filter:blur(0.2px);animation:sand-drift 8s linear infinite}
            .overlay-DRIFTER::after{content:'';position:absolute;inset:-8%;background:linear-gradient(90deg,rgba(255,255,255,0.14),transparent 35%,rgba(255,255,255,0.10) 65%,transparent);opacity:0.24;mix-blend-mode:screen;filter:blur(1.6px) saturate(1.15);animation:heat-haze 4s ease-in-out infinite}
            @keyframes drifter-heat{0%{filter:sepia(0.28) contrast(1.10) brightness(1.06) saturate(1.10)}50%{filter:sepia(0.48) contrast(1.16) brightness(1.16) saturate(1.18) blur(0.35px) drop-shadow(0 0 14px rgba(255,160,0,0.20))}100%{filter:sepia(0.28) contrast(1.10) brightness(1.06) saturate(1.10)}}
            @keyframes sand-drift{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-6%,-10%,0)}}
            @keyframes heat-haze{0%{transform:translate3d(-2%,0,0) skewX(-1.2deg)}50%{transform:translate3d(2%,-1%,0) skewX(1.2deg)}100%{transform:translate3d(-2%,0,0) skewX(-1.2deg)}}

            .overlay-MERCHANT{background:radial-gradient(circle at 50% 70%,rgba(255,215,0,0.10),transparent 58%);mix-blend-mode:screen;border-radius:inherit;overflow:hidden}
            .overlay-MERCHANT::before{content:'';position:absolute;inset:-20%;background:linear-gradient(120deg,transparent 40%,rgba(255,215,0,0.55) 50%,transparent 60%);mix-blend-mode:color-dodge;opacity:0.65;animation:coin-glint 2.4s linear infinite;filter:blur(0.6px)}
            .overlay-MERCHANT::after{content:'';position:absolute;inset:-15%;background:radial-gradient(circle,rgba(255,255,255,0.35) 0 1px,transparent 2px) 0 0/26px 26px,radial-gradient(circle,rgba(255,215,0,0.30) 0 1px,transparent 2px) 12px 10px/34px 34px;opacity:0.28;mix-blend-mode:screen;animation:sparkle-drift 6s ease-in-out infinite alternate;filter:blur(0.25px)}
            @keyframes merchant-shine{0%,100%{filter:contrast(1.10) brightness(1.10) saturate(1.18)}50%{filter:contrast(1.18) brightness(1.34) saturate(1.42) drop-shadow(0 0 18px rgba(255,215,0,0.40))}}
            @keyframes coin-glint{0%{transform:translate3d(30%,-20%,0)}100%{transform:translate3d(-30%,20%,0)}}
            @keyframes sparkle-drift{0%{transform:translate3d(-1%,1%,0);opacity:0.20}100%{transform:translate3d(1%,-1%,0);opacity:0.36}}

            .overlay-ENGINEER{background:repeating-linear-gradient(0deg,rgba(0,255,170,0.0),rgba(0,255,170,0.0) 2px,rgba(0,255,170,0.12) 3px),linear-gradient(90deg,rgba(0,0,0,0.0),rgba(0,255,170,0.08),rgba(0,0,0,0.0));background-size:100% 4px,200% 200%;mix-blend-mode:hard-light;border-radius:inherit;overflow:hidden}
            .overlay-ENGINEER::before{content:'';position:absolute;inset:-10%;background:linear-gradient(0deg,transparent 40%,rgba(255,255,255,0.18) 50%,transparent 60%);opacity:0.16;mix-blend-mode:overlay;animation:engineer-scan 2.2s linear infinite;filter:blur(0.6px)}
            .overlay-ENGINEER::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,0,80,0.10),rgba(255,0,80,0.10) 1px,transparent 2px,transparent 6px);opacity:0.14;mix-blend-mode:difference;animation:engineer-rgb 3.6s ease-in-out infinite}
            @keyframes engineer-glitch{0%{filter:contrast(1.16) brightness(1.06) saturate(1.10);transform:translate3d(0,0,0)}92%{filter:contrast(1.16) brightness(1.06) saturate(1.10);transform:translate3d(0,0,0)}94%{filter:contrast(1.48) brightness(1.10) saturate(1.35) hue-rotate(90deg);transform:translate3d(2px,0,0)}96%{filter:contrast(1.48) brightness(1.10) saturate(1.35) hue-rotate(-90deg);transform:translate3d(-2px,0,0)}98%{filter:contrast(1.16) brightness(1.06) saturate(1.10);transform:translate3d(0,0,0)}100%{filter:contrast(1.16) brightness(1.06) saturate(1.10);transform:translate3d(0,0,0)}}
            @keyframes engineer-scan{0%{transform:translate3d(0,22%,0)}100%{transform:translate3d(0,-22%,0)}}
            @keyframes engineer-rgb{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(1%,0,0)}}

            .overlay-SHAMAN{background:radial-gradient(circle at 50% 55%,rgba(147,51,234,0.18),transparent 62%);mix-blend-mode:color-dodge;animation:rune-glow 3.8s ease-in-out infinite alternate;border-radius:inherit;overflow:hidden}
            .overlay-SHAMAN::before{content:'';position:absolute;inset:-15%;background:conic-gradient(from 0deg,rgba(147,51,234,0.0),rgba(168,85,247,0.35),rgba(59,130,246,0.0),rgba(168,85,247,0.32),rgba(147,51,234,0.0));opacity:0.35;mix-blend-mode:color-dodge;filter:blur(1.4px);animation:shaman-swirl 7s linear infinite}
            .overlay-SHAMAN::after{content:'';position:absolute;inset:-10%;background:radial-gradient(circle,rgba(255,255,255,0.18) 0 1px,transparent 2px) 0 0/28px 28px,radial-gradient(circle,rgba(168,85,247,0.20) 0 1px,transparent 2px) 14px 10px/36px 36px;opacity:0.18;mix-blend-mode:screen;animation:rune-dust 5s ease-in-out infinite alternate}
            @keyframes shaman-pulse{0%{filter:contrast(1.10) brightness(1.06) saturate(1.24)}100%{filter:contrast(1.28) brightness(1.16) saturate(1.72) hue-rotate(-10deg) drop-shadow(0 0 20px rgba(168,85,247,0.55))}}
            @keyframes rune-glow{0%{opacity:0.25}100%{opacity:0.55}}
            @keyframes shaman-swirl{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
            @keyframes rune-dust{0%{transform:translate3d(-1%,1%,0);opacity:0.12}100%{transform:translate3d(1%,-1%,0);opacity:0.22}}

            .overlay-KEEPER{background:radial-gradient(circle at 50% 45%,rgba(251,146,60,0.14),transparent 62%);mix-blend-mode:screen;border-radius:inherit;overflow:hidden}
            .overlay-KEEPER::before{content:'';position:absolute;inset:-20%;background:radial-gradient(circle,rgba(255,255,255,0.22) 0 1px,transparent 2px) 0 0/26px 26px,radial-gradient(circle,rgba(251,146,60,0.22) 0 1px,transparent 2px) 10px 14px/32px 32px;opacity:0.20;mix-blend-mode:screen;animation:ember-drift 6.5s ease-in-out infinite alternate;filter:blur(0.25px)}
            .overlay-KEEPER::after{content:'';position:absolute;inset:-10%;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.10),transparent 62%);opacity:0.14;mix-blend-mode:soft-light;animation:halo-breathe 3.8s ease-in-out infinite alternate;filter:blur(2px)}
            @keyframes keeper-eternal{0%{filter:sepia(0.05) contrast(1.08) brightness(1.02) saturate(1.06)}100%{filter:sepia(0.01) contrast(1.14) brightness(1.06) saturate(1.10) drop-shadow(0 0 10px rgba(251,146,60,0.20))}}
            @keyframes ember-drift{0%{transform:translate3d(-1%,2%,0)}100%{transform:translate3d(1%,-2%,0)}}
            @keyframes halo-breathe{0%{opacity:0.14}100%{opacity:0.30}}

            .overlay-WALKER{background:linear-gradient(45deg,rgba(59,130,246,0.22),transparent);mix-blend-mode:overlay;border-radius:inherit;overflow:hidden}
            .overlay-WALKER::before{content:'';position:absolute;inset:-15%;background:repeating-radial-gradient(circle at 60% 40%,rgba(255,255,255,0.18) 0 2px,transparent 3px 18px);opacity:0.22;mix-blend-mode:screen;filter:blur(0.8px);animation:time-rings 5.8s linear infinite}
            .overlay-WALKER::after{content:'';position:absolute;inset:-10%;background:linear-gradient(90deg,rgba(255,255,255,0.10),transparent 35%,rgba(255,255,255,0.06) 65%,transparent);opacity:0.18;mix-blend-mode:screen;filter:blur(1.2px);animation:time-shear 3.6s ease-in-out infinite}
            @keyframes walker-shift{0%,100%{filter:contrast(1.16) brightness(1.08) saturate(1.12) hue-rotate(0deg)}50%{filter:contrast(1.26) brightness(1.16) saturate(1.26) hue-rotate(10deg)}}
            @keyframes time-rings{0%{transform:translate3d(-2%,2%,0)}100%{transform:translate3d(2%,-2%,0)}}
            @keyframes time-shear{0%{transform:translate3d(-2%,0,0) skewX(-1deg)}50%{transform:translate3d(2%,-1%,0) skewX(1deg)}100%{transform:translate3d(-2%,0,0) skewX(-1deg)}}

            .overlay-LORD{background:radial-gradient(circle at 50% 85%,rgba(6,182,212,0.14),transparent 60%);mix-blend-mode:overlay;border-radius:inherit;overflow:hidden}
            .overlay-LORD::before{content:'';position:absolute;inset:-20%;background:repeating-radial-gradient(circle at 30% 80%,rgba(255,255,255,0.16) 0 6px,transparent 10px 26px),repeating-radial-gradient(circle at 70% 75%,rgba(255,255,255,0.10) 0 5px,transparent 9px 22px);opacity:0.16;mix-blend-mode:screen;filter:blur(1.0px);animation:caustics 9s linear infinite}
            .overlay-LORD::after{content:'';position:absolute;inset:-10%;background:linear-gradient(180deg,rgba(255,255,255,0.12),transparent 55%,rgba(255,255,255,0.08));opacity:0.22;mix-blend-mode:soft-light;filter:blur(1.6px);animation:tide-sheen 4.5s ease-in-out infinite}
            @keyframes lord-tide{0%{filter:contrast(1.12) brightness(1.06) saturate(1.14)}100%{filter:contrast(1.26) brightness(1.16) saturate(1.50) drop-shadow(0 12px 26px rgba(6,182,212,0.45))}}
            @keyframes caustics{0%{transform:translate3d(-2%,1%,0) rotate(0deg)}100%{transform:translate3d(2%,-1%,0) rotate(360deg)}}
            @keyframes tide-sheen{0%{transform:translate3d(0,2%,0);opacity:0.16}50%{transform:translate3d(0,-2%,0);opacity:0.28}100%{transform:translate3d(0,2%,0);opacity:0.16}}

            .overlay-PRIME{background:radial-gradient(circle at 50% 0%,rgba(255,255,255,0.52),transparent 72%);mix-blend-mode:soft-light;animation:god-ray 8s linear infinite;border-radius:inherit;overflow:hidden}
            .overlay-PRIME::before{content:'';position:absolute;inset:-20%;background:conic-gradient(from 0deg,transparent,rgba(255,255,255,0.22),transparent 40%,rgba(255,255,255,0.18),transparent 75%,rgba(255,255,255,0.20),transparent);opacity:0.26;mix-blend-mode:screen;filter:blur(1.2px);animation:prime-halo 10s linear infinite}
            .overlay-PRIME::after{content:'';position:absolute;inset:-15%;background:radial-gradient(circle,rgba(255,255,255,0.30) 0 1px,transparent 2px) 0 0/30px 30px,radial-gradient(circle,rgba(255,255,255,0.20) 0 1px,transparent 2px) 14px 18px/44px 44px;opacity:0.20;mix-blend-mode:screen;filter:blur(0.3px);animation:prime-sparks 6.5s ease-in-out infinite alternate}
            @keyframes prime-radiance{0%{filter:brightness(1.18) contrast(1.12) saturate(1.10)}100%{filter:brightness(1.55) contrast(1.22) saturate(1.22) drop-shadow(0 0 36px rgba(255,255,255,0.90))}}
            @keyframes prime-halo{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}}
            @keyframes prime-sparks{0%{transform:translate3d(-1%,1%,0);opacity:0.14}100%{transform:translate3d(1%,-1%,0);opacity:0.24}}

            .overlay-SINGULARITY{background:conic-gradient(from 0deg,#ff0000,#00ff00,#0000ff,#ff0000);mix-blend-mode:exclusion;opacity:0.28;animation:void-spin 20s linear infinite;border-radius:inherit;overflow:hidden}
            .overlay-SINGULARITY::before{content:'';position:absolute;inset:-20%;background:repeating-radial-gradient(circle at 50% 50%,rgba(255,255,255,0.10) 0 1px,transparent 2px 9px);opacity:0.12;mix-blend-mode:overlay;filter:blur(0.6px);animation:void-grain 3.2s steps(2,end) infinite}
            .overlay-SINGULARITY::after{content:'';position:absolute;inset:-10%;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.10),transparent 55%),conic-gradient(from 0deg,rgba(255,255,255,0.00),rgba(255,255,255,0.14),rgba(255,255,255,0.00));opacity:0.18;mix-blend-mode:screen;filter:blur(1.6px);animation:void-pulse 4.8s ease-in-out infinite}
            @keyframes singularity-chaos{0%{filter:hue-rotate(0deg) contrast(1.25) brightness(1.05) saturate(1.10)}50%{filter:hue-rotate(180deg) contrast(1.65) brightness(1.15) saturate(1.30) drop-shadow(0 0 26px rgba(255,255,255,0.22))}100%{filter:hue-rotate(360deg) contrast(1.25) brightness(1.05) saturate(1.10)}}
            @keyframes void-grain{0%{transform:translate3d(-1%,-1%,0)}100%{transform:translate3d(1%,1%,0)}}
            @keyframes void-pulse{0%{transform:rotate(0deg);opacity:0.12}50%{transform:rotate(180deg);opacity:0.26}100%{transform:rotate(360deg);opacity:0.12}}
            </style>`;

    const imageEvolutionRetuneCSS = `<style>
            .face [class^="overlay-"],.face [class*=" overlay-"]{z-index:12!important}
            .vfx-3d{position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:13;opacity:var(--vfx3d-opacity,0.24);mix-blend-mode:screen;overflow:hidden}
            .vfx-3d::before{content:'';position:absolute;inset:-25%;background:radial-gradient(circle at var(--mxp,50%) var(--myp,50%),rgba(255,255,255,0.58),transparent 60%),linear-gradient(120deg,rgba(255,255,255,0.00),rgba(255,255,255,0.14),rgba(255,255,255,0.00));filter:blur(9px) saturate(1.06);transform:translate3d(var(--npx,0px),var(--npy,0px),0)}
            .vfx-3d::after{content:'';position:absolute;inset:-20%;background:radial-gradient(circle at var(--mxp,50%) var(--myp,50%),rgba(255,255,255,0.26),transparent 46%),repeating-linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0.08) 1px,transparent 2px,transparent 7px);background-size:100% 100%,220% 220%;background-position:0 0,0 0;mix-blend-mode:soft-light;filter:blur(1.6px);opacity:0.60;transform:translate3d(var(--px,0px),var(--py,0px),0);animation:vfx-sheen 7.5s linear infinite}
            @keyframes vfx-sheen{0%{background-position:0 0,0% 50%}100%{background-position:0 0,100% 50%}}
            @keyframes heat-low{0%{filter:sepia(0.08) contrast(1.06) brightness(1.02) saturate(1.04)}100%{filter:sepia(0.16) contrast(1.10) brightness(1.05) saturate(1.06)}}
            @keyframes shine-low{0%{filter:brightness(1.03) contrast(1.04) saturate(1.06)}100%{filter:brightness(1.10) contrast(1.06) saturate(1.12)}}
            @keyframes glitch-low{0%,92%{filter:contrast(1.12) brightness(1.03) saturate(1.08);transform:translate3d(0,0,0)}93%{filter:contrast(1.22) brightness(1.05) saturate(1.12) hue-rotate(3deg);transform:translate3d(1px,0,0)}94%{filter:contrast(1.22) brightness(1.05) saturate(1.12) hue-rotate(-3deg);transform:translate3d(-1px,0,0)}100%{filter:contrast(1.12) brightness(1.03) saturate(1.08);transform:translate3d(0,0,0)}}
            @keyframes magic-low{0%{filter:saturate(1.08) contrast(1.04) brightness(1.02)}100%{filter:saturate(1.16) contrast(1.06) brightness(1.06)}}
            .overlay-DRIFTER::before{opacity:0.78;animation:sand-drift 7s linear infinite}
            .overlay-DRIFTER::after{opacity:0.34;filter:blur(1.6px) saturate(1.10);animation:heat-haze 3.6s ease-in-out infinite}
            @keyframes drifter-heat{0%{filter:sepia(0.12) contrast(1.06) brightness(1.03) saturate(1.05)}50%{filter:sepia(0.22) contrast(1.10) brightness(1.08) saturate(1.08) blur(0.25px) drop-shadow(0 0 12px rgba(255,160,0,0.18))}100%{filter:sepia(0.12) contrast(1.06) brightness(1.03) saturate(1.05)}}
            .overlay-MERCHANT::before{opacity:0.85;animation:coin-glint 2.2s linear infinite}
            .overlay-MERCHANT::after{opacity:0.42;animation:sparkle-drift 5.2s ease-in-out infinite alternate}
            @keyframes merchant-shine{0%,100%{filter:contrast(1.06) brightness(1.06) saturate(1.10)}50%{filter:contrast(1.10) brightness(1.18) saturate(1.18) drop-shadow(0 0 14px rgba(255,215,0,0.32))}}
            .overlay-ENGINEER::before{opacity:0.30;animation:engineer-scan 2.0s linear infinite}
            .overlay-ENGINEER::after{opacity:0.22;animation:engineer-rgb 3.0s ease-in-out infinite}
            @keyframes engineer-glitch{0%,92%{filter:contrast(1.12) brightness(1.04) saturate(1.06);transform:translate3d(0,0,0)}94%{filter:contrast(1.30) brightness(1.07) saturate(1.15) hue-rotate(18deg);transform:translate3d(2px,0,0)}96%{filter:contrast(1.30) brightness(1.07) saturate(1.15) hue-rotate(-18deg);transform:translate3d(-2px,0,0)}98%,100%{filter:contrast(1.12) brightness(1.04) saturate(1.06);transform:translate3d(0,0,0)}}
            .overlay-SHAMAN::before{opacity:0.50;animation:shaman-swirl 6s linear infinite}
            .overlay-SHAMAN::after{opacity:0.28;animation:rune-dust 4.6s ease-in-out infinite alternate}
            @keyframes shaman-pulse{0%{filter:contrast(1.06) brightness(1.04) saturate(1.10)}100%{filter:contrast(1.14) brightness(1.10) saturate(1.22) hue-rotate(-4deg) drop-shadow(0 0 16px rgba(168,85,247,0.40))}}
            .overlay-KEEPER::before{opacity:0.22;animation:ember-drift 5.8s ease-in-out infinite alternate}
            .overlay-KEEPER::after{opacity:0.14;animation:halo-breathe 3.2s ease-in-out infinite alternate}
            @keyframes keeper-eternal{0%{filter:sepia(0.05) contrast(1.08) brightness(1.02) saturate(1.06)}100%{filter:sepia(0.01) contrast(1.14) brightness(1.06) saturate(1.10) drop-shadow(0 0 10px rgba(251,146,60,0.20))}}
            .overlay-WALKER::before{opacity:0.34;animation:time-rings 5.2s linear infinite}
            .overlay-WALKER::after{opacity:0.26;animation:time-shear 3.0s ease-in-out infinite}
            @keyframes walker-shift{0%,100%{filter:contrast(1.10) brightness(1.05) saturate(1.06) hue-rotate(0deg)}50%{filter:contrast(1.18) brightness(1.10) saturate(1.14) hue-rotate(4deg)}}
            .overlay-LORD::before{opacity:0.24;animation:caustics 8s linear infinite}
            .overlay-LORD::after{opacity:0.32;animation:tide-sheen 3.8s ease-in-out infinite}
            @keyframes lord-tide{0%{filter:contrast(1.08) brightness(1.04) saturate(1.08)}100%{filter:contrast(1.16) brightness(1.10) saturate(1.18) drop-shadow(0 10px 22px rgba(6,182,212,0.35))}}
            .overlay-PRIME::before{opacity:0.40;animation:prime-halo 9s linear infinite}
            .overlay-PRIME::after{opacity:0.30;animation:prime-sparks 5.6s ease-in-out infinite alternate}
            @keyframes prime-radiance{0%{filter:brightness(1.10) contrast(1.06) saturate(1.06)}100%{filter:brightness(1.26) contrast(1.12) saturate(1.14) drop-shadow(0 0 28px rgba(255,255,255,0.55))}}
            .overlay-SINGULARITY{background:conic-gradient(from 0deg,rgba(255,0,0,0.85),rgba(0,255,0,0.75),rgba(0,0,255,0.85),rgba(255,0,0,0.85));mix-blend-mode:overlay;opacity:0.18;filter:saturate(0.78) contrast(0.95)}
            .overlay-SINGULARITY::before{opacity:0.22;animation:void-grain 2.8s steps(2,end) infinite}
            .overlay-SINGULARITY::after{opacity:0.28;animation:void-pulse 4.2s ease-in-out infinite}
            @keyframes singularity-chaos{0%{filter:contrast(1.10) brightness(1.03) saturate(1.06)}50%{filter:contrast(1.26) brightness(1.08) saturate(1.12) drop-shadow(0 0 18px rgba(255,255,255,0.18))}100%{filter:contrast(1.10) brightness(1.03) saturate(1.06)}}
            </style>`;

    const mintTiltCSS = `<style>
            .card{--tiltX:0deg;--tiltY:0deg;--flipY:0deg;transform:perspective(900px) rotateX(var(--tiltX)) rotateY(calc(var(--tiltY) + var(--flipY)))}
            .card.flipped{--flipY:180deg;transform:perspective(900px) rotateX(var(--tiltX)) rotateY(calc(var(--tiltY) + var(--flipY)))}
            </style>`;

    const mint3DScript = `<script>
(function(){
var scene=document.querySelector('.scene');
var card=document.querySelector('.card');
var glare=document.querySelector('.card-glare');
if(!scene||!card)return;
var tier=${tier};
var tiltStrength=tier===0?4:tier===1?7:tier===2?10:13;
var idleAmp=tier===0?2:tier===1?3:tier===2?4.5:6;
var glareIntensity=tier===0?0.025:tier===1?0.035:tier===2?0.045:0.055;
var state={hover:false,lastMove:0,start:performance.now(),raf:0};
var pose={targetX:0,targetY:0,curX:0,curY:0};

function clearTilt(){
card.style.removeProperty('transition');
card.style.removeProperty('--mxp');
card.style.removeProperty('--myp');
card.style.removeProperty('--px');
card.style.removeProperty('--py');
card.style.removeProperty('--npx');
card.style.removeProperty('--npy');
card.style.setProperty('--tiltX','0deg');
card.style.setProperty('--tiltY','0deg');
pose.targetX=0;pose.targetY=0;pose.curX=0;pose.curY=0;
}

function setPoseTarget(mxp,myp,fromMouse){
var nx=(mxp-50)/50;
var ny=(myp-50)/50;
card.style.setProperty('--mxp',mxp.toFixed(2)+'%');
card.style.setProperty('--myp',myp.toFixed(2)+'%');
card.style.setProperty('--px',(nx*11).toFixed(2)+'px');
card.style.setProperty('--py',(ny*11).toFixed(2)+'px');
card.style.setProperty('--npx',(nx*4).toFixed(2)+'px');
card.style.setProperty('--npy',(ny*4).toFixed(2)+'px');
pose.targetX=-ny*tiltStrength;
pose.targetY=nx*tiltStrength;
if(glare){
var opacity=fromMouse?glareIntensity*1.2:glareIntensity;
glare.style.opacity=opacity;
glare.style.background='radial-gradient(circle at '+mxp.toFixed(2)+'% '+myp.toFixed(2)+'%, rgba(255,255,255,'+(0.08+tier*0.05)+') 0%, transparent 60%)';
}
}

function tick(){
state.raf=requestAnimationFrame(tick);
if(!state.hover) return;
if(card.__flipAnimating) return;
if(card.classList.contains('flipped')) return;

var now=performance.now();
if(now-state.lastMove>=180){
var t=(now-state.start)/1000;
var mxp=50+Math.sin(t*0.55)*idleAmp;
var myp=50+Math.cos(t*0.43)*(idleAmp*0.85);
setPoseTarget(mxp,myp,false);
}

pose.curX += (pose.targetX-pose.curX)*0.12;
pose.curY += (pose.targetY-pose.curY)*0.12;
card.style.setProperty('--tiltX', pose.curX.toFixed(2)+'deg');
card.style.setProperty('--tiltY', pose.curY.toFixed(2)+'deg');
}

scene.addEventListener('click',function(){
if(card.__flipAnimating) return;
card.__flipAnimating=true;
clearTilt();
if(glare) glare.style.opacity=0;
requestAnimationFrame(function(){card.classList.toggle('flipped');});
var onEnd=function(ev){
if(ev&&ev.propertyName&&ev.propertyName!=='transform')return;
card.__flipAnimating=false;
card.removeEventListener('transitionend',onEnd);
};
card.addEventListener('transitionend',onEnd);
setTimeout(function(){
if(card.__flipAnimating){card.__flipAnimating=false;card.removeEventListener('transitionend',onEnd);}
},1200);
});

scene.addEventListener('mousemove',function(e){
if(card.__flipAnimating) return;
if(card.classList.contains('flipped')) return;
var rect=scene.getBoundingClientRect();
var x=e.clientX-rect.left;
var y=e.clientY-rect.top;
var mxp=Math.max(0,Math.min(100,(x/rect.width)*100));
var myp=Math.max(0,Math.min(100,(y/rect.height)*100));
state.hover=true;
state.lastMove=performance.now();
setPoseTarget(mxp,myp,true);
});

scene.addEventListener('mouseenter',function(){
state.hover=true;
state.lastMove=performance.now();
});

scene.addEventListener('mouseleave',function(){
state.hover=false;
clearTilt();
if(glare) glare.style.opacity=0;
});

state.raf=requestAnimationFrame(tick);
})();
<\/script>`;
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta property="og:title" content="Fennec ID - ${archetype.title}"><meta property="og:description" content="${tierLabelText ? `${tierLabelText} CLASS • ` : ''}${rarityName}"><meta property="og:image" content="${bgBase64}"><title>Fennec ID - ${archetype.title}</title>${styles}${imageEvolutionOverrideCSS}${imageEvolutionRetuneCSS}${mintTiltCSS}</head><body><div class="scene"><div class="card ${metrics.hasFennecSoul ? 'card-pulse' : ''}">${frontHTML}${backHTML}</div></div>${mint3DScript}</body></html>`;

    return htmlContent;
}

async function mintAuditCard(event) {
    if (!auditIdentity) {
        alert('Please load your Fennec ID first!');
        return;
    }

    auditIdentity = applyParentOverridesToIdentity(auditIdentity);

    const btn = document.getElementById('mintBtn');
    if (!btn) {
        alert('Mint button not found!');
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = 'GENERATING HTML...';
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
        // 1. ИСПРАВЛЕНИЕ: Определяем фон карточки по званию (как в renderAudit)
        // ИСПРАВЛЕНИЕ: Определяем фон карточки по baseKey
        let bgImage = 'img/drifter.png';
        const k = auditIdentity.archetype.baseKey || 'DRIFTER'; // Fallback

        if (k === 'SINGULARITY') bgImage = 'img/singularity.png';
        else if (k === 'PRIME') bgImage = 'img/prime.png';
        else if (k === 'LORD') bgImage = 'img/oasis.png';
        else if (k === 'WALKER') bgImage = 'img/walker.png';
        else if (k === 'KEEPER') bgImage = 'img/keeper.png';
        else if (k === 'SHAMAN') bgImage = 'img/shaman.png';
        else if (k === 'ENGINEER') bgImage = 'img/engineer.png';
        else if (k === 'MERCHANT') bgImage = 'img/merchant.png';
        else bgImage = 'img/drifter.png';

        console.log(`🎴 Mint image for "${auditIdentity.archetype.title}" (baseKey: ${k}): ${bgImage}`);

        // 2. Генерируем HTML код карточки
        const htmlCode = await generateInteractiveHTML(auditIdentity, bgImage);

        // 2.1 Provenance: hash HTML + request server signature
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
            parent_inscription_id: localStorage.getItem('fennec_parent_inscription_id') || null,
            archetype: {
                baseKey: auditIdentity?.archetype?.baseKey || '',
                title: auditIdentity?.archetype?.title || ''
            },
            tier: auditIdentity?.archetype?.tierLevel ?? null,
            html_sha256: htmlHashHex
        };

        btn.innerText = 'SIGNING PROVENANCE...';

        const provHttpRes = await fetchWithTimeout(
            `${BACKEND_URL}?action=sign_provenance`,
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
            throw new Error(`sign_provenance failed: ${provHttpRes.status} ${provHttpRes.statusText}. ${errorText}`);
        }

        const provRes = await provHttpRes.json().catch(e => {
            throw new Error(`Failed to parse sign_provenance response: ${e.message || e.toString()}`);
        });

        if (!provRes || provRes.code !== 0 || !provRes.data) {
            throw new Error(provRes?.error || provRes?.msg || 'Failed to sign provenance');
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
        const base64SizeBytes = (base64Content.length * 3) / 4; // Base64 увеличивает размер на ~33%
        const maxSizeBytes = 365 * 1024; // 365 кБ
        const sizeKB = (base64SizeBytes / 1024).toFixed(2);

        console.log(`📦 Card size: ${sizeKB} KB (max: 365 KB)`);

        // ИСПРАВЛЕНИЕ: Проверяем размер перед отправкой (максимум 365 кБ)
        if (base64SizeBytes > maxSizeBytes) {
            throw new Error(`Card too large: ${sizeKB} KB (max: 365 KB). Please try again or contact support.`);
        }

        // 4. Отправляем ордер
        btn.innerText = `CREATING ORDER... (${sizeKB} KB)`;

        const YOUR_WALLET = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        const BASE_PRICE_FB = 1; // Базовая цена: 1 FB

        // ИСПРАВЛЕНИЕ: Проверяем условия для скидки 50%
        // Скидка если: fennec_native_balance > 1000 ИЛИ has_fennec_in_lp = true
        // Получаем данные из последнего запроса к API
        const lastApiData = window.lastAuditApiData || {};
        const fennecNativeBal = auditIdentity.metrics.fennecNativeBalance || 0;
        const hasFennecInLP = lastApiData.has_fennec_in_lp || false;
        const hasDiscount = fennecNativeBal > 1000 || hasFennecInLP;
        // ИСПРАВЛЕНИЕ: Базовая цена 1 FB, со скидкой 0.5 FB (50% скидка)
        // ВРЕМЕННО: Минт бесплатный (SERVICE_FEE = 0), но цены отображаются для будущего включения
        const SERVICE_FEE = 0; // ВРЕМЕННО БЕСПЛАТНО: hasDiscount ? 50000000 : 100000000; // 50% скидка: 0.5 FB вместо 1 FB
        const priceText = hasDiscount ? '0.5 FB (50% OFF!)' : '1 FB';

        // ИСПРАВЛЕНИЕ: Используем правильный endpoint и параметры согласно OpenAPI
        const parentId = localStorage.getItem('fennec_parent_inscription_id') || '';
        const inscriptionBody = {
            receiveAddress: currentUserAddress,
            feeRate: 5,
            outputValue: 546,
            files: [
                {
                    filename: 'fennec_id.html',
                    dataURL: `data:text/html;base64,${base64Content}`
                }
            ],
            devAddress: YOUR_WALLET,
            devFee: SERVICE_FEE
        };

        // Add parent inscription if provided
        if (parentId && parentId.trim()) {
            inscriptionBody.parentId = parentId.trim();
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

        // ИСПРАВЛЕНИЕ: Проверяем статус ответа перед парсингом JSON
        if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unknown error');
            throw new Error(`API request failed: ${res.status} ${res.statusText}. ${errorText}`);
        }

        const json = await res.json().catch(e => {
            throw new Error(`Failed to parse API response: ${e.message || e.toString()}`);
        });

        if (json.code === 0) {
            // ИСПРАВЛЕНИЕ: Проверяем наличие необходимых данных в ответе
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

            // ИСПРАВЛЕНИЕ: Добавляем минт в список pending operations с htmlCode
            if (typeof addPendingOperation === 'function') {
                addPendingOperation({
                    type: 'mint',
                    orderId: orderId,
                    payAddress: payAddress,
                    amount: totalAmount,
                    status: 'pending',
                    timestamp: Date.now(),
                    htmlCode: htmlCode, // Сохраняем HTML для открытия карточки
                    html_sha256: htmlHashHex,
                    provenance: provRes.data
                });
            }

            // ИСПРАВЛЕНИЕ: Проверяем доступность UniSat перед отправкой
            if (typeof window.unisat === 'undefined') {
                throw new Error('UniSat wallet not found. Please install UniSat wallet extension.');
            }

            btn.innerText = 'OPENING WALLET...';
            await window.unisat.sendBitcoin(payAddress, totalAmount);

            // ИСПРАВЛЕНИЕ: Сохраняем информацию о минте для учета и возможности открыть карточку
            const mintInfo = {
                orderId: orderId,
                address: currentUserAddress,
                timestamp: Date.now(),
                status: 'pending',
                htmlCode: htmlCodeWithProvenance,
                html_sha256: htmlHashHex,
                provenance: provRes.data
            };

            // ИСПРАВЛЕНИЕ: Сохраняем в localStorage для учета всех минтов с уникальным ID
            const allMints = JSON.parse(localStorage.getItem('fennec_minted_cards') || '[]');
            mintInfo.id = `mint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // Уникальный ID
            allMints.push(mintInfo);
            localStorage.setItem('fennec_minted_cards', JSON.stringify(allMints));
            console.log(`✅ Card minted and tracked. ID: ${mintInfo.id}, Order ID: ${orderId}`);

            // ИСПРАВЛЕНИЕ: Восстанавливаем кнопку после минта
            btn.innerText = originalText;
            btn.disabled = false;

            alert("Payment sent! Your Interactive ID is being minted. Check 'Pending Operations' tab.");
        } else {
            throw new Error(json.msg || 'Order failed');
        }
    } catch (e) {
        console.error('Minting error:', e);
        // ИСПРАВЛЕНИЕ: Безопасная обработка ошибок - игнорируем объекты Event
        let errorMessage = 'Unknown error occurred';

        // Проверяем, что это не объект Event (ошибки загрузки изображений не должны прерывать процесс)
        if (e instanceof Event) {
            // Игнорируем события ошибок изображений - они уже обработаны в getOptimizedBase64
            console.warn('Ignoring image loading event error - already handled');
            // Не показываем ошибку пользователю для событий загрузки изображений
            if (btn) {
                btn.innerText = originalText;
                btn.disabled = false;
            }
            return; // Выходим без показа ошибки
        } else if (e && typeof e === 'object') {
            if (e.message) {
                errorMessage = e.message;
            } else if (e.toString && typeof e.toString === 'function') {
                const str = e.toString();
                // Игнорируем общие строки объектов
                if (str !== '[object Event]' && str !== '[object Object]' && str !== '[object Error]') {
                    errorMessage = str;
                }
            }
        } else if (typeof e === 'string') {
            errorMessage = e;
        }

        console.error('Error details:', {
            message: errorMessage,
            error: e,
            errorType: typeof e,
            isEvent: e instanceof Event,
            stack: e?.stack
        });

        alert('Minting failed: ' + errorMessage);
        // ИСПРАВЛЕНИЕ: Восстанавливаем кнопку при ошибке
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

// Force Scroll to Top (Final)
window.onbeforeunload = function () {
    window.scrollTo(0, 0);
};
window.onload = function () {
    setTimeout(() => window.scrollTo(0, 0), 10);
    setTimeout(() => window.scrollTo(0, 0), 100);
};

// Chat Widget Functions
function toggleChat() {
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

function sendMessage() {
    const input = document.getElementById('chatInput');
    const messages = document.getElementById('chatMessages');
    if (!input || !messages) return;

    const text = input.value.trim();
    if (!text) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'flex gap-2 items-start justify-end';
    userMsg.innerHTML = `<div class="bg-fennec/20 p-3 rounded-lg rounded-tr-none max-w-[80%]">${text}</div>`;
    messages.appendChild(userMsg);

    input.value = '';
    messages.scrollTop = messages.scrollHeight;

    setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'flex gap-2 items-start';
        botMsg.innerHTML = `<div class="w-6 h-6 flex-shrink-0"><img src="img/FENNECAI.png" class="w-full h-full object-contain ai-avatar"></div><div class="bg-white/5 p-3 rounded-lg rounded-tl-none flex-1">I'm here to help! Visit our docs or ask the community.</div>`;
        messages.appendChild(botMsg);
        messages.scrollTop = messages.scrollHeight;
    }, 500);
}

function oracleQuick(action) {
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
        messages.innerHTML =
            '<div class="flex gap-2 items-start"><div class="w-6 h-6 flex-shrink-0"><img src="img/FENNECAI.png" class="w-full h-full object-contain ai-avatar"></div><div class="bg-white/5 p-3 rounded-lg rounded-tl-none flex-1">Ask me anything about Fennec.</div></div>';
        return;
    }

    const botMsg = document.createElement('div');
    botMsg.className = 'flex gap-2 items-start';
    botMsg.innerHTML = `<div class="w-6 h-6 flex-shrink-0"><img src="img/FENNECAI.png" class="w-full h-full object-contain ai-avatar"></div><div class="bg-white/5 p-3 rounded-lg rounded-tl-none flex-1">${response}</div>`;
    messages.appendChild(botMsg);
    messages.scrollTop = messages.scrollHeight;
}
