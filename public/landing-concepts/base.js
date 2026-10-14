// Protótipos da landing page — utilitários partilhados (sem dependências).
window.TA = (() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    // Progresso 0..1 de um intervalo dentro de outro (ex.: sub(p, .2, .5))
    const sub = (p, a, b) => clamp((p - a) / (b - a));
    // Progresso de uma secção "pinned": 0 quando o topo chega ao topo do ecrã, 1 quando o fim sai.
    const pinProgress = (el) => {
        const r = el.getBoundingClientRect();
        const total = el.offsetHeight - innerHeight;
        return total > 0 ? clamp(-r.top / total) : 0;
    };

    // Cursos reais da BD (exemplos). Na versão final vêm do controller.
    const courses = [
        { t: 'Diagnóstico de Sistemas OBD-II', cat: 'Diagnóstico', lvl: 'Intermédio', min: 50, price: '49,90 €', col: '#F8B101', ai: true, ic: 'OBD' },
        { t: 'Introdução à Eletrónica Automóvel', cat: 'Eletrónica', lvl: 'Iniciante', min: 39, price: '39,90 €', col: '#9aa7b8', ic: 'V' },
        { t: 'Redes CAN Bus no Automóvel', cat: 'Eletrónica', lvl: 'Avançado', min: 26, price: '59,90 €', col: '#9aa7b8', ic: 'CAN' },
        { t: 'Scanner e Osciloscópio na Prática', cat: 'Diagnóstico', lvl: 'Avançado', min: 26, price: '69,90 €', col: '#F8B101', ic: '∿' },
        { t: 'Gestão de Oficina Moderna', cat: 'Gestão', lvl: 'Iniciante', min: 26, price: '34,90 €', col: '#d98a4a', ic: '€' },
        { t: 'Atendimento e Fidelização de Clientes', cat: 'Gestão', lvl: 'Iniciante', min: 26, price: '24,90 €', col: '#d98a4a', ic: '★' },
    ];
    const hatch = (c) => `repeating-linear-gradient(135deg, color-mix(in oklch, ${c} 30%, #fff) 0 9px, color-mix(in oklch, ${c} 12%, #fff) 9px 18px)`;
    const courseCard = (c) => `
        <a class="course-card cut-12" href="/login">
            <div class="thumb cut-8" style="background:${hatch(c.col)}">
                ${c.ai ? '<span class="tag cut-8">AULA COM IA</span>' : ''}${c.ic}
            </div>
            <h4>${c.t}</h4>
            <div class="meta">${c.cat} · ${c.lvl} · ${c.min} min</div>
            <div class="price">${c.price}</div>
        </a>`;

    // Navbar sólida depois do hero + barra de progresso + secção ativa
    function chrome() {
        const nav = document.querySelector('.nav');
        const bar = document.querySelector('.progress');
        const links = [...document.querySelectorAll('.nav ul a')];
        const onScroll = () => {
            nav?.classList.toggle('solid', scrollY > 40);
            const max = document.documentElement.scrollHeight - innerHeight;
            if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
            let current = null;
            links.forEach((a) => {
                const s = document.querySelector(a.getAttribute('href'));
                if (s && s.getBoundingClientRect().top < innerHeight * 0.4) current = a;
            });
            links.forEach((a) => a.classList.toggle('on', a === current));
        };
        addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // .reveal → .in quando entra no ecrã
    function reveals() {
        const io = new IntersectionObserver((es) => es.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        }), { threshold: 0.15 });
        document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    }

    // Loop de animação ligado ao scroll (rAF, só transform/opacity)
    function onFrame(fn) {
        let raf = 0;
        const tick = () => { raf = 0; fn(); };
        const req = () => { if (!raf) raf = requestAnimationFrame(tick); };
        addEventListener('scroll', req, { passive: true });
        addEventListener('resize', req);
        req();
    }

    // Rato normalizado -1..1 com suavização (para parallax de profundidade)
    function mouse(fn) {
        if (reduced || matchMedia('(pointer: coarse)').matches) return;
        let tx = 0, ty = 0, x = 0, y = 0;
        addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; });
        const loop = () => { x += (tx - x) * 0.08; y += (ty - y) * 0.08; fn(x, y); requestAnimationFrame(loop); };
        loop();
    }

    function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

    return { reduced, clamp, ease, sub, pinProgress, courses, courseCard, chrome, reveals, onFrame, mouse, rng };
})();
