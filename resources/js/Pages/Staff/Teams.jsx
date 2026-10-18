import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { Chip, FlashToast, Kpi, Over, PageHead, Progress, Tabs, Td, Th } from '@/Components/Teams/ui';

// "Equipas" do Gestor de Cursos e do admin: equipas de empresas e alunos individuais.
export default function Teams({ teams, individuals, newRequests }) {
    const { auth } = usePage().props;
    const [tab, setTab] = useState('equipas');
    const seats = teams.reduce((a, t) => a + t.seats, 0);
    const used = teams.reduce((a, t) => a + t.members, 0);

    return (
        <StudentLayout>
            <Head title="Equipas" />
            <PageHead over={<Over>{auth.role === 'admin' ? 'Administração' : 'Gestão de cursos'}</Over>} title="Equipas" sub="Todas as equipas de empresas e os alunos individuais." />

            <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Kpi label="Equipas" value={teams.length} />
                <Kpi label="Lugares usados" value={`${used} / ${seats}`} bar={seats ? (used / seats) * 100 : 0} />
                <Kpi label="Alunos individuais" value={individuals.filter((i) => !i.team).length} />
                <Kpi label="Pedidos novos" value={newRequests} alert={newRequests > 0}
                    hint={<Link href="/gestao/pedidos" className="text-accent-ink hover:text-ink">Ver pedidos →</Link>} />
            </div>

            <Tabs label="Ver" value={tab} onChange={setTab} items={[['equipas', 'Equipas', teams.length], ['individuais', 'Alunos individuais', individuals.length]]} />

            <div className="ta-cut-16 overflow-x-auto bg-surface px-3.5 py-2">
                {tab === 'equipas' ? (
                    teams.length ? (
                        <table className="w-full border-collapse text-[15px]">
                            <thead><tr><Th>Empresa</Th><Th>Team leader</Th><Th className="hidden lg:table-cell">Cursos</Th><Th>Lugares</Th><Th>Concluídos</Th><Th className="hidden md:table-cell">Criada</Th></tr></thead>
                            <tbody>
                                {teams.map((t) => (
                                    <tr key={t.ulid} className="cursor-pointer hover:bg-page" onClick={() => router.visit(`/gestao/equipas/${t.ulid}`)}>
                                        <Td>
                                            <Link href={`/gestao/equipas/${t.ulid}`} className="block font-semibold">{t.name}</Link>
                                            {t.nif && <small className="text-[12.5px] text-muted">NIF {t.nif}</small>}
                                        </Td>
                                        <Td>{t.leader ? <><b className="block font-semibold">{t.leader.name}</b><small className="text-[12.5px] text-muted">{t.leader.email}</small></> : <span className="text-muted">—</span>}</Td>
                                        <Td className="hidden lg:table-cell">{t.courses.map((c) => <span key={c} className="mb-1 mr-1 inline-block"><Chip>{c}</Chip></span>)}</Td>
                                        <Td><b className="font-display">{t.members}/{t.seats}</b></Td>
                                        <Td><Progress value={t.enrollments ? Math.round((t.completed / t.enrollments) * 100) : 0} /></Td>
                                        <Td className="hidden text-muted md:table-cell">{t.created}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="px-4 py-10 text-center text-muted">Ainda não há equipas. Criam-se a partir de um pedido de compra pago, em “Pedidos”.</p>
                ) : individuals.length ? (
                    <>
                        <table className="w-full border-collapse text-[15px]">
                            <thead><tr><Th>Aluno</Th><Th>Cursos a título pessoal</Th><Th className="hidden md:table-cell">Última atividade</Th><Th className="hidden md:table-cell">Equipa</Th></tr></thead>
                            <tbody>
                                {individuals.map((s) => (
                                    <tr key={s.email}>
                                        <Td><b className="block font-semibold">{s.name}</b><small className="text-[12.5px] text-muted">{s.email}</small></Td>
                                        <Td>{s.courses.map((c) => (
                                            <div key={c.title} className="my-0.5 flex items-center gap-2 text-sm">
                                                {c.title}{c.status === 'completed' && <Chip tone="ok">Concluído</Chip>}
                                            </div>
                                        ))}</Td>
                                        <Td className="hidden md:table-cell">{s.last ?? <span className="text-muted">—</span>}</Td>
                                        <Td className="hidden md:table-cell">{s.team ? <Chip tone="dark">{s.team}</Chip> : <span className="text-muted">Particular</span>}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="px-3 py-3 text-[12.5px] text-muted">ⓘ Cursos comprados a título pessoal. Quem também pertence a uma equipa aparece com a etiqueta da equipa — o team leader não vê estes cursos.</p>
                    </>
                ) : <p className="px-4 py-10 text-center text-muted">Ainda não há alunos com cursos a título pessoal.</p>}
            </div>
            <FlashToast />
        </StudentLayout>
    );
}
