export default {
    async fetch(request, env) {
        const startTime = Date.now();

        // Target Uniscan aggregation endpoint
        const url =
            'https://uniscan.cc/fractal-api/query-v4/asset-relay/address/bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt/all-token-info';

        // Stealth Headers that worked previously
        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            Connection: 'keep-alive',
            Referer: 'https://uniscan.cc/',
            Origin: 'https://uniscan.cc'
        };

        let responseStatus = 0;
        let responseData = null;
        let error = null;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            responseStatus = response.status;

            // Try to parse JSON response
            const responseText = await response.text();

            try {
                responseData = JSON.parse(responseText);
            } catch (parseError) {
                // If not JSON, return as text
                responseData = responseText;
            }
        } catch (fetchError) {
            error = fetchError.message;
            responseStatus = 0;
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Return comprehensive JSON report
        return new Response(
            JSON.stringify(
                {
                    status: responseStatus,
                    time_ms: duration,
                    data: responseData,
                    error: error,
                    timestamp: new Date().toISOString(),
                    url: url
                },
                null,
                2
            ),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }
};
