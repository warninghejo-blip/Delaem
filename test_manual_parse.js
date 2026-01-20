export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        const apiKey = env.UNISAT_API_KEY; // Убедись, что ключи доступны

        // Используем обычный Indexer API (который работает)
        const url = `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/inscription-data?cursor=0&size=100`;

        const headers = {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        try {
            const start = Date.now();
            const response = await fetch(url, { headers });
            const data = await response.json();

            // ЛОГИКА ПОДСЧЕТА (Имитация того, что мы сделаем в воркере)
            let foundBoxes = [];
            let boxCount = 0;

            if (data && data.data && data.data.detail) {
                // Ищем всё, что похоже на коробку
                foundBoxes = data.data.detail.filter(item => {
                    const name = (item.inscriptionName || '').toLowerCase();
                    const body = (item.contentBody || '').toLowerCase();
                    // Здесь можно добавить любые условия поиска
                    return name.includes('fennec') || name.includes('box');
                });
                boxCount = foundBoxes.length;
            }

            return new Response(
                JSON.stringify(
                    {
                        method: 'Manual Parse via Indexer List',
                        status: response.status,
                        total_inscriptions_scanned: data?.data?.total || 0,
                        fennec_boxes_found: boxCount,
                        boxes_preview: foundBoxes.map(b => b.inscriptionName),
                        raw_data_sample: data?.data?.detail?.[0]
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
