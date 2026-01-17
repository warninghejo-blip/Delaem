/**
 * Utility module for DOM helpers and common UI functions
 */

export function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notificationsContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    // Add type-specific styling
    if (type === 'error') notification.classList.add('notification-error');
    if (type === 'success') notification.classList.add('notification-success');
    if (type === 'warning') notification.classList.add('notification-warning');

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('notification-fade-out');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

export function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    const errorModal = document.getElementById('errorModal');

    if (errorMsg) errorMsg.innerText = message;
    if (errorModal) errorModal.classList.remove('hidden');
}

export function showSuccess(message, isMintEvent = false) {
    const modal = document.getElementById('successModal');
    const msgEl = document.getElementById('successTxId');

    if (msgEl) msgEl.innerText = message;
    if (modal) modal.classList.remove('hidden');
}

export function closeProgress() {
    const progressModal = document.getElementById('progressModal');
    if (progressModal) progressModal.classList.add('hidden');

    if (window.__progressInterval) {
        clearInterval(window.__progressInterval);
        window.__progressInterval = null;
    }
}

export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('fennec_theme', newTheme);

    showNotification(newTheme === 'dark' ? 'Dark Mode' : 'Light Mode');
}

export function toggleLanguage() {
    const currentLang = localStorage.getItem('fennec_lang') || 'en';
    const newLang = currentLang === 'en' ? 'ru' : 'en';

    localStorage.setItem('fennec_lang', newLang);
    showNotification(`Language: ${newLang.toUpperCase()}`);
}

export function toggleChat() {
    const chatWindow = document.getElementById('chatWindow');
    const chatTrigger = document.getElementById('chatTrigger');

    if (!chatWindow) return;

    if (chatWindow.classList.contains('hidden')) {
        chatWindow.classList.remove('hidden');
        setTimeout(() => {
            chatWindow.style.transform = 'scale(1)';
            chatWindow.style.opacity = '1';
        }, 10);
    } else {
        chatWindow.style.transform = 'scale(0.9)';
        chatWindow.style.opacity = '0';
        setTimeout(() => chatWindow.classList.add('hidden'), 300);
    }
}

// Make utilities globally available
export function installUtilsGlobals() {
    window.showNotification = showNotification;
    window.showError = showError;
    window.showSuccess = showSuccess;
    window.closeProgress = closeProgress;
    window.toggleTheme = toggleTheme;
    window.toggleLanguage = toggleLanguage;
    window.toggleChat = toggleChat;
}
