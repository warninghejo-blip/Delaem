export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';

        // HEADERS CONFIG
        const stealthHeaders = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            Referer: 'https://fractal.unisat.io/',
            Origin: 'https://fractal.unisat.io'
        };

        const results = {
            test1_market_collection_inscriptions: null,
            test2_market_inscription_info_list: null,
            test3_open_api_hybrid: null
        };

        // TEST 1: Market Collection Inscriptions (Stealth Only)
        try {
            const url1 = 'https://fractal.unisat.io/api/market-v4/collection/auction/collection_inscriptions';
            const start1 = Date.now();

            const response1 = await fetch(url1, {
                method: 'POST',
                headers: stealthHeaders,
                body: JSON.stringify({
                    address: address,
                    start: 0,
                    limit: 20
                }),
                cf: { cacheTtl: 0 }
            });

            const text1 = await response1.text();
            let json1;
            try {
                json1 = JSON.parse(text1);
            } catch (e) {
                json1 = text1.substring(0, 500);
            }

            results.test1_market_collection_inscriptions = {
                url: url1,
                status: response1.status,
                time_ms: Date.now() - start1,
                result_preview: json1
            };
        } catch (e) {
            results.test1_market_collection_inscriptions = {
                error: e.message,
                status: 0
            };
        }

        // TEST 2: Market Inscription Info List (Stealth Only)
        try {
            const url2 = 'https://fractal.unisat.io/api/market-v4/collection/auction/inscription_info_list';
            const start2 = Date.now();

            const response2 = await fetch(url2, {
                method: 'POST',
                headers: stealthHeaders,
                body: JSON.stringify({
                    inscriptionIds: [] // Empty list just to check Auth
                }),
                cf: { cacheTtl: 0 }
            });

            const text2 = await response2.text();
            let json2;
            try {
                json2 = JSON.parse(text2);
            } catch (e) {
                json2 = text2.substring(0, 500);
            }

            results.test2_market_inscription_info_list = {
                url: url2,
                status: response2.status,
                time_ms: Date.now() - start2,
                result_preview: json2
            };
        } catch (e) {
            results.test2_market_inscription_info_list = {
                error: e.message,
                status: 0
            };
        }

        // TEST 3: Open API Indexer (HYBRID: Key + Stealth)
        try {
            const url3 = `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/inscription-data?cursor=0&size=50`;
            const hybridHeaders = {
                ...stealthHeaders,
                Authorization: `Bearer ${env.UNISAT_API_KEY}`
            };

            const start3 = Date.now();

            const response3 = await fetch(url3, {
                method: 'GET',
                headers: hybridHeaders,
                cf: { cacheTtl: 0 }
            });

            const text3 = await response3.text();
            let json3;
            try {
                json3 = JSON.parse(text3);
            } catch (e) {
                json3 = text3.substring(0, 500);
            }

            results.test3_open_api_hybrid = {
                url: url3,
                status: response3.status,
                time_ms: Date.now() - start3,
                result_preview: json3
            };
        } catch (e) {
            results.test3_open_api_hybrid = {
                error: e.message,
                status: 0
            };
        }

        return new Response(JSON.stringify(results, null, 2), {
            headers: { 'content-type': 'application/json' }
        });
    }
};
