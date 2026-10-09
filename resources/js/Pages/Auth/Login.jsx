import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useRef } from 'react';

const FRAG_COUNT = 31;
const BASE = '/images/logo3d';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

// RNG determinístico para o espalhamento dos fragmentos (igual em cada carregamento)
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function sub(p, start, end) {
    return clamp01((p - start) / (end - start));
}

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };

    const wrapRef = useRef(null);
    const stageRef = useRef(null);
    const fragRefs = useRef([]);
    const birdRef = useRef(null);
    const nameRef = useRef(null);
    const phraseRef = useRef(null);
    const formRef = useRef(null);
    const hintRef = useRef(null);

    const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Parâmetros de voo de cada fragmento (vem da esquerda, com dispersão)
    const frags = useMemo(() => {
        const rnd = mulberry32(20260101);
        return Array.from({ length: FRAG_COUNT }, (_, i) => {
            const r1 = rnd(), r2 = rnd(), r3 = rnd();
            return {
                i,
                dx: -(14 + r1 * 46), // % para a esquerda
                dy: (r2 - 0.5) * 70, // % de dispersão vertical
                rot: (r3 - 0.5) * 70, // graus
                start: (i / FRAG_COUNT) * 0.5, // escalonado
                dur: 0.42,
            };
        });
    }, []);

    const fragStyle = (cfg, p) => {
        const e = easeOutCubic(sub(p, cfg.start, cfg.start + cfg.dur));
        const inv = 1 - e;
        return {
            transform: `translate(${cfg.dx * inv}%, ${cfg.dy * inv}%) rotate(${cfg.rot * inv}deg)`,
            opacity: e,
        };
    };
    const birdStyle = (p) => ({ opacity: sub(p, 0.74, 0.95) });
    const nameStyle = (p) => {
        const e = easeOutCubic(sub(p, 0.34, 0.8));
        return { transform: `translateX(${(1 - e) * 55}%)`, opacity: e };
    };
    const phraseStyle = (p) => {
        const e = easeOutCubic(sub(p, 0.72, 1));
        return { transform: `translateY(${(1 - e) * 42}%)`, opacity: e };
    };
    const formStyle = (p) => {
        const e = easeOutCubic(sub(p, 0.82, 1));
        return { transform: `translateY(${(1 - e) * 24}px)`, opacity: e };
    };
    const hintStyle = (p) => ({ opacity: 1 - sub(p, 0, 0.12) });

    const p0 = reduced ? 1 : 0;

    useEffect(() => {
        if (reduced) return; // estado final já aplicado via estilos iniciais

        let raf = 0;
        const apply = () => {
            raf = 0;
            const wrap = wrapRef.current;
            if (!wrap) return;
            const scrollable = wrap.offsetHeight - window.innerHeight;
            const p = scrollable > 0 ? clamp01(-wrap.getBoundingClientRect().top / scrollable) : 0;

            frags.forEach((cfg, idx) => {
                const el = fragRefs.current[idx];
                if (!el) return;
                const s = fragStyle(cfg, p);
                el.style.transform = s.transform;
                el.style.opacity = s.opacity;
            });
            const setS = (el, s) => {
                if (!el) return;
                if (s.transform !== undefined) el.style.transform = s.transform;
                el.style.opacity = s.opacity;
            };
            setS(birdRef.current, birdStyle(p));
            setS(nameRef.current, nameStyle(p));
            setS(phraseRef.current, phraseStyle(p));
            setS(formRef.current, formStyle(p));
            if (hintRef.current) hintRef.current.style.opacity = hintStyle(p).opacity;
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(apply);
        };
        apply();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [frags, reduced]);

    return (
        <>
            <Head title="Entrar" />

            <div
                ref={wrapRef}
                className="relative bg-pearl text-ink"
                style={{ height: reduced ? 'auto' : '240vh' }}
            >
                <div
                    ref={stageRef}
                    className={
                        (reduced ? 'relative min-h-screen ' : 'sticky top-0 h-screen ') +
                        'flex flex-col items-center justify-center overflow-hidden px-4'
                    }
                >
                    <div className="ta-aurora" />

                    <div className="relative z-10 flex w-full flex-col items-center gap-8">
                        {/* Palco do logótipo */}
                        <div
                            className="relative w-full"
                            style={{ maxWidth: 560, aspectRatio: '2884 / 1600' }}
                        >
                            {/* fragmentos do pássaro */}
                            {frags.map((cfg) => (
                                <img
                                    key={cfg.i}
                                    ref={(el) => (fragRefs.current[cfg.i] = el)}
                                    src={`${BASE}/frag_${String(cfg.i).padStart(2, '0')}.png`}
                                    alt=""
                                    aria-hidden="true"
                                    draggable="false"
                                    className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain will-change-transform"
                                    style={fragStyle(cfg, p0)}
                                />
                            ))}
                            {/* pássaro inteiro (limpo) para o estado final sem linhas */}
                            <img
                                ref={birdRef}
                                src={`${BASE}/bird_whole.png`}
                                alt=""
                                aria-hidden="true"
                                draggable="false"
                                className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain"
                                style={birdStyle(p0)}
                            />
                            {/* nome */}
                            <img
                                ref={nameRef}
                                src={`${BASE}/name.png`}
                                alt="T.Academy"
                                draggable="false"
                                className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain will-change-transform"
                                style={nameStyle(p0)}
                            />
                            {/* frase */}
                            <img
                                ref={phraseRef}
                                src={`${BASE}/phrase.png`}
                                alt="Gestão de Talentos"
                                draggable="false"
                                className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain will-change-transform"
                                style={phraseStyle(p0)}
                            />
                        </div>

                        {/* Cartão de login */}
                        <div
                            ref={formRef}
                            className="w-full max-w-md rounded-2xl border border-white/80 bg-white/70 p-6 shadow-[0_10px_30px_rgba(47,111,237,0.08)] backdrop-blur-xl"
                            style={formStyle(p0)}
                        >
                            <h1 className="mb-1 text-xl font-bold text-ink">Bem-vindo de volta</h1>
                            <p className="mb-5 text-sm text-steel">
                                Entra para continuar a tua formação.
                            </p>

                            {status && (
                                <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                                    {status}
                                </div>
                            )}

                            <form onSubmit={submit}>
                                <div>
                                    <InputLabel htmlFor="email" value="Email" />
                                    <TextInput
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        className="mt-1 block w-full"
                                        autoComplete="username"
                                        onChange={(e) => setData('email', e.target.value)}
                                    />
                                    <InputError message={errors.email} className="mt-2" />
                                </div>

                                <div className="mt-4">
                                    <InputLabel htmlFor="password" value="Palavra-passe" />
                                    <TextInput
                                        id="password"
                                        type="password"
                                        name="password"
                                        value={data.password}
                                        className="mt-1 block w-full"
                                        autoComplete="current-password"
                                        onChange={(e) => setData('password', e.target.value)}
                                    />
                                    <InputError message={errors.password} className="mt-2" />
                                </div>

                                <div className="mt-4 flex items-center justify-between">
                                    <label className="flex items-center">
                                        <Checkbox
                                            name="remember"
                                            checked={data.remember}
                                            onChange={(e) => setData('remember', e.target.checked)}
                                        />
                                        <span className="ms-2 text-sm text-steel">
                                            Manter sessão iniciada
                                        </span>
                                    </label>

                                    {canResetPassword && (
                                        <Link
                                            href={route('password.request')}
                                            className="text-sm text-steel underline hover:text-tblue focus:outline-none"
                                        >
                                            Esqueceste-te da palavra-passe?
                                        </Link>
                                    )}
                                </div>

                                <div className="mt-6">
                                    <PrimaryButton className="w-full" disabled={processing}>
                                        Entrar
                                    </PrimaryButton>
                                </div>

                                <p className="mt-6 text-center text-sm text-steel">
                                    Ainda não tens conta?{' '}
                                    <Link
                                        href={route('register')}
                                        className="font-semibold text-tblue hover:underline"
                                    >
                                        Criar conta
                                    </Link>
                                </p>
                            </form>
                        </div>
                    </div>

                    {/* Indicador de scroll */}
                    {!reduced && (
                        <div
                            ref={hintRef}
                            className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-center text-[11px] font-semibold uppercase tracking-widest text-steel"
                            style={hintStyle(p0)}
                        >
                            Faz scroll ↓
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
