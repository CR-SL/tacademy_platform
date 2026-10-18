import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import TeamReport from '@/Components/Teams/TeamReport';
import MembersEditor from '@/Components/Teams/MembersEditor';
import { Box, btn, Drawer, FlashToast, inputCls, PageHead } from '@/Components/Teams/ui';

// Equipa vista pelo Gestor de Cursos/admin: o mesmo que o team leader vê + gerir membros, lugares e cursos.
export default function TeamShow({ team, report, courses, pending }) {
    const [editing, setEditing] = useState(false);

    return (
        <StudentLayout>
            <Head title={team.name} />
            <PageHead
                over={<Link href="/gestao/equipas" className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted hover:text-ink">← Equipas</Link>}
                title={team.name}
                sub={`${report.members.length} membros · ${report.courses.length} ${report.courses.length === 1 ? 'curso' : 'cursos'}${team.created ? ` · criada a ${team.created}` : ''}${team.nif ? ` · NIF ${team.nif}` : ''}`}
            >
                <button type="button" className={btn.dark} onClick={() => setEditing(true)}>Gerir membros</button>
            </PageHead>

            {pending.length > 0 && (
                <div className="ta-cut-12 mb-5 bg-accent/15 px-5 py-4">
                    <p className="font-display font-bold">{pending.length === 1 ? 'Há 1 pedido de alteração' : `Há ${pending.length} pedidos de alteração`} desta equipa</p>
                    {pending.map((p) => (
                        <p key={p.id} className="mt-1 text-sm">
                            <b>#{p.id} · {p.change}</b>{p.people.length ? ` — ${p.people.map((x) => `${x.name} (${x.email})`).join(', ')}` : ''}{p.packs ? ` — +${p.packs} pack(s)` : ''} <span className="text-muted">· {p.date}</span>
                        </p>
                    ))}
                    <button type="button" className="mt-2 font-display text-[13px] font-semibold text-accent-ink hover:text-ink" onClick={() => setEditing(true)}>Tratar em “Gerir membros” →</button>
                </div>
            )}

            <TeamReport team={team} report={report} note="O team leader vê esta mesma página, mas não pode adicionar nem retirar pessoas." />

            {editing && <EditTeam team={team} report={report} courses={courses} pending={pending} onClose={() => setEditing(false)} />}
            <FlashToast />
        </StudentLayout>
    );
}

function EditTeam({ team, report, courses, pending, onClose }) {
    // Já traz as pessoas pedidas para adicionar e assinala as pedidas para retirar
    const toAdd = pending.flatMap((p) => (p.change.startsWith('Adicionar') ? p.people : []));
    const toRemove = new Set(pending.flatMap((p) => (p.change.startsWith('Retirar') ? p.people.map((x) => x.email) : [])));
    const extraPacks = pending.reduce((a, p) => a + (p.packs || 0), 0);
    const extraCourses = pending.map((p) => p.course_id).filter(Boolean);

    const [people, setPeople] = useState([
        ...report.members.filter((m) => !toRemove.has(m.email)).map((m) => ({ name: m.name, email: m.email })),
        ...toAdd.filter((p) => !report.members.some((m) => m.email === p.email)),
    ]);
    const [leader, setLeader] = useState(report.members.find((m) => m.leader)?.email ?? '');
    const [packs, setPacks] = useState(team.packs + extraPacks);
    const [courseIds, setCourseIds] = useState([...new Set([...team.course_ids, ...extraCourses])]);
    const [resolve, setResolve] = useState(pending.map((p) => p.id));
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    const save = () => {
        setBusy(true);
        router.put(`/gestao/equipas/${team.ulid}`, { packs, course_ids: courseIds, people, leader, resolve }, {
            preserveScroll: true,
            onSuccess: onClose,
            onError: setErrors,
            onFinish: () => setBusy(false),
        });
    };

    return (
        <Drawer
            over="Gerir membros"
            title={team.name}
            onClose={onClose}
            footer={
                <>
                    <span className="text-[13px] text-muted">Pessoas novas recebem convite; quem sai perde o acesso aos cursos da equipa.</span>
                    <span className="flex-1" />
                    <button type="button" className={btn.accent} disabled={busy || people.length > packs * 10} onClick={save}>{busy ? 'A guardar…' : 'Guardar alterações'}</button>
                </>
            }
        >
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
                {errors.course_ids && <p className="mt-2 text-sm text-live">A equipa tem de ter pelo menos um curso.</p>}
            </Box>
            <MembersEditor people={people} setPeople={setPeople} leader={leader} setLeader={setLeader} seats={packs * 10} errors={errors} />
            {pending.length > 0 && (
                <Box title="Pedidos de alteração">
                    {pending.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
                            <input type="checkbox" className="text-accent focus:ring-accent" checked={resolve.includes(p.id)}
                                onChange={(e) => setResolve(e.target.checked ? [...resolve, p.id] : resolve.filter((x) => x !== p.id))} />
                            Marcar o pedido #{p.id} ({p.change}) como concluído
                        </label>
                    ))}
                </Box>
            )}
        </Drawer>
    );
}
