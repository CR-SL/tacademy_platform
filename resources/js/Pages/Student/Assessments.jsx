import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import PanelBoard, { alexDef, Crumb, EmptyPanel, PanelsMenu } from '@/Components/Panels/PanelBoard';
import usePanelBoard from '@/Components/Panels/usePanelBoard';

import { t } from '@/i18n';

function Detail({ r }) {
    return (
        <div className="pn-detail">
            <span className="pn-lab">{t('Teste ·')}{' '}{r.course} · {r.date}</span>
            <h3 className="pn-disp">{r.title}</h3>
            <div className="pn-score pn-disp">{r.score}%</div>
            <p>
                {r.passed ? t('Passaste') : t('Ainda não passaste')}{t(': a nota mínima é :min%. Tentativa :n de :max.', { min: r.minimum, n: r.attempt, max: r.attempts })}
            </p>
            {r.hasAnswers ? (
                <>
                    <div className="pn-note-b">
                        <span className="pn-lab">{t('Correu bem')}</span>
                        {t('Acertaste em :right de :total perguntas.', { right: r.right, total: r.total })}
                    </div>
                    <div className="pn-note-b">
                        <span className="pn-lab">{t('A rever')}</span>
                        {r.review.length === 0 ? t('Nada a rever neste teste.') : (
                            <ul className="pn-review">{r.review.map((q) => <li key={q}>{q}</li>)}</ul>
                        )}
                    </div>
                </>
            ) : (
                <div className="pn-note-b">{t('Esta tentativa não tem o detalhe das respostas.')}</div>
            )}
            <div className="pn-acts">
                <Link href={r.url} className="ui-btn">{t('Rever a aula')}</Link>
                {r.courseId && <Link href={`/dashboard?conversa=${r.courseId}`} className="ui-btn ui-btn-soft">{t('Perguntar ao formador')}</Link>}
            </div>
        </div>
    );
}

export default function Assessments({ results, alexUrl, savedLayout }) {
    const [selected, setSelected] = useState(() => {
        const wanted = Number(new URLSearchParams(window.location.search).get('teste'));
        return results.some((r) => r.id === wanted) ? wanted : results[0]?.id ?? null;
    });
    const current = results.find((r) => r.id === selected);

    const panels = {
        lista: {
            title: t('Avaliações'), x: 0, y: 0, w: 6, h: 18, compact: true,
            summary: `${results.length} ${results.length === 1 ? t('tentativa') : t('tentativas')}`,
            body: results.length ? results.map((r) => (
                <button key={r.id} type="button" className={`pn-a-row ${r.id === selected ? 'pn-on' : ''}`} onClick={() => setSelected(r.id)}>
                    <span className="pn-lab">{t('Teste ·')}{' '}{r.date}</span>
                    <b>{r.title}</b>
                    <small>{r.course}</small>
                    <em className={r.passed ? '' : 'pn-fail'}>{r.score}%</em>
                </button>
            )) : <p className="pn-empty">{t('Ainda não fizeste nenhum teste.')}</p>,
        },
        detalhe: {
            title: t('Resultado'), x: 6, y: 0, w: 13, h: 18, compact: true, float: 'light',
            body: current ? <Detail r={current} /> : <EmptyPanel title={t('Sem resultados')} text={t('Os resultados dos testes aparecem aqui depois de os fazeres.')} href="/plataforma/meus-cursos" cta={t('Ver os meus cursos')} />,
        },
        alex: alexDef(alexUrl, 0, 18),
    };
    const board = usePanelBoard({ view: 'avaliacoes', panels, saved: savedLayout });

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title={t('Avaliações')} />
            <Crumb label={t('Avaliações')} />
            <PanelBoard board={board} />
        </StudentLayout>
    );
}
