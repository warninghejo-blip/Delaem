(function () {
    const cards = Array.from(document.querySelectorAll('.preview-card'));
    if (!cards.length) return;

    function ensureVfx3d(card, tier) {
        if (!card || card.__vfx3d || tier < 1) return;

        const shade = card.querySelector('.shade');
        const wrap = document.createElement('div');
        wrap.className = 'vfx-3d';
        const vfxOpacity = tier === 1 ? 0.18 : tier === 2 ? 0.34 : 0.52;
        wrap.style.setProperty('--vfx3d-opacity', String(vfxOpacity));

        if (shade) card.insertBefore(wrap, shade);
        else card.appendChild(wrap);

        card.__vfx3d = wrap;

        // Disable the legacy preview-card ::before/::after VFX so we don't double-stack.
        card.style.setProperty('--vfx3d-opacity', '0');
    }

    function ensureWebgl(card, tier, archetype) {
        if (!card || card.__vfxWebgl || tier < 1) return;

        const shade = card.querySelector('.shade');
        const wrap = document.createElement('div');
        wrap.className = 'vfx-webgl';
        const vfxWebglOpacity = tier === 1 ? 0.12 : tier === 2 ? 0.18 : 0.26;
        wrap.style.setProperty('--vfxwebgl-opacity', String(vfxWebglOpacity));
        wrap.innerHTML = '<canvas></canvas>';

        if (shade) card.insertBefore(wrap, shade);
        else card.appendChild(wrap);

        const canvas = wrap.querySelector('canvas');
        const gl =
            canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true }) ||
            canvas.getContext('experimental-webgl');
        if (!gl) {
            wrap.style.opacity = '0';
            return;
        }

        const vertSrc =
            'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=(aPos+1.0)*0.5; gl_Position=vec4(aPos,0.0,1.0); }';
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
            mult = tier === 3 ? 1.26 : 1;
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
            dpr: Math.min(2, window.devicePixelRatio || 1),
            lastSize: [0, 0],
            tint1,
            tint2,
            strength,
            active: false,
            raf: 0
        };
        card.__vfxWebgl = state;

        function render() {
            if (!state.active) {
                state.raf = 0;
                return;
            }
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

        state.active = true;
        state.raf = requestAnimationFrame(render);
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

    function tierOpacity(tier) {
        if (tier === 1) return 0.18;
        if (tier === 2) return 0.34;
        if (tier === 3) return 0.52;
        return 0;
    }

    function setVars(card, mxp, myp, tier, fromMouse) {
        const tiltStrength = tier === 0 ? 5 : tier === 1 ? 8 : tier === 2 ? 12 : 16;

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
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }

    for (const card of cards) {
        const tier = inferTier(card);
        setTintVars(card, tier);
        const overlay = card.querySelector('[class^="overlay-"], [class*=" overlay-"]');
        const cls = overlay ? overlay.className || '' : '';
        const archetype = (cls.match(/overlay-([A-Z_]+)/) || [])[1] || '';
        const vfxKey = archetype === 'ENGINEER' ? 'ENGINEER' : 'MERCHANT';

        ensureWebgl(card, tier, vfxKey);
        ensureVfx3d(card, tier);
        if (tier < 1) card.style.setProperty('--vfx3d-opacity', String(tierOpacity(tier)));

        const idleAmp = tier === 0 ? 2 : tier === 1 ? 3 : tier === 2 ? 4.5 : 6;

        const state = {
            active: false,
            lastMove: 0,
            start: performance.now(),
            raf: 0
        };

        function idleLoop() {
            state.raf = requestAnimationFrame(idleLoop);
            const now = performance.now();
            const t = (now - state.start) / 1000;
            const idle = now - state.lastMove > 200;

            if (!idle && state.active) return;

            const mxp = 50 + Math.sin(t * 0.55) * idleAmp;
            const myp = 50 + Math.cos(t * 0.43) * (idleAmp * 0.85);
            setVars(card, mxp, myp, tier, false);
        }

        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const mxp = Math.max(0, Math.min(100, (x / rect.width) * 100));
            const myp = Math.max(0, Math.min(100, (y / rect.height) * 100));
            state.active = true;
            state.lastMove = performance.now();
            setVars(card, mxp, myp, tier, true);
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
                setVars(card, mxp, myp, tier, true);
            },
            { passive: true }
        );

        card.addEventListener('touchend', () => {
            state.active = false;
            state.lastMove = performance.now();
        });

        setVars(card, 50, 50, tier, false);
        state.raf = requestAnimationFrame(idleLoop);
    }
})();
