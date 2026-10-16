// Catálogo público de cursos (/cursos): separadores por área, pesquisa e aba lateral com o detalhe.
// Os cartões vêm no HTML; os dados do detalhe vêm de window.TA_COURSES (controller).

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COURSES = window.TA_COURSES || [];
const byId = Object.fromEntries(COURSES.map((c) => [String(c.id), c]));
const bySlug = Object.fromEntries(COURSES.map((c) => [c.slug, c]));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const euro = (v) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`);
const textOf = (c) => `${c.title} ${c.areaName} ${c.level} ${c.description}`;

let area = 'all';
let query = '';
let lastFocus = null;

/* ---------- Menu em telemóvel (navbar) ---------- */
const menuBtn = $('[data-menu]');
const menu = $('#nav-links');
menuBtn?.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
});

/* ---------- Grelha: filtro por área e pesquisa ---------- */
const cards = $$('[data-course]');
let io;
function revealVisible() {
    const shown = cards.filter((c) => !c.hidden);
    const cols = getComputedStyle($('[data-grid]')).gridTemplateColumns.split(' ').length;
    io?.disconnect();
    io = 'IntersectionObserver' in window
        ? new IntersectionObserver((es) => es.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
        }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
        : null;
    shown.forEach((el, k) => {
        el.style.transitionDelay = `${(k % cols) * 90}ms`; // cascata por coluna
        io ? io.observe(el) : el.classList.add('seen');
    });
}
function applyFilters() {
    let n = 0;
    cards.forEach((el) => {
        const c = byId[el.dataset.course];
        const ok = (area === 'all' || c.area === area) && (!query || norm(textOf(c)).includes(norm(query)));
        el.hidden = !ok;
        if (ok) n++;
    });
    $('[data-count]').textContent = `${n} ${n === 1 ? 'curso' : 'cursos'}`;
    $('[data-empty]').hidden = n > 0;
    $('[data-qline]').hidden = !query;
    $('[data-qtext]').textContent = `«${query}»`;
    $$('[data-area].cc-tab').forEach((b) => b.setAttribute('aria-pressed', b.dataset.area === area));
    revealVisible();
}

/* ---------- Pesquisa ---------- */
const sheet = $('[data-sheet]');
const searchScrim = $('[data-search-scrim]');
const qInput = $('[data-q]');
function renderResults() {
    const v = qInput.value.trim();
    const all = v ? COURSES.filter((c) => norm(textOf(c)).includes(norm(v))) : [];
    $('[data-sugg-box]').hidden = !!v;
    $('[data-res-box]').hidden = !v;
    $('[data-res-label]').textContent = `${all.length} ${all.length === 1 ? 'resultado' : 'resultados'}`;
    $('[data-results]').innerHTML = all.slice(0, 6).map((c) => `
        <button class="cc-res" type="button" data-pick="${c.id}">
            <img src="${esc(c.image)}" alt="">
            <span style="flex:1;min-width:0"><b>${esc(c.title)}</b><span class="cc-mono">${esc(c.areaName)} · ${esc(c.level)}</span></span>
            <span class="cc-p">${euro(c.price)}</span>
        </button>`).join('')
        + (all.length ? `<button class="cc-pill" type="button" data-see-all>Ver todos os ${all.length} resultados</button>`
            : '<span class="cc-nores">Nenhum curso encontrado. Experimente «diagnóstico», «bateria» ou «gestão».</span>');
}
function openSearch() {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    searchScrim.hidden = false;
    $('[data-open-search]').setAttribute('aria-expanded', 'true');
    qInput.value = query;
    renderResults();
    setTimeout(() => qInput.focus({ preventScroll: true }), 60);
}
function closeSearch() {
    sheet.hidden = true;
    searchScrim.hidden = true;
    $('[data-open-search]').setAttribute('aria-expanded', 'false');
    lastFocus?.focus?.({ preventScroll: true });
}
function applySearch() {
    query = qInput.value.trim();
    area = 'all';
    closeSearch();
    applyFilters();
    $('#cursos').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

/* ---------- Detalhe (aba lateral) ---------- */
const drawer = $('[data-drawer]');
const detailScrim = $('[data-detail-scrim]');
const enrol = window.TA_ENROL || { href: '/login', label: 'Inscrever-me' };

function openDetail(c, { push = true } = {}) {
    lastFocus = document.activeElement;
    const program = (c.modules || []).map((m, n) => `
        <div class="cc-mod">
            <h3><span>${String(n + 1).padStart(2, '0')}</span>${esc(m.title)}</h3>
            <ul>${(m.lessons || []).map((l) => `<li><span>${esc(l.title)}${l.ai ? '<span class="cc-ai">IA</span>' : ''}</span><em>${l.minutes} min</em></li>`).join('')}</ul>
        </div>`).join('');
    drawer.innerHTML = `
        <div class="cc-d-scroll">
            <div class="cc-d-hero">
                <img src="${esc(c.image)}" alt="">
                <button class="cc-x" type="button" data-close-detail aria-label="Fechar detalhes do curso"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
            </div>
            <div class="cc-d-body">
                <div class="cc-d-head">
                    <span class="cc-mono">${esc(c.areaName)} · ${esc(c.level)}</span>
                    <h2 id="cc-d-title">${esc(c.title)}</h2>
                    ${c.ai ? '<span class="cc-tag">✦ Aula com IA</span>' : ''}
                </div>
                <div class="cc-stats">
                    <span><small>DURAÇÃO</small><b>${dur(c.minutes)}</b></span>
                    <span><small>AULAS</small><b>${c.lessons}</b></span>
                    <span><small>MÓDULOS</small><b>${(c.modules || []).length}</b></span>
                    <span><small>FORMADOR</small><b>${esc(c.instructor || 'A definir')}</b></span>
                </div>
                ${c.description ? `<p class="cc-short">${esc(c.description)}</p>` : ''}
                <div class="cc-prog"><b>Programa</b><div class="cc-prog-box">${program || '<p style="margin:14px 0">Programa em preparação.</p>'}</div></div>
            </div>
        </div>
        <div class="cc-d-foot">
            <span><small>PREÇO</small><b>${euro(c.price)}</b></span>
            <a class="cc-cta" href="${esc(enrol.href)}">${esc(enrol.label)}<span aria-hidden="true">→</span></a>
        </div>`;
    drawer.hidden = false;
    detailScrim.hidden = false;
    document.body.style.overflow = 'hidden';
    // Link partilhável para o curso aberto
    if (push) history.replaceState(null, '', `?curso=${encodeURIComponent(c.slug)}`);
    setTimeout(() => $('[data-close-detail]', drawer)?.focus({ preventScroll: true }), 60);
}
function closeDetail() {
    if (drawer.hidden) return;
    drawer.hidden = true;
    detailScrim.hidden = true;
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname);
    lastFocus?.focus?.({ preventScroll: true });
}

/* ---------- Eventos ---------- */
document.addEventListener('click', (e) => {
    const t = e.target;
    const tab = t.closest('.cc-tab[data-area]');
    if (tab) { area = tab.dataset.area; applyFilters(); return; }
    const card = t.closest('[data-course]');
    if (card) { e.preventDefault(); openDetail(byId[card.dataset.course]); return; } // sem JS o link abre ?curso=
    const pick = t.closest('[data-pick]');
    if (pick) { closeSearch(); openDetail(byId[pick.dataset.pick]); return; }
    const sugg = t.closest('[data-sugg]');
    if (sugg) { qInput.value = sugg.dataset.sugg; renderResults(); qInput.focus(); return; }
    if (t.closest('[data-see-all]')) return applySearch();
    if (t.closest('[data-close-detail]') || t === detailScrim) return closeDetail();
    if (t.closest('[data-open-search]')) return openSearch();
    if (t.closest('[data-close-search]') || t === searchScrim) return closeSearch();
    if (t.closest('[data-clear-q]')) { query = ''; applyFilters(); }
});
qInput.addEventListener('input', renderResults);
qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applySearch(); });
addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!drawer.hidden) closeDetail();
    else if (!sheet.hidden) closeSearch();
});
let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(revealVisible, 150); });

// Área pré-selecionada (/cursos?area=slug, ex.: vindo das fotografias da landing)
const params = new URLSearchParams(location.search);
if (COURSES.some((c) => c.area === params.get('area'))) area = params.get('area');
applyFilters();

// Link direto para um curso (/cursos?curso=slug)
const fromUrl = params.get('curso');
if (fromUrl && bySlug[fromUrl]) openDetail(bySlug[fromUrl], { push: false });
