import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import PanelBoard, { alexDef, Crumb, moduleName, PanelsMenu } from '@/Components/Panels/PanelBoard';
import { IconArrow, IconCheck } from '@/Components/Panels/icons';
import usePanelBoard from '@/Components/Panels/usePanelBoard';
import { FlashToast } from '@/Components/Teams/ui';

// Página do curso para quem está inscrito: módulos, aulas do módulo, certificado e o Alex.
export default function EnrolledCourse({ course, progress, program, next, certificate, alexUrl, savedLayout }) {
    const lessonUrl = (l) => `/plataforma/cursos/${course.slug}/aulas/${l.ulid}`;
    const [selected, setSelected] = useState(() => {
        const i = program.findIndex((m) => m.lessons.some((l) => l.ulid === next?.ulid));
        return i >= 0 ? i : 0;
    });
    const mod = program[selected];
    const moduleDone = (m) => m.lessons.filter((l) => l.status === 'done').length;

    const panels = {
        modulos: {
            title: 'Módulos', x: 0, y: 0, w: 5, h: 18, compact: true,
            summary: `${program.length} módulos`,
            body: program.map((m, i) => {
                const done = moduleDone(m);
                return (
                    <button key={m.title} type="button" className={`pn-m-row ${i === selected ? 'pn-on' : ''}`} onClick={() => setSelected(i)}>
                        <span><b>{moduleName(m.title, i)}</b><small>{done} / {m.lessons.length} aulas</small></span>
                        <span className="pn-st">{done === m.lessons.length && done > 0 ? <IconCheck /> : `${done} / ${m.lessons.length}`}</span>
                    </button>
                );
            }),
        },
        modulo: {
            title: 'Aulas do módulo', x: 5, y: 0, w: 14, h: 18, compact: true, float: 'dark',
            body: (
                <>
                    <div className="pn-band">
                        <img src={course.image} alt="" />
                        <div className="pn-band-t">
                            <div>
                                <span className="pn-lab">{course.title} · {progress.percent}%</span>
                                <h3 className="pn-disp">{mod && moduleName(mod.title, selected)}</h3>
                            </div>
                        </div>
                    </div>
                    {mod?.lessons.map((l, j) => (
                        <Link key={l.ulid} href={lessonUrl(l)} className={`pn-l-row ${l.ulid === next?.ulid ? 'pn-cur' : ''}`}>
                            <span>{selected + 1}.{j + 1} · {l.title}</span>
                            <span>{l.status === 'done' ? 'Feita' : l.ulid === next?.ulid ? 'A seguir' : 'Por fazer'}{l.minutes ? ` · ${l.minutes} min` : ''}</span>
                        </Link>
                    ))}
                </>
            ),
        },
        alex: alexDef(alexUrl, 0, 18),
        ...(certificate.enabled ? {
            certificado: {
                title: 'Certificado', x: 0, y: 18, w: 8, h: 8, compact: true,
                summary: certificate.certificate ? certificate.certificate.number : `${certificate.progress}% das aulas`,
                body: (
                    <div className="pn-cert">
                        {certificate.certificate ? (
                            <>
                                <h3 className="pn-disp">{certificate.certificate.number}</h3>
                                <p style={{ marginTop: 6 }}>Emitido a {certificate.certificate.issued_at}. Em breve vais poder descarregar o certificado em PDF.</p>
                            </>
                        ) : (
                            <>
                                <h3 className="pn-disp">Para obter o certificado</h3>
                                <ul>
                                    <li>{certificate.progress_ok ? <IconCheck /> : <span aria-hidden="true">○</span>}<span>Concluir {certificate.min_progress}% das aulas ({certificate.progress}%)</span></li>
                                    {certificate.score !== null && (
                                        <li>{certificate.score_ok ? <IconCheck /> : <span aria-hidden="true">○</span>}<span>Nota média de {certificate.min_score}% nos testes ({certificate.score}%)</span></li>
                                    )}
                                </ul>
                            </>
                        )}
                    </div>
                ),
            },
        } : {}),
        sobre: {
            title: 'Sobre o curso', x: certificate.enabled ? 8 : 0, y: 18, w: certificate.enabled ? 16 : 24, h: 8, compact: true,
            summary: course.instructor ? `Formador: ${course.instructor}` : undefined,
            body: (
                <div className="pn-prose">
                    {course.instructor && <p><b>Formador:</b> {course.instructor}</p>}
                    {course.description?.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                    {course.learn.length > 0 && (
                        <>
                            <h3 className="pn-disp" style={{ marginTop: 14 }}>O que vais aprender</h3>
                            <ul>{course.learn.map((t) => <li key={t}>{t}</li>)}</ul>
                        </>
                    )}
                </div>
            ),
        },
    };
    const board = usePanelBoard({ view: 'curso', panels, saved: savedLayout });
    const nextLabel = next?.finished ? 'Rever o curso' : next?.started ? 'Continuar' : 'Começar o curso';

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title={course.title} />
            <Crumb label={<Link href="/plataforma/meus-cursos">Os meus cursos · {course.title}</Link>}>
                {next && <Link href={lessonUrl(next)} className="pn-btn pn-sm">{nextLabel}<IconArrow /></Link>}
            </Crumb>
            <PanelBoard board={board} />
            <FlashToast />
        </StudentLayout>
    );
}
