(function () {
    const cards = Array.from(document.querySelectorAll('.preview-card'));
    if (!cards.length) return;

    let lastClientX = null;
    let lastClientY = null;

    const onWindowMouseMove = e => {
        lastClientX = e.clientX;
        lastClientY = e.clientY;
    };

    try {
        window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    } catch (e) {
        window.addEventListener('mousemove', onWindowMouseMove);
    }

    function setTintVars(card, tier) {
        const overlay = card.querySelector('[class^="overlay-"], [class*=" overlay-"]');
        const cls = overlay ? overlay.className || '' : '';
        const has = name => cls.includes(`overlay-${name}`);

        let rgb = '255, 200, 0';
        let rgb2 = '255, 230, 150';
        let mult = 0.55;
        if (has('ENGINEER')) {
            rgb = '0, 255, 170';
            rgb2 = '255, 0, 80';
            mult = tier === 3 ? 1.24 : 1;
        }

        card.style.setProperty('--vfx-rgb', rgb);
        card.style.setProperty('--vfx-rgb2', rgb2);
        card.style.setProperty('--vfx3d-mult', String(mult));
    }

    function inferTier(card) {
        const overlay = card.querySelector('[class^="overlay-"], [class*=" overlay-"]');
        const overlayClass = overlay ? overlay.className || '' : '';

        // PRIME and SINGULARITY always use max tier
        if (overlayClass.includes('overlay-PRIME') || overlayClass.includes('overlay-SINGULARITY')) {
            return 3;
        }

        const img = card.querySelector('img');
        const cls = img ? img.className || '' : '';
        if (cls.includes('img-tier-0')) return 0;
        if (cls.includes('anim-tier-1')) return 1;
        if (cls.includes('anim-tier-2-')) return 2;
        if (/(^|\s)anim-(?!tier-)/.test(cls)) return 3;
        return 0;
    }

    function setVars(card, mxp, myp, tier) {
        const tiltStrength = tier === 0 ? 2 : tier === 1 ? 3 : tier === 2 ? 4 : 5;

        card.style.setProperty('--mxp', `${mxp.toFixed(2)}%`);
        card.style.setProperty('--myp', `${myp.toFixed(2)}%`);

        const nx = (mxp - 50) / 50;
        const ny = (myp - 50) / 50;
        card.style.setProperty('--px', `${(nx * 10).toFixed(2)}px`);
        card.style.setProperty('--py', `${(ny * 10).toFixed(2)}px`);
        card.style.setProperty('--npx', `${(nx * 4).toFixed(2)}px`);
        card.style.setProperty('--npy', `${(ny * 4).toFixed(2)}px`);

        if (card.__vfxWebgl) {
            card.__vfxWebgl.pointer[0] = Math.max(0, Math.min(1, mxp / 100));
            card.__vfxWebgl.pointer[1] = Math.max(0, Math.min(1, 1 - myp / 100));
            card.__vfxWebgl.tilt[0] = Math.max(-1, Math.min(1, nx));
            card.__vfxWebgl.tilt[1] = Math.max(-1, Math.min(1, -ny));
        }

        const rx = (-ny * tiltStrength).toFixed(2);
        const ry = (nx * tiltStrength).toFixed(2);
        card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }

    function resetCardTilt(card) {
        const tier = Number(card.__tiltPreviewTier || 0) || 0;
        const state = card.__tiltPreviewState;
        if (state) {
            state.active = false;
            state.lastMove = performance.now();
        }
        setVars(card, 50, 50, tier);
    }

    function syncCardTiltFromPointer(card) {
        const state = card.__tiltPreviewState;
        const tier = Number(card.__tiltPreviewTier || 0) || 0;
        if (!state) return;
        if (lastClientX == null || lastClientY == null) return;

        const rect = card.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height) return;
        const x = lastClientX - rect.left;
        const y = lastClientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

        const mxp = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const myp = Math.max(0, Math.min(100, (y / rect.height) * 100));
        state.active = true;
        state.lastMove = performance.now();
        setVars(card, mxp, myp, tier);
    }

    for (const card of cards) {
        const tier = inferTier(card);
        setTintVars(card, tier);
        const overlay = card.querySelector('[class^="overlay-"], [class*=" overlay-"]');
        const cls = overlay ? overlay.className || '' : '';

        // previews: keep only tilt (no webgl / no 3d vfx layers)
        if (card.__vfxWebgl && card.__vfxWebgl.raf) {
            try {
                cancelAnimationFrame(card.__vfxWebgl.raf);
            } catch (e) {
                void e;
            }
        }
        card.__vfxWebgl = null;
        card.__vfx3d = null;

        const idleAmp = tier === 0 ? 1.2 : tier === 1 ? 1.8 : tier === 2 ? 2.4 : 3;

        const state = {
            active: false,
            lastMove: 0,
            start: performance.now(),
            raf: 0,
            running: true
        };

        card.__tiltPreviewState = state;
        card.__tiltPreviewTier = tier;

        const idleLoop = () => {
            if (!state.running) {
                state.raf = 0;
                return;
            }

            state.raf = requestAnimationFrame(idleLoop);
            const now = performance.now();
            const t = (now - state.start) / 1000;
            const idle = now - state.lastMove > 200;

            if (!idle && state.active) return;

            const mxp = 50 + Math.sin(t * 0.55) * idleAmp;
            const myp = 50 + Math.cos(t * 0.43) * (idleAmp * 0.85);
            setVars(card, mxp, myp, tier);
        };

        state.startLoop = () => {
            if (!state.running) return;
            if (state.raf) return;
            state.raf = requestAnimationFrame(idleLoop);
        };

        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const mxp = Math.max(0, Math.min(100, (x / rect.width) * 100));
            const myp = Math.max(0, Math.min(100, (y / rect.height) * 100));
            state.active = true;
            state.lastMove = performance.now();
            setVars(card, mxp, myp, tier);
        });

        card.addEventListener('mouseenter', () => {
            state.active = true;
            state.lastMove = performance.now();
        });

        card.addEventListener('mouseleave', () => {
            state.active = false;
            state.lastMove = performance.now();
        });

        card.addEventListener(
            'touchmove',
            e => {
                if (!e.touches || !e.touches[0]) return;
                const rect = card.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const y = e.touches[0].clientY - rect.top;
                const mxp = Math.max(0, Math.min(100, (x / rect.width) * 100));
                const myp = Math.max(0, Math.min(100, (y / rect.height) * 100));
                state.active = true;
                state.lastMove = performance.now();
                setVars(card, mxp, myp, tier);
            },
            { passive: true }
        );

        card.addEventListener('touchend', () => {
            state.active = false;
            state.lastMove = performance.now();
        });

        setVars(card, 50, 50, tier);
        state.startLoop();
    }

    const pauseAll = () => {
        for (const card of cards) {
            const state = card.__tiltPreviewState;
            if (state) {
                state.running = false;
                if (state.raf) {
                    cancelAnimationFrame(state.raf);
                    state.raf = 0;
                }
            }
            resetCardTilt(card);
        }
    };

    const resumeAll = () => {
        for (const card of cards) {
            const state = card.__tiltPreviewState;
            if (state) {
                state.running = true;
                state.start = performance.now();
                state.lastMove = performance.now();
                if (typeof state.startLoop === 'function') state.startLoop();
            }
            syncCardTiltFromPointer(card);
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseAll();
        } else {
            resumeAll();
        }
    });

    window.addEventListener('blur', pauseAll);
    window.addEventListener('focus', resumeAll);
})();
