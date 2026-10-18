import { useState } from 'react';
import { Chip, Kpi, Progress, Tabs, Td, Th } from './ui';

// Progresso da equipa nos cursos da equipa: o que o team leader vê (e o gestor, na página da equipa).
export default function TeamReport({ team, report, note }) {
    const [courseId, setCourseId] = useState(report.courses[0]?.id ?? null);
    const members = report.members;
    const stats = (m) => m.courses[courseId] ?? {};
    const n = members.length || 1;
    const avg = Math.round(members.reduce((a, m) => a + (stats(m).progress ?? 0), 0) / n);
    const certs = members.filter((m) => stats(m).certificate).length;
    const attention = members.filter((m) => m.invited || stats(m).stalled).length;

    const exportCsv = () => {
        const course = report.courses.find((c) => c.id === courseId)?.title ?? '';
        const rows = [['Nome', 'Email', 'Team leader', 'Curso', 'Progresso %', 'Nota quizzes %', 'Última atividade', 'Certificado']];
        members.forEach((m) => {
            const s = stats(m);
            rows.push([m.name, m.email, m.leader ? 'sim' : '', course, s.progress ?? 0, s.score ?? '', m.invited ? 'nunca entrou' : s.last ?? '', s.certificate ? 'sim' : '']);
        });
        const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `equipa-${team.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <>
            <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Kpi label="Lugares" value={`${members.length} / ${team.seats}`} bar={(members.length / team.seats) * 100}
                    hint={`${team.packs} pack${team.packs > 1 ? 's' : ''} de 10 · ${Math.max(0, team.seats - members.length)} livres`} />
                <Kpi label="Progresso médio" value={`${avg}%`} hint="neste curso" />
                <Kpi label="Certificados" value={certs} hint={`de ${members.length} alunos`} />
                <Kpi label="Precisam de atenção" value={attention} alert={attention > 0} hint="parados ou sem entrar" />
            </div>

            <div className="ta-cut-16 bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    {report.courses.length > 0
                        ? <Tabs label="Cursos da equipa" items={report.courses.map((c) => [c.id, c.title])} value={courseId} onChange={setCourseId} />
                        : <p className="mb-4 text-muted">A equipa ainda não tem cursos.</p>}
                    <button type="button" onClick={exportCsv} className="px-2 py-2 font-display text-[13px] font-semibold text-accent-ink hover:text-ink">
                        ⭳ Exportar (Excel)
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[15px]">
                        <thead>
                            <tr><Th>Aluno</Th><Th>Progresso</Th><Th>Nota quizzes</Th><Th className="hidden md:table-cell">Última atividade</Th><Th>Certificado</Th></tr>
                        </thead>
                        <tbody>
                            {members.map((m) => {
                                const s = stats(m);
                                return (
                                    <tr key={m.id}>
                                        <Td>
                                            <b className="block font-semibold">
                                                {m.name}
                                                {m.leader && <span className="ml-1.5 bg-ink px-1.5 py-0.5 align-[1px] font-mono text-[9.5px] font-bold tracking-[0.08em] text-accent">TEAM LEADER</span>}
                                            </b>
                                            <small className="text-[12.5px] text-muted">{m.email}</small>
                                        </Td>
                                        <Td><Progress value={s.progress ?? 0} /></Td>
                                        <Td>{s.score == null ? <span className="text-muted">—</span> : <b className="font-display">{s.score}%</b>}</Td>
                                        <Td className="hidden md:table-cell">
                                            {m.invited ? <Chip tone="bad">Convite por aceitar</Chip>
                                                : s.stalled ? <Chip tone="warn">Parado · {s.last}</Chip>
                                                : s.last ?? <span className="text-muted">Ainda não começou</span>}
                                        </Td>
                                        <Td>{s.certificate ? <Chip tone="ok">✓ Emitido</Chip> : <span className="text-muted">—</span>}</Td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {note && <p className="mt-3.5 flex gap-2 text-[12.5px] text-muted">ⓘ {note}</p>}
            </div>
        </>
    );
}
