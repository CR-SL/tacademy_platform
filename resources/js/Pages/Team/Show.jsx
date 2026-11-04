import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout, { initials } from '@/Layouts/StudentLayout';
import { exportTeamCsv } from '@/Components/Teams/TeamReport';
import { btn, Drawer, FlashToast, inputCls } from '@/Components/Teams/ui';
import PanelBoard, { alexDef, Bar, Crumb, PanelsMenu } from '@/Components/Panels/PanelBoard';
import usePanelBoard from '@/Components/Panels/usePanelBoard';

const statusOf = (m, s) => (m.invited ? 'Convite por aceitar' : s.stalled ? 'Sem atividade' : s.last ? 'A estudar' : 'Ainda não começou');
const needsAttention = (m, s) => m.invited || s.stalled;

function Person({ team, report, member, course }) {
    const s = member.courses[course] ?? {};
    return (
        <div className="pn-detail">
            <div className="pn-p-top">
                <div>
                    <span className="pn-lab">{team.name}{member.leader ? ' · Team leader' : ''}</span>
                    <h3 className="pn-disp">{member.name}</h3>
                    <small>{member.email}{s.last ? ` · Última atividade ${s.last}` : ''}</small>
                </div>
            </div>
            <div className="pn-p-stats">
                <div><span className="pn-lab">Progresso</span><b className="pn-disp">{s.progress ?? 0}%</b></div>
                <div><span className="pn-lab">Nota nos testes</span><b className="pn-disp">{s.score == null ? '—' : `${s.score}%`}</b></div>
                <div><span className="pn-lab">Certificado</span><b className="pn-disp">{s.certificate ? 'Emitido' : '—'}</b></div>
            </div>
            <span className="pn-lab pn-p-h">Cursos da equipa</span>
            {report.courses.map((c) => {
                const st = member.courses[c.id] ?? {};
                return (
                    <div key={c.id} className="pn-p-c">
                        <span>{c.title}</span>
                        <Bar value={st.progress ?? 0} />
                        <span>{st.progress ?? 0}% feito</span>
                    </div>
                );
            })}
            <p className="pn-p-note">Vês apenas os cursos da equipa. Os cursos que a pessoa compra por conta própria não aparecem aqui. Para adicionar ou retirar pessoas, usa “Pedir alteração”.</p>
        </div>
    );
}

// "Equipas" do team leader: só a sua equipa e os cursos da equipa. Alterações são pedidas ao Gestor de Cursos.
export default function Show({ team, report, otherCourses, changeTypes, alexUrl, savedLayout }) {
    const [asking, setAsking] = useState(false);
    const [course, setCourse] = useState(report.courses[0]?.id ?? null);
    const [person, setPerson] = useState(() => report.members.find((m) => needsAttention(m, m.courses[report.courses[0]?.id] ?? {}))?.id ?? report.members[0]?.id ?? null);
    const members = report.members;
    const selected = members.find((m) => m.id === person);
    const attention = members.filter((m) => needsAttention(m, m.courses[course] ?? {})).length;

    const panels = {
        lista: {
            title: 'A minha equipa', x: 0, y: 0, w: 6, h: 18, compact: true,
            summary: `${members.length} pessoas`,
            body: (
                <>
                    {report.courses.length > 1 && (
                        <div className="pn-team-t pn-pills" role="group" aria-label="Curso">
                            {report.courses.map((c) => <button key={c.id} type="button" aria-pressed={course === c.id} onClick={() => setCourse(c.id)}>{c.title}</button>)}
                        </div>
                    )}
                    <p className="pn-team-s" style={report.courses.length > 1 ? undefined : { paddingTop: 12 }}>
                        {members.length} de {team.seats} lugares · {attention} {attention === 1 ? 'precisa' : 'precisam'} de atenção
                        {report.courses.length === 0 && ' · A equipa ainda não tem cursos'}
                    </p>
                    {members.map((m) => {
                        const s = m.courses[course] ?? {};
                        return (
                            <button key={m.id} type="button" className={`pn-p-row ${m.id === person ? 'pn-on' : ''} ${needsAttention(m, s) ? 'pn-late' : ''}`} onClick={() => setPerson(m.id)}>
                                <span className="pn-av">{initials(m.name)}</span>
                                <b>{m.name}</b>
                                <em>{statusOf(m, s)}</em>
                                <Bar value={s.progress ?? 0} />
                            </button>
                        );
                    })}
                </>
            ),
        },
        pessoa: {
            title: 'Pessoa', x: 6, y: 0, w: 13, h: 18, compact: true, float: 'light',
            body: selected ? <Person team={team} report={report} member={selected} course={course} /> : <p className="pn-empty">A equipa ainda não tem pessoas.</p>,
        },
        alex: alexDef(alexUrl, 0, 18),
    };
    const board = usePanelBoard({ view: 'equipas', panels, saved: savedLayout });

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title="Equipa" />
            <Crumb label={`Equipas · ${team.name}`}>
                <button type="button" className="pn-btn pn-soft pn-sm" onClick={() => exportTeamCsv(team, report, course)}>Exportar (Excel)</button>
                <button type="button" className="pn-btn pn-sm" onClick={() => setAsking(true)}>Pedir alteração</button>
            </Crumb>
            <PanelBoard board={board} />

            {asking && (
                <ChangeRequest
                    team={team}
                    members={report.members}
                    otherCourses={otherCourses}
                    changeTypes={changeTypes}
                    onClose={() => setAsking(false)}
                />
            )}
            <FlashToast />
        </StudentLayout>
    );
}

function ChangeRequest({ team, members, otherCourses, changeTypes, onClose }) {
    const { data, setData, post, processing, errors } = useForm({
        change_type: 'adicionar', name: '', email: '', member_id: '', packs: 1, course_id: otherCourses[0]?.id ?? '', message: '',
    });
    const free = team.seats - members.length;
    const submit = (e) => {
        e.preventDefault();
        post('/equipa/pedidos', { preserveScroll: true, onSuccess: onClose });
    };
    const err = (k) => errors[k] && <span className="text-[13px] text-live">{errors[k]}</span>;

    return (
        <Drawer
            over={team.name}
            title="Pedir alteração"
            onClose={onClose}
            width="w-[min(520px,100%)]"
            footer={<><span className="flex-1" /><button type="submit" form="change-form" disabled={processing} className={btn.accent}>{processing ? 'A enviar…' : 'Enviar pedido'}</button></>}
        >
            <form id="change-form" onSubmit={submit} className="flex flex-col gap-4">
                <p className="text-muted">O pedido vai para a equipa de gestão de cursos da T.Academy, que trata da alteração e te responde por email.</p>
                <div>
                    <span className="mb-1.5 block font-display text-[12.5px] font-semibold uppercase tracking-[0.04em]">O que precisas?</span>
                    <div role="group" aria-label="Tipo de alteração" className="ta-cut-8 inline-flex flex-wrap gap-[3px] bg-surface2 p-[3px]">
                        {Object.entries(changeTypes).map(([k, label]) => (
                            <button key={k} type="button" aria-pressed={data.change_type === k} onClick={() => setData('change_type', k)}
                                className={`px-3 py-2 font-display text-[13px] font-semibold ${data.change_type === k ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {data.change_type === 'adicionar' && (
                    <>
                        <Field label="Nome" id="c-name">
                            <input id="c-name" className={inputCls} value={data.name} maxLength={150} placeholder="Nome completo" onChange={(e) => setData('name', e.target.value)} />
                            {err('name')}
                        </Field>
                        <Field label="Email" id="c-email">
                            <input id="c-email" type="email" className={inputCls} value={data.email} maxLength={150} placeholder="email@empresa.pt" onChange={(e) => setData('email', e.target.value)} />
                            {err('email')}
                        </Field>
                        <p className={`text-[12.5px] ${free > 0 ? 'text-muted' : 'text-live'}`}>
                            {free > 0 ? `Lugares livres: ${free}.` : 'Não há lugares livres — o gestor de cursos vai propor um pack adicional.'}
                        </p>
                    </>
                )}
                {data.change_type === 'retirar' && (
                    <Field label="Quem sai da equipa?" id="c-member">
                        <select id="c-member" className={inputCls} value={data.member_id} onChange={(e) => setData('member_id', e.target.value)}>
                            <option value="">Escolher…</option>
                            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {err('member_id')}
                        <span className="text-[12.5px] text-muted">A pessoa mantém os certificados já obtidos.</span>
                    </Field>
                )}
                {data.change_type === 'lugares' && (
                    <Field label="Quantos packs de 10 lugares?" id="c-packs">
                        <select id="c-packs" className={inputCls} value={data.packs} onChange={(e) => setData('packs', Number(e.target.value))}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} pack{n > 1 ? 's' : ''} (+{n * 10} lugares)</option>)}
                        </select>
                    </Field>
                )}
                {data.change_type === 'curso' && (
                    <Field label="Curso" id="c-course">
                        <select id="c-course" className={inputCls} value={data.course_id} onChange={(e) => setData('course_id', e.target.value)}>
                            {otherCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        {err('course_id')}
                    </Field>
                )}
                <Field label={data.change_type === 'outro' ? 'Mensagem' : 'Mensagem (opcional)'} id="c-msg">
                    <textarea id="c-msg" rows={4} className={inputCls} value={data.message} maxLength={3000}
                        placeholder="Ex.: entrou um técnico novo na oficina." onChange={(e) => setData('message', e.target.value)} />
                    {err('message')}
                </Field>
            </form>
        </Drawer>
    );
}

function Field({ label, id, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="font-display text-[12.5px] font-semibold uppercase tracking-[0.04em]">{label}</label>
            {children}
        </div>
    );
}
