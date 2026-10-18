import { Head, Link, router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import MembersEditor from '@/Components/Teams/MembersEditor';
import { Box, btn, Chip, Drawer, FlashToast, inputCls, Over, PageHead, Tabs, Td, Th } from '@/Components/Teams/ui';

const tone = { novo: 'bad', em_esclarecimento: 'info', aguardar_pagamento: 'warn', pago: 'ok', equipa_criada: 'dark', concluido: 'mut', cancelado: 'mut' };
const FLOW = ['novo', 'em_esclarecimento', 'aguardar_pagamento', 'pago', 'equipa_criada', 'concluido'];
const OPEN = ['novo', 'em_esclarecimento', 'aguardar_pagamento', 'pago', 'equipa_criada'];

// "Pedidos" do Gestor de Cursos e do admin.
export default function Requests({ requests, open, statuses, kinds, changeTypes, courses }) {
    const [filter, setFilter] = useState('abertos');
    const [selected, setSelected] = useState(open);
    const [creating, setCreating] = useState(false);

    const matches = (r, f) => f === 'todos' || (f === 'abertos' ? OPEN.includes(r.status) : r.status === f);
    const rows = useMemo(() => requests.filter((r) => matches(r, filter)), [requests, filter]);
    const current = requests.find((r) => r.id === selected);
    const filters = [['abertos', 'Abertos'], ...Object.entries(statuses).filter(([k]) => k !== 'cancelado'), ['todos', 'Todos']]
        .map(([k, label]) => [k, label, requests.filter((r) => matches(r, k)).length]);

    return (
        <StudentLayout>
            <Head title="Pedidos" />
            <PageHead over={<Over>Gestão de cursos</Over>} title="Pedidos" sub="Esclarecimentos, compras de cursos e alterações pedidas pelos team leaders." />
            <Tabs label="Filtrar por estado" items={filters} value={filter} onChange={setFilter} />

            <div className="ta-cut-16 bg-surface px-3.5 py-2">
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[15px]">
                            <thead><tr><Th>#</Th><Th>Pedido</Th><Th>Tipo</Th><Th className="hidden lg:table-cell">Curso</Th><Th>Estado</Th><Th className="hidden md:table-cell">Responsável</Th><Th className="hidden md:table-cell">Recebido</Th></tr></thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} onClick={() => setSelected(r.id)} className="cursor-pointer hover:bg-page">
                                        <Td className="font-mono text-xs text-muted">{r.id}</Td>
                                        <Td>
                                            <button type="button" className="text-left" onClick={() => setSelected(r.id)}>
                                                <b className="block font-semibold">{r.company || r.name}</b>
                                                <small className="text-[12.5px] text-muted">{r.company ? r.name : r.type === 'particular' ? 'Particular' : r.email}</small>
                                            </button>
                                        </Td>
                                        <Td>{r.kind === 'alteracao' ? <Chip tone="dark">{kinds[r.kind]}</Chip> : kinds[r.kind]}</Td>
                                        <Td className="hidden lg:table-cell">
                                            {r.course?.title ?? (r.change_type ? changeTypes[r.change_type] : '—')}
                                            {r.packs ? <span className="text-muted"> · {r.packs} pack{r.packs > 1 ? 's' : ''}</span> : null}
                                        </Td>
                                        <Td><Chip tone={tone[r.status]}>{statuses[r.status]}</Chip></Td>
                                        <Td className="hidden md:table-cell">{r.assignee ?? <span className="text-muted">Por atribuir</span>}</Td>
                                        <Td className="hidden whitespace-nowrap text-muted md:table-cell">{r.ago}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="px-4 py-10 text-center text-muted">Sem pedidos neste estado.</p>}
            </div>

            {current && !creating && (
                <RequestDrawer r={current} statuses={statuses} kinds={kinds} changeTypes={changeTypes} onClose={() => setSelected(null)} onCreateTeam={() => setCreating(true)} />
            )}
            {current && creating && <CreateTeam r={current} courses={courses} onClose={() => setCreating(false)} />}
            <FlashToast />
        </StudentLayout>
    );
}

function RequestDrawer({ r, statuses, kinds, changeTypes, onClose, onCreateTeam }) {
    const reply = useForm({ body: '' });
    const isChange = r.kind === 'alteracao';
    const personal = r.kind === 'compra' && r.type === 'particular';
    const stateOptions = isChange || r.kind === 'esclarecimento' ? ['novo', 'em_esclarecimento', 'concluido', 'cancelado'] : Object.keys(statuses);
    const patch = (data) => router.patch(`/gestao/pedidos/${r.id}`, data, { preserveScroll: true, preserveState: true });

    const send = (e) => {
        e.preventDefault();
        reply.post(`/gestao/pedidos/${r.id}/responder`, { preserveScroll: true, preserveState: true, onSuccess: () => reply.reset() });
    };
    const authorize = () => {
        if (confirm(`Autorizar o acesso de ${r.name} ao curso “${r.course?.title}”?`)) {
            router.post(`/gestao/pedidos/${r.id}/autorizar`, {}, { preserveScroll: true, preserveState: true });
        }
    };

    return (
        <Drawer
            over={`Pedido #${r.id} · ${kinds[r.kind]}${personal ? ' (pessoal)' : ''}`}
            title={r.company || r.name}
            onClose={onClose}
            footer={
                <>
                    <select aria-label="Estado do pedido" className={`${inputCls} w-auto`} value={r.status} onChange={(e) => patch({ status: e.target.value })}>
                        {stateOptions.map((s) => <option key={s} value={s}>{statuses[s]}</option>)}
                    </select>
                    {!r.mine && <button type="button" className={btn.small} onClick={() => patch({ assign: true })}>Atribuir a mim</button>}
                    <span className="flex-1" />
                    {r.kind === 'compra' && !personal && r.status === 'pago' && !r.team && (
                        <button type="button" className={btn.accent} onClick={onCreateTeam}>Criar equipa ▶</button>
                    )}
                    {personal && r.status === 'pago' && (
                        <button type="button" className={btn.accent} onClick={authorize}>Autorizar acesso ▶</button>
                    )}
                    {r.team && (
                        <Link href={`/gestao/equipas/${r.team.ulid}`} className={btn.dark}>{isChange ? 'Abrir equipa ▶' : 'Ver equipa ▶'}</Link>
                    )}
                </>
            }
        >
            {!isChange && r.kind === 'compra' && !personal && (
                <div className="flex flex-wrap gap-1">
                    {FLOW.map((s, i) => {
                        const idx = FLOW.indexOf(r.status);
                        return (
                            <span key={s} className={`px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] ${
                                i < idx ? 'bg-ink text-accent' : i === idx ? 'bg-accent text-on-accent' : 'bg-surface2 text-muted'
                            }`}>{statuses[s]}</span>
                        );
                    })}
                </div>
            )}
            {personal && r.status === 'pago' && (
                <p className="ta-cut-8 bg-accent/15 px-4 py-3 text-sm">Compra a título pessoal com pagamento <b>simulado</b> (o pagamento pela plataforma ainda não está ativo). Ao autorizar, o aluno passa a ter o curso.</p>
            )}

            <Box title="Contacto">
                <dl className="grid grid-cols-[110px_1fr] gap-x-3.5 gap-y-1.5 text-sm">
                    <dt className="text-muted">Nome</dt><dd>{r.name}</dd>
                    <dt className="text-muted">Email</dt><dd className="break-all">{r.email}</dd>
                    {r.phone && <><dt className="text-muted">Telefone</dt><dd>{r.phone}</dd></>}
                    {r.company && <><dt className="text-muted">Empresa</dt><dd>{r.company}</dd></>}
                    {r.nif && <><dt className="text-muted">NIF</dt><dd>{r.nif}</dd></>}
                    {r.team_size && <><dt className="text-muted">Nº pessoas</dt><dd>{r.team_size}</dd></>}
                    {r.course && <><dt className="text-muted">Curso</dt><dd>{r.course.title}</dd></>}
                    {r.packs && <><dt className="text-muted">{isChange ? 'Pedido' : 'Packs'}</dt><dd>{r.packs} × 10 lugares</dd></>}
                    {r.change_type && <><dt className="text-muted">Alteração</dt><dd><b>{changeTypes[r.change_type]}</b></dd></>}
                    <dt className="text-muted">Recebido</dt><dd>{r.date}</dd>
                </dl>
            </Box>

            {r.people.length > 0 && (
                <Box title={isChange ? (r.change_type === 'retirar' ? 'Pessoa a retirar' : 'Pessoa a adicionar') : `Alunos indicados (${r.people.length})`}>
                    {r.people.map((p) => (
                        <div key={p.email} className="flex justify-between gap-3 border-b border-line py-1.5 text-sm last:border-0">
                            <span>{p.name}</span><span className="break-all text-muted">{p.email}</span>
                        </div>
                    ))}
                </Box>
            )}

            <Box title="Conversa">
                <div className="flex flex-col gap-2">
                    {r.messages.length ? r.messages.map((m, i) => (
                        <div key={i} className={`ta-cut-8 px-3.5 py-3 text-sm ${m.staff ? 'ml-8 bg-accent/10' : 'bg-page'}`}>
                            <p className="mb-1 flex justify-between gap-3 font-display text-[12.5px] font-semibold">{m.author}<small className="font-sans font-normal text-muted">{m.when}</small></p>
                            <p className="whitespace-pre-line">{m.body}</p>
                        </div>
                    )) : <span className="text-muted">Sem mensagens.</span>}
                </div>
                <form onSubmit={send} className="mt-3 flex flex-col gap-2">
                    <label htmlFor="reply" className="font-display text-[12.5px] font-semibold uppercase tracking-[0.04em]">Responder</label>
                    <textarea id="reply" rows={4} className={inputCls} value={reply.data.body} maxLength={5000}
                        placeholder={`A resposta é enviada por email para ${r.email}`} onChange={(e) => reply.setData('body', e.target.value)} />
                    {reply.errors.body && <span className="text-[13px] text-live">{reply.errors.body}</span>}
                    <button type="submit" disabled={reply.processing || !reply.data.body.trim()} className={`${btn.line} self-end disabled:opacity-45`}>
                        {reply.processing ? 'A enviar…' : 'Enviar resposta'}
                    </button>
                </form>
            </Box>
        </Drawer>
    );
}

function CreateTeam({ r, courses, onClose }) {
    const initial = r.people.length ? r.people : [{ name: r.name, email: r.email }];
    const [people, setPeople] = useState(initial);
    const [leader, setLeader] = useState(initial[0]?.email ?? '');
    const [company, setCompany] = useState(r.company ?? '');
    const [nif, setNif] = useState(r.nif ?? '');
    const [packs, setPacks] = useState(r.packs || Math.max(1, Math.ceil(initial.length / 10)));
    const [courseIds, setCourseIds] = useState(r.course ? [r.course.id] : []);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    const submit = () => {
        setBusy(true);
        router.post(`/gestao/pedidos/${r.id}/equipa`, { company, nif, packs, course_ids: courseIds, people, leader }, {
            onError: setErrors,
            onFinish: () => setBusy(false),
        });
    };

    return (
        <Drawer
            over={`Criar equipa · pedido #${r.id}`}
            title={company || 'Nova equipa'}
            onClose={onClose}
            footer={
                <>
                    <span className="text-[13px] text-muted">Ao criar, o pedido passa a “Equipa criada” e são enviados os convites.</span>
                    <span className="flex-1" />
                    <button type="button" className={btn.accent} disabled={busy || people.length > packs * 10} onClick={submit}>
                        {busy ? 'A criar…' : 'Criar equipa e enviar convites'}
                    </button>
                </>
            }
        >
            <Box title="Empresa">
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                    <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-display text-[12.5px] font-semibold uppercase tracking-[0.04em]">Nome</span>
                        <input className={inputCls} value={company} maxLength={150} onChange={(e) => setCompany(e.target.value)} />
                        {errors.company && <span className="text-live">{errors.company}</span>}
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-display text-[12.5px] font-semibold uppercase tracking-[0.04em]">NIF</span>
                        <input className={inputCls} value={nif} maxLength={20} onChange={(e) => setNif(e.target.value)} />
                    </label>
                </div>
            </Box>
            <Box title="Cursos e lugares">
                <label className="mb-3 flex items-center gap-3 text-sm">
                    <span className="font-display text-[12.5px] font-semibold uppercase tracking-[0.04em]">Packs de 10 lugares</span>
                    <input type="number" min="1" max="50" className={`${inputCls} w-24`} value={packs} onChange={(e) => setPacks(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                </label>
                <div className="flex flex-col gap-1">
                    {courses.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="text-accent focus:ring-accent" checked={courseIds.includes(c.id)}
                                onChange={(e) => setCourseIds(e.target.checked ? [...courseIds, c.id] : courseIds.filter((x) => x !== c.id))} />
                            {c.title}
                        </label>
                    ))}
                </div>
                {errors.course_ids && <p className="mt-2 text-sm text-live">Escolhe pelo menos um curso.</p>}
                <p className="mt-2 text-[12.5px] text-muted">Todos os membros da equipa têm acesso a todos os cursos escolhidos.</p>
            </Box>
            <MembersEditor people={people} setPeople={setPeople} leader={leader} setLeader={setLeader} seats={packs * 10} errors={errors} />
        </Drawer>
    );
}
