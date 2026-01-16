(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const isDevMode = urlParams.get('dev') === 'true';

    if (!isDevMode) return;

    console.log(
        '%c 🤖 DEV MODE ACTIVE ',
        'background: #FF6B35; color: black; font-weight: bold; padding: 4px 8px;',
        'AI Error Analysis включен'
    );

    // Перехват window.onerror
    const originalOnError = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
        const errorData = {
            error: String(message || ''),
            stack: error?.stack || 'N/A',
            variables: {
                userAddress: window.userAddress || null,
                currentSwapPair: window.currentSwapPair || null,
                unisat: typeof window.unisat !== 'undefined'
            }
        };

        fetch('https://fennec-api.warninghejo.workers.dev?action=analyze_error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorData)
        })
            .then(res => res.json())
            .then(data => {
                console.log(
                    '%c 🤖 AI DIAGNOSIS ',
                    'background: #4CAF50; color: white; font-weight: bold; padding: 4px 8px;',
                    data.analysis || 'No analysis'
                );
            })
            .catch(err => {
                console.warn('AI analysis request failed:', err);
            });

        if (originalOnError) {
            return originalOnError.apply(this, arguments);
        }
        return false;
    };

    // Перехват console.error
    const originalConsoleError = console.error;
    console.error = function (...args) {
        const errorText = args.map(a => String(a)).join(' ');

        if (errorText.includes('AI DIAGNOSIS') || errorText.includes('AI analysis')) {
            return originalConsoleError.apply(console, args);
        }

        const errorData = {
            error: errorText,
            stack: new Error().stack || 'N/A',
            variables: {
                userAddress: window.userAddress || null,
                currentSwapPair: window.currentSwapPair || null
            }
        };

        fetch('https://fennec-api.warninghejo.workers.dev?action=analyze_error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorData)
        })
            .then(res => res.json())
            .then(data => {
                console.log(
                    '%c 🤖 AI DIAGNOSIS ',
                    'background: #4CAF50; color: white; font-weight: bold; padding: 4px 8px;',
                    data.analysis || 'No analysis'
                );
            })
            .catch(() => {});

        return originalConsoleError.apply(console, args);
    };

    // Экспорт для внешнего использования
    window.aiProbe = {
        enabled: true,
        version: '1.0.0'
    };
})();
