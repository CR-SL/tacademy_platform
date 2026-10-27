import { Head, Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import VideoPlayer from '@/Components/Learn/VideoPlayer';
import QuizRunner from '@/Components/Learn/QuizRunner';
import Assistant from '@/Components/Learn/Assistant';
import Program, { TYPE_LABEL } from '@/Components/Learn/Program';
import { FlashToast } from '@/Components/Teams/ui';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const isVideo = (t) => t === 'video_link' || t === 'video_upload';

// Página da aula em três colunas: programa à esquerda, conteúdo ao centro e o painel IA / Perguntas / Notas à direita.
export default function Lesson({ course, mode, program, lesson, position, progress, prev, next, avatarUrl }) {
    const canSave = mode === 'enrolled';
    const done = progress.status === 'completed';
    const player = useRef(null);
    const [watched, setWatched] = useState(progress.watched);
    const [needed, setNeeded] = useState(progress.needed);
    const [checks, setChecks] = useState(lesson.checks);
    const [sideOpen, setSideOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [tabRequest, setTabRequest] = useState(null);

    const video = isVideo(lesson.type);
    const videoReady = !video || done || needed <= 0 || watched >= needed;
    const checksDone = checks.every((c) => c.chosen != null);
    const remaining = Math.max(0, needed - watched);

    const complete = () => {
        setBusy(true);
        router.post(`/plataforma/aulas/${lesson.ulid}/concluir`, {}, { preserveScroll: true, onFinish: () => setBusy(false) });
    };

    let action;
    if (lesson.type === 'quiz') {
        action = done ? <Done /> : <span className="text-sm text-muted">Fica concluída quando passares no teste.</span>;
    } else if (done) {
        action = <Done />;
    } else if (!canSave) {
        action = <span className="text-sm text-muted">{mode === 'preview' ? 'Pré-visualização — o progresso não é guardado.' : 'Aula de amostra — inscreve-te para guardar o progresso.'}</span>;
    } else {
        const reason = !videoReady ? `Faltam ${fmt(remaining)} de vídeo` : !checksDone ? 'Responde às perguntas rápidas' : null;
        action = (
            <span className="flex flex-wrap items-center gap-3">
                {reason && <span className="text-sm text-muted">{reason}</span>}
                <button type="button" onClick={complete} disabled={!!reason || busy}
                    className="ta-cut-8 ta-press bg-accent px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent disabled:cursor-not-allowed disabled:opacity-45">
                    Marcar como concluída
                </button>
            </span>
        );
    }

    return (
        <StudentLayout>
            <Head title={`${lesson.title} · ${course.title}`} />

            <div className="mb-3.5 flex flex-wrap items-center gap-4">
                <Link href={`/plataforma/cursos/${course.slug}`} className="font-display text-sm font-semibold text-muted hover:text-ink">← {course.title}</Link>
                <button type="button" onClick={() => setSideOpen(!sideOpen)} aria-expanded={sideOpen}
                    className="ta-cut-8 bg-surface px-3 py-2 font-display text-xs font-bold uppercase tracking-[0.04em] xl:hidden">Programa</button>
            </div>

            {mode !== 'enrolled' && (
                <p className="ta-cut-8 mb-3.5 bg-accent/15 px-4 py-2.5 text-sm">
                    {mode === 'preview' ? '👁 Pré-visualização (vista do aluno) — o progresso não é guardado.' : '🎁 Aula de amostra grátis — inscreve-te no curso para guardar o progresso.'}
                </p>
            )}

            <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[250px_minmax(0,1fr)_340px]">
                {/* Programa */}
                <aside className={`ta-cut-12 bg-surface xl:sticky xl:top-[90px] xl:block xl:max-h-[calc(100vh-110px)] xl:overflow-y-auto max-xl:col-span-full ${sideOpen ? '' : 'max-xl:hidden'}`}>
                    <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
                        <h2 className="font-display text-sm font-bold uppercase tracking-[0.04em]">Programa</h2>
                        <span className="font-mono text-[11px] text-muted">{position.index}/{position.total}</span>
                    </div>
                    <div className="flex items-center gap-2.5 px-4 pb-2 font-display text-[13px] font-bold">
                        <span className="h-[5px] flex-1 bg-track"><span className="block h-full bg-accent" style={{ width: `${course.percent}%` }} /></span>
                        {course.percent}%
                    </div>
                    <div className="px-2 pb-3">
                        <Program slug={course.slug} program={program} compact />
                        {course.unlock_window > 0 && (
                            <p className="mt-3 px-2 text-xs text-muted">
                                {course.unlock_window === 1 ? 'As aulas abrem por ordem.' : `Tens sempre ${course.unlock_window} aulas desbloqueadas — ao concluir uma, abre a seguinte.`}
                            </p>
                        )}
                    </div>
                </aside>

                {/* Conteúdo */}
                <section className="min-w-0">
                    {video && lesson.video && (
                        <div className="ta-cut-16 relative overflow-hidden bg-ink">
                            <VideoPlayer
                                ref={player}
                                key={lesson.ulid}
                                source={lesson.video}
                                lessonUlid={lesson.ulid}
                                initial={progress}
                                canSave={canSave}
                                onWatched={(w, d) => { setWatched(w); if (d) setNeeded(Math.ceil(d * 0.9)); }}
                            />
                            {avatarUrl && (
                                <button type="button" onClick={() => setTabRequest({ tab: 'ia' })}
                                    className="absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-1.5 pr-3.5 font-display text-[13px] font-bold text-ink shadow-[0_6px_20px_rgba(0,0,0,.25)] transition-transform hover:-translate-y-px">
                                    <span className="h-[22px] w-[22px] rounded-full bg-[radial-gradient(circle_at_35%_35%,#FFE08A,#F8B101_55%,#946A00)] shadow-[0_0_12px_rgba(248,177,1,.6)]" aria-hidden="true" />
                                    Perguntar à IA
                                </button>
                            )}
                        </div>
                    )}
                    {lesson.type === 'avatar' && (
                        <div className="ta-cut-16 flex aspect-video flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_40%,rgba(248,177,1,.2),transparent_55%)] bg-ink p-6 text-center text-white">
                            <span className="h-24 w-24 rounded-full bg-[radial-gradient(circle_at_35%_35%,#FFE08A,#F8B101_55%,#946A00)] shadow-[0_0_50px_rgba(248,177,1,.5)]" aria-hidden="true" />
                            <b className="font-display text-xl">Aula com avatar IA</b>
                            {lesson.url
                                ? <a href={lesson.url} target="_blank" rel="noopener noreferrer" className="ta-cut-8 bg-accent px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent">Abrir avatar ↗</a>
                                : <span className="text-white/70">O link do avatar ainda não foi configurado.</span>}
                        </div>
                    )}
                    {lesson.type === 'document' && lesson.attachments[0] && /\.pdf$/i.test(lesson.attachments[0].url) && (
                        <div className="ta-cut-16 overflow-hidden bg-surface">
                            <iframe src={`${lesson.attachments[0].url}#view=FitH`} title={lesson.attachments[0].name} className="h-[560px] w-full border-0 bg-white" />
                        </div>
                    )}
                    {lesson.type === 'text' && (
                        <div className="ta-cut-16 bg-surface px-5 py-7 sm:px-9">
                            <div className="max-w-3xl">
                                {(lesson.body ?? '').split(/\n{2,}/).map((p, i) => <p key={i} className="mb-3.5 whitespace-pre-line">{p}</p>)}
                            </div>
                        </div>
                    )}
                    {lesson.type === 'quiz' && lesson.quiz && (
                        <div className="ta-cut-16 overflow-hidden bg-surface">
                            <QuizRunner key={lesson.ulid} lessonUlid={lesson.ulid} quiz={lesson.quiz} canSave={canSave} />
                        </div>
                    )}

                    {/* Título, materiais e navegação */}
                    <div className="ta-cut-12 mt-3.5 bg-surface px-5 py-5 sm:px-6">
                        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                            {TYPE_LABEL[lesson.type] ?? lesson.type}{lesson.minutes ? ` · ${lesson.minutes} min` : ''} · aula {position.index} de {position.total}
                            {video && !done && canSave && ` · ${fmt(watched)} vistos`}
                        </p>
                        <h1 className="mt-1.5 font-display text-[26px] font-bold leading-tight">{lesson.title}</h1>
                        {lesson.attachments.length > 0 && (
                            <div className="mt-3.5 flex flex-wrap gap-2">
                                {lesson.attachments.map((a) => (
                                    <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" download className="ta-cut-8 inline-flex items-center gap-2 bg-page px-3 py-2 text-sm hover:bg-surface2">
                                        <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-accent">{a.name.split('.').pop()}</span>
                                        {a.name} ⭳
                                    </a>
                                ))}
                            </div>
                        )}

                        <div className="mt-5 flex flex-wrap items-center gap-2.5">
                            {prev && (
                                <Link href={`/plataforma/cursos/${course.slug}/aulas/${prev.ulid}`} aria-label="Aula anterior" title={prev.title}
                                    className="ta-cut-8 px-4 py-3 font-display text-sm font-bold shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-page">←</Link>
                            )}
                            <span className="flex-1" />
                            {action}
                            {next && (next.open
                                ? <Link href={`/plataforma/cursos/${course.slug}/aulas/${next.ulid}`} className="ta-cut-8 ta-press bg-ink px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-accent">Seguinte →</Link>
                                : <span title="Conclui esta aula para avançar" className="ta-cut-8 cursor-not-allowed bg-ink/40 px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-accent/70">Seguinte →</span>)}
                        </div>
                    </div>
                </section>

                {/* IA / Perguntas / Notas */}
                <Assistant
                    key={lesson.ulid}
                    avatarUrl={avatarUrl}
                    lessonUlid={lesson.ulid}
                    checks={checks}
                    setChecks={setChecks}
                    hasChecks={video && checks.length > 0}
                    checksOpen={videoReady || done}
                    remaining={fmt(remaining)}
                    canSave={canSave}
                    isQuiz={lesson.type === 'quiz'}
                    onAskAi={() => player.current?.pause()}
                    tabRequest={tabRequest}
                />
            </div>
            <FlashToast />
        </StudentLayout>
    );
}

function Done() {
    return <span className="ta-cut-8 bg-[#2F9E5B1c] px-4 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-[#2F9E5B]">✓ Concluída</span>;
}
