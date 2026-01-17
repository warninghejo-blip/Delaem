import { BACKEND_URL } from './core.js';

const userAddress = null;

const AUDIT_TIMEOUT_MS = 5 * 60 * 1000;

async function fetchAuditData(abortSignal = null, silent = false) {
    let addr = String(window.userAddress || userAddress || '').trim();
    if (!addr) {
        const shouldConnect = confirm('Please connect your wallet first. Would you like to connect now?');
        if (shouldConnect) {
            await window.connectWallet();
            addr = String(window.userAddress || userAddress || '').trim();
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
        if (abortSignal?.aborted) {
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';
            throw abortError;
        }
    } catch (_) {}

    const pubkey = String(window.userPubkey || '').trim();
    const url = pubkey
        ? `${BACKEND_URL}?action=fractal_audit&address=${encodeURIComponent(addr)}&pubkey=${encodeURIComponent(pubkey)}`
        : `${BACKEND_URL}?action=fractal_audit&address=${encodeURIComponent(addr)}`;

    let lastErr = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
        const localController = new AbortController();
        const timeoutId = setTimeout(() => {
            try {
                localController.abort();
            } catch (_) {}
        }, AUDIT_TIMEOUT_MS);
        try {
            if (abortSignal) {
                if (abortSignal.aborted) localController.abort();
                else abortSignal.addEventListener('abort', () => localController.abort(), { once: true });
            }

            const res = await fetch(url, {
                signal: localController.signal,
                cache: attempt > 0 ? 'no-cache' : 'default',
                headers: { Accept: 'application/json' }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

            const workerRes = await res.json().catch(() => null);
            const apiData =
                workerRes && typeof workerRes === 'object'
                    ? workerRes.data && typeof workerRes.data === 'object'
                        ? workerRes.data
                        : workerRes
                    : {};

            if (workerRes && typeof workerRes === 'object') {
                if (workerRes.error) throw new Error(String(workerRes.error || 'Oracle error'));
                if (workerRes.code !== undefined && Number(workerRes.code) !== 0) {
                    throw new Error(String(workerRes.msg || workerRes.message || workerRes.error || 'Oracle error'));
                }
            }

            try {
                const svRaw = apiData && apiData.schema_version;
                if (svRaw !== undefined) {
                    const sv = Number(svRaw);
                    if (!Number.isFinite(sv)) throw new Error('invalid schema_version');
                    if (sv !== 1) throw new Error(`unsupported schema_version: ${sv}`);
                }
            } catch (_) {
                throw new Error('Oracle schema mismatch');
            }

            const prices = apiData.prices && typeof apiData.prices === 'object' ? apiData.prices : {};
            const stats = {
                total: Number(apiData.total_inscriptions_count || 0) || 0,
                runes: Number(apiData.runes_count || 0) || 0,
                brc20: Number(apiData.brc20_count || 0) || 0,
                ordinals: Number(apiData.ordinals_count || 0) || 0,
                totalCollections: Number(apiData.total_collections || 0) || 0,
                lp: Number(apiData.lp_count || 0) || 0
            };

            const allTokensValueUSD = Number(apiData.all_tokens_value_usd || 0) || 0;
            const lpValueUSD = Number(apiData.lp_value_usd || 0) || 0;
            const netWorth = allTokensValueUSD + lpValueUSD;

            const auditInput = {
                netWorth,
                txCount: Number(apiData.tx_count || 0) || 0,
                utxoCount: Number(apiData.utxo_count || 0) || 0,
                nativeBalance: Number(apiData.native_balance || 0) || 0,
                fbSwapBalance: Number(apiData.fb_inswap_balance || apiData.fbSwapBalance || 0) || 0,
                fb_inswap_balance: Number(apiData.fb_inswap_balance || apiData.fbSwapBalance || 0) || 0,
                first_tx_ts: Number(apiData.first_tx_ts || 0) || 0,
                abandoned_utxo_count: Number(apiData.abandoned_utxo_count || 0) || 0,
                abandoned_utxo_count_missing: !!apiData.abandoned_utxo_count_missing,
                lpValueFB: Number(apiData.lp_value_fb || 0) || 0,
                lpValueUSD,
                stakedFB: Number(apiData.staked_fb || 0) || 0,
                fennecBalance: Number(apiData.fennec_native_balance || 0) || 0,
                fennec_wallet_balance: Number(apiData.fennec_wallet_balance || 0) || 0,
                fennec_inswap_balance: Number(apiData.fennec_inswap_balance || 0) || 0,
                fennec_native_balance: Number(apiData.fennec_native_balance || 0) || 0,
                has_fennec_in_lp: !!apiData.has_fennec_in_lp,
                fennec_lp_value_usd: Number(apiData.fennec_lp_value_usd || 0) || 0,
                has_fennec_boxes: !!apiData.has_fennec_boxes,
                fennec_boxes_count: Number(apiData.fennec_boxes_count || 0) || 0,
                all_tokens_value_usd: allTokensValueUSD,
                all_tokens_details:
                    apiData.all_tokens_details && typeof apiData.all_tokens_details === 'object'
                        ? apiData.all_tokens_details
                        : {},
                stats,
                total_inscriptions_count: Number(apiData.total_inscriptions_count || 0) || 0,
                collection_inscriptions_by_collection:
                    apiData.collection_inscriptions_by_collection &&
                    typeof apiData.collection_inscriptions_by_collection === 'object'
                        ? apiData.collection_inscriptions_by_collection
                        : {},
                prices: {
                    ...prices,
                    fennec_in_fb: Number(prices.fennec_in_fb || 0) || 0
                },
                ai_lore: String(apiData.ai_lore || '').trim()
            };

            try {
                window.lastAuditApiData = apiData;
            } catch (_) {}

            if (!silent) {
                try {
                    console.log('Audit data loaded (module fetchAuditData):', addr);
                } catch (_) {}
            }
            clearTimeout(timeoutId);
            return auditInput;
        } catch (e) {
            clearTimeout(timeoutId);
            lastErr = e;
            if (abortSignal?.aborted || e?.name === 'AbortError') {
                const abortError = new Error('Request aborted');
                abortError.name = 'AbortError';
                throw abortError;
            }
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
                continue;
            }
        }
    }

    throw lastErr || new Error('Oracle error');
}

// fetchAuditData is now imported as module

// initAudit is now imported as module
// runAudit is now imported as module
// refreshAudit is now imported as module
// startAuditRefreshTimer is now imported as module

const FENNEC_ID_EPOCH = '2026-01-02';
const fennecIdKeyV2 = addr => `fennec_id_child_v3_${String(addr || '').trim()}`;
const fennecMintedCardsKey = () => `fennec_minted_cards_v3_${FENNEC_ID_EPOCH}`;

try {
    window.FENNEC_ID_EPOCH = window.FENNEC_ID_EPOCH || FENNEC_ID_EPOCH;
} catch (_) {}
try {
    window.fennecIdKeyV2 = window.fennecIdKeyV2 || fennecIdKeyV2;
} catch (_) {}
try {
    window.fennecMintedCardsKey = window.fennecMintedCardsKey || fennecMintedCardsKey;
} catch (_) {}

let auditIdentity = null;
let auditLoading = false;
let currentAuditRequestId = 0;
let currentAuditAbortController = null;
let prefetchedFennecAudit = null;
let prefetchedFennecAuditAddr = null;
let prefetchedFennecAuditTs = 0;

let initAuditLoading = false;

try {
    Object.defineProperty(window, 'auditIdentity', {
        get: () => auditIdentity,
        set: v => {
            auditIdentity = v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.auditIdentity = auditIdentity;
    } catch (_) {}
}

try {
    Object.defineProperty(window, 'auditLoading', {
        get: () => auditLoading,
        set: v => {
            auditLoading = !!v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.auditLoading = auditLoading;
    } catch (_) {}
}

try {
    Object.defineProperty(window, 'initAuditLoading', {
        get: () => initAuditLoading,
        set: v => {
            initAuditLoading = !!v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.initAuditLoading = initAuditLoading;
    } catch (_) {}
}

try {
    Object.defineProperty(window, 'currentAuditRequestId', {
        get: () => currentAuditRequestId,
        set: v => {
            currentAuditRequestId = Number(v || 0) || 0;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.currentAuditRequestId = currentAuditRequestId;
    } catch (_) {}
}

try {
    Object.defineProperty(window, 'currentAuditAbortController', {
        get: () => currentAuditAbortController,
        set: v => {
            currentAuditAbortController = v || null;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.currentAuditAbortController = currentAuditAbortController;
    } catch (_) {}
}

try {
    Object.defineProperty(window, 'prefetchedFennecAudit', {
        get: () => prefetchedFennecAudit,
        set: v => {
            prefetchedFennecAudit = v;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.prefetchedFennecAudit = prefetchedFennecAudit;
    } catch (_) {}
}

try {
    Object.defineProperty(window, 'prefetchedFennecAuditAddr', {
        get: () => prefetchedFennecAuditAddr,
        set: v => {
            prefetchedFennecAuditAddr = String(v || '').trim();
        },
        configurable: true
    });
} catch (_) {
    try {
        window.prefetchedFennecAuditAddr = prefetchedFennecAuditAddr;
    } catch (_) {}
}

try {
    Object.defineProperty(window, 'prefetchedFennecAuditTs', {
        get: () => prefetchedFennecAuditTs,
        set: v => {
            prefetchedFennecAuditTs = Number(v || 0) || 0;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.prefetchedFennecAuditTs = prefetchedFennecAuditTs;
    } catch (_) {}
}

function __fennecInitAuditSafe() {
    try {
        if (typeof initAudit !== 'function') return null;
        const p = initAudit();
        try {
            if (p && typeof p.then === 'function') p.catch(() => false);
        } catch (_) {}
        return p;
    } catch (_) {
        return null;
    }
}

try {
    window.__fennecInitAuditSafe = __fennecInitAuditSafe;
} catch (_) {}

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
                if (typeof initAudit === 'function') {
                    try {
                        const p = initAudit();
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

// Prefetch Fennec Audit - background silent loading (dedup + returns identity)
async function prefetchFennecAudit(silent = true) {
    try {
        try {
            if (localStorage.getItem('fennec_wallet_manual_disconnect') === '1') return null;
        } catch (_) {}

        const addr = String(window.userAddress || userAddress || '').trim();
        if (!addr) return null;

        const cacheKey = `audit_v3_${addr}`;
        const now = Date.now();

        if (prefetchedFennecAuditAddr === addr && prefetchedFennecAudit && now - prefetchedFennecAuditTs < 300000) {
            return prefetchedFennecAudit;
        }

        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const cachedData = JSON.parse(cached);
                if (cachedData && cachedData.identity && now - Number(cachedData.timestamp || 0) < 5 * 60 * 1000) {
                    prefetchedFennecAudit = cachedData.identity;
                    prefetchedFennecAuditAddr = addr;
                    prefetchedFennecAuditTs = now;
                    return prefetchedFennecAudit;
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

        if (typeof window.fetchAuditData !== 'function' || typeof window.calculateFennecIdentity !== 'function')
            return null;

        window.__fennecPrefetchAudit.addr = addr;
        window.__fennecPrefetchAudit.promise = (async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), AUDIT_TIMEOUT_MS);
            try {
                const data = await window.fetchAuditData(controller.signal, true).catch(() => null);
                if (!data) {
                    try {
                        if (window.__fennecPrefetchAudit && typeof window.__fennecPrefetchAudit === 'object') {
                            window.__fennecPrefetchAudit.failTs = Date.now();
                            window.__fennecPrefetchAudit.failAddr = addr;
                        }
                    } catch (_) {}
                    return null;
                }

                const identity = window.calculateFennecIdentity(data);
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

                prefetchedFennecAudit = identity;
                prefetchedFennecAuditAddr = addr;
                prefetchedFennecAuditTs = Date.now();

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

// Initialize Audit UI
initAuditLoading = false;
async function initAudit() {
    const container = document.getElementById('auditContainer');
    if (!container) return;

    // ПРИНУДИТЕЛЬНАЯ ОЧИСТКА при смене кошелька или любом вызове
    const addrNow = String(window.userAddress || userAddress || '').trim();
    if (initAuditLoading) return;
    try {
        const uiModeNow = String((window.__fennecAuditUi && window.__fennecAuditUi.mode) || 'idle');
        if (auditLoading && uiModeNow !== 'opening' && uiModeNow !== 'scanning') return;
    } catch (_) {
        if (auditLoading) return;
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

    // Если адрес изменился - всегда очищаем и сбрасываем auditIdentity
    if (addrNow !== prevAddr) {
        console.log('Wallet changed, clearing audit state');
        try {
            const idAddr = String(auditIdentity?.metrics?.address || '').trim();
            if (!(idAddr && addrNow && idAddr === addrNow)) {
                auditIdentity = null;
            }
        } catch (_) {
            auditIdentity = null;
        }
    } else {
        // Даже если адрес тот же, очищаем legacy сцены
        const hasLegacyScene = !!container.querySelector('.card-scene');
        if (hasLegacyScene) {
            console.log('Clearing legacy scene');
        } else if (container.querySelector('#fennecIdIframe')) {
            console.log('Audit UI already present, skipping initAudit');
            try {
                if (typeof window.__syncFennecIdButtonsUI === 'function') window.__syncFennecIdButtonsUI();
            } catch (_) {}
            return;
        }
    }
    window.__auditUiAddr = addrNow;

    initAuditLoading = true;

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
                if (!auditIdentity || typeof auditIdentity !== 'object') return false;
                if (!currentAddr) return false;
                const a1 = String(currentAddr || '').trim();
                const a2 = String(auditIdentity?.metrics?.address || '').trim();
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

                    Promise.resolve(window.loadExistingCardIntoIframe(existingId))
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
                await window.loadPreviewCardIntoIframe(auditIdentity);
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
                                                                                                <button onclick="${hasWallet ? 'runAudit();' : 'window.connectWallet();'}" id="getYourIdBtn"
                                                                                                    class="px-6 py-4 bg-fennec/15 border border-fennec rounded-lg text-white font-bold shadow-[inset_0_0_15px_rgba(255,107,53,0.3)] hover:bg-fennec/25 hover:border-orange-300 hover:shadow-[inset_0_0_20px_rgba(255,107,53,0.4)] hover:scale-[1.02] transition-all text-base uppercase tracking-widest flex items-center justify-center"
                                                                                                    style="backdrop-filter: blur(10px);">
                                                                                                    <span id="getYourIdBtnText">${hasWallet ? 'SCAN ID' : 'CONNECT WALLET'}</span>
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                `;
        }

        if (currentAddr && typeof prefetchFennecAudit === 'function') {
            setTimeout(() => {
                try {
                    prefetchFennecAudit(false);
                } catch (_) {}
            }, 0);
        }
    } finally {
        initAuditLoading = false;
    }
}

// Run the audit
async function runAudit(forceRefresh = false) {
    if (auditLoading) {
        console.log('Audit already running');
        return;
    }

    const addrConnected = String(window.userAddress || userAddress || '').trim();
    if (!addrConnected) {
        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Connect wallet first', 'warning', 2000);
            } else {
                alert('Connect wallet first');
            }
        } catch (_) {}
        try {
            if (typeof initAudit === 'function') __fennecInitAuditSafe();
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

    auditLoading = true;
    const requestId = ++currentAuditRequestId;
    if (currentAuditAbortController) currentAuditAbortController.abort();
    currentAuditAbortController = new AbortController();

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
        auditLoading = false;
        return;
    }

    try {
        const addr = (userAddress || window.userAddress || '').trim();

        // ИСПРАВЛЕНИЕ: Сначала проверяем in-flight prefetch и prefetchedFennecAudit
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
                    console.log('runAudit: Using in-flight prefetch promise');
                    const idFromPrefetch = await inFlight.catch(() => null);
                    if (idFromPrefetch && typeof idFromPrefetch === 'object') {
                        auditIdentity = idFromPrefetch;
                        try {
                            auditIdentity.metrics =
                                auditIdentity.metrics && typeof auditIdentity.metrics === 'object'
                                    ? auditIdentity.metrics
                                    : {};
                            auditIdentity.metrics.address = String(addr || '').trim();
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
                        auditLoading = false;
                        try {
                            if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                                window.__fennecAuditUi.addr = addr;
                                window.__fennecAuditUi.mode = 'scanned';
                                window.__fennecAuditUi.scannedAt = Date.now();
                            }
                        } catch (_) {}
                        if (typeof initAudit === 'function') __fennecInitAuditSafe();
                        return;
                    }
                }
            } catch (_) {}

            // 2. Проверяем уже завершенный prefetch (prefetchedFennecAudit)
            try {
                if (
                    prefetchedFennecAudit &&
                    prefetchedFennecAuditAddr === addr &&
                    Date.now() - prefetchedFennecAuditTs < 300000
                ) {
                    console.log('runAudit: Using prefetched audit data');
                    auditIdentity = prefetchedFennecAudit;
                    try {
                        auditIdentity.metrics =
                            auditIdentity.metrics && typeof auditIdentity.metrics === 'object'
                                ? auditIdentity.metrics
                                : {};
                        auditIdentity.metrics.address = String(addr || '').trim();
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
                    auditLoading = false;
                    try {
                        if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                            window.__fennecAuditUi.addr = addr;
                            window.__fennecAuditUi.mode = 'scanned';
                            window.__fennecAuditUi.scannedAt = Date.now();
                        }
                    } catch (_) {}
                    if (typeof initAudit === 'function') __fennecInitAuditSafe();
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
                        auditIdentity = cachedData.identity;
                        try {
                            if (auditIdentity && typeof auditIdentity === 'object') {
                                auditIdentity.metrics =
                                    auditIdentity.metrics && typeof auditIdentity.metrics === 'object'
                                        ? auditIdentity.metrics
                                        : {};
                                auditIdentity.metrics.address = String(auditIdentity.metrics.address || addr).trim();
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
                        auditLoading = false;
                        try {
                            if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                                window.__fennecAuditUi.addr = addr;
                                window.__fennecAuditUi.mode = 'scanned';
                                window.__fennecAuditUi.scannedAt = Date.now();
                            }
                        } catch (_) {}
                        if (typeof initAudit === 'function') __fennecInitAuditSafe();
                        return;
                    }
                } catch (e) {}
            }
        }

        console.log(`Starting audit scan #${requestId}...`);
        const startTime = Date.now();
        const data = await window.fetchAuditData(currentAuditAbortController.signal);

        try {
            window.lastAuditApiData = data;
        } catch (_) {}

        if (requestId !== currentAuditRequestId) {
            try {
                if (window.__scanProgressInterval) {
                    clearInterval(window.__scanProgressInterval);
                    window.__scanProgressInterval = null;
                }
            } catch (_) {}
            auditLoading = false;
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

        const identity = window.calculateFennecIdentity(data);
        try {
            if (identity && typeof identity === 'object') {
                identity.metrics = identity.metrics && typeof identity.metrics === 'object' ? identity.metrics : {};
                identity.metrics.address = String(identity.metrics.address || addr).trim();
            }
        } catch (_) {}
        auditIdentity = identity;

        localStorage.setItem(
            `audit_v3_${addr}`,
            JSON.stringify({
                identity: identity,
                timestamp: Date.now()
            })
        );

        auditLoading = false;
        try {
            if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                window.__fennecAuditUi.addr = addr;
                window.__fennecAuditUi.mode = 'scanned';
                window.__fennecAuditUi.scannedAt = Date.now();
            }
        } catch (_) {}

        if (typeof initAudit === 'function') __fennecInitAuditSafe();

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
                if (typeof window.showNotification === 'function') {
                    window.showNotification(e.message || 'Wallet connection cancelled', 'warning', 2000);
                }
            } catch (_) {}
            try {
                if (window.__fennecAuditUi && typeof window.__fennecAuditUi === 'object') {
                    window.__fennecAuditUi.mode = 'idle';
                }
            } catch (_) {}
            try {
                auditLoading = false;
                if (typeof initAudit === 'function') __fennecInitAuditSafe();
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
                                                                                                        <button onclick="runAudit(true)" class="w-full px-4 py-3 bg-fennec text-black font-bold rounded hover:bg-orange-600 transition">
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
        if (requestId === currentAuditRequestId) {
            auditLoading = false;
        }
    }
}

// ИСПРАВЛЕНИЕ: Отдельное обновление аудита (не сбрасывает карточку без желания пользователя)
let lastAuditRefreshTime = 0;
const MIN_AUDIT_REFRESH_INTERVAL = 60000; // 60 секунд между обновлениями аудита
let auditRefreshTimerInterval = null;

try {
    window.MIN_AUDIT_REFRESH_INTERVAL = window.MIN_AUDIT_REFRESH_INTERVAL || MIN_AUDIT_REFRESH_INTERVAL;
} catch (_) {}

try {
    Object.defineProperty(window, 'lastAuditRefreshTime', {
        get: () => lastAuditRefreshTime,
        set: v => {
            lastAuditRefreshTime = Number(v || 0) || 0;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.lastAuditRefreshTime = lastAuditRefreshTime;
    } catch (_) {}
}

try {
    Object.defineProperty(window, 'auditRefreshTimerInterval', {
        get: () => auditRefreshTimerInterval,
        set: v => {
            auditRefreshTimerInterval = v || null;
        },
        configurable: true
    });
} catch (_) {
    try {
        window.auditRefreshTimerInterval = auditRefreshTimerInterval;
    } catch (_) {}
}

// Таймер обратного отсчета для кнопки обновления аудита
function startAuditRefreshTimer() {
    if (auditRefreshTimerInterval) {
        clearInterval(auditRefreshTimerInterval);
    }

    const refreshAuditTimer = document.getElementById('refreshAuditTimer');
    const refreshAuditBtn = document.getElementById('refreshAuditBtn');

    if (!refreshAuditBtn) return;

    let remainingSeconds = MIN_AUDIT_REFRESH_INTERVAL / 1000;
    refreshAuditBtn.disabled = true;

    if (!refreshAuditTimer) {
        setTimeout(() => {
            refreshAuditBtn.disabled = false;
        }, MIN_AUDIT_REFRESH_INTERVAL);
        return;
    }

    refreshAuditTimer.classList.remove('hidden');
    refreshAuditTimer.textContent = `(${remainingSeconds}s)`;

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

async function refreshAudit() {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastAuditRefreshTime;

    // Проверяем, прошло ли достаточно времени
    if (timeSinceLastRefresh < MIN_AUDIT_REFRESH_INTERVAL) {
        const remainingSeconds = Math.ceil((MIN_AUDIT_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000);
        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification(`Please wait ${remainingSeconds}s before refreshing ID again`, 'warning', 2000);
            }
        } catch (_) {}
        return;
    }

    if (!userAddress && !window.userAddress) {
        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Connect wallet first', 'warning', 2000);
            }
        } catch (_) {}
        return;
    }

    if (auditLoading) {
        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Audit is already loading, please wait', 'warning', 2000);
            }
        } catch (_) {}
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
        console.log('Manual audit refresh started...');
        await runAudit(true);
        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Audit refreshed successfully', 'success', 2000);
            }
        } catch (_) {}
        console.log('Manual audit refresh completed');

        // Запускаем таймер обратного отсчета
        startAuditRefreshTimer();
    } catch (e) {
        console.error('Manual audit refresh error:', e);
        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Audit refresh failed: ' + (e.message || 'Unknown error'), 'error', 3000);
            }
        } catch (_) {}
    } finally {
        // Восстанавливаем UI кнопки (но оставляем disabled до окончания таймера)
        if (refreshAuditIcon) {
            refreshAuditIcon.classList.remove('fa-spin');
        }
        if (refreshAuditText) {
            refreshAuditText.textContent = 'Refresh Metadata';
        }
    }
}

Object.assign(window, {
    prefetchFennecAudit,
    initAudit,
    runAudit,
    refreshAudit,
    startAuditRefreshTimer
});

try {
    if (!window.__fennecAuditAutoInit) {
        window.__fennecAuditAutoInit = true;
        const __kick = () => {
            try {
                if (!document.getElementById('auditContainer')) return;
            } catch (_) {
                return;
            }
            try {
                if (typeof initAudit !== 'function') return;
                const p = initAudit();
                if (p && typeof p.then === 'function') p.catch(() => false);
            } catch (_) {}
        };

        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => setTimeout(__kick, 0));
            } else {
                setTimeout(__kick, 0);
            }
        } catch (_) {
            setTimeout(__kick, 0);
        }
    }
} catch (_) {}

// Экспорт в window для использования в других модулях
try {
    window.fetchAuditData = fetchAuditData;
} catch (_) {}

export { prefetchFennecAudit, initAudit, runAudit, refreshAudit, startAuditRefreshTimer };
export { FENNEC_ID_EPOCH, fennecIdKeyV2, fennecMintedCardsKey, __fennecInitAuditSafe, MIN_AUDIT_REFRESH_INTERVAL };
