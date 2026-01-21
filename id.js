export async function handleIdAction(ctx) {
    const { action, request, env, sendJSON, url } = ctx || {};
    if (!action) return null;

    if (action === 'fennec_id_register') {
        if (String(request?.method || 'GET').toUpperCase() !== 'POST') {
            return sendJSON({ code: -1, msg: 'Method not allowed' }, 405);
        }

        if (!env?.FENNEC_DB) {
            return sendJSON({ code: -1, msg: 'FENNEC_DB is not configured on the server.' }, 200);
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return sendJSON({ code: -1, msg: 'Invalid JSON body' }, 200);
        }

        const address = String(body.address || body.addr || '').trim();
        const inscriptionId = String(body.inscriptionId || body.inscription_id || body.id || '').trim();
        if (!address || !inscriptionId) {
            return sendJSON({ code: -1, msg: 'Missing address or inscriptionId' }, 200);
        }

        const addrKey = address.toLowerCase();
        const updatedAt = Date.now();
        const key = `fennec_id_v3:${addrKey}`;

        try {
            await env.FENNEC_DB.put(key, JSON.stringify({ inscriptionId, updatedAt, address: addrKey }), {
                metadata: { updatedAt }
            });
        } catch (e) {
            return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
        }

        return sendJSON({ code: 0, data: { address: addrKey, inscriptionId, updatedAt } }, 200);
    }

    if (action === 'fennec_id_lookup') {
        if (!env?.FENNEC_DB) {
            return sendJSON({ code: -1, msg: 'FENNEC_DB is not configured on the server.' }, 200);
        }

        const address = String(url?.searchParams?.get('address') || url?.searchParams?.get('addr') || '').trim();
        if (!address) {
            return sendJSON({ code: -1, msg: 'Missing address' }, 200);
        }

        const addrKey = address.toLowerCase();
        const key = `fennec_id_v3:${addrKey}`;
        try {
            const raw = await env.FENNEC_DB.get(key);
            if (!raw) {
                return sendJSON({ code: 0, data: null }, 200);
            }
            const parsed = (() => {
                try {
                    return JSON.parse(raw);
                } catch (_) {
                    return null;
                }
            })();

            const inscriptionId = String(parsed?.inscriptionId || '').trim();
            const updatedAt = Number(parsed?.updatedAt || 0) || 0;
            if (!inscriptionId) {
                return sendJSON({ code: 0, data: null }, 200);
            }

            return sendJSON({ code: 0, data: { address: addrKey, inscriptionId, updatedAt } }, 200);
        } catch (e) {
            return sendJSON({ code: -1, msg: e?.message || String(e) }, 200);
        }
    }

    return null;
}
