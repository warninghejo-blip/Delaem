import type { Config } from 'tailwindcss';

export default {
    content: ['./index.html', './recursive_inscriptions/**/*.{js,ts}', './preview/**/*.{html,js,css}'],
    corePlugins: {
        preflight: false
    },
    theme: {
        extend: {
            colors: {
                fennec: {
                    orange: '#FF6B35',
                    amber: '#FFB347',
                    brown: '#3E2723',
                    dark: '#0C0C0C',
                    cyan: '#00E5FF',
                    purple: '#9D4EDD'
                },
                muted: {
                    DEFAULT: '#1F1F1F',
                    foreground: '#A1A1A1'
                }
            },
            fontFamily: {
                orbitron: ['Orbitron', 'monospace'],
                rajdhani: ['Rajdhani', 'sans-serif']
            },
            keyframes: {
                'card-float': {
                    '0%, 100%': { transform: 'translateY(0) rotateX(2deg)' },
                    '50%': { transform: 'translateY(-15px) rotateX(5deg)' }
                },
                'text-flicker': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.85' }
                },
                'scan-line': {
                    '0%': { top: '-100%' },
                    '100%': { top: '200%' }
                },
                'pulse-glow': {
                    '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
                    '50%': { opacity: '0.8', filter: 'brightness(1.3)' }
                },
                'particle-float': {
                    '0%': { transform: 'translateY(100vh) scale(0)', opacity: '0' },
                    '10%': { opacity: '1' },
                    '90%': { opacity: '1' },
                    '100%': { transform: 'translateY(-10vh) scale(1)', opacity: '0' }
                }
            },
            animation: {
                'card-float': 'card-float 6s ease-in-out infinite',
                'text-flicker': 'text-flicker 3s ease-in-out infinite',
                'scan-line': 'scan-line 2.5s ease-in-out infinite',
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'particle-float': 'particle-float 8s ease-out infinite'
            }
        }
    },
    plugins: []
} satisfies Config;
