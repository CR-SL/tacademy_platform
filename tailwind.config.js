import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                // Identidade Visual v3 · 4b: Barlow (texto) + Chakra Petch (títulos, números, rótulos)
                sans: ['Barlow', ...defaultTheme.fontFamily.sans],
                display: ['"Chakra Petch"', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                // Tokens em resources/css/app.css (mudam com o tema claro/escuro)
                accent: 'var(--color-accent)',
                'accent-ink': 'var(--color-accent-ink)',
                'on-accent': 'var(--color-on-accent)',
                page: 'var(--color-bg)',
                surface: 'var(--color-surface)',
                surface2: 'var(--color-surface2)',
                ink: 'var(--color-ink)',
                muted: 'var(--color-muted)',
                line: 'var(--color-line)',
                track: 'var(--color-track)',
                live: 'var(--color-live)',
            },
        },
    },

    plugins: [forms],
};
