import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.jsx'],
            refresh: true,
        }),
        react(),
    ],
    // O Daily (vídeo do Alex) só carrega quando o aluno começa uma conversa; pré-preparado no servidor
    // de desenvolvimento para o Vite não o reotimizar a meio da sessão
    optimizeDeps: { include: ['@daily-co/daily-js'] },
});
