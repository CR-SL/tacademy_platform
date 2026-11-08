import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

const KEY = 'ta-theme';
const PREFS = ['light', 'dark', 'system'];
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

/*
 | Tema da plataforma. A preferência pode ser claro, escuro ou automático (segue o sistema).
 | Com sessão, fica na conta (Definições → Aparência) e vem no data-theme-pref do <html> (app.blade.php);
 | sem sessão, fica neste browser. O tema aplicado vive no data-theme do <html>.
 | Um só estado para toda a página: o botão da navegação e as Definições mudam juntos.
 */
function readPref() {
    if (typeof document === 'undefined') return 'light';
    const fromAccount = document.documentElement.getAttribute('data-theme-pref');
    if (PREFS.includes(fromAccount)) return fromAccount;
    try {
        const local = localStorage.getItem(KEY);
        if (PREFS.includes(local)) return local;
    } catch (e) {
        // sem storage (modo privado)
    }
    return 'light';
}

const resolve = (pref) => (pref === 'system' ? (media?.matches ? 'dark' : 'light') : pref);

let pref = readPref();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function apply() {
    document.documentElement.setAttribute('data-theme', resolve(pref));
    document.documentElement.setAttribute('data-theme-pref', pref);
}

// Em automático, acompanha a mudança do sistema (por exemplo, o modo noturno do telemóvel)
media?.addEventListener?.('change', () => {
    if (pref !== 'system') return;
    apply();
    emit();
});

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export default function useTheme() {
    const current = useSyncExternalStore(subscribe, () => pref, () => 'light');
    // Força a releitura quando o sistema muda (o "pref" não muda, mas o tema aplicado sim)
    const theme = useSyncExternalStore(subscribe, () => resolve(pref), () => 'light');

    // Com sessão, a escolha guardada na conta manda (por exemplo, logo depois de entrar noutro aparelho)
    const user = usePage().props.auth?.user;
    const accountPref = user?.theme;
    useEffect(() => {
        if (PREFS.includes(accountPref) && accountPref !== pref) {
            pref = accountPref;
            try { localStorage.setItem(KEY, pref); } catch (e) { /* sem storage */ }
            emit();
        }
        apply();
    }, [accountPref]);

    const signedIn = Boolean(user);
    const setPref = useCallback((next) => {
        if (!PREFS.includes(next)) return;
        pref = next;
        apply();
        emit();
        try {
            localStorage.setItem(KEY, next);
        } catch (e) {
            // sem storage: vale só para esta sessão
        }
        // Com sessão, guarda na conta (sem recarregar a página)
        if (signedIn) {
            window.axios?.put('/definicoes/tema', { theme: next }).catch(() => {});
        }
    }, [signedIn]);

    const toggle = useCallback(() => setPref(resolve(pref) === 'dark' ? 'light' : 'dark'), [setPref]);

    return { theme, pref: current, setPref, toggle };
}
