import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { setLocale } from './i18n';

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
                    return Component.layout ? Component.layout(page) : page;
                }}
            </App>,
        );
    },
    progress: {
        color: '#F8B101',
    },
});
