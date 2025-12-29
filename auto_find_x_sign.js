// Автоматический поиск алгоритма x-sign в браузере
// Инструкция: Откройте консоль DevTools на странице Uniscan и вставьте этот код

(function() {
    console.log('🔍 Начинаю поиск алгоритма x-sign...\n');

    const results = {
        X_function: null,
        U_dollar_i: null,
        ei_function: null,
        en_class: null,
        ep_function: null,
        e_constant: null,
        interceptor_code: null
    };

    // Поиск в глобальных объектах
    function searchInObject(obj, name, depth = 0, maxDepth = 3) {
        if (depth > maxDepth) return null;

        try {
            // Проверяем сам объект
            if (typeof obj === 'function') {
                const funcStr = obj.toString();
                if (funcStr.includes('x-sign') || funcStr.includes('X-Sign') ||
                    funcStr.includes('ei(') || funcStr.includes('new en()') ||
                    funcStr.includes('U.$i') || funcStr.includes('X((0')) {
                    return { obj, name, funcStr };
                }
            }

            // Проверяем свойства
            for (let key in obj) {
                try {
                    if (key.includes('$i') || key.includes('X') ||
                        key.includes('ei') || key.includes('en') ||
                        key.includes('ep') || key === 'e_') {
                        const value = obj[key];
                        if (typeof value === 'function' || typeof value === 'object') {
                            const found = searchInObject(value, key, depth + 1, maxDepth);
                            if (found) return found;
                        }
                    }
                } catch (e) {
                    // Игнорируем ошибки доступа
                }
            }
        } catch (e) {
            // Игнорируем ошибки
        }

        return null;
    }

    // Поиск в window
    console.log('📦 Поиск в window...');
    for (let key in window) {
        try {
            const value = window[key];
            if (typeof value === 'object' && value !== null) {
                const found = searchInObject(value, key);
                if (found) {
                    console.log(`✅ Найдено в window.${key}:`, found);
                }
            }
        } catch (e) {}
    }

    // Поиск в источниках (если доступны)
    if (window.__webpack_require__) {
        console.log('📦 Поиск в webpack модулях...');
        try {
            const cache = window.__webpack_require__.cache;
            for (let id in cache) {
                const module = cache[id];
                if (module && module.exports) {
                    const found = searchInObject(module.exports, id);
                    if (found) {
                        console.log(`✅ Найдено в модуле ${id}:`, found);
                    }
                }
            }
        } catch (e) {
            console.log('⚠️ Не удалось проверить webpack модули');
        }
    }

    // Поиск через перехват fetch/axios
    console.log('\n📡 Перехватываю HTTP запросы...');

    // Перехватываем fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        const options = args[1] || {};

        // Проверяем заголовки на наличие x-sign
        if (options.headers && (options.headers['x-sign'] || options.headers['X-Sign'])) {
            console.log('✅ Найден запрос с x-sign:', {
                url,
                'x-sign': options.headers['x-sign'] || options.headers['X-Sign'],
                'x-ts': options.headers['x-ts'] || options.headers['X-Ts']
            });

            // Пытаемся найти источник генерации
            console.trace('📍 Call stack для генерации x-sign:');
        }

        return originalFetch.apply(this, args);
    };

    // Перехватываем axios (если используется)
    if (window.axios) {
        const originalRequest = window.axios.interceptors.request.use;
        window.axios.interceptors.request.use = function(fulfilled, rejected) {
            console.log('✅ Найден axios interceptor');
            return originalRequest.call(this, function(config) {
                if (config.headers && (config.headers['x-sign'] || config.headers['X-Sign'])) {
                    console.log('✅ Найден x-sign в axios:', {
                        url: config.url,
                        'x-sign': config.headers['x-sign'] || config.headers['X-Sign'],
                        'x-ts': config.headers['x-ts'] || config.headers['X-Ts']
                    });
                    console.trace('📍 Call stack:');
                }
                return fulfilled ? fulfilled(config) : config;
            }, rejected);
        };
    }

    // Инструкции для пользователя
    console.log('\n📋 ИНСТРУКЦИЯ:');
    console.log('1. Откройте DevTools → Sources');
    console.log('2. Найдите файл _app-2637cbcbd7da64c9.js');
    console.log('3. Поиск (Ctrl+F) по следующим строкам:');
    console.log('   - "U.$i" или "U[\'$i\']"');
    console.log('   - "function X" или "const X"');
    console.log('   - "function ei" или "new en()"');
    console.log('   - "function ep"');
    console.log('   - "@#?.#@"');
    console.log('\n4. Сделайте запрос на странице (например, обновите страницу)');
    console.log('5. Скопируйте найденные функции и отправьте мне\n');

    // Возвращаем результаты
    return results;
})();

