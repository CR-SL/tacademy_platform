import { Head, Link, usePage } from '@inertiajs/react';
import StudentLayout from '@/Layouts/StudentLayout';
import MessagesPanel from '@/Components/Panels/MessagesPanel';
import PanelBoard, { EmptyPanel, PanelsMenu } from '@/Components/Panels/PanelBoard';
import { IconArrow } from '@/Components/Panels/icons';
import usePanelBoard from '@/Components/Panels/usePanelBoard';

import { t } from '@/i18n';

// Início do formador (opção D da navegação, 2026-11-09): criar curso novo, os seus cursos, as avaliações dos alunos e as mensagens.

function greeting() {
    const h = new Date().getHours();
    return h < 12 ? t('Bom dia') : h < 20 ? t('Boa tarde') : t('Boa noite');
}

function courseNote(c) {
    if (c.status !== 'published') return t('Rascunho · continuar a editar');
    const parts = [c.students === 1 ? t('1 aluno') : t(':n alunos', { n: c.students })];
    if (c.attendance) parts.push(c.attendance === 1 ? t('1 presença por confirmar') : t(':n presenças por confirmar', { n: c.attendance }));
    if (c.unread) parts.push(c.unread === 1 ? t('1 mensagem por ler') : t(':n mensagens por ler', { n: c.unread }));
    return parts.join(' · ');
}

function CoursesPanel({ courses }) {
    if (!courses.length) {
        return <EmptyPanel title={t('Ainda não criaste nenhum curso')} text={t('Começa pelo título. O resto vais preenchendo, e fica tudo guardado sozinho.')} href="/formador/cursos/novo" cta={t('Criar curso novo')} />;
    }
    return courses.map((c) => (
        <Link key={c.ulid} href={c.attendance ? `/formador/cursos?presenca=${c.ulid}` : `/formador/cursos/${c.ulid}/editar`} className="pn-c-row">
            {c.image ? <img src={c.image} alt="" loading="lazy" /> : <span className="pn-c-ph" aria-hidden="true" />}
            <span>
                <b>{c.title}</b>
                <small className={c.attendance || c.unread ? 'pn-late-t' : undefined}>{courseNote(c)}</small>
            </span>
        </Link>
    ));
}

function AssessmentsPanel({ rows }) {
    if (!rows.length) return <p className="pn-empty">{t('Os resultados dos quizzes dos teus alunos aparecem aqui.')}</p>;
    return rows.map((r) => (
        <Link key={r.key} href={`/formador/avaliacoes?resultado=${r.key}`} className="pn-a-row">
            <span className="pn-lab">{r.course} · {r.when}</span>
            <b>{r.student}</b>
            <small>{r.quiz}{r.out ? ` · ${t('sem tentativas')}` : ` · ${t('tentativa :n de :max', { n: r.attempts, max: r.max })}`}</small>
            <em className={r.passed ? '' : 'pn-fail'}>{r.best}%</em>
        </Link>
    ));
}

export default function Home({ courses, assessments, attention, messages, savedLayout }) {
    const { auth } = usePage().props;
    const firstName = (auth?.user?.name ?? '').split(' ')[0];
    const startWith = new URLSearchParams(window.location.search).get('conversa');
    const unread = messages.threads.reduce((n, tx) => n + (tx.unread > 0 ? 1 : 0), 0);
    const published = courses.filter((c) => c.status === 'published').length;
    const waiting = courses.reduce((n, c) => n + c.attendance, 0);

    const panels = {
        novo: {
            title: t('Criar curso novo'), x: 0, y: 0, w: 8, h: 11,
            hero: { image: '/images/cursos/cta-motor.jpg' },
            summary: t('Fica em rascunho até publicares'),
            body: (
                <>
                    <h3 className="pn-disp">{t('Tens uma formação nova em mente?')}</h3>
                    <p>{t('Dados, programa, vídeos e quiz, passo a passo. Fica em rascunho até publicares.')}</p>
                    <div className="pn-acts" style={{ marginTop: 'auto' }}>
                        <Link href="/formador/cursos/novo" className="ui-btn ui-btn-accent">{t('Criar curso novo')}<IconArrow /></Link>
                    </div>
                </>
            ),
        },
        cursos: {
            title: t('Os meus cursos'), x: 8, y: 0, w: 16, h: 11,
            summary: [published === 1 ? t('1 publicado') : t(':n publicados', { n: published }), courses.length - published && t(':n em rascunho', { n: courses.length - published }), waiting && t(':n presenças por confirmar', { n: waiting })].filter(Boolean).join(' · '),
            mini: <Link href="/formador/cursos" className="pn-more">{t('Ver todos')}</Link>,
            body: <CoursesPanel courses={courses} />,
        },
        avaliacoes: {
            title: t('Avaliações'), x: 0, y: 11, w: 12, h: 12,
            label: attention ? t('Avaliações · :n por passar', { n: attention }) : t('Avaliações'),
            summary: attention ? t(':n alunos ainda não passaram', { n: attention }) : t('Todos os alunos passaram'),
            mini: <Link href="/formador/avaliacoes" className="pn-more">{t('Ver todas')}</Link>,
            body: <AssessmentsPanel rows={assessments} />,
        },
        mensagens: {
            title: t('Mensagens'), x: 12, y: 11, w: 12, h: 12,
            label: unread ? t('Mensagens · :unread por ler', { unread }) : t('Mensagens'),
            summary: messages.threads[0] ? `${messages.threads[0].name}, ${messages.threads[0].when}` : t('Sem mensagens'),
            body: <MessagesPanel key={startWith ?? ''} messages={messages} startWith={startWith} empty={t('Ainda não tens mensagens. Quando um aluno te escrever sobre um curso, a conversa aparece aqui.')} />,
        },
    };
    const board = usePanelBoard({ view: 'formador', panels, saved: savedLayout });

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title={t('Início')} />
            <div className="pn-root">
                <div className="pn-top">
                    <h1 className="pn-disp">{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
                    <p>{t('O teu trabalho como formador.')}</p>
                </div>
            </div>
            <PanelBoard board={board} />
        </StudentLayout>
    );
}
