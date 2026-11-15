import { Head } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/Components/ui';
import '../../css/error.css';

import { t } from '@/i18n';

// Página de erro 404 (2026-11-15). A ideia: falta uma peça. O pássaro do logótipo monta-se com as
// peças da entrada, mas a cabeça fica fora do sítio; um clique (ou Enter) põe-na no lugar.
// Abre sem sessão (endereços que não existem não passam pelas rotas), por isso só usa ligações simples.

const IMG = '/images/logo3d';
const FRAGS = 31;
const LOOSE = 0; // a peça que falta: a cabeça
const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';

// Gerador fixo, como na entrada: as peças partem sempre dos mesmos sítios
function scatter() {
    let s = 11;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: FRAGS }, () => ({ dx: (r() - 0.5) * 60, dy: (r() - 0.5) * 50, rot: (r() - 0.5) * 120 }));
}

export default function ErrorPage({ status = 404 }) {
    const birdRef = useRef(null);
    const looseRef = useRef(null);
    const pieces = useRef(scatter()).current;
    const [placed, setPlaced] = useState(false);

    // As peças juntam-se; a cabeça pousa ao lado e fica a baloiçar
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const anims = [...birdRef.current.querySelectorAll('[data-frag]')].map((im, i) => {
            const p = pieces[i];
            return im.animate([
                { transform: `translate(${p.dx}%, ${p.dy}%) rotate(${p.rot}deg) scale(.7)`, opacity: 0 },
                { transform: 'none', opacity: 1 },
            ], { duration: 1000, delay: 80 + i * 22, easing: EASE_OUT, fill: 'both' });
        });
        anims.push(looseRef.current.animate([
            { translate: '0 -60%', opacity: 0 }, { translate: '0 0', opacity: 1 },
        ], { duration: 900, delay: 700, easing: EASE_OUT, fill: 'both' }));
        return () => anims.forEach((a) => a.cancel());
    }, [pieces]);

    return (
        <div className="er-page">
            <Head title={t('Página não encontrada')} />
            <header className="er-top">
                <a href="/" aria-label={t('T.Academy, ir para o início')}><img src="/images/brand/logo-nav.png" alt="T.Academy" className="er-logo" /></a>
            </header>

            <main className="er-main">
                <div className={`er-bird ${placed ? 'is-placed' : ''}`} ref={birdRef} aria-hidden={placed ? 'true' : undefined}>
                    <div className="er-frame">
                        {Array.from({ length: FRAGS }, (_, i) => (i === LOOSE ? null : (
                            <img key={i} data-frag src={`${IMG}/frag_${String(i).padStart(2, '0')}.png`} alt="" draggable="false" />
                        )))}
                        {/* Com a peça no lugar, as juntas desaparecem: fica o pássaro inteiro */}
                        <img className="er-whole" src={`${IMG}/bird_whole.png`} alt="" draggable="false" />
                    </div>
                    <button type="button" ref={looseRef} className="er-loose" disabled={placed}
                        aria-label={t('Pôr a peça que falta no lugar')} title={placed ? undefined : t('Pôr a peça no lugar')}
                        onClick={() => setPlaced(true)}>
                        <img src={`${IMG}/frag_${String(LOOSE).padStart(2, '0')}.png`} alt="" draggable="false" />
                    </button>
                </div>

                <div className="er-txt">
                    <h1>{placed ? t('Assim está melhor.') : t('Esta página não existe.')}</h1>
                    <p>
                        {placed
                            ? t('O pássaro já está inteiro. A página que procuravas é que continua sem aparecer: volta ao início ou procura no catálogo.')
                            : t('Pode haver um erro no endereço, ou a página mudou de sítio. Volta ao início ou procura o curso no catálogo.')}
                    </p>
                    <div className="er-acts">
                        <Button href="/" external variant="accent">{t('Ir para o início')}</Button>
                        <Button href="/plataforma/cursos" external variant="soft">{t('Ver o catálogo')}</Button>
                    </div>
                    <p className="er-small">
                        {t('Erro :status.', { status })}{' '}
                        <a href="/plataforma/contactos">{t('Falar connosco')}</a>
                    </p>
                </div>
            </main>
        </div>
    );
}
