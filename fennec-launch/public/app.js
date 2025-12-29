async function j(url, opts) {
    const res = await fetch(url, opts);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json;
}

const el = {
    health: document.getElementById('health'),
    token: document.getElementById('token'),
    saleSupply: document.getElementById('saleSupply'),
    lpSupply: document.getElementById('lpSupply'),
    startPrice: document.getElementById('startPrice'),
    slope: document.getElementById('slope'),
    btnCreate: document.getElementById('btnCreate'),
    buyAmount: document.getElementById('buyAmount'),
    btnQuote: document.getElementById('btnQuote'),
    btnBuy: document.getElementById('btnBuy'),
    btnMigrate: document.getElementById('btnMigrate'),
    btnRefresh: document.getElementById('btnRefresh'),
    quote: document.getElementById('quote'),
    state: document.getElementById('state')
};

async function loadHealth() {
    try {
        const h = await fetch('/api/health').then(r => r.json());
        el.health.textContent = h?.ok ? 'api:ok' : 'api:error';
    } catch {
        el.health.textContent = 'api:error';
    }
}

async function refresh() {
    const { data } = await j('/api/state');
    el.state.textContent = JSON.stringify(data, null, 2);
}

async function createLaunch() {
    el.btnCreate.disabled = true;
    try {
        await j('/api/launch/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokenSymbol: el.token.value.trim(),
                saleSupply: el.saleSupply.value,
                lpSupply: el.lpSupply.value,
                startPrice: el.startPrice.value,
                slope: el.slope.value
            })
        });
        await refresh();
    } finally {
        el.btnCreate.disabled = false;
    }
}

async function quote() {
    el.quote.textContent = '';
    const { data } = await j('/api/buy/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTokens: el.buyAmount.value })
    });
    el.quote.textContent = JSON.stringify(data, null, 2);
}

async function buyTokens() {
    const { data } = await j('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTokens: el.buyAmount.value })
    });
    el.quote.textContent = JSON.stringify(data.quote, null, 2);
    el.state.textContent = JSON.stringify(data.state, null, 2);
}

async function migrate() {
    const { data } = await j('/api/migrate', { method: 'POST' });
    el.quote.textContent = JSON.stringify(data.lp, null, 2);
    el.state.textContent = JSON.stringify(data.state, null, 2);
}

el.btnCreate.addEventListener('click', createLaunch);
el.btnRefresh.addEventListener('click', refresh);
el.btnQuote.addEventListener('click', quote);
el.btnBuy.addEventListener('click', buyTokens);
el.btnMigrate.addEventListener('click', migrate);

await loadHealth();
await refresh().catch(() => {
    el.state.textContent = 'null';
});
