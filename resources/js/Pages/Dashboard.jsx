import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { LEARN_SPOTS, learningBoxes, pendingSummary, Welcome } from '@/Components/Home/learningBoxes';
import { ADMIN_START, place, workBoxes } from '@/Components/Home/workBoxes';
import MessagesPanel from '@/Components/Panels/MessagesPanel';
import PanelBoard, { PanelsMenu } from '@/Components/Panels/PanelBoard';
import PendingPanel from '@/Components/Panels/PendingPanel';
import usePanelBoard from '@/Components/Panels/usePanelBoard';

import { t } from '@/i18n';

// Início (2026-11-10): uma só página para todos os perfis, em caixas que se arrastam, redimensionam,
// minimizam e escondem. Cada caixa só chega do servidor a quem tem a permissão dela:
// as de aprender ("Fazer cursos") em learningBoxes, as de trabalho em workBoxes.

function greeting() {
    const h = new Date().getHours();
    return h < 12 ? t('Bom dia') : h < 20 ? t('Boa tarde') : t('Boa noite');
}

// Ordem inicial quando há trabalho (as caixas de aprender, se as houver, vêm a seguir)
const WORK_ORDER = ['pendentes', 'resumo', 'atencao', 'pedidos', 'compras', 'pessoas', 'catalogo', 'equipas', 'vistos', 'novo', 'ensino', 'avaliacoes', 'mensagens'];
const TEACH_ORDER = ['novo', 'ensino', 'pendentes', 'avaliacoes', 'mensagens'];
const LEARN_ORDER = ['equipa', 'cursos', 'continuar', 'pendentes', 'resultados', 'alex', 'notas', 'mensagens', 'sugestoes', 'pausa'];

export default function Dashboard(props) {
    const { learns, pending, messages, starter = [], savedLayout } = props;
    const [best, setBest] = useState(0);
    const { auth } = usePage().props;
    const firstName = (auth?.user?.name ?? '').split(' ')[0];
    const startWith = new URLSearchParams(window.location.search).get('conversa');

    const work = workBoxes(props);
    const { equipa, ...workOnly } = work;
    const learning = learns ? learningBoxes(props, { best, setBest }) : {};
    const hasWork = Object.keys(workOnly).length > 0;

    const common = {
        pendentes: {
            title: t('Pendentes'), w: 8, h: 11,
            label: t('Pendentes · :length', { length: pending.length }),
            summary: pendingSummary(pending) ?? (pending.length ? t(':n por fazer', { n: pending.length }) : t('Nada por fazer')),
            body: <PendingPanel pending={pending} />,
        },
    };
    if (messages) {
        const unread = messages.threads.reduce((n, tx) => n + (tx.unread > 0 ? 1 : 0), 0);
        common.mensagens = {
            title: t('Mensagens'), w: 8, h: 12,
            label: unread ? t('Mensagens · :unread por ler', { unread }) : t('Mensagens'),
            summary: messages.threads[0] ? `${messages.threads[0].name}, ${messages.threads[0].when}` : t('Sem mensagens'),
            body: <MessagesPanel
                key={startWith ?? ''}
                messages={messages}
                startWith={startWith}
                empty={learns ? undefined : t('Ainda não tens mensagens. Quando um aluno te escrever sobre um curso, a conversa aparece aqui.')}
            />,
        };
    }

    const defs = { ...common, ...work, ...learning };
    const order = hasWork
        ? [...new Set([...(defs.ensino && !defs.catalogo ? TEACH_ORDER : WORK_ORDER), ...LEARN_ORDER])]
        : LEARN_ORDER;
    if (!hasWork) {
        // Só aprender: os lugares do Início do aluno de sempre; a equipa do team leader fica em cima
        Object.assign(defs.pendentes, LEARN_SPOTS.pendentes);
        if (defs.mensagens) Object.assign(defs.mensagens, LEARN_SPOTS.mensagens);
        if (equipa) {
            Object.entries(defs).forEach(([id, d]) => { if (id !== 'equipa') d.y += equipa.h; });
            Object.assign(equipa, { x: 0, y: 0 });
        }
    } else {
        // Com trabalho: filas pela ordem de cada perfil; o admin (todas as permissões) começa só com algumas
        if (auth?.role === 'admin') Object.entries(defs).forEach(([id, d]) => { d.hidden = !ADMIN_START.includes(id); });
        place(order, defs);
    }
    const panels = Object.fromEntries(order.filter((id) => defs[id]).map((id) => [id, defs[id]]));

    const board = usePanelBoard({ view: 'inicio', panels, saved: savedLayout });

    // Primeiro uso de quem só aprende: sem cursos, tarefas, conversas nem equipa, o Início é só boas-vindas
    if (learns && !hasWork && !equipa && !props.courses.length && !pending.length && !messages?.threads.length) {
        return (
            <StudentLayout>
                <Head title={t('Início')} />
                <Welcome firstName={firstName} starter={starter} />
            </StudentLayout>
        );
    }

    const summaryLine = pendingSummary(pending)
        ?? (pending.length ? t(':n por fazer', { n: pending.length }) : (props.resume || hasWork ? t('Tudo em dia') : null));
    const hello = (
        <>
            <h1 className="pn-disp">{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
            {summaryLine && <p>{summaryLine}</p>}
        </>
    );

    return (
        <StudentLayout navTools={(
            <>
                {/* Cumprimento e resumo na barra, ao lado de Painéis visíveis (2026-11-10) */}
                <div className="pn-hello">{hello}</div>
                <PanelsMenu board={board} />
            </>
        )}>
            <Head title={t('Início')} />
            {/* Janelas estreitas: a barra não tem espaço, o cumprimento fica por cima das caixas */}
            <div className="pn-root pn-hello-narrow">
                <div className="pn-top">{hello}</div>
            </div>
            <PanelBoard board={board} />
        </StudentLayout>
    );
}
