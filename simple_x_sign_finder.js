// Простой скрипт для поиска x-sign
// Вставьте в консоль на странице uniscan.cc или inswap.cc

console.clear();
console.log('%c🔍 ПОИСК X-SIGN АЛГОРИТМА', 'font-size: 20px; font-weight: bold; color: #4ec9b0;');
console.log('Скрипт установлен! Обновите страницу или сделайте запрос.\n');

let foundRequests = [];

// 1. Перехватываем fetch
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Проверяем запросы к нужным доменам
    if (urlStr.includes('uniscan.cc') || urlStr.includes('inswap.cc') || urlStr.includes('unisat.io')) {
        const headers = options.headers || {};
        const xSign = headers['x-sign'] || headers['X-Sign'] || (headers.get && headers.get('x-sign'));
        const xTs = headers['x-ts'] || headers['X-Ts'] || (headers.get && headers.get('x-ts'));

        if (xSign || xTs) {
            console.log('%c✅ НАЙДЕН ЗАПРОС С X-SIGN (fetch)', 'background: #0f3f0f; color: white; padding: 5px; font-weight: bold;');
            console.log('URL:', urlStr);
            console.log('x-sign:', xSign);
            console.log('x-ts:', xTs);
            console.log('Все headers:', headers);
            console.trace();
            console.log('\n');

            foundRequests.push({ type: 'fetch', url: urlStr, xSign, xTs, headers });
        }
    }

    return originalFetch.apply(this, arguments);
};

// 2. Перехватываем XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._method = method;
    this._url = url;
    this._headers = {};
    return originalXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (!this._headers) this._headers = {};
    this._headers[name] = value;

    if (name.toLowerCase() === 'x-sign' || name.toLowerCase() === 'x-ts') {
        console.log('%c✅ НАЙДЕН ЗАГОЛОВОК ' + name.toUpperCase() + ' (XHR)', 'background: #0f3f0f; color: white; padding: 5px; font-weight: bold;');
        console.log('URL:', this._url);
        console.log(name + ':', value);
        console.trace();
        console.log('\n');
    }

    return originalXHRSetRequestHeader.apply(this, [name, value]);
};

XMLHttpRequest.prototype.send = function(...args) {
    if (this._url && (this._url.includes('uniscan.cc') || this._url.includes('inswap.cc') || this._url.includes('unisat.io'))) {
        const xSign = this._headers && (this._headers['x-sign'] || this._headers['X-Sign']);
        const xTs = this._headers && (this._headers['x-ts'] || this._headers['X-Ts']);

        if (xSign || xTs) {
            console.log('%c✅ НАЙДЕН ЗАПРОС С X-SIGN (XHR)', 'background: #0f3f0f; color: white; padding: 5px; font-weight: bold;');
            console.log('URL:', this._url);
            console.log('Method:', this._method);
            console.log('x-sign:', xSign);
            console.log('x-ts:', xTs);
            console.log('Все headers:', this._headers);
            console.trace();
            console.log('\n');

            foundRequests.push({ type: 'XHR', url: this._url, method: this._method, xSign, xTs, headers: this._headers });
        }
    }

    return originalXHRSend.apply(this, args);
};

// 3. Перехватываем axios (если используется)
if (window.axios && window.axios.interceptors) {
    const originalUse = window.axios.interceptors.request.use;
    window.axios.interceptors.request.use = function(fulfilled, rejected) {
        return originalUse.call(this, function(config) {
            if (config.url && (config.url.includes('uniscan.cc') || config.url.includes('inswap.cc') || config.url.includes('unisat.io'))) {
                const xSign = config.headers && (config.headers['x-sign'] || config.headers['X-Sign']);
                const xTs = config.headers && (config.headers['x-ts'] || config.headers['X-Ts']);

                if (xSign || xTs) {
                    console.log('%c✅ НАЙДЕН ЗАПРОС С X-SIGN (axios)', 'background: #0f3f0f; color: white; padding: 5px; font-weight: bold;');
                    console.log('URL:', config.url);
                    console.log('x-sign:', xSign);
                    console.log('x-ts:', xTs);
                    console.log('Config:', config);
                    console.trace();
                    console.log('\n');

                    foundRequests.push({ type: 'axios', url: config.url, xSign, xTs, headers: config.headers });
                }
            }
            return fulfilled ? fulfilled(config) : config;
        }, rejected);
    };
}

// Сохраняем результаты в глобальной переменной
window._xSignRequests = foundRequests;

// Показываем инструкции
console.log('%c📋 ИНСТРУКЦИЯ:', 'font-size: 16px; font-weight: bold; color: #569cd6;');
console.log('1. Обновите страницу (F5)');
console.log('2. Или сделайте любой запрос на странице');
console.log('3. Когда увидите "НАЙДЕН ЗАПРОС С X-SIGN", нажмите на стрелку в call stack');
console.log('4. Найдите функцию, которая устанавливает x-sign');
console.log('5. Скопируйте код этой функции');
console.log('\n');
console.log('Все найденные запросы сохранены в window._xSignRequests');
console.log('Для просмотра выполните: console.log(window._xSignRequests)');

