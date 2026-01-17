/**
 * Initialization module for window load events and setup
 */

import { showSection, setupSectionRouter } from './navigation.js';

export function initializeScrollTop() {
    if (!window.__fennecScrollTopFinalSetup) {
        window.__fennecScrollTopFinalSetup = true;
        try {
            window.addEventListener('beforeunload', () => {
                try {
                    window.scrollTo(0, 0);
                } catch (_) {}
            });
        } catch (_) {}
        try {
            window.addEventListener(
                'load',
                () => {
                    try {
                        window.scrollTo(0, 0);
                        setTimeout(() => window.scrollTo(0, 0), 10);
                        setTimeout(() => window.scrollTo(0, 0), 100);
                    } catch (_) {}
                },
                { once: true }
            );
        } catch (_) {}
    }
}

export function initializeApp() {
    // Setup section router
    setupSectionRouter();

    // Initialize scroll to top behavior
    initializeScrollTop();

    // Make showSection globally available for inline onclick handlers
    window.showSection = showSection;
}
