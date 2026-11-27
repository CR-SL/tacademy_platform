import { Head, Link, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Dropdown from '@/Components/Dropdown';
import Logo from '@/Components/Logo';
import ThemeToggle from '@/Components/ThemeToggle';
import VideoPlayer from '@/Components/Learn/VideoPlayer';
import QuizRunner from '@/Components/Learn/QuizRunner';
import QuickChecks from '@/Components/Learn/QuickChecks';
import LessonNotes from '@/Components/Learn/LessonNotes';
import MicCheck from '@/Components/Learn/MicCheck';
import { ModulesRail, ModuleSheet, ModulesStrip } from '@/Components/Learn/LessonModules';
import { IconCheck, IconDoc, IconDown, IconDownload, IconHelp, IconLeft, IconPen, IconRight, IconSide, IconSwap, IconUser, IconVideo, IconX } from '@/Components/Learn/LessonIcons';
import { FlashToast, Toast, useFocusTrap } from '@/Components/ui';
import AlexLessonPanel, { AlexActivityPanel, AlexEvaluationPanel, endEvaluationCall, startEvaluationCall } from '@/Components/Alex/AlexLessonPanel';
import { PlatformNav } from '@/Layouts/StudentLayout';
import '../../../css/lesson.css';

import { t } from '@/i18n';

const MIN_PANEL = 20; // nenhum painel fica com menos de 20%
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

// Tempo do teste final com o avatar (2026-11-11): 10 minutos
const EVALUATION_MIN = 10;

// Botão Terminar com o tempo que falta; conta sozinho para não redesenhar a aula a cada segundo e termina aos 0:00
function EvaluationEnd({ endsAt, onEnd }) {
    const left = () => Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    const [secs, setSecs] = useState(left);
    useEffect(() => {
        const id = setInterval(() => {
            const s = left();
            setSecs(s);
            if (s <= 0) { clearInterval(id); onEnd(); }
        }, 1000);
        return () => clearInterval(id);
    }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps
    const low = secs <= 120;
    return (
        <button type="button" className={`al-a-end ${low ? 'low' : ''}`} onClick={onEnd}
            aria-label={t('Terminar a avaliação (faltam :time)', { time: fmt(secs) })}>
            {t('Terminar')}<span className="al-a-time" aria-hidden="true">{fmt(secs)}</span>
        </button>
    );
}
const isVideoType = (tx) => tx === 'video_link' || tx === 'video_upload';
const isPdf = (a) => /\.pdf$/i.test(a.url);
const fileExt = (a) => (a.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toUpperCase();
const fileSize = (b) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

// O aluno mantém os painéis e os tamanhos ao passar de aula (até recarregar a página)
// place: em que lugar está cada painel (L1/L2 à esquerda, R1/R2 à direita; 1 em cima, 2 em baixo)
const PLACES = { ask: 'L1', video: 'L2', material: 'R1', notes: 'R2' };
// video/ask: o vídeo e o Alex ficam abertos ou fechados como o aluno os deixou, também ao mudar de módulo (2026-11-16)
const memory = { video: true, ask: false, material: true, notes: true, rail: false, splitX: null, splitR: 55, splitL: 55, splitRow: 60, splitM: 38, place: PLACES };

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
export default function Lesson({ course, mode, program, lesson, progress, prev, next, notes, finalEvaluation = { mode: 'none', quiz: null }, avatarTest = null, avatarTests = [] }) {
    const mobile = useMobile();
    const { alex: alexProp } = usePage().props; // o Alex neste curso (curso com o Alex), ou null
    // O que o formador ligou nesta aula (2026-11-25): vídeo, material, notas, avatar; e a avaliação
    const parts = lesson.parts ?? [];
    const evalKind = lesson.evaluation ?? (lesson.type === 'quiz' ? 'quiz' : 'none');
    // O avatar de ajuda (curso com o avatar ligado): tirar dúvidas nesta aula
    const askAlex = alexProp?.help && parts.includes('avatar') ? alexProp : null;
    // Teste com avatar ou roleplay (fase 2): faz-se na caixa do avatar, que abre logo
    const activity = lesson.activity ?? null;
    const avatarHere = parts.includes('avatar') || !!activity;
    const finalMode = finalEvaluation?.mode ?? 'none';
    const canSave = mode === 'enrolled';
    const done = progress.status === 'completed';
    const videoLesson = lesson.parts ? parts.includes('video') : isVideoType(lesson.type);
    const hasPlayer = videoLesson && !!lesson.video;
    const lessonUrl = (ulid) => `/plataforma/cursos/${course.slug}/aulas/${ulid}`;

    const player = useRef(null);
    const stage = useRef(null);
    const [watched, setWatched] = useState(progress.watched);
    const [needed, setNeeded] = useState(progress.needed);
    const [checks, setChecks] = useState(lesson.checks);

    const hasChecks = hasPlayer && checks.length > 0;
    // Página adaptável (2026-11-26): só aparecem os painéis do que a aula tem
    const bodyText = activity ? null : lesson.body;
    const materialWorth = !!bodyText || lesson.attachments.length > 0 || (evalKind === 'quiz' && !!lesson.quiz)
        || (hasPlayer && lesson.checks.length > 0);
    const avatarOnly = !!activity || (avatarHere && !hasPlayer && !materialWorth); // atividade com avatar ou aula só com o avatar: abre logo o avatar
    const nothing = !hasPlayer && !materialWorth && !avatarHere; // sem conteúdo: ficam as notas do aluno
    // Sem os minutos do formador o vídeo não conclui a aula (o servidor recusa): fica o aviso em baixo
    const videoReady = !hasPlayer || done || (!progress.noDuration && watched >= needed);
    const checksDone = checks.every((c) => c.chosen != null);

    // Painéis
    // Abrem como o aluno os deixou na aula anterior (sem nenhum aberto, o vídeo abre)
    const [showVideo, setShowVideo] = useState(() => hasPlayer && (memory.video || !(memory.material || memory.notes || (askAlex && memory.ask))));
    const [showMaterial, setShowMaterial] = useState(() => {
        if (!materialWorth) return false;
        if (!hasPlayer) return true;
        return !mobile && memory.material;
    });
    const [showNotes, setShowNotes] = useState(() => nothing || (!avatarOnly && (mobile ? hasPlayer : memory.notes)));
    const [showChecks, setShowChecks] = useState(false);
    const [ask, setAsk] = useState(() => avatarOnly || (!!askAlex && !mobile && memory.ask));
    const [evaluation, setEvaluation] = useState(null); // null | 'intro' | 'run'
    const beforeEvaluation = useRef(null);
    const introBox = useRef(null);
    // O aviso antes da avaliação é uma janela: o foco vai para dentro e o Tab não sai (Esc fecha-o, mais abaixo)
    useFocusTrap(introBox, { active: evaluation === 'intro' });
    const [endsAt, setEndsAt] = useState(0);
    const [menu, setMenu] = useState(null);
    const [rail, setRail] = useState(memory.rail);
    const [minBar, setMinBar] = useState(false);
    const [sheet, setSheet] = useState(null);
    // Ficheiro aberto na caixa do material (null = a lista dos ficheiros, opção A de 2026-11-16)
    const [attachment, setAttachment] = useState(null);
    useEffect(() => { setAttachment(null); }, [lesson.ulid]);

    // Tamanhos das divisórias, em %
    const [splitX, setSplitX] = useState(memory.splitX);
    const [splitR, setSplitR] = useState(memory.splitR);
    const [splitL, setSplitL] = useState(memory.splitL);
    const [splitRow, setSplitRow] = useState(memory.splitRow);
    const [splitM, setSplitM] = useState(memory.splitM);
    const [place, setPlace] = useState(memory.place);
    const resumeAt = useRef(null); // o vídeo que muda de coluna volta a abrir no mesmo segundo
    useEffect(() => { resumeAt.current = null; }, [lesson.ulid]);

    useEffect(() => {
        if (evaluation === 'run') return; // a avaliação muda os painéis por pouco tempo: não conta
        Object.assign(memory, { notes: showNotes, rail, splitX, splitR, splitL, splitRow, splitM, place });
        // Numa aula sem vídeo o conteúdo está no Material (abre sempre): o vídeo e o Material ficam como estavam
        if (hasPlayer) Object.assign(memory, { video: showVideo, material: showMaterial });
        if (askAlex && !avatarOnly) memory.ask = ask; // a aula só de avatar não muda o que as outras abrem
    }, [showMaterial, showNotes, rail, splitX, splitR, splitL, splitRow, splitM, place, showVideo, ask, evaluation]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Fica sempre pelo menos um painel aberto (2026-11-12, como no Início): fechar o último só mostra um aviso
    const [tip, setTip] = useState(null);
    const tipTimer = useRef(null);
    const keepOne = () => {
        setTip(t('Fica sempre pelo menos um painel aberto.'));
        clearTimeout(tipTimer.current);
        tipTimer.current = setTimeout(() => setTip(null), 2800);
    };
    useEffect(() => () => clearTimeout(tipTimer.current), []);
    const isLast = (k) => openCount === 1 && (k === 'checks' ? showChecks && !showMaterial : k === 'material' ? showMaterial && !showChecks : on[k]);

    const pauseVideo = () => player.current?.pause();
    const toggleVideo = () => {
        if (showVideo && isLast('video')) { keepOne(); return; }
        if (showVideo) pauseVideo();
        setShowVideo(!showVideo);
    };
    const toggleMaterial = () => {
        if (showMaterial && isLast('material')) { keepOne(); return; }
        if (!showMaterial && mobile) setShowNotes(false);
        setShowMaterial(!showMaterial);
    };
    const toggleNotes = () => {
        if (showNotes && isLast('notes')) { keepOne(); return; }
        if (!showNotes && mobile) { setShowMaterial(false); setShowChecks(false); }
        setShowNotes(!showNotes);
    };
    const openAsk = () => {
        setAsk(true);
        pauseVideo(); // o vídeo fica em pausa enquanto o aluno fala com o avatar
    };
    // O Alex (cursos com o Alex): abre e fecha o painel do avatar a partir da barra de baixo
    const toggleAsk = () => {
        if (!ask) { openAsk(); return; }
        if (isLast('ask')) keepOne(); else setAsk(false);
    };
    const seekTo = (s) => {
        setShowVideo(true);
        player.current?.seek(s);
    };

    const startEvaluation = () => {
        beforeEvaluation.current = { video: showVideo, material: showMaterial, notes: showNotes, checks: showChecks, place };
        // Na avaliação, o vídeo abre ao lado do avatar (na outra coluna, em cima), não por baixo; no fim volta ao seu lugar
        if (place.video[0] === place.ask[0]) {
            const side = `${place.ask[0] === 'L' ? 'R' : 'L'}1`;
            const other = Object.keys(place).find((k) => place[k] === side);
            setPlace((p) => ({ ...p, video: side, [other]: p.video }));
        }
        pauseVideo();
        setShowVideo(false); setShowMaterial(false); setShowNotes(false); setShowChecks(false); setAsk(false); setRail(false); setSheet(null);
        setEndsAt(Date.now() + evaluationMin * 60 * 1000);
        setEvaluation('run');
        if (alexProp && evalTarget) startEvaluationCall(evalTarget.ulid, evalTarget.place); // o teste com avatar ou a avaliação final
    };
    const endEvaluation = () => {
        // Depois de terminar, o programa e o próximo teste com avatar atualizam-se (o teste fica feito)
        if (alexProp) endEvaluationCall().then(() => router.reload({ only: ['program', 'course', 'progress', 'avatarTest', 'flash'] }));
        const p = beforeEvaluation.current;
        if (p) {
            if (p.place.video !== place.video) { resumeAt.current = player.current?.time() ?? null; player.current?.flush(); }
            setPlace(p.place);
            setShowVideo(p.video); setShowMaterial(p.material); setShowNotes(p.notes); setShowChecks(p.checks);
        }
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
    const alexEvaluation = alexProp?.evaluation ?? null; // avaliação final com o avatar
    // Teste com avatar aberto nesta página (atividade da lista) ou, no botão, o próximo por fazer
    const thisTest = activity === 'teste' ? { place: 'teste', ulid: lesson.ulid, title: lesson.title, minutes: lesson.minutes || EVALUATION_MIN } : null;
    const [evalTarget, setEvalTarget] = useState(null); // { place: 'teste' | 'avaliacao', ulid, title, minutes }
    const buttonTarget = avatarTest ? { place: 'teste', ...avatarTest }
        : finalMode === 'avatar' ? { place: 'avaliacao', ulid: lesson.ulid, title: t('Avaliação final'), minutes: alexEvaluation?.minutes ?? EVALUATION_MIN }
        : null;
    const openIntro = (target) => { if (running) return; setEvalTarget(target); setEvaluation('intro'); setSheet(null); };
    const evaluationMin = evalTarget?.minutes ?? alexEvaluation?.minutes ?? EVALUATION_MIN;
    const videoOn = hasPlayer && showVideo;
    const avatarOn = ask || running;
    const materialOn = showMaterial && !showChecks;
    const on = { ask: avatarOn, video: videoOn, material: materialOn || showChecks, notes: showNotes };
    const openCount = Object.values(on).filter(Boolean).length;
    const at = Object.fromEntries(Object.entries(place).map(([k, p]) => [p, k])); // lugar → painel
    const hasLeft = on[at.L1] || on[at.L2];
    const rightItems = (on[at.R1] ? 1 : 0) + (on[at.R2] ? 1 : 0);
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
    const hint = !canSave || done || evalKind === 'quiz' || !hasPlayer
        ? null
        : progress.noDuration ? t('Esta aula fica concluída quando o formador indicar a duração do vídeo.')
        : !videoReady ? t('Faltam :v1 de vídeo', { v1: fmt(needed - watched) }) : null;
    const nextOpen = next?.open && !running;
    const prevOpen = prev && !running;

    // Barra de cima de cada painel: escolher o que mostrar e fechar
    const panelBar = (slot, icon, dark = false) => {
        const shown = on;
        // Só o que esta aula tem (as notas do aluno estão sempre)
        const options = [['video', <IconVideo key="i" />, t('Vídeo')], ['material', <IconDoc key="i" />, t('Material')], ['notes', <IconPen key="i" />, t('Notas')], ['ask', <IconUser key="i" />, t('Avatar')]]
            .filter(([k]) => (k === 'video' ? hasPlayer : k === 'material' ? materialWorth : k === 'ask' ? avatarHere : true));
        const open = (k) => {
            if (k === 'video') setShowVideo(true);
            if (k === 'material' && !showMaterial) toggleMaterial();
            if (k === 'notes' && !showNotes) toggleNotes();
            if (k === 'ask') openAsk();
        };
        // Trocar de lugar: aberto, os dois trocam de posição; fechado, abre aqui e este fecha (no telemóvel só abre). Também na avaliação, onde o avatar nunca fecha
        const pick = (k) => {
            setMenu(null);
            if (k === slot) return;
            if (mobile) { open(k); return; }
            const wasOpen = shown[k];
            if (place[k][0] !== place[slot][0] && (k === 'video' || slot === 'video')) {
                resumeAt.current = player.current?.time() ?? null;
                player.current?.flush();
            }
            setPlace((p) => ({ ...p, [k]: p[slot], [slot]: p[k] }));
            if (!wasOpen) {
                open(k);
                if (slot === 'video') { pauseVideo(); setShowVideo(false); }
                if (slot === 'material') { setShowMaterial(false); setShowChecks(false); }
                if (slot === 'notes') setShowNotes(false);
                if (slot === 'ask' && !running) setAsk(false);
            }
        };
        const close = () => {
            if (slot === 'video') toggleVideo();
            if (slot === 'material') toggleMaterial();
            if (slot === 'notes') toggleNotes();
            if (slot === 'ask') { if (isLast('ask')) keepOne(); else setAsk(false); }
        };
        return (
            <>
                <div className={`al-tb ${dark ? 'dark' : ''} ${menu === slot ? 'pin' : ''}`}>
                    <button type="button" className="al-tb-b" data-menu aria-label={t('Escolher o que mostrar neste painel ou trocar de lugar')} aria-expanded={menu === slot} onClick={() => setMenu(menu === slot ? null : slot)}>{icon}<IconDown /></button>
                    <span className="sp" />
                    {!(slot === 'ask' && running) && <button type="button" className="al-tb-b" aria-label={t('Fechar painel')} onClick={close}><IconX /></button>}
                </div>
                {menu === slot && (
                    <div className="al-menu">
                        {options.map(([k, ic, label]) => (
                            <button type="button" key={k} disabled={k === 'video' && !hasPlayer} onClick={() => pick(k)}>
                                {ic}{label}{k === slot ? <small><IconCheck /></small> : shown[k] ? <small>{mobile ? t('noutro painel') : <span title={t('trocar de lugar')}><IconSwap /><span className="sr-only">{t('trocar de lugar')}</span></span>}</small> : null}
                            </button>
                        ))}
                    </div>
                )}
            </>
        );
    };

    const hasQuiz = evalKind === 'quiz' && !!lesson.quiz;
    const hasMaterial = !!bodyText || lesson.attachments.length > 0;
    const practical = lesson.kind === 'exercicio' && !hasQuiz; // exercício prático: "Marcar como feito"
    const [markedDone, setMarkedDone] = useState(false);
    const markDone = () => window.axios.post(`/plataforma/aulas/${lesson.ulid}/feito`).then(() => { setMarkedDone(true); refresh(); });
    // Avaliação final com perguntas: abre na caixa do Material
    const [finalOpen, setFinalOpen] = useState(false);
    useEffect(() => { setFinalOpen(false); }, [lesson.ulid]);
    const openFinal = () => {
        if (running) return;
        setShowChecks(false);
        setAttachment(null);
        if (mobile) setShowNotes(false);
        setShowMaterial(true);
        setFinalOpen(true);
    };
    // Botão Avaliação de uma aula com questionário: abre o Material e vai até ao questionário
    const openQuiz = () => {
        if (running) return;
        setShowChecks(false);
        setAttachment(null);
        if (mobile) setShowNotes(false);
        setShowMaterial(true);
        setTimeout(() => document.getElementById('al-quiz')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
    };

    const tools = (
        <div className="al-tools" role="group" aria-label={t('O que mostrar')}>
            {/* Só os botões do que esta aula tem (2026-11-26); as notas do aluno estão sempre */}
            {hasPlayer && <button type="button" className="al-sw" data-tip={t('Vídeo')} aria-label={t('Vídeo')} aria-pressed={videoOn} onClick={toggleVideo}><IconVideo /></button>}
            {(materialWorth || finalOpen) && <button type="button" className="al-sw" data-tip={t('Material')} aria-label={t('Material')} aria-pressed={showMaterial} onClick={toggleMaterial}><IconDoc /></button>}
            <button type="button" className="al-sw" data-tip={t('Notas')} aria-label={t('Notas')} aria-pressed={showNotes} onClick={toggleNotes}><IconPen /></button>
            {avatarHere && <button type="button" className="al-sw" data-tip={askAlex?.name || 'Alex'} aria-label={t('Falar com :name', { name: askAlex?.name || 'Alex' })} aria-pressed={avatarOn} disabled={running} onClick={toggleAsk}><IconUser /></button>}
            <span className="div" />
            {/* Teste da aula (questionário): abre no Material */}
            {hasQuiz && <button type="button" className="al-ev" onClick={() => { setFinalOpen(false); openQuiz(); }}><IconDoc />{lesson.kind === 'exercicio' ? t('Exercício') : t('Teste')}</button>}
            {/* Avaliação (2026-11-27): o próximo teste com avatar por fazer e, depois, a avaliação final com avatar.
                O que tem perguntas (testes, avaliação final) está na lista de módulos. */}
            {buttonTarget && (
                <button type="button" className={`al-ev ${evaluation ? 'on' : ''}`} onClick={() => (evaluation === 'intro' ? setEvaluation(null) : openIntro(buttonTarget))}><IconUser />{t('Avaliação')}</button>
            )}
        </div>
    );

    const viewer =attachment != null && lesson.attachments[attachment] && isPdf(lesson.attachments[attachment]) ? lesson.attachments[attachment] : null;

    // Cada painel numa função, para ir para o lugar que o aluno escolher (as chaves evitam recarregar na mesma coluna)
    const sections = {
        ask: (grow) => (
            <section key="ask" className={`al-panel al-a ${avatarOn ? '' : 'off'}`} aria-label={t('Avatar')} style={{ flexGrow: grow }}>
                {panelBar('ask', <IconUser />, true)}
                {running && <EvaluationEnd endsAt={endsAt} onEnd={endEvaluation} />}
                {running && alexProp ? (
                    <AlexEvaluationPanel onClose={endEvaluation} />
                ) : running ? (
                    <div className="al-a-stage">
                        <span className="al-orb" aria-hidden="true" />
                        <p>{t('O teste final com o avatar fica disponível em breve.')}</p>
                    </div>
                ) : activity ? (
                    <AlexActivityPanel place={activity} lesson={{ ...lesson, done }} minutes={lesson.minutes}
                        onBegin={activity === 'teste' ? () => openIntro(thisTest) : null} tests={avatarTests} slug={course.slug}
                        canStart={!!alexProp && canSave} onStart={pauseVideo} alex={alexProp} />
                ) : askAlex ? (
                    <AlexLessonPanel alex={askAlex} open={avatarOn} onStart={pauseVideo} />
                ) : avatarHere ? (
                    // A aula tem avatar, mas este aluno ainda não o pode usar: diz porquê em vez de uma caixa vazia
                    <div className="al-a-stage">
                        <span className="al-orb" aria-hidden="true" />
                        <p>{t('O avatar desta aula ainda não está disponível. Fala com o formador do curso.')}</p>
                    </div>
                ) : (
                    <div className="al-a-stage">
                        <span className="al-orb" aria-hidden="true" />
                        <p>{t('Este curso ainda não tem avatar para tirar dúvidas.')}</p>
                    </div>
                )}
            </section>
        ),
        video: (grow) => hasPlayer && (
            <section key="video" className={`al-panel al-v ${videoOn ? '' : 'off'}`} aria-label={t('Vídeo')} style={{ flexGrow: grow }}>
                {panelBar('video', <IconVideo />, true)}
                <VideoPlayer ref={player} key={lesson.ulid} source={lesson.video} lessonUlid={lesson.ulid} initial={resumeAt.current != null ? { ...progress, position: resumeAt.current } : progress} canSave={canSave}
                    onWatched={(w, d) => { setWatched(w); if (d) setNeeded(Math.ceil(d * 0.9)); }} onSaved={onSaved} />
            </section>
        ),
        material: (grow) => [
            hasChecks && (
                <section key="checks" className={`al-panel al-c ${showChecks ? '' : 'off'}`} aria-label={t('Perguntas rápidas')} style={{ flexGrow: grow }}>
                    <div className="al-tb pin">
                        <span className="sp" />
                        <button type="button" className="al-tb-b" aria-label={t('Fechar perguntas')} onClick={() => (isLast('checks') ? keepOne() : setShowChecks(false))}><IconX /></button>
                    </div>
                    <div className="al-c-scroll">
                        <div className="al-c-card">
                            <small>{t('Perguntas rápidas')}</small>
                            <h2>{checksDone ? t('Respondidas.') : t('Queres testar o que viste?')}</h2>
                            <QuickChecks lessonUlid={lesson.ulid} checks={checks} canSave={canSave} onChange={setChecks} onCompleted={refresh} />
                        </div>
                    </div>
                </section>
            ),
            <section key="material" className={`al-panel al-m ${materialOn ? '' : 'off'}`} aria-label={t('Material')} style={{ flexGrow: grow }}>
                {panelBar('material', <IconDoc />)}
                {/* Depois dos 90%, as perguntas rápidas voltam a abrir-se daqui (fechadas ou depois de recarregar a página) */}
                {hasChecks && videoReady && (
                    <button type="button" className="al-pill al-m-checks" onClick={() => { setShowChecks(true); if (mobile) setShowNotes(false); }}>
                        {checksDone ? t('Ver as perguntas rápidas') : t('Perguntas rápidas')}
                    </button>
                )}
                {finalOpen && finalEvaluation.quiz ? (
                    <div className="al-m-scroll">
                        <div className="al-card flush">
                            <button type="button" className="al-pill mb-3" onClick={() => setFinalOpen(false)}><IconLeft />{t('Voltar à aula')}</button>
                            <QuizRunner key="final" quiz={finalEvaluation.quiz} canSave={canSave} title={t('Avaliação final do curso')}
                                postUrl={`/plataforma/cursos/${course.slug}/avaliacao-final`} />
                        </div>
                    </div>
                ) : viewer ? (
                    <>
                        <div className="al-fv">
                            <button type="button" className="al-tb-b" onClick={() => setAttachment(null)}><IconLeft />{t('Ficheiros')}</button>
                            <b title={viewer.name}>{viewer.name}</b>
                            <a className="al-tb-b" href={viewer.url} download={viewer.name} aria-label={t('Descarregar :name', { name: viewer.name })}><IconDownload /></a>
                        </div>
                        <iframe className="al-pdf al-pdf-in" src={`${viewer.url}#view=FitH`} title={viewer.name} />
                    </>
                ) : (
                    <div className="al-m-scroll">{(!hasQuiz || hasMaterial) && <div className="al-card">
                        <h2>{lesson.title}</h2>
                        {/* Notas do formador (parte "Notas" da aula) */}
                        {/* No exercício prático, o que o aluno tem de fazer */}
                        {practical && <small className="mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-muted">{t('O que tens de fazer')}</small>}
                        {bodyText && bodyText.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                        {!hasMaterial && (
                            <p>{t('Esta aula não tem material de apoio.')}</p>
                        )}
                        {practical && canSave && (
                            done || markedDone
                                ? <p className="mt-3 font-display font-bold text-success-ink">{t('✓ Exercício feito')}</p>
                                : <button type="button" className="al-pill mt-3" onClick={markDone}>{t('Marcar como feito')}</button>
                        )}
                        {lesson.attachments.length > 0 && (
                            <div className="al-files">
                                <small>{lesson.attachments.length === 1 ? t('1 ficheiro') : t(':n ficheiros', { n: lesson.attachments.length })}</small>
                                <ul>
                                    {lesson.attachments.map((a, i) => (
                                        <li key={a.url}>
                                            <span className={`al-ext ${isPdf(a) ? 'pdf' : ''}`}>{fileExt(a)}</span>
                                            <span className="al-fn">
                                                <b title={a.name}>{a.name}</b>
                                                <small>{[fileSize(a.size), !isPdf(a) && t('só descarregar')].filter(Boolean).join(' · ')}</small>
                                            </span>
                                            {isPdf(a) && <button type="button" className="al-pill" onClick={() => setAttachment(i)}>{t('Ver aqui')}</button>}
                                            <a className="al-tb-b" href={a.url} download={a.name} aria-label={t('Descarregar :name', { name: a.name })}><IconDownload /></a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>}
                    {/* Avaliação da aula: questionário (abre também no botão Avaliação) */}
                    {hasQuiz && (
                        <div id="al-quiz" className={`al-card flush ${hasMaterial ? 'mt-4' : ''}`}>
                            <QuizRunner key={lesson.ulid} lessonUlid={lesson.ulid} quiz={lesson.quiz} canSave={canSave} />
                        </div>
                    )}
                    </div>
                )}
            </section>
        ],
        notes: (grow) => (
            <section key="notes" className={`al-panel al-n ${asRow && place.notes === 'R2' ? 'side' : ''} ${place.notes.endsWith('1') ? 'first' : ''} ${showNotes ? '' : 'off'}`} aria-label={t('Notas')} style={{ flexGrow: grow }}>
                {panelBar('notes', <IconPen />)}
                <LessonNotes key={lesson.ulid} lessonUlid={lesson.ulid} title={t('Notas da aula :v1', { v1: numOf(lesson.ulid) })} initial={notes} canSave={canSave}
                    hasVideo={hasPlayer} getTime={() => player.current?.time() ?? 0} onSeek={seekTo} />
            </section>
        ),
    };

    return (
        <div className="al" style={{ '--al-split': `${splitM}%` }}>
            <Head title={`${lesson.title} · ${course.title}`} />

            {/* A barra da plataforma (janelas largas): o aluno passa para os outros separadores sem sair pelo menu */}
            <PlatformNav className="al-nav" activeKey={mode === 'enrolled' ? 'mine' : 'catalog'} />

            <header className="al-head">
                <Link className="al-logo" href={mode === 'enrolled' ? `/plataforma/meus-cursos?curso=${course.slug}` : mode === 'sample' ? `/plataforma/cursos?curso=${course.slug}` : `/plataforma/cursos/${course.slug}`} aria-label={t('Voltar ao curso :title', { title: course.title })}>
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
                {!mobile && <ModulesRail open={rail} slug={course.slug} program={program} percent={course.percent} currentPct={currentPct}
                    final={finalMode === 'questions' && finalEvaluation.quiz ? { done: finalEvaluation.done, on: finalOpen, onOpen: openFinal } : null} />}

                <main className="al-stage" ref={stage}>
                    <div className={`al-col left ${hasLeft ? '' : 'none'} ${hasRight ? '' : 'full'}`} style={{ flexGrow: leftGrow }}>
                        {/* Avatar: o iframe fica montado depois de aberto, para não perder a conversa */}
                        {sections[at.L1](splitL)}
                        <Split key="split-l" dir="h" shown={on[at.L1] && on[at.L2]} value={splitL} onChange={(v) => setSplitL(clampSplit(v))} />
                        {sections[at.L2](100 - splitL)}
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
                        {sections[at.R1](topGrow)}
                        <Split key="split-r" dir={asRow ? 'v' : 'h'} shown={rightItems === 2} value={topGrow} onChange={(v) => (asRow ? setSplitRow : setSplitR)(clampSplit(v))} />
                        {sections[at.R2](100 - topGrow)}
                    </div>

                    {!hasLeft && !hasRight && !evaluation && <p className="al-empty">{t('Liga um painel na barra de baixo para continuar.')}</p>}

                    {evaluation === 'intro' && (
                        <div ref={introBox} className="al-intro" role="dialog" aria-modal="true" aria-label={evalTarget?.place === 'teste' ? t('Vai começar o teste') : t('Vai começar a avaliação')}>
                            <button type="button" className="al-tb-b x" aria-label={t('Fechar')} onClick={() => setEvaluation(null)}><IconX /></button>
                            <div>
                                <h2>{evalTarget?.place === 'teste' ? t('Vai começar o teste: :title', { title: evalTarget.title }) : t('Vai começar a avaliação final.')}</h2>
                                <p>{evalTarget?.place === 'teste'
                                    ? t('O teste é feito com o avatar: vai apresentar-te casos práticos. Podes usar o microfone para responder ou escrever a tua resposta.')
                                    : t('O teste final é feito com o avatar. Podes usar o microfone para responder às perguntas ou escrever a tua resposta.')}</p>
                                {!alexProp ? (
                                    <p>{t('O avatar ainda não está disponível. Fala com o formador do curso.')}</p>
                                ) : evalTarget?.place !== 'teste' && alexEvaluation?.done ? (
                                    <p>{alexEvaluation.module ? t('Já fizeste a avaliação deste módulo com o avatar.') : t('Já fizeste a avaliação final deste curso com o avatar.')}</p>
                                ) : (
                                    <>
                                        <p>{t('Tens :min minutos. O tempo que falta aparece no botão Terminar.', { min: evaluationMin })}</p>
                                        <MicCheck />
                                        <div className="bs">{t('Boa sorte!')}</div>
                                        <button type="button" className="al-pill" onClick={startEvaluation}>{t('Continuar')}</button>
                                    </>
                                )}
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
                    <ModulesStrip program={program} sheet={sheet} onPick={setSheet}
                        final={finalMode === 'questions' && finalEvaluation.quiz ? { done: finalEvaluation.done, on: finalOpen, onOpen: () => { setSheet(null); openFinal(); } } : null} />
                </footer>
            ) : (
                <footer className="al-foot">
                    <div className="al-f-l">
                        <button type="button" className={`al-f-b ${rail ? 'on' : ''}`} disabled={running} aria-expanded={rail} onClick={() => setRail(!rail)}><IconSide />{t('Módulos')}</button>
                        {/* Janelas largas: o módulo e a aula ficam aqui (o cabeçalho da aula dá lugar à barra da plataforma) */}
                        <div className="al-f-t" title={`${moduleOfLesson?.title ?? ''} · ${lesson.title}`}>
                            <b><span className="n">{numOf(lesson.ulid)}</span> {moduleOfLesson?.title}</b>
                            <small>{lesson.title}</small>
                        </div>
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
            <Toast message={tip} />
        </div>
    );
}
