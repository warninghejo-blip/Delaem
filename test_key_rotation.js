export default {
    async fetch(request, env) {
        const address = 'bc1pe46pjefdel9jnue8e5459ltycng99er2pfxu7hs5yvhae54y802ssmynjt';

        // KEYS CONFIG - Проверяем env переменные и фоллбэк
        const keys = [env.UNISAT_API_KEY, env.UNISAT_API_KEY_2, env.UNISAT_API_KEY_3, env.UNISAT_API_KEY_4].filter(
            k => !!k
        );

        // Фоллбэк для тестирования - можно захардкодить ключи здесь
        const fallbackKeys = [
            // "key1_here",
            // "key2_here",
            // "key3_here",
            // "key4_here"
        ].filter(k => !!k);

        const allKeys = keys.length > 0 ? keys : fallbackKeys;

        if (allKeys.length === 0) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'No API keys available. Set UNISAT_API_KEY, UNISAT_API_KEY_2, etc. or hardcode in fallbackKeys.'
                }),
                { headers: { 'content-type': 'application/json' } }
            );
        }

        let successData = null;
        let usedKeyIndex = -1;
        const errors = [];

        // LOOP LOGIC - Пробуем каждый ключ
        for (let i = 0; i < allKeys.length; i++) {
            const key = allKeys[i];
            const url = `https://open-api-fractal.unisat.io/v1/indexer/address/${address}/inscription-data?cursor=0&size=200`;

            try {
                const start = Date.now();
                const res = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${key}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                        Accept: 'application/json'
                    }
                });

                const json = await res.json();
                const duration = Date.now() - start;

                if (res.status === 200 && json.code === 0) {
                    // УСПЕХ!
                    successData = json;
                    usedKeyIndex = i;
                    console.log(`Key ${i} SUCCESS in ${duration}ms`);
                    break;
                } else {
                    // Ошибка - логируем и пробуем следующий ключ
                    errors.push({
                        key_index: i,
                        status: res.status,
                        code: json.code,
                        msg: json.msg,
                        duration_ms: duration
                    });
                    console.log(`Key ${i} FAILED: ${json.code} - ${json.msg}`);
                }
            } catch (e) {
                errors.push({
                    key_index: i,
                    error: e.message,
                    status: 0
                });
                console.log(`Key ${i} EXCEPTION: ${e.message}`);
            }
        }

        // PARSE LOGIC - Только если успешно
        let fennecCount = 0;
        let fennecPreview = [];
        let totalInscriptions = 0;

        if (successData && successData.data && successData.data.detail) {
            const list = successData.data.detail || [];
            totalInscriptions = list.length;

            const fennecItems = list.filter(item => {
                const name = (item.inscriptionName || '').toLowerCase();
                return name.includes('fennec');
            });

            fennecCount = fennecItems.length;
            fennecPreview = fennecItems.slice(0, 5).map(i => i.inscriptionName);
        }

        // RETURN JSON REPORT
        const result = {
            success: !!successData,
            key_used_index: usedKeyIndex,
            total_keys_available: allKeys.length,
            total_inscriptions: totalInscriptions,
            fennec_found_count: fennecCount,
            fennec_preview: fennecPreview,
            errors_encountered: errors,
            rotation_worked: usedKeyIndex >= 0 && usedKeyIndex !== 0 // Работает если использовали не первый ключ
        };

        return new Response(JSON.stringify(result, null, 2), {
            headers: { 'content-type': 'application/json' }
        });
    }
};
