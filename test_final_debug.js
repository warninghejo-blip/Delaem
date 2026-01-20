export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';
        // ВНИМАНИЕ: Если этот ключ выдает -2003, попробуйте создать новый аккаунт или подождать 24ч
        const apiKey = env.UNISAT_API_KEY;

        // Эндпоинт v1 более лоялен к лимитам
        const url = `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/inscription-data?cursor=0&size=100`;

        const headers = {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json'
        };

        try {
            const res = await fetch(url, { headers });
            const data = await res.json();

            // Ищем Fennec Boxes прямо в деталях
            const items = data.data?.detail || [];
            const debugList = items.map(i => ({
                name: i.inscriptionName,
                id: i.inscriptionId,
                col: i.collectionId // ТУТ ДОЛЖНО БЫТЬ fennec_boxes
            }));

            return new Response(
                JSON.stringify(
                    {
                        status: res.status,
                        code: data.code,
                        msg: data.msg,
                        found_count: items.length,
                        items: debugList.slice(0, 5) // Посмотрим на первые 5
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
