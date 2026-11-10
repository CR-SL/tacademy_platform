import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { Chip, Kpi, Pills, Progress, btnClass } from '@/Components/ui';

import { t } from '@/i18n';

// Avaliações do formador (opção D da navegação): resultados dos quizzes dos alunos dos seus cursos.
export default function Assessments({ rows, byCourse }) {
    const wanted = new URLSearchParams(window.location.search).get('resultado');
    const attention = rows.filter((r) => !r.passed);
    const [tab, setTab] = useState(() => (wanted && rows.find((r) => r.key === wanted)?.passed ? 'todas' : 'atencao'));
    const list = tab === 'atencao' ? attention : rows;
    const average = rows.length ? Math.round(rows.reduce((n, r) => n + r.best, 0) / rows.length) : null;

    return (
        <StudentLayout>
            <Head title={t('Avaliações')} />

            <div className="mb-6">
                <h1 className="font-display text-[clamp(30px,3.4vw,44px)] font-bold leading-none tracking-[-0.01em]">{t('Avaliações')}</h1>
                <p className="mt-2 text-muted">{t('Resultados dos quizzes e testes dos alunos dos teus cursos.')}</p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Kpi label={t('Resultados')} value={rows.length} />
                <Kpi label={t('Ainda não passaram')} value={attention.length} alert={attention.length > 0} />
                <Kpi label={t('Sem tentativas')} value={rows.filter((r) => r.out).length} />
                <Kpi label={t('Média das melhores notas')} value={average === null ? '—' : `${average}%`} />
            </div>

            <Pills
                className="mb-4"
                label={t('Mostrar')}
                value={tab}
                onChange={setTab}
                items={[['atencao', t('Precisam de atenção'), attention.length], ['todas', t('Todas'), rows.length], ['curso', t('Por curso'), byCourse.length]]}
            />

            {tab === 'curso' ? (
                byCourse.length ? (
                    <div className="grid gap-3">
                        {byCourse.map((c) => (
                            <div key={c.ulid} className="grid items-center gap-3 bg-surface p-4 sm:grid-cols-[1fr_auto_auto] sm:gap-6 sm:px-5">
                                <div className="min-w-0">
                                    <h3 className="truncate font-display text-[17px] font-semibold">{c.title}</h3>
                                    <p className="text-[13px] text-muted">
                                        {c.students === 1 ? t('1 aluno fez quizzes') : t(':n alunos fizeram quizzes', { n: c.students })}
                                        {c.notPassed > 0 && ` · ${c.notPassed === 1 ? t('1 resultado por passar') : t(':n resultados por passar', { n: c.notPassed })}`}
                                    </p>
                                </div>
                                <Progress value={c.average} />
                                <Link href={`/formador/cursos/${c.ulid}/editar`} className={btnClass('soft', 'sm')}>{t('Abrir o curso')}</Link>
                            </div>
                        ))}
                    </div>
                ) : <Empty />
            ) : list.length ? (
                <div className="grid gap-3">
                    {list.map((r) => (
                        <div key={r.key} className={`grid items-center gap-x-5 gap-y-2 bg-surface p-4 sm:grid-cols-[1fr_auto_auto] sm:px-5 ${r.key === wanted ? 'ring-2 ring-accent' : ''}`}>
                            <div className="min-w-0">
                                <h3 className="truncate font-display text-[17px] font-semibold">{r.student}</h3>
                                <p className="text-[13px] text-muted">{r.quiz} · {r.course} · {r.when}</p>
                            </div>
                            <span className="justify-self-start">
                                {r.passed
                                    ? <Chip tone="ok">{t('Passou')}</Chip>
                                    : <Chip tone={r.out ? 'bad' : 'warn'}>{r.out ? t('Sem tentativas') : t('Tentativa :n de :max', { n: r.attempts, max: r.max })}</Chip>}
                            </span>
                            <div className="text-left sm:text-right">
                                <b className="font-display text-xl font-bold">{r.best}%</b>
                                <small className="block text-[12px] text-muted">{t('mínimo :min%', { min: r.minimum })}</small>
                            </div>
                        </div>
                    ))}
                </div>
            ) : tab === 'atencao' && rows.length ? (
                <div className="bg-surface px-6 py-12 text-center">
                    <p className="font-display text-xl font-bold">{t('Está tudo em dia')}</p>
                    <p className="mt-1 text-muted">{t('Todos os alunos que fizeram quizzes já passaram.')}</p>
                </div>
            ) : <Empty />}
        </StudentLayout>
    );
}

function Empty() {
    return (
        <div className="bg-surface px-6 py-12 text-center">
            <p className="font-display text-xl font-bold">{t('Ainda não há resultados')}</p>
            <p className="mt-1 text-muted">{t('Quando os teus alunos fizerem os quizzes, as notas aparecem aqui.')}</p>
        </div>
    );
}
