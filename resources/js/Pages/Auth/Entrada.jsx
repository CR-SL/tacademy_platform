import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Field } from '@/Components/ui';

import { t } from '@/i18n';
import LanguageToggle from '@/Components/LanguageToggle';

// Entrada da plataforma (exemplo C, escolhido a 2026-11-08): em cada visita, as peças do pássaro
// juntam-se, o pássaro fica inteiro e voa até ao lugar dele no logótipo, centrado por cima de
// Entrar e Criar conta; ao pousar, aparecem o nome e a frase.

const FRAGS = 31;
const LOGO = '/images/brand/logo-tacademy.png';
// Onde está o pássaro dentro de bird_whole.png (frações da imagem), para pousar em cima do do logótipo
const BIRD_IN_FRAME = { x: 0.395, y: 0.096, w: 0.213 };
const FRAME_RATIO = 1600 / 2884;
const IMG = '/images/logo3d';
const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
const EASE_FLY = 'cubic-bezier(.65, 0, .35, 1)';

const COPY = {
    entrar: { title: 'Bem-vindo de volta', sub: 'Entra para continuar a aula onde ficaste.', url: '/login', head: 'Entrar' },
    criar: { title: 'Criar conta', sub: 'Cria a tua conta para comprar cursos e acompanhar o teu progresso.', url: '/register', head: 'Criar conta' },
};

// A intro passa sempre que se chega à entrada (pedido do utilizador); não volta depois de um erro
// de login ou de uma mensagem como "Sessão terminada".
function shouldPlayIntro(hasMessages) {
    return typeof window !== 'undefined' && !hasMessages;
}

// Gerador fixo: as peças partem sempre dos mesmos sítios
function scatter() {
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: FRAGS }, () => ({ dx: (r() - 0.5) * 140, dy: (r() - 0.5) * 120, rot: (r() - 0.5) * 160 }));
}

/**
 * Intro: montar (peças) → ficar inteiro (as juntas desaparecem) → voar até ao logótipo.
 * `target` é a zona do pássaro no logótipo; `onDone` mostra o logótipo e revela o nome e a frase.
 */
function Intro({ target, onLeave, onDone }) {
    const rootRef = useRef(null);
    const markRef = useRef(null);
    const wholeRef = useRef(null);
    const fillRef = useRef(null);
    const doneRef = useRef(false);
    const pieces = useRef(scatter()).current;

    const leave = () => {
        if (doneRef.current) return;
        doneRef.current = true;
        const mark = markRef.current;
        const to = target.current?.getBoundingClientRect();
        const from = mark.getBoundingClientRect();
        mark.querySelectorAll('img').forEach((im) => im.getAnimations().forEach((a) => a.finish()));

        // O nome e a linha saem; fica só o pássaro inteiro
        mark.querySelectorAll('[data-name]').forEach((im) => im.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }));
        fillRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });

        onLeave();
        if (!to) { onDone(); return; }

        // Voo em arco até ao pássaro do logótipo: o quadro do voo é escolhido para que o pássaro
        // de bird_whole.png fique exatamente por cima do pássaro do logótipo
        const W = to.width / BIRD_IN_FRAME.w;
        const land = { left: to.left - W * BIRD_IN_FRAME.x, top: to.top - W * FRAME_RATIO * BIRD_IN_FRAME.y, width: W };
        const flyer = document.createElement('div');
        flyer.className = 'en-flyer';
        flyer.innerHTML = `<img src="${IMG}/bird_whole.png" alt="">`;
        Object.assign(flyer.style, { left: `${land.left}px`, top: `${land.top}px`, width: `${land.width}px` });
        document.body.appendChild(flyer);
        wholeRef.current.style.visibility = 'hidden';
        mark.querySelectorAll('[data-frag]').forEach((im) => { im.style.visibility = 'hidden'; });

        const s = from.width / land.width;
        const dx = from.left - land.left;
        const dy = from.top - land.top;
        const lift = Math.min(120, Math.abs(dy) * 0.35);
        const fly = flyer.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`, offset: 0 },
            { transform: `translate(${dx * 0.55}px, ${dy * 0.45 - lift}px) scale(${s * 0.55 + 0.45}) rotate(-9deg)`, offset: 0.45 },
            { transform: 'translate(0, -6px) scale(1.06) rotate(4deg)', offset: 0.86 },
            { transform: 'none', offset: 1 },
        ], { duration: 1150, easing: EASE_FLY, fill: 'both' });
        rootRef.current.classList.add('en-intro-out');
        let landed = false;
        const land2 = () => {
            if (landed) return;
            landed = true;
            onDone(); // o logótipo aparece por baixo e o pássaro do voo desvanece por cima dele
            flyer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
            setTimeout(() => flyer.remove(), 260);
        };
        fly.finished.then(land2);
        setTimeout(land2, 1150 + 600); // se o browser atrasar a animação, o logótipo aparece na mesma

    };

    useEffect(() => {
        const mark = markRef.current;
        const frags = [...mark.querySelectorAll('[data-frag]')];
        const anims = [];
        // 1 · As peças juntam-se
        frags.forEach((im, i) => {
            const p = pieces[i];
            anims.push(im.animate([
                { transform: `translate(${p.dx}%, ${p.dy}%) rotate(${p.rot}deg) scale(.6)`, opacity: 0 },
                { transform: 'none', opacity: 1 },
            ], { duration: 1050, delay: 100 + i * 24, easing: EASE_OUT, fill: 'both' }));
        });
        // 2 · Fica inteiro: as juntas das peças desaparecem e o pássaro respira
        anims.push(wholeRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 1500, easing: 'ease-out', fill: 'both' }));
        frags.forEach((im) => anims.push(im.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: 1560, fill: 'forwards', composite: 'replace' })));
        anims.push(mark.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 650, delay: 1480, easing: EASE_OUT }));
        mark.querySelectorAll('[data-name]').forEach((im, k) => anims.push(im.animate([
            { transform: 'translateY(6%)', opacity: 0 }, { transform: 'none', opacity: 1 },
        ], { duration: 800, delay: 1250 + k * 160, easing: EASE_OUT, fill: 'both' })));
        // A linha amarela enche enquanto tudo acontece
        anims.push(fillRef.current.firstChild.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 2200, delay: 200, easing: EASE_FLY, fill: 'both' }));

        const tx = setTimeout(leave, 2650);
        const key = (e) => { if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); leave(); } };
        window.addEventListener('keydown', key);
        return () => {
            clearTimeout(tx);
            window.removeEventListener('keydown', key);
            anims.forEach((a) => a.cancel());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div ref={rootRef} className="en-intro" aria-hidden="true">
            <div ref={markRef} className="en-mark">
                {pieces.map((_, i) => <img key={i} data-frag src={`${IMG}/frag_${String(i).padStart(2, '0')}.png`} alt="" />)}
                <img ref={wholeRef} src={`${IMG}/bird_whole.png`} alt="" style={{ opacity: 0 }} />
                <img data-name src={`${IMG}/name.png`} alt="" />
                <img data-name className="en-phrase" src={`${IMG}/phrase.png`} alt="" />
            </div>
            <div ref={fillRef} className="en-fill"><i /></div>
            <button type="button" className="en-skip" onClick={leave} tabIndex={-1}>{t('Saltar')}</button>
        </div>
    );
}

function LoginForm({ canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({ email: '', password: '', remember: true });
    const [show, setShow] = useState(false);
    const submit = (e) => {
        e.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };
    return (
        <form onSubmit={submit} className="en-form" noValidate>
            <Field id="email" label={t('Email')} error={errors.email}>
                <input id="email" type="email" className="ui-input" autoComplete="email" placeholder="nome@oficina.pt" value={data.email} onChange={(e) => setData('email', e.target.value)} />
            </Field>
            <div className="en-pw-row">
                <label htmlFor="password" className="ui-label">{t('Palavra-passe')}</label>
                {canResetPassword && <a href={route('password.request')} className="en-link">{t('Esqueceste-te?')}</a>}
            </div>
            <Field id="password" error={errors.password} className="en-pw-field">
                <div className="en-pw">
                    <input id="password" type={show ? 'text' : 'password'} className="ui-input" autoComplete="current-password" value={data.password} onChange={(e) => setData('password', e.target.value)} aria-invalid={errors.password ? true : undefined} aria-describedby={errors.password ? 'password-err' : undefined} />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls="password">{show ? t('Esconder') : t('Mostrar')}</button>
                </div>
            </Field>
            <label className="en-check">
                <input type="checkbox" className="ui-check" checked={data.remember} onChange={(e) => setData('remember', e.target.checked)} />
                {t('Manter a sessão iniciada neste dispositivo')}
            </label>
            <Button type="submit" variant="accent" size="lg" block disabled={processing}>{processing ? t('A entrar…') : t('Entrar')}</Button>
        </form>
    );
}

function RegisterForm() {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '', email: '', password: '' });
    const [show, setShow] = useState(false);
    const submit = (e) => {
        e.preventDefault();
        post(route('register'), { onFinish: () => reset('password') });
    };
    return (
        <form onSubmit={submit} className="en-form" noValidate>
            <Field id="name" label={t('Nome')} error={errors.name}>
                <input id="name" className="ui-input" autoComplete="name" placeholder={t('Nome e apelido')} value={data.name} onChange={(e) => setData('name', e.target.value)} />
            </Field>
            <Field id="email" label={t('Email')} error={errors.email}>
                <input id="email" type="email" className="ui-input" autoComplete="email" placeholder="nome@oficina.pt" value={data.email} onChange={(e) => setData('email', e.target.value)} />
            </Field>
            <Field id="password" label="Palavra-passe" hint={t('Pelo menos 8 carateres.')} error={errors.password}>
                <div className="en-pw">
                    <input id="password" type={show ? 'text' : 'password'} className="ui-input" autoComplete="new-password" value={data.password} onChange={(e) => setData('password', e.target.value)} aria-invalid={errors.password ? true : undefined} aria-describedby={errors.password ? 'password-err' : 'password-hint'} />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls="password">{show ? t('Esconder') : t('Mostrar')}</button>
                </div>
            </Field>
            <Button type="submit" variant="accent" size="lg" block disabled={processing}>{processing ? t('A criar a conta…') : t('Criar conta')}</Button>
        </form>
    );
}

export default function Entrada({ mode: startMode = 'entrar', status, canResetPassword = true }) {
    const { errors } = usePage().props;
    const [mode, setMode] = useState(startMode === 'criar' ? 'criar' : 'entrar');
    const [intro] = useState(() => shouldPlayIntro(Boolean(status) || Object.keys(errors ?? {}).length > 0));
    const [phase, setPhase] = useState(intro ? 'intro' : 'ready'); // intro → landing → ready
    const birdRef = useRef(null);
    const tabsRef = useRef(null);
    const [reveal, setReveal] = useState(false); // nome e frase a aparecer depois de o pássaro pousar
    const c = { ...COPY[mode], title: t(COPY[mode].title), sub: t(COPY[mode].sub), head: t(COPY[mode].head) };

    // O separador ativo fica no endereço (/login ou /register), sem recarregar
    const pick = (m, focus) => {
        setMode(m);
        try { window.history.replaceState(window.history.state, '', COPY[m].url); } catch { /* */ }
        if (focus) tabsRef.current?.querySelector(`[data-tab="${m}"]`)?.focus();
    };

    useLayoutEffect(() => {
        if (phase === 'ready') document.getElementById('email')?.focus({ preventScroll: true });
    }, [phase]);

    return (
        // A entrada fica sempre em claro, da intro ao formulário (decisão de 2026-11-08)
        <div data-theme="light" className={`en-page ${phase !== 'ready' ? 'en-pre' : ''} ${phase === 'landing' ? 'en-landing' : ''}`}>
            <Head title={c.head} />
            {phase !== 'ready' && <Intro target={birdRef} onLeave={() => setPhase('landing')} onDone={() => { setReveal(true); setPhase('ready'); }} />}

            <div className="en-top"><span /><LanguageToggle /></div>

            <main className="en-col">
                {status && <p className="en-status" role="status">{status}</p>}

                <div className="en-tabs-wrap">
                    <h2 className={`en-logo ${reveal ? 'en-logo-reveal' : ''}`}>
                        <img className="en-logo-bird" src={LOGO} alt={t('T.Academy · Gestão de talentos')} />
                        <img className="en-logo-text" src={LOGO} alt="" aria-hidden="true" />
                        <span ref={birdRef} className="en-logo-box" aria-hidden="true" />
                    </h2>
                    <div ref={tabsRef} className="en-tabs" role="tablist" aria-label={t('Entrar ou criar conta')}
                        onKeyDown={(e) => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) pick(mode === 'entrar' ? 'criar' : 'entrar', true); }}>
                        {['entrar', 'criar'].map((m) => (
                            <button key={m} type="button" role="tab" data-tab={m} id={`tab-${m}`} aria-selected={mode === m} aria-controls="en-panel" tabIndex={mode === m ? 0 : -1} onClick={() => pick(m)}>
                                {t(COPY[m].head)}
                            </button>
                        ))}
                    </div>
                </div>

                <section id="en-panel" role="tabpanel" aria-labelledby={`tab-${mode}`} className="en-panel">
                    <h1 className="en-title">{c.title}</h1>
                    <p className="en-sub">{c.sub}</p>
                    {mode === 'entrar' ? <LoginForm key="entrar" canResetPassword={canResetPassword} /> : <RegisterForm key="criar" />}
                </section>

                <div className="en-more">
                    <div className="en-company">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" /><path d="M15 9h4a1 1 0 0 1 1 1v11" /><path d="M8 8h3M8 12h3M8 16h3M3 21h18" /></svg>
                        <div>
                            <b>{t('Foste convidado pela tua empresa?')}</b>
                            <p>{t('Não precisas de criar conta. Abre o email que recebeste e define a tua palavra-passe.')}</p>
                            <a href={route('password.request')} className="en-link">{t('Não recebi o email')}</a>
                        </div>
                    </div>
                    <a href="/cursos" className="en-catalog">
                        <span><b>{t('Ver os cursos sem conta')}</b><small>{t('Espreita o catálogo e os preços antes de te registares.')}</small></span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </a>
                </div>
            </main>

            <footer className="en-foot">{t('© T.Academy · Gestão de talentos')}</footer>
        </div>
    );
}
