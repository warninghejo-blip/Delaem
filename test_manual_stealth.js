export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        const url = `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/inscription-data?cursor=0&size=100`;

        // HEADERS (Pure Stealth - NO Authorization)
        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            Referer: 'https://fractal.unisat.io/',
            Origin: 'https://fractal.unisat.io',
            Connection: 'keep-alive',
            Pragma: 'no-cache',
            'Cache-Control': 'no-cache'
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
                        time_ms: Date.now() - start,
                        error: 'Invalid JSON response',
                        raw_preview: text.substring(0, 500)
                    }),
                    { headers: { 'content-type': 'application/json' } }
                );
            }

            // Логика подсчета Fennec
            let fennecCount = 0;
            let sampleItemName = null;

            if (data && data.data && data.data.detail && Array.isArray(data.data.detail)) {
                for (const item of data.data.detail) {
                    const name = (item.inscriptionName || '').toLowerCase();
                    if (name.includes('fennec')) {
                        fennecCount++;
                        if (!sampleItemName) {
                            sampleItemName = item.inscriptionName;
                        }
                    }
                }
            }

            const result = {
                status: response.status,
                time_ms: Date.now() - start,
                total_inscriptions: data?.data?.total || 0,
                fennec_boxes_found: fennecCount,
                sample_item_name: sampleItemName,
                success: response.status === 200
            };

            // Добавляем дебаг информацию если есть ошибка
            if (response.status !== 200) {
                result.error_details = {
                    response_text: text.substring(0, 1000),
                    headers_tested: Object.keys(headers)
                };
            }

            return new Response(JSON.stringify(result, null, 2), {
                headers: { 'content-type': 'application/json' }
            });
        } catch (e) {
            return new Response(
                JSON.stringify({
                    status: 0,
                    time_ms: 0,
                    error: e.message,
                    fennec_boxes_found: 0,
                    total_inscriptions: 0
                }),
                { headers: { 'content-type': 'application/json' } }
            );
        }
    }
};
