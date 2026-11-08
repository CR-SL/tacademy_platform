import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { Chip, FlashToast, Kpi, PageHead, Progress, Tabs, Td, Th } from '@/Components/Teams/ui';

import { t } from '@/i18n';

// "Equipas" do Gestor de Cursos e do admin: equipas de empresas e alunos individuais.
export default function Teams({ teams, individuals, newRequests }) {
    const [tab, setTab] = useState('equipas');
    const seats = teams.reduce((a, tx) => a + tx.seats, 0);
    const used = teams.reduce((a, tx) => a + tx.members, 0);

    return (
        <StudentLayout>
            <Head title={t('Equipas')} />
            <PageHead title={t('Equipas')} sub={t('Todas as equipas de empresas e os alunos individuais.')} />

            <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Kpi label={t('Equipas')} value={teams.length} />
                <Kpi label={t('Lugares usados')} value={`${used} / ${seats}`} bar={seats ? (used / seats) * 100 : 0} />
                <Kpi label={t('Alunos individuais')} value={individuals.filter((i) => !i.team).length} />
                <Kpi label={t('Pedidos novos')} value={newRequests} alert={newRequests > 0}
                    hint={<Link href="/gestao/pedidos" className="text-accent-ink hover:text-ink">{t('Ver pedidos →')}</Link>} />
            </div>

            <Tabs label={t('Ver')} value={tab} onChange={setTab} items={[['equipas', t('Equipas'), teams.length], ['individuais', t('Alunos individuais'), individuals.length]]} />

            <div className="overflow-x-auto bg-surface px-3.5 py-2">
                {tab === 'equipas' ? (
                    teams.length ? (
                        <table className="w-full border-collapse text-[15px]">
                            <thead><tr><Th>{t('Empresa')}</Th><Th>{t('Team leader')}</Th><Th className="hidden lg:table-cell">{t('Cursos')}</Th><Th>{t('Lugares')}</Th><Th>{t('Concluídos')}</Th><Th className="hidden md:table-cell">{t('Criada')}</Th></tr></thead>
                            <tbody>
                                {teams.map((tx) => (
                                    <tr key={tx.ulid} className="cursor-pointer hover:bg-page" onClick={() => router.visit(`/gestao/equipas/${tx.ulid}`)}>
                                        <Td>
                                            <Link href={`/gestao/equipas/${tx.ulid}`} className="block font-semibold">{tx.name}</Link>
                                            {tx.nif && <small className="text-[12.5px] text-muted">{t('NIF')}{' '}{tx.nif}</small>}
                                        </Td>
                                        <Td>{tx.leader ? <><b className="block font-semibold">{tx.leader.name}</b><small className="text-[12.5px] text-muted">{tx.leader.email}</small></> : <span className="text-muted">—</span>}</Td>
                                        <Td className="hidden lg:table-cell">{tx.courses.map((c) => <span key={c} className="mb-1 mr-1 inline-block"><Chip>{c}</Chip></span>)}</Td>
                                        <Td><b className="font-display">{tx.members}/{tx.seats}</b></Td>
                                        <Td><Progress value={tx.enrollments ? Math.round((tx.completed / tx.enrollments) * 100) : 0} /></Td>
                                        <Td className="hidden text-muted md:table-cell">{tx.created}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="px-4 py-10 text-center text-muted">{t('Ainda não há equipas. Criam-se a partir de um pedido de compra pago, em “Pedidos”.')}</p>
                ) : individuals.length ? (
                    <>
                        <table className="w-full border-collapse text-[15px]">
                            <thead><tr><Th>{t('Aluno')}</Th><Th>{t('Cursos a título pessoal')}</Th><Th className="hidden md:table-cell">{t('Última atividade')}</Th><Th className="hidden md:table-cell">{t('Equipa')}</Th></tr></thead>
                            <tbody>
                                {individuals.map((s) => (
                                    <tr key={s.email}>
                                        <Td><b className="block font-semibold">{s.name}</b><small className="text-[12.5px] text-muted">{s.email}</small></Td>
                                        <Td>{s.courses.map((c) => (
                                            <div key={c.title} className="my-0.5 flex items-center gap-2 text-sm">
                                                {c.title}{c.status === 'completed' && <Chip tone="ok">{t('Concluído')}</Chip>}
                                            </div>
                                        ))}</Td>
                                        <Td className="hidden md:table-cell">{s.last ?? <span className="text-muted">—</span>}</Td>
                                        <Td className="hidden md:table-cell">{s.team ? <Chip tone="dark">{s.team}</Chip> : <span className="text-muted">{t('Particular')}</span>}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="px-3 py-3 text-[12.5px] text-muted">{t('ⓘ Cursos comprados a título pessoal. Quem também pertence a uma equipa aparece com a etiqueta da equipa: o team leader não vê estes cursos.')}</p>
                    </>
                ) : <p className="px-4 py-10 text-center text-muted">{t('Ainda não há alunos com cursos a título pessoal.')}</p>}
            </div>
            <FlashToast />
        </StudentLayout>
    );
}
