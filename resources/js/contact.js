// Página de contactos: empresa/particular, separadores e pesquisa das FAQs, menu em telemóvel.
// A página funciona sem JS (formulário normal + todas as FAQs visíveis); isto só melhora a experiência.
import './smooth-scroll';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Navbar: menu em telemóvel ---------- */
const menuBtn = $('[data-menu]');
const menu = $('#nav-links');
menuBtn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
});

/* ---------- Revelações ao entrar no ecrã ---------- */
const io = new IntersectionObserver(
    (entries) =>
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add('in');
                io.unobserve(e.target);
            }
        }),
    { threshold: 0.15 },
);
$$('.reveal').forEach((el) => io.observe(el));

/* ---------- FAQs: separadores + pesquisa ---------- */
const groups = $$('[data-group]');
const tabs = $$('[data-tab]');
const search = $('[data-search]');
const empty = $('[data-empty]');
let tab = $('[data-tab][aria-selected="true"]')?.dataset.tab ?? 'empresa';

// Guarda o texto original de cada pergunta para poder destacar e repor
const items = $$('[data-faq]').map((el) => ({
    el,
    group: el.closest('[data-group]').dataset.group,
    q: $('[data-q]', el),
    a: $('[data-a]', el),
    qText: $('[data-q]', el).textContent,
    aText: $('[data-a]', el).textContent,
}));

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Destaca o termo ignorando acentos (procura no texto normalizado, marca no original)
function highlight(text, q) {
    if (!q) return esc(text);
    const n = norm(text), nq = norm(q);
    let out = '', i = 0, at;
    while ((at = n.indexOf(nq, i)) !== -1) {
        out += esc(text.slice(i, at)) + '<mark>' + esc(text.slice(at, at + nq.length)) + '</mark>';
        i = at + nq.length;
    }
    return out + esc(text.slice(i));
}

function renderFaq() {
    const q = search.value.trim();
    const counts = { empresa: 0, particular: 0 };
    let firstShown = null;

    items.forEach((it) => {
        const match = !q || norm(it.qText + ' ' + it.aText).includes(norm(q));
        if (match) counts[it.group]++;
        const show = match && it.group === tab;
        it.el.hidden = !show;
        it.q.innerHTML = highlight(it.qText, q);
        it.a.innerHTML = highlight(it.aText, q);
        if (q && show && !firstShown) firstShown = it.el;
        if (!q) it.el.open = false;
    });
    if (firstShown) firstShown.open = true;

    groups.forEach((g) => (g.hidden = g.dataset.group !== tab));
    $$('[data-count]').forEach((n) => (n.textContent = counts[n.dataset.count]));

    const none = counts[tab] === 0;
    empty.hidden = !none;
    if (none) {
        const other = tab === 'empresa' ? 'Particulares' : 'Empresas';
        empty.textContent = `Sem resultados para «${q}» aqui. Experimenta o separador ${other} ou pede contacto.`;
    }
}

function selectTab(name) {
    tab = name;
    tabs.forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
    renderFaq();
}
tabs.forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
search.addEventListener('input', renderFaq);

/* ---------- Empresa / particular: adapta formulário e FAQs ---------- */
const whoButtons = $$('[data-who]');
const company = $('[data-company]');
const formSub = $('[data-form-sub]');
const radios = $$('input[name="type"]');

function setWho(who) {
    whoButtons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.who === who));
    radios.forEach((r) => (r.checked = r.value === who));
    if (company) company.hidden = who !== 'empresa';
    if (formSub) formSub.textContent = formSub.dataset[who];
    selectTab(who);
}
whoButtons.forEach((b) => b.addEventListener('click', () => setWho(b.dataset.who)));

// Mostra os controlos que só fazem sentido com JS
$$('[data-who-group], [data-tabs], [data-search-wrap]').forEach((el) => (el.hidden = false));
setWho($('[data-who][aria-pressed="true"]')?.dataset.who ?? 'empresa');

/* ---------- Formulário: leva o foco ao primeiro erro vindo do servidor ---------- */
$('.field.bad input, .field.bad textarea')?.focus();
