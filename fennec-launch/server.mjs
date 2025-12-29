import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { createLaunchState, buy, quoteBuy } from './lib/curve_engine.js';
import { canMigrate, migrate } from './lib/migration_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5178);
const DB_FILE = process.env.LAUNCH_DB_FILE || path.join(__dirname, 'db.json');

const adapter = new JSONFile(DB_FILE);
const db = new Low(adapter, { launch: null, events: [] });
await db.read();
db.data ||= { launch: null, events: [] };
await db.write();

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function pushEvent(type, payload) {
    db.data.events.unshift({ type, payload, at: new Date().toISOString() });
    db.data.events = db.data.events.slice(0, 500);
}

app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'fennec-launch' });
});

app.get('/api/state', async (req, res) => {
    await db.read();
    res.json({ ok: true, data: db.data.launch });
});

app.post('/api/launch/create', async (req, res) => {
    try {
        const body = req.body || {};
        const launch = createLaunchState({
            tokenSymbol: body.tokenSymbol,
            saleSupply: body.saleSupply,
            lpSupply: body.lpSupply,
            startPrice: body.startPrice,
            slope: body.slope
        });

        db.data.launch = launch;
        pushEvent('launch_created', { tokenSymbol: launch.tokenSymbol });
        await db.write();

        res.json({ ok: true, data: launch });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.post('/api/buy/quote', async (req, res) => {
    await db.read();
    if (!db.data.launch) return res.status(400).json({ ok: false, error: 'no active launch' });
    try {
        const q = quoteBuy(db.data.launch, req.body?.amountTokens);
        res.json({ ok: true, data: q });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.post('/api/buy', async (req, res) => {
    await db.read();
    if (!db.data.launch) return res.status(400).json({ ok: false, error: 'no active launch' });
    try {
        const q = buy(db.data.launch, req.body?.amountTokens);
        pushEvent('buy', q);
        await db.write();
        res.json({ ok: true, data: { quote: q, state: db.data.launch } });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.post('/api/migrate', async (req, res) => {
    await db.read();
    if (!db.data.launch) return res.status(400).json({ ok: false, error: 'no active launch' });
    try {
        if (!canMigrate(db.data.launch)) throw new Error('cannot migrate yet');
        const lp = migrate(db.data.launch);
        pushEvent('migrate', lp);
        await db.write();
        res.json({ ok: true, data: { lp, state: db.data.launch } });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.get('/api/events', async (req, res) => {
    await db.read();
    res.json({ ok: true, data: db.data.events });
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    process.stdout.write(`fennec-launch listening on http://localhost:${PORT}\n`);
});
