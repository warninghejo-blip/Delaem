// Скрипт для поиска en и U.$i в консоли
// Вставьте в консоль на странице uniscan.cc

console.clear();
console.log('%c🔍 ПОИСК en и U.$i', 'font-size: 20px; font-weight: bold; color: #4ec9b0;');
console.log('Ищу: en (класс хеша) и U.$i (что возвращает)\n');

let found = {
    en: [],
    U_dollar_i: [],
    MD5: [],
    SHA256: []
};

// Поиск в глобальных объектах
function searchInObject(obj, name, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return;

    try {
        if (typeof obj === 'function') {
            const funcStr = obj.toString();

            // Ищем en
            if (funcStr.includes('new en()') || funcStr.includes('en().update') ||
                funcStr.includes('en = MD5') || funcStr.includes('en = SHA256') ||
                funcStr.includes('crypto-js')) {
                if (!found.en.some(f => f.name === name)) {
                    found.en.push({
                        name: name,
                        code: funcStr.substring(0, 1000)
                    });
                }
            }

            // Ищем U.$i
            if (funcStr.includes('U.$i') || funcStr.includes('U["$i"]') ||
                funcStr.includes('U[\'$i\']')) {
                if (!found.U_dollar_i.some(f => f.name === name)) {
                    found.U_dollar_i.push({
                        name: name,
                        code: funcStr.substring(0, 1000)
                    });
                }
            }

            // Ищем MD5 или SHA256
            if (funcStr.includes('MD5') || funcStr.includes('md5')) {
                if (!found.MD5.some(f => f.name === name)) {
                    found.MD5.push({
                        name: name,
                        code: funcStr.substring(0, 1000)
                    });
                }
            }

            if (funcStr.includes('SHA256') || funcStr.includes('sha256') || funcStr.includes('SHA-256')) {
                if (!found.SHA256.some(f => f.name === name)) {
                    found.SHA256.push({
                        name: name,
                        code: funcStr.substring(0, 1000)
                    });
                }
            }
        }

        if (typeof obj === 'object' && obj !== null) {
            for (let key in obj) {
                try {
                    // Ищем ключи, связанные с en или U
                    if (key.includes('en') || key.includes('$i') || key.includes('MD5') || key.includes('SHA')) {
                        const value = obj[key];
                        if (typeof value === 'function' || typeof value === 'object') {
                            searchInObject(value, `${name}.${key}`, depth + 1, maxDepth);
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
}

// Поиск в window
console.log('📦 Поиск в window...');
searchInObject(window, 'window');

// Поиск в webpack модулях
if (window.__webpack_require__) {
    console.log('📦 Поиск в webpack модулях...');
    try {
        const cache = window.__webpack_require__.cache;
        for (let id in cache) {
            const module = cache[id];
            if (module && module.exports) {
                searchInObject(module.exports, `module_${id}`);
            }
        }
    } catch (e) {
        console.log('⚠️ Не удалось проверить webpack модули');
    }
}

// Выводим результаты
console.log('\n✅ РЕЗУЛЬТАТЫ ПОИСКА:\n');

if (found.en.length > 0) {
    console.log('%cen (класс хеша):', 'font-weight: bold; color: #569cd6;');
    found.en.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name}:`);
        console.log(item.code);
        console.log('\n');
    });
} else {
    console.log('❌ en не найден автоматически');
}

if (found.U_dollar_i.length > 0) {
    console.log('%cU.$i:', 'font-weight: bold; color: #569cd6;');
    found.U_dollar_i.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name}:`);
        console.log(item.code);
        console.log('\n');
    });
} else {
    console.log('❌ U.$i не найден автоматически');
}

if (found.MD5.length > 0) {
    console.log('%cMD5:', 'font-weight: bold; color: #569cd6;');
    found.MD5.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name}:`);
        console.log(item.code.substring(0, 500));
        console.log('\n');
    });
}

if (found.SHA256.length > 0) {
    console.log('%cSHA256:', 'font-weight: bold; color: #569cd6;');
    found.SHA256.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name}:`);
        console.log(item.code.substring(0, 500));
        console.log('\n');
    });
}

if (Object.keys(found).every(key => found[key].length === 0)) {
    console.log('\n❌ Автоматический поиск не дал результатов.');
    console.log('\n📋 РУЧНОЙ ПОИСК В ФАЙЛЕ:');
    console.log('1. Откройте DevTools → Sources');
    console.log('2. Найдите файл app-2637cbcbd7da64c9.js');
    console.log('3. Используйте поиск (Ctrl+F) для:');
    console.log('   - "const en ="');
    console.log('   - "import en"');
    console.log('   - "crypto-js"');
    console.log('   - "MD5"');
    console.log('   - "SHA256"');
    console.log('   - "U.$i"');
    console.log('   - "U[\\"$i\\"]"');
}

// Сохраняем результаты
window._foundEnAndU = found;

