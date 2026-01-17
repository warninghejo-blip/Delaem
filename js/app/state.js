/**
 * Centralized reactive state for the Fennec app
 * Replaces global window variables with a proper state module
 */

// Core reactive state object
const state = {
    // Swap UI state
    isBuying: true,
    currentSwapPair: 'FB_FENNEC',
    userAddress: null

    // Additional state can be added here as we migrate
};

// Subscribers map for reactive updates
const subscribers = new Map();

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch
 * @param {Function} callback - Callback function
 */
export function subscribe(key, callback) {
    if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
    }
    subscribers.get(key).add(callback);

    // Return unsubscribe function
    return () => {
        const keySubs = subscribers.get(key);
        if (keySubs) {
            keySubs.delete(callback);
            if (keySubs.size === 0) {
                subscribers.delete(key);
            }
        }
    };
}

/**
 * Get state value
 * @param {string} key - State key
 * @returns {*} State value
 */
export function getState(key) {
    return state[key];
}

/**
 * Set state value and notify subscribers
 * @param {string} key - State key
 * @param {*} value - New value
 */
export function setState(key, value) {
    const oldValue = state[key];
    state[key] = value;

    // Notify subscribers if value changed
    if (oldValue !== value) {
        const keySubs = subscribers.get(key);
        if (keySubs) {
            keySubs.forEach(callback => {
                try {
                    callback(value, oldValue, key);
                } catch (error) {
                    console.error(`Error in state subscriber for ${key}:`, error);
                }
            });
        }
    }
}

/**
 * Get entire state object (for debugging/migration)
 * @returns {Object} Full state
 */
export function getAllState() {
    return { ...state };
}

/**
 * Initialize state from window globals (migration helper)
 * Call this during app initialization
 */
export function initializeFromGlobals() {
    if (typeof window !== 'undefined') {
        // Migrate from window globals
        if (window.isBuying !== undefined) setState('isBuying', window.isBuying);
        if (window.currentSwapPair !== undefined) setState('currentSwapPair', window.currentSwapPair);
        if (window.userAddress !== undefined) setState('userAddress', window.userAddress);
    }
}

// Export the state object directly for convenience (read-only access)
export default state;
