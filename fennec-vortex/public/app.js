async function j(url, opts) {
    const res = await fetch(url, opts);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
        const msg = json?.error || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json;
}

const els = {
    health: document.getElementById('health'),
    from: document.getElementById('from'),
    to: document.getElementById('to'),
    amount: document.getElementById('amount'),
    min: document.getElementById('min'),
    estimate: document.getElementById('estimate'),
    toAddress: document.getElementById('toAddress'),
    refundAddress: document.getElementById('refundAddress'),
    btnCreate: document.getElementById('btnCreate'),
    createOut: document.getElementById('createOut'),
    btnReload: document.getElementById('btnReload'),
    history: document.getElementById('history')
};

function option(value, label) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    return o;
}

function fmt(v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    return String(v);
}

async function loadHealth() {
    try {
        const res = await fetch('/api/health');
        const json = await res.json();
        els.health.textContent = json?.ok ? `api:ok key:${json.hasKey ? 'yes' : 'no'}` : 'api:error';
    } catch {
        els.health.textContent = 'api:error';
    }
}

async function loadCurrencies() {
    const { data } = await j('/api/changenow/currencies');
    const list = Array.isArray(data) ? data : [];

    els.from.innerHTML = '';
    els.to.innerHTML = '';

    for (const c of list) {
        const ticker = (c?.ticker || '').toLowerCase();
        if (!ticker) continue;
        const label = `${ticker.toUpperCase()} — ${c?.name || ''}`.trim();
        els.from.appendChild(option(ticker, label));
        els.to.appendChild(option(ticker, label));
    }

    if (els.from.options.length) els.from.value = 'btc';
    if (els.to.options.length) els.to.value = 'eth';
}

async function loadMin() {
    els.min.value = '';
    const from = els.from.value;
    const to = els.to.value;
    if (!from || !to) return;

    try {
        const { data } = await j(
            `/api/changenow/min-amount?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        els.min.value = fmt(data?.minAmount ?? data);
    } catch {
        els.min.value = '';
    }
}

async function loadEstimate() {
    els.estimate.textContent = '-';
    const from = els.from.value;
    const to = els.to.value;
    const amount = els.amount.value.trim();
    if (!from || !to || !amount) return;

    try {
        const { data } = await j(
            `/api/changenow/estimate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`
        );
        els.estimate.textContent = typeof data === 'number' ? `${data}` : JSON.stringify(data);
    } catch (e) {
        els.estimate.textContent = `error: ${e.message}`;
    }
}

function renderHistory(items) {
    els.history.innerHTML = '';
    for (const it of items) {
        const div = document.createElement('div');
        div.className = 'rounded-xl border border-white/10 bg-black/30 p-3';
        const from = it?.request?.from?.toUpperCase?.() || '';
        const to = it?.request?.to?.toUpperCase?.() || '';
        const amount = it?.request?.amount;
        const txid = it?.response?.id || it?.response?.transactionId || it?.response?.payinAddress || '';
        div.innerHTML = `
            <div class="flex items-baseline justify-between gap-3">
                <div class="text-xs font-bold tracking-widest text-zinc-200">${from} → ${to}</div>
                <div class="text-[10px] font-mono text-zinc-500">${it.createdAt || ''}</div>
            </div>
            <div class="mt-2 text-[11px] font-mono text-zinc-300">amount: ${amount ?? ''}</div>
            <div class="mt-2 text-[11px] font-mono text-zinc-400 break-all">id: ${it?.response?.id || it?.response?.transactionId || it?.response?.payinAddress || ''}</div>
        `;
        els.history.appendChild(div);
    }
}

async function reloadHistory() {
    const { data } = await j('/api/local/exchanges');
    renderHistory(Array.isArray(data) ? data : []);
}

async function onCreate() {
    els.createOut.textContent = '';
    els.btnCreate.disabled = true;
    try {
        const payload = {
            from: els.from.value,
            to: els.to.value,
            amount: els.amount.value,
            toAddress: els.toAddress.value,
            refundAddress: els.refundAddress.value
        };
        const res = await j('/api/changenow/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        els.createOut.textContent = JSON.stringify(res.record?.response || res, null, 2);
        await reloadHistory();
    } catch (e) {
        els.createOut.textContent = `error: ${e.message}`;
    } finally {
        els.btnCreate.disabled = false;
    }
}

els.from.addEventListener('change', async () => {
    await loadMin();
    await loadEstimate();
});
els.to.addEventListener('change', async () => {
    await loadMin();
    await loadEstimate();
});
els.amount.addEventListener('input', () => {
    clearTimeout(window.__estTo);
    window.__estTo = setTimeout(loadEstimate, 250);
});
els.btnCreate.addEventListener('click', onCreate);
els.btnReload.addEventListener('click', reloadHistory);

await loadHealth();
await loadCurrencies();
await loadMin();
await reloadHistory();
