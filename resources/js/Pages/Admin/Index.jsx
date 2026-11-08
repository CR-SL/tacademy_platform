import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout, { initials } from '@/Layouts/StudentLayout';
import { Button, Chip, Drawer, Field, FlashToast, inputCls, Pills, useConfirm } from '@/Components/ui';
import { Columns, Completion, fmtEuro, fmtInt, HBars } from '@/Components/Admin/Charts';
import { t } from '@/i18n';

// Administração: menu lateral com estatísticas, catálogo, pessoas e permissões.
// Cada secção chega do servidor com os seus dados; o menu só mostra o que a pessoa pode ver.

const I = (d) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const MENU = [
    ['Resumo', [['geral', 'Visão geral', 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z']]],
    ['Estatísticas', [
        ['vendas', 'Vendas', 'M4 20V10M10 20V4M16 20v-7M22 20H2'],
        ['cliques', 'Cliques no catálogo', 'M9 3v4M3 9h4M5 5l2.5 2.5M12 12l8 3-3 2-2 3z'],
        ['conclusao', 'Conclusão dos cursos', 'M20 6L9 17l-5-5'],
    ]],
    ['Gestão', [
        ['catalogo', 'Catálogo', 'M4 5h16v14H4zM4 9h16'],
        ['pessoas', 'Pessoas', 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6'],
        ['permissoes', 'Permissões', 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4'],
    ]],
];
const courseUrl = (ulid) => `/administracao/cursos/${ulid}`;

export default function Index({ section, sections, days, data }) {
    const Section = { geral: Overview, vendas: Sales, cliques: Clicks, conclusao: CompletionSection, catalogo: Catalog, pessoas: People, permissoes: Permissions }[section];

    return (
        <StudentLayout>
            <Head title={t('Administração')} />
            <div className="bo-shell">
                <nav className="bo-side" aria-label={t('Administração')}>
                    {MENU.map(([group, items]) => {
                        const shown = items.filter(([key]) => sections.includes(key));
                        if (!shown.length) return null;
                        return (
                            <div key={group} style={{ display: 'contents' }}>
                                <span className="pn-lab">{t(group)}</span>
                                {shown.map(([key, label, icon]) => (
                                    <Link key={key} href={`/administracao/${key}`} aria-current={section === key ? 'page' : undefined} preserveScroll={false}>
                                        {I(icon)}{t(label)}
                                    </Link>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                <main className="bo-main"><Section data={data} days={days} /></main>
            </div>
            <FlashToast />
        </StudentLayout>
    );
}

function Head2({ title, sub, children }) {
    return (
        <div className="bo-head">
            <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
            {children && <div className="flex flex-wrap gap-2">{children}</div>}
        </div>
    );
}

function Box({ title, chip, children, pad = true }) {
    return (
        <section className="bo-box">
            <div className="bo-box-h"><span className="pn-lab">{title}</span>{chip}</div>
            <div className={pad ? 'bo-box-b' : ''}>{children}</div>
        </section>
    );
}

function Kpi({ label, value, hint }) {
    return (
        <div className="bg-surface px-5 py-4">
            <p className="pn-lab">{label}</p>
            <p className="mt-1 font-display text-[28px] font-bold leading-none">{value}</p>
            {hint && <p className="mt-2 text-[12.5px] text-muted">{hint}</p>}
        </div>
    );
}

const PAY_NOTE = 'Compras a título pessoal pagas ou autorizadas. O pagamento pela plataforma ainda é simulado; as compras de empresas combinam-se à parte.';

/* ---------- Visão geral ---------- */
function Overview({ data, days }) {
    const { overview: o, attention, months, catalog, completion } = data;
    const topViews = [...catalog].filter((c) => c.views).sort((a, b) => b.views - a.views).slice(0, 6);

    return (
        <>
            <Head2 title={t('Visão geral')} sub={t('Últimos :days dias.', { days })} />
            <div className="bo-kpis">
                <Kpi label={t('Receita')} value={fmtEuro(o.revenue)} hint={t(':n compras pessoais', { n: o.sales })} />
                <Kpi label={t('Compras de empresas')} value={fmtInt(o.companySales)} hint={t('pedidos pagos ou com equipa criada')} />
                <Kpi label={t('Cliques no catálogo')} value={fmtInt(o.views)} hint={t('cursos abertos no catálogo')} />
                <Kpi label={t('Cursos concluídos')} value={t(':done de :total', { done: o.done, total: o.enrolled })} hint={o.enrolled ? t(':pct% das inscrições', { pct: Math.round((o.done / o.enrolled) * 100) }) : null} />
            </div>
            <div className="bo-row">
                <Box title={t('Compras por mês')}><Columns data={months} unit={` ${t('compras')}`} caption={t('Compras por mês')} /></Box>
                <Box title={t('A precisar de atenção')}>
                    {attention.length ? attention.map((a, i) => (
                        <Link key={i} href={a.url} className="bo-att"><i /><span><b>{a.title}</b><small>{a.text}</small></span></Link>
                    )) : <p className="bo-empty">{t('Nada a pedir atenção. Está tudo em dia.')}</p>}
                </Box>
            </div>
            <div className="bo-row">
                <Box title={t('Conclusão por curso')}><Completion rows={completion} linkTo={(r) => courseUrl(r.ulid)} /></Box>
                <Box title={t('Cursos mais vistos')}>
                    <HBars rows={topViews.map((c) => ({ name: c.title, value: c.views, href: courseUrl(c.ulid), tip: t(':views cliques · :sales compras', { views: fmtInt(c.views), sales: c.sales }) }))} caption={t('Cursos mais vistos')} />
                </Box>
            </div>
        </>
    );
}

/* ---------- Vendas ---------- */
function Sales({ data, days }) {
    const { overview: o, months, byCourse } = data;
    return (
        <>
            <Head2 title={t('Vendas')} sub={t(PAY_NOTE)} />
            <div className="bo-kpis">
                <Kpi label={t('Receita · :days dias', { days })} value={fmtEuro(o.revenue)} />
                <Kpi label={t('Compras pessoais')} value={fmtInt(o.sales)} />
                <Kpi label={t('Compras de empresas')} value={fmtInt(o.companySales)} />
                <Kpi label={t('Pessoas novas')} value={fmtInt(o.newUsers)} hint={t('contas criadas no período')} />
            </div>
            <div className="bo-row">
                <Box title={t('Compras por mês')}><Columns data={months} unit={` ${t('compras')}`} caption={t('Compras por mês')} /></Box>
                <Box title={t('Receita por curso · :days dias', { days })}>
                    <HBars rows={byCourse.map((c) => ({ name: c.title, value: c.revenue, href: c.ulid ? courseUrl(c.ulid) : undefined, tip: t(':n compras', { n: c.sales }) }))} format={fmtEuro} caption={t('Receita por curso')} />
                </Box>
            </div>
            <p className="bo-note">{t('As faturas chegam mais tarde no desenvolvimento.')}</p>
        </>
    );
}

/* ---------- Cliques ---------- */
function Clicks({ data, days }) {
    const rows = [...data.catalog].filter((c) => c.status === 'published').sort((a, b) => b.views - a.views);
    return (
        <>
            <Head2 title={t('Cliques no catálogo')} sub={t('Quantas vezes cada curso foi aberto no catálogo nos últimos :days dias, e quantas compras houve.', { days })} />
            <Box title={t('Cliques e compras por curso')} pad={false}>
                <div className="overflow-x-auto px-3 py-1">
                    <table className="bo-table">
                        <thead><tr><th>{t('Curso')}</th><th className="num">{t('Cliques')}</th><th className="num">{t('Compras')}</th><th className="num">{t('Conversão')}</th></tr></thead>
                        <tbody>{rows.map((c) => (
                            <tr key={c.ulid}>
                                <td><Link href={courseUrl(c.ulid)} className="font-semibold hover:underline">{c.title}</Link></td>
                                <td className="num">{fmtInt(c.views)}</td>
                                <td className="num">{fmtInt(c.sales)}</td>
                                <td className="num">{c.views ? `${((c.sales / c.views) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : '—'}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </Box>
            <p className="bo-note">{t('A contagem começou quando esta página foi criada. Abrir o mesmo curso várias vezes seguidas conta uma vez a cada 30 minutos.')}</p>
        </>
    );
}

/* ---------- Conclusão ---------- */
function CompletionSection({ data }) {
    return (
        <>
            <Head2 title={t('Conclusão dos cursos')} sub={t('Em cada curso: quem concluiu, quem está a meio e quem ainda não começou.')} />
            <Box title={t('Conclusão por curso')}><Completion rows={data.completion} linkTo={(r) => courseUrl(r.ulid)} /></Box>
        </>
    );
}

/* ---------- Catálogo ---------- */
function Catalog({ data }) {
    return (
        <>
            <Head2 title={t('Catálogo')} sub={t('Todos os cursos, de todos os formadores. Abre um curso para ver os números ou edita-o no editor.')}>
                <Button variant="accent" href="/formador/cursos/novo">{t('Criar curso')}</Button>
            </Head2>
            <Box title={t(':n cursos', { n: data.catalog.length })} pad={false}>
                <div className="overflow-x-auto px-3 py-1">
                    <table className="bo-table">
                        <thead><tr><th /><th>{t('Curso')}</th><th>{t('Estado')}</th><th className="num">{t('Preço')}</th><th className="num">{t('Inscritos')}</th><th className="num">{t('Cliques')}</th><th /></tr></thead>
                        <tbody>{data.catalog.map((c) => (
                            <tr key={c.ulid}>
                                <td><img src={c.image} alt="" /></td>
                                <td><Link href={courseUrl(c.ulid)} className="font-semibold hover:underline">{c.title}</Link><br /><small className="text-muted">{[c.area, c.instructor].filter(Boolean).join(' · ')}</small></td>
                                <td>{c.status === 'published' ? <Chip tone="ok">{t('Publicado')}</Chip> : <Chip>{t('Rascunho')}</Chip>}</td>
                                <td className="num">{c.free ? t('Grátis') : fmtEuro(c.price)}</td>
                                <td className="num">{fmtInt(c.enrolled)}</td>
                                <td className="num">{fmtInt(c.views)}</td>
                                <td className="num"><Button variant="soft" size="sm" href={`/formador/cursos/${c.ulid}/editar`}>{t('Editar')}</Button></td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </Box>
            {data.areas && <Areas areas={data.areas} />}
        </>
    );
}

/* ---------- Áreas (categorias dos cursos) ---------- */
function Areas({ areas }) {
    const { errors } = usePage().props;
    const add = useForm({ name: '' });
    const [editing, setEditing] = useState(null);
    const edit = useForm({ name: '' });
    const [confirm, confirmDialog] = useConfirm();

    const remove = async (a) => {
        if (await confirm({ title: t('Apagar a área “:name”?', { name: a.name }), body: t('Só se apaga uma área sem cursos.'), action: t('Apagar'), danger: true })) {
            router.delete(`/administracao/areas/${a.id}`, { preserveScroll: true });
        }
    };

    return (
        <section className="bo-box" style={{ marginTop: 12 }}>
            <div className="bo-box-h"><span className="pn-lab">{t('Áreas')}</span></div>
            <div className="bo-box-b">
                <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); add.post('/administracao/areas', { preserveScroll: true, onSuccess: () => add.reset() }); }}>
                    <input className={inputCls} style={{ maxWidth: 320 }} value={add.data.name} maxLength={100} placeholder={t('Nome da área nova')} aria-label={t('Nome da área nova')} onChange={(e) => add.setData('name', e.target.value)} />
                    <Button variant="soft" type="submit" disabled={add.processing || !add.data.name.trim()}>{t('Criar área')}</Button>
                </form>
                {(add.errors.name || errors.area) && <p className="ui-err mb-2">{add.errors.name || errors.area}</p>}
                <table className="bo-table">
                    <thead><tr><th>{t('Área')}</th><th className="num">{t('Cursos')}</th><th /></tr></thead>
                    <tbody>{areas.map((a) => (
                        <tr key={a.id}>
                            <td>
                                {editing === a.id ? (
                                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); edit.put(`/administracao/areas/${a.id}`, { preserveScroll: true, onSuccess: () => setEditing(null) }); }}>
                                        <input className={inputCls} value={edit.data.name} maxLength={100} aria-label={t('Nome da área')} autoFocus onChange={(e) => edit.setData('name', e.target.value)} />
                                        <Button size="sm" type="submit" disabled={edit.processing}>{t('Guardar')}</Button>
                                        <Button size="sm" variant="soft" onClick={() => setEditing(null)}>{t('Cancelar')}</Button>
                                    </form>
                                ) : <b className="font-semibold">{a.name}</b>}
                                {editing === a.id && edit.errors.name && <p className="ui-err mt-1">{edit.errors.name}</p>}
                            </td>
                            <td className="num">{a.courses_count}</td>
                            <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                {editing !== a.id && <Button variant="soft" size="sm" onClick={() => { setEditing(a.id); edit.setData('name', a.name); edit.clearErrors(); }}>{t('Mudar o nome')}</Button>}
                                {!a.courses_count && editing !== a.id && <> <Button variant="line" size="sm" onClick={() => remove(a)}>{t('Apagar')}</Button></>}
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
                <p className="bo-note">{t('O nome aparece no catálogo e nos cursos. Uma área com cursos não se apaga.')}</p>
            </div>
            {confirmDialog}
        </section>
    );
}

/* ---------- Pessoas ---------- */
function People({ data }) {
    const { users, counts, roles, filters } = data;
    const [editing, setEditing] = useState(null); // null | 'new' | user
    const [q, setQ] = useState(filters.q ?? '');
    const [confirm, confirmDialog] = useConfirm();
    const roleName = Object.fromEntries(roles.map((r) => [r.key, r.name]));
    const go = (patch) => router.get('/administracao/pessoas', { ...filters, ...patch, page: undefined }, { preserveState: true, preserveScroll: true, replace: true });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const deactivate = async (u) => {
        if (await confirm({ title: t('Desativar a conta de :name?', { name: u.name }), body: t('A pessoa deixa de conseguir entrar. Os cursos, notas e certificados ficam guardados e podes reativar a conta quando quiseres.'), action: t('Desativar'), danger: true })) {
            router.delete(`/administracao/pessoas/${u.ulid}`, { preserveScroll: true });
        }
    };

    return (
        <>
            <Head2 title={t('Pessoas')} sub={t('Contas e perfis. Adicionar uma pessoa envia-lhe um convite por email. A empresa de cada pessoa trata-se em Equipas.')}>
                <Button variant="primary" onClick={() => setEditing('new')}>{t('Adicionar pessoa')}</Button>
            </Head2>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <Pills label={t('Filtrar por perfil')} value={filters.perfil ?? 'todos'} onChange={(v) => go({ perfil: v === 'todos' ? undefined : v })}
                    items={[['todos', t('Todos'), total], ...roles.map((r) => [r.key, r.name, counts[r.key] ?? 0])]} />
                <form className="flex flex-1 justify-end gap-2" style={{ minWidth: 260 }} onSubmit={(e) => { e.preventDefault(); go({ q: q || undefined }); }}>
                    <input type="search" className={inputCls} style={{ maxWidth: 300 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Procurar por nome ou email')} aria-label={t('Procurar pessoa')} />
                    <Button variant="soft" type="submit">{t('Procurar')}</Button>
                </form>
            </div>
            <div className="mb-3">
                <Pills label={t('Estado')} value={filters.filtro ?? 'todas'} onChange={(v) => go({ filtro: v === 'todas' ? undefined : v })}
                    items={[['todas', t('Todas')], ['nunca', t('Nunca entraram')], ['desativadas', t('Desativadas')]]} />
            </div>
            <Box title={t(':n pessoas', { n: users.total })} pad={false}>
                <div className="overflow-x-auto px-3 py-1">
                    {users.data.length ? (
                        <table className="bo-table">
                            <thead><tr><th>{t('Pessoa')}</th><th>{t('Perfil')}</th><th>{t('Empresa')}</th><th className="num">{t('Cursos')}</th><th>{t('Última atividade')}</th><th /></tr></thead>
                            <tbody>{users.data.map((u) => (
                                <tr key={u.id} className={u.disabled ? 'bo-dim' : ''}>
                                    <td><div className="bo-who"><span className="bo-av">{initials(u.name)}</span><span style={{ minWidth: 0 }}><b>{u.name}{u.me && <> <Chip>{t('Tu')}</Chip></>}</b><small>{u.email}</small></span></div></td>
                                    <td><Chip tone={u.role === 'admin' ? 'dark' : 'mut'}>{roleName[u.role] ?? u.role}</Chip>{u.disabled && <> <Chip tone="bad">{t('Desativada')}</Chip></>}</td>
                                    <td>{u.company ?? <span className="text-muted">—</span>}</td>
                                    <td className="num">{u.courses}</td>
                                    <td className="text-muted">{u.last ?? t('nunca entrou')}</td>
                                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                        {u.disabled ? (
                                            <Button variant="soft" size="sm" onClick={() => router.post(`/administracao/pessoas/${u.id}/reativar`, {}, { preserveScroll: true })}>{t('Reativar')}</Button>
                                        ) : (
                                            <>
                                                <Button variant="soft" size="sm" onClick={() => setEditing(u)}>{t('Editar')}</Button>
                                                {!u.me && <> <Button variant="line" size="sm" onClick={() => deactivate(u)}>{t('Desativar')}</Button></>}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}</tbody>
                        </table>
                    ) : <p className="bo-empty px-3">{t('Ninguém com estes filtros.')}</p>}
                </div>
            </Box>
            {users.last_page > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {users.links.filter((l) => l.url && !isNaN(Number(l.label))).map((l) => (
                        <Link key={l.label} href={l.url} preserveScroll className={`ui-btn ui-btn-sm ${l.active ? '' : 'ui-btn-soft'}`}>{l.label}</Link>
                    ))}
                </div>
            )}
            {confirmDialog}
            {editing && <PersonDrawer user={editing === 'new' ? null : editing} roles={roles} onClose={() => setEditing(null)} />}
        </>
    );
}

function PersonDrawer({ user, roles, onClose }) {
    const isNew = !user;
    const form = useForm({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? 'aluno' });
    const submit = (e) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (isNew) form.post('/administracao/pessoas', opts);
        else form.put(`/administracao/pessoas/${user.ulid}`, opts);
    };

    return (
        <Drawer title={isNew ? t('Adicionar pessoa') : user.name} sub={isNew ? t('Pessoas') : user.email} onClose={onClose} width="w-[min(520px,100%)]"
            footer={<><span className="flex-1" /><Button variant="soft" onClick={onClose}>{t('Cancelar')}</Button><Button variant="accent" type="submit" form="person-form" disabled={form.processing}>{isNew ? t('Adicionar e enviar convite') : t('Guardar')}</Button></>}>
            <form id="person-form" onSubmit={submit} className="flex flex-col gap-4">
                <Field id="p-name" label={t('Nome')} error={form.errors.name}>
                    <input id="p-name" className={inputCls} value={form.data.name} maxLength={150} placeholder={t('Nome e apelido')} onChange={(e) => form.setData('name', e.target.value)} />
                </Field>
                <Field id="p-email" label={t('Email')} error={form.errors.email} hint={isNew ? t('Recebe um email para definir a palavra-passe.') : undefined}>
                    <input id="p-email" type="email" className={inputCls} value={form.data.email} maxLength={150} placeholder="nome@oficina.pt" onChange={(e) => form.setData('email', e.target.value)} />
                </Field>
                <fieldset>
                    <legend className="ui-label mb-1.5">{t('Perfil')}</legend>
                    <div className="bo-roles">
                        {roles.map((r) => (
                            <label key={r.key}>
                                <input type="radio" name="role" value={r.key} checked={form.data.role === r.key} onChange={() => form.setData('role', r.key)} disabled={user?.me} />
                                <span><b>{r.name}</b><small>{r.about}</small></span>
                            </label>
                        ))}
                    </div>
                    {form.errors.role && <p className="ui-err mt-1.5">{form.errors.role}</p>}
                    <p className="ui-hint mt-1.5">{user?.me ? t('Não podes mudar o teu próprio perfil.') : t('O que cada perfil pode fazer define-se em Permissões.')}</p>
                </fieldset>
            </form>
        </Drawer>
    );
}

/* ---------- Permissões ---------- */
function Permissions({ data }) {
    const { roles, permissions, granted } = data;
    const [busy, setBusy] = useState(null);
    const toggle = (role, key) => {
        const now = granted[role] ?? [];
        const next = now.includes(key) ? now.filter((k) => k !== key) : [...now, key];
        setBusy(`${role}-${key}`);
        router.put('/administracao/permissoes', { role, permissions: next }, { preserveScroll: true, onFinish: () => setBusy(null) });
    };

    return (
        <>
            <Head2 title={t('Permissões')} sub={t('O que cada perfil pode fazer na plataforma. As mudanças valem logo para todas as pessoas desse perfil.')} />
            <Box title={t('Perfis e permissões')} pad={false}>
                <div className="overflow-x-auto px-3 py-1">
                    <table className="bo-table bo-matrix">
                        <thead><tr><th>{t('O que pode fazer')}</th>{roles.map((r) => <th key={r.key}>{r.name}</th>)}</tr></thead>
                        <tbody>{permissions.map((p) => (
                            <tr key={p.key}>
                                <td>{p.label}</td>
                                {roles.map((r) => {
                                    const on = (granted[r.key] ?? []).includes(p.key);
                                    return (
                                        <td key={r.key}>
                                            <button type="button" className="bo-tick" aria-pressed={on} disabled={r.key === 'admin' || busy === `${r.key}-${p.key}`}
                                                aria-label={`${r.name}: ${p.label}`} onClick={() => toggle(r.key, p.key)}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </Box>
            <p className="bo-note">{t('O admin tem sempre todas as permissões. Ver o catálogo, comprar e fazer cursos está sempre ao alcance de todos.')}</p>
        </>
    );
}
