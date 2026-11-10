import { Head, Link, router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Dropdown from '@/Components/Dropdown';
import Logo from '@/Components/Logo';
import ThemeToggle from '@/Components/ThemeToggle';
import VideoPlayer from '@/Components/Learn/VideoPlayer';
import QuizRunner from '@/Components/Learn/QuizRunner';
import QuickChecks from '@/Components/Learn/QuickChecks';
import LessonNotes from '@/Components/Learn/LessonNotes';
import { ModulesRail, ModuleSheet, ModulesStrip } from '@/Components/Learn/LessonModules';
import { IconCheck, IconDoc, IconDown, IconHelp, IconLeft, IconPen, IconRight, IconSide, IconUser, IconVideo, IconX } from '@/Components/Learn/LessonIcons';
import { FlashToast } from '@/Components/Teams/ui';
import '../../../css/lesson.css';

import { t } from '@/i18n';

const MIN_PANEL = 20; // nenhum painel fica com menos de 20%
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const isVideoType = (tx) => tx === 'video_link' || tx === 'video_upload';
const isPdf = (a) => /\.pdf$/i.test(a.url);

// O aluno mantém os painéis e os tamanhos ao passar de aula (até recarregar a página)
const memory = { material: true, notes: true, rail: false, splitX: null, splitR: 55, splitL: 55, splitRow: 60, splitM: 38 };

function useMobile() {
    const query = '(max-width: 767px)';
    const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const mq = window.matchMedia(query);
        const onChange = () => setMobile(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    return mobile;
}

// Divisória entre dois painéis: arrastar, ou setas do teclado (2% de cada vez)
function Split({ dir, shown, value, min = MIN_PANEL, onChange, boxOf }) {
    if (!shown) return null;
    const across = dir === 'v';
    const down = (e) => {
        e.preventDefault();
        const el = e.currentTarget;
        const box = (boxOf ? boxOf() : el.parentElement).getBoundingClientRect();
        const root = document.documentElement.classList;
        el.classList.add('on');
        root.add('al-dragging', across ? 'dx' : 'dy');
        const move = (ev) => onChange(across ? (ev.clientX - box.left) / box.width * 100 : (ev.clientY - box.top) / box.height * 100);
        const up = () => {
            el.classList.remove('on');
            root.remove('al-dragging', 'dx', 'dy');
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };
    const key = (e) => {
        const d = (across ? { ArrowLeft: -2, ArrowRight: 2 } : { ArrowUp: -2, ArrowDown: 2 })[e.key];
        if (!d) return;
        e.preventDefault();
        onChange(value + d);
    };
    return (
        <div className={`al-split ${dir}`} role="separator" tabIndex={0} aria-orientation={across ? 'vertical' : 'horizontal'} aria-label={t('Arrastar para redimensionar')}
            aria-valuemin={min} aria-valuemax={100 - min} aria-valuenow={Math.round(value)} onPointerDown={down} onKeyDown={key} />
    );
}

const clampSplit = (v) => Math.max(MIN_PANEL, Math.min(100 - MIN_PANEL, v));

// Página da aula: painéis que se ligam e desligam na barra de baixo, com divisórias para os redimensionar.
// A aula conclui-se sozinha: o vídeo aos 90%; documento, texto e avatar ao abrir; o teste ao passar.
export default function Lesson({ course, mode, program, lesson, position, progress, prev, next, avatarUrl, notes }) {
    const mobile = useMobile();
    const canSave = mode === 'enrolled';
    const done = progress.status === 'completed';
    const videoLesson = isVideoType(lesson.type);
    const hasPlayer = videoLesson && !!lesson.video;
    const lessonUrl = (ulid) => `/plataforma/cursos/${course.slug}/aulas/${ulid}`;

    const player = useRef(null);
    const stage = useRef(null);
    const [watched, setWatched] = useState(progress.watched);
    const [needed, setNeeded] = useState(progress.needed);
    const [checks, setChecks] = useState(lesson.checks);

    const hasChecks = hasPlayer && checks.length > 0;
    const videoReady = !hasPlayer || done || needed <= 0 || watched >= needed;
    const checksDone = checks.every((c) => c.chosen != null);

    // Painéis
    const [showVideo, setShowVideo] = useState(hasPlayer);
    const [showMaterial, setShowMaterial] = useState(() => {
        if (!hasPlayer) return true;
        return !mobile && memory.material && lesson.attachments.length > 0;
    });
    const [showNotes, setShowNotes] = useState(() => (mobile ? hasPlayer : memory.notes));
    const [showChecks, setShowChecks] = useState(false);
    const [ask, setAsk] = useState(false);
    const [askStarted, setAskStarted] = useState(false);
    const [evaluation, setEvaluation] = useState(null); // null | 'intro' | 'run'
    const beforeEvaluation = useRef(null);
    const [menu, setMenu] = useState(null);
    const [rail, setRail] = useState(memory.rail);
    const [minBar, setMinBar] = useState(false);
    const [sheet, setSheet] = useState(null);
    const [attachment, setAttachment] = useState(0);

    // Tamanhos das divisórias, em %
    const [splitX, setSplitX] = useState(memory.splitX);
    const [splitR, setSplitR] = useState(memory.splitR);
    const [splitL, setSplitL] = useState(memory.splitL);
    const [splitRow, setSplitRow] = useState(memory.splitRow);
    const [splitM, setSplitM] = useState(memory.splitM);

    useEffect(() => {
        Object.assign(memory, { material: showMaterial, notes: showNotes, rail, splitX, splitR, splitL, splitRow, splitM });
    }, [showMaterial, showNotes, rail, splitX, splitR, splitL, splitRow, splitM]);

    // No telemóvel só cabe um painel em baixo: material ou notas
    useEffect(() => { if (mobile && showMaterial && showNotes) setShowMaterial(false); }, [mobile]); // eslint-disable-line react-hooks/exhaustive-deps

    // Ao chegar aos 90% as perguntas rápidas aparecem por cima do material; são opcionais e fecham-se
    const wasReady = useRef(videoReady);
    useEffect(() => {
        if (videoReady && !wasReady.current && hasChecks && !checksDone) {
            setShowChecks(true);
            if (mobile) setShowNotes(false);
        }
        wasReady.current = videoReady;
    }, [videoReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // Conclusão automática: o servidor confirma e a página pede o programa e a aula seguinte atualizados
    const refresh = useCallback(() => {
        router.reload({ only: ['program', 'course', 'next', 'progress', 'flash'] });
    }, []);
    const finishing = useRef(false);
    const onSaved = useCallback((data) => {
        finishing.current = false;
        if (data.completed) refresh();
    }, [refresh]);
    useEffect(() => {
        if (!canSave || done || !hasPlayer || watched <= 0 || !videoReady || finishing.current) return;
        finishing.current = true;
        player.current?.flush();
    }, [canSave, done, hasPlayer, watched, videoReady]);

    const pauseVideo = () => player.current?.pause();
    const toggleVideo = () => {
        if (showVideo) pauseVideo();
        setShowVideo(!showVideo);
    };
    const toggleMaterial = () => {
        if (!showMaterial && mobile) setShowNotes(false);
        setShowMaterial(!showMaterial);
    };
    const toggleNotes = () => {
        if (!showNotes && mobile) { setShowMaterial(false); setShowChecks(false); }
        setShowNotes(!showNotes);
    };
    const openAsk = () => {
        setAsk(true);
        setAskStarted(true);
        pauseVideo(); // o vídeo fica em pausa enquanto o aluno fala com o avatar
    };
    const seekTo = (s) => {
        setShowVideo(true);
        player.current?.seek(s);
    };

    const startEvaluation = () => {
        beforeEvaluation.current = { video: showVideo, material: showMaterial, notes: showNotes, checks: showChecks };
        pauseVideo();
        setShowVideo(false); setShowMaterial(false); setShowNotes(false); setShowChecks(false); setAsk(false); setRail(false); setSheet(null);
        setEvaluation('run');
    };
    const endEvaluation = () => {
        const p = beforeEvaluation.current;
        if (p) { setShowVideo(p.video); setShowMaterial(p.material); setShowNotes(p.notes); setShowChecks(p.checks); }
        setEvaluation(null);
    };

    // Menus: fecham com Esc ou ao carregar fora
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            setMenu(null);
            setEvaluation((v) => (v === 'intro' ? null : v));
            setSheet(null);
        };
        const onDown = (e) => { if (!e.target.closest?.('.al-menu, [data-menu]')) setMenu(null); };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onDown);
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
    }, []);

    const running = evaluation === 'run';
    const videoOn = hasPlayer && showVideo;
    const avatarOn = ask || running;
    const materialOn = showMaterial && !showChecks;
    const hasLeft = videoOn || avatarOn;
    const rightItems = (materialOn || showChecks ? 1 : 0) + (showNotes ? 1 : 0);
    const hasRight = rightItems > 0;
    const asRow = !hasLeft && rightItems === 2 && !mobile;
    const leftPct = splitX ?? ((rightItems === 2 || showNotes) ? 62 : 50);
    const leftGrow = !hasLeft ? 0 : !hasRight ? 1 : leftPct;
    const rightGrow = !hasRight ? 0 : !hasLeft ? 1 : 100 - leftPct;
    const topGrow = asRow ? splitRow : splitR;

    // Posição da aula: 3.4 = módulo 3, aula 4
    const numOf = (ulid) => {
        for (let mi = 0; mi < program.length; mi++) {
            const li = program[mi].lessons.findIndex((l) => l.ulid === ulid);
            if (li >= 0) return `${mi + 1}.${li + 1}`;
        }
        return '';
    };
    const moduleOfLesson = program.find((m) => m.lessons.some((l) => l.current));
    const currentPct = done ? 100 : hasPlayer && needed > 0 ? Math.min(100, Math.round(watched / needed * 90)) : 0;
    const hint = !canSave || done || lesson.type === 'quiz' || !hasPlayer
        ? null
        : !videoReady ? t('Faltam :v1 de vídeo', { v1: fmt(needed - watched) }) : null;
    const nextOpen = next?.open && !running;
    const prevOpen = prev && !running;

    // Barra de cima de cada painel: escolher o que mostrar e fechar
    const panelBar = (slot, icon, dark = false) => {
        const shown = { video: videoOn, material: materialOn, notes: showNotes, ask: avatarOn };
        const options = [['video', <IconVideo key="i" />, t('Vídeo')], ['material', <IconDoc key="i" />, t('Material')], ['notes', <IconPen key="i" />, t('Notas')], ['ask', <IconUser key="i" />, t('Avatar')]];
        const pick = (k) => {
            setMenu(null);
            if (k === 'video') setShowVideo(true);
            if (k === 'material' && !showMaterial) toggleMaterial();
            if (k === 'notes' && !showNotes) toggleNotes();
            if (k === 'ask') openAsk();
        };
        const close = () => {
            if (slot === 'video') toggleVideo();
            if (slot === 'material') toggleMaterial();
            if (slot === 'notes') toggleNotes();
            if (slot === 'ask') setAsk(false);
        };
        return (
            <>
                <div className={`al-tb ${dark ? 'dark' : ''} ${menu === slot ? 'pin' : ''}`}>
                    <button type="button" className="al-tb-b" data-menu aria-label={t('Escolher o que mostrar neste painel')} aria-expanded={menu === slot} onClick={() => setMenu(menu === slot ? null : slot)}>{icon}<IconDown /></button>
                    <span className="sp" />
                    {!(slot === 'ask' && running) && <button type="button" className="al-tb-b" aria-label={t('Fechar painel')} onClick={close}><IconX /></button>}
                </div>
                {menu === slot && (
                    <div className="al-menu">
                        {options.map(([k, ic, label]) => (
                            <button type="button" key={k} disabled={k === 'video' && !hasPlayer} onClick={() => pick(k)}>
                                {ic}{label}{k === slot ? <small><IconCheck /></small> : shown[k] ? <small>{t('noutro painel')}</small> : null}
                            </button>
                        ))}
                    </div>
                )}
            </>
        );
    };

    const tools = (
        <div className="al-tools" role="group" aria-label={t('O que mostrar')}>
            <button type="button" className="al-sw" data-tip={t('Vídeo')} aria-label={t('Vídeo')} aria-pressed={videoOn} disabled={!hasPlayer} onClick={toggleVideo}><IconVideo /></button>
            <button type="button" className="al-sw" data-tip={t('Material')} aria-label={t('Material')} aria-pressed={showMaterial} onClick={toggleMaterial}><IconDoc /></button>
            <button type="button" className="al-sw" data-tip={t('Notas')} aria-label={t('Notas')} aria-pressed={showNotes} onClick={toggleNotes}><IconPen /></button>
            <span className="div" />
            <button type="button" className={`al-ev ${evaluation ? 'on' : ''}`} onClick={() => { if (!running) { setEvaluation(evaluation ? null : 'intro'); setSheet(null); } }}><IconUser />{t('Avaliação')}</button>
        </div>
    );

    const viewer = (lesson.type === 'document' || hasPlayer) && lesson.attachments[attachment] && isPdf(lesson.attachments[attachment]) ? lesson.attachments[attachment] : null;

    return (
        <div className="al" style={{ '--al-split': `${splitM}%` }}>
            <Head title={`${lesson.title} · ${course.title}`} />

            <header className="al-head">
                <Link className="al-logo" href={`/plataforma/cursos/${course.slug}`} aria-label={t('Voltar ao curso :title', { title: course.title })}>
                    <span className="al-logo-full"><Logo /></span>
                    <img className="al-logo-bird" src="/images/brand/passarinho.png" alt="" />
                </Link>
                <div className="al-head-t">
                    <span className="n">{numOf(lesson.ulid)}</span>
                    <b>{moduleOfLesson?.title}</b>
                    <small>{lesson.title}</small>
                </div>
                <div className="al-head-ic">
                    <a className="al-ic" href="/plataforma/contactos" target="_blank" rel="noopener noreferrer" aria-label={t('Ajuda (abre os contactos num separador novo)')}><IconHelp /></a>
                    <ThemeToggle className="!h-8 !w-8 !border-0 hover:bg-surface2" />
                    <Dropdown>
                        <Dropdown.Trigger>
                            <button type="button" className="al-ic" aria-label={t('Menu da conta')}><IconUser size={18} /></button>
                        </Dropdown.Trigger>
                        <Dropdown.Content>
                            <Dropdown.Link href="/dashboard">{t('Início')}</Dropdown.Link>
                            <Dropdown.Link href="/definicoes">{t('Definições')}</Dropdown.Link>
                            <Dropdown.Link href="/plataforma/contactos">{t('Contactos')}</Dropdown.Link>
                            <Dropdown.Link href="/logout" method="post" as="button">{t('Terminar sessão')}</Dropdown.Link>
                        </Dropdown.Content>
                    </Dropdown>
                </div>
            </header>

            {mode !== 'enrolled' ? (
                <p className="al-mode">{mode === 'preview' ? t('Pré-visualização (vista do aluno): o progresso não é guardado.') : t('Aula de amostra grátis: inscreve-te no curso para guardar o progresso.')}</p>
            ) : <span />}

            <div className="al-body">
                {!mobile && <ModulesRail open={rail} slug={course.slug} program={program} percent={course.percent} currentPct={currentPct} />}

                <main className="al-stage" ref={stage}>
                    <div className={`al-col left ${hasLeft ? '' : 'none'} ${hasRight ? '' : 'full'}`} style={{ flexGrow: leftGrow }}>
                        {/* Avatar: o iframe fica montado depois de aberto, para não perder a conversa */}
                        <section className={`al-panel al-a ${avatarOn ? '' : 'off'}`} aria-label={t('Avatar')} style={{ flexGrow: splitL }}>
                            {panelBar('ask', <IconUser />, true)}
                            {running && <button type="button" className="al-a-end" onClick={endEvaluation}>{t('Terminar')}</button>}
                            {running ? (
                                <div className="al-a-stage">
                                    <span className="al-orb" aria-hidden="true" />
                                    <p>{t('O teste final com o avatar fica disponível em breve.')}</p>
                                </div>
                            ) : avatarUrl ? (
                                askStarted && <iframe src={avatarUrl} title={t('Perguntar ao avatar')} allow="microphone; camera; autoplay" />
                            ) : (
                                <div className="al-a-stage">
                                    <span className="al-orb" aria-hidden="true" />
                                    <p>{t('Este curso ainda não tem avatar para tirar dúvidas.')}</p>
                                </div>
                            )}
                        </section>
                        <Split dir="h" shown={avatarOn && videoOn} value={splitL} onChange={(v) => setSplitL(clampSplit(v))} />
                        {hasPlayer && (
                            <section className={`al-panel al-v ${videoOn ? '' : 'off'}`} aria-label={t('Vídeo')} style={{ flexGrow: 100 - splitL }}>
                                {panelBar('video', <IconVideo />, true)}
                                <VideoPlayer ref={player} key={lesson.ulid} source={lesson.video} lessonUlid={lesson.ulid} initial={progress} canSave={canSave}
                                    onWatched={(w, d) => { setWatched(w); if (d) setNeeded(Math.ceil(d * 0.9)); }} onSaved={onSaved} />
                            </section>
                        )}
                    </div>

                    {hasLeft && hasRight && (
                        <div className="al-handle" role="separator" aria-label={t('Arrastar para mudar o tamanho')} onPointerDown={(e) => {
                            const box = stage.current.getBoundingClientRect();
                            const move = (ev) => setSplitM(Math.max(22, Math.min(72, (ev.clientY - box.top) / box.height * 100)));
                            const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
                            e.preventDefault();
                            window.addEventListener('pointermove', move);
                            window.addEventListener('pointerup', up);
                        }} />
                    )}
                    <Split dir="v" shown={hasLeft && hasRight} value={leftPct} onChange={(v) => setSplitX(clampSplit(v))} boxOf={() => stage.current} />

                    <div className={`al-col right ${hasRight ? '' : 'none'} ${asRow ? 'row' : ''}`} style={{ flexGrow: rightGrow }}>
                        {hasChecks && (
                            <section className={`al-panel al-c ${showChecks ? '' : 'off'}`} aria-label={t('Perguntas rápidas')} style={{ flexGrow: topGrow }}>
                                <div className="al-tb pin">
                                    <span className="sp" />
                                    <button type="button" className="al-tb-b" aria-label={t('Fechar perguntas')} onClick={() => setShowChecks(false)}><IconX /></button>
                                </div>
                                <div className="al-c-scroll">
                                    <div className="al-c-card">
                                        <small>{t('Perguntas rápidas')}</small>
                                        <h2>{checksDone ? t('Respondidas.') : t('Queres testar o que viste?')}</h2>
                                        <QuickChecks lessonUlid={lesson.ulid} checks={checks} canSave={canSave} onChange={setChecks} onCompleted={refresh} />
                                    </div>
                                </div>
                            </section>
                        )}
                        <section className={`al-panel al-m ${materialOn ? '' : 'off'}`} aria-label={t('Material')} style={{ flexGrow: topGrow }}>
                            {panelBar('material', <IconDoc />)}
                            {lesson.type === 'quiz' && lesson.quiz ? (
                                <div className="al-m-scroll"><div className="al-card flush">
                                    <QuizRunner key={lesson.ulid} lessonUlid={lesson.ulid} quiz={lesson.quiz} canSave={canSave} />
                                </div></div>
                            ) : viewer ? (
                                <iframe className="al-pdf" src={`${viewer.url}#view=FitH`} title={viewer.name} />
                            ) : (
                                <div className="al-m-scroll"><div className="al-card">
                                    <h2>{lesson.title}</h2>
                                    {lesson.type === 'text' && (lesson.body ?? '').split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                                    {lesson.type === 'avatar' && (
                                        <div className="al-avatar-card">
                                            <span className="al-orb !w-24" aria-hidden="true" />
                                            {lesson.url
                                                ? <a href={lesson.url} target="_blank" rel="noopener noreferrer" className="al-pill">{t('Abrir avatar ↗')}</a>
                                                : <p>{t('O link do avatar ainda não foi configurado.')}</p>}
                                        </div>
                                    )}
                                    {lesson.type !== 'text' && lesson.type !== 'avatar' && (
                                        <p>{lesson.attachments.length ? t('Os ficheiros desta aula estão aqui em baixo.') : t('Esta aula não tem material de apoio.')}</p>
                                    )}
                                </div></div>
                            )}
                            {lesson.attachments.length > 0 && (
                                <div className="al-m-foot">
                                    {lesson.attachments.map((a, i) => (
                                        <a key={a.url} className={`al-file ${viewer === a ? 'on' : ''}`} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name}
                                            onClick={(e) => { if ((lesson.type === 'document' || hasPlayer) && isPdf(a) && viewer !== a) { e.preventDefault(); setAttachment(i); } }}>
                                            {a.name} ⭳
                                        </a>
                                    ))}
                                </div>
                            )}
                        </section>
                        <Split dir={asRow ? 'v' : 'h'} shown={rightItems === 2} value={topGrow} onChange={(v) => (asRow ? setSplitRow : setSplitR)(clampSplit(v))} />
                        <section className={`al-panel al-n ${asRow ? 'side' : ''} ${showNotes ? '' : 'off'}`} aria-label={t('Notas')} style={{ flexGrow: 100 - topGrow }}>
                            {panelBar('notes', <IconPen />)}
                            <LessonNotes key={lesson.ulid} lessonUlid={lesson.ulid} title={t('Notas da aula :v1', { v1: numOf(lesson.ulid) })} initial={notes} canSave={canSave}
                                hasVideo={hasPlayer} getTime={() => player.current?.time() ?? 0} onSeek={seekTo} />
                        </section>
                    </div>

                    {!hasLeft && !hasRight && !evaluation && <p className="al-empty">{t('Liga um painel na barra de baixo para continuar.')}</p>}

                    {evaluation === 'intro' && (
                        <div className="al-intro" role="dialog" aria-modal="true" aria-label={t('Vai começar a avaliação')}>
                            <button type="button" className="al-tb-b x" aria-label={t('Fechar')} onClick={() => setEvaluation(null)}><IconX /></button>
                            <div>
                                <h2>{t('Vai começar a avaliação.')}</h2>
                                <p>{t('O teste final é feito com o avatar. Podes usar o microfone para responder às perguntas ou escrever a tua resposta.')}</p>
                                <div className="bs">{t('Boa sorte!')}</div>
                                <button type="button" className="al-pill" onClick={startEvaluation}>{t('Continuar')}</button>
                            </div>
                        </div>
                    )}

                    {mobile && sheet != null && (
                        <ModuleSheet slug={course.slug} module={program[sheet]} index={sheet} currentPct={currentPct} onClose={() => setSheet(null)} />
                    )}
                </main>
            </div>

            {mobile ? (
                <footer className={`al-foot ${minBar ? 'min' : ''} ${sheet != null ? 'sheeting' : ''}`}>
                    <button type="button" className="al-chev" aria-label={minBar ? t('Mostrar comandos') : t('Esconder comandos')} onClick={() => setMinBar(!minBar)}><IconDown /></button>
                    <div className="al-tools-row">
                        {prevOpen
                            ? <Link className="al-nav-m" href={lessonUrl(prev.ulid)} aria-label={t('Aula anterior')}><IconLeft /><span>{numOf(prev.ulid)}</span></Link>
                            : <button type="button" className="al-nav-m" disabled aria-label={t('Aula anterior')}><IconLeft /><span>{prev ? numOf(prev.ulid) : ''}</span></button>}
                        {tools}
                        {nextOpen
                            ? <Link className="al-nav-m" href={lessonUrl(next.ulid)} aria-label={t('Aula seguinte')}><IconRight /><span>{numOf(next.ulid)}</span></Link>
                            : <button type="button" className="al-nav-m" disabled aria-label={t('Aula seguinte')}><IconRight /><span>{next ? numOf(next.ulid) : ''}</span></button>}
                    </div>
                    <ModulesStrip program={program} sheet={sheet} onPick={setSheet} />
                </footer>
            ) : (
                <footer className="al-foot">
                    <div className="al-f-l">
                        <button type="button" className={`al-f-b ${rail ? 'on' : ''}`} disabled={running} aria-expanded={rail} onClick={() => setRail(!rail)}><IconSide />{t('Módulos')}</button>
                        <span className="al-f-sep" />
                        {prevOpen
                            ? <Link className="al-f-b" href={lessonUrl(prev.ulid)} aria-label={t('Aula anterior')} title={prev.title}><IconLeft /><span className="num">{numOf(prev.ulid)}</span></Link>
                            : <button type="button" className="al-f-b" disabled aria-label={t('Aula anterior')}><IconLeft /><span className="num">{prev ? numOf(prev.ulid) : ''}</span></button>}
                    </div>
                    {tools}
                    <div className="al-f-r">
                        {done && <span className="al-done"><IconCheck />{' '}{t('Concluída')}</span>}
                        {hint && <span className="al-f-hint">{hint}</span>}
                        {nextOpen
                            ? <Link className="al-f-b" href={lessonUrl(next.ulid)} aria-label={t('Aula seguinte')} title={next.title}><span className="num">{numOf(next.ulid)}</span><IconRight /></Link>
                            : <button type="button" className="al-f-b" disabled aria-label={t('Aula seguinte')} title={next && !next.open ? t('Inscreve-te no curso para abrir esta aula') : undefined}><span className="num">{next ? numOf(next.ulid) : ''}</span><IconRight /></button>}
                    </div>
                </footer>
            )}
            <FlashToast />
        </div>
    );
}
