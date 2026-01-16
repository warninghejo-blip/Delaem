// ГЛОБАЛЬНЫЙ ШИМ STORAGE (предотвращает краш при заблокированных куках/sandbox)
(function () {
    function makeShim() {
        var mem = {};
        return {
            getItem: function (k) {
                return mem.hasOwnProperty(k) ? mem[k] : null;
            },
            setItem: function (k, v) {
                mem[k] = String(v);
            },
            removeItem: function (k) {
                delete mem[k];
            },
            clear: function () {
                mem = {};
            },
            key: function (i) {
                return Object.keys(mem)[i] || null;
            },
            get length() {
                return Object.keys(mem).length;
            }
        };
    }
    try {
        var test = window.localStorage;
        if (!test) throw 1;
        test.setItem('__test', '1');
        test.removeItem('__test');
    } catch (e) {
        try {
            Object.defineProperty(window, 'localStorage', { value: makeShim(), configurable: true });
        } catch (e2) {
            window.localStorage = makeShim();
        }
    }
    try {
        var test2 = window.sessionStorage;
        if (!test2) throw 1;
        test2.setItem('__test', '1');
        test2.removeItem('__test');
    } catch (e) {
        try {
            Object.defineProperty(window, 'sessionStorage', { value: makeShim(), configurable: true });
        } catch (e2) {
            window.sessionStorage = makeShim();
        }
    }
})();

// CRITICAL: Define global functions BEFORE they are used in HTML
window.showSection = window.showSection || function () {};
window.connectWallet = window.connectWallet || function () {};

// Wait for Tailwind to load before configuring
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        theme: {
            extend: {
                colors: { fennec: '#FF6B35', sand: '#E6CCB2', dark: '#0C0C0C' },
                fontFamily: { sans: ['Outfit', 'sans-serif'], display: ['Space Grotesk', 'sans-serif'] },
                animation: {
                    float: 'float 7s ease-in-out infinite',
                    ears: 'ears 4s ease-in-out infinite alternate'
                },
                keyframes: {
                    float: {
                        '0%, 100%': { transform: 'translateY(0)' },
                        '50%': { transform: 'translateY(-10px)' }
                    },
                    ears: { '0%': { transform: 'rotate(-3deg)' }, '100%': { transform: 'rotate(3deg)' } }
                }
            }
        }
    };
} else {
    // If Tailwind hasn't loaded yet, wait for it
    window.addEventListener('load', function () {
        if (typeof tailwind !== 'undefined') {
            tailwind.config = {
                theme: {
                    extend: {
                        colors: { fennec: '#FF6B35', sand: '#E6CCB2', dark: '#0C0C0C' },
                        fontFamily: {
                            sans: ['Outfit', 'sans-serif'],
                            display: ['Space Grotesk', 'sans-serif']
                        },
                        animation: {
                            float: 'float 7s ease-in-out infinite',
                            ears: 'ears 4s ease-in-out infinite alternate'
                        },
                        keyframes: {
                            float: {
                                '0%, 100%': { transform: 'translateY(0)' },
                                '50%': { transform: 'translateY(-10px)' }
                            },
                            ears: {
                                '0%': { transform: 'rotate(-3deg)' },
                                '100%': { transform: 'rotate(3deg)' }
                            }
                        }
                    }
                }
            };
        }
    });
}
