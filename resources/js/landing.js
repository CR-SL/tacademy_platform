// Landing page pública — conceito A "As Peças".
// Parallax e storytelling ligados ao scroll, sem dependências. Só anima transform/opacity.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
const sub = (p, a, b) => clamp((p - a) / (b - a)); // progresso de um intervalo dentro de p
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Progresso 0..1 de uma secção presa ao ecrã (position: sticky)
function pinProgress(el) {
    const total = el.offsetHeight - innerHeight;
    return total > 0 ? clamp(-el.getBoundingClientRect().top / total) : 0;
}

// RNG determinístico: as peças espalham-se sempre da mesma forma
function rng(a) {
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* ---------- Navbar, barra de progresso e secção ativa ---------- */
const nav = $('.nav');
const bar = $('.progress');
// Só as âncoras desta página (#...) marcam a secção ativa; "Contactos" é outra página
const navLinks = $$('.nav ul a');
const anchorLinks = navLinks.filter((a) => a.getAttribute('href').startsWith('#'));

function paintChrome() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    let current = null;
    anchorLinks.forEach((a) => {
        const s = $(a.getAttribute('href'));
        if (s && s.getBoundingClientRect().top < innerHeight * 0.4) current = a;
    });
    anchorLinks.forEach((a) => a.classList.toggle('on', a === current));
}

// Menu em telemóvel
const menuBtn = $('[data-menu]');
const menu = $('#nav-links');
menuBtn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
});
navLinks.forEach((a) => a.addEventListener('click', () => {
    menu.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
}));

/* ---------- Revelações e contadores ---------- */
const revealIO = new IntersectionObserver(
    (entries) =>
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add('in');
                revealIO.unobserve(e.target);
            }
        }),
    { threshold: 0.15 },
);
$$('.reveal').forEach((el) => revealIO.observe(el));

const countIO = new IntersectionObserver(
    (entries) =>
        entries.forEach((e) => {
            if (!e.isIntersecting) return;
            countIO.unobserve(e.target);
            const el = e.target;
            const to = +el.dataset.count;
            if (reduced || !to) return;
            const t0 = performance.now();
            const step = (t) => {
                const k = ease(clamp((t - t0) / 1400));
                el.textContent = Math.round(to * k).toLocaleString('pt-PT');
                if (k < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }),
    { threshold: 0.6 },
);
$$('[data-count]').forEach((el) => countIO.observe(el));

/* ---------- 1 · Hero: 31 fragmentos montam o pássaro ---------- */
const hero = $('.hero');
const H = Object.fromEntries($$('[data-hero]').map((el) => [el.dataset.hero, el]));
const R = rng(20260101);
const frags = reduced
    ? []
    : Array.from({ length: 31 }, (_, i) => {
          const img = new Image();
          img.src = `/images/logo3d/frag_${String(i).padStart(2, '0')}.png`;
          img.alt = '';
          img.decoding = 'async';
          H.logo.insertBefore(img, H.whole);
          return { img, dx: -(20 + R() * 60), dy: (R() - 0.5) * 90, rot: (R() - 0.5) * 120, s: 0.6 + R() * 0.8, start: (i / 31) * 0.42 };
      });

// Competências que são "absorvidas" pelo pássaro
const chips = reduced
    ? []
    : ['DIAGNÓSTICO', 'ELETRÓNICA', 'CAN BUS', 'OBD-II', 'GESTÃO', 'ATENDIMENTO'].map((label, i, all) => {
          const el = document.createElement('div');
          el.className = 'skill-chip cut-8';
          el.textContent = label;
          el.setAttribute('aria-hidden', 'true');
          const a = (i / all.length) * Math.PI * 2;
          el.dataset.x = Math.cos(a) * 38;
          el.dataset.y = Math.sin(a) * 30;
          $('.stage').appendChild(el);
          return el;
      });

/* Logo → navbar: caixa de cada peça em frações da imagem.
   hero = logo 3D vertical (2884×1600); nav = logo horizontal da marca (721×170). */
const BOX = {
    hero: { bird: [0.3953, 0.0969, 0.6064, 0.5169], name: [0.0967, 0.5906, 0.9033, 0.7931], phrase: [0.1709, 0.8431, 0.8287, 0.9031] },
    nav: { bird: [0, 0, 0.2108, 1], name: [0.2261, 0.2588, 1, 0.7118], phrase: [0.301, 0.8235, 0.9334, 0.9588] },
};
const navBg = $('[data-nav-bg]');
const navLogo = $('[data-nav-logo]');
const navIn = $$('.nav [data-in]');
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Transform (origem no canto do logo do hero) que leva a caixa da peça exatamente à caixa no logo da navbar.
// Escala separada em x e y para a peça cobrir o mesmo retângulo: na chegada a troca pelo logo nítido não se nota.
function dockTransform(L, src, T, dst) {
    const ax = L.left + src[0] * L.width, ay = L.top + src[1] * L.height;
    const sx = ((dst[2] - dst[0]) * T.width) / ((src[2] - src[0]) * L.width);
    const sy = ((dst[3] - dst[1]) * T.height) / ((src[3] - src[1]) * L.height);
    const tx = T.left + dst[0] * T.width, ty = T.top + dst[1] * T.height;
    return { sx, sy, dx: tx - L.left - sx * (ax - L.left), dy: ty - L.top - sy * (ay - L.top) };
}

function paintHero(p) {
    // Fases: 0–.6 montagem · .6–.65 logo completo · .65–.9 o logo sobe até ao lugar da navbar ·
    // .9–1 só depois de o logo chegar é que a navbar nasce à volta dele
    const pa = sub(p, 0, 0.6);
    const d = easeInOut(sub(p, 0.65, 0.9));
    const arrived = p >= 0.9;
    const n = sub(p, 0.9, 1);
    const arc = Math.sin(Math.PI * d); // o pássaro sobe num pequeno arco

    frags.forEach((f) => {
        const e = ease(sub(pa, f.start, f.start + 0.38));
        const k = 1 - e;
        f.img.style.transform = `translate(${f.dx * k}%, ${f.dy * k}%) rotate(${f.rot * k}deg) scale(${1 + (f.s - 1) * k})`;
        f.img.style.opacity = d > 0 ? 0 : e; // no voo só o pássaro inteiro se move
    });

    const L = H.logo.getBoundingClientRect();
    const T = navLogo.getBoundingClientRect();
    const pieces = { bird: H.whole, name: H.name, phrase: H.phrase };
    const enter = { bird: sub(pa, 0.74, 0.86), name: ease(sub(pa, 0.38, 0.78)), phrase: ease(sub(pa, 0.7, 0.92)) };
    const intro = { bird: '', name: `translateX(${(1 - enter.name) * 40}%) `, phrase: `translateY(${(1 - enter.phrase) * 30}%) ` };
    for (const key in pieces) {
        const el = pieces[key];
        const t = dockTransform(L, BOX.hero[key], T, BOX.nav[key]);
        const lift = key === 'bird' ? -60 * arc : 0;
        el.style.transformOrigin = '0 0';
        el.style.transform = `${d ? '' : intro[key]}translate(${t.dx * d}px, ${t.dy * d + lift}px) scale(${lerp(1, t.sx, d)}, ${lerp(1, t.sy, d)})`;
        // na chegada a peça dá lugar ao logo nítido da navbar no mesmo frame: nunca há dois logos
        el.style.opacity = arrived ? 0 : enter[key];
    }
    navLogo.style.opacity = arrived ? 1 : 0;

    // A navbar só nasce depois de o logo chegar: fundo primeiro, opções em cascata
    const bg = ease(sub(n, 0, 0.6));
    navBg.style.opacity = bg;
    navBg.style.transform = `translateY(${(1 - bg) * -100}%)`;
    navIn.forEach((el, i) => {
        const t = ease(sub(n, 0.25 + i * 0.12, 0.65 + i * 0.12));
        el.style.opacity = t;
        el.style.transform = `translateY(${(1 - t) * -14}px)`;
        el.style.pointerEvents = t > 0.5 ? 'auto' : 'none';
    });
    bar.style.opacity = sub(n, 0.6, 1);

    const a = sub(pa, 0, 0.3);
    H.copyA.style.opacity = 1 - a;
    H.copyA.style.transform = `translateY(${-a * 60}px)`;
    const b = ease(sub(pa, 0.82, 1));
    const out = sub(p, 0.63, 0.72);
    H.copyB.style.opacity = b * (1 - out);
    H.copyB.style.transform = `translateY(${(1 - b) * 40 - out * 40}px)`;
    H.hint.style.opacity = 1 - sub(p, 0, 0.05);

    // Fundo a velocidades diferentes; desaparece quando o logo sobe
    H.ghost.style.transform = `translate(calc(-50% + ${(0.5 - pa) * 30}vw), -50%)`;
    H.ghost.style.opacity = 1 - d;
    H.grid.style.transform = `translateY(${-p * 12}%)`;
    H.grid.style.opacity = 0.7 * (1 - d);

    chips.forEach((c, i) => {
        const t = sub(pa, 0.05 + i * 0.04, 0.55 + i * 0.03);
        const fly = ease(sub(t, 0.45, 1));
        c.style.left = `calc(50% + ${+c.dataset.x * (1 - fly)}vw)`;
        c.style.top = `calc(50% + ${+c.dataset.y * (1 - fly)}vh)`;
        c.style.transform = `translate(-50%, -50%) scale(${1 - fly * 0.6})`;
        c.style.opacity = Math.min(sub(t, 0, 0.2), 1 - fly);
    });
}

/* ---------- 2 · Quem somos: camadas com data-speed ---------- */
const speedEls = $$('[data-speed]');
function paintSpeeds() {
    // Em ecrãs estreitos as camadas ficam por baixo do texto: sem parallax para não o taparem
    const narrow = innerWidth <= 860;
    speedEls.forEach((el) => {
        if (narrow) { el.style.transform = ''; return; }
        const r = el.parentElement.getBoundingClientRect();
        el.style.transform = `translateY(${(r.top + r.height / 2 - innerHeight / 2) * +el.dataset.speed}px)`;
    });
}

/* ---------- 3 · Linha dos passos ---------- */
const steps = $('[data-steps]');
const stepLine = $('[data-step-line]');

/* ---------- 5 · CTA ---------- */
const birdBig = $('[data-bird-big]');

/* ---------- Ciclo único por frame ---------- */
function frame() {
    paintChrome();
    if (reduced) return;
    paintHero(pinProgress(hero));
    paintSpeeds();

    const sr = steps.getBoundingClientRect();
    stepLine.style.strokeDashoffset = 1 - clamp((innerHeight * 0.8 - sr.top) / (sr.height + innerHeight * 0.2));

    const k = birdBig.parentElement.getBoundingClientRect().top / innerHeight;
    birdBig.style.transform = `translate(${k * -80}px, ${k * 120}px) rotate(${k * -12}deg)`;
}

let raf = 0;
const request = () => {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; frame(); });
};
addEventListener('scroll', request, { passive: true });
addEventListener('resize', request);
addEventListener('load', request);
frame();

/* ---------- Login: o botão "Entrar" cresce e transforma-se numa caixa ---------- */
const loginBtn = $('[data-login-open]');
const loginPop = $('[data-login-pop]');
if (loginBtn && loginPop) {
    const inner = $('.login-pop-in', loginPop);
    const closeBtn = $('[data-login-close]', loginPop);
    const form = $('[data-login-form]', loginPop);
    const errEl = $('[data-login-err]', loginPop);
    const goBtn = $('.login-pop-go', loginPop);
    const emailIn = $('#lp-email', loginPop);
    let isOpen = false;
    let busy = false;

    const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tween = (dur, fn, easing = easeInOut) =>
        new Promise((done) => {
            if (reduced) { fn(1); return done(); }
            const t0 = performance.now();
            const step = (now) => {
                const t = Math.min(1, (now - t0) / dur);
                fn(easing(t));
                t < 1 ? requestAnimationFrame(step) : done();
            };
            requestAnimationFrame(step);
        });
    const cut = (n) => `polygon(${n}px 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%, 0 ${n}px)`;

    // A caixa nasce exatamente no sítio e tamanho do botão e cresce até ao tamanho final
    async function openLogin() {
        if (isOpen || busy) return;
        busy = true;
        isOpen = true;
        const b = loginBtn.getBoundingClientRect();
        loginPop.hidden = false;
        const W = Math.min(300, innerWidth - 24);
        const H = inner.scrollHeight;
        Object.assign(loginPop.style, { top: `${b.top}px`, right: `${innerWidth - b.right}px`, width: `${b.width}px`, height: `${b.height}px` });
        inner.style.opacity = 0;
        closeBtn.style.opacity = 0;
        loginBtn.style.visibility = 'hidden';
        loginBtn.setAttribute('aria-expanded', 'true');
        await tween(380, (k) => {
            loginPop.style.width = `${b.width + (W - b.width) * k}px`;
            loginPop.style.height = `${b.height + (H - b.height) * k}px`;
            loginPop.style.clipPath = cut(8 + 8 * k);
        });
        loginPop.style.height = 'auto';
        await tween(200, (k) => { inner.style.opacity = k; closeBtn.style.opacity = k; }, (t) => t);
        busy = false;
        emailIn.focus();
    }

    // Ao fechar, encolhe outra vez até ser o botão
    async function closeLogin() {
        if (!isOpen || busy) return;
        busy = true;
        const b = loginBtn.getBoundingClientRect();
        const W = loginPop.offsetWidth, H = loginPop.offsetHeight;
        inner.style.opacity = 0;
        closeBtn.style.opacity = 0;
        await tween(260, (k) => {
            loginPop.style.width = `${W + (b.width - W) * k}px`;
            loginPop.style.height = `${H + (b.height - H) * k}px`;
            loginPop.style.clipPath = cut(16 - 8 * k);
        });
        loginPop.hidden = true;
        loginBtn.style.visibility = '';
        loginBtn.setAttribute('aria-expanded', 'false');
        isOpen = false;
        busy = false;
        loginBtn.focus();
    }

    loginBtn.addEventListener('click', (e) => {
        e.preventDefault(); // com JS não vai para /login: abre a caixa
        isOpen ? closeLogin() : openLogin();
    });
    // Outros botões da página (ex.: "Entrar na plataforma" no fim) abrem a mesma caixa
    $$('[data-login-trigger]').forEach((el) => el.addEventListener('click', (e) => {
        e.preventDefault();
        openLogin();
    }));
    closeBtn.addEventListener('click', closeLogin);
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLogin(); });
    addEventListener('pointerdown', (e) => {
        if (isOpen && !loginPop.contains(e.target) && !loginBtn.contains(e.target)) closeLogin();
    });
    // Se a janela mudar de tamanho, a caixa acompanha o botão
    addEventListener('resize', () => {
        if (!isOpen) return;
        const b = loginBtn.getBoundingClientRect();
        loginPop.style.right = `${innerWidth - b.right}px`;
    });

    // Depois do logout a caixa abre sozinha (com a mensagem "Sessão terminada"); nos outros casos começa fechada
    if (loginPop.hasAttribute('data-open-on-load')) requestAnimationFrame(() => openLogin());

    // Envio sem sair da página; o servidor responde com erros (422) ou redireciona para a plataforma
    const showError = (msg) => {
        errEl.textContent = msg;
        emailIn.classList.add('bad');
        emailIn.setAttribute('aria-invalid', 'true');
        loginPop.classList.remove('shake');
        void loginPop.offsetWidth;
        loginPop.classList.add('shake');
    };
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errEl.textContent = '';
        emailIn.classList.remove('bad');
        emailIn.removeAttribute('aria-invalid');
        const label = goBtn.textContent;
        goBtn.disabled = true;
        goBtn.textContent = 'A verificar…';
        try {
            const res = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                },
            });
            if (res.status === 422) {
                const data = await res.json();
                showError(data.errors?.email?.[0] || data.errors?.password?.[0] || data.message);
            } else if (res.ok) {
                goBtn.textContent = 'A entrar… ✓';
                location.href = res.url; // página pedida antes do login ou o dashboard
                return;
            } else {
                form.submit(); // sessão expirada (419) ou outro erro: envio normal
                return;
            }
        } catch {
            form.submit();
            return;
        }
        goBtn.disabled = false;
        goBtn.textContent = label;
    });
}
