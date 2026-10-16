import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.jsx', 'resources/css/landing.css', 'resources/js/landing.js', 'resources/js/contact.js', 'resources/css/courses.css', 'resources/js/courses.js'],
            refresh: true,
        }),
        react(),
    ],
});
