export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        const url = `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/inscription-data?cursor=0&size=20`;

        // HEADERS (Pure Stealth - NO Auth)
        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            Referer: 'https://fractal.unisat.io/',
            Origin: 'https://fractal.unisat.io'
        };

        try {
            const start = Date.now();

            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                cf: { cacheTtl: 0 }
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                return new Response(
                    JSON.stringify({
                        status: response.status,
                        error: 'Invalid JSON response',
                        raw_preview: text.substring(0, 500)
                    }),
                    { headers: { 'content-type': 'application/json' } }
                );
            }

            // Создаем debug dump первых 10 элементов
            let itemsPreview = [];

            if (data && data.data && data.data.detail && Array.isArray(data.data.detail)) {
                itemsPreview = data.data.detail.slice(0, 10).map((item, index) => {
                    const contentBody = (item.contentBody || '').substring(0, 20);
                    const contentType = item.contentType || 'unknown';
                    const inscriptionName = item.inscriptionName || 'unnamed';
                    const inscriptionNumber = item.inscriptionNumber || 'N/A';

                    return {
                        index: index,
                        inscriptionName: inscriptionName,
                        inscriptionNumber: inscriptionNumber,
                        contentBody: contentBody + (item.contentBody && item.contentBody.length > 20 ? '...' : ''),
                        contentType: contentType
                    };
                });
            }

            const result = {
                status: response.status,
                time_ms: Date.now() - start,
                total_found: data?.data?.total || 0,
                items_preview: itemsPreview,
                success: response.status === 200
            };

            // Добавляем полный первый элемент для детального анализа
            if (data && data.data && data.data.detail && data.data.detail.length > 0) {
                result.first_item_full = data.data.detail[0];
            }

            return new Response(JSON.stringify(result, null, 2), {
                headers: { 'content-type': 'application/json' }
            });
        } catch (e) {
            return new Response(
                JSON.stringify({
                    status: 0,
                    error: e.message,
                    items_preview: []
                }),
                { headers: { 'content-type': 'application/json' } }
            );
        }
    }
};
