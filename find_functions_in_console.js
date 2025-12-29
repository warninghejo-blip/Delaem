// Скрипт для поиска функций в консоли
// Вставьте в консоль на странице uniscan.cc

console.clear();
console.log('%c🔍 ПОИСК ФУНКЦИЙ ДЛЯ X-SIGN', 'font-size: 20px; font-weight: bold; color: #4ec9b0;');
console.log('Ищу функции: ei, X, U.$i, ep, ea, eo, L, ed, ef\n');

// Получаем все скрипты на странице
const scripts = Array.from(document.scripts);
let foundFunctions = {};

// Ищем в глобальных объектах
function searchInObject(obj, name, depth = 0, maxDepth = 2) {
    if (depth > maxDepth) return null;

    try {
        if (typeof obj === 'function') {
            const funcStr = obj.toString();
            const searchTerms = ['ei', 'X', 'ep', 'ea', 'eo', 'L', 'U.$i', 'new en()', 'digest', 'MD5', 'SHA256'];

            for (let term of searchTerms) {
                if (funcStr.includes(term) && funcStr.length < 5000) {
                    if (!foundFunctions[term]) foundFunctions[term] = [];
                    foundFunctions[term].push({
                        name: name,
                        code: funcStr.substring(0, 2000)
                    });
                }
            }
        }

        if (typeof obj === 'object' && obj !== null) {
            for (let key in obj) {
                try {
                    if (key.includes('ei') || key.includes('X') || key.includes('ep') ||
                        key.includes('ea') || key.includes('eo') || key.includes('L') ||
                        key.includes('$i') || key.includes('ed') || key.includes('ef')) {
                        const value = obj[key];
                        if (typeof value === 'function' || typeof value === 'object') {
                            searchInObject(value, key, depth + 1, maxDepth);
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
}

// Ищем в window
console.log('📦 Поиск в window...');
searchInObject(window, 'window');

// Ищем в webpack модулях
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
console.log('\n✅ НАЙДЕННЫЕ ФУНКЦИИ:\n');
for (let term in foundFunctions) {
    console.log(`%c${term}:`, 'font-weight: bold; color: #569cd6;');
    foundFunctions[term].forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name}:`);
        console.log(item.code);
        console.log('\n');
    });
}

if (Object.keys(foundFunctions).length === 0) {
    console.log('❌ Функции не найдены автоматически.');
    console.log('\n📋 РУЧНОЙ ПОИСК:');
    console.log('1. Откройте DevTools → Sources');
    console.log('2. Найдите файл app-2637cbcbd7da64c9.js');
    console.log('3. Используйте поиск (Ctrl+F) для:');
    console.log('   - function ei');
    console.log('   - new en()');
    console.log('   - function X');
    console.log('   - U.$i');
    console.log('   - function ep');
    console.log('   - function ea');
    console.log('   - function eo');
    console.log('   - const ed =');
    console.log('   - const ef =');
}

// Сохраняем результаты
window._foundXSignFunctions = foundFunctions;

