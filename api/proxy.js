const BACKEND = 'https://fennec-api.warninghejo.workers.dev';

const zlib = require('zlib');

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(Buffer.from(chunk)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    try {
        const originUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const targetUrl = new URL(BACKEND);
        targetUrl.search = originUrl.search;

        const method = (req.method || 'GET').toUpperCase();

        const headers = {};
        const contentType = req.headers['content-type'];
        if (contentType) headers['content-type'] = contentType;
        if (req.headers['x-public-key']) headers['x-public-key'] = req.headers['x-public-key'];
        if (req.headers['x-address']) headers['x-address'] = req.headers['x-address'];

        let body;
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
            const raw = await getRawBody(req);
            if (raw && raw.length) body = raw;
        }

        const upstream = await fetch(targetUrl.toString(), { method, headers, body });

        res.statusCode = upstream.status;
        res.setHeader('access-control-allow-origin', '*');

        const acceptEncoding = String(req.headers['accept-encoding'] || '');

        const upstreamContentType = upstream.headers.get('content-type');
        if (upstreamContentType) res.setHeader('content-type', upstreamContentType);

        const buf = Buffer.from(await upstream.arrayBuffer());

        const isTextLike =
            /^(application\/json|text\/|application\/javascript|application\/xml|application\/xhtml\+xml)/i.test(
                String(upstreamContentType || '')
            );

        if (isTextLike && /\bbr\b/i.test(acceptEncoding)) {
            try {
                const compressed = zlib.brotliCompressSync(buf, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: 4
                    }
                });
                res.setHeader('content-encoding', 'br');
                res.setHeader('vary', 'Accept-Encoding');
                res.end(compressed);
                return;
            } catch (e) {
                // Fallback to uncompressed
            }
        }

        if (/\bgzip\b/i.test(acceptEncoding)) {
            try {
                const gz = zlib.gzipSync(buf, { level: 6 });
                res.setHeader('content-encoding', 'gzip');
                res.setHeader('vary', 'Accept-Encoding');
                res.end(gz);
                return;
            } catch (e) {
                // Fallback to uncompressed
            }
        }

        res.setHeader('vary', 'Accept-Encoding');
        res.end(buf);
    } catch (e) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.setHeader('access-control-allow-origin', '*');
        res.end(
            JSON.stringify({
                code: -1,
                error: e?.message || String(e)
            })
        );
    }
};
