export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';

        // URL из браузера (внутренний API)
        const url = 'https://fractal.unisat.io/api/market-v4/collection/auction/collection_summary';

        // СТЕЛС ЗАГОЛОВКИ (Маскируемся под Chrome)
        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json', // Важно для POST
            Referer: 'https://fractal.unisat.io/my-assets', // Подделываем источник
            Origin: 'https://fractal.unisat.io'
        };

        // Тело запроса (обычно такие API ждут JSON)
        const body = JSON.stringify({
            address: address,
            start: 0,
            limit: 20
        });

        try {
            const start = Date.now();

            const response = await fetch(url, {
                method: 'POST', // Пробуем POST, так как это summary
                headers: headers,
                body: body,
                cf: { cacheTtl: 0 }
            });

            const text = await response.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                json = text;
            }

            return new Response(
                JSON.stringify(
                    {
                        attempt_url: url,
                        status: response.status,
                        time_ms: Date.now() - start,
                        result: json
                    },
                    null,
                    2
                ),
                { headers: { 'content-type': 'application/json' } }
            );
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }
};
