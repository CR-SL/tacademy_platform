import { Head, Link, router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import StepInfo from '@/Components/CourseBuilder/StepInfo';
import StepProgram, { activeUploads } from '@/Components/CourseBuilder/StepProgram';
import StepAvatar from '@/Components/CourseBuilder/StepAvatar';
import StepPrice from '@/Components/CourseBuilder/StepPrice';
import StepReview from '@/Components/CourseBuilder/StepReview';
import { blankCourse, checklist } from '@/Components/CourseBuilder/model';
import { setAvatarHosts } from '@/Components/CourseBuilder/format';
import { useConfirm } from '@/Components/ui';

import { t } from '@/i18n';

const STEPS = [
    ['Informação', 'Título, área, capa'],
    ['Programa', 'Módulos e aulas'],
    ['Avatar', 'Formador IA'],
    ['Preço e acesso', 'Preço, certificado'],
    ['Rever e publicar', 'Pré-visualizar'],
];
const SAVE_DELAY = 1200;
const LAST = STEPS.length - 1; // Rever e publicar

// Junta à pergunta os ids que o servidor deu. Os ids das opções só se juntam se o número de opções não mudou
// entretanto; se mudou, a próxima gravação cria as opções novas (nunca dá o id de uma opção a outra).
function withQuestionIds(q, saved) {
    if (!saved) return q;
    const ids = q.option_ids ?? q.options.map(() => null);
    const sameShape = saved.option_ids.length === q.options.length;
    return {
        ...q,
        id: q.id ?? saved.id,
        option_ids: sameShape ? ids.map((id, i) => id ?? saved.option_ids[i]) : ids,
    };
}

// Editor de cursos dos formadores: assistente em 5 passos que se guarda sozinho.
export default function CourseEditor({ course, categories, library, shortMax, canAlex, canManageAlex, avatarHosts }) {
    setAvatarHosts(avatarHosts); // antes de qualquer verificação do avatar (lista do que falta, campo do link)
    const [c, setC] = useState(() => course ?? blankCourse());
    const [step, setStep] = useState(0);
    const [openKey, setOpenKey] = useState(() => (course ? null : blankFirstLesson(c)));
    const [save, setSave] = useState(course ? 'saved' : 'new'); // new | pending | saving | saved | error
    const [saveError, setSaveError] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [publishError, setPublishError] = useState('');

    // Gravação automática: só grava depois de alterações do utilizador, uma de cada vez
    const latest = useRef(c);
    const dirty = useRef(false);
    const inFlight = useRef(null);
    const timer = useRef(null);
    const ulid = useRef(course?.ulid ?? null);
    latest.current = c;

    const update = useCallback((fn) => {
        dirty.current = true;
        setC((prev) => {
            const next = structuredClone(prev);
            fn(next);
            return next;
        });
    }, []);

    const flush = useCallback(async () => {
        clearTimeout(timer.current);
        if (inFlight.current) await inFlight.current;
        if (!dirty.current) return true;
        dirty.current = false;
        setSave('saving');
        const data = latest.current;
        const run = (async () => {
            try {
                const res = ulid.current
                    ? await window.axios.put(`/formador/cursos/${ulid.current}`, data)
                    : await window.axios.post('/formador/cursos', data);
                const { modules, lessons, slug, questions = {}, checks = {} } = res.data;
                if (!ulid.current) {
                    ulid.current = res.data.ulid;
                    // o endereço passa a ser o do curso, para um refresh não criar outro
                    window.history.replaceState(window.history.state, '', `/formador/cursos/${ulid.current}/editar`);
                }
                // ids dos módulos, aulas e perguntas novos (sem marcar como alteração)
                setC((prev) => ({
                    ...prev,
                    ulid: ulid.current,
                    slug,
                    modules: prev.modules.map((m) => ({
                        ...m,
                        id: m.id ?? modules[m.key] ?? null,
                        lessons: m.lessons.map((l) => ({
                            ...l,
                            id: l.id ?? lessons[l.key] ?? null,
                            quiz: (l.quiz ?? []).map((q) => withQuestionIds(q, questions[q.key])),
                            checks: (l.checks ?? []).map((c) => ({ ...c, id: c.id ?? checks[c.key] ?? null })),
                        })),
                    })),
                }));
                setSaveError('');
                setSave(dirty.current ? 'pending' : 'saved');
                return true;
            } catch (e) {
                dirty.current = true;
                setSave('error');
                setSaveError(e.response?.status === 422
                    ? Object.values(e.response.data.errors ?? {})[0]?.[0] ?? t('Há um campo inválido.')
                    : t('Sem ligação ao servidor. Vamos tentar de novo.'));
                return false;
            } finally {
                inFlight.current = null;
            }
        })();
        inFlight.current = run;
        return run;
    }, []);

    useEffect(() => {
        if (!dirty.current) return;
        setSave('pending');
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, SAVE_DELAY);
    }, [c, flush]);

    // Nova tentativa automática se a gravação falhar por falta de ligação
    useEffect(() => {
        if (save !== 'error') return;
        const tx = setTimeout(flush, 5000);
        return () => clearTimeout(tx);
    }, [save, flush]);

    // Envios de ficheiros em curso (continuam com a aula fechada ou noutro passo; param ao sair do editor)
    const [, setUploadsTick] = useState(0);
    const [uploadError, setUploadError] = useState('');
    useEffect(() => {
        activeUploads.stop = false;
        activeUploads.notify = (error) => {
            setUploadsTick((n) => n + 1);
            if (error) setUploadError(error);
        };
        return () => { activeUploads.stop = true; activeUploads.notify = null; };
    }, []);

    // Avisar antes de sair com alterações por gravar ou com um vídeo a carregar (sair perde o envio)
    const confirmRef = useRef(null);
    const leaving = useRef(false);
    useEffect(() => {
        const warn = (e) => {
            if (dirty.current || inFlight.current || activeUploads.count > 0) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', warn);
        const off = router.on('before', (e) => {
            const visit = e.detail.visit;
            if (visit.method !== 'get' || leaving.current) return;
            if (activeUploads.count > 0) {
                e.preventDefault();
                confirmRef.current?.({
                    title: t('Há um ficheiro a carregar'),
                    body: t('Se saíres agora, o envio perde-se e terás de carregar o ficheiro outra vez.'),
                    action: t('Sair na mesma'),
                    danger: true,
                }).then((yes) => {
                    if (!yes) return;
                    leaving.current = true;
                    flush().then(() => router.visit(visit.url));
                });
                return;
            }
            if (!(dirty.current || inFlight.current)) return;
            e.preventDefault();
            flush().then((ok) => ok && router.visit(visit.url));
        });
        return () => { window.removeEventListener('beforeunload', warn); off(); };
    }, [flush]);

    const upload = useCallback(async (file, kind) => {
        const form = new FormData();
        form.append('file', file);
        form.append('kind', kind);
        try {
            const res = await window.axios.post('/formador/uploads', form);
            return res.data;
        } catch (e) {
            throw new Error(e.response?.status === 422
                ? Object.values(e.response.data.errors ?? {})[0]?.[0] ?? t('Ficheiro inválido.')
                : e.response?.status === 413 ? t('O ficheiro é demasiado grande.') : t('Não foi possível carregar o ficheiro.'));
        }
    }, []);

    const goTo = (i) => {
        setStep(i);
        window.scrollTo({ top: 0 });
    };

    const publish = async () => {
        setPublishError('');
        setPublishing(true);
        const ok = await flush();
        if (!ok || !ulid.current) { setPublishing(false); setPublishError(t('Não foi possível guardar antes de publicar.')); return; }
        router.post(`/formador/cursos/${ulid.current}/publicar`, {}, {
            onError: (errors) => setPublishError(errors.publish ?? t('Não foi possível publicar.')),
            onFinish: () => setPublishing(false),
        });
    };

    const [confirm, confirmDialog] = useConfirm();
    confirmRef.current = confirm;
    const unpublish = async () => {
        if (!(await confirm({ title: t('Passar o curso a rascunho?'), body: t('Sai do catálogo até voltar a publicar.'), action: t('Passar a rascunho') }))) return;
        await flush();
        router.post(`/formador/cursos/${ulid.current}/rascunho`, {}, {
            preserveScroll: true,
            onSuccess: () => setC((prev) => ({ ...prev, status: 'draft' })),
        });
    };

    const doneStep = (i) => checklist(c, shortMax).filter((x) => x[1] === i).every((x) => x[2]);
    const saveLabel = {
        new: t('Começa a preencher. Fica guardado sozinho.'),
        pending: t('Alterações por guardar…'),
        saving: t('A guardar…'),
        saved: c.status === 'published' ? t('Guardado · publicado') : t('Rascunho guardado'),
        error: saveError,
    }[save];
    const statusLabel = activeUploads.count > 0 && save !== 'error' ? t('A carregar ficheiro… não feches a página.') : saveLabel;

    return (
        <StudentLayout>
            <Head title={c.title ? t('Editar · :title', { title: c.title }) : t('Criar curso')} />

            <div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]">
                <aside className="flex gap-1 overflow-x-auto bg-surface p-3 lg:sticky lg:top-[90px] lg:flex-col lg:p-[18px]">
                    <Link href="/formador/cursos" className="mb-3 hidden items-center gap-1.5 font-display text-[13px] font-semibold text-muted hover:text-ink lg:inline-flex">
                        {t('← Os meus cursos')}
                    </Link>
                    {STEPS.map(([pt, ps], i) => { const [title, sub] = [t(pt), t(ps)];
                        const done = i !== step && i < LAST && doneStep(i);
                        return (
                            <button
                                key={title}
                                type="button"
                                onClick={() => goTo(i)}
                                aria-current={i === step ? 'step' : undefined}
                                className={`flex flex-none items-center gap-3 p-2 text-left lg:w-full lg:p-2.5 ${i === step ? 'bg-page' : 'hover:bg-page/60'}`}
                            >
                                <span className={`rounded-full flex h-[30px] w-[30px] flex-none items-center justify-center font-display text-sm font-bold ${
                                    i === step ? 'bg-accent text-on-accent' : done ? 'bg-ink text-on-ink' : 'bg-surface2 text-muted'
                                }`}>
                                    {done ? '✓' : i + 1}
                                </span>
                                <span>
                                    <b className="block whitespace-nowrap font-display text-[13px] font-semibold lg:text-[15px]">{title}</b>
                                    <small className="hidden text-xs text-muted lg:block">{sub}</small>
                                </span>
                            </button>
                        );
                    })}
                    <div role="status" className="mt-3.5 hidden items-center gap-2 border-t border-line pt-3.5 text-[12.5px] text-muted lg:flex">
                        <i className={`h-2 w-2 flex-none rounded-full ${save === 'error' ? 'bg-live' : save === 'saved' ? 'bg-success' : save === 'new' ? 'bg-track' : 'bg-accent'}`} />
                        <span className={save === 'error' ? 'text-live-ink' : ''}>{statusLabel}</span>
                    </div>
                </aside>

                <section className="min-w-0">
                    {uploadError && (
                        <p role="alert" className="mb-3 flex items-start gap-3 bg-live/10 px-4 py-2.5 text-sm text-live-ink">
                            <span className="flex-1">{uploadError}</span>
                            <button type="button" onClick={() => setUploadError('')} className="font-display text-[13px] font-semibold hover:text-ink">{t('Fechar')}</button>
                        </p>
                    )}
                    {save === 'error' && (
                        <p role="alert" className="mb-3 bg-live/10 px-4 py-2.5 text-sm text-live-ink">{saveError}</p>
                    )}
                    {step === 0 && <StepInfo c={c} update={update} categories={categories} library={library} shortMax={shortMax} upload={upload} />}
                    {step === 1 && <StepProgram c={c} update={update} upload={upload} openKey={openKey} setOpenKey={setOpenKey} />}
                    {step === 2 && <StepAvatar c={c} update={update} canAlex={canAlex} canManageAlex={canManageAlex} />}
                    {step === 3 && <StepPrice c={c} update={update} />}
                    {step === LAST && (
                        <StepReview
                            c={c}
                            categories={categories}
                            shortMax={shortMax}
                            goTo={goTo}
                            onPublish={publish}
                            onUnpublish={unpublish}
                            publishing={publishing}
                            error={publishError}
                        />
                    )}

                    <div className="mt-4 flex flex-wrap justify-between gap-3">
                        {step > 0 ? (
                            <button type="button" onClick={() => goTo(step - 1)} className="ui-btn ui-btn-soft">
                                {t('← Anterior')}
                            </button>
                        ) : <span />}
                        {step < LAST && (
                            <button type="button" onClick={() => goTo(step + 1)} className="ui-btn">
                                {t('Seguinte →')}
                            </button>
                        )}
                    </div>
                </section>
            </div>
            {confirmDialog}
        </StudentLayout>
    );
}

function blankFirstLesson(c) {
    return c.modules[0]?.lessons[0]?.key ?? null;
}
