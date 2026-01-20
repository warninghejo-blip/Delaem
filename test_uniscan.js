export default {
    async fetch(request, env) {
        // ВСТАВЬТЕ СЮДА URL ДЛЯ ПРОВЕРКИ UNISCAN
        const url = 'https://api.uniscan.io/v1/endpoint...'; // <-- ЗАМЕНИТЕ НА РЕАЛЬНЫЙ

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            Connection: 'keep-alive'
            // Если Uniscan требует API Key, добавьте его сюда:
            // 'Authorization': `Bearer ${env.UNISCAN_API_KEY}`,
        };

        try {
            const start = Date.now();
            const response = await fetch(url, { headers, cf: { cacheTtl: 0 } });
            const text = await response.text();

            return new Response(
                JSON.stringify(
                    {
                        status: response.status,
                        time_ms: Date.now() - start,
                        body_preview: text.substring(0, 200)
                    },
                    null,
                    2
                ),
                { headers: { 'content-type': 'application/json' } }
            );
        } catch (e) {
            return new Response(e.message);
        }
    }
};
