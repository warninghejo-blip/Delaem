(function () {
    if (window.__fennecSpaRouter) return;
    window.__fennecSpaRouter = true;

    const VIEW_ID = 'router-view';
    const FADE_CLASS = 'router-fade-out';
    const FADE_MS = 180;

    const CACHE_TTL_MS = 5 * 60 * 1000;
    const __cache = new Map();
    const __inflight = new Map();

    function __getView() {
        try {
            return document.getElementById(VIEW_ID);
        } catch (_) {
            return null;
        }
    }

    function __toUrl(href) {
        try {
            return new URL(String(href || ''), window.location.href);
        } catch (_) {
            return null;
        }
    }

    function __resolvePathname(pathname) {
        const p = String(pathname || '').trim();
        if (!p || p === '/') return '/index.html';
        if (p.endsWith('/')) return p + 'index.html';
        if (p.toLowerCase().endsWith('.html')) return p;
        return '/index.html';
    }

    function __routeKey(pathname) {
        const p = __resolvePathname(pathname).toLowerCase();
        if (p.endsWith('/terminal.html')) return 'terminal';
        if (p.endsWith('/id.html')) return 'audit';
        return 'home';
    }

    function __setActiveNav(pathname) {
        try {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        } catch (_) {}

        const key = __routeKey(pathname);
        const id = key === 'terminal' ? 'nav-terminal' : key === 'audit' ? 'nav-audit' : 'nav-home';
        try {
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
        } catch (_) {}
    }

    function __runRouteInit(pathname) {
        const key = __routeKey(pathname);

        if (key === 'terminal') {
            try {
                if (typeof window.seedChartPriceFromCache === 'function') window.seedChartPriceFromCache();
            } catch (_) {}
            try {
                if (typeof window.fetchReserves === 'function') window.fetchReserves();
            } catch (_) {}
            try {
                if (typeof window.updatePriceData === 'function') window.updatePriceData();
            } catch (_) {}
            try {
                if (document.getElementById('priceChart') && typeof window.initChart === 'function') {
                    setTimeout(() => {
                        try {
                            window.initChart();
                        } catch (_) {}
                    }, 250);
                }
            } catch (_) {}
            try {
                if (window.userAddress && typeof window.checkBalance === 'function') window.checkBalance();
            } catch (_) {}
            try {
                if (window.userAddress && typeof window.refreshTransactionHistory === 'function') {
                    setTimeout(() => {
                        try {
                            window.refreshTransactionHistory();
                        } catch (_) {}
                    }, 600);
                }
            } catch (_) {}
            return;
        }

        if (key === 'audit') {
            try {
                if (typeof window.__ensureAuditUi === 'function') window.__ensureAuditUi();
                else if (typeof window.initAudit === 'function') window.initAudit();
            } catch (_) {}
            return;
        }

        try {
            if (typeof window.updateVisionFennecIdCta === 'function') window.updateVisionFennecIdCta();
        } catch (_) {}
    }

    async function __fetchHtml(pathname, search) {
        const p = __resolvePathname(pathname);
        const s = String(search || '');
        const key = p + s;
        const now = Date.now();

        const cached = __cache.get(key);
        if (cached && now - cached.ts < CACHE_TTL_MS) return cached.html;

        const inflight = __inflight.get(key);
        if (inflight) return inflight;

        const prom = fetch(key, { cache: 'no-store' })
            .then(r => {
                if (!r.ok) throw new Error('Route fetch failed');
                return r.text();
            })
            .then(html => {
                __cache.set(key, { html, ts: Date.now() });
                __inflight.delete(key);
                return html;
            })
            .catch(err => {
                __inflight.delete(key);
                throw err;
            });

        __inflight.set(key, prom);
        return prom;
    }

    function __extractViewInner(html) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        const v = doc.getElementById(VIEW_ID);
        return { inner: v ? v.innerHTML : null, title: doc.title || '' };
    }

    async function __swapTo(targetUrl) {
        const view = __getView();
        if (!view) return;

        if (window.__fennecRouting) return;
        window.__fennecRouting = true;

        try {
            try {
                view.classList.add(FADE_CLASS);
            } catch (_) {}

            await new Promise(r => setTimeout(r, FADE_MS));

            const pathname = __resolvePathname(targetUrl.pathname);
            const html = await __fetchHtml(pathname, targetUrl.search);
            const extracted = __extractViewInner(html);

            if (extracted.inner == null) {
                window.location.href = pathname + (targetUrl.search || '') + (targetUrl.hash || '');
                return;
            }

            view.innerHTML = extracted.inner;

            try {
                if (extracted.title) document.title = extracted.title;
            } catch (_) {}

            try {
                view.classList.remove(FADE_CLASS);
            } catch (_) {}

            try {
                window.scrollTo(0, 0);
            } catch (_) {}

            __setActiveNav(pathname);
            __runRouteInit(pathname);
        } finally {
            window.__fennecRouting = false;
        }
    }

    async function __navigate(href, opts) {
        const options = opts && typeof opts === 'object' ? opts : {};
        const u = __toUrl(href);
        if (!u) return;

        if (u.origin !== window.location.origin) {
            window.location.href = u.href;
            return;
        }

        const pathname = __resolvePathname(u.pathname);
        const nextHref = pathname + (u.search || '') + (u.hash || '');

        if (!options.noPush) {
            try {
                if (options.replace) window.history.replaceState({}, '', nextHref);
                else window.history.pushState({}, '', nextHref);
            } catch (_) {}
        }

        await __swapTo(u);
    }

    function __bindPrefetchLinks() {
        try {
            document.querySelectorAll('a[data-link]').forEach(link => {
                if (link && link.dataset && link.dataset.prefetchBound === '1') return;
                if (link && link.dataset) link.dataset.prefetchBound = '1';

                link.addEventListener(
                    'mouseenter',
                    () => {
                        try {
                            const href = link.getAttribute('href');
                            if (!href || href.startsWith('#')) return;
                            const u = __toUrl(href);
                            if (!u || u.origin !== window.location.origin) return;
                            const pathname = __resolvePathname(u.pathname);
                            __fetchHtml(pathname, u.search).catch(() => void 0);
                        } catch (_) {
                            void _;
                        }
                    },
                    { passive: true }
                );
            });
        } catch (_) {
            void _;
        }
    }

    window.__fennecNavigate = function (href, opts) {
        return __navigate(href, opts);
    };

    document.addEventListener('click', ev => {
        try {
            if (ev.defaultPrevented) return;
            if (ev.button !== 0) return;
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

            const a = ev.target && ev.target.closest ? ev.target.closest('a[data-link]') : null;
            if (!a) return;

            const href = a.getAttribute('href');
            if (!href || href.startsWith('#')) return;
            if (a.hasAttribute('download')) return;
            const target = String(a.getAttribute('target') || '').trim();
            if (target && target !== '_self') return;

            const u = __toUrl(href);
            if (!u || u.origin !== window.location.origin) return;

            ev.preventDefault();
            __navigate(u.href);
        } catch (_) {}
    });

    // Warm cache on hover for snappier SPA transitions
    try {
        __bindPrefetchLinks();
    } catch (_) {}

    window.addEventListener('popstate', () => {
        try {
            __navigate(window.location.href, { noPush: true, replace: true });
        } catch (_) {}
    });

    try {
        __setActiveNav(window.location.pathname);
        __runRouteInit(window.location.pathname);
        __bindPrefetchLinks();
    } catch (_) {}
})();
