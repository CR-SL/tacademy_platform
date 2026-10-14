import '../../../css/login.css';
import { BIRD_PATH } from '@/brand/birdPath';
import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

// Login — conceito 4b "Planta técnica (clara)".
// O passarinho é desenhado como uma peça numa folha técnica; ao entrar, uma linha de verificação
// varre o desenho e cai um carimbo: APROVADO (sucesso) ou REVER (erro).
// Animações em requestAnimationFrame (só transform/opacity/stroke) e desligadas com prefers-reduced-motion.

const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function tween(dur, fn, ease = (t) => t, alive = () => true) {
    return new Promise((done) => {
        const t0 = performance.now();
        const step = (now) => {
            if (!alive()) return done(false);
            const t = Math.min(1, (now - t0) / dur);
            fn(ease(t));
            t < 1 ? requestAnimationFrame(step) : done(true);
        };
        requestAnimationFrame(step);
    });
}

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });
    const [showPass, setShowPass] = useState(false);
    const [shake, setShake] = useState(false);

    const svgRef = useRef(null);
    const scanRef = useRef(null);
    const okRef = useRef(null);
    const noRef = useRef(null);
    const mounted = useRef(true);
    const scanning = useRef(false);

    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const alive = () => mounted.current;

    // Desenho da folha ao abrir: guias → cotas → legendas → peça → tracejado → legenda da folha
    useEffect(() => {
        mounted.current = true;
        const svg = svgRef.current;
        const q = (s) => [...svg.querySelectorAll(s)];
        const guides = q('[data-step=guides] .lp-ln');
        const dims = q('[data-step=dims] .lp-ln');
        const labels = svg.querySelector('[data-step=labels]');
        const block = svg.querySelector('[data-step=block]');
        const line = svg.querySelector('[data-part=line]');
        const fill = svg.querySelector('[data-part=fill]');

        const drawIn = (els, dur) => {
            els.forEach((el) => Object.assign(el.style, { strokeDasharray: '100 100', strokeDashoffset: 100 }));
            return tween(dur, (k) => els.forEach((el) => (el.style.strokeDashoffset = 100 - 100 * k)), easeInOut, alive);
        };

        (async () => {
            if (reduced) {
                labels.setAttribute('opacity', 1);
                block.setAttribute('opacity', 1);
                fill.style.opacity = 0.9;
                return;
            }
            await drawIn(guides, 900);
            await drawIn(dims, 500);
            await tween(300, (k) => labels.setAttribute('opacity', k), undefined, alive);
            await drawIn([line], 1800);
            await tween(700, (k) => (fill.style.opacity = 0.9 * k), undefined, alive);
            await tween(400, (k) => block.setAttribute('opacity', k), undefined, alive);
        })();

        return () => {
            mounted.current = false;
        };
    }, [reduced]);

    // Linha de verificação a varrer a peça enquanto o pedido está a ser enviado
    const startScan = () => {
        [okRef, noRef].forEach((r) => (r.current.style.opacity = 0));
        if (reduced) return;
        scanning.current = true;
        const scan = scanRef.current;
        const t0 = performance.now();
        const step = (now) => {
            if (!scanning.current || !mounted.current) {
                scan.style.opacity = 0;
                return;
            }
            const x = -30 + (((now - t0) / 1100) % 1) * 215;
            scan.setAttribute('x1', x);
            scan.setAttribute('x2', x);
            scan.style.opacity = 0.9;
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };

    // Carimbo a cair sobre a folha
    const stamp = (ref) => {
        scanning.current = false;
        const el = ref.current;
        if (reduced) {
            el.style.opacity = 1;
            el.style.transform = 'rotate(-12deg) scale(1)';
            return;
        }
        tween(380, (k) => {
            el.style.opacity = Math.min(1, k * 2);
            el.style.transform = `rotate(-12deg) scale(${1.6 - 0.6 * k})`;
        }, easeOut, alive);
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), {
            onStart: startScan,
            onSuccess: () => stamp(okRef),
            onError: () => {
                stamp(noRef);
                setShake(false);
                requestAnimationFrame(() => setShake(true));
            },
            onFinish: () => reset('password'),
        });
    };

    return (
        <>
            <Head title="Entrar" />

            <div className="lp">
                <header className="lp-top">
                    {/* A landing é uma página Blade (não Inertia): link normal, para navegar de facto em vez de abrir numa janela */}
                    <a href={route('home')}>
                        <img src="/images/brand/logo-tacademy.png" alt="T.Academy" width="110" height="26" />
                    </a>
                    <a href={route('home')} className="lp-back">
                        ← VOLTAR AO SITE
                    </a>
                </header>

                <main className="lp-wrap">
                    {/* Folha técnica: decorativa */}
                    <div className="lp-sheet" aria-hidden="true">
                        <svg viewBox="-40 -30 260 250" ref={svgRef}>
                            <defs>
                                <pattern id="lp-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                    <line x1="0" y1="0" x2="0" y2="4" stroke="#F8B101" strokeWidth=".7" opacity=".9" />
                                </pattern>
                                <marker id="lp-ar" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                                    <path d="M0 0L6 3L0 6z" fill="#3F3F46" />
                                </marker>
                            </defs>

                            {/* linhas de construção */}
                            <g data-step="guides">
                                <line className="lp-ln lp-guide" x1="-30" y1="85" x2="185" y2="85" pathLength="100" />
                                <line className="lp-ln lp-guide" x1="76" y1="-20" x2="76" y2="185" pathLength="100" />
                                <circle className="lp-ln lp-guide" cx="122" cy="62" r="20" pathLength="100" />
                                <circle className="lp-ln lp-guide" cx="76" cy="85" r="62" pathLength="100" />
                                <line className="lp-ln lp-guide" x1="0" y1="58" x2="64" y2="4" pathLength="100" />
                            </g>

                            {/* cotas */}
                            <g data-step="dims">
                                <line className="lp-ln lp-dim" x1="0" y1="-14" x2="152" y2="-14" markerStart="url(#lp-ar)" markerEnd="url(#lp-ar)" pathLength="100" />
                                <line className="lp-ln lp-dim" x1="168" y1="0" x2="168" y2="170" markerStart="url(#lp-ar)" markerEnd="url(#lp-ar)" pathLength="100" />
                                <line className="lp-ln lp-dim" x1="122" y1="62" x2="136" y2="48" pathLength="100" />
                            </g>
                            <g data-step="labels" opacity="0">
                                <text className="lp-txt strong" x="70" y="-18">152</text>
                                <text className="lp-txt strong" x="172" y="88">170</text>
                                <text className="lp-txt" x="138" y="46">R 20</text>
                                <text className="lp-txt" x="-28" y="82">EIXO A</text>
                                <text className="lp-txt" x="80" y="182">EIXO B</text>
                                <text className="lp-txt" x="2" y="52">38°</text>
                            </g>

                            {/* a peça: o passarinho */}
                            <path className="lp-hatch" data-part="fill" d={BIRD_PATH} />
                            <path className="lp-ln lp-part" data-part="line" d={BIRD_PATH} pathLength="100" />

                            {/* legenda da folha */}
                            <g data-step="block" opacity="0">
                                <rect x="96" y="190" width="120" height="26" fill="#ffffff" stroke="#3F3F46" strokeWidth=".4" />
                                <line x1="96" y1="200" x2="216" y2="200" stroke="#3F3F46" strokeWidth=".3" />
                                <text className="lp-txt strong" x="100" y="197">T.ACADEMY · PEÇA Nº 001</text>
                                <text className="lp-txt" x="100" y="207">DES.: GESTÃO DE TALENTOS</text>
                                <text className="lp-txt" x="100" y="213">ESCALA 1:1 · REV. {new Date().getFullYear()}</text>
                            </g>

                            <line className="lp-scan" ref={scanRef} x1="-30" y1="0" x2="-30" y2="185" />
                        </svg>
                        <div className="lp-stamp ok" ref={okRef}>APROVADO</div>
                        <div className="lp-stamp no" ref={noRef}>REVER</div>
                    </div>

                    {/* Ficha de acesso */}
                    <div className="lp-cardwrap">
                        <span className="lp-card-tag">FICHA DE ACESSO · Nº 001</span>
                        <div className={`lp-card ${shake ? 'lp-shake' : ''}`} onAnimationEnd={() => setShake(false)}>
                            <form className="lp-form" onSubmit={submit} noValidate>
                                <h1>Bem-vindo de volta.</h1>
                                <p className="lp-lead">Confere os teus dados e entra na oficina.</p>

                                {status && <div className="lp-status" role="status">{status}</div>}

                                <div className="lp-field">
                                    <label className="lp-label" htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        className={`lp-input ${errors.email ? 'bad' : ''}`}
                                        autoComplete="username"
                                        placeholder="nome@oficina.pt"
                                        autoFocus
                                        aria-invalid={!!errors.email}
                                        aria-describedby={errors.email ? 'email-error' : undefined}
                                        onChange={(e) => setData('email', e.target.value)}
                                    />
                                </div>

                                <div className="lp-field">
                                    <label className="lp-label" htmlFor="password">
                                        Palavra-passe
                                        {canResetPassword && <Link href={route('password.request')}>Esqueceste-te?</Link>}
                                    </label>
                                    <div className="lp-pass">
                                        <input
                                            id="password"
                                            type={showPass ? 'text' : 'password'}
                                            name="password"
                                            value={data.password}
                                            className={`lp-input ${errors.password ? 'bad' : ''}`}
                                            autoComplete="current-password"
                                            onChange={(e) => setData('password', e.target.value)}
                                        />
                                        <button type="button" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}>
                                            {showPass ? 'ESCONDER' : 'MOSTRAR'}
                                        </button>
                                    </div>
                                </div>

                                <label className="lp-remember">
                                    <input type="checkbox" name="remember" checked={data.remember} onChange={(e) => setData('remember', e.target.checked)} />
                                    Manter sessão iniciada
                                </label>

                                {(errors.email || errors.password) && (
                                    <p className="lp-err" id="email-error" role="alert">
                                        {errors.email || errors.password}
                                    </p>
                                )}

                                <button className="lp-submit" type="submit" disabled={processing}>
                                    {processing ? 'A verificar…' : 'Entrar ▶'}
                                </button>

                                <p className="lp-alt">
                                    Ainda não tens conta? <Link href={route('register')}>Criar conta</Link>
                                </p>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
