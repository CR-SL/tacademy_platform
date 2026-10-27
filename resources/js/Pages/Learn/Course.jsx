import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import Program from '@/Components/Learn/Program';
import { FlashToast } from '@/Components/Teams/ui';
import { formatEuro, formatMinutes, levelLabels } from '@/Components/CourseBuilder/format';

// Página do curso vista pelo aluno: apresentação, progresso, programa e certificado.
export default function Course({ course, access, progress, program, next, sample, certificate }) {
    const enrolled = access.mode === 'enrolled' || access.mode === 'preview';
    const [buying, setBuying] = useState(false);
    const buy = () => {
        setBuying(true);
        router.post(`/cursos/${course.slug}/comprar`, {}, { preserveScroll: true, onFinish: () => setBuying(false) });
    };

    let cta;
    if (enrolled && next) {
        const label = next.finished ? 'Rever o curso' : next.started ? `Continuar · ${next.title}` : 'Começar o curso';
        cta = <Link href={`/plataforma/cursos/${course.slug}/aulas/${next.ulid}`} className="ta-cut-8 ta-press inline-block bg-accent px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent">{label} →</Link>;
    } else if (access.mode === 'expired') {
        cta = <span className="text-white/80">O teu acesso a este curso terminou a {access.expires}.</span>;
    } else if (access.pending) {
        cta = <span className="ta-cut-8 inline-block bg-white/15 px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em]">Compra a aguardar autorização</span>;
    } else {
        cta = (
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={buy} disabled={buying} className="ta-cut-8 ta-press bg-accent px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent disabled:opacity-50">
                    {buying ? 'A registar…' : `Comprar · ${course.is_free ? 'Grátis' : formatEuro(course.price)}`}
                </button>
                {sample && <Link href={`/plataforma/cursos/${course.slug}/aulas/${sample.ulid}`} className="font-display text-sm font-semibold text-accent underline underline-offset-4">Ver aula de amostra grátis</Link>}
            </div>
        );
    }

    return (
        <StudentLayout>
            <Head title={course.title} />
            {access.mode === 'preview' && (
                <p className="ta-cut-8 mb-4 bg-accent/15 px-4 py-2.5 text-sm">👁 Pré-visualização — estás a ver o curso como um aluno. Todas as aulas estão abertas e o progresso não é guardado.</p>
            )}

            <section className="ta-cut-16 grid overflow-hidden bg-ink text-white md:grid-cols-[1.1fr_.9fr]">
                <div className="flex flex-col gap-3.5 p-6 sm:p-9">
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/65">{course.area} · {levelLabels[course.level] ?? course.level}</span>
                    <h1 className="font-display text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.05]">{course.title}</h1>
                    {course.short && <p className="max-w-xl text-white/80">{course.short}</p>}
                    <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
                        <span><b className="font-display text-white">{course.lessons}</b> aulas</span>
                        <span><b className="font-display text-white">{formatMinutes(course.minutes)}</b></span>
                        {course.instructor && <span>Formador: <b className="font-display text-white">{course.instructor}</b></span>}
                        <span>{access.expires ? `Acesso até ${access.expires}` : course.access_months ? `Acesso durante ${course.access_months} meses` : 'Acesso vitalício'}</span>
                    </p>
                    {enrolled && (
                        <div className="flex max-w-sm items-center gap-3">
                            <span className="h-1.5 flex-1 bg-white/20"><span className="block h-full bg-accent" style={{ width: `${progress.percent}%` }} /></span>
                            <b className="font-display text-lg">{progress.percent}%</b>
                        </div>
                    )}
                    <div className="mt-1">{cta}</div>
                </div>
                <div className="relative min-h-[220px] max-md:order-first">
                    <img src={course.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </div>
            </section>

            <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1fr_360px]">
                <div className="flex flex-col gap-4">
                    {course.learn.length > 0 && (
                        <div className="ta-cut-16 bg-surface p-6">
                            <h2 className="mb-3 font-display text-xl font-bold">O que vais aprender</h2>
                            <ul className="grid gap-2">
                                {course.learn.map((t) => <li key={t} className="flex gap-2"><span className="font-bold text-accent-ink">✓</span>{t}</li>)}
                            </ul>
                        </div>
                    )}
                    {course.description && (
                        <div className="ta-cut-16 bg-surface p-6">
                            <h2 className="mb-3 font-display text-xl font-bold">Sobre o curso</h2>
                            {course.description.split(/\n{2,}/).map((p, i) => <p key={i} className="mb-3 text-[15px]">{p}</p>)}
                            {(course.prerequisites || course.audience) && (
                                <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[150px_1fr]">
                                    {course.prerequisites && <><dt className="text-muted">Pré-requisitos</dt><dd>{course.prerequisites}</dd></>}
                                    {course.audience && <><dt className="text-muted">A quem se destina</dt><dd>{course.audience}</dd></>}
                                </dl>
                            )}
                        </div>
                    )}
                    <div className="ta-cut-16 bg-surface p-6">
                        <h2 className="mb-3 font-display text-xl font-bold">Programa</h2>
                        <Program slug={course.slug} program={program} />
                        {enrolled && course.unlock_window > 0 && (
                            <p className="mt-3 text-[13px] text-muted">
                                🔒 {course.unlock_window === 1 ? 'As aulas abrem por ordem: conclui cada uma para abrir a seguinte.' : `Tens sempre ${course.unlock_window} aulas desbloqueadas; ao concluir uma, abre a seguinte.`}
                            </p>
                        )}
                    </div>
                </div>

                {certificate.enabled && (
                    <div className={`ta-cut-12 p-5 ${certificate.certificate ? 'bg-gradient-to-br from-accent/25 to-accent/5' : 'border-[1.5px] border-dashed border-line'}`}>
                        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Certificado</p>
                        {certificate.certificate ? (
                            <>
                                <h3 className="mt-1 font-display text-lg font-bold">Curso concluído 🎉</h3>
                                <p className="my-2 font-mono text-xl font-bold tracking-wide">{certificate.certificate.number}</p>
                                <p className="text-sm text-muted">Emitido a {certificate.certificate.issued_at}. Em breve vais poder descarregar o certificado em PDF.</p>
                            </>
                        ) : (
                            <>
                                <h3 className="mt-1 font-display text-lg font-bold">Para obter o certificado</h3>
                                <ul className="mt-2.5 grid gap-1.5 text-sm">
                                    <Crit ok={certificate.progress_ok}>Concluir {certificate.min_progress}% das aulas <span className="text-muted">({certificate.progress}%)</span></Crit>
                                    {certificate.score !== null && (
                                        <Crit ok={certificate.score_ok}>Nota média de {certificate.min_score}% nos testes <span className="text-muted">({certificate.score}%)</span></Crit>
                                    )}
                                </ul>
                            </>
                        )}
                    </div>
                )}
            </div>
            <FlashToast />
        </StudentLayout>
    );
}

function Crit({ ok, children }) {
    return (
        <li className="flex gap-2">
            <span className={`w-4 font-bold ${ok ? 'text-[#2F9E5B]' : 'text-muted'}`} aria-label={ok ? 'Cumprido' : 'Por cumprir'}>{ok ? '✓' : '○'}</span>
            <span>{children}</span>
        </li>
    );
}
