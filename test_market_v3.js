export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        const url = 'https://open-api-fractal.unisat.io/v3/market/collection/auction/collection_summary';

        const headers = {
            Authorization: `Bearer ${env.UNISAT_API_KEY}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://fractal.unisat.io/',
            Origin: 'https://fractal.unisat.io'
        };

        const body = JSON.stringify({
            address: address,
            firstCollectionId: '' // Можно оставить пустым или убрать
        });

        try {
            const start = Date.now();
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: body
            });

            const data = await response.json();

            return new Response(
                JSON.stringify(
                    {
                        status: response.status,
                        time_ms: Date.now() - start,
                        success: data.code === 0,
                        collections_found: data.data?.list?.length || 0,
                        raw_response: data
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
