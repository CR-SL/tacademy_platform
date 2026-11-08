import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

// Permite modificadores de opacidade (bg-accent/15) em cores definidas por variável CSS
const token = (name) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

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
                // Archivo em toda a plataforma (aparência decidida a 2026-11-04); a landing tem letra própria
                sans: ['Archivo', ...defaultTheme.fontFamily.sans],
                display: ['Archivo', ...defaultTheme.fontFamily.sans],
                mono: ['Archivo', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                // Tokens em resources/css/app.css (mudam com o tema claro/escuro)
                accent: token('--color-accent'),
                'accent-ink': token('--color-accent-ink'),
                'on-accent': token('--color-on-accent'),
                page: token('--color-bg'),
                surface: token('--color-surface'),
                surface2: token('--color-surface2'),
                ink: token('--color-ink'),
                'on-ink': token('--color-on-ink'), // texto sobre bg-ink (amarelo no claro, escuro no escuro)
                carbon: token('--color-carbon'), // sempre escuro: vídeo e destaques com texto branco
                muted: token('--color-muted'),
                line: token('--color-line'),
                track: token('--color-track'),
                live: token('--color-live'),
                'live-ink': token('--color-live-ink'),
                success: token('--color-success'),
                'success-ink': token('--color-success-ink'),
                info: token('--color-info'),
                'info-ink': token('--color-info-ink'),
                pill: token('--color-pill'),
                field: token('--color-field'),
                text: token('--color-text'),
            },
        },
    },

    plugins: [forms],
};
