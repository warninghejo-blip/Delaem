// Stealth Check Worker - Tests UniSat API Rate Limit bypass
export default {
    async fetch(request, env) {
        const startTime = Date.now();

        // Target UniSat API endpoint
        const targetUrl =
            'https://open-api-fractal.unisat.io/v1/indexer/address/bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt/brc20/summary?start=0&limit=5';

        // Stealth Headers to mimic browser
        const stealthHeaders = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            Pragma: 'no-cache',
            'Cache-Control': 'no-cache'
        };

        // Add Authorization header if API key is available
        if (env.UNISAT_API_KEY) {
            stealthHeaders['Authorization'] = `Bearer ${env.UNISAT_API_KEY}`;
        }

        let responseStatus = 0;
        let bodyPreview = '';
        let responseHeaders = {};

        try {
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: stealthHeaders
            });

            responseStatus = response.status;

            // Store response headers for debugging
            responseHeaders = Object.fromEntries(response.headers.entries());

            // Get response body preview
            const responseText = await response.text();
            bodyPreview = responseText.substring(0, 500);
        } catch (error) {
            responseStatus = 0;
            bodyPreview = `Error: ${error.message}`;
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Return JSON response with all details
        return new Response(
            JSON.stringify({
                status: responseStatus,
                time_ms: duration,
                headers_sent: stealthHeaders,
                response_headers: responseHeaders,
                body_preview: bodyPreview,
                timestamp: new Date().toISOString()
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }
};
