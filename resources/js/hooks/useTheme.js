import { useCallback, useEffect, useState } from 'react';

const KEY = 'ta-theme';

function current() {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// Tema claro/escuro: o valor vive no data-theme do <html> (aplicado em app.blade.php)
// e a preferência fica guardada em localStorage.
export default function useTheme() {
    const [theme, setTheme] = useState(current);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(KEY, theme);
        } catch (e) {
            // sem storage (modo privado): o tema vale só para esta sessão
        }
    }, [theme]);

    const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

    return { theme, toggle };
}
