export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        // Collection Indexer endpoint - группирует по коллекциям
        const url = `https://open-api-fractal.unisat.io/v1/collection-indexer/address/${address}/collection/list?start=0&limit=20`;

        // HEADERS (Pure Stealth - NO Authorization)
        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            Referer: 'https://fractal.unisat.io/',
            Origin: 'https://fractal.unisat.io',
            Connection: 'keep-alive'
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
                        endpoint: 'collection-indexer/list',
                        error: 'Invalid JSON response',
                        raw_preview: text.substring(0, 500)
                    }),
                    { headers: { 'content-type': 'application/json' } }
                );
            }

            // Анализируем количество коллекций
            let collectionsFound = 0;
            let collectionsList = [];

            // Проверяем разные возможные структуры данных
            if (data && data.data) {
                if (Array.isArray(data.data.list)) {
                    collectionsFound = data.data.list.length;
                    collectionsList = data.data.list.slice(0, 5); // Первые 5 для превью
                } else if (Array.isArray(data.data.detail)) {
                    collectionsFound = data.data.detail.length;
                    collectionsList = data.data.detail.slice(0, 5);
                } else if (Array.isArray(data.data)) {
                    collectionsFound = data.data.length;
                    collectionsList = data.data.slice(0, 5);
                }
            }

            const result = {
                status: response.status,
                time_ms: Date.now() - start,
                endpoint: 'collection-indexer/list',
                collections_found: collectionsFound,
                data_preview: data,
                collections_preview: collectionsList,
                success: response.status === 200
            };

            // Добавляем информацию о структуре данных для дебага
            if (data && data.data) {
                result.data_structure = {
                    has_data: !!data.data,
                    data_keys: Object.keys(data.data),
                    has_list: !!data.data.list,
                    has_detail: !!data.data.detail,
                    is_array: Array.isArray(data.data)
                };
            }

            return new Response(JSON.stringify(result, null, 2), {
                headers: { 'content-type': 'application/json' }
            });
        } catch (e) {
            return new Response(
                JSON.stringify({
                    status: 0,
                    endpoint: 'collection-indexer/list',
                    error: e.message,
                    collections_found: 0,
                    data_preview: null
                }),
                { headers: { 'content-type': 'application/json' } }
            );
        }
    }
};
