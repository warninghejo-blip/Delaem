export async function handleAiAction(ctx) {
    const { action, request, sendJSON, env, __rateLimit, callGemini, __disableInswap, upstreamHeaders, SWAP_BASE } =
        ctx || {};

    if (!action || (action !== 'chat' && action !== 'qa_agent_check' && action !== 'analyze_error')) return null;

    if (typeof sendJSON !== 'function') {
        throw new Error('sendJSON is required');
    }

    if (action === 'chat') {
        if (request?.method !== 'POST') return sendJSON({ error: 'Method not allowed' }, 405);

        let userMessage = '';
        let history = [];
        let uiContext = {};

        const __fallbackChat = text => {
            const raw = String(text || '').trim();
            const t = raw.toLowerCase();

            const numMatch = raw.match(/(\d+(?:\.\d+)?)/);
            const amount = numMatch ? numMatch[1] : '';

            const mkReply = (msg, actionObj) => {
                const safeMsg = String(msg || '').trim();
                if (actionObj) return `${safeMsg}\n\n|||${JSON.stringify(actionObj)}|||`;
                return safeMsg;
            };

            if (t.includes('connect') && t.includes('wallet')) {
                return mkReply('AI is temporarily unavailable. I can still trigger wallet connection.', {
                    type: 'CONNECT_WALLET',
                    params: {}
                });
            }

            if (t.includes('deposit')) {
                return mkReply('AI is temporarily unavailable. I can still open the deposit tab.', {
                    type: 'OPEN_DEPOSIT',
                    params: {}
                });
            }

            if (t.includes('withdraw')) {
                return mkReply('AI is temporarily unavailable. I can still open the withdraw tab.', {
                    type: 'OPEN_WITHDRAW',
                    params: {}
                });
            }

            if (t.includes('swap') || t.includes('buy') || t.includes('sell')) {
                const hasBtc = t.includes('btc');
                const pair = hasBtc ? 'BTC_FB' : 'FB_FENNEC';

                let buy = true;
                if (pair === 'FB_FENNEC') {
                    if (t.includes('sell') && t.includes('fennec')) buy = false;
                    if (t.includes('to fb')) buy = false;
                    if (t.includes('buy') && t.includes('fennec')) buy = true;
                    if (t.includes('to fennec')) buy = true;
                } else {
                    if (t.includes('sell') && (t.includes('fb') || t.includes('sfb'))) buy = false;
                    if (t.includes('to btc')) buy = false;
                    if (t.includes('buy') && (t.includes('fb') || t.includes('sfb'))) buy = true;
                    if (t.includes('to fb')) buy = true;
                }

                return mkReply('AI is temporarily unavailable. I can still prefill the swap form for you.', {
                    type: 'FILL_SWAP',
                    params: {
                        pair,
                        amount: amount || '0.0',
                        buy
                    }
                });
            }

            return 'AI is temporarily unavailable (Gemini key missing/blocked). Please try again later.';
        };

        try {
            const ip =
                String(request.headers.get('CF-Connecting-IP') || '').trim() ||
                String(request.headers.get('X-Forwarded-For') || '')
                    .split(',')[0]
                    .trim() ||
                'unknown';

            if (env?.RATE_LIMITER) {
                const bucket = Math.floor(Date.now() / 3600000);
                const k = `chat:${ip}:${bucket}`;
                const v = Number((await env.RATE_LIMITER.get(k)) || 0) || 0;
                if (v >= 20) return sendJSON({ reply: 'Too many messages. Chill.' }, 429);
                await env.RATE_LIMITER.put(k, String(v + 1), {
                    expirationTtl: 3600
                });
            } else if (__rateLimit) {
                const rl = __rateLimit(`ip:${ip}:chat`, 20, 3_600_000);
                if (!rl.ok) return sendJSON({ reply: 'Too many messages. Chill.' }, 429);
            }
        } catch (_) {
            void _;
        }

        try {
            const body = await request.json();
            userMessage = body?.message;
            history = Array.isArray(body?.history) ? body.history : [];
            uiContext = body?.context && typeof body.context === 'object' ? body.context : {};
        } catch (_) {
            void _;
        }

        try {
            if (typeof callGemini !== 'function') {
                return sendJSON({ reply: __fallbackChat(userMessage) }, 200);
            }

            const builtinKnowledgeBase = `Fennec Swap is a DEX + terminal on Fractal Bitcoin.

KEY FACTS:
- Fractal Bitcoin is a Bitcoin-adjacent network with fast blocks (~30s).
- FENNEC is a BRC-20 token on Fractal.
- FB (sFB___000) is the native gas / main asset in the UI.
- BTC (sBTC___000) is bridged BTC inside Fractal.

TERMINAL OPERATIONS:
- SWAP: FB ↔ FENNEC and BTC ↔ FB.
- DEPOSIT: funds move from Bitcoin/Fractal into Fractal; balances appear after confirmations.
- WITHDRAW: funds move from Fractal back to Bitcoin mainnet.
  - Withdraw often has two tx identifiers: a burn/fee tx on Fractal and a receiveTxid on Bitcoin mainnet.

UNISAT:
- The site uses UniSat as a browser extension wallet (window.unisat).

FENNEC ID (v6.0, brief):
- Score (0..100) is derived from Activity/Wealth/Time/Badges, with an optional MAXI multiplier.
- Rarity thresholds: CUB(0-29), SCOUT(30-49), HUNTER(50-64), ALPHA(65-79), ELDER(80-94), SPIRIT(95-100).
- MAXI activates if FENNEC >= 10,000 or there is a LP position involving FENNEC.

IF YOU ARE NOT SURE:
- Say you are not sure.
- Provide verifiable sources or a search query.`;

            let knowledgeBase = builtinKnowledgeBase;
            try {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), 1500);
                const kbRes = await fetch('https://fennecbtc.xyz/knowledge_en.txt', {
                    signal: controller.signal
                });
                if (kbRes.ok) {
                    const kbText = await kbRes.text();
                    const trimmed = (kbText || '').trim();
                    knowledgeBase = trimmed ? `${trimmed}\n\n${builtinKnowledgeBase}` : builtinKnowledgeBase;
                }
            } catch (e) {
                void e;
            }

            let marketData = 'Price unavailable.';
            try {
                const cacheObj = globalThis.__fennecChatPriceCache || (globalThis.__fennecChatPriceCache = {});
                const now = Date.now();
                if (cacheObj.ts && cacheObj.text && now - cacheObj.ts < 15000) {
                    marketData = cacheObj.text;
                } else if (!__disableInswap) {
                    const swapBase = String(SWAP_BASE || 'https://open-api-fractal.unisat.io/v1').trim();
                    let poolUrl = `${swapBase}/brc20-swap/pool_info?tick0=FENNEC&tick1=sFB___000`;
                    let poolRes = await fetch(poolUrl, { headers: upstreamHeaders || {} });
                    if (!poolRes.ok && poolRes.status === 404) {
                        poolUrl = `${swapBase}/indexer/brc20-swap/pool_info?tick0=FENNEC&tick1=sFB___000`;
                        poolRes = await fetch(poolUrl, { headers: upstreamHeaders || {} });
                    }
                    const poolJson = await poolRes.json();
                    if (poolJson.data) {
                        const fennec = parseFloat(poolJson.data.amount0 || poolJson.data.amount1);
                        const fb = parseFloat(poolJson.data.amount1 || poolJson.data.amount0);
                        const price = (fb / fennec).toFixed(8);
                        marketData = `PRICE: 1 FENNEC = ${price} FB.`;
                        cacheObj.ts = now;
                        cacheObj.text = marketData;
                    }
                }
            } catch (e) {
                void e;
            }

            const contextStr = `Section: ${uiContext.section || 'home'}, Tab: ${
                uiContext.tab || 'none'
            }, Swap: ${uiContext.swapPair || 'N/A'}`;

            const systemPrompt = `
You are Fennec (Fennec Oracle), the AI assistant of the Fennec terminal on Fractal Bitcoin.
Your goal is to help users trade, debug issues, and understand the ecosystem.

CURRENT UI CONTEXT:
${contextStr}

KNOWLEDGE BASE:
${knowledgeBase}

MARKET DATA:
${marketData}

INSTRUCTIONS:
1. LANGUAGE: ALWAYS respond in English. Do not output any non-English words. If the user writes in another language, respond in English.
2. If the question is about Fennec/Fractal/UniSat/Terminal errors, answer precisely using the Knowledge Base.
3. If you are unsure, say so and provide verifiable sources or a search query.
4. Style: concise, technical, friendly.

=== TERMINAL FUNCTIONS ===
SWAP: Swap FB ↔ FENNEC and BTC ↔ FB
DEPOSIT: Deposit BTC/FB/FENNEC into Fractal
WITHDRAW: Withdraw to Bitcoin mainnet (burn on Fractal)
FENNEC ID: Generate and view your Fennec ID card

=== AI COMMANDS ===
1. NAVIGATE: {"type":"NAVIGATE","params":{"tab":"swap|deposit|withdraw|id"}}
2. FILL_SWAP: {"type":"FILL_SWAP","params":{"pair":"FB_FENNEC|BTC_FB","amount":"0.5","buy":true|false}}
   - buy=true: BUY FENNEC (you pay FB/BTC)
   - buy=false: SELL FENNEC (you pay FENNEC)
3. EXECUTE_SWAP: auto-execute the swap after filling
4. CONNECT_WALLET: {"type":"CONNECT_WALLET","params":{}}
5. OPEN_ID: {"type":"OPEN_ID","params":{}}

EXAMPLES:
- "swap 0.5 FB to FENNEC" → |||{"type":"FILL_SWAP","params":{"pair":"FB_FENNEC","amount":"0.5","buy":true}}|||
- "sell 100 FENNEC" → |||{"type":"FILL_SWAP","params":{"pair":"FB_FENNEC","amount":"100","buy":false}}|||
- "show my ID" → |||{"type":"OPEN_ID","params":{}}|||
`;

            let conversationHistory = '';
            for (const h of history.slice(-6)) {
                const role = h && h.role === 'assistant' ? 'AI' : 'User';
                const content = h && typeof h.content === 'string' ? h.content : '';
                if (content && content.length <= 500) {
                    conversationHistory += `${role}: ${content}\n`;
                }
            }

            const fullPrompt = `${systemPrompt}\n\n${
                conversationHistory ? 'History:\n' + conversationHistory + '\n' : ''
            }User: ${String(userMessage || '')}`;

            const result = await callGemini(fullPrompt, {
                purpose: 'chat',
                useSearch: true,
                temperature: 0.7,
                maxModelAttempts: 3,
                timeoutMs: 12000
            });

            let replyText = String(result.text || '').trim();
            try {
                if (replyText && /[\u0400-\u04FF]/.test(replyText)) {
                    const rewrite = await callGemini(
                        `Rewrite the following text in English only. Output ONLY English.\n\nTEXT:\n${replyText}`,
                        {
                            purpose: 'chat',
                            useSearch: false,
                            temperature: 0.2,
                            maxModelAttempts: 1,
                            timeoutMs: 6000
                        }
                    );
                    const fixed = String(rewrite && rewrite.text ? rewrite.text : '').trim();
                    if (fixed && !/[\u0400-\u04FF]/.test(fixed)) replyText = fixed;
                }
            } catch (e) {
                void e;
            }

            return sendJSON({ reply: replyText || 'Empty reply.' });
        } catch (e) {
            console.error('Chat error:', e);
            const fallbackReply = __fallbackChat(userMessage);
            return sendJSON({ reply: fallbackReply || 'AI is temporarily unavailable.' }, 200);
        }
    }

    if (action === 'qa_agent_check') {
        if (request?.method !== 'POST') return sendJSON({ error: 'Method not allowed' }, 405);

        if (typeof callGemini !== 'function') {
            return sendJSON({
                status: 'FAIL',
                windsurf_instruction: 'Gemini API not configured.'
            });
        }

        try {
            const body = await request.json();
            const { page_state, console_logs, network_errors } = body;

            const errorLogs = (console_logs || []).filter(l => l.type === 'error');
            const hasErrors = errorLogs.length > 0 || (network_errors || []).length > 0;

            if (!hasErrors) {
                return sendJSON({
                    status: 'PASS',
                    message: 'Все системы работают нормально. Ошибок не обнаружено.'
                });
            }

            const prompt = `Ты QA Lead. Проверь состояние страницы.

Логи: ${JSON.stringify(errorLogs, null, 2)}
Сетевые ошибки: ${JSON.stringify(network_errors, null, 2)}
Состояние страницы: ${JSON.stringify(page_state, null, 2)}

Если есть ошибки (красные логи, NaN в балансах, пустые списки):
Верни JSON: { "status": "FAIL", "windsurf_instruction": "В файле X ошибка Y. Исправь так: ..." }

Если все чисто:
Верни JSON: { "status": "PASS", "message": "Все системы работают нормально." }`;

            const result = await callGemini(prompt, {
                purpose: 'qa',
                temperature: 0.3,
                maxModelAttempts: 3,
                timeoutMs: 12000
            });

            try {
                const parsed = JSON.parse(result.text);
                return sendJSON(parsed);
            } catch (e) {
                return sendJSON({
                    status: 'FAIL',
                    windsurf_instruction: result.text
                });
            }
        } catch (e) {
            return sendJSON({ error: e.message }, 500);
        }
    }

    if (action === 'analyze_error') {
        if (request?.method !== 'POST') return sendJSON({ error: 'Method not allowed' }, 405);

        if (typeof callGemini !== 'function') {
            return sendJSON({ analysis: 'Gemini API not configured.' });
        }

        try {
            const body = await request.json();
            const { error, stack, variables } = body;

            const prompt = `Ты Senior Frontend Developer. Произошла ошибка на клиенте.

Error: ${error}
Stack: ${stack || 'N/A'}
Важные переменные: ${JSON.stringify(variables, null, 2)}

Задача:
1. Найди точную причину ошибки.
2. Предложи быстрое решение (что изменить в коде).
3. Если это проблема с API или данными, укажи это.
Будь кратким и техничным.`;

            const result = await callGemini(prompt, {
                purpose: 'analysis',
                temperature: 0.3,
                maxModelAttempts: 3,
                timeoutMs: 12000
            });

            return sendJSON({ analysis: result.text });
        } catch (e) {
            return sendJSON({ analysis: `AI analysis failed: ${e.message}` });
        }
    }

    return null;
}
