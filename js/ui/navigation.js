/**
 * Navigation module for section switching and routing
 */

export function showSection(id) {
    const sections = document.querySelectorAll('.page-section');
    if (sections.length === 0) {
        console.warn('Sections not loaded yet');
        return;
    }
    sections.forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });

    // Restore audit cache if switching to terminal/audit
    if (id === 'terminal' || id === 'audit') {
        if (window.auditCache && typeof window.renderAudit === 'function') {
            setTimeout(() => {
                try {
                    window.renderAudit(window.auditCache);
                } catch (_) {}
            }, 50);
        }
    }

    if (id === 'audit') {
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
        const cleanId = String(id || '').trim();
        if (cleanId) localStorage.setItem('fennec_last_section', cleanId);
    } catch (_) {}

    // Update hash if hash router is enabled
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

    // Don't reset UI if scan/open is in progress
    try {
        const addrNow = String(window.userAddress || '').trim();
        const activeMode = String((window.__fennecAuditUi && window.__fennecAuditUi.mode) || 'idle');
        if (!addrNow && (activeMode === 'scanning' || activeMode === 'opening')) {
            return;
        }
    } catch (_) {}

    // Hide refresh button for certain sections
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        if (id === 'audit' || id === 'terminal' || id === 'home') {
            refreshBtn.classList.add('hidden');
        } else {
            if (window.userAddress) {
                refreshBtn.classList.remove('hidden');
            }
        }
    }
}

export function setupSectionRouter() {
    if (typeof window.initAuditLoading === 'undefined') window.initAuditLoading = false;

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

        if (window.__fennecUseHashRouter !== false) {
            const onHash = () => {
                try {
                    if (window.__fennecSectionHashWrite) return;
                    const h = String(window.location.hash || '').replace(/^#/, '');
                    if (h) showSection(h);
                } catch (_) {}
            };
            window.addEventListener('hashchange', onHash, false);

            setTimeout(() => {
                try {
                    const h = String(window.location.hash || '').replace(/^#/, '');
                    if (h) {
                        showSection(h);
                        return;
                    }
                    const saved = (() => {
                        try {
                            return String(localStorage.getItem('fennec_last_section') || '').trim();
                        } catch (_) {
                            return '';
                        }
                    })();
                    if (saved) {
                        const target = document.getElementById(`sec-${saved}`);
                        if (target) {
                            showSection(saved);
                            return;
                        }
                    }
                    const firstSection = document.querySelector('.page-section[id^="sec-"]');
                    if (firstSection) {
                        const secId = firstSection.id.replace('sec-', '');
                        showSection(secId);
                    }
                } catch (_) {}
            }, 0);
        }
    }
}

// Export helper for audit
export function fennecInitAuditSafe() {
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
