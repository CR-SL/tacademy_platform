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
                sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                // Paleta T.Academy Platform (ver claude.md secção 8)
                pearl: 'var(--color-pearl)',
                mist: 'var(--color-mist)',
                steel: 'var(--color-steel)',
                tblue: 'var(--color-tblue)',
                cyan: 'var(--color-cyan)',
                ink: 'var(--color-ink)',
                'brand-yellow': 'var(--color-brand-yellow)',
            },
            borderRadius: {
                card: 'var(--radius-card)',
            },
            boxShadow: {
                card: 'var(--shadow-card)',
            },
            backgroundImage: {
                'gradient-brand': 'var(--gradient-brand)',
            },
        },
    },

    plugins: [forms],
};
