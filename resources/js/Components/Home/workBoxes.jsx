import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { formatEuro, plural } from '@/Components/CourseBuilder/format';
import { Bar, EmptyPanel } from '@/Components/Panels/PanelBoard';
import { IconArrow } from '@/Components/Panels/icons';
import { COLS } from '@/Components/Panels/usePanelBoard';

import { t } from '@/i18n';

// Caixas de trabalho do Início (2026-11-10): cada uma só chega do servidor (WorkArea) a quem tem a
// permissão dela. Pendentes e Mensagens são comuns e ficam na página.

// O admin tem todas as permissões: começa só com estas caixas; as outras abrem-se em Painéis visíveis
export const ADMIN_START = ['pendentes', 'resumo', 'atencao', 'pedidos', 'pessoas', 'catalogo'];

// Lugar inicial: as caixas visíveis em filas de 24 colunas, pela ordem dada; a última de cada fila
// estica até ao fim. As escondidas ficam por baixo (voltam a encaixar quando se abrem).
export function place(order, defs) {
    let x = 0;
    let y = 0;
    let rowH = 0;
    let row = [];
    const close = () => {
        const last = row[row.length - 1];
        if (last) last.w += COLS - x;
        y += rowH;
        x = 0;
        rowH = 0;
        row = [];
    };
    const lay = (ids) => ids.forEach((id) => {
        const d = defs[id];
        if (x + d.w > COLS) close();
        Object.assign(d, { x, y });
        x += d.w;
        rowH = Math.max(rowH, d.h);
        row.push(d);
    });
    lay(order.filter((id) => defs[id] && !defs[id].hidden));
    close();
    lay(order.filter((id) => defs[id]?.hidden));
    return defs;
}

function Rows({ items, empty, render }) {
    if (!items?.length) return <p className="pn-empty">{empty}</p>;
    return items.map(render);
}

function courseNote(c) {
    if (c.status !== 'published') return t('Rascunho · continuar a editar');
    const parts = [c.students === 1 ? t('1 aluno') : t(':n alunos', { n: c.students })];
    if (c.attendance) parts.push(c.attendance === 1 ? t('1 presença por confirmar') : t(':n presenças por confirmar', { n: c.attendance }));
    if (c.unread) parts.push(c.unread === 1 ? t('1 mensagem por ler') : t(':n mensagens por ler', { n: c.unread }));
    return parts.join(' · ');
}

function TeachingPanel({ courses }) {
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

// Resumo dos últimos 30 dias (os mesmos números da Administração)
function OverviewPanel({ o }) {
    const pct = o.enrolled ? Math.round((o.done / o.enrolled) * 100) : 0;
    const kpis = [
        [t('Vendas'), formatEuro(o.revenue), plural(o.sales, t('1 compra pessoal'), t(':n compras pessoais'))],
        [t('Compras de empresa'), o.companySales, t('pagas ou concluídas')],
        [t('Cliques no catálogo'), o.views, plural(o.newUsers, t('1 conta nova'), t(':n contas novas'))],
        [t('Conclusão'), `${pct}%`, t(':done de :enrolled inscrições', { done: o.done, enrolled: o.enrolled })],
    ];
    return (
        <>
            <div className="grid grid-cols-2">
                {kpis.map(([label, value, note], i) => (
                    <div key={label} className={`border-b border-line px-[18px] py-4 ${i % 2 === 0 ? 'border-r' : ''}`}>
                        <span className="pn-lab">{label}</span>
                        <b className="pn-disp mt-1 block text-[26px] leading-[1.05]">{value}</b>
                        <small className="mt-1 block text-[12.5px] text-muted">{note}</small>
                    </div>
                ))}
            </div>
            <div className="pn-foot"><Link href="/administracao" className="ui-link">{t('Abrir a Administração')}</Link></div>
        </>
    );
}

function PurchasesPanel({ items }) {
    const [busy, setBusy] = useState(null);
    const authorize = (id) => router.post(`/gestao/pedidos/${id}/autorizar`, {}, {
        preserveScroll: true,
        onStart: () => setBusy(id),
        onFinish: () => setBusy(null),
    });
    return (
        <Rows items={items} empty={t('Não há compras à espera de autorização.')} render={(r) => (
            <div key={r.id} className="pn-a-row">
                <b>{r.who}</b>
                <small>{[r.course, t('pago :ago', { ago: r.ago })].filter(Boolean).join(' · ')}</small>
                <em><button type="button" className="ui-btn ui-btn-accent ui-btn-sm" disabled={busy === r.id} onClick={() => authorize(r.id)}>{t('Autorizar')}</button></em>
            </div>
        )} />
    );
}

/** Definições das caixas de trabalho que chegaram do servidor. */
export function workBoxes({ overview, attention, views, people, requests, purchases, teams, catalog, teaching, assessments, failing = 0, team }) {
    const has = (v) => v !== undefined && v !== null;
    const defs = {};

    if (has(overview)) {
        defs.resumo = {
            title: t('Resumo dos últimos 30 dias'), w: 8, h: 11,
            summary: formatEuro(overview.revenue),
            body: <OverviewPanel o={overview} />,
        };
        defs.atencao = {
            title: t('Precisa de atenção'), w: 8, h: 11,
            label: attention.length ? t('Precisa de atenção · :n', { n: attention.length }) : t('Precisa de atenção'),
            summary: attention[0]?.title ?? t('Nada fora do normal'),
            body: <Rows items={attention} empty={t('Nada fora do normal nos últimos 30 dias.')} render={(a, i) => (
                <Link key={i} href={a.url} className="pn-a-row"><b>{a.title}</b><small>{a.text}</small></Link>
            )} />,
        };
        const top = views[0]?.n ?? 0;
        defs.vistos = {
            title: t('Cursos mais vistos'), w: 8, h: 11,
            summary: views[0]?.title ?? t('Sem cliques'),
            body: <Rows items={views} empty={t('Ainda não houve cliques no catálogo nos últimos 30 dias.')} render={(v) => (
                <div key={v.title} className="px-[18px] py-2">
                    <div className="flex justify-between gap-3 text-sm"><span className="truncate">{v.title}</span><b>{v.n}</b></div>
                    <Bar value={top ? Math.round((v.n / top) * 100) : 0} />
                </div>
            )} />,
        };
    }

    if (has(people)) {
        defs.pessoas = {
            title: t('Pessoas'), w: 8, h: 11,
            summary: plural(people.week, t('1 conta nova esta semana'), t(':n contas novas esta semana')),
            body: (
                <>
                    <div className="pn-a-row"><b>{plural(people.week, t('1 conta nova'), t(':n contas novas'))}</b><small>{t('nos últimos 7 dias')}</small></div>
                    <Link href="/administracao/pessoas?filtro=nunca" className="pn-a-row">
                        <b>{plural(people.never, t('1 pessoa nunca entrou'), t(':n pessoas nunca entraram'))}</b>
                        <small>{t('convidadas há mais de uma semana')}</small>
                    </Link>
                    <div className="pn-a-row"><b>{t('Perfis')}</b><small>{people.roles.map((r) => `${r.n} ${r.name}`).join(' · ')}</small></div>
                    <div className="pn-foot"><Link href="/administracao/pessoas" className="ui-link">{t('Gerir pessoas e permissões')}</Link></div>
                </>
            ),
        };
    }

    if (has(requests)) {
        defs.pedidos = {
            title: t('Pedidos novos'), w: 8, h: 11,
            label: requests.length ? t('Pedidos novos · :n', { n: requests.length }) : t('Pedidos novos'),
            summary: requests[0] ? `#${requests[0].id} · ${requests[0].who}` : t('Sem pedidos novos'),
            mini: <Link href="/gestao/pedidos" className="pn-more">{t('Ver todos')}</Link>,
            body: <Rows items={requests} empty={t('Sem pedidos novos.')} render={(r) => (
                <Link key={r.id} href={`/gestao/pedidos?pedido=${r.id}`} className="pn-a-row">
                    <b>#{r.id} · {r.kind}</b>
                    <small>{[r.who, r.course].filter(Boolean).join(' · ')}</small>
                    <em className="text-[13px] font-semibold">{r.ago}</em>
                </Link>
            )} />,
        };
        defs.compras = {
            title: t('Compras por autorizar'), w: 8, h: 11,
            label: purchases.length ? t('Compras por autorizar · :n', { n: purchases.length }) : t('Compras por autorizar'),
            summary: purchases.length ? plural(purchases.length, t('1 compra paga'), t(':n compras pagas')) : t('Nenhuma à espera'),
            body: <PurchasesPanel items={purchases} />,
        };
    }

    if (has(teams)) {
        defs.equipas = {
            title: t('Equipas'), w: 8, h: 11,
            summary: plural(teams.length, t('1 equipa'), t(':n equipas')),
            mini: <Link href="/gestao/equipas" className="pn-more">{t('Ver todas')}</Link>,
            body: <Rows items={teams} empty={t('Ainda não há equipas. Criam-se a partir de um pedido de empresa.')} render={(c) => (
                <Link key={c.ulid} href={`/gestao/equipas/${c.ulid}`} className="pn-a-row">
                    <b>{c.name}</b>
                    <small>{t(':members de :seats lugares', { members: c.members, seats: c.seats })}</small>
                    <em className={c.late ? 'pn-fail' : 'text-[13px] font-semibold text-muted'}>{c.late ? plural(c.late, t('1 fora do prazo'), t(':n fora do prazo')) : t('em dia')}</em>
                </Link>
            )} />,
        };
    }

    if (has(catalog)) {
        defs.catalogo = {
            title: t('Cursos do catálogo'), w: 8, h: 11,
            summary: t(':p publicados · :d em rascunho', { p: catalog.published, d: catalog.drafts }),
            mini: <Link href="/formador/cursos" className="pn-more">{t('Gerir cursos')}</Link>,
            body: (
                <>
                    <div className="pn-a-row"><b>{t(':p publicados · :d em rascunho', { p: catalog.published, d: catalog.drafts })}</b><small>{t('Últimos alterados')}</small></div>
                    {catalog.recent.map((c) => (
                        <Link key={c.ulid} href={`/formador/cursos/${c.ulid}/editar`} className="pn-a-row">
                            <b>{c.title}</b>
                            <small>{[c.instructor, c.when].filter(Boolean).join(' · ')}</small>
                            <em className="text-[13px] font-semibold text-muted">{c.status === 'published' ? t('Publicado') : t('Rascunho')}</em>
                        </Link>
                    ))}
                </>
            ),
        };
    }

    if (has(teaching)) {
        const courses = teaching;
        const published = courses.filter((c) => c.status === 'published').length;
        const waiting = courses.reduce((n, c) => n + c.attendance, 0);
        defs.novo = {
            title: t('Criar curso novo'), w: 8, h: 11,
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
        };
        defs.ensino = {
            title: t('Os meus cursos'), w: 16, h: 11,
            summary: [published === 1 ? t('1 publicado') : t(':n publicados', { n: published }), courses.length - published && t(':n em rascunho', { n: courses.length - published }), waiting && t(':n presenças por confirmar', { n: waiting })].filter(Boolean).join(' · '),
            mini: <Link href="/formador/cursos" className="pn-more">{t('Ver todos')}</Link>,
            body: <TeachingPanel courses={courses} />,
        };
        defs.avaliacoes = {
            title: t('Avaliações'), w: 8, h: 12,
            label: failing ? t('Avaliações · :n por passar', { n: failing }) : t('Avaliações'),
            summary: failing ? t(':n alunos ainda não passaram', { n: failing }) : t('Todos os alunos passaram'),
            mini: <Link href="/formador/avaliacoes" className="pn-more">{t('Ver todas')}</Link>,
            body: <AssessmentsPanel rows={assessments} />,
        };
    }

    if (has(team)) {
        defs.equipa = {
            title: t('A minha equipa'), w: 24, h: 9,
            label: team.count ? t('A minha equipa · :n precisam de atenção', { n: team.count }) : t('A minha equipa'),
            summary: `${team.name} · ${t(':members de :seats lugares', { members: team.members, seats: team.seats })}`,
            mini: <Link href="/equipa" className="pn-more">{t('Ver a equipa')}</Link>,
            body: <Rows items={team.attention} empty={t('Está toda a gente em dia.')} render={(m) => (
                <Link key={m.name} href="/equipa" className="pn-a-row"><b>{m.name}</b><em className="pn-fail text-[13px]">{m.why}</em></Link>
            )} />,
        };
    }

    return defs;
}
