#!/usr/bin/env node
/**
 * QA Bridge - Автоматическое тестирование с Gemini AI
 * Запуск: node qa-bridge.js или npm run qa:cycle
 */

const puppeteer = require('puppeteer');

const CONFIG = {
    targetUrl: 'https://main.fennec-swap.pages.dev',
    workerUrl: 'https://fennec-api.warninghejo.workers.dev',
    timeout: 30000,
    maxRetries: 5
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runQACycle() {
    console.log('\n🤖 === FENNEC QA CYCLE START ===\n');

    let browser = null;
    let retryCount = 0;

    while (retryCount < CONFIG.maxRetries) {
        try {
            // Запуск браузера
            console.log(`🌐 Запуск браузера (попытка ${retryCount + 1}/${CONFIG.maxRetries})...`);
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();

            // Сбор ошибок консоли
            const consoleLogs = [];
            const networkErrors = [];

            page.on('console', msg => {
                const type = msg.type();
                const text = msg.text();
                consoleLogs.push({ type, text, timestamp: Date.now() });

                if (type === 'error') {
                    console.log(`❌ Console Error: ${text}`);
                }
            });

            page.on('pageerror', error => {
                consoleLogs.push({
                    type: 'error',
                    text: error.toString(),
                    stack: error.stack,
                    timestamp: Date.now()
                });
                console.log(`❌ Page Error: ${error.toString()}`);
            });

            page.on('requestfailed', request => {
                networkErrors.push({
                    url: request.url(),
                    failure: request.failure()
                });
                console.log(`⚠️ Network Error: ${request.url()}`);
            });

            // Загрузка страницы
            console.log(`📄 Загрузка ${CONFIG.targetUrl}...`);
            await page.goto(CONFIG.targetUrl, {
                waitUntil: 'networkidle2',
                timeout: CONFIG.timeout
            });

            // Ждем инициализации
            await sleep(3000);

            // Сбор состояния страницы
            const pageState = await page.evaluate(() => {
                const state = {
                    url: window.location.href,
                    userAddress: window.userAddress || null,
                    modalOpen: !!document.querySelector('[id*="modal"]')?.offsetParent,
                    visibleTabs: Array.from(document.querySelectorAll('[role="tablist"] button')).map(b =>
                        b.textContent.trim()
                    ),
                    balances: {
                        fb: document.querySelector('[data-balance-fb]')?.textContent || 'N/A',
                        cats: document.querySelector('[data-balance-cats]')?.textContent || 'N/A'
                    },
                    fennecIdStatus: !!document.getElementById('fennecIdIframe'),
                    aiProbe: window.aiProbe || null
                };
                return state;
            });

            console.log('\n📊 Состояние страницы:', JSON.stringify(pageState, null, 2));

            // Прокликиваем основные элементы (если доступны)
            try {
                const tabs = ['Swap', 'Deposit', 'Audit'];
                for (const tab of tabs) {
                    try {
                        const clicked = await page.evaluate(label => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const match = buttons.find(btn => btn.textContent && btn.textContent.includes(label));
                            if (!match) return false;
                            match.click();
                            return true;
                        }, tab);
                        if (clicked) {
                            await sleep(1000);
                            console.log(`✅ Кликнул вкладку: ${tab}`);
                        } else {
                            console.log(`⚠️ Вкладка ${tab} не найдена`);
                        }
                    } catch (e) {
                        console.log(`⚠️ Не удалось кликнуть ${tab}: ${e.message}`);
                    }
                }
            } catch (e) {
                console.log(`⚠️ Ошибка при прокликивании: ${e.message}`);
            }

            // Отправка данных на QA Agent (Gemini)
            console.log('\n🧠 Отправка данных на Gemini QA Agent...');

            const qaPayload = {
                page_state: pageState,
                console_logs: consoleLogs,
                network_errors: networkErrors,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(`${CONFIG.workerUrl}?action=qa_agent_check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(qaPayload)
            });

            const result = await response.json();

            console.log('\n🤖 === GEMINI QA REPORT ===');
            console.log(`Статус: ${result.status || 'UNKNOWN'}`);

            if (result.status === 'PASS') {
                console.log('✅ ВСЕ СИСТЕМЫ РАБОТАЮТ НОРМАЛЬНО');
                console.log(result.message || '');
                await browser.close();
                process.exit(0);
            } else if (result.status === 'FAIL') {
                console.log('❌ ОБНАРУЖЕНЫ ОШИБКИ');
                console.log('\n📝 Инструкции для Windsurf:');
                console.log(result.windsurf_instruction || 'Нет инструкций');
                console.log('\n⚠️ Требуется исправление. Повторная проверка после исправления...');
                retryCount++;
                await browser.close();

                if (retryCount >= CONFIG.maxRetries) {
                    console.log('\n❌ Достигнут лимит попыток. Остановка.');
                    process.exit(1);
                }

                // Ждем перед следующей попыткой
                console.log('\n⏳ Ожидание 5 секунд перед следующей попыткой...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.log('⚠️ Неизвестный статус от AI');
                console.log(JSON.stringify(result, null, 2));
                await browser.close();
                process.exit(1);
            }
        } catch (error) {
            console.error(`\n❌ Критическая ошибка QA цикла: ${error.message}`);
            console.error(error.stack);

            if (browser) {
                await browser.close();
            }

            retryCount++;

            if (retryCount >= CONFIG.maxRetries) {
                console.log('\n❌ Не удалось выполнить QA цикл после всех попыток.');
                process.exit(1);
            }

            console.log('\n⏳ Повтор через 5 секунд...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Запуск
runQACycle().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
