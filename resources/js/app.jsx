import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { setLocale } from './i18n';
import AlexHost from './Components/Alex/AlexCall';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        // A língua chega em cada página (props.locale) e fica definida antes de a página se desenhar
        root.render(
            <App {...props}>
                {({ Component, props: pageProps, key }) => {
                    setLocale(pageProps.locale);
                    const page = <Component {...pageProps} key={key} />;
                    // O Alex fica fora da página, para a conversa continuar quando o aluno muda de página
                    return (
                        <>
                            {Component.layout ? Component.layout(page) : page}
                            <AlexHost />
                        </>
                    );
                }}
            </App>,
        );
    },
    progress: {
        color: '#F8B101',
    },
});
