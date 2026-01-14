(function () {
    'use strict';

    const isPreview =
        typeof window !== 'undefined' &&
        (window.location.pathname.includes('/preview/') ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1');

    // ГЛОБАЛЬНЫЙ ШИМ STORAGE
    (function () {
        function makeShim() {
            let mem = {};
            return {
                getItem: k => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
                setItem: (k, v) => {
                    mem[k] = String(v);
                },
                removeItem: k => {
                    delete mem[k];
                },
                clear: () => {
                    mem = {};
                },
                key: i => Object.keys(mem)[i] || null,
                get length() {
                    return Object.keys(mem).length;
                }
            };
        }
        try {
            const t = window.localStorage;
            if (!t) throw 1;
            t.setItem('__t', '1');
            t.removeItem('__t');
        } catch (e) {
            try {
                Object.defineProperty(window, 'localStorage', { value: makeShim(), configurable: true });
            } catch (e2) {
                window.localStorage = makeShim();
            }
        }
        try {
            const t2 = window.sessionStorage;
            if (!t2) throw 1;
            t2.setItem('__t', '1');
            t2.removeItem('__t');
        } catch (e) {
            try {
                Object.defineProperty(window, 'sessionStorage', { value: makeShim(), configurable: true });
            } catch (e2) {
                window.sessionStorage = makeShim();
            }
        }
    })();

    const DEFAULT_CONFIG = {
        version: 2,
        theme: 'cyberpunk',
        features: { enableFlip: true, enableTilt: true },
        scoring: {
            launchDate: 1725840000,
            genesisWindowSec: 86400,
            points: { activityMax: 25, wealthMax: 25, timeMax: 15, badgesMax: 35 },
            activity: { curve: 'log', maxTx: 10000 },
            wealth: { curve: 'sqrt', maxNetWorthUSD: 1000 },
            time: { maxDays: 365 },
            maxi: {
                multiplier: 1.15,
                rules: {
                    any: [
                        { field: 'fennecTotal', op: '>=', value: 10000 },
                        { field: 'hasFennecInLP', op: '==', value: true }
                    ]
                }
            },
            rarityThresholds: [
                { name: 'SPIRIT', min: 95 },
                { name: 'ELDER', min: 80 },
                { name: 'ALPHA', min: 65 },
                { name: 'HUNTER', min: 50 },
                { name: 'SCOUT', min: 30 },
                { name: 'CUB', min: 0 }
            ],
            badgeDefinitions: []
        },
        oracle: {
            enabled: false,
            endpoint: 'https://fennec-api.warninghejo.workers.dev',
            action: 'fractal_audit',
            timeoutMs: 8000,
            badgeDefinitions: []
        },
        assets: {
            backgrounds: {
                DRIFTER: '/img/drifter.png',
                WALKER: '/img/walker.png',
                MERCHANT: '/img/merchant.png',
                ENGINEER: '/img/engineer.png',
                SHAMAN: '/img/shaman.png',
                KEEPER: '/img/keeper.png',
                LORD: '/img/guard.png',
                PRIME: '/img/prime.png',
                SINGULARITY: '/img/singularity.png'
            },
            badges: {
                GENESIS: '/img/badge_genesis.png',
                WHALE: '/img/badge_whale.png',
                PROVIDER: '/img/badge_provider.png',
                'FENNEC MAXI': '/img/badge_maxi.png',
                'ARTIFACT HUNTER': '/img/badge_collector.png',
                'RUNE KEEPER': '/img/badge_rune.png',
                'MEMPOOL RIDER': '/img/badge_mempool_rider.png',
                'SAND SWEEPER': '/img/badge_sweeper.png'
            },
            misc: {}
        }
    };

    const LIB_VERSION = 'v2.1.0';

    function safeJsonParse(text) {
        try {
            return JSON.parse(text);
        } catch (_) {
            return null;
        }
    }

    function getContentBase() {
        try {
            const m = (getMeta('fennec-content-base') || '').trim();
            if (m) return m;
        } catch (_) {
            void _;
        }

        try {
            const h = (
                window.location && window.location.hostname ? String(window.location.hostname) : ''
            ).toLowerCase();
            if (h === 'uniscan.cc' || h.endsWith('.uniscan.cc')) return 'https://uniscan.cc/fractal/content/';
        } catch (_) {
            void _;
        }

        try {
            const o =
                window.location && typeof window.location.origin === 'string' ? String(window.location.origin) : '';
            if (!o || o === 'null') return 'https://uniscan.cc/fractal/content/';
            const p = window.location && window.location.pathname ? String(window.location.pathname) : '';
            const host = (
                window.location && window.location.hostname ? String(window.location.hostname) : ''
            ).toLowerCase();
            if (host.indexOf('fractal-static.unisat.') === 0 && p.indexOf('/fractal/content/') !== -1)
                return o + '/content/';
            if (p.indexOf('/fractal/content/') !== -1) return o + '/fractal/content/';
            if (p.indexOf('/content/') !== -1) return o + '/content/';
        } catch (_) {
            void _;
        }

        return '';
    }

    function resolveContentRef(ref) {
        const s = String(ref || '').trim();
        if (!s) return '';
        const baseRaw = getContentBase();
        const base = baseRaw ? baseRaw.replace(/\/+$/, '') : '';

        const absMatch =
            s.match(/^https?:\/\/fractal-static\.unisat\.(?:space|io)\/content\/([^/?#]+)/i) ||
            s.match(/^https?:\/\/fractal-static\.unisat\.(?:space|io)\/fractal\/content\/([^/?#]+)/i);
        if (absMatch) {
            const id = absMatch[1];
            if (base) return `${base}/${id}`;
            return `https://uniscan.cc/fractal/content/${id}`;
        }

        if (s.startsWith('/content/')) {
            const id = s.slice('/content/'.length).split(/[?#/]/)[0];
            if (base && id) return `${base}/${id}`;
            return s;
        }

        if (s.startsWith('/fractal/content/')) {
            const id = s.slice('/fractal/content/'.length).split(/[?#/]/)[0];
            if (base && id) return `${base}/${id}`;
            return s;
        }

        if (s.startsWith('http://') || s.startsWith('https://')) return s;
        if (s.startsWith('/')) return s;
        if (base) return `${base}/${s}`;
        return `/content/${s}`;
    }

    async function fetchJsonWithTimeout(url, timeoutMs) {
        const ms = typeof timeoutMs === 'number' ? timeoutMs : 4500;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        try {
            const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
            if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function deepMerge(base, patch) {
        if (!patch || typeof patch !== 'object') return base;
        const out = Array.isArray(base) ? [...base] : { ...(base || {}) };
        for (const [k, v] of Object.entries(patch)) {
            if (
                v &&
                typeof v === 'object' &&
                !Array.isArray(v) &&
                base &&
                typeof base[k] === 'object' &&
                !Array.isArray(base[k])
            ) {
                out[k] = deepMerge(base[k], v);
            } else {
                out[k] = v;
            }
        }
        return out;
    }

    function getMeta(name) {
        const el = document.querySelector(`meta[name="${name}"]`);
        return el ? (el.getAttribute('content') || '').trim() : '';
    }

    function getTextFromScriptTag(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        return (el.textContent || '').trim();
    }

    function resolveAssetRef(ref) {
        const v = (ref || '').trim();
        if (!v) return '';
        const baseRaw = getContentBase();
        const base = baseRaw ? baseRaw.replace(/\/+$/, '') : '';

        const tier3VFX = isPreview
            ? `
/* ===== Tier 3 Archetype Overlays (Preview Only) ===== */
.overlay-DRIFTER::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, transparent 0%, rgba(194, 178, 128, 0.12) 30%, transparent 40%, rgba(218, 165, 32, 0.1) 60%, transparent 70%);
    background-size: 200% 200%;
    animation: sandDrift 8s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
}
@keyframes sandDrift {
    0%, 100% { background-position: 0% 50%; opacity: 0.5; }
    50% { background-position: 100% 50%; opacity: 0.8; }
}
.overlay-WALKER::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        radial-gradient(circle at 20% 30%, rgba(255, 218, 185, 0.15) 2px, transparent 2px),
        radial-gradient(circle at 60% 70%, rgba(255, 218, 185, 0.12) 1.5px, transparent 1.5px),
        radial-gradient(circle at 80% 20%, rgba(255, 218, 185, 0.1) 1px, transparent 1px);
    animation: windParticles 6s linear infinite;
    pointer-events: none;
    z-index: 1;
}
@keyframes windParticles {
    0% { transform: translateX(0) translateY(0); opacity: 0.4; }
    100% { transform: translateX(-20px) translateY(10px); opacity: 0.7; }
}
.overlay-MERCHANT::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 80px;
    height: 100%;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.35) 50%, transparent 100%);
    animation: goldShine 6s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
    transform: skewX(-20deg);
}
@keyframes goldShine {
    0% { left: -100%; opacity: 0; }
    50% { opacity: 1; }
    100% { left: 100%; opacity: 0; }
}
.overlay-ENGINEER::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.05) 2px, rgba(0, 255, 255, 0.05) 4px),
        repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0, 255, 255, 0.05) 2px, rgba(0, 255, 255, 0.05) 4px);
    animation: circuitPulse 4s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
}
@keyframes circuitPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
}
.overlay-SHAMAN::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 50%, rgba(138, 43, 226, 0.15) 0%, transparent 50%);
    animation: waterRipple 5s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
}
.overlay-SHAMAN::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 50%, rgba(147, 112, 219, 0.1) 0%, transparent 60%);
    animation: waterRipple 5s ease-in-out infinite 0.5s;
    pointer-events: none;
    z-index: 1;
}
@keyframes waterRipple {
    0% { transform: scale(0.8); opacity: 0; }
    50% { opacity: 0.7; }
    100% { transform: scale(1.3); opacity: 0; }
}
.overlay-KEEPER::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 30% 40%, rgba(186, 85, 211, 0.18) 0%, transparent 40%),
        radial-gradient(circle at 70% 60%, rgba(138, 43, 226, 0.15) 0%, transparent 35%);
    animation: runeGlow 4s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
}
@keyframes runeGlow {
    0%, 100% { opacity: 0.4; filter: hue-rotate(0deg); }
    50% { opacity: 0.7; filter: hue-rotate(15deg); }
}
.overlay-LORD::before {
    content: '';
    position: absolute;
    inset: 0;
    background: conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 215, 0, 0.15) 45deg, transparent 90deg, rgba(255, 215, 0, 0.15) 135deg, transparent 180deg, rgba(255, 215, 0, 0.15) 225deg, transparent 270deg, rgba(255, 215, 0, 0.15) 315deg, transparent 360deg);
    animation: sunRotate 12s linear infinite;
    pointer-events: none;
    z-index: 1;
}
@keyframes sunRotate {
    0% { transform: rotate(0deg); opacity: 0.4; }
    50% { opacity: 0.6; }
    100% { transform: rotate(360deg); opacity: 0.4; }
}
.overlay-PRIME::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.25) 2px, transparent 2px),
        radial-gradient(circle at 80% 30%, rgba(138, 43, 226, 0.25) 2px, transparent 2px),
        radial-gradient(circle at 60% 80%, rgba(0, 255, 255, 0.25) 2px, transparent 2px),
        radial-gradient(circle at 30% 70%, rgba(255, 215, 0, 0.25) 2px, transparent 2px);
    animation: starTwinkle 3s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
}
@keyframes starTwinkle {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.9; }
}
.overlay-SINGULARITY::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 50%, rgba(138, 43, 226, 0.18) 0%, rgba(0, 255, 255, 0.12) 30%, rgba(255, 215, 0, 0.1) 60%, transparent 80%);
    animation: vortexSpin 10s linear infinite;
    pointer-events: none;
    z-index: 1;
}
.overlay-SINGULARITY::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, transparent 30%, rgba(255, 255, 255, 0.12) 40%, transparent 50%);
    animation: cosmicPulse 4s ease-in-out infinite;
    pointer-events: none;
    z-index: 2;
}
@keyframes vortexSpin {
    0% { transform: rotate(0deg) scale(1); opacity: 0.5; }
    50% { opacity: 0.7; }
    100% { transform: rotate(360deg) scale(1.05); opacity: 0.5; }
}
@keyframes cosmicPulse {
    0%, 100% { transform: scale(0.9); opacity: 0.4; }
    50% { transform: scale(1.1); opacity: 0.8; }
}
`
            : '';

        const absMatch =
            v.match(/^https?:\/\/fractal-static\.unisat\.(?:space|io)\/content\/([^/?#]+)/i) ||
            v.match(/^https?:\/\/fractal-static\.unisat\.(?:space|io)\/fractal\/content\/([^/?#]+)/i);
        if (absMatch) {
            const id = absMatch[1];
            if (isPreview) return `../img/${id}`;
            if (base) return `${base}/${id}`;
            return `https://uniscan.cc/fractal/content/${id}`;
        }

        if (v.startsWith('/content/')) {
            const id = v.slice('/content/'.length).split(/[?#/]/)[0];
            if (isPreview) return `../img/${id}`;
            if (base && id) return `${base}/${id}`;
            return v;
        }

        if (v.startsWith('/fractal/content/')) {
            const id = v.slice('/fractal/content/'.length).split(/[?#/]/)[0];
            if (isPreview) return `../img/${id}`;
            if (base && id) return `${base}/${id}`;
            return v;
        }

        if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) return v;
        if (isPreview && v.startsWith('/img/')) return `..${v}`;
        if (v.startsWith('/') || v.startsWith('./') || v.startsWith('../') || v.includes('/')) return v;
        if (isPreview) return `../img/${v}`;
        if (base) return `${base}/${v}`;
        return `https://ordinals.com/content/${v}`;
    }

    function getDna() {
        const raw = getTextFromScriptTag('dna-data') || getTextFromScriptTag('user-data');
        const dna = safeJsonParse(raw);
        return dna && typeof dna === 'object' ? dna : {};
    }

    async function loadConfig() {
        const inline = safeJsonParse(getTextFromScriptTag('fennec-config-inline'));
        if (inline && typeof inline === 'object') return deepMerge(DEFAULT_CONFIG, inline);

        let configId = (getMeta('fennec-config') || '').trim();
        const manifestId = (getMeta('fennec-manifest') || '').trim();
        const isFramed = (() => {
            try {
                return window.self !== window.top || window.self !== window.parent;
            } catch (_) {
                return true;
            }
        })();
        const isContent = (() => {
            try {
                return !!(window.location && String(window.location.pathname || '').indexOf('/content/') === 0);
            } catch (_) {
                return false;
            }
        })();
        const allowManifestFetch = !isFramed && !isContent;

        if (allowManifestFetch && manifestId && manifestId !== 'inline') {
            try {
                const m = await fetchJsonWithTimeout(resolveContentRef(manifestId), 4500);
                const latest = m.latest && typeof m.latest === 'object' ? m.latest : m;
                const cfg =
                    latest.config ||
                    latest.configId ||
                    latest.configuration ||
                    latest.configurationId ||
                    latest.fennecConfig ||
                    '';
                if (typeof cfg === 'string' && cfg.trim()) configId = cfg.trim();
            } catch (_) {
                /* fallback */
            }
        }

        if (!configId) return DEFAULT_CONFIG;

        try {
            const oracleEndpoint = (getMeta('fennec-oracle-endpoint') || '').trim();
            const isInscriptionId = /^[a-f0-9]{64}i\d+$/i.test(String(configId || '').trim());
            const oracleUrl =
                oracleEndpoint && isInscriptionId
                    ? `${oracleEndpoint}${oracleEndpoint.indexOf('?') === -1 ? '?' : '&'}action=inscription_content&raw=1&inscriptionId=${encodeURIComponent(String(configId || '').trim())}`
                    : '';

            const res = await fetch(oracleUrl || resolveContentRef(configId), { cache: 'force-cache' });
            if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
            const json = await res.json();
            const merged = deepMerge(DEFAULT_CONFIG, json);
            const metaEndpoint = (getMeta('fennec-oracle-endpoint') || '').trim();
            const metaAction = (getMeta('fennec-oracle-action') || '').trim();
            if (metaEndpoint) {
                merged.oracle = merged.oracle && typeof merged.oracle === 'object' ? merged.oracle : {};
                merged.oracle.enabled = true;
                merged.oracle.endpoint = metaEndpoint;
                if (metaAction) merged.oracle.action = metaAction;
            }
            if (merged.oracle && typeof merged.oracle === 'object' && merged.oracle.enabled) {
                if (!('refreshMs' in merged.oracle)) merged.oracle.refreshMs = 0;
            }
            return merged;
        } catch (_) {
            return DEFAULT_CONFIG;
        }
    }

    function injectStyles() {
        if (document.getElementById('fennec-lib-style-v2')) return;

        try {
            const meta = document.querySelector('meta[name="fennec-embed"]');
            const isEmbed = meta && String(meta.getAttribute('content') || '').trim() === '1';
            if (isEmbed) {
                document.documentElement.setAttribute('data-fennec-embed', '1');
                if (document.body) document.body.setAttribute('data-fennec-embed', '1');
            }
        } catch (_) {
            void _;
        }

        try {
            const isFramed = (() => {
                try {
                    return window.self !== window.top || window.self !== window.parent;
                } catch (_) {
                    return true;
                }
            })();
            if (isFramed) {
                document.documentElement.setAttribute('data-fennec-embed', '1');
                if (document.body) document.body.setAttribute('data-fennec-embed', '1');
            }
        } catch (_) {
            void _;
        }

        try {
            const isContent = !!(window.location && String(window.location.pathname || '').indexOf('/content/') === 0);
            if (isContent) {
                document.documentElement.setAttribute('data-fennec-content', '1');
                if (document.body) document.body.setAttribute('data-fennec-content', '1');
            }
        } catch (_) {
            void _;
        }

        const style = document.createElement('style');
        style.id = 'fennec-lib-style-v2';
        style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

:root {
    --background: 20 10% 4%;
    --foreground: 0 0% 95%;
    --card: 20 8% 8%;
    --card-foreground: 0 0% 95%;
    --primary: 18 100% 60%;
    --primary-foreground: 20 10% 4%;
    --secondary: 20 6% 12%;
    --secondary-foreground: 0 0% 85%;
    --muted: 20 6% 15%;
    --muted-foreground: 0 0% 55%;
    --accent: 270 91% 65%;
    --accent-foreground: 0 0% 98%;
    --border: 20 10% 18%;
    --radius: 0.75rem;

    --fennec-orange: 18 100% 60%;
    --fennec-glow: 18 100% 70%;
    --obsidian: 20 10% 6%;
    --obsidian-light: 20 8% 12%;
    --holo-purple: 270 91% 65%;
    --holo-cyan: 187 94% 43%;
    --holo-blue: 217 91% 60%;
    --glass-white: 0 0% 100%;
    --laser-edge: 18 100% 55%;

    --card-accent: var(--fennec-orange);
    --card-accent2: var(--holo-purple);

    --gradient-obsidian: linear-gradient(145deg, hsl(20 10% 8%) 0%, hsl(20 15% 4%) 50%, hsl(0 0% 2%) 100%);

    --font-display: 'Space Grotesk', system-ui, sans-serif;
    --font-tactical: 'JetBrains Mono', monospace;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent !important;
}

[data-fennec-embed] html, [data-fennec-embed] body {
    background: transparent !important;
}

body {
    color: hsl(var(--foreground));
    font-family: var(--font-display);
    -webkit-font-smoothing: antialiased;
}

     #fennec-root {
         width: 100%;
         height: 100%;
         display: flex;
         align-items: center;
         justify-content: center;
         padding: 0;
         margin: 0;
         overflow: visible !important;
         background: transparent !important;
     }

     .card-scene {
        perspective: 1200px;
        width: min(420px, 100vw, calc(100vh * 336 / 490));
        height: calc(min(420px, 100vw, calc(100vh * 336 / 490)) * 490 / 336);
        position: relative;
        margin: 0;
        padding: 0;
        overflow: visible !important;
    }

    @media (max-width: 480px) {
         .card-scene {
             width: min(336px, 100vw, calc(100vh * 336 / 490));
             height: calc(min(336px, 100vw, calc(100vh * 336 / 490)) * 490 / 336);
             padding: 0;
         }
     }

    .card-object {
        width: 100%;
        height: 100%;
        position: relative;
        transform-style: preserve-3d;
        cursor: pointer;
        border-radius: 32px;
        box-shadow: none;
        will-change: transform;
        overflow: visible !important;
        --card-glow-hsl: var(--card-accent);
        --title-accent: var(--card-accent);
        --title-accent2: var(--card-accent2);
        --tiltX: 0deg;
        --tiltY: 0deg;
        --flipY: 0deg;
        transition: transform 0ms linear;
        transform: rotateX(var(--tiltX)) rotateY(calc(var(--tiltY) + var(--flipY)));
    }

    .card-scene.is-flipping .card-object {
        transition: transform 720ms cubic-bezier(0.2, 0.9, 0.2, 1);
    }

    .card-scene.is-flipped .card-object {
        --flipY: 180deg;
    }

    .card-face {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border-radius: 32px;
        overflow: hidden;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        transform-style: preserve-3d;
        z-index: 1;
        isolation: isolate;
    }

    .face-front {
        transform: rotateY(0deg);
        z-index: 2;
        display: flex;
        flex-direction: column;
    }

    .face-front > img {
        filter: none !important;
        transform: none !important;
        animation: none !important;
        border-radius: 0 !important;
    }

    .face-back {
        transform: rotateY(180deg);
        z-index: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .face-back #card-back-scroll {
        flex: 1 1 auto;
        min-height: 0;
        padding: 4px 8px 24px 8px;
    }

    .face-back #card-back-content {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0;
        padding-right: 0px;
        padding-left: var(--fid-scrollbar-pad, 0px);
        border-radius: 0;
        border: none;
        background: transparent;
        scrollbar-gutter: stable;
    }

    @keyframes card-glow-beat {
        0% {
            box-shadow:
                0 20px 50px -12px rgba(0, 0, 0, 0.8),
                0 0 0 1px hsl(var(--card-glow-hsl) / 0.22),
                0 0 34px hsl(var(--card-glow-hsl) / 0.16),
                0 0 68px hsl(var(--card-glow-hsl) / 0.10);
        }
        15% {
            box-shadow:
                0 30px 70px -10px rgba(0, 0, 0, 0.92),
                0 0 0 1px hsl(var(--card-glow-hsl) / 0.60),
                0 0 95px hsl(var(--card-glow-hsl) / 0.48),
                0 0 160px hsl(var(--card-glow-hsl) / 0.34);
        }
        100% {
            box-shadow:
                0 20px 50px -12px rgba(0, 0, 0, 0.8),
                0 0 0 1px hsl(var(--card-glow-hsl) / 0.22),
                0 0 34px hsl(var(--card-glow-hsl) / 0.16),
                0 0 68px hsl(var(--card-glow-hsl) / 0.10);
        }
    }

    .heartbeat-sync {
        animation: none;
    }

    .card-object::after {
        content: '';
        position: absolute;
        inset: 0;
        display: none;
    }

    .card-object.card-heart::after {
        content: '';
        position: absolute;
        inset: -28px;
        border-radius: 60px;
        pointer-events: none;
        z-index: -1;
        opacity: 0;
        background: none;
        filter: none;
        display: none;
    }

    .card-object::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: calc(32px + 2px);
        padding: 2px;
        box-sizing: border-box;
        background: var(
            --fennec-border-bg,
            linear-gradient(135deg, hsl(var(--card-accent)), hsl(var(--card-accent2)), hsl(var(--card-accent)))
        );
        background-size: var(--fennec-border-size, 300% 300%);
        background-position: 0% 50%;
        background-repeat: no-repeat;
        animation:
            borderFlow var(--border-flow-dur, 32s) ease-in-out infinite,
            borderPulse var(--border-pulse-dur, 9s) ease-in-out infinite;
        pointer-events: none;
        z-index: 60;
        opacity: 1;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
        mask-composite: exclude;
        box-shadow:
            inset 0 0 24px hsl(var(--card-accent) / 0.16),
            0 0 22px hsl(var(--card-accent) / 0.22),
            0 4px 16px hsl(var(--card-accent) / 0.12);
        filter: brightness(1.08) saturate(1.10);
        display: none;
    }

    .card-outer-border {
        position: absolute;
        inset: -2px;
        border-radius: calc(32px + 2px);
        padding: 2px;
        box-sizing: border-box;
        pointer-events: none;
        z-index: 50;
        opacity: 1;
        backface-visibility: visible;
        -webkit-backface-visibility: visible;
        border: 2px solid transparent;
        -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
        mask-composite: exclude;
        will-change: background, filter;
    }

    .card-border-glow {
        position: absolute;
        inset: -2px;
        border-radius: calc(32px + 2px);
        pointer-events: none;
        z-index: 49;
        opacity: 0.96;
        backface-visibility: visible;
        -webkit-backface-visibility: visible;
        transform-style: preserve-3d;
        will-change: box-shadow, filter;
    }

    .soul-divider-enhanced {
        height: 2px;
        background: linear-gradient(
            90deg,
            hsl(var(--card-accent) / 0.10) 0%,
            hsl(var(--card-accent) / 0.35) 18%,
            hsl(var(--card-accent2) / 0.95) 50%,
            hsl(var(--card-accent) / 0.35) 82%,
            hsl(var(--card-accent) / 0.10) 100%
        );
        box-shadow: none;
        border-radius: 999px;
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, #fff 14%, #fff 86%, transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0%, #fff 14%, #fff 86%, transparent 100%);
        clip-path: polygon(0 50%, 3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%);
    }

    @property --border-angle {
        syntax: '<angle>';
        inherits: false;
        initial-value: 0deg;
    }

    @property --scout-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
    }

    @property --hunter-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
    }

    @property --spirit-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
    }

    @property --alpha-angle {
        syntax: '<angle>';
        inherits: false;
        initial-value: 0deg;
    }

    .card-object[data-rarity='cub'] > .card-outer-border {
        background: linear-gradient(135deg, #3a3a3a, #5a5a5a, #6a6a6a, #5a5a5a, #3a3a3a);
        animation: none;
        filter: blur(0px);
        inset: -2px;
        padding: 2px;
        box-shadow: 0 0 15px rgba(90, 90, 90, 0.5);
        background-origin: border-box;
    }

    .card-object[data-rarity='cub'] > .card-border-glow {
        display: none;
        animation: none;
        box-shadow: none;
        filter: none;
    }

    @keyframes steelSheen {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
    }

    .card-object[data-rarity='scout'] > .card-outer-border {
        background: conic-gradient(
            from var(--scout-angle),
            rgba(34, 197, 94, 0.6) 0%,
            rgba(34, 197, 94, 0.6) 70%,
            rgba(34, 197, 94, 1) 85%,
            #22c55e 100%
        );
        animation: scoutBeam 4s linear infinite;
        filter: blur(0px);
        inset: -2px;
        padding: 2px;
        box-shadow: 0 0 15px rgba(34, 197, 94, 0.5), inset 0 0 10px rgba(34, 197, 94, 0.3);
        background-origin: border-box;
    }

    .card-object[data-rarity='scout'] > .card-border-glow {
        display: none;
        animation: none;
        box-shadow: none;
        filter: none;
    }

    @keyframes scoutBeam {
        0% { --scout-angle: 0deg; }
        100% { --scout-angle: 360deg; }
    }


    @keyframes borderAngleSpin {
        0% { --border-angle: 0deg; }
        100% { --border-angle: 360deg; }
    }

    @keyframes bioNeonPulse {
        0%, 100% {
            background-position: 0% 50%;
            filter: brightness(1.18) saturate(1.22);
            box-shadow:
                inset 0 0 18px rgba(57, 255, 20, 0.18),
                0 0 24px rgba(57, 255, 20, 0.32),
                0 4px 16px rgba(5, 150, 105, 0.26);
        }
        50% {
            background-position: 100% 50%;
            filter: brightness(1.32) saturate(1.38);
            box-shadow:
                inset 0 0 26px rgba(57, 255, 20, 0.30),
                0 0 36px rgba(57, 255, 20, 0.48),
                0 4px 20px rgba(5, 150, 105, 0.38);
        }
    }

    .card-object[data-rarity='hunter'] > .card-outer-border {
        background: conic-gradient(
            from var(--hunter-angle),
            rgba(14, 165, 233, 0.6) 0%,
            rgba(14, 165, 233, 0.6) 70%,
            rgba(14, 165, 233, 1) 85%,
            #0ea5e9 100%
        );
        animation: hunterBeam 4s linear infinite;
        filter: blur(0px);
        inset: -2px;
        padding: 2px;
        box-shadow: 0 0 15px rgba(14, 165, 233, 0.5), inset 0 0 10px rgba(14, 165, 233, 0.3);
        background-origin: border-box;
    }

    .card-object[data-rarity='hunter'] > .card-border-glow {
        display: none;
        animation: none;
        box-shadow: none;
        filter: none;
    }

    @keyframes hunterBeam {
        0% { --hunter-angle: 0deg; }
        100% { --hunter-angle: 360deg; }
    }

    .card-object[data-rarity='alpha'] > .card-outer-border {
        background: conic-gradient(
            from var(--alpha-angle),
            #ffeda0 0deg,
            #ff4500 90deg,
            #8b0000 180deg,
            #ff4500 270deg,
            #ffeda0 360deg
        );
        animation: alphaLavaSpin 8s linear infinite;
        filter: blur(0px);
        inset: -2px;
        padding: 2px;
        box-shadow:
            0 0 2px #ff6347,
            0 0 5px rgba(255, 69, 0, 0.9),
            0 0 10px rgba(139, 0, 0, 0.6);
        background-origin: border-box;
    }

    .card-object[data-rarity='alpha'] > .card-border-glow {
        animation: alphaMagmaBreathing 3s ease-in-out infinite;
        inset: -2px;
    }

    @keyframes alphaLavaSpin {
        0% { --alpha-angle: 0deg; }
        100% { --alpha-angle: 360deg; }
    }

    @keyframes alphaMagmaBreathing {
        0%, 100% {
            opacity: 0.8;
            box-shadow:
                0 0 2px #ff6347,
                0 0 5px rgba(255, 69, 0, 0.9),
                0 0 10px rgba(139, 0, 0, 0.6);
            filter: blur(0.5px);
        }
        50% {
            opacity: 1;
            box-shadow:
                0 0 3px #ff4500,
                0 0 6px rgba(255, 69, 0, 1),
                0 0 10px rgba(139, 0, 0, 0.75);
            filter: blur(0.5px);
        }
    }

    .card-object[data-rarity='elder'] > .card-outer-border {
        background: linear-gradient(135deg, #a47e1b 0%, #f9d976 25%, #ffffff 50%, #f9d976 75%, #a47e1b 100%);
        background-size: 200% 200%;
        animation: goldShimmer 5s ease-in-out infinite;
        filter: blur(0px);
        inset: -2px;
        padding: 2px;
        box-shadow: 0 0 30px rgba(255, 215, 0, 0.7);
        background-origin: border-box;
    }

    .card-object[data-rarity='elder'] > .card-border-glow {
        animation: elderHaloBreathing 3s ease-in-out infinite;
        inset: -2px;
    }

    @keyframes goldShimmer {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
    }

    @keyframes elderHaloBreathing {
        0%, 100% {
            opacity: 0.8;
            box-shadow:
                0 0 2px #ffeaa7,
                0 0 5px rgba(212, 175, 55, 0.9),
                0 0 10px rgba(184, 134, 11, 0.6);
            filter: blur(0.5px);
        }
        50% {
            opacity: 1;
            box-shadow:
                0 0 3px #ffffff,
                0 0 6px rgba(255, 215, 0, 1),
                0 0 10px rgba(184, 134, 11, 0.75);
            filter: blur(0.5px);
        }
    }



    @keyframes borderFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }

    @keyframes borderPulse {
        0%, 100% { filter: brightness(1.12) saturate(1.16); opacity: 0.98; }
        50% { filter: brightness(1.24) saturate(1.28); opacity: 1; }
    }

    .card-object[data-tier='0']::before { --border-flow-dur: 54s; --border-pulse-dur: 14s; }
    .card-object[data-tier='1']::before { --border-flow-dur: 46s; --border-pulse-dur: 12s; }
    .card-object[data-tier='2']::before { --border-flow-dur: 34s; --border-pulse-dur: 10s; }
    .card-object[data-tier='3']::before { --border-flow-dur: 24s; --border-pulse-dur: 8s; }

    @property --spirit-shift {
        syntax: '<percentage>';
        inherits: true;
        initial-value: 0%;
    }

    @property --prism-angle {
        syntax: '<angle>';
        inherits: true;
        initial-value: 0deg;
    }

    @keyframes spiritSweep {
        0% {
            --spirit-shift: -100%;
        }
        100% {
            --spirit-shift: 200%;
        }
    }

    @keyframes spiritBorderSweep {
        0% {
            background-position: -100% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }

    .card-object[data-rarity='spirit'] {
        --spirit-shift: 0%;
        --spirit-rainbow: linear-gradient(
            90deg,
            #ff0000 0%,
            #ff7f00 14%,
            #ffff00 28%,
            #00ff00 42%,
            #00ffff 57%,
            #0000ff 71%,
            #8b00ff 85%,
            #ff0000 100%
        );
    }

    .card-object[data-rarity='spirit']:not(.heartbeat-sync) {
        animation: spiritSweep 12s linear infinite;
    }

    .card-object[data-rarity='spirit'].heartbeat-sync {
        animation: spiritSweep 12s linear infinite;
    }

    .card-object[data-rarity='spirit'] > .card-outer-border {
        background: conic-gradient(
            from var(--spirit-angle),
            #ff0000 0deg,
            #ff7f00 51deg,
            #ffff00 102deg,
            #00ff00 153deg,
            #00ffff 204deg,
            #0000ff 255deg,
            #8b00ff 306deg,
            #ff0000 360deg
        );
        animation: spiritSpinGradient 6s linear infinite;
        filter: blur(0px);
        inset: -2px;
        padding: 2px;
        box-shadow:
            0 0 2px #da70d6,
            0 0 5px rgba(138, 43, 226, 0.9),
            0 0 10px rgba(75, 0, 130, 0.6);
        background-origin: border-box;
    }

    .card-object[data-rarity='spirit'] > .card-border-glow {
        animation: spiritRainbowBreathing 3s ease-in-out infinite;
        inset: -2px;
    }

    @keyframes spiritSpinGradient {
        0% { --spirit-angle: 0deg; }
        100% { --spirit-angle: 360deg; }
    }

    @keyframes spiritRainbowBreathing {
        0%, 100% {
            opacity: 0.8;
            box-shadow:
                0 0 2px #da70d6,
                0 0 5px rgba(138, 43, 226, 0.9),
                0 0 10px rgba(75, 0, 130, 0.6);
            filter: blur(0.5px);
        }
        50% {
            opacity: 1;
            box-shadow:
                0 0 3px #ffffff,
                0 0 6px rgba(138, 43, 226, 1),
                0 0 10px rgba(75, 0, 130, 0.75);
            filter: blur(0.5px);
        }
    }

    @keyframes premiumBorderFlash {
        0%, 100% {
            filter: blur(var(--border-soft-blur, 1.2px)) brightness(1.06) saturate(1.08);
        }
        50% {
            filter: blur(calc(var(--border-soft-blur, 1.2px) + 0.4px)) brightness(1.22) saturate(1.20);
        }
    }

    @keyframes soulDividerBeat {
        0%, 8%, 100% {
            opacity: 0.38;
            box-shadow: none;
        }
        10% {
            opacity: 1;
            box-shadow: none;
        }
        14% {
            opacity: 0.52;
            box-shadow: none;
        }
        20% {
            opacity: 0.38;
            box-shadow: none;
        }
        30% {
            opacity: 0.88;
            box-shadow: none;
        }
        34% {
            opacity: 0.48;
            box-shadow: none;
        }
        45% {
            opacity: 0.38;
            box-shadow: none;
        }
    }

    @keyframes spiritPrismSpin {
        0% { --prism-angle: 0deg; }
        100% { --prism-angle: 360deg; }
    }

    .soul-divider {
        transition: all 0.3s ease;
        background: linear-gradient(
            90deg,
            hsl(var(--card-accent) / 0.08) 0%,
            hsl(var(--card-accent) / 0.18) 20%,
            hsl(var(--card-accent2) / 0.55) 50%,
            hsl(var(--card-accent) / 0.18) 80%,
            hsl(var(--card-accent) / 0.08) 100%
        );
        box-shadow: none;
        border-radius: 999px;
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, #fff 14%, #fff 86%, transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0%, #fff 14%, #fff 86%, transparent 100%);
        clip-path: polygon(0 50%, 3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%);
    }

    .soul-divider-pulse {
        background: linear-gradient(
            90deg,
            hsl(var(--card-accent) / 0.10) 0%,
            hsl(var(--card-accent) / 0.35) 18%,
            hsl(var(--card-accent2) / 0.95) 50%,
            hsl(var(--card-accent) / 0.35) 82%,
            hsl(var(--card-accent) / 0.10) 100%
        );
        box-shadow: none;
        animation: soulDividerBeat 1.8s ease-in-out infinite;
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, #fff 14%, #fff 86%, transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0%, #fff 14%, #fff 86%, transparent 100%);
        clip-path: polygon(0 50%, 3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%);
    }

    .card-object[data-rarity='spirit'] .soul-divider,
    .card-object[data-rarity='spirit'] .soul-divider-enhanced,
    .card-object[data-rarity='spirit'] .soul-divider-pulse {
        background: var(--spirit-rainbow);
        background-size: 300% 100%;
        background-position: var(--spirit-shift) 50%;
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, #fff 14%, #fff 86%, transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0%, #fff 14%, #fff 86%, transparent 100%);
        animation: borderPulse 8s ease-in-out infinite;
        box-shadow: none;
        clip-path: polygon(0 50%, 3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%);
    }

    .card-object[data-tier='0'] { --tier-shine-opacity: 0; --tier-shine-dur: 999s; }
    .card-object[data-tier='1'] { --tier-shine-opacity: 0.28; --tier-shine-dur: 12s; }
    .card-object[data-tier='2'] { --tier-shine-opacity: 0.40; --tier-shine-dur: 9s; }
    .card-object[data-tier='3'] { --tier-shine-opacity: 0.52; --tier-shine-dur: 7.5s; }

    .card-object[data-rarity='cub'] { --tier-shine-rgb: 190, 190, 200; --card-accent: 0 0% 55%; --card-accent2: 0 0% 78%; }
    .card-object[data-rarity='scout'] { --tier-shine-rgb: 100, 240, 140; --card-accent: 142 70% 45%; --card-accent2: 142 70% 58%; }
    .card-object[data-rarity='hunter'] { --tier-shine-rgb: 30, 240, 255; --card-accent: 199 90% 52%; --card-accent2: 185 95% 58%; }
    .card-object[data-rarity='alpha'] { --tier-shine-rgb: 255, 90, 90; --card-accent: 0 84% 62%; --card-accent2: 42 100% 60%; }
    .card-object[data-rarity='elder'] { --tier-shine-rgb: 212, 175, 55; --card-accent: 45 92% 55%; --card-accent2: 48 100% 85%; }
    .card-object[data-rarity='spirit'] { --tier-shine-rgb: 255, 255, 255; --card-accent: 0 0% 100%; --card-accent2: 280 100% 70%; }

.card-object[data-tier='0'] .face-front {
}

.card-object[data-tier='0'] .holo-sheen::after {
    opacity: 0;
}

.card-object[data-tier='1'] .face-front {
    animation: none;
}

@keyframes holoSheenDrift {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
}

.card-object[data-tier='2'] .holo-sheen::after,
.card-object[data-tier='3'] .holo-sheen::after {
    background-size: 250% 250%;
}

@keyframes tier3TitleShimmer {
    0% { background-position: 0% 50%; }
    100% { background-position: 220% 50%; }
}

@keyframes tier3Sweep {
    0% { background-position: 0% 50%; }
    100% { background-position: 400% 50%; }
}

.tier3-title {
    background: linear-gradient(90deg,
        hsl(var(--title-accent)) 0%,
        hsl(var(--title-accent2)) 25%,
        hsl(var(--title-accent)) 50%,
        hsl(var(--title-accent2)) 75%,
        hsl(var(--title-accent)) 100%
    );
    background-size: 400% 100%;
    animation: tier3Sweep 36s linear infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
}

.archetype-title {
    color: rgba(255, 255, 255, 0.96);
}

.card-object[data-tier='0'] .archetype-title {
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 0 28px hsl(var(--title-accent) / 0.25), 0 10px 30px rgba(0, 0, 0, 0.82);
}

.card-object[data-tier='1'] .archetype-title {
    color: rgba(255, 255, 255, 0.98);
    text-shadow: 0 0 40px hsl(var(--title-accent) / 0.55), 0 10px 30px rgba(0, 0, 0, 0.82);
}

.card-object[data-tier='2'] .archetype-title {
    background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.98) 0%,
        hsl(var(--title-accent)) 55%,
        hsl(var(--title-accent2)) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0 10px hsl(var(--title-accent) / 0.30)) drop-shadow(0 10px 30px rgba(0, 0, 0, 0.82));
}

.archetype-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 11;
    opacity: 0;
}

.card-object[data-tier='1'] .archetype-overlay { opacity: 0.18; }
.card-object[data-tier='2'] .archetype-overlay { opacity: 0.30; }
.card-object[data-tier='3'] .archetype-overlay { opacity: 0.52; }

.archetype-overlay[class*='overlay-'] {
    border-radius: 32px;
    overflow: hidden;
}

@keyframes imgTierBreathe {
    0% { transform: scale(1); }
    100% { transform: scale(1.004); }
}

.anim-tier-1 {
    animation: imgTierBreathe 18s ease-in-out infinite alternate;
}

.img-tier-0 {
    transform: scale(1);
}

@keyframes imgTierHeatLow {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-tier-2-heat {
    animation: imgTierHeatLow 10s ease-in-out infinite alternate;
}

@keyframes imgTierShineLow {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-tier-2-shine {
    animation: imgTierShineLow 8s ease-in-out infinite alternate;
}

@keyframes imgTierGlitchLow {
    0%, 92% { transform: translate3d(0,0,0); }
    93% { transform: translate3d(1px,0,0); }
    94% { transform: translate3d(-1px,0,0); }
    100% { transform: translate3d(0,0,0); }
}

.anim-tier-2-glitch {
    animation: imgTierGlitchLow 6s linear infinite;
}

@keyframes imgTierMagicLow {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-tier-2-magic {
    animation: imgTierMagicLow 8s ease-in-out infinite alternate;
}

@keyframes imgTierTimeFlow {
    0% { transform: scale(1) skewX(0deg); }
    50% { transform: scale(1.006) skewX(-0.6deg); }
    100% { transform: scale(1) skewX(0deg); }
}

.anim-tier-2-time {
    animation: imgTierTimeFlow 10.4s ease-in-out infinite;
}

@keyframes imgTierRunes {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-tier-2-runes {
    animation: imgTierRunes 9.2s ease-in-out infinite alternate;
}

@keyframes imgTierSmoke {
    0% { transform: translate3d(0,0,0) scale(1); }
    50% { transform: translate3d(-1px,0,0) scale(1.005); }
    100% { transform: translate3d(0,0,0) scale(1); }
}

.anim-tier-2-smoke {
    animation: imgTierSmoke 11.2s ease-in-out infinite;
}

@keyframes imgTierCrownTide {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-tier-2-crown {
    animation: imgTierCrownTide 8.4s ease-in-out infinite alternate;
}

@keyframes imgTierRadiance {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-tier-2-radiance {
    animation: imgTierRadiance 7.6s ease-in-out infinite alternate;
}

@keyframes imgTierDeepChaos {
    0% { transform: scale(1); }
    50% { transform: scale(1.006); }
    100% { transform: scale(1); }
}

.anim-tier-2-chaos {
    animation: imgTierDeepChaos 13.6s linear infinite;
}

@keyframes drifterHeat {
    0% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(-1px, 0, 0); }
    100% { transform: translate3d(0, 0, 0); }
}

.anim-DRIFTER { animation: drifterHeat 16s ease-in-out infinite; }

@keyframes merchantShine {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.005); }
}

.anim-MERCHANT { animation: merchantShine 10s ease-in-out infinite; }

@keyframes engineerGlitch {
    0%, 92% { transform: translate3d(0,0,0); }
    94% { transform: translate3d(2px,0,0); }
    96% { transform: translate3d(-2px,0,0); }
    100% { transform: translate3d(0,0,0); }
}

.anim-ENGINEER { animation: engineerGlitch 8s linear infinite; }

@keyframes shamanPulse {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-SHAMAN { animation: shamanPulse 12s ease-in-out infinite alternate; }

@keyframes keeperEternal {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-KEEPER { animation: keeperEternal 16s ease-in-out infinite alternate; }

@keyframes walkerShift {
    0%, 100% { transform: translate3d(0,0,0); }
    50% { transform: translate3d(0,-1px,0); }
}

.anim-WALKER { animation: walkerShift 12s ease-in-out infinite; }

@keyframes lordTide {
    0% { transform: scale(1); }
    100% { transform: scale(1.005); }
}

.anim-LORD { animation: lordTide 18s ease-in-out infinite alternate; }

@keyframes primeRadiance {
    0% { transform: scale(1); }
    100% { transform: scale(1.006); }
}

.anim-PRIME { animation: primeRadiance 10s ease-in-out infinite alternate; }

@keyframes singularityChaos {
    0% { transform: scale(1); }
    50% { transform: scale(1.006); }
    100% { transform: scale(1); }
}

.anim-SINGULARITY { animation: singularityChaos 20s linear infinite; }

.overlay-DRIFTER,
.overlay-WALKER,
.overlay-MERCHANT,
.overlay-ENGINEER,
.overlay-SHAMAN,
.overlay-KEEPER,
.overlay-LORD,
.overlay-PRIME,
.overlay-SINGULARITY {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 32px;
}

.overlay-DRIFTER::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(ellipse at 50% 20%, rgba(255, 160, 0, 0.12) 0%, transparent 55%),
        linear-gradient(120deg, transparent 0%, rgba(255, 200, 120, 0.12) 30%, transparent 45%, rgba(255, 160, 0, 0.10) 60%, transparent 75%);
    background-size: 100% 100%, 220% 220%;
    animation: sandDrift 14.4s ease-in-out infinite;
    mix-blend-mode: overlay;
}

.overlay-DRIFTER::after {
    content: '';
    position: absolute;
    inset: -10%;
    background-image:
        radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.12) 1px, transparent 1px),
        radial-gradient(circle at 70% 60%, rgba(255, 255, 255, 0.10) 1px, transparent 1px),
        radial-gradient(circle at 40% 80%, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
    background-size: 160px 160px;
    animation: sandParticles 11.6s linear infinite;
    opacity: 0.45;
    mix-blend-mode: screen;
    filter: blur(0.2px);
}

@keyframes sandDrift {
    0%, 100% { background-position: 0% 50%; opacity: 0.5; }
    50% { background-position: 100% 50%; opacity: 0.8; }
}

@keyframes sandParticles {
    0% { transform: translate3d(0, 0, 0) rotate(0deg); }
    100% { transform: translate3d(-22px, 14px, 0) rotate(2deg); }
}

.overlay-WALKER::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(ellipse at 50% 50%, rgba(0, 229, 255, 0.16) 0%, transparent 60%),
        radial-gradient(ellipse at 20% 30%, rgba(138, 43, 226, 0.10) 0%, transparent 62%),
        linear-gradient(135deg, rgba(0, 229, 255, 0.10), transparent 62%);
    background-size: 140% 140%, 160% 160%, 220% 220%;
    animation: timeFlow 12.4s ease-in-out infinite;
    mix-blend-mode: screen;
}

.overlay-WALKER::after {
    content: '';
    position: absolute;
    inset: -30%;
    background:
        conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(138, 43, 226, 0.14) 90deg, transparent 180deg, rgba(0, 229, 255, 0.12) 270deg, transparent 360deg);
    animation: timeWheel 22s linear infinite;
    mix-blend-mode: overlay;
    filter: blur(1.2px);
    opacity: 0.35;
}

@keyframes timeFlow {
    0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.45; }
    50% { transform: translate3d(-18px, 6px, 0); opacity: 0.75; }
}

@keyframes timeWheel {
    0% { transform: rotate(0deg) scale(1); }
    100% { transform: rotate(360deg) scale(1.02); }
}

.overlay-MERCHANT::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 80px;
    height: 100%;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.40) 50%, transparent 100%);
    animation: goldShine 11.2s ease-in-out infinite;
    transform: skewX(-20deg);
    mix-blend-mode: screen;
}

.overlay-MERCHANT::after {
    content: '';
    position: absolute;
    inset: -12%;
    background-image:
        radial-gradient(circle at 25% 25%, rgba(255, 215, 0, 0.25) 1px, transparent 1px),
        radial-gradient(circle at 70% 40%, rgba(255, 255, 255, 0.18) 1px, transparent 1px),
        radial-gradient(circle at 55% 75%, rgba(255, 215, 0, 0.20) 1px, transparent 1px);
    background-size: 140px 140px;
    animation: merchantSparks 8.4s linear infinite;
    opacity: 0.65;
    mix-blend-mode: screen;
}

@keyframes goldShine {
    0% { left: -100%; opacity: 0; }
    50% { opacity: 1; }
    100% { left: 100%; opacity: 0; }
}

@keyframes merchantSparks {
    0% { transform: translate3d(0, 0, 0) rotate(0deg); }
    100% { transform: translate3d(-18px, 12px, 0) rotate(6deg); }
}

.overlay-ENGINEER::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 170, 0.08) 2px, rgba(0, 255, 170, 0.08) 4px),
        repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255, 0, 80, 0.07) 2px, rgba(255, 0, 80, 0.07) 4px);
    animation: circuitPulse 7.2s ease-in-out infinite, glitchShift 10.4s ease-in-out infinite;
    mix-blend-mode: overlay;
}

.overlay-ENGINEER::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
        repeating-linear-gradient(180deg, transparent 0px, rgba(0, 255, 170, 0.12) 1px, transparent 2px, transparent 8px),
        linear-gradient(180deg, rgba(0, 255, 170, 0.0), rgba(0, 255, 170, 0.10), rgba(255, 0, 80, 0.0));
    opacity: 0.60;
    mix-blend-mode: screen;
    animation: scanLines 17s linear infinite;
}

@keyframes circuitPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
}

@keyframes glitchShift {
    0%, 90%, 100% { transform: translate(0, 0); filter: hue-rotate(0deg); }
    91% { transform: translate(-2px, 1px); filter: hue-rotate(5deg); }
    93% { transform: translate(2px, -1px); filter: hue-rotate(-5deg); }
    95% { transform: translate(-1px, 2px); filter: hue-rotate(3deg); }
}

@keyframes scanLines {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
}

.overlay-SHAMAN::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 35% 65%, rgba(138, 43, 226, 0.26) 0%, rgba(138, 43, 226, 0.0) 55%);
    animation: spiritSmoke 13.6s ease-in-out infinite;
    mix-blend-mode: screen;
}

.overlay-SHAMAN::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(ellipse at 70% 30%, rgba(147, 112, 219, 0.22) 0%, rgba(147, 112, 219, 0.0) 60%),
        radial-gradient(circle at 50% 50%, rgba(0, 229, 255, 0.08) 0%, transparent 55%);
    animation: spiritSmoke 13.6s ease-in-out infinite 0.7s;
    mix-blend-mode: overlay;
    filter: blur(0.4px);
}

@keyframes spiritSmoke {
    0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.35; }
    50% { transform: translate3d(-10px, -6px, 0) scale(1.06); opacity: 0.75; }
    100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.35; }
}

.overlay-KEEPER::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 30% 40%, rgba(186, 85, 211, 0.22) 0%, transparent 42%),
        radial-gradient(circle at 70% 60%, rgba(138, 43, 226, 0.18) 0%, transparent 38%),
        repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.0) 0px, rgba(255, 255, 255, 0.06) 24px, rgba(255, 255, 255, 0.0) 48px);
    animation: runeGlow 9.2s ease-in-out infinite;
    mix-blend-mode: screen;
}

.overlay-KEEPER::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        radial-gradient(circle at 18% 30%, rgba(255, 255, 255, 0.16) 2px, transparent 2px),
        radial-gradient(circle at 48% 42%, rgba(255, 255, 255, 0.14) 2px, transparent 2px),
        radial-gradient(circle at 76% 28%, rgba(255, 255, 255, 0.12) 2px, transparent 2px),
        radial-gradient(circle at 64% 72%, rgba(255, 255, 255, 0.14) 2px, transparent 2px);
    background-size: 180px 180px;
    animation: runeFloat 13s ease-in-out infinite;
    opacity: 0.55;
    mix-blend-mode: overlay;
}

@keyframes runeGlow {
    0%, 100% { opacity: 0.4; filter: hue-rotate(0deg); }
    50% { opacity: 0.7; filter: hue-rotate(15deg); }
}

@keyframes runeFloat {
    0% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(-8px, 10px, 0); }
    100% { transform: translate3d(0, 0, 0); }
}

.overlay-LORD::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        linear-gradient(0deg, rgba(255, 215, 0, 0.35) 0%, rgba(255, 215, 0, 0.0) 60%),
        repeating-linear-gradient(0deg, transparent 0%, rgba(255, 215, 0, 0.0) 45%, rgba(255, 215, 0, 0.20) 50%, rgba(255, 215, 0, 0.0) 55%, transparent 100%),
        conic-gradient(from 0deg at 50% 85%, transparent 0deg, rgba(255, 215, 0, 0.22) 30deg, transparent 60deg, rgba(255, 215, 0, 0.22) 120deg, transparent 150deg, rgba(255, 215, 0, 0.22) 210deg, transparent 240deg, rgba(255, 215, 0, 0.22) 300deg, transparent 330deg);
    animation: crownTide 18.8s ease-in-out infinite;
    mix-blend-mode: screen;
}

.overlay-LORD::after {
    content: '';
    position: absolute;
    inset: -18%;
    background: radial-gradient(ellipse at 50% 100%, rgba(255, 215, 0, 0.22) 0%, transparent 60%);
    animation: crownAura 11.2s ease-in-out infinite;
    mix-blend-mode: overlay;
    filter: blur(0.6px);
}

@keyframes crownTide {
    0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0.42; }
    50% { transform: translate3d(0, -6px, 0) rotate(10deg); opacity: 0.74; }
}

@keyframes crownAura {
    0%, 100% { opacity: 0.35; transform: scale(0.95); }
    50% { opacity: 0.75; transform: scale(1.05); }
}

.overlay-PRIME::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.24) 0%, transparent 55%),
        conic-gradient(from 0deg at 50% 50%, rgba(255, 255, 255, 0.0), rgba(255, 255, 255, 0.18), rgba(255, 215, 0, 0.12), rgba(0, 229, 255, 0.14), rgba(255, 255, 255, 0.0));
    animation: godRays 16s linear infinite;
    mix-blend-mode: screen;
}

.overlay-PRIME::after {
    content: '';
    position: absolute;
    inset: -30%;
    background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.20) 0%, transparent 55%);
    animation: radiancePulse 7.2s ease-in-out infinite;
    mix-blend-mode: overlay;
    filter: blur(0.8px);
}

@keyframes godRays {
    0% { transform: rotate(0deg) scale(1); opacity: 0.55; }
    50% { opacity: 0.78; }
    100% { transform: rotate(360deg) scale(1.02); opacity: 0.55; }
}

@keyframes radiancePulse {
    0%, 100% { opacity: 0.35; transform: scale(0.92); }
    50% { opacity: 0.80; transform: scale(1.08); }
}

.overlay-SINGULARITY::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        conic-gradient(from 0deg at 50% 50%, rgba(138, 43, 226, 0.0), rgba(138, 43, 226, 0.28), rgba(0, 229, 255, 0.22), rgba(255, 215, 0, 0.18), rgba(255, 0, 170, 0.20), rgba(138, 43, 226, 0.0));
    animation: none;
    mix-blend-mode: screen;
    filter: invert(0.15) hue-rotate(180deg);
}

.overlay-SINGULARITY::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.25) 0%, transparent 30%, rgba(255, 255, 255, 0.18) 42%, transparent 56%),
        repeating-radial-gradient(circle at 50% 50%, transparent 0%, rgba(255, 255, 255, 0.06) 15%, transparent 30%);
    animation: cosmicPulse 14s ease-in-out infinite;
    mix-blend-mode: difference;
    filter: hue-rotate(90deg);
}

@keyframes cosmicPulse {
    0%, 100% { transform: scale(0.9); opacity: 0.4; }
    50% { transform: scale(1.1); opacity: 0.8; }
}

.card-object[data-tier='3'] .overlay-SINGULARITY::after {
    filter: hue-rotate(180deg);
}

.glass-module {
    background: linear-gradient(180deg, hsl(var(--glass-white) / 0.08) 0%, hsl(var(--glass-white) / 0.03) 100%);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border: 1px solid hsl(var(--glass-white) / 0.12);
    border-radius: calc(var(--radius) * 0.8);
}

.inner-glow {
    box-shadow: inset 0 0 80px hsl(var(--card-accent) / 0.08), inset 0 1px 0 hsl(var(--glass-white) / 0.1), 0 25px 60px -15px hsl(0 0% 0% / 0.8);
}

@keyframes soulDividerBeat {
    0%, 100% {
        opacity: 0.8;
        box-shadow: none;
    }
    50% {
        opacity: 1;
        box-shadow: none;
    }
}

@keyframes laser-flow {
    0% { background-position: 0% 50%; }
    100% { background-position: 300% 50%; }
}

@keyframes holo-shimmer {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
}

@keyframes pulse-glow {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.1); }
}
.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }

@keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(1.12); }
}
.animate-pulse { animation: pulse 1.6s ease-in-out infinite; }

.neon-text {
    text-shadow: 0 0 12px hsl(var(--fennec-orange) / 0.9), 0 0 35px hsl(var(--fennec-orange) / 0.6);
}
.neon-text-subtle {
    text-shadow: 0 0 10px hsl(var(--fennec-orange) / 0.6);
}

.holo-text {
    background: linear-gradient(90deg, hsl(var(--holo-cyan)), hsl(var(--holo-purple)), hsl(var(--fennec-orange)), hsl(var(--holo-cyan)));
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: holo-shimmer 3s linear infinite;
}

.text-fennec { color: hsl(var(--fennec-orange)); }
.font-tactical { font-family: var(--font-tactical); letter-spacing: 0.05em; }
.font-display { font-family: var(--font-display); }

.stat-glow {
    color: hsl(var(--foreground));
    text-shadow: 0 0 22px hsl(var(--fennec-orange) / 0.5);
}

.net-worth-display {
    font-size: clamp(2.2rem, 4.6vw, 3.2rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    color: hsl(var(--foreground));
    text-shadow: 0 0 48px hsl(var(--card-accent) / 0.45);
}

.laser-track {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: hsl(var(--secondary) / 0.35);
    border: 1px solid hsl(var(--glass-white) / 0.10);
}

.laser-fill {
    height: 100%;
    background: linear-gradient(90deg, hsl(var(--card-accent)), hsl(var(--card-accent2)), hsl(var(--card-accent)));
    background-size: 300% 100%;
    animation: laser-flow 2.4s linear infinite;
    box-shadow: 0 0 18px hsl(var(--card-accent) / 0.45);
}

.badge-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}

.custom-scroll { scrollbar-width: thin; scrollbar-color: hsl(var(--fennec-orange) / 0.9) transparent; }
.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-thumb {
    background: hsl(var(--fennec-orange) / 0.85);
    border-radius: 999px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--fennec-orange) / 1);
}
.custom-scroll::-webkit-scrollbar-track {
    background: transparent;
    margin: 14px 0;
}

.badge-hover-container:hover {
    transform: translateY(-2px);
    border-color: hsl(var(--fennec-orange) / 0.5) !important;
    box-shadow: 0 4px 12px hsl(var(--fennec-orange) / 0.3);
}

.badge-hover-container {
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}


.badge-hover-container:hover .badge-hover-name {
    opacity: 1;
}

.badge-slot {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 8px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transform: translateZ(0);
    transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.badge-slot::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.02) 35%, transparent 70%);
    opacity: 0.75;
}

.badge-slot::after {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: 7px;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    opacity: 0.9;
}

.badge-icon {
    width: 78%;
    height: 78%;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
    position: relative;
    z-index: 1;
}

.badge-slot:hover {
    transform: translateY(-2px);
    border-color: #FF6B35;
    background: rgba(0, 0, 0, 0.52);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 8px 18px rgba(0, 0, 0, 0.38), 0 0 18px rgba(255, 107, 53, 0.22);
}

.badge-slot:hover .badge-icon {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.65)) drop-shadow(0 0 10px rgba(255, 107, 53, 0.35));
}

.badge-slot:hover .badge-hover-name {
    opacity: 1;
}

.absolute { position: absolute; }
.relative { position: relative; }
.inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
.z-0 { z-index: 0; }
.z-10 { z-index: 10; }
.z-20 { z-index: 20; }
.z-\\[100\\] { z-index: 100; }

.flex { display: flex; }
.flex-1 { flex: 1 1 0%; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.gap-1 { gap: 0.25rem; }
.gap-1\\.5 { gap: 0.375rem; }
.gap-2 { gap: 0.5rem; }
.space-y-3 > * + * { margin-top: 0.75rem; }

.w-full { width: 100%; }
.w-2 { width: 0.5rem; }
.h-2 { height: 0.5rem; }
.w-10 { width: 2.5rem; }
.h-10 { height: 2.5rem; }
.w-48 { width: 12rem; }
.h-48 { height: 12rem; }
.h-px { height: 1px; }

.rounded-full { border-radius: 9999px; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }
.rounded-\\[22px\\] { border-radius: 22px; }

.p-1 { padding: 0.25rem; }
.p-3 { padding: 0.75rem; }
.p-4 { padding: 1rem; }
.p-5 { padding: 1.25rem; }
.p-6 { padding: 1.5rem; }
.px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
.px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
.py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
.py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.pb-6 { padding-bottom: 1.5rem; }
.pb-8 { padding-bottom: 2rem; }

.mt-auto { margin-top: auto; }
.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }
.mb-0\\.5 { margin-bottom: 0.125rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-1\\.5 { margin-bottom: 0.375rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }
.ml-auto { margin-left: auto; }
.mx-auto { margin-left: auto; margin-right: auto; }

.text-center { text-align: center; }
.text-right { text-align: right; }
.uppercase { text-transform: uppercase; }
.italic { font-style: italic; }
.font-black { font-weight: 900; }
.font-bold { font-weight: 700; }

.text-7xl { font-size: 4.5rem; line-height: 1; }
.text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
.text-2xl { font-size: 1.5rem; line-height: 2rem; }
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-xs { font-size: 0.75rem; line-height: 1rem; }
.text-\\[11px\\] { font-size: 11px; line-height: 1.3; }
.text-\\[10px\\] { font-size: 10px; line-height: 1.3; }
.text-\\[9px\\] { font-size: 9px; line-height: 1.2; }
.text-\\[8px\\] { font-size: 8px; line-height: 1.2; }

.tracking-\\[0\\.25em\\] { letter-spacing: 0.25em; }
.tracking-\\[0\\.2em\\] { letter-spacing: 0.2em; }
.tracking-\\[0\\.15em\\] { letter-spacing: 0.15em; }
.tracking-wider { letter-spacing: 0.08em; }
.tracking-widest { letter-spacing: 0.12em; }
.tracking-tight { letter-spacing: -0.025em; }
.leading-none { line-height: 1; }

.overflow-hidden { overflow: hidden; }
.overflow-y-auto { overflow-y: auto; }
.pointer-events-none { pointer-events: none; }
.select-none { user-select: none; }
.object-contain { object-fit: contain; }

.text-muted-foreground { color: hsl(var(--muted-foreground)); }
.text-foreground\\/80 { color: hsl(var(--foreground) / 0.8); }
.text-foreground\\/70 { color: hsl(var(--foreground) / 0.7); }
.opacity-40 { opacity: 0.4; }
.opacity-60 { opacity: 0.6; }
.opacity-\\[0\\.03\\] { opacity: 0.03; }

.border { border-width: 1px; border-style: solid; }
.border-b { border-bottom-width: 1px; }
.border-border\\/30 { border-color: hsl(var(--border) / 0.3); }
.border-fennec\\/20 { border-color: hsl(var(--fennec-orange) / 0.2); }
.border-fennec\\/30 { border-color: hsl(var(--fennec-orange) / 0.3); }
.border-fennec\\/40 { border-color: hsl(var(--fennec-orange) / 0.4); }

.bg-black\\/60 { background: rgba(0,0,0,0.6); }
.bg-fennec { background: hsl(var(--fennec-orange)); }
.bg-fennec\\/10 { background: hsl(var(--fennec-orange) / 0.1); }
.bg-fennec\\/20 { background: hsl(var(--fennec-orange) / 0.2); }
.bg-secondary\\/30 { background: hsl(var(--secondary) / 0.3); }

.bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-from), var(--tw-gradient-to)); }
.bg-gradient-to-b { background-image: linear-gradient(to bottom, var(--tw-gradient-from), var(--tw-gradient-to)); }
.bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-from), var(--tw-gradient-to)); }
.bg-gradient-radial { background-image: radial-gradient(circle at center, var(--tw-gradient-from), var(--tw-gradient-to)); }

.from-transparent { --tw-gradient-from: transparent; }
.to-transparent { --tw-gradient-to: transparent; }
.from-obsidian-light\\/50 { --tw-gradient-from: hsl(var(--obsidian-light) / 0.5); }
.from-obsidian-light\\/80 { --tw-gradient-from: hsl(var(--obsidian-light) / 0.8); }
.to-background { --tw-gradient-to: hsl(var(--background)); }
.to-background\\/90 { --tw-gradient-to: hsl(var(--background) / 0.9); }
.from-fennec\\/20 { --tw-gradient-from: hsl(var(--fennec-orange) / 0.2); }
.via-fennec\\/5 { --tw-gradient-via: hsl(var(--fennec-orange) / 0.05); }
.to-fennec\\/5 { --tw-gradient-to: hsl(var(--fennec-orange) / 0.05); }
.via-fennec\\/50 { --tw-gradient-via: hsl(var(--fennec-orange) / 0.5); }
.from-fennec { --tw-gradient-from: hsl(var(--fennec-orange)); }
.to-holo-purple { --tw-gradient-to: hsl(var(--holo-purple)); }
`;
        document.head.appendChild(style);
    }

    function clamp(n, a, b) {
        const x = Number(n);
        if (!Number.isFinite(x)) return a;
        return Math.max(a, Math.min(b, x));
    }

    function rarityFromScore(score) {
        const s = clamp(Number(score) || 0, 0, 100);
        if (s >= 95) return { name: 'SPIRIT', key: 'spirit', text: 'text-spirit' };
        if (s >= 80) return { name: 'ELDER', key: 'elder', text: 'text-elder' };
        if (s >= 65) return { name: 'ALPHA', key: 'alpha', text: 'text-alpha' };
        if (s >= 50) return { name: 'HUNTER', key: 'hunter', text: 'text-hunter' };
        if (s >= 30) return { name: 'SCOUT', key: 'scout', text: 'text-scout' };
        return { name: 'CUB', key: 'cub', text: 'text-cub' };
    }

    function rarityFromName(name) {
        const n = String(name || '')
            .trim()
            .toUpperCase();
        if (!n) return null;
        if (n === 'SPIRIT') return { name: 'SPIRIT', key: 'spirit', text: 'text-spirit' };
        if (n === 'ELDER') return { name: 'ELDER', key: 'elder', text: 'text-elder' };
        if (n === 'ALPHA') return { name: 'ALPHA', key: 'alpha', text: 'text-alpha' };
        if (n === 'HUNTER') return { name: 'HUNTER', key: 'hunter', text: 'text-hunter' };
        if (n === 'SCOUT') return { name: 'SCOUT', key: 'scout', text: 'text-scout' };
        if (n === 'CUB') return { name: 'CUB', key: 'cub', text: 'text-cub' };
        return null;
    }

    function resolveRarity(metrics, activityScore) {
        const m = metrics && typeof metrics === 'object' ? metrics : {};
        const fromMetrics = rarityFromName(m.rarityName ?? m.rarity ?? m.rarity_name ?? m.rarityKey ?? m.rarity_key);
        return fromMetrics || rarityFromScore(activityScore);
    }

    function inferArchetypeFromConditions(badges, metrics) {
        const badgeSet = new Set(
            (Array.isArray(badges) ? badges : [])
                .map(b =>
                    String((b && b.name) || '')
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        );

        const safeNum = v => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };

        const m = metrics && typeof metrics === 'object' ? metrics : {};
        const txCount = safeNum(m.txCount ?? m.txs ?? m.transactions ?? m.transactionCount);
        const netWorthUSD = safeNum(m.netWorthUSD ?? m.wealth ?? m.netWorth ?? m.netWorthUsd);
        const lpValueUSD = safeNum(m.lpValueUSD ?? m.lpValueUsd);

        let stats = {};
        if (m.inscriptionStats && typeof m.inscriptionStats === 'object') stats = m.inscriptionStats;
        else if (m.stats && typeof m.stats === 'object') stats = m.stats;
        const runesCount = safeNum(stats.runes ?? stats.runesCount ?? m.runesCount ?? m.runes);

        const badgeCount = badgeSet.size;

        if (badgeCount >= 7) return 'SINGULARITY';
        if (badgeSet.has('GENESIS') && badgeSet.has('WHALE') && badgeSet.has('PROVIDER')) return 'PRIME';
        if (badgeSet.has('PROVIDER') && lpValueUSD >= 200) return 'LORD';
        if (badgeSet.has('GENESIS')) return 'WALKER';
        if (badgeSet.has('ARTIFACT HUNTER') && badgeSet.has('RUNE KEEPER')) return 'KEEPER';
        if (netWorthUSD >= 100) return 'MERCHANT';
        if (txCount > 1000) return 'ENGINEER';
        if (runesCount >= 20) return 'SHAMAN';
        return 'DRIFTER';
    }

    function pickArchetype(dna, ctx) {
        const a = dna && typeof dna === 'object' ? dna.archetype : null;
        const hasExplicit = !!(a && (a.baseKey || a.key));

        const inferredKey = hasExplicit
            ? String(a.baseKey || a.key || 'DRIFTER').toUpperCase()
            : inferArchetypeFromConditions(ctx && ctx.badges, ctx && ctx.metrics);

        const baseKey = inferredKey || 'DRIFTER';
        const title = (hasExplicit && (a.title || a.name)) || baseKey;
        const tierLabel = (hasExplicit && (a.tierLabel || a.tier)) || (dna && dna.tier) || '';
        const tierLevel = (hasExplicit && (a.tierLevel || a.level)) || (dna && dna.tierLevel) || 0;
        return {
            baseKey: String(baseKey || 'DRIFTER').toUpperCase(),
            title: String(title || 'DRIFTER'),
            tierLabel: String(tierLabel || ''),
            tierLevel: clamp(tierLevel, 0, 3)
        };
    }

    const BADGE_DEFS = {
        GENESIS: { name: 'GENESIS', icon: '', desc: 'You witnessed the first sunrise over the Fractal dunes.' },
        WHALE: { name: 'WHALE', icon: '', desc: 'When you move, the sands shift beneath you.' },
        PROVIDER: { name: 'PROVIDER', icon: '', desc: 'The desert is thirsty, but your well runs deep.' },
        'LIQUIDITY PROVIDER': { name: 'PROVIDER', icon: '', desc: 'The desert is thirsty, but your well runs deep.' },
        LIQUIDITY_PROVIDER: { name: 'PROVIDER', icon: '', desc: 'The desert is thirsty, but your well runs deep.' },
        'FENNEC MAXI': { name: 'FENNEC MAXI', icon: '', desc: 'The Spirit of the Fox guides your path.' },
        'ARTIFACT HUNTER': {
            name: 'ARTIFACT HUNTER',
            icon: '',
            desc: 'Your pockets are heavy with echoes of the chain.'
        },
        'RUNE KEEPER': { name: 'RUNE KEEPER', icon: '', desc: 'You decipher the glyphs. The stones speak to you.' },
        'MEMPOOL RIDER': { name: 'MEMPOOL RIDER', icon: '', desc: 'Surfing the chaos of the 30-second block waves.' },
        'SAND SWEEPER': {
            name: 'SAND SWEEPER',
            icon: '',
            desc: 'Your UTXO set is clean. No trash left in the dunes.'
        }
    };

    const BADGE_ORDER = [
        'GENESIS',
        'WHALE',
        'PROVIDER',
        'FENNEC MAXI',
        'ARTIFACT HUNTER',
        'RUNE KEEPER',
        'MEMPOOL RIDER',
        'SAND SWEEPER'
    ];

    function normalizeBadges(dna) {
        const arr = (dna && dna.badges) || (dna && dna.archetype && dna.archetype.badges) || [];
        if (!Array.isArray(arr)) return [];
        return arr
            .map(b => {
                if (!b) return null;
                if (typeof b === 'string') {
                    const key = String(b || '')
                        .trim()
                        .toUpperCase();
                    const def = BADGE_DEFS[key] || null;
                    return {
                        name: def ? def.name : String(b || '').trim(),
                        desc: def ? def.desc : '',
                        icon: '',
                        img: ''
                    };
                }
                const rawName = String(b.name || '').trim();
                const key = rawName.toUpperCase();
                const def = BADGE_DEFS[key] || null;
                const desc = String(b.desc || '').trim() || (def ? def.desc : '');
                return { name: def ? def.name : rawName, desc, icon: '', img: b.img ? String(b.img) : '' };
            })
            .filter(Boolean)
            .filter(b => b.name);
    }

    function computeScoreBreakdown(metrics, badges, config) {
        const safeNum = v => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };

        const scoring = config && config.scoring && typeof config.scoring === 'object' ? config.scoring : {};
        const pointsCfg = scoring.points && typeof scoring.points === 'object' ? scoring.points : {};

        const activityMax = safeNum(pointsCfg.activityMax ?? 30) || 30;
        const wealthMax = safeNum(pointsCfg.wealthMax ?? 20) || 20;
        const timeMax = safeNum(pointsCfg.timeMax ?? 15) || 15;
        const badgesMax = safeNum(pointsCfg.badgesMax ?? 35) || 35;

        const activityCfg = scoring.activity && typeof scoring.activity === 'object' ? scoring.activity : {};
        const wealthCfg = scoring.wealth && typeof scoring.wealth === 'object' ? scoring.wealth : {};
        const timeCfg = scoring.time && typeof scoring.time === 'object' ? scoring.time : {};

        const maxTx = safeNum(activityCfg.maxTx ?? 10000) || 10000;
        const maxNetWorthUSD = safeNum(wealthCfg.maxNetWorthUSD ?? 500) || 500;
        const maxDays = safeNum(timeCfg.maxDays ?? 365) || 365;

        const txCount = safeNum(metrics && metrics.txCount);
        const daysAlive = safeNum(metrics && metrics.daysAlive);
        const netWorthUSD = safeNum(
            metrics && (metrics.netWorthUSD ?? metrics.wealth ?? metrics.netWorth ?? metrics.netWorthUsd)
        );

        const txClamped = Math.min(txCount, maxTx);
        const activityPoints = Math.round(activityMax * (Math.log10(1 + txClamped) / Math.log10(1 + maxTx)));

        const nwClamped = Math.min(netWorthUSD, maxNetWorthUSD);
        const wealthPoints = Math.round(wealthMax * Math.sqrt(maxNetWorthUSD ? nwClamped / maxNetWorthUSD : 0));

        const daysClamped = Math.min(daysAlive, maxDays);
        const timePoints = Math.round(timeMax * (maxDays ? daysClamped / maxDays : 0));

        const badgeDefs = Array.isArray(scoring.badgeDefinitions) ? scoring.badgeDefinitions : [];
        const weightMap = {};
        badgeDefs.forEach(def => {
            if (!def || typeof def !== 'object') return;
            const name = String(def.name || '').trim();
            if (!name) return;
            weightMap[name.toUpperCase()] = safeNum(def.weight);
        });

        const badgesArr = Array.isArray(badges) ? badges : [];
        const badgesPointsRaw = badgesArr.reduce((sum, b) => {
            const key = String((b && b.name) || '')
                .trim()
                .toUpperCase();
            return sum + (weightMap[key] || 0);
        }, 0);
        const badgesPoints = Math.min(badgesMax, badgesPointsRaw);

        const baseScoreRaw = activityPoints + wealthPoints + timePoints + badgesPoints;
        const baseScore = Math.min(100, baseScoreRaw);

        const hasMaxi = badgesArr.some(
            b =>
                String((b && b.name) || '')
                    .trim()
                    .toUpperCase() === 'FENNEC MAXI'
        );
        const multiplier = hasMaxi ? 1.15 : 1;
        const scoreAfterMultiplier = baseScore * multiplier;
        const activityScore = Math.min(100, Math.round(scoreAfterMultiplier));

        return {
            activityPoints,
            wealthPoints,
            timePoints,
            badgesPoints,
            baseScore,
            multiplier,
            scoreAfterMultiplier,
            activityScore,
            max: { activityMax, wealthMax, timeMax, badgesMax }
        };
    }

    function safeText(s) {
        return String(s || '').replace(/[<>&]/g, c => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
    }

    function miscAssetRef(config, key, fallbackPath) {
        const map = config && config.assets && config.assets.misc ? config.assets.misc : {};
        const ref = (map && map[key]) || '';
        return resolveAssetRef(ref || fallbackPath || '');
    }

    function backgroundFor(archetypeKey, tier, config) {
        const key = String(archetypeKey || 'DRIFTER').toUpperCase();
        const map = config && config.assets && config.assets.backgrounds ? config.assets.backgrounds : {};
        const t = typeof tier === 'number' && Number.isFinite(tier) ? clamp(tier, 0, 3) : null;
        const tierKey = t === null ? '' : `${key}_T${t}`;
        const idOrUrl = (tierKey && map[tierKey]) || map[key] || map['*'] || '';
        return idOrUrl ? String(idOrUrl) : '';
    }

    function createCard(dna, config) {
        injectStyles();

        const metrics = dna && dna.metrics && typeof dna.metrics === 'object' ? dna.metrics : {};

        const badges = normalizeBadges(dna);
        try {
            const safeNum = v => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            const lpValueUSD = safeNum(metrics && (metrics.lpValueUSD ?? metrics.lpValueUsd));
            const badgeKeys = new Set(
                badges
                    .map(b =>
                        String((b && b.name) || '')
                            .trim()
                            .toUpperCase()
                    )
                    .filter(Boolean)
            );
            if (lpValueUSD >= 50 && !badgeKeys.has('PROVIDER')) {
                badges.push({
                    name: 'PROVIDER',
                    desc: (BADGE_DEFS.PROVIDER && BADGE_DEFS.PROVIDER.desc) || '',
                    icon: '',
                    img: ''
                });
            }
        } catch (_) {
            void _;
        }
        const earnedBadgeCount = new Set(
            badges
                .map(b =>
                    String((b && b.name) || '')
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        ).size;
        const archetype = pickArchetype(dna, { badges, metrics });
        const computedBreakdown = computeScoreBreakdown(metrics, badges, config);
        const activityScore =
            Number(metrics.activityScore ?? metrics.score ?? computedBreakdown.activityScore ?? 0) || 0;
        const rarity = resolveRarity(metrics, activityScore);

        let tier =
            typeof archetype.tierLevel === 'number' && Number.isFinite(archetype.tierLevel) ? archetype.tierLevel : 0;
        tier = clamp(tier, 0, 3);
        if (
            String(archetype.baseKey || '').toUpperCase() === 'PRIME' ||
            String(archetype.baseKey || '').toUpperCase() === 'SINGULARITY'
        ) {
            tier = 3;
        } else {
            tier = earnedBadgeCount >= 6 ? 3 : earnedBadgeCount >= 4 ? 2 : earnedBadgeCount >= 2 ? 1 : tier;
        }

        const bgRef = backgroundFor(archetype.baseKey, tier, config);
        const bgUrl = bgRef ? resolveAssetRef(bgRef) : '';

        const scene = document.createElement('div');
        scene.className = 'card-scene';
        scene.setAttribute('data-fennec-lib-root', '1');

        const cardObject = document.createElement('div');
        cardObject.className = 'card-object';
        if (metrics.hasFennecSoul) cardObject.classList.add('card-soul');

        let tierColor = 'hsl(240 4% 46%)';
        if (rarity.key === 'spirit') tierColor = 'hsl(var(--holo-purple))';
        else if (rarity.key === 'elder') tierColor = 'hsl(var(--fennec-orange))';
        else if (rarity.key === 'hunter') tierColor = 'hsl(var(--holo-blue))';

        cardObject.style.border = 'none';

        cardObject.setAttribute('data-tier', String(tier));

        cardObject.setAttribute('data-archetype', String(archetype.baseKey || ''));

        cardObject.setAttribute('data-rarity', String(rarity.key || ''));
        cardObject.classList.add(`card-${rarity.key}`);

        const outerBorder = document.createElement('div');
        outerBorder.className = 'card-outer-border';
        cardObject.appendChild(outerBorder);

        const borderGlow = document.createElement('div');
        borderGlow.className = 'card-border-glow';
        cardObject.appendChild(borderGlow);

        let accentVar = '240 5% 62%';
        let accent2Var = '240 5% 70%';
        if (rarity.key === 'spirit') {
            accentVar = 'var(--holo-cyan)';
            accent2Var = 'var(--holo-purple)';
        } else if (rarity.key === 'elder') {
            accentVar = '43 74% 52%';
            accent2Var = '38 88% 60%';
        } else if (rarity.key === 'alpha') {
            accentVar = '0 100% 55%';
            accent2Var = '8 100% 62%';
        } else if (rarity.key === 'hunter') {
            accentVar = '196 100% 55%';
            accent2Var = '210 100% 60%';
        } else if (rarity.key === 'scout') {
            accentVar = '142 100% 50%';
            accent2Var = '150 100% 56%';
        }
        try {
            cardObject.style.setProperty('--card-accent', accentVar);
            cardObject.style.setProperty('--card-accent2', accent2Var);
        } catch (_) {
            void _;
        }

        let titleAccentVar = '240 5% 62%';
        if (tier >= 3) titleAccentVar = 'var(--fennec-orange)';
        else if (tier === 2) titleAccentVar = 'var(--holo-cyan)';
        else if (tier === 1) titleAccentVar = '142 100% 50%';

        let titleAccent2Var = '240 5% 70%';
        if (tier >= 3) titleAccent2Var = 'var(--holo-purple)';
        else if (tier === 2) titleAccent2Var = 'var(--holo-blue)';
        else if (tier === 1) titleAccent2Var = '150 100% 56%';
        try {
            cardObject.style.setProperty('--title-accent', titleAccentVar);
            cardObject.style.setProperty('--title-accent2', titleAccent2Var);
        } catch (_) {
            void _;
        }

        const front = document.createElement('div');
        front.className = 'card-face face-front bg-obsidian';

        // 8 badges max on front - Only earned
        const earnedFront = new Set(badges.map(b => b.name));
        const frontOrder = BADGE_ORDER.slice(0, 8).filter(name => earnedFront.has(name));
        const badgesFrontHtml = frontOrder
            .map(name => {
                const mapped =
                    config && config.assets && config.assets.badges && name ? config.assets.badges[name] : '';
                const imgRef = mapped ? resolveAssetRef(mapped) : '';
                const def = BADGE_DEFS[name] || { name, desc: '' };
                const displayName = name === 'PROVIDER' ? 'LIQUIDITY PROVIDER' : def.name;
                return `
                <div class="badge-slot group">
                    ${imgRef ? `<img src="${safeText(imgRef)}" class="badge-icon" onerror="this.style.display='none'">` : ''}
                    <div class="badge-hover-name" style="position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.92);color:white;padding:6px 10px;border-radius:10px;font-size:9px;font-family:var(--font-tactical);font-weight:900;letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.18s ease;border:1px solid rgba(255,107,53,0.35);box-shadow:0 10px 28px rgba(0,0,0,0.55);">${safeText(displayName)}</div>
                </div>
                `;
            })
            .join('');

        const heartRef = miscAssetRef(config, 'HEART', '');
        const soulBadge = '';
        const imgTierClass = (() => {
            const baseKey = String(archetype.baseKey || 'DRIFTER').toUpperCase();
            if (tier === 3 && isPreview) {
                if (baseKey === 'DRIFTER') return 'anim-drifter';
                if (baseKey === 'ENGINEER') return 'anim-engineer';
                if (baseKey === 'SHAMAN') return 'anim-shaman';
                if (baseKey === 'KEEPER') return 'anim-keeper';
                if (baseKey === 'MERCHANT') return 'anim-merchant';
                if (baseKey === 'LORD') return 'anim-lord';
                if (baseKey === 'WALKER') return 'anim-walker';
                if (baseKey === 'PRIME') return 'anim-prime';
                if (baseKey === 'SINGULARITY') return 'anim-singularity';
                return 'anim-drifter';
            }
            return '';
        })();

        const archetypeOverlay =
            tier >= 3 && isPreview
                ? `<div class="archetype-overlay overlay-${safeText(String(archetype.baseKey || 'DRIFTER').toUpperCase())}"></div>`
                : '';

        let loreText = 'SYSTEM INITIALIZED';
        try {
            if (typeof window.getSmartLore === 'function') {
                loreText = window.getSmartLore({ metrics, archetype, badges });
            } else {
                const IDENTITY_DB = {
                    DRIFTER: {
                        prefixes: [
                            'Silent',
                            'Nomadic',
                            'Dust-covered',
                            'Wandering',
                            'High-speed',
                            'Lonely',
                            'Wind-borne'
                        ],
                        nouns: ['Strider', 'Runner', 'Ghost', 'Vagrant', 'Scout', 'Pathfinder', 'Traveler']
                    },
                    MERCHANT: {
                        prefixes: ['Golden', 'Calculating', 'Wealthy', 'Neon', 'Licensed', 'Digital', 'Arbitrage'],
                        nouns: ['Broker', 'Tycoon', 'Dealer', 'Baron', 'Architect', 'Vendor', 'Executive']
                    },
                    ENGINEER: {
                        prefixes: [
                            'Optimized',
                            'Overclocked',
                            'Neural',
                            'Cybernetic',
                            'Rooted',
                            'Encrypted',
                            'Compiled'
                        ],
                        nouns: ['Architect', 'Coder', 'Operator', 'Hacker', 'Builder', 'Technomancer', 'Unit']
                    },
                    SHAMAN: {
                        prefixes: ['Mystic', 'Ancient', 'Glowing', 'Ethereal', 'Chanting', 'Prophetic', 'Ritual'],
                        nouns: ['Seer', 'Oracle', 'Medium', 'Spirit', 'Summoner', 'Sage', 'Visionary']
                    },
                    KEEPER: {
                        prefixes: ['Eternal', 'Remembering', 'Archived', 'Immutable', 'Silent', 'Watchful', 'Recorded'],
                        nouns: ['Librarian', 'Observer', 'Guardian', 'Scribe', 'Witness', 'Custodian', 'Sentinel']
                    },
                    WALKER: {
                        prefixes: ['Timeless', 'Steady', 'Ancient', 'Unstoppable'],
                        nouns: ['Pilgrim', 'Walker', 'Monk', 'Entity']
                    },
                    LORD: {
                        prefixes: ['Sovereign', 'Imperial', 'Grand', 'Crowned', 'Absolute', 'Dominant', 'Royal'],
                        nouns: ['Ruler', 'Monarch', 'Emperor', 'Regent', 'Overlord', 'Commander', 'King']
                    },
                    PRIME: {
                        prefixes: ['Apex', 'Prime', 'Luminous', 'Perfect', 'Ascended', 'Radiant', 'Supreme'],
                        nouns: ['Being', 'Core', 'Form', 'Standard', 'Alpha', 'Source', 'Light']
                    },
                    SINGULARITY: {
                        prefixes: ['Void', 'Infinite', 'Null', 'Event', 'Collapsed', 'Final', 'Undefined'],
                        nouns: ['Anomaly', 'Point', 'Horizon', 'Error', 'God', 'Variable', 'Entropy']
                    }
                };

                const SUFFIX_DB = {
                    GENESIS: [
                        'forged in the first block.',
                        'present since Day Zero.',
                        'carrying the Genesis spark.',
                        'witnessing the creation.',
                        'awakened at the beginning.'
                    ],
                    WHALE: [
                        'manipulating gravity wells.',
                        'controlling market tides.',
                        'with massive capital allocation.',
                        'displacing the mempool.',
                        'commanding heavy liquidity.'
                    ],
                    PROVIDER: [
                        'fueling the ecosystem.',
                        'stabilizing the flow.',
                        'keeping the oasis alive.',
                        'bridging the void.',
                        'generating yield in silence.'
                    ],
                    'FENNEC MAXI': [
                        'loyal to the Pack.',
                        'bleeding orange neon.',
                        'guided by the Fox Spirit.',
                        'following the True Path.',
                        'fully synchronized with Fennec.'
                    ],
                    'ARTIFACT HUNTER': [
                        'collecting digital relics.',
                        'archiving rare data.',
                        'hunting for inscriptions.',
                        'preserving lost history.',
                        'with a trove of artifacts.'
                    ],
                    'RUNE KEEPER': [
                        'deciphering ancient glyphs.',
                        'reading the rune stream.',
                        'etched with protocol magic.',
                        'holding runic power.',
                        'speaking the old tongue.'
                    ],
                    'MEMPOOL RIDER': [
                        'surfing the zero-block.',
                        'faster than confirmation.',
                        'living between blocks.',
                        'riding the lightning.',
                        'bypassing the queue.'
                    ],
                    RICH: [
                        'accumulating vast resources.',
                        'building a digital empire.',
                        'shining with gold.',
                        'holding the keys to power.'
                    ],
                    OLD: [
                        'surviving every cycle.',
                        'eroded by digital winds.',
                        'standing the test of time.',
                        'watching tokens rise and fall.'
                    ],
                    NEW: [
                        'just entering the simulation.',
                        'initializing connection.',
                        'scanning for signals.',
                        'ready to evolve.'
                    ],
                    DEFAULT: [
                        'exploring the fractal depths.',
                        'searching for a signal.',
                        'navigating the noise.',
                        'waiting for the next block.',
                        'connected to the grid.'
                    ]
                };

                const addr = String(metrics.address || metrics.addr || '0x00');
                const getHash = seed => {
                    let h = seed;
                    for (let i = 0; i < addr.length; i++) h = (h << 5) - h + addr.charCodeAt(i);
                    return Math.abs(h);
                };

                const archKey = String(archetype.baseKey || 'DRIFTER').toUpperCase();
                const identitySource = IDENTITY_DB[archKey] || IDENTITY_DB.DRIFTER;
                const pIdx = getHash(1) % identitySource.prefixes.length;
                const nIdx = getHash(2) % identitySource.nouns.length;
                const prefix = identitySource.prefixes[pIdx];
                const noun = identitySource.nouns[nIdx];

                const badgeNames = (Array.isArray(badges) ? badges : [])
                    .map(b =>
                        String((b && b.name) || '')
                            .trim()
                            .toUpperCase()
                    )
                    .filter(Boolean);

                let possibleSuffixes = [];
                badgeNames.forEach(badge => {
                    let key = '';
                    if (badge.includes('GENESIS')) key = 'GENESIS';
                    else if (badge.includes('WHALE')) key = 'WHALE';
                    else if (badge.includes('PROVIDER') || badge.includes('LIQUIDITY')) key = 'PROVIDER';
                    else if (badge.includes('MAXI')) key = 'FENNEC MAXI';
                    else if (badge.includes('ARTIFACT') || badge.includes('COLLECTOR')) key = 'ARTIFACT HUNTER';
                    else if (badge.includes('RUNE')) key = 'RUNE KEEPER';
                    else if (badge.includes('MEMPOOL')) key = 'MEMPOOL RIDER';

                    if (key && SUFFIX_DB[key]) {
                        possibleSuffixes.push(...SUFFIX_DB[key]);
                        possibleSuffixes.push(...SUFFIX_DB[key]);
                        possibleSuffixes.push(...SUFFIX_DB[key]);
                    }
                });

                const wealth = parseFloat(metrics.wealth || metrics.netWorth || metrics.netWorthUSD || 0);
                const days = parseInt(metrics.daysAlive || metrics.days || 0);
                if (wealth > 500) possibleSuffixes.push(...SUFFIX_DB.RICH);
                if (days > 60) possibleSuffixes.push(...SUFFIX_DB.OLD);
                if (days >= 0 && days < 10) possibleSuffixes.push(...SUFFIX_DB.NEW);
                if (possibleSuffixes.length === 0) possibleSuffixes = SUFFIX_DB.DEFAULT;

                const sIdx = getHash(3 + badgeNames.length) % possibleSuffixes.length;
                const suffix = possibleSuffixes[sIdx];
                loreText = `${prefix} ${noun} // ${suffix}`;
            }
        } catch (_) {}

        const frontContent = `
            ${bgUrl ? `<img src="${safeText(bgUrl)}" style="position:absolute;inset:-8%;width:116%;height:116%;object-fit:cover;object-position:center;opacity:0.70;filter:blur(14px) saturate(1.1);transform:translateZ(0);pointer-events:none;" onerror="this.style.display='none'"><img src="${safeText(bgUrl)}" class="${imgTierClass}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:1;pointer-events:none;" onerror="this.style.display='none'">` : ''}
            ${archetypeOverlay}
            <div class="card-glare" style="position:absolute;left:50%;top:50%;width:200%;height:200%;transform:translate(-50%,-50%) translate(calc(var(--glare-x, 0) * 1px), calc(var(--glare-y, 0) * 1px));z-index:100;pointer-events:none;opacity:var(--glare-opacity,0);mix-blend-mode:overlay;background:linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.00) 47%, rgba(255,255,255,0.40) 50%, rgba(255,255,255,0.00) 53%, transparent 100%);filter:contrast(1.15) saturate(1.05);will-change:transform,opacity;"></div>

            <div style="position:relative;z-index:20;padding:20px;">
                <div style="position:absolute;right:20px;top:20px;font-size:11px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.5);letter-spacing:0.05em;">${safeText(String(dna.inscriptionNumber || ''))}</div>
                <div style="display:flex;flex-wrap:wrap;gap:7px;justify-content:center;align-items:center;margin-top:6px;">${badgesFrontHtml}</div>
            </div>

            <div style="position:relative;z-index:20;margin-top:auto;padding:34px 28px 28px;">
                <div style="text-align:center;margin-bottom:16px;">
                    <h2 class="archetype-title ${tier >= 3 ? 'tier3-title' : ''}" style="font-family:var(--font-display);font-weight:900;text-transform:uppercase;font-style:italic;line-height:0.95;letter-spacing:-0.04em;font-size:clamp(1.6rem, 6.0vw, 2.25rem);white-space:nowrap;overflow:hidden;text-overflow:clip;max-width:100%;transform:translateY(0px);margin:0;">${safeText(archetype.title)}</h2>
                </div>

                <div class="${metrics.hasFennecSoul ? 'soul-divider-enhanced' : 'soul-divider'}" style="height:${metrics.hasFennecSoul ? '2px' : '1px'};margin:0 auto 14px;width:100%;"></div>

                <div style="position: relative; z-index: 25; margin-top: 8px; text-align: center; width: 100%;">
                    <div style="display: inline-block; background: linear-gradient(90deg, transparent, rgba(0,0,0,0.6), transparent); padding: 4px 16px; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <p style="font-family: var(--font-tactical); font-size: 8.5px; line-height: 1.4; color: rgba(255, 255, 255, 0.75); text-transform: uppercase; letter-spacing: 0.1em; margin: 0; white-space: nowrap; text-shadow: 0 2px 4px rgba(0,0,0,1);">
                            ${safeText(loreText)}
                        </p>
                    </div>
                </div>
            </div>
        `;
        front.innerHTML = frontContent;

        const back = document.createElement('div');
        back.className = 'card-face face-back bg-obsidian';

        const watermarkRef = miscAssetRef(config, 'WATERMARK', '');
        const phavRef = miscAssetRef(config, 'PHAV', '');
        const fbsymRef = miscAssetRef(config, 'FBSYM', phavRef || '');
        const backContent = `
            <div class="absolute inset-0" style="background: radial-gradient(circle at 25% 20%, rgba(255, 107, 53, 0.12) 0%, transparent 55%), radial-gradient(circle at 70% 80%, rgba(255, 180, 120, 0.08) 0%, transparent 60%), radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.03) 0%, transparent 70%), #090706;"></div>
            ${watermarkRef ? `<div class="absolute inset-0 flex items-center justify-center pointer-events-none z-0" style="opacity:0.14;transform:translateZ(0.2px);backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform;"><img src="${safeText(watermarkRef)}" style="width:60%;height:60%;object-fit:contain;transform:translateZ(0.2px);backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform;filter:none;" onerror="this.style.display='none'"></div>` : ''}

            <div class="relative z-10 px-4 pt-7 pb-3 border-b border-white/5" style="padding-top:12px;padding-bottom:14px;">
                <div class="flex flex-col gap-2" style="align-items:center;">
                    <div class="flex justify-center items-center gap-3">
                        <div class="w-1.5 h-1.5 rounded-full bg-fennec animate-pulse"></div>
                        <span class="text-[9px] font-tactical font-bold text-white/40 tracking-[0.3em] uppercase" style="display:inline-flex;align-items:center;gap:8px;"><img src="${safeText(phavRef)}" style="width:21px;height:21px;object-fit:contain;opacity:0.9;" onerror="this.style.display='none'">Fennec ID System</span>
                        <div class="w-1.5 h-1.5 rounded-full bg-fennec animate-pulse"></div>
                    </div>
                    <div class="flex gap-2" style="margin-top:12px;margin-bottom:4px;width:100%;">
                        <button class="fid-tab-btn active flex-1 py-2 rounded-lg text-[10px] font-tactical font-bold tracking-widest transition-all bg-fennec/20 text-fennec border border-fennec/40 neon-text-subtle" style="flex:1;min-width:0;" data-tab="stats">STATS</button>
                        <button class="fid-tab-btn flex-1 py-2 rounded-lg text-[10px] font-tactical font-bold tracking-widest transition-all glass-module text-muted-foreground" style="flex:1;min-width:0;" data-tab="badges">BADGES</button>
                    </div>
                </div>
            </div>

            <div class="relative z-10" id="card-back-scroll">
                <div class="custom-scroll" id="card-back-content"></div>
            </div>
        `;
        back.innerHTML = backContent;

        const backContentArea = back.querySelector('#card-back-content');
        const updateBackScrollbarWidth = () => {
            try {
                if (!backContentArea) return;
                const sbw = Math.max(0, backContentArea.offsetWidth - backContentArea.clientWidth);
                backContentArea.style.setProperty('--fid-scrollbar-pad', `${sbw}px`);
            } catch (_) {
                void _;
            }
        };

        const scoreData = () => {
            const sb = metrics && metrics.scoreBreakdown ? metrics.scoreBreakdown : computedBreakdown;
            const maxes = computedBreakdown.max || { activityMax: 30, wealthMax: 20, timeMax: 15, badgesMax: 35 };
            return {
                breakdown: sb,
                maxes,
                totalScore: activityScore
            };
        };

        const renderStats = () => {
            const d = scoreData();
            const { breakdown, maxes, totalScore } = d;

            const pct = (val, max) => Math.round(Math.max(0, Math.min(100, (Number(val) / Number(max)) * 100)));

            const fmtInt = n => {
                const x = Number(n);
                if (!Number.isFinite(x)) return '0';
                return Math.round(x).toLocaleString('en-US').replace(/,/g, ' ');
            };

            const fmtDec = (n, d2) => {
                const x = Number(n);
                if (!Number.isFinite(x)) return (0).toFixed(d2);
                return x.toFixed(d2);
            };

            const safeNum = v => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };

            let insStatsRaw = {};
            if (metrics && typeof metrics === 'object') {
                if (metrics.inscriptionStats && typeof metrics.inscriptionStats === 'object') {
                    insStatsRaw = metrics.inscriptionStats;
                } else if (metrics.stats && typeof metrics.stats === 'object') {
                    insStatsRaw = metrics.stats;
                }
            }
            const runesCount = safeNum(insStatsRaw.runes);
            const brc20Count = safeNum(insStatsRaw.brc20);
            const ordinalsCount = safeNum(insStatsRaw.ordinals);
            const lpCount = safeNum(insStatsRaw.lp);
            const inscriptionsTotal = safeNum(insStatsRaw.total) || safeNum(runesCount + brc20Count + ordinalsCount);

            const collectionsArr = (() => {
                if (Array.isArray(insStatsRaw.collections)) return insStatsRaw.collections;
                if (Array.isArray(insStatsRaw.collection)) return insStatsRaw.collection;
                if (metrics && Array.isArray(metrics.collections)) return metrics.collections;
                if (metrics && Array.isArray(metrics.collection)) return metrics.collection;
                if (metrics && metrics.summary && Array.isArray(metrics.summary.collections))
                    return metrics.summary.collections;
                if (metrics && metrics.summary && Array.isArray(metrics.summary.collection))
                    return metrics.summary.collection;
                return null;
            })();

            const ordinalsFromCollections = collectionsArr
                ? collectionsArr.reduce((acc, c) => acc + safeNum(c && c.total), 0)
                : 0;

            const ordinalsShown = Math.max(0, Math.floor(ordinalsCount || ordinalsFromCollections));

            const fbWallet = safeNum(metrics && metrics.nativeBalance);
            const fbSwap = safeNum(metrics && metrics.fbSwapBalance);
            const fbStaked = safeNum(metrics && metrics.stakedFB);
            const fbLp = safeNum(metrics && (metrics.lpValueFB ?? metrics.lpValue));
            const fbTotal = safeNum(metrics && metrics.fbTotal) || safeNum(fbWallet + fbSwap + fbStaked);
            const fbHoldings = safeNum(fbWallet + fbSwap + fbStaked);
            const lpValueUSD = safeNum(metrics && metrics.lpValueUSD);

            const netWorthUSD = safeNum(
                metrics && (metrics.netWorthUSD ?? metrics.wealth ?? metrics.netWorth ?? metrics.netWorthUsd)
            );

            const fennecWallet = safeNum(metrics && (metrics.fennecWalletBalance ?? metrics.fennec_wallet_balance));
            const fennecInSwap = safeNum(metrics && (metrics.fennecInSwapBalance ?? metrics.fennec_inswap_balance));
            const fennecNative = safeNum(metrics && (metrics.fennecNativeBalance ?? metrics.fennec_native_balance));
            const fennecTotal =
                safeNum(metrics && metrics.fennecBalance) || safeNum(fennecWallet + fennecInSwap + fennecNative);
            const fennecLpValueUSD = safeNum(metrics && metrics.fennecLpValueUSD);
            const fennecLpSuffix = fennecLpValueUSD > 0 ? ' (FENNEC: ' + fennecLpValueUSD.toFixed(2) + ')' : '';
            void fennecLpSuffix;

            const rows = [
                {
                    label: 'ACTIVITY',
                    val: (breakdown && breakdown.activityPoints) || 0,
                    max: (maxes && maxes.activityMax) || 30
                },
                {
                    label: 'WEALTH',
                    val: (breakdown && breakdown.wealthPoints) || 0,
                    max: (maxes && maxes.wealthMax) || 20
                },
                { label: 'TIME', val: (breakdown && breakdown.timePoints) || 0, max: (maxes && maxes.timeMax) || 15 },
                {
                    label: 'BADGES',
                    val: (breakdown && breakdown.badgesPoints) || 0,
                    max: (maxes && maxes.badgesMax) || 35
                }
            ];

            const maxiBoostActive = !!(breakdown && breakdown.multiplier && breakdown.multiplier > 1);

            const daysAlive = safeNum(metrics && (metrics.daysAlive ?? metrics.walletAgeDays ?? metrics.ageDays));
            const txCount = safeNum(
                metrics && (metrics.txCount ?? metrics.txs ?? metrics.transactions ?? metrics.transactionCount)
            );
            const pooledLiquidityUsd = safeNum(metrics && (metrics.lpValueUSD ?? metrics.lpValueUsd));

            const earnedSet = new Set(
                badges
                    .map(b =>
                        String((b && b.name) || '')
                            .trim()
                            .toUpperCase()
                    )
                    .filter(Boolean)
            );
            const isOptimized = earnedSet.has('SAND SWEEPER') || safeNum(metrics && metrics.abandonedUtxoCount) < 50;

            const rowsHtml = rows
                .map(r => {
                    const p = pct(r.val, r.max);
                    return `
                                <div style="display:flex;flex-direction:column;gap:6px;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;">
                                        <div style="font-size:9px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.55);letter-spacing:0.16em;text-transform:uppercase;">${safeText(r.label)}</div>
                                        <div style="font-size:11px;font-family:var(--font-tactical);font-weight:900;color:white;">${p}%</div>
                                    </div>
                                    <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden;border:1px solid rgba(255,255,255,0.03);">
                                        <div style="height:100%;background:linear-gradient(90deg, #ff6b35, #ff8c35);border-radius:999px;width:${p}%;"></div>
                                    </div>
                                </div>`;
                })
                .join('');

            const evolutionHtml = rarity
                ? `
                        <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);position:relative;">
                            <div style="position:relative;display:flex;justify-content:space-between;align-items:baseline;gap:10px;white-space:nowrap;">
                                <span data-fit data-fit-min="12" style="display:inline-block;max-width:50%;font-size:15px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.75);letter-spacing:0.16em;text-transform:uppercase;white-space:nowrap;overflow:hidden;">EVOLUTION</span>
                                <span data-fit data-fit-min="14" class="evolution-value${rarity.key === 'spirit' ? ' spirit-evolution' : ''}" style="display:inline-block;max-width:100%;font-size:20px;font-family:var(--font-tactical);font-weight:900;letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;color:rgba(255,255,255,0.95);">${safeText(rarity.name)}</span>
                            </div>
                        </div>
                        `
                : '';

            return `
                <div style="display:flex;flex-direction:column;gap:14px;">
                    <div style="display:flex;justify-content:center;align-items:center;margin-bottom:6px;">
                        <span style="font-size:15px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.65);letter-spacing:0.16em;text-transform:uppercase;">SCORE BREAKDOWN</span>
                    </div>

                    <div class="glass-module" style="padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
                        <div style="display:flex;flex-direction:column;gap:10px;">
                            ${rowsHtml}
                        </div>

                        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;margin-top:12px;border-top:1px solid rgba(255,255,255,0.04);">
                            <span style="font-size:10px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.55);letter-spacing:0.14em;text-transform:uppercase;">MAXI BOOST</span>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <div style="width:6px;height:6px;border-radius:999px;background:${maxiBoostActive ? 'hsl(var(--fennec-orange))' : 'rgba(255,255,255,0.25)'};${maxiBoostActive ? 'box-shadow:0 0 8px hsl(var(--fennec-orange) / 0.5);' : ''}"></div>
                                <span style="font-size:11px;font-family:var(--font-tactical);font-weight:900;color:${maxiBoostActive ? 'hsl(var(--fennec-orange))' : 'rgba(255,255,255,0.55)'};letter-spacing:0.08em;">${maxiBoostActive ? 'ACTIVE' : 'INACTIVE'}</span>
                            </div>
                        </div>

                        <div style="padding-top:14px;margin-top:14px;border-top:1px solid rgba(255,255,255,0.04);display:flex;justify-content:space-between;align-items:baseline;gap:10px;white-space:nowrap;">
                            <span data-fit data-fit-min="11" style="display:inline-block;max-width:60%;font-size:14px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.55);letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;">FINAL SCORE</span>
                            <div style="display:flex;align-items:baseline;gap:6px;justify-content:flex-end;white-space:nowrap;min-width:0;">
                                <span data-fit data-fit-min="18" style="display:inline-block;max-width:100%;font-size:26px;font-weight:900;color:hsl(var(--fennec-orange));font-family:var(--font-tactical);line-height:1;white-space:nowrap;overflow:hidden;">${Math.round(totalScore)}</span>
                                <span data-fit data-fit-min="10" style="display:inline-block;max-width:100%;font-size:12px;font-weight:800;color:rgba(255,255,255,0.22);font-family:var(--font-tactical);white-space:nowrap;overflow:hidden;">/100</span>
                            </div>
                        </div>

                        ${evolutionHtml}
                    </div>

                    <div style="display:block;width:100%;text-align:center;padding-top:12px;padding-bottom:8px;">
                        <div style="display:inline-block;font-size:14px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.65);letter-spacing:0.16em;text-transform:uppercase;">CORE MODULES</div>
                    </div>
                    <div class="glass-module" style="padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;position:relative;overflow:hidden;">
                        <div style="position:relative;z-index:2;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;justify-content:center;">
                            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.03);text-align:center;display:flex;flex-direction:column;gap:2px;min-width:0;">
                                <div data-fit data-fit-min="7" style="font-size:8px;font-family:var(--font-tactical);font-weight:800;color:rgba(255,255,255,0.42);letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;">OPERATIONS</div>
                                <div data-fit data-fit-min="12" style="margin-top:2px;font-size:20px;font-family:var(--font-tactical);font-weight:900;color:white;white-space:nowrap;overflow:hidden;">${fmtInt(txCount)}</div>
                                <div data-fit data-fit-min="8" style="margin-top:1px;font-size:9px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.32);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;">TXS</div>
                            </div>
                            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.03);text-align:center;display:flex;flex-direction:column;gap:2px;min-width:0;">
                                <div data-fit data-fit-min="7" style="font-size:8px;font-family:var(--font-tactical);font-weight:800;color:rgba(255,255,255,0.42);letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;">WALLET AGE</div>
                                <div data-fit data-fit-min="12" style="margin-top:2px;font-size:20px;font-family:var(--font-tactical);font-weight:900;color:white;white-space:nowrap;overflow:hidden;">${fmtInt(daysAlive)}</div>
                                <div data-fit data-fit-min="8" style="margin-top:1px;font-size:9px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.32);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden;">DAYS</div>
                            </div>
                            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.03);text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;min-width:0;">
                                <div data-fit data-fit-min="7" style="font-size:8px;font-family:var(--font-tactical);font-weight:800;color:rgba(255,255,255,0.42);letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;">NET WORTH</div>
                                <div data-fit data-fit-min="12" style="font-size:20px;font-family:var(--font-tactical);font-weight:900;color:white;white-space:nowrap;overflow:hidden;line-height:1;">$${fmtDec(netWorthUSD, 2)}</div>
                            </div>
                            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.03);text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;min-width:0;">
                                <div data-fit data-fit-min="7" style="font-size:8px;font-family:var(--font-tactical);font-weight:800;color:rgba(255,255,255,0.42);letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;">STORAGE</div>
                                <div data-fit data-fit-min="9" style="font-size:12px;font-family:var(--font-tactical);font-weight:900;letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;line-height:1;color:${isOptimized ? 'rgb(34 197 94)' : 'rgba(255,255,255,0.45)'};">${isOptimized ? 'OPTIMIZED' : 'FRAGMENTED'}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display:block;width:100%;text-align:center;padding-top:12px;padding-bottom:8px;">
                        <div style="display:inline-block;font-size:14px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.65);letter-spacing:0.16em;text-transform:uppercase;">VAULT</div>
                    </div>
                    <div class="glass-module" style="padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;position:relative;overflow:hidden;">
                        <div style="position:absolute;inset:0;pointer-events:none;opacity:0.08;background:radial-gradient(circle at 50% 50%, rgba(255,107,53,0.35), transparent 70%),linear-gradient(135deg, rgba(255,255,255,0.03), transparent);"></div>
                        <div style="position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;justify-content:center;">
                            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.03);text-align:center;">
                                <div style="font-size:8px;font-family:var(--font-tactical);font-weight:800;color:rgba(255,255,255,0.42);letter-spacing:0.14em;text-transform:uppercase;">RUNES</div>
                                <div style="margin-top:6px;font-size:18px;font-family:var(--font-tactical);font-weight:900;color:white;">${fmtInt(runesCount)}</div>
                            </div>
                            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.03);text-align:center;">
                                <div style="font-size:8px;font-family:var(--font-tactical);font-weight:800;color:rgba(255,255,255,0.42);letter-spacing:0.14em;text-transform:uppercase;">BRC-20</div>
                                <div style="margin-top:6px;font-size:18px;font-family:var(--font-tactical);font-weight:900;color:white;">${fmtInt(brc20Count)}</div>
                            </div>
                            <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.03);text-align:center;">
                                <div style="font-size:8px;font-family:var(--font-tactical);font-weight:800;color:rgba(255,255,255,0.42);letter-spacing:0.14em;text-transform:uppercase;">ORDINALS</div>
                                <div style="margin-top:6px;font-size:18px;font-family:var(--font-tactical);font-weight:900;color:white;">${fmtInt(ordinalsShown)}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display:block;width:100%;text-align:center;padding-top:12px;padding-bottom:8px;">
                        <div style="display:inline-block;font-size:14px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.65);letter-spacing:0.16em;text-transform:uppercase;">HOLDINGS</div>
                    </div>
                    <div class="glass-module" style="padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;position:relative;overflow:hidden;">
                        <div style="position:relative;z-index:2;display:flex;flex-direction:column;gap:12px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                                    <div style="width:18px;height:18px;border-radius:6px;background:linear-gradient(180deg, rgba(255,107,53,0.22), rgba(0,0,0,0.35));border:1px solid rgba(255,107,53,0.35);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,0.35);">
                                        <img src="${safeText(phavRef)}" style="width:14px;height:14px;object-fit:contain;filter:drop-shadow(0 0 8px rgba(0,0,0,0.5));" onerror="this.style.display='none'">
                                    </div>
                                    <div style="font-size:11px;font-family:var(--font-tactical);font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.92);">FENNEC</div>
                                </div>
                                <div style="font-size:12px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.92);">${fmtDec(fennecTotal, 2)}</div>
                            </div>

                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                                    <div style="width:18px;height:18px;border-radius:6px;background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(0,0,0,0.35));border:1px solid rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,0.35);">
                                        <img src="${safeText(fbsymRef)}" style="width:14px;height:14px;object-fit:contain;filter:drop-shadow(0 0 8px rgba(0,0,0,0.55));" onerror="this.style.display='none'">
                                    </div>
                                    <div style="font-size:11px;font-family:var(--font-tactical);font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.92);">FB</div>
                                </div>
                                <div style="font-size:12px;font-family:var(--font-tactical);font-weight:900;color:rgba(255,255,255,0.92);">${fmtDec(fbHoldings, 2)}</div>
                            </div>
                        </div>

                    </div>
                </div>
            `;
        };

        const renderBadges = () => {
            const earnedSet = new Set(badges.map(b => b.name));
            const badgeNames = BADGE_ORDER.slice().sort((a, b) => {
                const ea = earnedSet.has(a);
                const eb = earnedSet.has(b);
                if (ea === eb) return 0;
                return ea ? -1 : 1;
            });

            const badgesHtml = badgeNames
                .map(name => {
                    const isEarned = earnedSet.has(name);
                    const def = BADGE_DEFS[name] || { name, icon: '', desc: '' };
                    const displayName = name === 'PROVIDER' ? 'LIQUIDITY PROVIDER' : def.name;
                    const mapped =
                        config && config.assets && config.assets.badges && name ? config.assets.badges[name] : '';
                    const ref = resolveAssetRef(mapped || '');
                    const borderStyle = isEarned
                        ? '1px solid hsl(var(--fennec-orange) / 0.25)'
                        : '1px solid rgba(255,255,255,0.08)';
                    const opacityStyle = isEarned ? '1' : '0.50';
                    const iconFilter = isEarned
                        ? 'drop-shadow(0 0 12px hsl(var(--fennec-orange) / 0.40))'
                        : 'drop-shadow(0 0 8px rgba(255,255,255,0.10))';
                    const titleColor = isEarned ? 'hsl(var(--foreground))' : 'rgba(255,255,255,0.75)';
                    const imgHtml = ref
                        ? `<img src="${safeText(ref)}" style="width:30px;height:30px;object-fit:contain;filter:${iconFilter}" onerror="this.style.display='none'">`
                        : '';
                    return `
                            <div class="glass-module" style="display:flex;gap:12px;align-items:flex-start;padding:12px;border:${borderStyle};opacity:${opacityStyle};">
                                <div style="width:44px;height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.10);">
                                    ${imgHtml}
                                </div>
                                <div style="flex:1;min-width:0;">
                                    <div style="display:flex;align-items:center;justify-content:center;">
                                        <div style="font-size:10px;font-family:var(--font-tactical);font-weight:900;letter-spacing:0.10em;text-transform:uppercase;color:${titleColor};text-align:center;">${safeText(displayName)}</div>
                                    </div>
                                    <div style="margin-top:4px;font-size:11px;line-height:1.25;color:rgba(255,255,255,0.60);text-align:center;">${safeText(def.desc)}</div>
                                </div>
                            </div>
                        `;
                })
                .join('');
            return `
                <div style="display:flex;flex-direction:column;gap:10px;">
                    ${badgesHtml}
                </div>
            `;
        };

        const applyAutoFit = rootEl => {
            try {
                const scope = rootEl || back;
                if (!scope) return;
                scope.querySelectorAll('[data-fit]').forEach(el => {
                    if (!el) return;
                    const minPx = Number(el.getAttribute('data-fit-min') || 10) || 10;
                    const cs = window.getComputedStyle(el);
                    let fs = parseFloat(cs.fontSize) || 12;
                    let guard = 0;
                    while (guard < 18 && fs > minPx && el.scrollWidth > el.clientWidth + 1) {
                        fs -= 1;
                        el.style.fontSize = fs + 'px';
                        guard += 1;
                    }
                });
            } catch (_) {
                /* fallback */
            }
        };

        if (backContentArea) {
            backContentArea.innerHTML = renderStats();
            applyAutoFit(backContentArea);
            requestAnimationFrame(updateBackScrollbarWidth);
        }

        back.querySelectorAll('.fid-tab-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const tab = btn.getAttribute('data-tab');
                back.querySelectorAll('.fid-tab-btn').forEach(b => {
                    b.classList.remove(
                        'active',
                        'bg-fennec/10',
                        'bg-fennec/20',
                        'text-fennec',
                        'border-fennec/30',
                        'border-fennec/40',
                        'neon-text-subtle'
                    );
                    b.classList.add('glass-module', 'text-muted-foreground');
                });
                btn.classList.add('active', 'bg-fennec/20', 'text-fennec', 'border-fennec/40', 'neon-text-subtle');
                btn.classList.remove('glass-module', 'text-muted-foreground');

                if (!backContentArea) return;
                if (tab === 'stats') {
                    backContentArea.innerHTML = renderStats();
                    applyAutoFit(backContentArea);
                    requestAnimationFrame(updateBackScrollbarWidth);
                } else {
                    backContentArea.innerHTML = renderBadges();
                    requestAnimationFrame(updateBackScrollbarWidth);
                }
            });
        });

        cardObject.appendChild(front);
        cardObject.appendChild(back);
        scene.appendChild(cardObject);

        let isFlipped = false;
        let tiltTargetX = 0;
        let tiltTargetY = 0;
        let tiltCurX = 0;
        let tiltCurY = 0;
        let tiltRaf = 0;

        const updateSheenFromTilt = (xDeg, yDeg) => {
            if (isFlipped) {
                cardObject.style.setProperty('--glare-opacity', '0');
                cardObject.style.setProperty('--glare-x', '0');
                cardObject.style.setProperty('--glare-y', '0');
                return;
            }
            const tiltMax = 12;
            const nx = Math.max(-1, Math.min(1, Number(yDeg) / tiltMax));
            const ny = Math.max(-1, Math.min(1, -Number(xDeg) / tiltMax));
            const dist = Math.sqrt(nx * nx + ny * ny);
            const intensity = dist < 0.02 ? 0 : Math.pow(Math.min(1, dist), 1.25);
            const alpha = intensity <= 0 ? 0 : Math.min(0.55, intensity * 0.55);

            // движение блика в противоход наклону
            const posX = -nx * 120;
            const posY = -ny * 120;

            cardObject.style.setProperty('--glare-opacity', alpha.toFixed(3));
            cardObject.style.setProperty('--glare-x', posX.toFixed(1));
            cardObject.style.setProperty('--glare-y', posY.toFixed(1));
        };

        const applyTiltNow = (xDeg, yDeg) => {
            tiltCurX = xDeg;
            tiltCurY = yDeg;
            tiltTargetX = xDeg;
            tiltTargetY = yDeg;
            cardObject.style.setProperty('--tiltX', `${xDeg}deg`);
            cardObject.style.setProperty('--tiltY', `${yDeg}deg`);
            updateSheenFromTilt(xDeg, yDeg);
        };

        const tiltStep = () => {
            tiltRaf = 0;
            const ease = 0.14;
            tiltCurX += (tiltTargetX - tiltCurX) * ease;
            tiltCurY += (tiltTargetY - tiltCurY) * ease;
            cardObject.style.setProperty('--tiltX', `${tiltCurX.toFixed(2)}deg`);
            cardObject.style.setProperty('--tiltY', `${tiltCurY.toFixed(2)}deg`);
            updateSheenFromTilt(tiltCurX, tiltCurY);
            if (Math.abs(tiltTargetX - tiltCurX) > 0.01 || Math.abs(tiltTargetY - tiltCurY) > 0.01) {
                tiltRaf = requestAnimationFrame(tiltStep);
            }
        };

        const setTiltTarget = (xDeg, yDeg) => {
            tiltTargetX = xDeg;
            tiltTargetY = yDeg;
            if (!tiltRaf) tiltRaf = requestAnimationFrame(tiltStep);
        };

        scene.addEventListener('click', e => {
            if (e.target.closest('button')) return;
            isFlipped = !isFlipped;
            try {
                scene.classList.add('is-flipping');
            } catch (_) {
                /* fallback */
            }
            scene.classList.toggle('is-flipped', isFlipped);

            try {
                applyTiltNow(0, 0);
                setTiltTarget(0, 0);
            } catch (_) {
                /* fallback */
            }

            const onFlipEnd = () => {
                try {
                    scene.classList.remove('is-flipping');
                } catch (_) {
                    /* fallback */
                }
                try {
                    cardObject.removeEventListener('transitionend', onFlipEnd);
                } catch (_) {
                    /* fallback */
                }
            };

            try {
                cardObject.addEventListener('transitionend', onFlipEnd);
            } catch (_) {
                /* fallback */
            }

            setTimeout(() => {
                try {
                    scene.classList.remove('is-flipping');
                    cardObject.removeEventListener('transitionend', onFlipEnd);
                } catch (_) {
                    /* fallback */
                }
            }, 900);
        });

        scene.addEventListener('mousemove', e => {
            if (isFlipped) return;
            const rect = scene.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const tiltMax = tier >= 3 ? 14 : tier === 2 ? 12 : tier === 1 ? 10 : 8;
            const rotateX = ((y - centerY) / centerY) * -tiltMax;
            const rotateY = ((x - centerX) / centerX) * tiltMax;
            setTiltTarget(rotateX, rotateY);
        });

        scene.addEventListener(
            'touchmove',
            e => {
                if (isFlipped) return;
                const t = e && e.touches && e.touches[0] ? e.touches[0] : null;
                if (!t) return;
                const rect = scene.getBoundingClientRect();
                const x = t.clientX - rect.left;
                const y = t.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const tiltMax = tier >= 3 ? 14 : tier === 2 ? 12 : tier === 1 ? 10 : 8;
                const rotateX = ((y - centerY) / centerY) * -tiltMax;
                const rotateY = ((x - centerX) / centerX) * tiltMax;
                setTiltTarget(rotateX, rotateY);
            },
            { passive: true }
        );

        scene.addEventListener('mouseleave', () => {
            if (isFlipped) return;
            setTiltTarget(0, 0);
        });

        scene.addEventListener(
            'touchend',
            () => {
                if (isFlipped) return;
                setTiltTarget(0, 0);
            },
            { passive: true }
        );

        scene.addEventListener(
            'touchcancel',
            () => {
                if (isFlipped) return;
                setTiltTarget(0, 0);
            },
            { passive: true }
        );

        scene.addEventListener('pointercancel', () => {
            if (isFlipped) return;
            setTiltTarget(0, 0);
        });

        try {
            if (!window.__fennecTiltScenes) window.__fennecTiltScenes = new Set();
            window.__fennecTiltScenes.add(scene);
            scene.__fennecTiltReset = () => {
                try {
                    applyTiltNow(0, 0);
                } catch (_) {
                    /* fallback */
                }
                try {
                    setTiltTarget(0, 0);
                } catch (_) {
                    /* fallback */
                }
            };

            if (!window.__fennecTiltGlobalHandlersInstalled) {
                window.__fennecTiltGlobalHandlersInstalled = true;
                window.__fennecTiltGlobalResetAll = () => {
                    try {
                        const scenes = window.__fennecTiltScenes;
                        if (!scenes) return;
                        for (const s of Array.from(scenes)) {
                            try {
                                if (!s || !s.isConnected) {
                                    scenes.delete(s);
                                    continue;
                                }
                                if (typeof s.__fennecTiltReset === 'function') s.__fennecTiltReset();
                            } catch (_) {
                                /* fallback */
                            }
                        }
                    } catch (_) {
                        /* fallback */
                    }
                };

                document.addEventListener('visibilitychange', () => {
                    try {
                        if (window.__fennecTiltGlobalResetAll) window.__fennecTiltGlobalResetAll();
                    } catch (_) {
                        /* fallback */
                    }
                });
                window.addEventListener('blur', () => {
                    try {
                        if (window.__fennecTiltGlobalResetAll) window.__fennecTiltGlobalResetAll();
                    } catch (_) {
                        /* fallback */
                    }
                });
                window.addEventListener('focus', () => {
                    try {
                        if (window.__fennecTiltGlobalResetAll) window.__fennecTiltGlobalResetAll();
                    } catch (_) {
                        /* fallback */
                    }
                });
            }
        } catch (_) {
            void _;
        }

        return scene;
    }

    function renderInto(container, dna, config) {
        const target = container || document.body;
        target.innerHTML = '';
        target.appendChild(createCard(dna, config));

        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Запуск 3D эффектов после добавления в DOM
        // Без этого вызова экран черный или карточка плоская
        setTimeout(() => {
            try {
                if (window.__fennecTiltGlobalResetAll) window.__fennecTiltGlobalResetAll();
            } catch (_) {
                void _;
            }
        }, 0);
    }

    async function init() {
        try {
            const now = Date.now();
            const last = Number(window.__fennec_id_init_last_at || 0) || 0;
            if (now - last < 1000) return;
            window.__fennec_id_init_last_at = now;
        } catch (_) {
            void _;
        }
        const dna = getDna();
        const config = await loadConfig();
        injectStyles();
        let root = document.getElementById('fennec-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'fennec-root';
            document.body.appendChild(root);
        }
        renderInto(root, dna, config);
    }

    window.initFennecID = init;

    window.FennecIDLib = {
        loadConfig,
        createCard,
        renderInto
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
            try {
                const meta = document.querySelector('meta[name="fennec-embed"]');
                const isEmbed = meta && String(meta.getAttribute('content') || '').trim() === '1';
                if (isEmbed) return;
            } catch (_) {
                /* fallback */
            }
            if (document.getElementById('dna-data') || document.getElementById('user-data')) {
                init();
            }
        }, 0);
    }
})();
