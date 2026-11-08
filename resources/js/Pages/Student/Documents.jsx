import { Head } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { formatBytes } from '@/Components/CourseBuilder/format';
import PanelBoard, { alexDef, Crumb, EmptyPanel, PanelsMenu } from '@/Components/Panels/PanelBoard';
import usePanelBoard from '@/Components/Panels/usePanelBoard';

import { t } from '@/i18n';

function Files({ course, query }) {
    const [type, setType] = useState('Todos');
    const types = ['PDF', 'Slides', 'Outros'].filter((tx) => course.sections.some((s) => s.files.some((f) => f.type === tx)));
    const q = query.trim().toLowerCase();
    const sections = course.sections
        .map((s) => ({ ...s, files: s.files.filter((f) => (type === 'Todos' || f.type === type) && (!q || `${f.name} ${f.lesson}`.toLowerCase().includes(q))) }))
        .filter((s) => s.files.length);

    return (
        <>
            <div className="pn-band pn-sm">
                <img src={course.image} alt="" />
                <div className="pn-band-t">
                    <div>
                        <span className="pn-lab">{[course.area, `${course.pct}%`].filter(Boolean).join(' · ')}</span>
                        <h3 className="pn-disp">{course.title}</h3>
                    </div>
                </div>
            </div>
            {types.length > 1 && (
                <div className="pn-d-f ui-pills" role="group" aria-label={t('Filtrar por tipo')}>
                    {['Todos', ...types].map((tx) => <button key={tx} type="button" aria-pressed={type === tx} onClick={() => setType(tx)}>{t(tx)}</button>)}
                </div>
            )}
            {sections.length === 0 && (
                <p className="pn-empty">{course.count === 0 ? t('Este curso ainda não tem documentos.') : t('Nenhum documento com estes filtros.')}</p>
            )}
            {sections.map((s) => (
                <div key={s.title}>
                    <span className="pn-d-sec pn-lab">{s.title}</span>
                    {s.files.map((f) => (
                        <div key={f.id} className="pn-d-row">
                            <span className="pn-file">{t(f.type)}</span>
                            <span className="pn-tx">{f.name}<small>{f.lesson}{f.size ? ` · ${formatBytes(f.size)}` : ''}</small></span>
                            <span className="pn-acts">
                                <a href={f.url} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn-soft ui-btn-sm">{t('Abrir')}</a>
                                <a href={f.url} download className="ui-btn ui-btn-line ui-btn-sm">{t('Descarregar')}</a>
                            </span>
                        </div>
                    ))}
                </div>
            ))}
        </>
    );
}

export default function Documents({ courses, alexUrl, savedLayout }) {
    const [selected, setSelected] = useState(() => (courses.find((c) => c.count > 0) ?? courses[0])?.id ?? null);
    const [query, setQuery] = useState('');
    const current = courses.find((c) => c.id === selected);
    const total = courses.reduce((n, c) => n + c.count, 0);

    const panels = {
        lista: {
            title: t('Os meus documentos'), x: 0, y: 0, w: 5, h: 20, compact: true,
            summary: `${total} ${total === 1 ? t('documento') : t('documentos')}`,
            body: (
                <>
                    <label className="pn-search">
                        <span className="pn-sr">{t('Procurar nos documentos')}</span>
                        <input type="search" placeholder={t('Procurar nos documentos')} value={query} onChange={(e) => setQuery(e.target.value)} />
                    </label>
                    {courses.map((c) => (
                        <button key={c.id} type="button" className={`pn-c-row ${c.id === selected ? 'pn-on' : ''}`} onClick={() => setSelected(c.id)}>
                            <img src={c.image} alt="" loading="lazy" />
                            <span><b>{c.title}</b><small>{c.count} {c.count === 1 ? t('documento') : t('documentos')} · {c.pct === 100 ? t('Concluído') : c.pct === 0 ? t('Por começar') : t(':pct% · em curso', { pct: c.pct })}</small></span>
                        </button>
                    ))}
                    <p className="pn-hint-n">{t('Os documentos são teus para sempre, mesmo depois de terminares o curso.')}</p>
                </>
            ),
        },
        ficheiros: {
            title: t('Documentos do curso'), x: 5, y: 0, w: 14, h: 20, compact: true, float: 'dark',
            body: current
                ? <Files key={current.id} course={current} query={query} />
                : <EmptyPanel title={t('Ainda não tens documentos')} text={t('Os documentos dos teus cursos aparecem aqui.')} href="/plataforma/cursos" cta={t('Ver o catálogo')} />,
        },
        alex: alexDef(alexUrl, 0, 20),
    };
    const board = usePanelBoard({ view: 'documentos', panels, saved: savedLayout });

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title={t('Documentos')} />
            <Crumb label={t('Documentos')} />
            <PanelBoard board={board} />
        </StudentLayout>
    );
}
