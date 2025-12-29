import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (!a.startsWith('--')) {
            args._.push(a);
            continue;
        }
        const eq = a.indexOf('=');
        if (eq !== -1) {
            args[a.slice(2, eq)] = a.slice(eq + 1);
        } else {
            const k = a.slice(2);
            const v = argv[i + 1];
            if (v == null || v.startsWith('--')) {
                args[k] = true;
            } else {
                args[k] = v;
                i += 1;
            }
        }
    }
    return args;
}

function nowStamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function toCsvRow(values) {
    return values
        .map(v => {
            const s = v == null ? '' : String(v);
            if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
            return s;
        })
        .join(',');
}

async function readAddressesFromFile(filePath) {
    const raw = await readFile(filePath, 'utf8');
    return raw
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
}

async function fetchJson(url, { timeoutMs = 15000 } = {}) {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        const text = await res.text();
        let json;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = null;
        }
        if (!res.ok) {
            const msg = json?.error || json?.msg || res.statusText;
            const err = new Error(`HTTP ${res.status}: ${msg}`);
            err.status = res.status;
            err.body = text;
            throw err;
        }
        return json;
    } finally {
        clearTimeout(to);
    }
}

async function pool(items, concurrency, worker) {
    const results = new Array(items.length);
    let next = 0;

    async function runOne() {
        for (;;) {
            const idx = next;
            next += 1;
            if (idx >= items.length) return;
            results[idx] = await worker(items[idx], idx);
        }
    }

    const runners = [];
    for (let i = 0; i < Math.max(1, concurrency); i += 1) runners.push(runOne());
    await Promise.all(runners);
    return results;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const workerBase = String(
        args.worker || process.env.WORKER_URL || 'https://fennec-api.warninghejo.workers.dev'
    ).replace(/\/$/, '');
    const inputFile = args.in || args.input;
    const addrListArg = args.addresses || args.address;
    const outRoot = args.out || args.output || path.join(process.cwd(), 'stats_out', nowStamp());
    const concurrency = Number(args.concurrency || 4);

    if (!inputFile && !addrListArg) {
        throw new Error('Provide --in <file> or --addresses <a1,a2,...>');
    }

    let addresses = [];
    if (inputFile) {
        addresses.push(...(await readAddressesFromFile(path.resolve(inputFile))));
    }
    if (addrListArg) {
        addresses.push(
            ...String(addrListArg)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
        );
    }

    addresses = Array.from(new Set(addresses));
    if (!addresses.length) throw new Error('No addresses found');

    await mkdir(outRoot, { recursive: true });

    let prices = null;
    try {
        prices = await fetchJson(`${workerBase}?action=get_prices`, { timeoutMs: 20000 });
    } catch {
        prices = null;
    }

    const startedAt = new Date().toISOString();

    const perAddress = await pool(addresses, concurrency, async address => {
        const url = `${workerBase}?action=summary&address=${encodeURIComponent(address)}`;
        try {
            const res = await fetchJson(url, { timeoutMs: 20000 });
            const data = res?.data || null;
            return { ok: true, address, data, raw: res };
        } catch (e) {
            return {
                ok: false,
                address,
                error: {
                    message: e?.message || String(e),
                    status: e?.status || null
                }
            };
        }
    });

    const rows = perAddress
        .filter(r => r.ok && r.data)
        .map(r => {
            const d = r.data;
            return {
                address: r.address,
                tx_count: d.tx_count ?? 0,
                utxo_count: d.utxo_count ?? 0,
                native_balance: d.native_balance ?? 0,
                runes_count: d.runes_count ?? 0,
                brc20_count: d.brc20_count ?? 0,
                ordinals_count: d.ordinals_count ?? 0,
                first_tx_time: d.first_tx_time ?? 0,
                last_tx_time: d.last_tx_time ?? 0,
                synced_at: d.synced_at ?? ''
            };
        });

    const brc20Rows = [];
    for (const r of perAddress) {
        if (!r.ok || !r.data) continue;
        const list = Array.isArray(r.data.brc20_list) ? r.data.brc20_list : [];
        for (const t of list) {
            brc20Rows.push({
                address: r.address,
                ticker: t.ticker ?? '',
                balance: t.balance ?? 0,
                transferableBalance: t.transferableBalance ?? 0,
                availableBalance: t.availableBalance ?? 0
            });
        }
    }

    const snapshot = {
        meta: {
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            worker: workerBase,
            count: addresses.length,
            prices
        },
        results: perAddress
    };

    await writeFile(path.join(outRoot, 'snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8');

    const summaryHeader = [
        'address',
        'tx_count',
        'utxo_count',
        'native_balance',
        'runes_count',
        'brc20_count',
        'ordinals_count',
        'first_tx_time',
        'last_tx_time',
        'synced_at'
    ];
    const summaryCsv = [
        toCsvRow(summaryHeader),
        ...rows.map(r =>
            toCsvRow([
                r.address,
                r.tx_count,
                r.utxo_count,
                r.native_balance,
                r.runes_count,
                r.brc20_count,
                r.ordinals_count,
                r.first_tx_time,
                r.last_tx_time,
                r.synced_at
            ])
        )
    ].join('\n');
    await writeFile(path.join(outRoot, 'summary.csv'), summaryCsv, 'utf8');

    const brc20Header = ['address', 'ticker', 'balance', 'transferableBalance', 'availableBalance'];
    const brc20Csv = [
        toCsvRow(brc20Header),
        ...brc20Rows.map(r => toCsvRow([r.address, r.ticker, r.balance, r.transferableBalance, r.availableBalance]))
    ].join('\n');
    await writeFile(path.join(outRoot, 'brc20.csv'), brc20Csv, 'utf8');

    const errorRows = perAddress.filter(r => !r.ok);
    if (errorRows.length) {
        const errCsv = [
            toCsvRow(['address', 'status', 'message']),
            ...errorRows.map(r => toCsvRow([r.address, r.error?.status ?? '', r.error?.message ?? '']))
        ].join('\n');
        await writeFile(path.join(outRoot, 'errors.csv'), errCsv, 'utf8');
    }

    process.stdout.write(`${outRoot}\n`);
}

main().catch(err => {
    process.stderr.write((err && err.stack) || String(err));
    process.stderr.write('\n');
    process.exitCode = 1;
});
