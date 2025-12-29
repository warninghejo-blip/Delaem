import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5177);
const CHANGENOW_BASE = (process.env.CHANGENOW_BASE || 'https://api.changenow.io').replace(/\/$/, '');
const CHANGENOW_API_KEY = process.env.CHANGENOW_API_KEY || '';

const DB_FILE = process.env.VORTEX_DB_FILE || path.join(__dirname, 'db.json');
const adapter = new JSONFile(DB_FILE);
const db = new Low(adapter, { exchanges: [] });
await db.read();
db.data ||= { exchanges: [] };
await db.write();

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function requireApiKey() {
    if (!CHANGENOW_API_KEY) {
        const err = new Error('CHANGENOW_API_KEY is not configured');
        err.status = 500;
        throw err;
    }
}

async function callChangeNow({ method, pathname, searchParams, body }) {
    const url = new URL(CHANGENOW_BASE + pathname);
    if (searchParams) {
        for (const [k, v] of Object.entries(searchParams)) {
            if (v == null || v === '') continue;
            url.searchParams.set(k, String(v));
        }
    }

    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json'
    };

    if (CHANGENOW_API_KEY) headers['x-changenow-api-key'] = CHANGENOW_API_KEY;

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (!res.ok) {
        const err = new Error(`ChangeNOW HTTP ${res.status}`);
        err.status = res.status;
        err.body = text;
        err.json = json;
        throw err;
    }

    return json;
}

app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'fennec-vortex', changenowBase: CHANGENOW_BASE, hasKey: Boolean(CHANGENOW_API_KEY) });
});

app.get('/api/changenow/currencies', async (req, res) => {
    try {
        const active = req.query.active ?? 'true';
        const fixedRate = req.query.fixedRate ?? 'true';
        const data = await callChangeNow({
            method: 'GET',
            pathname: '/v1/currencies',
            searchParams: { active, fixedRate }
        });
        res.json({ ok: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ ok: false, error: e.message, details: e.json || e.body || null });
    }
});

app.get('/api/changenow/min-amount', async (req, res) => {
    try {
        const from = String(req.query.from || '').toLowerCase();
        const to = String(req.query.to || '').toLowerCase();
        if (!from || !to) return res.status(400).json({ ok: false, error: 'from and to are required' });

        const data = await callChangeNow({
            method: 'GET',
            pathname: `/v1/min-amount/${encodeURIComponent(from)}_${encodeURIComponent(to)}`
        });
        res.json({ ok: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ ok: false, error: e.message, details: e.json || e.body || null });
    }
});

app.get('/api/changenow/estimate', async (req, res) => {
    try {
        const from = String(req.query.from || '').toLowerCase();
        const to = String(req.query.to || '').toLowerCase();
        const amount = String(req.query.amount || '');
        if (!from || !to || !amount) return res.status(400).json({ ok: false, error: 'from, to, amount are required' });

        const data = await callChangeNow({
            method: 'GET',
            pathname: `/v1/exchange-amount/${encodeURIComponent(amount)}/${encodeURIComponent(from)}_${encodeURIComponent(to)}`
        });
        res.json({ ok: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ ok: false, error: e.message, details: e.json || e.body || null });
    }
});

app.post('/api/changenow/create', async (req, res) => {
    try {
        requireApiKey();
        const { from, to, amount, toAddress, refundAddress, toExtraId, refundExtraId } = req.body || {};
        if (!from || !to || !amount || !toAddress) {
            return res.status(400).json({ ok: false, error: 'from, to, amount, toAddress are required' });
        }

        const payload = {
            from: String(from).toLowerCase(),
            to: String(to).toLowerCase(),
            amount: Number(amount),
            address: String(toAddress),
            ...(toExtraId ? { extraId: String(toExtraId) } : {}),
            ...(refundAddress ? { refundAddress: String(refundAddress) } : {}),
            ...(refundExtraId ? { refundExtraId: String(refundExtraId) } : {})
        };

        const data = await callChangeNow({
            method: 'POST',
            pathname: `/v1/transactions/${encodeURIComponent(payload.from)}_${encodeURIComponent(payload.to)}`,
            body: payload
        });

        const record = {
            id: nanoid(),
            createdAt: new Date().toISOString(),
            request: payload,
            response: data
        };
        db.data.exchanges.unshift(record);
        db.data.exchanges = db.data.exchanges.slice(0, 200);
        await db.write();

        res.json({ ok: true, record });
    } catch (e) {
        res.status(e.status || 500).json({ ok: false, error: e.message, details: e.json || e.body || null });
    }
});

app.get('/api/changenow/tx/:id', async (req, res) => {
    try {
        const id = String(req.params.id || '');
        if (!id) return res.status(400).json({ ok: false, error: 'id required' });
        const data = await callChangeNow({ method: 'GET', pathname: `/v1/transactions/${encodeURIComponent(id)}` });
        res.json({ ok: true, data });
    } catch (e) {
        res.status(e.status || 500).json({ ok: false, error: e.message, details: e.json || e.body || null });
    }
});

app.get('/api/local/exchanges', async (req, res) => {
    await db.read();
    res.json({ ok: true, data: db.data.exchanges });
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    process.stdout.write(`fennec-vortex listening on http://localhost:${PORT}\n`);
});
