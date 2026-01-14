(function () {
    const canvas = document.getElementById('animatedBackgroundCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ['rgba(249, 115, 22, ', 'rgba(251, 146, 60, ', 'rgba(234, 88, 12, ', 'rgba(255, 186, 120, '];

    const mouse = { x: 0, y: 0 };
    let cw = 0;
    let ch = 0;
    let dpr = 1;
    let particles = [];
    let raf = 0;

    function resizeCanvas() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        cw = Math.max(1, window.innerWidth || 1);
        ch = Math.max(1, window.innerHeight || 1);

        canvas.width = Math.max(1, Math.floor(cw * dpr));
        canvas.height = Math.max(1, Math.floor(ch * dpr));
        try {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } catch (_) {}
    }

    function createParticles() {
        const particleCount = Math.min(220, Math.max(60, Math.floor((cw * ch) / 18000)));
        const out = [];
        for (let i = 0; i < particleCount; i++) {
            out.push({
                x: Math.random() * cw,
                y: Math.random() * ch,
                size: Math.random() * 2 + 0.5,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.5 + 0.2,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
        return out;
    }

    function drawGradientBackground() {
        const gradient = ctx.createRadialGradient(cw / 2, ch / 3, 0, cw / 2, ch / 2, cw);
        gradient.addColorStop(0, 'rgba(40, 25, 15, 1)');
        gradient.addColorStop(0.5, 'rgba(20, 12, 8, 1)');
        gradient.addColorStop(1, 'rgba(10, 6, 4, 1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, cw, ch);

        const glowGradient = ctx.createRadialGradient(cw / 2, 0, 0, cw / 2, 0, ch * 0.8);
        glowGradient.addColorStop(0, 'rgba(249, 115, 22, 0.15)');
        glowGradient.addColorStop(0.3, 'rgba(249, 115, 22, 0.05)');
        glowGradient.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = glowGradient;
        ctx.fillRect(0, 0, cw, ch);

        const mx = mouse.x || 0;
        const my = mouse.y || 0;
        const mouseGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 300);
        mouseGlow.addColorStop(0, 'rgba(249, 115, 22, 0.08)');
        mouseGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.02)');
        mouseGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = mouseGlow;
        ctx.fillRect(0, 0, cw, ch);
    }

    function drawParticles() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color}${p.opacity})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
            g.addColorStop(0, `${p.color}${p.opacity * 0.5})`);
            g.addColorStop(1, `${p.color}0)`);
            ctx.fillStyle = g;
            ctx.fill();
        }
    }

    function connectParticles() {
        const maxDistance = 150;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < maxDistance) {
                    const opacity = (1 - dist / maxDistance) * 0.35;
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(249, 115, 22, ${opacity})`;
                    ctx.lineWidth = 1.2;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function updateParticles() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.speedX;
            p.y += p.speedY;

            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.0001 && dist < 200) {
                const force = (200 - dist) / 200;
                p.x -= (dx / dist) * force * 0.5;
                p.y -= (dy / dist) * force * 0.5;
            }

            if (p.x < 0) p.x = cw;
            if (p.x > cw) p.x = 0;
            if (p.y < 0) p.y = ch;
            if (p.y > ch) p.y = 0;

            p.opacity += (Math.random() - 0.5) * 0.01;
            p.opacity = Math.max(0.1, Math.min(0.7, p.opacity));
        }
    }

    function animate() {
        drawGradientBackground();
        updateParticles();
        connectParticles();
        drawParticles();
        raf = requestAnimationFrame(animate);
    }

    function handleMouseMove(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }

    function cleanup() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }

    const onVisibilityChange = function () {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (document.hidden) {
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            return;
        }
        if (!raf) animate();
    };

    const onResize = function () {
        resizeCanvas();
        particles = createParticles();
    };

    resizeCanvas();
    particles = createParticles();

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        drawGradientBackground();
    } else {
        animate();
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', cleanup, { once: true });
})();
