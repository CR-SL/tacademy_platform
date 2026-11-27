import { Link } from '@inertiajs/react';
import { useEffect } from 'react';
import { t } from '@/i18n';
import { AlexBuy, AlexCallView, AlexStart } from './AlexCall';
import { dismissAlex, dock, endAlex, isActive, startAlex, useAlexCall } from './alexStore';

/** Começa a avaliação final com o Alex (termina antes a conversa que estiver aberta). */
export async function startEvaluationCall(lesson, place = 'avaliacao') {
    await endAlex();
    dismissAlex();
    startAlex({ place, lesson }); // 'avaliacao' (final do curso) ou 'teste' (teste com avatar de um módulo)
}

/** Termina a avaliação final e limpa a conversa. */
export async function endEvaluationCall() {
    await endAlex();
    dismissAlex();
}

// A avaliação final no painel do avatar: a conversa fica sempre aqui (nunca na janela flutuante)
export function AlexEvaluationPanel({ onClose }) {
    useEffect(() => {
        dock(true);
        return () => dock(false);
    }, []);
    return (
        <div className="ax-docked">
            <AlexCallView onClose={onClose} />
        </div>
    );
}

// O Alex dentro do painel do avatar da aula. Com o painel aberto, a conversa fica aqui;
// ao fechar o painel ou mudar de página, passa para a janela flutuante e não cai.
export default function AlexLessonPanel({ alex, open, onStart }) {
    const s = useAlexCall();
    const inCall = s.status !== 'idle';

    useEffect(() => {
        if (!open || !inCall) return undefined;
        dock(true);
        return () => dock(false);
    }, [open, inCall]);

    // O vídeo da aula fica em pausa enquanto o aluno fala com o Alex
    useEffect(() => { if (isActive(s)) onStart?.(); }, [s.status]); // eslint-disable-line react-hooks/exhaustive-deps

    if (inCall) {
        return (
            <div className="ax-docked">
                <AlexCallView onClose={dismissAlex} />
            </div>
        );
    }
    return (
        <div className="ax-intro">
            <img src="/images/alex.png" alt={t('Alex, o tutor do curso, numa oficina')} />
            <div>
                <AlexStart alex={alex} />
            </div>
        </div>
    );
}

/**
 * Teste com avatar ou roleplay de uma atividade (fase 2, 2026-11-27), na caixa do avatar da aula: primeiro a
 * apresentação (situação, papel do avatar, duração) e o botão para começar; depois a conversa fica aqui.
 * place: 'teste' | 'roleplay'. link: avatar por link (abre num separador, em vez do Tavus).
 */
// onBegin: o teste com avatar começa pela página amarela da aula (como a avaliação), em vez de aqui
export function AlexActivityPanel({ place, lesson, minutes, canStart, link, onStart, alex = null, onBegin = null, tests = [], slug = null }) {
    const s = useAlexCall();
    // O roleplay gasta os minutos incluídos no curso; acabados, 1 crédito (o teste com avatar não gasta)
    const left = s.left ?? alex?.left ?? 0;
    const credits = s.credits ?? alex?.credits ?? 0;
    const metered = place === 'roleplay' && !!alex;
    const mine = s.place === place && s.status !== 'idle';

    useEffect(() => {
        if (!mine) return undefined;
        dock(true);
        return () => dock(false);
    }, [mine]);
    useEffect(() => { if (mine && isActive(s)) onStart?.(); }, [s.status]); // eslint-disable-line react-hooks/exhaustive-deps

    if (mine) {
        return (
            <div className="ax-docked">
                <AlexCallView onClose={dismissAlex} />
            </div>
        );
    }
    const start = async () => {
        await endAlex();
        dismissAlex();
        startAlex({ place, lesson: lesson.ulid });
    };
    if (place === 'teste') {
        return <AvatarTestBox lesson={lesson} tests={tests} slug={slug} canStart={canStart} link={link} onBegin={onBegin ?? start} busy={isActive(s)} />;
    }
    return (
        <div className="ax-activity">
            <div className="ax-activity-in">
                <small>{place === 'roleplay' ? t('Roleplay') : t('Teste com avatar')}</small>
                <h2>{lesson.title}</h2>
                <div className="ax-facts">
                    {minutes > 0 && <span>{t(':n min', { n: minutes })}</span>}
                    {place === 'teste' && <span>{t('Não gasta os teus minutos')}</span>}
                    {place === 'roleplay' && <span>{lesson.graded ? t('Com nota') : t('Sem nota')}</span>}
                    {lesson.done && <span className="ok">{t('✓ Feito')}</span>}
                </div>
                {place === 'roleplay' && lesson.role && <p className="ax-brief"><b>{t('O avatar faz de')}</b>{lesson.role}</p>}
                {place === 'roleplay' && lesson.body && <p className="ax-brief"><b>{t('A situação')}</b>{lesson.body}</p>}
                {place === 'teste' && <p className="ax-brief"><b>{t('Como funciona')}</b>{t('O avatar apresenta casos práticos, um de cada vez. Responde a falar, como farias na oficina.')}</p>}
                {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-accent">{t('Abrir o avatar ↗')}</a>
                ) : canStart && metered && left <= 0 && credits <= 0 ? (
                    <AlexBuy alex={alex} lead={t('Já usaste os :n minutos de avatar incluídos no curso. Compra créditos para fazer o roleplay.', { n: alex.included ?? 30 })} />
                ) : canStart ? (
                    <>
                        <button type="button" className="ui-btn ui-btn-accent" onClick={onBegin ?? start} disabled={isActive(s)}>
                            {place === 'roleplay' ? t('Começar o roleplay') : t('Começar o teste')}
                        </button>
                        {metered && (
                            <p className="ax-hint">{left > 0
                                ? t('Gasta os minutos de avatar do curso: ainda tens :n de :total.', { n: left, total: alex.included ?? 30 })
                                : t('Já usaste os minutos incluídos no curso. Este roleplay gasta 1 crédito (tens :n).', { n: credits })}</p>
                        )}
                    </>
                ) : (
                    <p className="ax-hint">{t('O avatar desta atividade ainda não está disponível. Fala com o formador do curso.')}</p>
                )}
            </div>
        </div>
    );
}

/**
 * Caixa do teste com avatar (opção B + C, 2026-11-27): onde o aluno está nos testes com o Alex do curso
 * (feitos, este, os que faltam) e, em pequeno, como funciona; o botão abre a página amarela.
 */
function AvatarTestBox({ lesson, tests, slug, canStart, link, onBegin, busy }) {
    const list = tests.length ? tests : [{ ulid: lesson.ulid, title: lesson.title, module: null, minutes: lesson.minutes, done: lesson.done }];
    const at = Math.max(0, list.findIndex((x) => x.ulid === lesson.ulid));
    const doneCount = list.filter((x) => x.done).length;
    const here = list[at];

    return (
        <div className="ax-tests">
            <div className="ax-tests-in">
                <small className="ax-tag">{t('Testes com o Alex')}</small>
                <div className="ax-tests-top">
                    <h2>{t('Teste :n de :total', { n: at + 1, total: list.length })}</h2>
                    <span>{doneCount === 1 ? t('1 feito') : t(':n feitos', { n: doneCount })}</span>
                </div>
                <ol className="ax-track">
                    {list.map((x, i) => {
                        const cur = i === at;
                        const body = (
                            <>
                                <span className="n" aria-hidden="true">{x.done ? '✓' : i + 1}</span>
                                <span className="tl">
                                    {x.module ? `${x.module} · ` : ''}{x.title}
                                    <small>{x.done ? t('Feito') : t(':n min', { n: x.minutes })}</small>
                                </span>
                                {cur && <span className="now">{t('Agora')}</span>}
                            </>
                        );
                        const cls = `ax-t ${x.done ? 'done' : ''} ${cur ? 'cur' : ''}`;
                        return (
                            <li key={x.ulid}>
                                {cur || !slug
                                    ? <div className={cls} aria-current={cur ? 'step' : undefined}>{body}</div>
                                    : <Link className={cls} href={`/plataforma/cursos/${slug}/aulas/${x.ulid}`}>{body}</Link>}
                            </li>
                        );
                    })}
                </ol>
                <ol className="ax-steps" aria-label={t('Como funciona')}>
                    <li>{t('O Alex apresenta casos práticos, um de cada vez.')}</li>
                    <li>{t('Respondes a falar, como farias com um cliente (também podes escrever).')}</li>
                    <li>{t('O teste fica feito quando terminas a conversa.')}</li>
                </ol>
            </div>
            <div className="ax-tests-foot">
                <span className="ax-mini" aria-hidden="true" />
                {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-accent">{t('Abrir o avatar ↗')}</a>
                ) : canStart ? (
                    <button type="button" className="ui-btn ui-btn-accent" onClick={onBegin} disabled={busy}>
                        {here?.done ? t('Fazer outra vez') : t('Começar o teste :n →', { n: at + 1 })}
                    </button>
                ) : (
                    <p className="ax-hint">{t('O avatar desta atividade ainda não está disponível. Fala com o formador do curso.')}</p>
                )}
            </div>
        </div>
    );
}