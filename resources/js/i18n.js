// Língua da plataforma. Os textos ficam escritos em português no código, e t() devolve
// a tradução de lang/en.json quando a pessoa escolheu inglês (as mesmas chaves que o __() do Laravel).
// Variáveis com :nome, como no Laravel: t('Faltam :n dias', { n: 3 }).
// O conteúdo dos cursos não passa por aqui: fica na língua em que o formador o escreveu.
import en from '../../lang/en.json';

let locale = 'pt';

export function setLocale(next) {
    locale = next === 'en' ? 'en' : 'pt';
    if (typeof document !== 'undefined') document.documentElement.lang = locale === 'en' ? 'en' : 'pt-PT';
}

export const getLocale = () => locale;

// Para formatar números e datas no browser (toLocaleString, Intl)
export const intlLocale = () => (locale === 'en' ? 'en-GB' : 'pt-PT');

export function t(text, vars) {
    let s = text;
    if (locale === 'en') {
        s = en[text];
        if (s === undefined) {
            s = text;
            if (import.meta.env.DEV) console.warn('[i18n] sem tradução:', text);
        }
    }
    return vars ? s.replace(/:(\w+)/g, (m, k) => (k in vars ? vars[k] : m)) : s;
}
