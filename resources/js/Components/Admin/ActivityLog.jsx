import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button, Drawer, inputCls, Pills } from '@/Components/ui';
import { t } from '@/i18n';

// Administração › Segurança › Registo de atividade (opção A, escolhida a 2026-11-15): tabela com filtros.
// Cada linha é uma ação; ao carregar abre o detalhe com o que mudou, o IP e o browser. Só o admin vê.

const ROLE = { admin: 'Admin', gestor_cursos: 'Gestor de cursos', formador: 'Formador', team_leader: 'Team leader', aluno: 'Aluno' };
const PROP = {
    email: 'Email usado', nota: 'Nota', passou: 'Passou', teste: 'Teste', curso: 'Curso', origem: 'Origem', equipa: 'Equipa',
    prazo: 'Prazo', perfil: 'Perfil', packs: 'Packs', motivo: 'Motivo', cursos: 'Cursos', pessoas: 'Pessoas',
    acrescentadas: 'Acrescentadas', retiradas: 'Retiradas', tipo: 'Tipo', empresa: 'Empresa', empresa_nome: 'Empresa', lembrar: 'Lembrar a sessão', id: 'Conta',
};
const fmt = (k, v) => {
    if (v === true) return t('Sim');
    if (v === false) return t('Não');
    if (Array.isArray(v)) return v.join(', ');
    if (k === 'nota') return `${v}%`;
    if (typeof v === 'object' && v !== null) return Object.values(v).join(', ');
    return String(v);
};

// O que mudou: primeiro "antes → depois", depois o resto
function details(row) {
    const p = row.props || {};
    const out = [];
    if ('antes' in p || 'depois' in p) out.push([t('Mudou'), <>{fmt('antes', p.antes ?? '—')} → <b>{fmt('depois', p.depois ?? '—')}</b></>]);
    Object.entries(p).forEach(([k, v]) => {
        if (['antes', 'depois', 'email'].includes(k) || v === null || v === '') return; // o email já está na frase
        out.push([t(PROP[k] ?? k), fmt(k, v)]);
    });
    return out;
}

// "Carla Pinto deu acesso a Rui Martins · Redes CAN Bus"
function Sentence({ row }) {
    const who = row.who ? <b>{row.who.name}</b> : <b>{t('Alguém sem sessão')}</b>;
    let rest = null;
    if (row.related && row.subject?.type !== 'pessoa') rest = <> <b>{row.related.name}</b>{row.subject && <> · {row.subject.label}</>}</>;
    else if (row.subject && !row.action.startsWith('conta.')) rest = <> <b>{row.subject.label}</b></>; // nas ações de conta, a pessoa já é quem faz
    else if (row.props?.email) rest = <> {t('com')} <b>{row.props.email}</b></>;
    return <>{who} {row.verb}{rest}</>;
}

// A mesma frase em texto simples (título da gaveta)
function sentenceText(row) {
    const who = row.who ? row.who.name : t('Alguém sem sessão');
    let rest = '';
    if (row.related && row.subject?.type !== 'pessoa') rest = ` ${row.related.name}${row.subject ? ` · ${row.subject.label}` : ''}`;
    else if (row.subject && !row.action.startsWith('conta.')) rest = ` ${row.subject.label}`;
    else if (row.props?.email) rest = ` ${t('com')} ${row.props.email}`;
    return `${who} ${row.verb}${rest}`;
}

export default function ActivityLog({ data }) {
    const { rows, filters, person, groups, periods, watch } = data;
    const [q, setQ] = useState(filters.q ?? '');
    const [ip, setIp] = useState(filters.ip ?? '');
    const [open, setOpen] = useState(null);
    const go = (patch) => {
        // Só os filtros com valor vão para o endereço
        const params = Object.fromEntries(Object.entries({ ...filters, ...patch, page: undefined }).filter(([, v]) => v !== null && v !== undefined && v !== ''));
        router.get('/administracao/registo', params, { preserveState: true, preserveScroll: true, replace: true });
    };
    const exportUrl = '/administracao/registo/exportar?' + new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== null && v !== '')).toString();
    const periodLabel = { 1: t('Últimas 24 horas'), 7: t('Últimos 7 dias'), 30: t('Últimos 30 dias'), 365: t('Últimos 12 meses') };

    return (
        <>
            <div className="bo-head">
                <div>
                    <h1>{t('Registo de atividade')}</h1>
                    <p>{t('O que se faz na plataforma: entradas, compras e acessos, cursos, equipas, administração e marcos da aprendizagem, com o IP de quem fez. Fica guardado 12 meses e só o admin vê.')}</p>
                </div>
            </div>

            {watch && (
                <div className="bo-watch" role="status">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l9 16H3zM12 10v4M12 17h.01" /></svg>
                    <p>
                        <b>{t(':n entradas falhadas do IP :ip na última hora', { n: watch.n, ip: watch.ip })}</b>
                        {watch.emails.length > 0 && <>, {t('com :n contas diferentes', { n: watch.emails.length })} ({watch.emails.join(', ')})</>}.{' '}
                        {t('Pode ser alguém a tentar adivinhar palavras-passe.')}
                    </p>
                    <Button variant="primary" size="sm" onClick={() => { setIp(watch.ip); go({ ip: watch.ip }); }}>{t('Ver só este IP')}</Button>
                </div>
            )}

            <form className="bo-log-filters" onSubmit={(e) => { e.preventDefault(); go({ q: q || undefined, ip: ip || undefined }); }}>
                <input type="search" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Procurar pessoa, curso, email…')} aria-label={t('Procurar no registo')} />
                <input className={`${inputCls} bo-num`} value={ip} onChange={(e) => setIp(e.target.value)} placeholder="IP" aria-label="IP" />
                <select className={inputCls} value={filters.periodo} onChange={(e) => go({ periodo: e.target.value })} aria-label={t('Período')}>
                    {periods.map((p) => <option key={p} value={p}>{periodLabel[p]}</option>)}
                </select>
                <Button variant="soft" type="submit">{t('Procurar')}</Button>
            </form>
            <div className="mb-3">
                <Pills label={t('Tipo de ação')} value={filters.grupo ?? 'todos'} onChange={(v) => go({ grupo: v === 'todos' ? undefined : v })}
                    items={[['todos', t('Todos')], ...groups.map((g) => [g.key, g.label]), ['vigiar', t('A vigiar')]]} />
            </div>
            {(person || filters.ip) && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {person && <span className="bo-fchip">{person.name}<button type="button" onClick={() => go({ pessoa: undefined })} aria-label={t('Tirar o filtro :name', { name: person.name })}>✕</button></span>}
                    {filters.ip && <span className="bo-fchip">IP {filters.ip}<button type="button" onClick={() => { setIp(''); go({ ip: undefined }); }} aria-label={t('Tirar o filtro do IP')}>✕</button></span>}
                </div>
            )}

            <section className="bo-box">
                <div className="overflow-x-auto">
                    {rows.data.length ? (
                        <table className="bo-table bo-log">
                            <thead><tr><th>{t('Quando')}</th><th>{t('O que aconteceu')}</th><th>{t('Tipo')}</th><th>IP</th><th aria-hidden="true" /></tr></thead>
                            <tbody>{rows.data.map((r) => {
                                const d = details(r)[0];
                                return (
                                    <tr key={r.id} tabIndex={0} className={r.alert ? 'is-alert' : ''} onClick={() => setOpen(r)} onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}>
                                        <td className="bo-log-t">{r.time}<small>{r.day}</small></td>
                                        <td className="bo-log-w"><Sentence row={r} />{d && <small>{d[0]}: {d[1]}</small>}</td>
                                        <td><span className="bo-g"><i />{r.group}</span></td>
                                        <td className="bo-num bo-log-ip">{r.ip ?? '—'}</td>
                                        <td className="bo-log-go" aria-hidden="true">›</td>
                                    </tr>
                                );
                            })}</tbody>
                        </table>
                    ) : <p className="bo-empty px-5">{t('Nada no registo com estes filtros.')}</p>}
                </div>
            </section>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-muted text-[13px]">{t(':n ações', { n: rows.total })}</span>
                <div className="flex flex-wrap gap-2">
                    {rows.last_page > 1 && rows.links.filter((l) => l.url && !isNaN(Number(l.label))).map((l) => (
                        <Link key={l.label} href={l.url} preserveScroll className={`ui-btn ui-btn-sm ${l.active ? '' : 'ui-btn-soft'}`}>{l.label}</Link>
                    ))}
                    {rows.total > 0 && <a href={exportUrl} className="ui-btn ui-btn-sm ui-btn-soft">{t('Exportar (Excel)')}</a>}
                </div>
            </div>

            {open && <EventDrawer row={open} onClose={() => setOpen(null)} onFilter={(patch) => { setOpen(null); if (patch.ip) setIp(patch.ip); go(patch); }} />}
        </>
    );
}

function EventDrawer({ row, onClose, onFilter }) {
    const facts = [
        [t('Quando'), <>{row.when} <small>({row.ago})</small></>],
        [t('Quem'), row.who ? <>{row.who.name} {row.who.role && <small>{t(ROLE[row.who.role] ?? row.who.role)}</small>}</> : t('Alguém sem sessão')],
        row.related && [t('Afetado'), <>{row.related.name} {row.related.role && <small>{t(ROLE[row.related.role] ?? row.related.role)}</small>}</>],
        row.subject && [t('Sobre'), row.subject.label],
        ...details(row),
        row.props?.email && [t('Email usado'), row.props.email],
        ['IP', <span className="bo-num">{row.ip ?? '—'}</span>],
        [t('Browser'), row.ua ?? '—'],
        [t('Ação'), <span className="bo-num">{row.action}</span>],
    ].filter(Boolean);

    return (
        <Drawer title={sentenceText(row)} sub={`${row.group ?? ''}${row.alert ? ` · ${t('a vigiar')}` : ''}`} onClose={onClose} width="w-[min(540px,100%)]"
            footer={<>
                <span className="flex-1" />
                {row.ip && <Button variant="soft" onClick={() => onFilter({ ip: row.ip, pessoa: undefined })}>{t('Ver tudo deste IP')}</Button>}
                {row.who?.id && <Button variant="primary" onClick={() => onFilter({ pessoa: row.who.id, ip: undefined })}>{t('Ver tudo de :name', { name: row.who.name.split(' ')[0] })}</Button>}
            </>}>
            <dl className="bo-facts">
                {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            <p className="bo-note">
                {row.keptLonger
                    ? t('Só o admin vê este registo. Por ser de compras ou certificados, esta linha fica guardada depois dos 12 meses, mas sem IP nem browser.')
                    : t('Só o admin vê este registo. Ao fim de 12 meses esta linha é apagada.')}
            </p>
        </Drawer>
    );
}
