export async function handleReferralAction(ctx) {
    const { action, request, env, sendJSON, __rateLimit } = ctx || {};
    if (action !== 'track_referral') return null;

    if (String(request?.method || 'GET').toUpperCase() !== 'POST') {
        return sendJSON({ code: -1, msg: 'Method not allowed' }, 405);
    }

    const ip =
        String(request.headers.get('CF-Connecting-IP') || '').trim() ||
        String(request.headers.get('X-Forwarded-For') || '')
            .split(',')[0]
            .trim() ||
        'unknown';
    try {
        const rl = __rateLimit ? __rateLimit(`ip:${ip}:referral`, 30, 60_000) : { ok: true };
        if (!rl.ok) {
            return sendJSON({ code: -1, msg: 'Too many requests' }, 429);
        }
    } catch (_) {
        void _;
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return sendJSON({ code: -1, msg: 'Invalid JSON body' }, 200);
    }

    const address = String(body.address || body.addr || '').trim();
    const refRaw = String(body.ref || body.referrer || body.referral || '').trim();
    const source = String(body.source || body.src || 'connect').trim();
    const page = String(body.page || body.path || '').trim();
    const ts = Number(body.ts || Date.now()) || Date.now();
    const ua = String(request.headers.get('User-Agent') || '').trim();

    if (!address || !refRaw) {
        return sendJSON({ code: 0, msg: 'No referral data' }, 200);
    }

    const addrKey = address.toLowerCase();
    const ref = refRaw.slice(0, 140);
    const now = Date.now();

    try {
        if (env?.FENNEC_D1) {
            try {
                await env.FENNEC_D1.prepare(
                    `CREATE TABLE IF NOT EXISTS referrals (
                        address TEXT PRIMARY KEY,
                        ref TEXT,
                        last_ref TEXT,
                        ip TEXT,
                        last_ip TEXT,
                        ua TEXT,
                        created_at INTEGER,
                        updated_at INTEGER,
                        count INTEGER DEFAULT 1,
                        source TEXT,
                        page TEXT
                    )`
                ).run();
            } catch (_) {
                void _;
            }

            const existing = await env.FENNEC_D1.prepare('SELECT ref, count FROM referrals WHERE address = ?')
                .bind(addrKey)
                .first();

            if (existing) {
                const nextCount = Number(existing.count || 0) + 1;
                await env.FENNEC_D1.prepare(
                    `UPDATE referrals
                     SET last_ref = ?, last_ip = ?, ua = ?, updated_at = ?, count = ?, source = ?, page = ?
                     WHERE address = ?`
                )
                    .bind(ref, ip, ua, ts, nextCount, source, page, addrKey)
                    .run();
            } else {
                await env.FENNEC_D1.prepare(
                    `INSERT INTO referrals
                        (address, ref, last_ref, ip, last_ip, ua, created_at, updated_at, count, source, page)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                )
                    .bind(addrKey, ref, ref, ip, ip, ua, ts, ts, 1, source, page)
                    .run();
            }

            return sendJSON({ code: 0, data: { address: addrKey, ref } }, 200);
        }
    } catch (e) {
        return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
    }

    if (!env?.FENNEC_DB) {
        return sendJSON({ code: -1, msg: 'FENNEC_DB is not configured on the server.' }, 200);
    }

    try {
        const key = `referral_v1:${addrKey}`;
        const existingRaw = await env.FENNEC_DB.get(key);
        let payload = null;
        if (existingRaw) {
            try {
                payload = JSON.parse(existingRaw);
            } catch (_) {
                payload = null;
            }
        }
        const nextCount = Number(payload?.count || 0) + 1;
        const store = {
            address: addrKey,
            ref: payload?.ref || ref,
            last_ref: ref,
            ip: payload?.ip || ip,
            last_ip: ip,
            ua: ua || payload?.ua || '',
            source,
            page,
            created_at: Number(payload?.created_at || ts) || ts,
            updated_at: ts,
            count: nextCount
        };
        await env.FENNEC_DB.put(key, JSON.stringify(store), { metadata: { updatedAt: now } });
        return sendJSON({ code: 0, data: { address: addrKey, ref: store.ref } }, 200);
    } catch (e) {
        return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
    }
}

let __analyticsSchemaPromise = null;

const __truncateString = (value, maxLen) => {
    const str = String(value || '').trim();
    if (!maxLen || str.length <= maxLen) return str;
    return str.slice(0, Math.max(0, maxLen));
};

async function ensureAnalyticsSchema(db) {
    if (!db) return;
    if (__analyticsSchemaPromise) return __analyticsSchemaPromise;
    __analyticsSchemaPromise = (async () => {
        await db
            .prepare(
                `CREATE TABLE IF NOT EXISTS wallet_analytics (
                    address TEXT PRIMARY KEY,
                    archetype_key TEXT,
                    tier_level INTEGER DEFAULT 0,
                    tx_count INTEGER DEFAULT 0,
                    native_balance REAL DEFAULT 0,
                    fennec_balance REAL DEFAULT 0,
                    networth_usd REAL DEFAULT 0,
                    lp_value_usd REAL DEFAULT 0,
                    ordinals_count INTEGER DEFAULT 0,
                    runes_count INTEGER DEFAULT 0,
                    first_tx_ts INTEGER,
                    last_audit_ts INTEGER,
                    total_scans INTEGER DEFAULT 1,
                    last_ip TEXT,
                    referred_by TEXT,
                    last_full_json TEXT
                )`
            )
            .run();
        await db
            .prepare(
                `CREATE TABLE IF NOT EXISTS balance_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    address TEXT NOT NULL,
                    networth_usd REAL,
                    fennec_balance REAL,
                    native_balance REAL,
                    timestamp INTEGER DEFAULT (strftime('%s','now')),
                    FOREIGN KEY(address) REFERENCES wallet_analytics(address)
                )`
            )
            .run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_history_address ON balance_history(address)').run();
    })();
    return __analyticsSchemaPromise;
}

export async function saveAuditAnalytics(address, auditData, ip, referrer, env) {
    const addr = String(address || '')
        .trim()
        .toLowerCase();
    if (!addr || !env?.FENNEC_D1) return;
    const db = env.FENNEC_D1;

    await ensureAnalyticsSchema(db);

    const payload = auditData && typeof auditData === 'object' ? auditData : {};
    const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const nowSec = Math.floor(Date.now() / 1000);

    const archetypeKey = __truncateString(data?.identity?.archetype?.baseKey || data?.archetype_key || '', 32);
    const tierLevel = Number(data?.identity?.archetype?.tierLevel ?? data?.tier_level ?? 0) || 0;

    const txCount = Number(data.tx_count || 0) || 0;
    const nativeBalance = Number(data.native_balance || 0) || 0;
    const fennecBalance = Number(data.fennec_native_balance || data.fennec_balance || 0) || 0;
    const lpValueUsd = Number(data.lp_value_usd || 0) || 0;
    const networthUsd = Number(data.networth || data.networth_usd || 0) || Number(data.total_usd || 0) + lpValueUsd;
    const ordinalsCount = Number(data.ordinals_count || 0) || 0;
    const runesCount = Number(data.runes_count || 0) || 0;
    const firstTxTs = Number(data.first_tx_ts || 0) || null;
    const lastIp = __truncateString(ip || 'unknown', 128);
    const referredBy = __truncateString(referrer || '', 140);
    const jsonRaw = (() => {
        try {
            return JSON.stringify(data || {});
        } catch (_) {
            return '{}';
        }
    })();
    const lastFullJson = __truncateString(jsonRaw, 50000);

    await db
        .prepare(
            `INSERT INTO wallet_analytics (
                address,
                archetype_key,
                tier_level,
                tx_count,
                native_balance,
                fennec_balance,
                networth_usd,
                lp_value_usd,
                ordinals_count,
                runes_count,
                first_tx_ts,
                last_audit_ts,
                total_scans,
                last_ip,
                referred_by,
                last_full_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(address) DO UPDATE SET
                archetype_key = CASE
                    WHEN excluded.archetype_key IS NOT NULL AND excluded.archetype_key != ''
                        THEN excluded.archetype_key
                    ELSE wallet_analytics.archetype_key
                END,
                tier_level = CASE
                    WHEN excluded.tier_level IS NOT NULL
                        THEN excluded.tier_level
                    ELSE wallet_analytics.tier_level
                END,
                tx_count = excluded.tx_count,
                native_balance = excluded.native_balance,
                fennec_balance = excluded.fennec_balance,
                networth_usd = excluded.networth_usd,
                lp_value_usd = excluded.lp_value_usd,
                ordinals_count = excluded.ordinals_count,
                runes_count = excluded.runes_count,
                first_tx_ts = CASE
                    WHEN wallet_analytics.first_tx_ts IS NULL OR wallet_analytics.first_tx_ts = 0
                        THEN excluded.first_tx_ts
                    ELSE wallet_analytics.first_tx_ts
                END,
                last_audit_ts = excluded.last_audit_ts,
                total_scans = wallet_analytics.total_scans + 1,
                last_ip = excluded.last_ip,
                referred_by = CASE
                    WHEN excluded.referred_by IS NOT NULL AND excluded.referred_by != ''
                        THEN excluded.referred_by
                    ELSE wallet_analytics.referred_by
                END,
                last_full_json = excluded.last_full_json`
        )
        .bind(
            addr,
            archetypeKey || null,
            tierLevel,
            txCount,
            nativeBalance,
            fennecBalance,
            networthUsd,
            lpValueUsd,
            ordinalsCount,
            runesCount,
            firstTxTs,
            nowSec,
            lastIp,
            referredBy || null,
            lastFullJson
        )
        .run();

    const lastSnapshot = await db
        .prepare(
            'SELECT networth_usd, fennec_balance, native_balance, timestamp FROM balance_history WHERE address = ? ORDER BY timestamp DESC LIMIT 1'
        )
        .bind(addr)
        .first();

    let shouldInsert = false;
    if (!lastSnapshot) {
        shouldInsert = true;
    } else {
        const lastTs = Number(lastSnapshot.timestamp || 0) || 0;
        const lastWorth = Number(lastSnapshot.networth_usd || 0) || 0;
        const age = nowSec - lastTs;
        if (age >= 86400) {
            shouldInsert = true;
        } else {
            const denom = Math.max(1, Math.abs(lastWorth));
            const delta = Math.abs(networthUsd - lastWorth) / denom;
            if (delta >= 0.05) shouldInsert = true;
        }
    }

    if (shouldInsert) {
        await db
            .prepare(
                `INSERT INTO balance_history (address, networth_usd, fennec_balance, native_balance, timestamp)
                 VALUES (?, ?, ?, ?, ?)`
            )
            .bind(addr, networthUsd, fennecBalance, nativeBalance, nowSec)
            .run();
    }
}

export async function handleAnalyticsAction(ctx) {
    const { action, env, sendJSON, url } = ctx || {};
    if (action !== 'get_leaderboard') return null;
    if (!env?.FENNEC_D1) return sendJSON({ code: -1, msg: 'FENNEC_D1 is not configured.' }, 200);

    const sortRaw = String(url?.searchParams?.get('sort') || '')
        .trim()
        .toLowerCase();
    const sort = sortRaw === 'fennec' || sortRaw === 'fennec_balance' ? 'fennec_balance' : 'networth_usd';
    const limitRaw = Number(url?.searchParams?.get('limit') || 50) || 50;
    const limit = Math.min(50, Math.max(1, Math.floor(limitRaw)));

    await ensureAnalyticsSchema(env.FENNEC_D1);

    const rows = await env.FENNEC_D1.prepare(
        `SELECT address, archetype_key, tier_level, tx_count, native_balance, fennec_balance, networth_usd, lp_value_usd,
                ordinals_count, runes_count, first_tx_ts, last_audit_ts, total_scans, last_ip, referred_by
         FROM wallet_analytics
         ORDER BY ${sort} DESC
         LIMIT ?`
    )
        .bind(limit)
        .all();

    return sendJSON({ code: 0, data: { sort, limit, list: rows?.results || [] } }, 200, 15, 'public');
}
