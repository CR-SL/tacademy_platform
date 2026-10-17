import { Head, Link, router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import StepInfo from '@/Components/CourseBuilder/StepInfo';
import StepProgram from '@/Components/CourseBuilder/StepProgram';
import StepPrice from '@/Components/CourseBuilder/StepPrice';
import StepReview from '@/Components/CourseBuilder/StepReview';
import { blankCourse, checklist } from '@/Components/CourseBuilder/model';

const STEPS = [
    ['Informação', 'Título, área, capa'],
    ['Programa', 'Módulos e aulas'],
    ['Preço e acesso', 'Preço, certificado'],
    ['Rever e publicar', 'Pré-visualizar'],
];
const SAVE_DELAY = 1200;

// Editor de cursos dos formadores: assistente em 4 passos que se guarda sozinho.
export default function CourseEditor({ course, categories, library, shortMax }) {
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
                const { modules, lessons, slug } = res.data;
                if (!ulid.current) {
                    ulid.current = res.data.ulid;
                    // o endereço passa a ser o do curso, para um refresh não criar outro
                    window.history.replaceState(window.history.state, '', `/formador/cursos/${ulid.current}/editar`);
                }
                // ids dos módulos/aulas novos (sem marcar como alteração)
                setC((prev) => ({
                    ...prev,
                    ulid: ulid.current,
                    slug,
                    modules: prev.modules.map((m) => ({
                        ...m,
                        id: m.id ?? modules[m.key] ?? null,
                        lessons: m.lessons.map((l) => ({ ...l, id: l.id ?? lessons[l.key] ?? null })),
                    })),
                }));
                setSaveError('');
                setSave(dirty.current ? 'pending' : 'saved');
                return true;
            } catch (e) {
                dirty.current = true;
                setSave('error');
                setSaveError(e.response?.status === 422
                    ? Object.values(e.response.data.errors ?? {})[0]?.[0] ?? 'Há um campo inválido.'
                    : 'Sem ligação ao servidor. Vamos tentar de novo.');
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
        const t = setTimeout(flush, 5000);
        return () => clearTimeout(t);
    }, [save, flush]);

    // Avisar antes de sair com alterações por gravar
    useEffect(() => {
        const warn = (e) => {
            if (dirty.current || inFlight.current) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', warn);
        const off = router.on('before', (e) => {
            if (e.detail.visit.method !== 'get' || !(dirty.current || inFlight.current)) return;
            e.preventDefault();
            flush().then((ok) => ok && router.visit(e.detail.visit.url));
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
                ? Object.values(e.response.data.errors ?? {})[0]?.[0] ?? 'Ficheiro inválido.'
                : e.response?.status === 413 ? 'O ficheiro é demasiado grande.' : 'Não foi possível carregar o ficheiro.');
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
        if (!ok || !ulid.current) { setPublishing(false); setPublishError('Não foi possível guardar antes de publicar.'); return; }
        router.post(`/formador/cursos/${ulid.current}/publicar`, {}, {
            onError: (errors) => setPublishError(errors.publish ?? 'Não foi possível publicar.'),
            onFinish: () => setPublishing(false),
        });
    };

    const unpublish = async () => {
        if (!confirm('Passar o curso a rascunho? Sai do catálogo até voltar a publicar.')) return;
        await flush();
        router.post(`/formador/cursos/${ulid.current}/rascunho`, {}, {
            preserveScroll: true,
            onSuccess: () => setC((prev) => ({ ...prev, status: 'draft' })),
        });
    };

    const doneStep = (i) => checklist(c, shortMax).filter((x) => x[1] === i).every((x) => x[2]);
    const saveLabel = {
        new: 'Começa a preencher — guarda sozinho',
        pending: 'Alterações por guardar…',
        saving: 'A guardar…',
        saved: c.status === 'published' ? 'Guardado · publicado' : 'Rascunho guardado',
        error: saveError,
    }[save];

    return (
        <StudentLayout>
            <Head title={c.title ? `Editar · ${c.title}` : 'Criar curso'} />

            <div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]">
                <aside className="ta-cut-12 flex gap-1 overflow-x-auto bg-surface p-3 lg:sticky lg:top-[90px] lg:flex-col lg:p-[18px]">
                    <Link href="/formador/cursos" className="mb-3 hidden items-center gap-1.5 font-display text-[13px] font-semibold text-muted hover:text-ink lg:inline-flex">
                        ← Os meus cursos
                    </Link>
                    {STEPS.map(([title, sub], i) => {
                        const done = i !== step && i < 3 && doneStep(i);
                        return (
                            <button
                                key={title}
                                type="button"
                                onClick={() => goTo(i)}
                                aria-current={i === step ? 'step' : undefined}
                                className={`flex flex-none items-center gap-3 p-2 text-left lg:w-full lg:p-2.5 ${i === step ? 'bg-page' : 'hover:bg-page/60'}`}
                            >
                                <span className={`ta-cut-8 flex h-[30px] w-[30px] flex-none items-center justify-center font-display text-sm font-bold ${
                                    i === step ? 'bg-accent text-on-accent' : done ? 'bg-ink text-accent' : 'bg-surface2 text-muted'
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
                        <i className={`h-2 w-2 flex-none rounded-full ${save === 'error' ? 'bg-live' : save === 'saved' ? 'bg-[#2F9E5B]' : save === 'new' ? 'bg-track' : 'bg-accent'}`} />
                        <span className={save === 'error' ? 'text-live' : ''}>{saveLabel}</span>
                    </div>
                </aside>

                <section className="min-w-0">
                    {save === 'error' && (
                        <p role="alert" className="ta-cut-8 mb-3 bg-live/10 px-4 py-2.5 text-sm text-live lg:hidden">{saveError}</p>
                    )}
                    {step === 0 && <StepInfo c={c} update={update} categories={categories} library={library} shortMax={shortMax} upload={upload} />}
                    {step === 1 && <StepProgram c={c} update={update} upload={upload} openKey={openKey} setOpenKey={setOpenKey} />}
                    {step === 2 && <StepPrice c={c} update={update} />}
                    {step === 3 && (
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
                            <button type="button" onClick={() => goTo(step - 1)} className="ta-cut-8 ta-press bg-surface px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em]">
                                ← Anterior
                            </button>
                        ) : <span />}
                        {step < 3 && (
                            <button type="button" onClick={() => goTo(step + 1)} className="ta-cut-8 ta-press bg-ink px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-accent">
                                Seguinte →
                            </button>
                        )}
                    </div>
                </section>
            </div>
        </StudentLayout>
    );
}

function blankFirstLesson(c) {
    return c.modules[0]?.lessons[0]?.key ?? null;
}
