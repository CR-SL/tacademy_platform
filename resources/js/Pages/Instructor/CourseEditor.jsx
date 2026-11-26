import { Head, Link, router, usePage } from '@inertiajs/react';
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
import EditorGuide from '@/Components/CourseBuilder/EditorGuide';
import ReadyBox, { readyItems } from '@/Components/CourseBuilder/ReadyBox';
import { guideFor, guideSeen, markGuideSeen } from '@/Components/CourseBuilder/guides';
import TemplatePicker from '@/Components/CourseBuilder/TemplatePicker';
import { MODELS, courseFromModel } from '@/Components/CourseBuilder/templates';

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
    // Curso novo: primeiro escolhe-se um modelo (2026-11-26); o modelo usado aparece no Programa até à 1.ª gravação
    const [picking, setPicking] = useState(!course);
    const [modelName, setModelName] = useState(null);
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
    // Curso publicado (2026-11-26): nada se grava sozinho; as alterações só chegam aos alunos com "Publicar alterações".
    // Até lá ficam guardadas neste browser (backupKey), para não se perderem se a página fechar.
    const live = c.status === 'published';
    const liveRef = useRef(live);
    liveRef.current = live;
    const savedCopy = useRef(course ?? null); // o curso tal como está no servidor (para "Descartar alterações")
    const backupKey = `ta-editor-alteracoes-${course?.ulid ?? 'novo'}`;

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
                const withIds = (prev) => ({
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
                });
                savedCopy.current = withIds(data);
                setC(withIds);
                if (liveRef.current) {
                    try { localStorage.removeItem(backupKey); } catch { /* ignora */ }
                }
                setSaveError('');
                setSave(dirty.current ? (liveRef.current ? 'changes' : 'pending') : 'saved');
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
        if (liveRef.current) {
            // Publicado: guarda só neste browser e espera por "Publicar alterações"
            setSave('changes');
            try { localStorage.setItem(backupKey, JSON.stringify({ at: Date.now(), c })); } catch { /* sem espaço: fica só na página */ }
            return;
        }
        setSave('pending');
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, SAVE_DELAY);
    }, [c, flush]); // eslint-disable-line react-hooks/exhaustive-deps

    // Alterações de um curso publicado que ficaram por publicar neste browser (página fechada antes de publicar)
    const [backup, setBackup] = useState(() => {
        if (course?.status !== 'published') return null;
        try { return JSON.parse(localStorage.getItem(`ta-editor-alteracoes-${course.ulid}`) ?? 'null'); } catch { return null; }
    });
    const recoverBackup = () => {
        dirty.current = true;
        setC(backup.c);
        setBackup(null);
    };
    const dropBackup = () => {
        try { localStorage.removeItem(backupKey); } catch { /* ignora */ }
        setBackup(null);
    };

    // Nova tentativa automática se a gravação falhar por falta de ligação (num curso publicado, só no botão)
    useEffect(() => {
        if (save !== 'error' || liveRef.current) return;
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
                    (liveRef.current ? Promise.resolve() : flush()).then(() => router.visit(visit.url));
                });
                return;
            }
            if (!(dirty.current || inFlight.current)) return;
            e.preventDefault();
            // Curso publicado: sair não publica nada; as alterações ficam guardadas neste browser
            if (liveRef.current && dirty.current) {
                confirmRef.current?.({
                    title: t('Sair sem publicar as alterações?'),
                    body: t('Os alunos continuam a ver o curso como estava. As alterações ficam guardadas neste computador e podes publicá-las quando voltares.'),
                    action: t('Sair sem publicar'),
                }).then((yes) => {
                    if (!yes) return;
                    leaving.current = true;
                    router.visit(visit.url);
                });
                return;
            }
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

    // Guia: cada passo abre o seu na primeira visita; "Ver o guia" mostra o do passo aberto
    const [guide, setGuide] = useState(null); // passo cujo guia está aberto
    useEffect(() => {
        if (picking || guideSeen(step)) return undefined;
        const id = setTimeout(() => setGuide(step), 300); // depois de o passo aparecer
        return () => clearTimeout(id);
    }, [step, picking]);
    const closeGuide = useCallback(() => {
        setGuide((g) => { if (g != null) markGuideSeen(g); return null; });
    }, []);
    const firstLesson = c.modules.flatMap((m) => m.lessons)[0]?.key;
    const openFirstLesson = () => { if (firstLesson) setOpenKey((k) => k ?? firstLesson); };

    // "Ver como aluno" fica feito quando o formador abre a pré-visualização (guardado neste browser)
    const previewKey = `ta-visto-aluno-${c.slug ?? 'novo'}`;
    const [previewed, setPreviewed] = useState(() => { try { return !!localStorage.getItem(previewKey); } catch { return false; } });
    const onPreview = () => {
        setPreviewed(true);
        try { localStorage.setItem(previewKey, '1'); } catch { /* ignora */ }
    };
    const ready = readyItems(c, shortMax, previewed);
    const doItem = (item) => {
        setGuide(null);
        goTo(item.step);
        if (item.lesson) {
            setOpenKey(item.lesson);
            // A aula abre depois de o passo aparecer: vai até ela
            setTimeout(() => document.querySelector('[aria-expanded="true"][aria-label]')?.scrollIntoView({ block: 'center' }), 120);
        }
    };

    const publish = async () => {
        if (!(await confirm({
            title: t('Publicar o curso?'),
            body: t('Fica logo visível no catálogo e os alunos podem inscrever-se.'),
            action: t('Publicar'),
        }))) return;
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
        // Num curso publicado, as alterações por publicar não vão para o catálogo: gravam-se depois, já em rascunho
        if (!liveRef.current) await flush();
        router.post(`/formador/cursos/${ulid.current}/rascunho`, {}, {
            preserveScroll: true,
            onSuccess: () => setC((prev) => ({ ...prev, status: 'draft' })),
        });
    };

    // Curso publicado: as alterações só chegam aos alunos aqui, depois de confirmar
    const publishChanges = async () => {
        if (!(await confirm({
            title: t('Publicar as alterações?'),
            body: t('Os alunos passam a ver o curso com estas alterações.'),
            action: t('Publicar alterações'),
        }))) return;
        setPublishing(true);
        const ok = await flush();
        setPublishing(false);
        if (ok) flashDone(t('Alterações publicadas. Os alunos já as veem.'));
    };
    const discardChanges = async () => {
        if (!(await confirm({
            title: t('Descartar as alterações?'),
            body: t('O curso volta a ficar como está publicado. As alterações que não publicaste perdem-se.'),
            action: t('Descartar'),
            danger: true,
        }))) return;
        dirty.current = false;
        clearTimeout(timer.current);
        if (savedCopy.current) setC(structuredClone(savedCopy.current));
        try { localStorage.removeItem(backupKey); } catch { /* ignora */ }
        setSaveError('');
        setSave('saved');
    };
    const [done, setDone] = useState('');
    const doneTimer = useRef(null);
    const flashDone = (msg) => {
        setDone(msg);
        clearTimeout(doneTimer.current);
        doneTimer.current = setTimeout(() => setDone(''), 5000);
    };
    useEffect(() => () => clearTimeout(doneTimer.current), []);
    const { can } = usePage().props;
    const canPublish = !!(can?.['cursos.publicar'] || can?.['cursos.todos']);
    const allReady = checklist(c, shortMax).every((x) => x[2]);

    const doneStep = (i) => checklist(c, shortMax).filter((x) => x[1] === i).every((x) => x[2]);
    const saveLabel = {
        new: t('Começa a preencher. Fica guardado sozinho.'),
        pending: t('Alterações por guardar…'),
        saving: live ? t('A publicar…') : t('A guardar…'),
        saved: live ? t('Publicado · sem alterações por publicar') : t('Rascunho guardado'),
        changes: t('Alterações por publicar. Os alunos ainda veem a versão anterior.'),
        error: saveError,
    }[save];
    const statusLabel = activeUploads.count > 0 && save !== 'error' ? t('A carregar ficheiro… não feches a página.') : saveLabel;

    const startFromModel = (modelId, modules, lessons) => {
        const next = courseFromModel(modelId, modules, lessons, { canAlex: canAlex || canManageAlex });
        setC(next);
        setOpenKey(next.modules[0]?.lessons[0]?.key ?? null);
        setModelName(modelId ? { id: modelId, modules, lessons } : null);
        setPicking(false);
        goTo(modelId ? 1 : 0); // com modelo, abre no Programa já montado
    };

    if (picking) {
        return (
            <StudentLayout>
                <Head title={t('Criar curso')} />
                <TemplatePicker onStart={startFromModel} />
            </StudentLayout>
        );
    }
    const usedModel = modelName && save === 'new' ? MODELS.find((m) => m.id === modelName.id) : null;

    return (
        <StudentLayout>
            <Head title={c.title ? t('Editar · :title', { title: c.title }) : t('Criar curso')} />

            <div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]">
                <aside className="flex gap-1 overflow-x-auto bg-surface p-3 lg:sticky lg:top-[90px] lg:max-h-[calc(100vh-110px)] lg:flex-col lg:overflow-y-auto lg:p-[18px]">
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
                    {/* Publicar: nada chega aos alunos sem carregar aqui (2026-11-26) */}
                    <div className="flex flex-none items-center gap-2 lg:mt-3 lg:flex-col lg:items-stretch">
                        {live ? (
                            <>
                                <button type="button" onClick={publishChanges} disabled={save !== 'changes' && save !== 'error' || publishing}
                                    className="ui-btn ui-btn-accent justify-center whitespace-nowrap disabled:opacity-40">
                                    {publishing ? t('A publicar…') : t('Publicar alterações')}
                                </button>
                                {(save === 'changes' || save === 'error') && (
                                    <button type="button" onClick={discardChanges} className="whitespace-nowrap px-2 py-1 font-display text-[13px] font-semibold text-muted hover:text-live-ink">
                                        {t('Descartar alterações')}
                                    </button>
                                )}
                            </>
                        ) : canPublish ? (
                            <button type="button" onClick={publish} disabled={!allReady || publishing || !ulid.current}
                                title={allReady ? undefined : t('Completa os pontos em falta')}
                                className="ui-btn ui-btn-accent justify-center whitespace-nowrap disabled:opacity-40">
                                {publishing ? t('A publicar…') : t('Publicar curso')}
                            </button>
                        ) : (
                            <p className="hidden text-[12.5px] text-muted lg:block">{t('O teu perfil não publica cursos. Quando estiver pronto, pede a um admin para o publicar.')}</p>
                        )}
                        {done && <p role="status" className="text-[12.5px] font-semibold text-success-ink">{done}</p>}
                        {publishError && <p role="alert" className="text-[12.5px] text-live-ink">{publishError}</p>}
                    </div>
                    <ReadyBox items={ready} onDo={doItem} />
                    <button type="button" onClick={() => setGuide(step)}
                        className="flex-none self-center whitespace-nowrap px-3 py-2 font-display text-[13px] font-semibold text-muted hover:text-ink lg:mt-2 lg:self-start lg:px-0">
                        {t('↺ Ver o guia deste passo')}
                    </button>
                </aside>

                <section className="min-w-0">
                    {uploadError && (
                        <p role="alert" className="mb-3 flex items-start gap-3 bg-live/10 px-4 py-2.5 text-sm text-live-ink">
                            <span className="flex-1">{uploadError}</span>
                            <button type="button" onClick={() => setUploadError('')} className="font-display text-[13px] font-semibold hover:text-ink">{t('Fechar')}</button>
                        </p>
                    )}
                    {usedModel && step === 1 && (
                        <p className="mb-3 flex flex-wrap items-center gap-3 bg-accent/15 px-4 py-3 text-[13.5px]">
                            <span className="flex-1">{t('Programa montado com o modelo :name: :m módulos, :l aulas cada.', { name: t(usedModel.name), m: modelName.modules, l: modelName.lessons })}</span>
                            <button type="button" onClick={() => setPicking(true)} className="font-display text-[13px] font-bold text-accent-ink hover:text-ink">{t('← Escolher outro modelo')}</button>
                        </p>
                    )}
                    {backup && (
                        <p className="mb-3 flex flex-wrap items-center gap-3 bg-accent/15 px-4 py-3 text-[13.5px]">
                            <span className="flex-1">{t('Tens alterações por publicar guardadas neste computador (:date). Os alunos ainda não as veem.', { date: new Date(backup.at).toLocaleString() })}</span>
                            <button type="button" onClick={recoverBackup} className="font-display text-[13px] font-bold text-accent-ink hover:text-ink">{t('Recuperar')}</button>
                            <button type="button" onClick={dropBackup} className="font-display text-[13px] font-semibold text-muted hover:text-live-ink">{t('Descartar')}</button>
                        </p>
                    )}
                    {save === 'error' && (
                        <p role="alert" className="mb-3 bg-live/10 px-4 py-2.5 text-sm text-live-ink">{saveError}</p>
                    )}
                    {step === 0 && <StepInfo c={c} update={update} categories={categories} library={library} shortMax={shortMax} upload={upload} />}
                    {step === 1 && <StepProgram c={c} update={update} upload={upload} openKey={openKey} setOpenKey={setOpenKey} canAlex={canManageAlex || (canAlex && !c.alex_blocked)} />}
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
                            onPreview={onPreview}
                            hasChanges={save === 'changes' || (live && save === 'error')}
                            onPublishChanges={publishChanges}
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
            {guide != null && guide === step && <EditorGuide key={step} steps={guideFor(step, { openFirstLesson })} onClose={closeGuide} />}
        </StudentLayout>
    );
}

function blankFirstLesson(c) {
    return c.modules[0]?.lessons[0]?.key ?? null;
}
