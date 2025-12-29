(function () {
    'use strict';

    // ГЛОБАЛЬНЫЙ ШИМ STORAGE (предотвращает краш в sandbox/incognito)
    (function () {
        function makeShim() {
            let mem = {};
            return {
                getItem: function (k) {
                    return mem.hasOwnProperty(k) ? mem[k] : null;
                },
                setItem: function (k, v) {
                    mem[k] = String(v);
                },
                removeItem: function (k) {
                    delete mem[k];
                },
                clear: function () {
                    mem = {};
                },
                key: function (i) {
                    return Object.keys(mem)[i] || null;
                },
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
        version: 1,
        theme: 'default',
        features: {
            enableFlip: true,
            enableTilt: true
        },
        scoring: {
            launchDate: 1725840000,
            genesisWindowSec: 86400,
            points: {
                activityMax: 30,
                wealthMax: 20,
                timeMax: 15,
                badgesMax: 35
            },
            activity: {
                curve: 'log',
                maxTx: 10000
            },
            wealth: {
                curve: 'sqrt',
                maxNetWorthUSD: 500
            },
            time: {
                maxDays: 365
            },
            maxi: {
                multiplier: 1.2,
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
            showSyncFx: true
        },
        assets: {
            backgrounds: {},
            badges: {},
            misc: {}
        }
    };

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
        } catch (_) {}

        try {
            const h = (
                window.location && window.location.hostname ? String(window.location.hostname) : ''
            ).toLowerCase();
            if (h === 'uniscan.cc' || h.endsWith('.uniscan.cc')) return 'https://uniscan.cc/fractal/content/';
        } catch (_) {}

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
        } catch (_) {}

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
            if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function manifestPickLatest(manifest) {
        if (!manifest || typeof manifest !== 'object') return { lib: '', config: '' };
        const latest = manifest.latest && typeof manifest.latest === 'object' ? manifest.latest : manifest;
        const lib =
            latest.lib ||
            latest.libId ||
            latest.library ||
            latest.libraryId ||
            latest.fennecLib ||
            latest.fennecLibId ||
            '';
        const config =
            latest.config ||
            latest.configId ||
            latest.configuration ||
            latest.configurationId ||
            latest.fennecConfig ||
            latest.fennecConfigId ||
            '';
        return {
            lib: typeof lib === 'string' ? lib.trim() : '',
            config: typeof config === 'string' ? config.trim() : ''
        };
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

        const absMatch =
            v.match(/^https?:\/\/fractal-static\.unisat\.(?:space|io)\/content\/([^/?#]+)/i) ||
            v.match(/^https?:\/\/fractal-static\.unisat\.(?:space|io)\/fractal\/content\/([^/?#]+)/i);
        if (absMatch) {
            const id = absMatch[1];
            if (base) return `${base}/${id}`;
            return `https://uniscan.cc/fractal/content/${id}`;
        }

        if (v.startsWith('/content/')) {
            const id = v.slice('/content/'.length).split(/[?#/]/)[0];
            if (base && id) return `${base}/${id}`;
            return v;
        }

        if (v.startsWith('/fractal/content/')) {
            const id = v.slice('/fractal/content/'.length).split(/[?#/]/)[0];
            if (base && id) return `${base}/${id}`;
            return v;
        }

        if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) return v;
        if (v.startsWith('/') || v.startsWith('./') || v.startsWith('../') || v.includes('/')) return v;
        if (base) return `${base}/${v}`;
        return `/content/${v}`;
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
                const picked = manifestPickLatest(m);
                if (picked && picked.config) configId = picked.config;
            } catch (_) {}
        }

        if (!configId) return DEFAULT_CONFIG;

        try {
            const res = await fetch(resolveContentRef(configId), { cache: 'force-cache' });
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
        if (document.getElementById('fennec-lib-style')) return;

        try {
            const meta = document.querySelector('meta[name="fennec-embed"]');
            const isEmbed = meta && String(meta.getAttribute('content') || '').trim() === '1';
            if (isEmbed) {
                document.documentElement.setAttribute('data-fennec-embed', '1');
                if (document.body) document.body.setAttribute('data-fennec-embed', '1');
            }
        } catch (_) {}

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
        } catch (_) {}

        try {
            const isContent = !!(window.location && String(window.location.pathname || '').indexOf('/content/') === 0);
            if (isContent) {
                document.documentElement.setAttribute('data-fennec-content', '1');
                if (document.body) document.body.setAttribute('data-fennec-content', '1');
            }
        } catch (_) {}

        const style = document.createElement('style');
        style.id = 'fennec-lib-style';
        style.textContent = `
:root {
    /* Fennec Cyberpunk Base Colors */
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

    /* Fennec Specifics */
    --fennec-orange: 18 100% 60%;
    --fennec-glow: 18 100% 70%;
    --obsidian: 20 10% 6%;
    --obsidian-light: 20 8% 12%;
    --holo-purple: 270 91% 65%;
    --holo-cyan: 187 94% 43%;
    --holo-blue: 217 91% 60%;
    --glass-white: 0 0% 100%;
    --laser-edge: 18 100% 55%;

    --gradient-obsidian: linear-gradient(145deg, hsl(20 10% 8%) 0%, hsl(20 15% 4%) 50%, hsl(0 0% 2%) 100%);

    --font-display: 'Space Grotesk', system-ui, sans-serif;
    --font-tactical: 'JetBrains Mono', monospace;
}

[data-fennec-lib-root] {
    color: hsl(var(--foreground));
    font-family: var(--font-display);
    -webkit-font-smoothing: antialiased;
}

[data-fennec-lib-root] .absolute { position: absolute; }
[data-fennec-lib-root] .relative { position: relative; }
[data-fennec-lib-root] .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
[data-fennec-lib-root] .z-0 { z-index: 0; }
[data-fennec-lib-root] .z-10 { z-index: 10; }
[data-fennec-lib-root] .z-20 { z-index: 20; }
[data-fennec-lib-root] .z-\\[100\\] { z-index: 100; }

[data-fennec-lib-root] .flex { display: flex; }
[data-fennec-lib-root] .flex-1 { flex: 1 1 0%; }
[data-fennec-lib-root] .items-center { align-items: center; }
[data-fennec-lib-root] .items-start { align-items: flex-start; }
[data-fennec-lib-root] .justify-center { justify-content: center; }
[data-fennec-lib-root] .justify-between { justify-content: space-between; }
[data-fennec-lib-root] .gap-1\\.5 { gap: 0.375rem; }
[data-fennec-lib-root] .gap-2 { gap: 0.5rem; }

[data-fennec-lib-root] .w-full { width: 100%; }
[data-fennec-lib-root] .w-2 { width: 0.5rem; }
[data-fennec-lib-root] .h-2 { height: 0.5rem; }
[data-fennec-lib-root] .w-8 { width: 2rem; }
[data-fennec-lib-root] .h-8 { height: 2rem; }
[data-fennec-lib-root] .w-40 { width: 10rem; }
[data-fennec-lib-root] .h-40 { height: 10rem; }
[data-fennec-lib-root] .h-px { height: 1px; }

[data-fennec-lib-root] .rounded-full { border-radius: 9999px; }
[data-fennec-lib-root] .rounded-lg { border-radius: 0.5rem; }
[data-fennec-lib-root] .rounded-\\[18px\\] { border-radius: 18px; }

[data-fennec-lib-root] .p-1 { padding: 0.25rem; }
[data-fennec-lib-root] .p-3 { padding: 0.75rem; }
[data-fennec-lib-root] .p-4 { padding: 1rem; }
[data-fennec-lib-root] .p-5 { padding: 1.25rem; }
[data-fennec-lib-root] .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
[data-fennec-lib-root] .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
[data-fennec-lib-root] .px-4 { padding-left: 1rem; padding-right: 1rem; }
[data-fennec-lib-root] .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
[data-fennec-lib-root] .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
[data-fennec-lib-root] .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
[data-fennec-lib-root] .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
[data-fennec-lib-root] .pb-6 { padding-bottom: 1.5rem; }

[data-fennec-lib-root] .mt-auto { margin-top: auto; }
[data-fennec-lib-root] .mt-3 { margin-top: 0.75rem; }
[data-fennec-lib-root] .mb-0\\.5 { margin-bottom: 0.125rem; }
[data-fennec-lib-root] .mb-1\\.5 { margin-bottom: 0.375rem; }
[data-fennec-lib-root] .mb-2 { margin-bottom: 0.5rem; }
[data-fennec-lib-root] .mb-3 { margin-bottom: 0.75rem; }
[data-fennec-lib-root] .mb-4 { margin-bottom: 1rem; }
[data-fennec-lib-root] .ml-auto { margin-left: auto; }
[data-fennec-lib-root] .mx-auto { margin-left: auto; margin-right: auto; }

[data-fennec-lib-root] .text-center { text-align: center; }
[data-fennec-lib-root] .text-right { text-align: right; }
[data-fennec-lib-root] .uppercase { text-transform: uppercase; }
[data-fennec-lib-root] .italic { font-style: italic; }
[data-fennec-lib-root] .font-black { font-weight: 900; }
[data-fennec-lib-root] .font-bold { font-weight: 700; }

[data-fennec-lib-root] .text-6xl { font-size: 3.75rem; line-height: 1; }
[data-fennec-lib-root] .text-2xl { font-size: 1.5rem; line-height: 2rem; }
[data-fennec-lib-root] .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
[data-fennec-lib-root] .text-xs { font-size: 0.75rem; line-height: 1rem; }
[data-fennec-lib-root] .text-\\[200px\\] { font-size: 200px; line-height: 1; }
[data-fennec-lib-root] .text-\\[11px\\] { font-size: 11px; line-height: 1.2; }
[data-fennec-lib-root] .text-\\[10px\\] { font-size: 10px; line-height: 1.2; }
[data-fennec-lib-root] .text-\\[9px\\] { font-size: 9px; line-height: 1.2; }
[data-fennec-lib-root] .text-\\[8px\\] { font-size: 8px; line-height: 1.2; }

[data-fennec-lib-root] .tracking-\\[0\\.25em\\] { letter-spacing: 0.25em; }
[data-fennec-lib-root] .tracking-\\[0\\.2em\\] { letter-spacing: 0.2em; }
[data-fennec-lib-root] .tracking-\\[0\\.15em\\] { letter-spacing: 0.15em; }
[data-fennec-lib-root] .tracking-wider { letter-spacing: 0.08em; }
[data-fennec-lib-root] .tracking-widest { letter-spacing: 0.12em; }

[data-fennec-lib-root] .overflow-hidden { overflow: hidden; }
[data-fennec-lib-root] .overflow-y-auto { overflow-y: auto; }
[data-fennec-lib-root] .pointer-events-none { pointer-events: none; }
[data-fennec-lib-root] .select-none { user-select: none; }
[data-fennec-lib-root] .object-contain { object-fit: contain; }

[data-fennec-lib-root] .text-muted-foreground { color: hsl(var(--muted-foreground)); }
[data-fennec-lib-root] .text-foreground\\/80 { color: hsl(var(--foreground) / 0.8); }
[data-fennec-lib-root] .opacity-40 { opacity: 0.4; }
[data-fennec-lib-root] .opacity-60 { opacity: 0.6; }
[data-fennec-lib-root] .opacity-\\[0\\.03\\] { opacity: 0.03; }

[data-fennec-lib-root] .border { border-width: 1px; border-style: solid; }
[data-fennec-lib-root] .border-border\\/30 { border-color: hsl(var(--border) / 0.3); }
[data-fennec-lib-root] .border-fennec\\/20 { border-color: hsl(var(--fennec-orange) / 0.2); }
[data-fennec-lib-root] .border-fennec\\/30 { border-color: hsl(var(--fennec-orange) / 0.3); }
[data-fennec-lib-root] .border-fennec\\/40 { border-color: hsl(var(--fennec-orange) / 0.4); }

[data-fennec-lib-root] .bg-black\\/60 { background: rgba(0,0,0,0.6); }
[data-fennec-lib-root] .bg-fennec\\/10 { background: hsl(var(--fennec-orange) / 0.1); }
[data-fennec-lib-root] .bg-fennec\\/20 { background: hsl(var(--fennec-orange) / 0.2); }
[data-fennec-lib-root] .bg-secondary\\/30 { background: hsl(var(--secondary) / 0.3); }

[data-fennec-lib-root] .bg-gradient-to-br { --fid-gfrom: transparent; --fid-gvia: transparent; --fid-gto: transparent; background-image: linear-gradient(to bottom right, var(--fid-gfrom), var(--fid-gvia), var(--fid-gto)); }
[data-fennec-lib-root] .bg-gradient-to-b { --fid-gfrom: transparent; --fid-gvia: transparent; --fid-gto: transparent; background-image: linear-gradient(to bottom, var(--fid-gfrom), var(--fid-gvia), var(--fid-gto)); }
[data-fennec-lib-root] .bg-gradient-to-r { --fid-gfrom: transparent; --fid-gvia: transparent; --fid-gto: transparent; background-image: linear-gradient(to right, var(--fid-gfrom), var(--fid-gvia), var(--fid-gto)); }
[data-fennec-lib-root] .bg-gradient-radial { --fid-gfrom: transparent; --fid-gvia: transparent; --fid-gto: transparent; background-image: radial-gradient(circle at center, var(--fid-gfrom), var(--fid-gvia), var(--fid-gto)); }

[data-fennec-lib-root] .from-transparent { --fid-gfrom: transparent; }
[data-fennec-lib-root] .to-transparent { --fid-gto: transparent; }
[data-fennec-lib-root] .via-background { --fid-gvia: hsl(var(--background)); }
[data-fennec-lib-root] .to-background { --fid-gto: hsl(var(--background)); }
[data-fennec-lib-root] .from-obsidian-light\\/80 { --fid-gfrom: hsl(var(--obsidian-light) / 0.8); }
[data-fennec-lib-root] .from-obsidian-light\\/50 { --fid-gfrom: hsl(var(--obsidian-light) / 0.5); }
[data-fennec-lib-root] .to-background\\/90 { --fid-gto: hsl(var(--background) / 0.9); }
[data-fennec-lib-root] .via-fennec\\/50 { --fid-gvia: hsl(var(--fennec-orange) / 0.5); }
[data-fennec-lib-root] .from-fennec\\/20 { --fid-gfrom: hsl(var(--fennec-orange) / 0.2); }
[data-fennec-lib-root] .via-fennec\\/5 { --fid-gvia: hsl(var(--fennec-orange) / 0.05); }
[data-fennec-lib-root] .to-holo-purple { --fid-gto: hsl(var(--holo-purple)); }

/* Base Layouts */
#fennec-root {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 20px;
    box-sizing: border-box;
}

.card-scene {
    perspective: 1200px;
    width: 336px;
    height: 490px;
    position: relative;
}

.card-object {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    border-radius: 20px;
}

.card-face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.face-front {
    transform: rotateY(0deg);
    z-index: 2;
}

.face-back {
    transform: rotateY(180deg);
    z-index: 1;
}

.is-flipped .card-object {
    transform: rotateY(180deg);
}

/* Textures & FX */
.bg-obsidian { background: var(--gradient-obsidian); }

.noise-texture::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    opacity: 0.03;
    pointer-events: none;
    z-index: 1;
    mix-blend-mode: overlay;
}

.scanlines::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      hsl(0 0% 0% / 0.03) 2px,
      hsl(0 0% 0% / 0.03) 4px
    );
    pointer-events: none;
    z-index: 5;
}

.holo-sheen::after {
    content: '';
    position: absolute;
    inset: -50%;
    background: linear-gradient(
      115deg,
      transparent 20%,
      hsl(var(--holo-cyan) / 0.1) 35%,
      hsl(var(--holo-purple) / 0.15) 45%,
      hsl(var(--fennec-orange) / 0.1) 55%,
      transparent 70%
    );
    transform: translateX(-100%) rotate(25deg);
    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    z-index: 10;
}

.card-object:hover .holo-sheen::after {
    transform: translateX(100%) rotate(25deg);
}

.glass-module {
    background: linear-gradient(
      180deg,
      hsl(var(--glass-white) / 0.06) 0%,
      hsl(var(--glass-white) / 0.02) 100%
    );
    backdrop-filter: blur(12px);
    border: 1px solid hsl(var(--glass-white) / 0.08);
    border-radius: 0.75rem;
}

.inner-glow {
    box-shadow:
      inset 0 0 80px hsl(var(--fennec-orange) / 0.08),
      inset 0 1px 0 hsl(var(--glass-white) / 0.1),
      0 25px 60px -15px hsl(0 0% 0% / 0.8);
}

/* Animations */
@keyframes heartbeat {
    0% { transform: scale(1); box-shadow: 0 0 20px hsl(var(--fennec-orange) / 0.3); }
    15% { transform: scale(1.008); box-shadow: 0 0 45px hsl(var(--fennec-orange) / 0.6); }
    30% { transform: scale(1.002); }
    45% { transform: scale(1.005); }
    60%, 100% { transform: scale(1); }
}
.heartbeat-pulse {
    animation: heartbeat 1.8s ease-in-out infinite;
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

/* Typography & Colors */
.neon-text {
    text-shadow: 0 0 10px hsl(var(--fennec-orange) / 0.8), 0 0 30px hsl(var(--fennec-orange) / 0.5);
}
.neon-text-subtle {
    text-shadow: 0 0 8px hsl(var(--fennec-orange) / 0.5);
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
    text-shadow: 0 0 20px hsl(var(--fennec-orange) / 0.4);
}

.net-worth-display {
    font-size: 2.2rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: hsl(var(--foreground));
    text-shadow: 0 0 40px hsl(var(--fennec-orange) / 0.4);
}

/* Components */
.badge-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}

.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 10px; }

/* Evolution Tiers */
.rarity-cub { --tier-color: 240 4% 46%; }
.rarity-hunter { --tier-color: var(--holo-blue); }
.rarity-elder { --tier-color: var(--fennec-orange); }
.rarity-spirit { --tier-color: var(--holo-purple); }

.fid-sync-card {
    background: rgba(0,0,0,0.30);
    border: 1px solid hsl(var(--border));
    border-radius: 16px;
    padding: 12px;
}
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

    function pickArchetype(dna) {
        const a = dna && typeof dna === 'object' ? dna.archetype : null;
        const baseKey = (a && (a.baseKey || a.key)) || dna.rank || dna.archetype || 'DRIFTER';
        const title = (a && (a.title || a.name)) || baseKey;
        const tierLabel = (a && (a.tierLabel || a.tier)) || dna.tier || '';
        const tierLevel = (a && (a.tierLevel || a.level)) || dna.tierLevel || 0;
        return {
            baseKey: String(baseKey || 'DRIFTER').toUpperCase(),
            title: String(title || 'DRIFTER'),
            tierLabel: String(tierLabel || ''),
            tierLevel: clamp(tierLevel, 0, 3)
        };
    }

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

    const BADGE_DEFS = {
        GENESIS: {
            name: 'GENESIS',
            icon: '💎',
            desc: 'You witnessed the first sunrise over the Fractal dunes.'
        },
        WHALE: {
            name: 'WHALE',
            icon: '🐋',
            desc: 'When you move, the sands shift beneath you.'
        },
        PROVIDER: {
            name: 'PROVIDER',
            icon: '💧',
            desc: 'The desert is thirsty, but your well runs deep.'
        },
        'FENNEC MAXI': {
            name: 'FENNEC MAXI',
            icon: '🔥',
            desc: 'The Spirit of the Fox guides your path.'
        },
        'ARTIFACT HUNTER': {
            name: 'ARTIFACT HUNTER',
            icon: '🏺',
            desc: 'Your pockets are heavy with echoes of the chain.'
        },
        'RUNE KEEPER': {
            name: 'RUNE KEEPER',
            icon: '🧿',
            desc: 'You decipher the glyphs. The stones speak to you.'
        },
        'MEMPOOL RIDER': {
            name: 'MEMPOOL RIDER',
            icon: '⚡',
            desc: 'Surfing the chaos of the 30-second block waves.'
        },
        'SAND SWEEPER': {
            name: 'SAND SWEEPER',
            icon: '🧹',
            desc: 'Your UTXO set is clean. No trash left in the dunes.'
        }
    };

    const FX_KEYS = [
        'prism-ribbon',
        'scanlines',
        'stardust',
        'aurora-flow',
        'glass-shards',
        'sandstorm',
        'neon-grid',
        'emberfall',
        'photon-ring',
        'holo-wave',
        'reactive-sheen',
        'gold-stripe'
    ];

    function normalizeFxKey(v) {
        const s = String(v || '')
            .trim()
            .toLowerCase();
        if (!s) return '';
        return s.replace(/[^a-z0-9\-]/g, '');
    }

    function fxKeyFromSeed(seedBase) {
        const base = String(seedBase || '');
        const s = `${base}:fx`;
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        const idx = (h >>> 0) % FX_KEYS.length;
        return FX_KEYS[idx];
    }

    function miscAssetRef(config, key, fallbackPath) {
        const map = config && config.assets && config.assets.misc ? config.assets.misc : {};
        const ref = (map && map[key]) || '';
        return resolveAssetRef(ref || fallbackPath || '');
    }

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
                        icon: def ? def.icon : '🏷️',
                        img: ''
                    };
                }
                const rawName = String(b.name || '').trim();
                const key = rawName.toUpperCase();
                const def = BADGE_DEFS[key] || null;
                const desc = String(b.desc || '').trim() || (def ? def.desc : '');
                const icon = String(b.icon || '').trim() || (def ? def.icon : '🏷️');
                return {
                    name: def ? def.name : rawName,
                    desc,
                    icon,
                    img: b.img ? String(b.img) : ''
                };
            })
            .filter(Boolean)
            .filter(b => b.name);
    }

    function safeText(s) {
        return String(s || '').replace(/[<>&]/g, c => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
    }

    function showToast(text) {
        const msg = (text || '').trim();
        if (!msg) return;
        const el = document.createElement('div');
        el.className = 'fid-toast';
        el.textContent = msg;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('on'));
        setTimeout(() => {
            el.classList.remove('on');
            setTimeout(() => el.remove(), 220);
        }, 1200);
    }

    function buildBadgeEl(badge, config, allowImg) {
        const el = document.createElement('div');
        el.className = 'fid-badge';
        const tip = badge.desc ? `${badge.name} — ${badge.desc}` : badge.name;
        el.title = tip;
        el.setAttribute('data-tip', String(badge.name || '').trim());

        const imgSrc = allowImg && badge.img ? badge.img : '';
        const mapped =
            config && config.assets && config.assets.badges && badge.name ? config.assets.badges[badge.name] : '';

        if (allowImg && (mapped || imgSrc)) {
            const img = document.createElement('img');
            img.src = resolveAssetRef(mapped || imgSrc);
            img.alt = badge.name;
            img.onerror = () => {
                img.remove();
                el.textContent = badge.icon || '🏷️';
            };
            el.appendChild(img);
            return el;
        }

        el.textContent = badge.icon || '🏷️';
        return el;
    }

    function backgroundFor(archetypeKey, config) {
        const key = String(archetypeKey || 'DRIFTER').toUpperCase();
        const map = config && config.assets && config.assets.backgrounds ? config.assets.backgrounds : {};
        const idOrUrl = map[key] || map['*'] || '';
        return idOrUrl ? String(idOrUrl) : '';
    }

    function computeIdentityFromFractalAudit(apiData, config) {
        const data = apiData && typeof apiData === 'object' ? apiData : {};
        const scoring =
            (config && config.scoring && typeof config.scoring === 'object'
                ? config.scoring
                : DEFAULT_CONFIG.scoring) || DEFAULT_CONFIG.scoring;
        const prices = data.prices || {};
        const fbPrice = Number(prices.fb || 0) || 0;
        const fennecInFb = Number(prices.fennec_in_fb || 0) || 0;
        const nativeBalance = Number(data.native_balance || 0) || 0;
        const lpValueUSD = Number(data.lp_value_usd || 0) || 0;
        const allTokensValueUSD = Number(data.all_tokens_value_usd || 0) || 0;

        const fbWallet = Number(data.native_balance || data.fb_native_balance || 0) || 0;
        const fbSwap =
            Number(
                data.fb_inswap_balance || data.fb_swap_balance || data.fb_in_swap_balance || data.inswap_fb_balance || 0
            ) || 0;
        const fbStaked = Number(data.staked_fb || data.fb_staked || 0) || 0;
        const fbTotal = fbWallet + fbSwap + fbStaked;

        const fennecWallet = Number(data.fennec_wallet_balance || 0) || 0;
        const fennecSwap = Number(data.fennec_inswap_balance || 0) || 0;
        const fennecNative = Number(data.fennec_native_balance || 0) || 0;
        const fennecTotal = fennecNative || fennecWallet + fennecSwap;
        const fennecLpValueUSD = Number(data.fennec_lp_value_usd || 0) || 0;
        const fennecValueUSD = fennecInFb > 0 && fbPrice > 0 ? fennecTotal * fennecInFb * fbPrice : 0;

        const netWorthUSD = Math.max(0, allTokensValueUSD + lpValueUSD);

        const txCount = Number(data.tx_count || 0) || 0;
        const utxoCount = Number(data.utxo_count || 0) || 0;
        const firstTxTs = Number(data.first_tx_ts || 0) || 0;

        const stats = {
            runes: Number(data.runes_count || 0) || 0,
            brc20: Number(data.brc20_count || 0) || 0,
            ordinals: Number(data.ordinals_count || 0) || 0
        };
        stats.total =
            (Number(stats.brc20 || 0) || 0) + (Number(stats.runes || 0) || 0) + (Number(stats.ordinals || 0) || 0);

        const now = Math.floor(Date.now() / 1000);
        let daysAlive = 0;
        if (firstTxTs > 0 && firstTxTs <= now) {
            daysAlive = Math.ceil((now - firstTxTs) / 86400);
            if (daysAlive < 1) daysAlive = 1;
        }

        const abandonedUtxoCount = Number(data.abandoned_utxo_count);
        const hasFennecInLP = !!data.has_fennec_in_lp;
        const hasFennecBoxes = !!data.has_fennec_boxes;
        const fennecBoxesCount = Number(data.fennec_boxes_count || 0) || 0;

        const rulesCtx = {
            launchDate: Number(scoring.launchDate || 0) || 0,
            genesisWindowSec: Number(scoring.genesisWindowSec || 0) || 0,
            txCount,
            utxoCount,
            daysAlive,
            firstTxTs,
            netWorthUSD,
            lpValueUSD,
            abandonedUtxoCount: Number.isFinite(abandonedUtxoCount) ? abandonedUtxoCount : null,
            fennecTotal,
            hasFennecInLP,
            inscriptionsTotal: stats.total,
            runesCount: stats.runes
        };

        function resolveExpr(expr) {
            if (!expr || typeof expr !== 'object') return null;
            if (Array.isArray(expr)) return null;
            if (expr.ref) return Number(rulesCtx[String(expr.ref)]);
            if (expr.add && Array.isArray(expr.add)) {
                return expr.add.reduce((sum, item) => {
                    const v = resolveExpr(item);
                    return sum + (Number.isFinite(v) ? Number(v) : 0);
                }, 0);
            }
            return null;
        }

        function evalLeaf(rule) {
            if (!rule || typeof rule !== 'object') return false;
            const field = String(rule.field || '').trim();
            if (!field) return false;
            const op = String(rule.op || '==').trim();
            const left = rulesCtx[field];
            let right;
            if (rule.valueExpr && typeof rule.valueExpr === 'object') right = resolveExpr(rule.valueExpr);
            else if (rule.valueRef) right = rulesCtx[String(rule.valueRef)];
            else right = rule.value;

            if (op === '==') return left === right;
            if (op === '!=') return left !== right;
            if (left === null || left === undefined) return false;
            if (right === null || right === undefined) return false;
            const l = Number(left);
            const r = Number(right);
            if (!Number.isFinite(l) || !Number.isFinite(r)) return false;
            if (op === '>=') return l >= r;
            if (op === '>') return l > r;
            if (op === '<=') return l <= r;
            if (op === '<') return l < r;
            return false;
        }

        function evalRule(rule) {
            if (!rule || typeof rule !== 'object') return false;
            if (Array.isArray(rule)) return false;
            if (rule.all && Array.isArray(rule.all)) return rule.all.every(evalRule);
            if (rule.any && Array.isArray(rule.any)) return rule.any.some(evalRule);
            if (rule.not) return !evalRule(rule.not);
            return evalLeaf(rule);
        }

        const badgeDefs = Array.isArray(scoring.badgeDefinitions) ? scoring.badgeDefinitions : [];
        const badges = [];
        let badgeWeights = {};

        if (badgeDefs.length > 0) {
            for (const def of badgeDefs) {
                if (!def || typeof def !== 'object') continue;
                const name = String(def.name || '').trim();
                if (!name) continue;
                badgeWeights[name] = Number(def.weight || 0) || 0;
                const ok = def.rules ? evalRule(def.rules) : false;
                if (!ok) continue;
                badges.push({ name, icon: def.icon || '🏷️', desc: def.desc || '' });
            }
        } else {
            const launchDate = Number(scoring.launchDate || 1725840000) || 1725840000;
            const genesisWindowSec = Number(scoring.genesisWindowSec || 86400) || 86400;
            const isGenesis = firstTxTs > 0 && firstTxTs >= launchDate && firstTxTs < launchDate + genesisWindowSec;
            const isLiquidityProvider = lpValueUSD >= 50;
            const isWhale = netWorthUSD >= 500;
            const isArtifactHunter = stats.total >= 50;
            const isRuneKeeper = (stats.runes || 0) >= 20;
            const isMempoolRider = txCount >= 10000;
            const isSandSweeper = Number.isFinite(abandonedUtxoCount) && abandonedUtxoCount < 50;
            const isMaxi = fennecTotal >= 10000 || hasFennecInLP || hasFennecBoxes;

            badgeWeights = {
                GENESIS: 15,
                WHALE: 10,
                PROVIDER: 8,
                'ARTIFACT HUNTER': 3,
                'RUNE KEEPER': 3,
                'MEMPOOL RIDER': 7,
                'SAND SWEEPER': 3,
                'FENNEC MAXI': 0
            };

            if (isGenesis)
                badges.push({
                    name: 'GENESIS',
                    icon: '💎',
                    desc: 'You witnessed the first sunrise over the Fractal dunes.'
                });
            if (isWhale)
                badges.push({ name: 'WHALE', icon: '🐋', desc: 'When you move, the sands shift beneath you.' });
            if (isLiquidityProvider)
                badges.push({ name: 'PROVIDER', icon: '💧', desc: 'The desert is thirsty, but your well runs deep.' });
            if (isMaxi)
                badges.push({ name: 'FENNEC MAXI', icon: '🔥', desc: 'The Spirit of the Fox guides your path.' });
            if (isArtifactHunter)
                badges.push({
                    name: 'ARTIFACT HUNTER',
                    icon: '🏺',
                    desc: 'Your pockets are heavy with echoes of the chain.'
                });
            if (isRuneKeeper)
                badges.push({
                    name: 'RUNE KEEPER',
                    icon: '🧿',
                    desc: 'You decipher the glyphs. The stones speak to you.'
                });
            if (isMempoolRider)
                badges.push({
                    name: 'MEMPOOL RIDER',
                    icon: '⚡',
                    desc: 'Surfing the chaos of the 30-second block waves.'
                });
            if (isSandSweeper)
                badges.push({
                    name: 'SAND SWEEPER',
                    icon: '🧹',
                    desc: 'Your UTXO set is clean. No trash left in the dunes.'
                });
        }

        const hasBadge = n => badges.some(b => b && b.name === n);
        const maxiFromRules = scoring.maxi && scoring.maxi.rules ? evalRule(scoring.maxi.rules) : false;
        const hasMaxi = hasBadge('FENNEC MAXI') || maxiFromRules;

        const isGenesis = hasBadge('GENESIS');
        const isLiquidityProvider = hasBadge('PROVIDER');
        const isWhale = hasBadge('WHALE');
        const isArtifactHunter = hasBadge('ARTIFACT HUNTER');
        const isRuneKeeper = hasBadge('RUNE KEEPER');

        const hasFennecSoul = hasFennecBoxes || fennecWallet >= 100 || Number(data.fennec_lp_value_usd || 0) >= 1;

        const badgeCount = badges.length;

        let baseKey = 'DRIFTER';
        if (isGenesis && isLiquidityProvider && isWhale) baseKey = 'PRIME';
        else if (Number(data.lp_value_usd || 0) >= 200) baseKey = 'LORD';
        else if (isGenesis) baseKey = 'WALKER';
        else if (isArtifactHunter && isRuneKeeper) baseKey = 'KEEPER';
        else if (txCount > 1000) baseKey = 'ENGINEER';
        else if (netWorthUSD >= 100) baseKey = 'MERCHANT';
        else if ((stats.runes || 0) >= 20) baseKey = 'SHAMAN';
        else baseKey = 'DRIFTER';

        if (badgeCount >= 7) baseKey = 'SINGULARITY';

        let tierLevel = 0;
        if (badgeCount >= 6) tierLevel = 3;
        else if (badgeCount >= 4) tierLevel = 2;
        else if (badgeCount >= 2) tierLevel = 1;

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

        const evo = tierNames[baseKey] || tierNames.DRIFTER;
        const title = evo[Math.min(tierLevel, evo.length - 1)];

        const pointsCfg = (scoring && scoring.points) || {};
        const activityMax = Number(pointsCfg.activityMax || 30) || 30;
        const wealthMax = Number(pointsCfg.wealthMax || 20) || 20;
        const timeMax = Number(pointsCfg.timeMax || 15) || 15;
        const badgesMax = Number(pointsCfg.badgesMax || 35) || 35;

        const actCfg = scoring.activity || {};
        const maxTx = Number(actCfg.maxTx || 10000) || 10000;
        const actCurve = String(actCfg.curve || 'log');
        const txCap = Math.min(txCount, maxTx);
        const activityPoints =
            actCurve === 'linear'
                ? Math.round(activityMax * (maxTx > 0 ? txCap / maxTx : 0))
                : Math.round(activityMax * (Math.log10(1 + txCap) / Math.log10(1 + maxTx)));

        const wCfg = scoring.wealth || {};
        const maxNW = Number(wCfg.maxNetWorthUSD || 500) || 500;
        const wCurve = String(wCfg.curve || 'sqrt');
        const nwCap = Math.min(netWorthUSD, maxNW);
        const wealthPoints =
            wCurve === 'linear'
                ? Math.round(wealthMax * (maxNW > 0 ? nwCap / maxNW : 0))
                : Math.round(wealthMax * Math.sqrt(maxNW > 0 ? nwCap / maxNW : 0));

        const tCfg = scoring.time || {};
        const maxDays = Number(tCfg.maxDays || 365) || 365;
        const dCap = Math.min(daysAlive, maxDays);
        const timePoints = Math.round(timeMax * (maxDays > 0 ? dCap / maxDays : 0));

        const badgesPointsRaw = badges.reduce((sum, b) => sum + (badgeWeights[b.name] || 0), 0);
        const badgesPoints = Math.min(badgesMax, badgesPointsRaw);
        const baseScore = Math.min(100, activityPoints + wealthPoints + timePoints + badgesPoints);
        const maxiCfg = scoring.maxi || {};
        const multiplier = hasMaxi ? Number(maxiCfg.multiplier || 1.2) || 1.2 : 1;
        const activityScore = Math.min(100, Math.round(baseScore * multiplier));

        let rarityName = 'CUB';
        const thresholds = Array.isArray(scoring.rarityThresholds) ? scoring.rarityThresholds : [];
        for (const t of thresholds) {
            if (!t || typeof t !== 'object') continue;
            const nm = String(t.name || '').trim();
            const min = Number(t.min);
            if (!nm || !Number.isFinite(min)) continue;
            if (activityScore >= min) {
                rarityName = nm;
                break;
            }
        }

        return {
            archetype: {
                baseKey,
                title,
                tierLabel: '',
                tierLevel,
                badges
            },
            badges,
            metrics: {
                wealth: Number(netWorthUSD || 0).toFixed(2),
                netWorthUSD: Number(netWorthUSD || 0).toFixed(2),
                fbPrice: Number(fbPrice || 0) || 0,
                lpValueUSD: Number(lpValueUSD || 0).toFixed(2),
                nativeBalance: Number(nativeBalance || 0).toFixed(4),
                fbWalletBalance: Number(fbWallet || 0).toFixed(4),
                fbSwapBalance: Number(fbSwap || 0).toFixed(4),
                fbStakedBalance: Number(fbStaked || 0).toFixed(4),
                fbTotal: Number(fbTotal || 0).toFixed(4),
                abandonedUtxoCount: Number.isFinite(abandonedUtxoCount) ? abandonedUtxoCount : null,
                daysAlive,
                first_tx_ts: firstTxTs,
                txCount,
                utxoCount,
                rarityName,
                activityScore,
                hasFennecSoul,
                hasFennecMaxi: hasMaxi,
                inscriptionStats: stats,
                fennecNativeBalance: Number(fennecNative || 0).toFixed(2),
                fennecWalletBalance: Number(fennecWallet || 0).toFixed(2),
                fennecInSwapBalance: Number(fennecSwap || 0).toFixed(2),
                fennecLpValueUSD: Number(fennecLpValueUSD || 0).toFixed(2),
                fennecBalance: Number(fennecTotal || 0).toFixed(2),
                hasFennecBoxes,
                fennecBoxesCount,
                hasFennecInLP
            }
        };
    }

    async function runOracle(scene, snapshotDna, config) {
        const oracle = (config && config.oracle) || {};
        if (!oracle.enabled) return;

        let silent = false;
        let isContent = false;
        let isAllowedHost = false;
        let isSiteHost = false;
        let allowCosmetics = false;
        let isFramed = false;
        try {
            isContent = !!(window.location && String(window.location.pathname || '').indexOf('/content/') === 0);
        } catch (_) {}
        try {
            isFramed = (() => {
                try {
                    return window.self !== window.top || window.self !== window.parent;
                } catch (_) {
                    return true;
                }
            })();
        } catch (_) {}
        try {
            const host = String((window.location && window.location.hostname) || '').toLowerCase();
            isSiteHost =
                !host ||
                host === 'localhost' ||
                host === '127.0.0.1' ||
                host === '0.0.0.0' ||
                host === 'fennecbtc.xyz' ||
                host.endsWith('.fennecbtc.xyz');
            isAllowedHost =
                isSiteHost ||
                host === 'uniscan.cc' ||
                host.endsWith('.uniscan.cc') ||
                host === 'fractal-static.unisat.space' ||
                host.endsWith('.unisat.space');
        } catch (_) {}
        if (!isAllowedHost) return;
        allowCosmetics = isSiteHost && !isContent && !isFramed;
        silent = !allowCosmetics;

        const address = (snapshotDna && snapshotDna.address ? String(snapshotDna.address) : '').trim();
        if (!address) return;

        const refreshMsRaw = Number(oracle.refreshMs);
        const refreshMs = Number.isFinite(refreshMsRaw) ? refreshMsRaw : 45000;
        const baseKey = `fennec_evo_base_${address}`;

        const readBase = () => {
            try {
                if (!allowCosmetics) return null;
                const raw = localStorage.getItem(baseKey);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : null;
            } catch (_) {
                return null;
            }
        };

        const writeBaseIfMissing = base => {
            try {
                if (!allowCosmetics) return;
                if (!base) return;
                if (localStorage.getItem(baseKey)) return;
                localStorage.setItem(baseKey, JSON.stringify(base));
            } catch (_) {}
        };

        const endpoint = (getMeta('fennec-oracle-endpoint') || oracle.endpoint || '').trim();
        const action = (getMeta('fennec-oracle-action') || oracle.action || 'fractal_audit').trim();
        if (!endpoint) return;

        const pubkey = (getMeta('fennec-pubkey') || '').trim();
        const url = pubkey
            ? `${endpoint}?action=${encodeURIComponent(action)}&address=${encodeURIComponent(address)}&pubkey=${encodeURIComponent(pubkey)}`
            : `${endpoint}?action=${encodeURIComponent(action)}&address=${encodeURIComponent(address)}`;

        let allowEvolve = true;
        try {
            const hasIdMeta = String(getMeta('fennec-has-id') || '')
                .trim()
                .toLowerCase();
            if (hasIdMeta === '0' || hasIdMeta === 'false' || hasIdMeta === 'no') {
                allowEvolve = false;
            }
        } catch (_) {}

        let syncLogoSrc = '';
        try {
            syncLogoSrc = String(getMeta('fennec-sync-logo') || '').trim();
        } catch (_) {}
        if (!syncLogoSrc) {
            try {
                syncLogoSrc = String(miscAssetRef(config, 'LOGO', '') || '').trim();
            } catch (_) {}
        }

        const overlay = document.createElement('div');
        overlay.className = 'fid-sync';
        overlay.innerHTML = `
  ${syncLogoSrc ? `<div class="fid-sync-logo"><img alt="FENNEC ID" src="${safeText(syncLogoSrc)}" onerror="this.remove()" /></div>` : ''}
  <div class="fid-sync-wave"><span></span><span></span><span></span></div>
`;

        const card = scene.querySelector('.fid-card');
        if (card && oracle.showSyncFx && !silent) {
            card.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('on'));
        }

        const controller = new AbortController();
        const timeoutMs = Number(oracle.timeoutMs || 0) || 8000;
        const tid = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(url, { signal: controller.signal, cache: 'force-cache' });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const json = await res.json().catch(() => null);
            if (!json || typeof json !== 'object') {
                throw new Error('invalid json');
            }
            if (json && json.error) {
                throw new Error(String(json.error || 'oracle error'));
            }
            const payload = json && typeof json === 'object' ? json.data || json : null;
            if (!payload) {
                throw new Error('no data');
            }

            try {
                const v = Number(payload.schema_version);
                if (payload.schema_version !== undefined && !Number.isFinite(v)) {
                    throw new Error('invalid schema_version');
                }
            } catch (e) {
                throw new Error('oracle schema mismatch');
            }

            const identity = computeIdentityFromFractalAudit(payload, config);
            try {
                if (typeof window !== 'undefined' && typeof window.onFennecOracleIdentity === 'function') {
                    window.onFennecOracleIdentity(identity, payload);
                }
            } catch (_) {}

            const baseStored = readBase();
            const snapshotScore = Number(
                (snapshotDna && snapshotDna.metrics && snapshotDna.metrics.activityScore) ||
                    (snapshotDna && snapshotDna.metrics && snapshotDna.metrics.score) ||
                    0
            );
            const snapshotRarity = rarityFromScore(snapshotScore);
            const snapshotBadges = normalizeBadges(snapshotDna);
            const snapshotArch = pickArchetype(snapshotDna);

            writeBaseIfMissing({
                archetype: snapshotArch,
                badges: snapshotBadges,
                rarityKey: snapshotRarity.key,
                activityScore: snapshotScore
            });

            const base = baseStored || {
                archetype: snapshotArch,
                badges: snapshotBadges,
                rarityKey: snapshotRarity.key,
                activityScore: snapshotScore
            };

            const nextScore = Number((identity && identity.metrics && identity.metrics.activityScore) || 0);
            const nextRarity = rarityFromScore(nextScore);
            const nextBadges = normalizeBadges(identity);
            const nextArch = pickArchetype(identity);

            const baseBadgeNames = new Set((base.badges || []).map(b => String(b.name || '').trim()));
            const nextBadgeNames = new Set((nextBadges || []).map(b => String(b.name || '').trim()));
            let badgeUp = false;
            for (const nm of nextBadgeNames) {
                if (nm && !baseBadgeNames.has(nm)) {
                    badgeUp = true;
                    break;
                }
            }
            const tierUp = Number(nextArch.tierLevel || 0) > Number(base.archetype?.tierLevel || 0);
            const rarityUp = String(nextRarity.key) !== String(base.rarityKey || '');
            const evoReady = allowCosmetics && allowEvolve && (tierUp || badgeUp || rarityUp);

            const newDna = deepMerge(snapshotDna || {}, identity);
            newDna.address = address;
            newDna.metrics = deepMerge((snapshotDna && snapshotDna.metrics) || {}, identity.metrics || {});
            newDna.archetype = deepMerge((snapshotDna && snapshotDna.archetype) || {}, identity.archetype || {});
            newDna.badges = identity.badges || identity.archetype?.badges || [];

            const renderedDna = !allowCosmetics
                ? deepMerge(newDna, {
                      archetype: snapshotArch,
                      badges: snapshotBadges,
                      __fennecEvoReady: { ready: false }
                  })
                : evoReady
                  ? deepMerge(newDna, {
                        archetype: base.archetype,
                        badges: base.badges,
                        metrics: deepMerge(newDna.metrics || {}, {
                            activityScore: Number(base.activityScore || snapshotScore) || 0
                        }),
                        __fennecEvoReady: {
                            ready: true,
                            next: { archetype: nextArch, badges: nextBadges, rarityKey: nextRarity.key },
                            nextDna: newDna
                        }
                    })
                  : deepMerge(newDna, { __fennecEvoReady: { ready: false } });

            const newScene = createCard(renderedDna, deepMerge(config || {}, { oracle: { enabled: false } }));
            scene.replaceWith(newScene);
            try {
                clearTimeout(scene.__fennec_oracle_timer);
            } catch (_) {}
            if (refreshMs > 0) {
                newScene.__fennec_oracle_timer = setTimeout(() => {
                    runOracle(newScene, renderedDna, config);
                }, refreshMs);
            }
        } catch (e) {
            if (e && e.name === 'AbortError') {
                if (!silent) showToast('Oracle timeout');
                try {
                    clearTimeout(scene.__fennec_oracle_timer);
                } catch (_) {}
                if (refreshMs > 0) {
                    scene.__fennec_oracle_timer = setTimeout(() => {
                        runOracle(scene, snapshotDna, config);
                    }, refreshMs);
                }
                return;
            }
            let msg = 'Oracle sync failed';
            try {
                const detail = e && e.message ? String(e.message) : '';
                if (detail) msg = `Oracle sync failed: ${detail}`;
            } catch (_) {}
            try {
                console.warn('Fennec oracle sync failed:', e);
            } catch (_) {}
            if (!silent) showToast(msg);
            try {
                clearTimeout(scene.__fennec_oracle_timer);
            } catch (_) {}
            if (refreshMs > 0) {
                scene.__fennec_oracle_timer = setTimeout(() => {
                    runOracle(scene, snapshotDna, config);
                }, refreshMs);
            }
        } finally {
            clearTimeout(tid);
            if (overlay && overlay.parentNode) {
                overlay.classList.remove('on');
                setTimeout(() => overlay.remove(), 220);
            }
        }
    }

    function initTilt(sceneEl, cardEl, isFlippedFn) {
        const isFlipped = typeof isFlippedFn === 'function' ? isFlippedFn : () => false;

        function setVars(mxp, myp, tier) {
            const tiltStrength = tier === 0 ? 5 : tier === 1 ? 8 : tier === 2 ? 12 : 16;

            cardEl.style.setProperty('--mxp', `${mxp.toFixed(2)}%`);
            cardEl.style.setProperty('--myp', `${myp.toFixed(2)}%`);

            const nx = (mxp - 50) / 50;
            const ny = (myp - 50) / 50;
            cardEl.style.setProperty('--px', `${(nx * 10).toFixed(2)}px`);
            cardEl.style.setProperty('--py', `${(ny * 10).toFixed(2)}px`);
            cardEl.style.setProperty('--npx', `${(nx * 4).toFixed(2)}px`);
            cardEl.style.setProperty('--npy', `${(ny * 4).toFixed(2)}px`);

            const rx = (-ny * tiltStrength).toFixed(2);
            const ry = (nx * tiltStrength).toFixed(2);
            if (!isFlipped()) {
                cardEl.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
            }
        }

        let tier = 0;
        try {
            const t = Number(cardEl.getAttribute('data-tier') || 0);
            tier = Number.isFinite(t) ? t : 0;
        } catch (_) {}

        const idleDelayMs = 4000;
        const state = { active: false, lastMove: 0, start: performance.now(), raf: 0, mxp: 50, myp: 50 };

        function idleLoop() {
            state.raf = requestAnimationFrame(idleLoop);
            const now = performance.now();
            const idleFor = now - state.lastMove;
            if (state.active && idleFor < idleDelayMs) return;
            state.mxp += (50 - state.mxp) * 0.085;
            state.myp += (50 - state.myp) * 0.085;
            if (Math.abs(state.mxp - 50) < 0.05) state.mxp = 50;
            if (Math.abs(state.myp - 50) < 0.05) state.myp = 50;
            setVars(state.mxp, state.myp, tier);
        }

        function onPointer(clientX, clientY) {
            const rect = cardEl.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const mxp = Math.max(0, Math.min(100, (x / rect.width) * 100));
            const myp = Math.max(0, Math.min(100, (y / rect.height) * 100));
            state.active = true;
            state.lastMove = performance.now();
            state.mxp = mxp;
            state.myp = myp;
            setVars(mxp, myp, tier);
        }

        cardEl.addEventListener('mousemove', e => onPointer(e.clientX, e.clientY));
        cardEl.addEventListener('mouseenter', () => {
            state.active = true;
            state.lastMove = performance.now();
        });
        cardEl.addEventListener('mouseleave', () => {
            state.active = false;
            state.lastMove = performance.now();
        });
        cardEl.addEventListener(
            'touchmove',
            e => {
                if (!e.touches || !e.touches[0]) return;
                onPointer(e.touches[0].clientX, e.touches[0].clientY);
            },
            { passive: true }
        );
        cardEl.addEventListener('touchend', () => {
            state.active = false;
            state.lastMove = performance.now();
        });

        state.mxp = 50;
        state.myp = 50;
        setVars(50, 50, tier);
        state.raf = requestAnimationFrame(idleLoop);
    }

    function createCard(dna, config) {
        injectStyles();

        const archetype = pickArchetype(dna);
        const badges = normalizeBadges(dna);
        const metrics = dna && dna.metrics && typeof dna.metrics === 'object' ? dna.metrics : {};
        const activityScore = Number(metrics.activityScore ?? metrics.score ?? 0) || 0;
        const rarity = rarityFromScore(activityScore);

        const scene = document.createElement('div');
        scene.className = 'card-scene';
        scene.setAttribute('data-fennec-lib-root', '1');

        const cardObject = document.createElement('div');
        cardObject.className = 'card-object heartbeat-pulse';

        // Border Color Logic
        const tierColor =
            rarity.key === 'spirit'
                ? 'hsl(var(--holo-purple))'
                : rarity.key === 'elder'
                  ? 'hsl(var(--fennec-orange))'
                  : rarity.key === 'hunter'
                    ? 'hsl(var(--holo-blue))'
                    : 'hsl(240 4% 46%)';

        cardObject.style.border = `3px solid ${tierColor}`;

        // Laser Border Effect
        const laserBorder = document.createElement('div');
        laserBorder.style.cssText = `
            position: absolute; inset: -3px; border-radius: 22px; z-index: -1; opacity: 0.6;
            background: linear-gradient(90deg, hsl(var(--fennec-orange)), hsl(var(--holo-purple)), hsl(var(--holo-cyan)), hsl(var(--fennec-orange)));
            background-size: 300% 100%; animation: laser-flow 4s linear infinite; filter: blur(8px);
        `;
        cardObject.appendChild(laserBorder);

        // FRONT FACE
        const front = document.createElement('div');
        front.className = 'card-face face-front bg-obsidian';

        // Build badges for front
        const badgesFrontHtml = badges
            .slice(0, 6)
            .map(b => {
                const glow = 'drop-shadow(0 0 8px hsl(var(--fennec-orange) / 0.5))';
                const imgRef = b.img ? resolveAssetRef(b.img) : '';
                return `
                <div class="glass-module p-1 flex items-center justify-center w-8 h-8 relative group" title="${b.name}">
                    ${imgRef ? `<img src="${imgRef}" class="w-full h-full object-contain" style="filter: ${glow}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">` : ''}
                    <span style="${imgRef ? 'display:none;' : ''}font-size:14px; filter: ${glow}">${b.icon || '🏷️'}</span>
                </div>
            `;
            })
            .join('');

        const frontContent = `
            <div class="absolute inset-0 bg-gradient-to-br from-obsidian-light/80 via-background to-background/90"></div>
            <div class="noise-texture absolute inset-0"></div>
            <div class="scanlines absolute inset-0"></div>
            <div class="holo-sheen absolute inset-0 z-10"></div>
            <div class="absolute inset-0 inner-glow rounded-[18px]"></div>

            <div class="relative z-20 p-5 flex justify-between items-start">
                <div class="flex gap-2">${badgesFrontHtml}</div>
                <div class="glass-module px-3 py-1.5 flex items-center gap-1.5">
                    <span class="text-[10px] font-tactical font-bold text-foreground/80">#${dna.inscriptionNumber || '????'}</span>
                </div>
            </div>

            <div class="flex-1 relative z-10 flex items-center justify-center">
                <div class="relative">
                    <div class="w-40 h-40 rounded-full bg-gradient-radial from-fennec/20 via-fennec/5 to-transparent animate-pulse-glow"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <span class="text-6xl select-none">🦊</span>
                    </div>
                </div>
            </div>

            <div class="relative z-20 mt-auto px-5 pb-6">
                <div class="text-center mb-4">
                    <div class="inline-block glass-module px-4 py-1 mb-3">
                        <span class="holo-text text-[11px] font-tactical font-bold tracking-widest uppercase">${archetype.tierLabel || rarity.name}</span>
                    </div>
                    <h2 class="text-2xl font-display font-black uppercase italic leading-none neon-text tracking-tight">${archetype.title}</h2>
                </div>
                <div class="h-px w-full bg-gradient-to-r from-transparent via-fennec/50 to-transparent mb-4"></div>
                <div class="flex items-center justify-between gap-2">
                    ${
                        metrics.hasFennecSoul
                            ? `
                    <div class="flex items-center gap-1.5 heartbeat-pulse rounded-lg px-2 py-1 bg-fennec/10 border border-fennec/20">
                        <span class="text-[10px] font-tactical font-bold text-fennec">SOUL</span>
                    </div>`
                            : '<div></div>'
                    }
                    <div class="text-right ml-auto">
                        <div class="text-[8px] font-tactical text-muted-foreground tracking-[0.2em] mb-0.5">EVOLUTION</div>
                        <div class="text-sm font-tactical font-bold tracking-widest uppercase holo-text">${rarity.name}</div>
                    </div>
                </div>
                <div class="text-[9px] font-tactical text-muted-foreground text-center tracking-[0.15em] mt-3 opacity-60">TAP CARD FOR DETAILS</div>
            </div>
        `;
        front.innerHTML = frontContent;

        // BACK FACE
        const back = document.createElement('div');
        back.className = 'card-face face-back bg-obsidian';

        const backContent = `
            <div class="absolute inset-0 bg-gradient-to-b from-obsidian-light/50 via-background to-background"></div>
            <div class="noise-texture absolute inset-0"></div>
            <div class="scanlines absolute inset-0"></div>
            <div class="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                <span class="text-[200px]">🦊</span>
            </div>
            <div class="absolute inset-0 inner-glow rounded-[18px]"></div>

            <div class="relative z-10 p-4 border-b border-border/30">
                <div class="flex justify-center items-center gap-2 mb-3">
                    <div class="w-2 h-2 rounded-full bg-fennec animate-pulse"></div>
                    <span class="text-[10px] font-tactical font-bold text-muted-foreground tracking-[0.25em]">FENNEC ID SYSTEM</span>
                    <div class="w-2 h-2 rounded-full bg-fennec animate-pulse"></div>
                </div>
                <div class="flex gap-2">
                    <button class="fid-tab-btn active flex-1 py-2 px-3 rounded-lg text-[10px] font-tactical font-bold tracking-wider transition-all duration-300 bg-fennec/20 text-fennec border border-fennec/40 neon-text-subtle" data-tab="stats">CORE STATS</button>
                    <button class="fid-tab-btn flex-1 py-2 px-3 rounded-lg text-[10px] font-tactical font-bold tracking-wider transition-all duration-300 glass-module text-muted-foreground hover:text-foreground" data-tab="badges">ACHIEVEMENTS</button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-4 relative z-10 custom-scroll" id="card-back-content">
                <!-- Content injected here via JS -->
            </div>
        `;
        back.innerHTML = backContent;

        const renderStats = () => {
            const wealth = Number(metrics.wealth || metrics.netWorthUSD || 0).toLocaleString();
            return `
                <div class="space-y-3">
                    <div class="glass-module p-4 text-center relative overflow-hidden">
                        <div class="text-[9px] font-tactical text-muted-foreground tracking-[0.2em] mb-2">NET WORTH</div>
                        <div class="net-worth-display font-tactical">$${wealth}</div>
                    </div>

                    <div class="fid-sync-card">
                        <div class="text-[10px] font-tactical text-fennec tracking-[0.15em] mb-3 text-center font-bold">SCORE BREAKDOWN</div>
                        <div class="space-y-2.5">
                            <div class="flex justify-between mb-1">
                                <span class="text-[9px] font-tactical text-muted-foreground uppercase">Activity Score</span>
                                <span class="text-[10px] font-tactical font-bold text-foreground stat-glow">${activityScore}%</span>
                            </div>
                            <div class="h-1.5 rounded-full bg-secondary/30 overflow-hidden">
                                <div class="h-full rounded-full bg-gradient-to-r from-fennec to-holo-purple transition-all duration-500" style="width: ${activityScore}%"></div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                        <div class="glass-module p-3 text-center">
                            <div class="text-[8px] font-tactical text-muted-foreground tracking-wider mb-1">TXS</div>
                            <div class="text-sm font-tactical font-bold text-foreground stat-glow">${metrics.txCount || 0}</div>
                        </div>
                        <div class="glass-module p-3 text-center">
                            <div class="text-[8px] font-tactical text-muted-foreground tracking-wider mb-1">AGE</div>
                            <div class="text-sm font-tactical font-bold text-foreground stat-glow">${metrics.daysAlive || 0}D</div>
                        </div>
                        <div class="glass-module p-3 text-center">
                            <div class="text-[8px] font-tactical text-muted-foreground tracking-wider mb-1">UTXO</div>
                            <div class="text-sm font-tactical font-bold text-foreground stat-glow">${metrics.utxoCount || 0}</div>
                        </div>
                    </div>
                </div>
            `;
        };

        const renderBadges = () => {
            const earnedSet = new Set(badges.map(b => b.name));
            return `
                <div class="badge-grid">
                    ${BADGE_ORDER.map(name => {
                        const def = BADGE_DEFS[name] || { name, icon: '🏷️', desc: '' };
                        const isEarned = earnedSet.has(name);
                        const mapped =
                            config && config.assets && config.assets.badges && name ? config.assets.badges[name] : '';
                        const ref = resolveAssetRef(mapped || '');

                        return `
                            <div class="glass-module p-3 text-center transition-all duration-300 ${isEarned ? 'border-fennec/30' : 'opacity-40'}" title="${def.desc}">
                                <div class="text-2xl mb-1.5">
                                    ${ref ? `<img src="${ref}" class="w-8 h-8 mx-auto object-contain">` : def.icon}
                                </div>
                                <div class="text-[8px] font-tactical text-muted-foreground tracking-wider ${isEarned ? 'text-fennec' : ''}">${def.name}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        };

        const backContentArea = back.querySelector('#card-back-content');
        backContentArea.innerHTML = renderStats();

        // Tab Switching Logic
        back.querySelectorAll('.fid-tab-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const tab = btn.getAttribute('data-tab');
                back.querySelectorAll('.fid-tab-btn').forEach(b => {
                    b.classList.remove('active', 'bg-fennec/20', 'text-fennec', 'border-fennec/40', 'neon-text-subtle');
                    b.classList.add('glass-module', 'text-muted-foreground');
                });
                btn.classList.add('active', 'bg-fennec/20', 'text-fennec', 'border-fennec/40', 'neon-text-subtle');
                btn.classList.remove('glass-module', 'text-muted-foreground');

                if (tab === 'stats') backContentArea.innerHTML = renderStats();
                else backContentArea.innerHTML = renderBadges();
            });
        });

        cardObject.appendChild(front);
        cardObject.appendChild(back);
        scene.appendChild(cardObject);

        // Evolution Ready UI Logic
        const evoState = dna && typeof dna === 'object' ? dna.__fennecEvoReady : null;
        if (evoState && evoState.ready) {
            const evoLayer = document.createElement('div');
            evoLayer.className =
                'fid-evo-ready absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[18px]';
            evoLayer.innerHTML = `
                <div class="glass-module p-6 text-center max-w-[80%] border-fennec/40 shadow-[0_0_30px_rgba(255,107,53,0.2)]">
                    <div class="text-fennec text-xs font-tactical font-bold mb-2 tracking-[0.2em]">EVOLUTION READY</div>
                    <p class="text-[10px] text-foreground/70 mb-4 font-tactical">Your stats have evolved. Evolve your ID to unlock new visuals.</p>
                    <button class="px-4 py-2 bg-fennec text-black font-tactical font-black rounded-lg text-[10px] uppercase hover:bg-orange-500 transition-colors">Evolve Now</button>
                </div>
            `;
            const evoBtn = evoLayer.querySelector('button');
            evoBtn.addEventListener('click', e => {
                e.stopPropagation();
                // Call evolution logic here if needed or open external link
                const addr = (dna.address || '').trim();
                if (addr) window.open(`https://fennecbtc.xyz/?evolve=${encodeURIComponent(addr)}`, '_blank');
            });
            front.appendChild(evoLayer);
        }

        // Tilt & Flip Logic
        let isFlipped = false;
        scene.addEventListener('click', e => {
            if (e.target.closest('button')) return;
            isFlipped = !isFlipped;
            scene.classList.toggle('is-flipped', isFlipped);
            if (!isFlipped) {
                cardObject.style.transform = 'rotateX(0deg) rotateY(0deg)';
            }
        });

        scene.addEventListener('mousemove', e => {
            if (isFlipped) return;
            const rect = scene.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -15;
            const rotateY = ((x - centerX) / centerX) * 15;
            cardObject.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        scene.addEventListener('mouseleave', () => {
            if (isFlipped) return;
            cardObject.style.transform = 'rotateX(0deg) rotateY(0deg)';
        });

        return scene;
    }

    function renderInto(container, dna, config) {
        const target = container || document.body;
        target.innerHTML = '';
        target.appendChild(createCard(dna, config));
    }

    async function init() {
        try {
            const now = Date.now();
            const last = Number(window.__fennec_id_init_last_at || 0) || 0;
            if (now - last < 1000) return;
            window.__fennec_id_init_last_at = now;
        } catch (_) {}
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

        try {
            let inscId = '';
            try {
                const p = (window.location && window.location.pathname) || '';
                const m = String(p).match(/\/content\/([^/?#]+)/);
                if (m && m[1]) inscId = String(m[1]).trim();
            } catch (_) {}
            if (inscId) {
                const old = document.getElementById('fennec-inscription-caption');
                if (old) old.remove();
                const cap = document.createElement('div');
                cap.id = 'fennec-inscription-caption';
                cap.className = 'fid-inscription';
                let num = '';
                try {
                    const parts = inscId.split('i');
                    if (parts.length >= 2) {
                        const lastPart = parts[parts.length - 1];
                        if (lastPart && /^\d+$/.test(lastPart)) num = lastPart;
                    }
                } catch (_) {}
                cap.innerHTML = `${num ? `#${safeText(num)}` : 'INSCRIPTION'}<span class="fid-inscription-id">${safeText(
                    inscId
                )}</span>`;
                root.appendChild(cap);
            }
        } catch (_) {}
    }

    window.initFennecID = init;

    window.FennecIDLib = {
        loadConfig,
        createCard,
        renderInto,
        computeIdentityFromFractalAudit
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
            try {
                const meta = document.querySelector('meta[name="fennec-embed"]');
                const isEmbed = meta && String(meta.getAttribute('content') || '').trim() === '1';
                if (isEmbed) return;
            } catch (_) {}
            if (document.getElementById('dna-data') || document.getElementById('user-data')) {
                init();
            }
        }, 0);
    }
})();
