import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout, { initials } from '@/Layouts/StudentLayout';
import { exportTeamCsv } from '@/Components/Teams/TeamReport';
import { btn, Drawer, FlashToast, inputCls } from '@/Components/Teams/ui';
import PanelBoard, { alexDef, Bar, Crumb, PanelsMenu } from '@/Components/Panels/PanelBoard';
import usePanelBoard from '@/Components/Panels/usePanelBoard';

import { t } from '@/i18n';

const statusOf = (m, s) => (m.invited ? t('Convite por aceitar') : s.late ? t('Fora do prazo') : s.stalled ? t('Sem atividade') : s.progress === 100 ? t('Concluído') : s.last ? t('A estudar') : t('Ainda não começou'));
const needsAttention = (m, s) => m.invited || s.stalled || s.late;

function Person({ team, report, member, course, onAction }) {
    const s = member.courses[course] ?? {};
    return (
        <div className="pn-detail">
            <div className="pn-p-top">
                <div>
                    <span className="pn-lab">{team.name}{member.leader ? t(' · Team leader') : ''}</span>
                    <h3 className="pn-disp">{member.name}</h3>
                    <small>{member.email}{s.last ? t(' · Última atividade :last', { last: s.last }) : ''}</small>
                </div>
            </div>
            <div className="pn-p-stats">
                <div><span className="pn-lab">{t('Progresso')}</span><b className="pn-disp">{s.progress ?? 0}%</b></div>
                <div><span className="pn-lab">{t('Nota nos testes')}</span><b className="pn-disp">{s.score == null ? '—' : `${s.score}%`}</b></div>
                <div><span className="pn-lab">{t('Certificado')}</span><b className="pn-disp">{s.certificate ? t('Emitido') : '—'}</b></div>
                <div><span className="pn-lab">{t('Prazo')}</span><b className={`pn-disp ${s.late ? 'pn-late-t' : ''}`}>{s.due ?? '—'}</b></div>
            </div>
            {s.enrolled && (
                <div className="pn-p-acts">
                    <button type="button" className="ui-btn ui-btn-sm" disabled={!s.remindable} onClick={() => onAction('remind', [member.id])}>{t('Enviar lembrete')}</button>
                    <button type="button" className="ui-btn ui-btn-soft ui-btn-sm" onClick={() => onAction('assign', [member.id])}>{s.due ? t('Mudar o prazo') : t('Atribuir com prazo')}</button>
                    <small>
                        {member.remindersOff && s.progress !== 100
                            ? [t('Desligou os lembretes por email'), s.assigned && t('Atribuído a :assigned', { assigned: s.assigned })].filter(Boolean).join(' · ')
                            : [s.assigned && t('Atribuído a :assigned', { assigned: s.assigned }), s.reminded && t('Último lembrete :reminded', { reminded: s.reminded })].filter(Boolean).join(' · ')
                                || (s.progress === 100 ? t('Curso concluído.') : t('Ainda sem lembretes.'))}
                    </small>
                </div>
            )}
            <span className="pn-lab pn-p-h">{t('Cursos da equipa')}</span>
            {report.courses.map((c) => {
                const st = member.courses[c.id] ?? {};
                return (
                    <div key={c.id} className="pn-p-c">
                        <span>{c.title}</span>
                        <Bar value={st.progress ?? 0} />
                        <span>{st.progress ?? 0}{t('% feito')}</span>
                    </div>
                );
            })}
            <p className="pn-p-note">{t('Vês apenas os cursos da equipa. Os cursos que a pessoa compra por conta própria não aparecem aqui. Para adicionar ou retirar pessoas, usa “Pedir alteração”.')}</p>
        </div>
    );
}

// "Equipas" do team leader: só a sua equipa e os cursos da equipa. Alterações são pedidas ao Gestor de Cursos.
export default function Show({ team, report, otherCourses, changeTypes, alexUrl, savedLayout }) {
    const [asking, setAsking] = useState(false);
    const [action, setAction] = useState(null); // { mode: 'remind' | 'assign', members: [ids] }
    const [course, setCourse] = useState(report.courses[0]?.id ?? null);
    const [person, setPerson] = useState(() => report.members.find((m) => needsAttention(m, m.courses[report.courses[0]?.id] ?? {}))?.id ?? report.members[0]?.id ?? null);
    const members = report.members;
    const selected = members.find((m) => m.id === person);
    const attention = members.filter((m) => needsAttention(m, m.courses[course] ?? {})).length;

    const panels = {
        lista: {
            title: t('A minha equipa'), x: 0, y: 0, w: 6, h: 18, compact: true,
            summary: t(':n pessoas', { n: members.length }),
            body: (
                <>
                    {report.courses.length > 1 && (
                        <div className="pn-team-t ui-pills" role="group" aria-label={t('Curso')}>
                            {report.courses.map((c) => <button key={c.id} type="button" aria-pressed={course === c.id} onClick={() => setCourse(c.id)}>{c.title}</button>)}
                        </div>
                    )}
                    <p className="pn-team-s" style={report.courses.length > 1 ? undefined : { paddingTop: 12 }}>
                        {t(':used de :seats lugares', { used: members.length, seats: team.seats })} · {attention === 1 ? t(':n precisa de atenção', { n: attention }) : t(':n precisam de atenção', { n: attention })}
                        {report.courses.length === 0 && t(' · A equipa ainda não tem cursos')}
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
            title: t('Pessoa'), x: 6, y: 0, w: 13, h: 18, compact: true, float: 'light',
            body: selected
                ? <Person team={team} report={report} member={selected} course={course} onAction={(mode, ids) => setAction({ mode, members: ids })} />
                : <p className="pn-empty">{t('A equipa ainda não tem pessoas.')}</p>,
        },
        alex: alexDef(alexUrl, 0, 18),
    };
    const board = usePanelBoard({ view: 'equipas', panels, saved: savedLayout });

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title={t('Equipa')} />
            <Crumb label={t('Equipas · :name', { name: team.name })}>
                <button type="button" className="ui-btn ui-btn-soft ui-btn-sm" onClick={() => exportTeamCsv(team, report, course)}>{t('Exportar (Excel)')}</button>
                {report.courses.length > 0 && members.length > 0 && (
                    <>
                        <button type="button" className="ui-btn ui-btn-soft ui-btn-sm" onClick={() => setAction({ mode: 'remind', members: null })}>{t('Enviar lembrete')}</button>
                        <button type="button" className="ui-btn ui-btn-soft ui-btn-sm" onClick={() => setAction({ mode: 'assign', members: null })}>{t('Atribuir curso')}</button>
                    </>
                )}
                <button type="button" className="ui-btn ui-btn-sm" onClick={() => setAsking(true)}>{t('Pedir alteração')}</button>
            </Crumb>
            <PanelBoard board={board} />

            {action && (
                <PeopleAction
                    key={`${action.mode}-${course}`}
                    mode={action.mode}
                    team={team}
                    report={report}
                    course={course}
                    initial={action.members}
                    onClose={() => setAction(null)}
                />
            )}
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

// "Enviar lembrete" e "Atribuir curso": escolher o curso da equipa, as pessoas e, ao atribuir, o prazo.
function PeopleAction({ mode, team, report, course, initial, onClose }) {
    const remind = mode === 'remind';
    const stats = (m, c) => m.courses[c] ?? {};
    // Por omissão: ao lembrar, quem precisa de atenção e ainda pode receber; ao atribuir, toda a equipa
    const defaults = (c) => initial ?? report.members
        .filter((m) => (remind ? stats(m, c).remindable && needsAttention(m, stats(m, c)) : true))
        .map((m) => m.id);
    const { data, setData, post, processing, errors, transform } = useForm({
        course_id: course ?? report.courses[0]?.id ?? '',
        members: defaults(course),
        due_at: initial?.length === 1 ? stats(report.members.find((m) => m.id === initial[0]) ?? { courses: {} }, course).dueInput ?? '' : '',
        message: '',
    });
    transform((d) => ({ ...d, due_at: d.due_at || null }));
    const toggle = (id) => setData('members', data.members.includes(id) ? data.members.filter((x) => x !== id) : [...data.members, id]);
    const canPick = (m) => !remind || stats(m, data.course_id).remindable;
    const pickable = report.members.filter(canPick);
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const submit = (e) => {
        e.preventDefault();
        post(remind ? '/equipa/lembretes' : '/equipa/atribuir', { preserveScroll: true, onSuccess: onClose });
    };
    const err = (k) => errors[k] && <span className="text-[13px] text-live-ink">{errors[k]}</span>;
    const chosen = data.members.filter((id) => pickable.some((m) => m.id === id)).length;

    return (
        <Drawer
            sub={team.name}
            title={remind ? t('Enviar lembrete') : t('Atribuir curso')}
            onClose={onClose}
            width="w-[min(520px,100%)]"
            footer={<><span className="flex-1 text-[13px] text-muted">{chosen} {chosen === 1 ? t('pessoa escolhida') : t('pessoas escolhidas')}</span><button type="submit" form="people-form" disabled={processing || chosen === 0} className={btn.accent}>{processing ? t('A enviar…') : `${remind ? t('Enviar lembrete') : t('Atribuir')}${chosen ? ` a ${chosen} ${chosen === 1 ? 'pessoa' : 'pessoas'}` : ''}`}</button></>}
        >
            <form id="people-form" onSubmit={submit} className="flex flex-col gap-4">
                <p className="text-muted">
                    {remind
                        ? t('Cada pessoa recebe um email com o progresso no curso e o prazo, se houver. Quem já concluiu, recebeu um lembrete nas últimas horas ou desligou os lembretes fica de fora.')
                        : t('Cada pessoa recebe um email com o curso e o prazo. Sem data, cada pessoa mantém o prazo que já tinha.')}
                </p>
                <Field label={t('Curso')} id="p-course">
                    <select id="p-course" className={inputCls} value={data.course_id} onChange={(e) => {
                        const c = Number(e.target.value);
                        setData((d) => ({ ...d, course_id: c, members: initial ?? defaults(c) }));
                    }}>
                        {report.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    {err('course_id')}
                </Field>
                <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1.5 flex w-full items-center justify-between font-display text-[12.5px] font-semibold uppercase tracking-[0.04em]">
                        {t('Pessoas')}
                        <span className="flex gap-3 normal-case tracking-normal">
                            <button type="button" className="text-[13px] text-accent-ink hover:text-ink" onClick={() => setData('members', pickable.map((m) => m.id))}>{t('Todas')}</button>
                            <button type="button" className="text-[13px] text-muted hover:text-ink" onClick={() => setData('members', [])}>{t('Nenhuma')}</button>
                        </span>
                    </legend>
                    <div className="max-h-[300px] overflow-y-auto border border-line">
                        {report.members.map((m) => {
                            const s = stats(m, data.course_id);
                            const ok = canPick(m);
                            return (
                                <label key={m.id} className={`flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 ${ok ? 'cursor-pointer hover:bg-surface2' : 'opacity-55'}`}>
                                    <input type="checkbox" className="h-4 w-4 accent-[#F8B101]" disabled={!ok} checked={ok && data.members.includes(m.id)} onChange={() => toggle(m.id)} />
                                    <span className="min-w-0 flex-1">
                                        <b className="block truncate text-[14.5px] font-semibold">{m.name}</b>
                                        <small className="text-[12.5px] text-muted">
                                            {remind && !ok
                                                ? (s.progress === 100 ? t('Já concluiu') : s.reminded ? t('Lembrete enviado :reminded', { reminded: s.reminded }) : t('Sem acesso ao curso'))
                                                : [statusOf(m, s), `${s.progress ?? 0}%`, s.due && `prazo ${s.due}`].filter(Boolean).join(' · ')}
                                        </small>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    {err('members')}
                </fieldset>
                {!remind && (
                    <Field label={t('Prazo para concluir (opcional)')} id="p-due">
                        <input id="p-due" type="date" min={tomorrow} className={inputCls} value={data.due_at} onChange={(e) => setData('due_at', e.target.value)} />
                        {err('due_at')}
                    </Field>
                )}
                <Field label={t('Mensagem (opcional)')} id="p-msg">
                    <textarea id="p-msg" rows={3} className={inputCls} value={data.message} maxLength={1000}
                        placeholder={remind ? t('Ex.: lembra-te de acabar o módulo 2 antes da reunião de sexta.') : t('Ex.: este curso é para fazer antes da formação presencial.')}
                        onChange={(e) => setData('message', e.target.value)} />
                    {err('message')}
                </Field>
            </form>
        </Drawer>
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
    const err = (k) => errors[k] && <span className="text-[13px] text-live-ink">{errors[k]}</span>;

    return (
        <Drawer
            sub={team.name}
            title={t('Pedir alteração')}
            onClose={onClose}
            width="w-[min(520px,100%)]"
            footer={<><span className="flex-1" /><button type="submit" form="change-form" disabled={processing} className={btn.accent}>{processing ? t('A enviar…') : t('Enviar pedido')}</button></>}
        >
            <form id="change-form" onSubmit={submit} className="flex flex-col gap-4">
                <p className="text-muted">{t('O pedido vai para a equipa de gestão de cursos da T.Academy, que trata da alteração e te responde por email.')}</p>
                <div>
                    <span className="mb-1.5 block font-display text-[12.5px] font-semibold uppercase tracking-[0.04em]">{t('O que precisas?')}</span>
                    <div role="group" aria-label={t('Tipo de alteração')} className="inline-flex flex-wrap gap-[3px] bg-surface2 p-[3px]">
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
                        <Field label={t('Nome')} id="c-name">
                            <input id="c-name" className={inputCls} value={data.name} maxLength={150} placeholder={t('Nome completo')} onChange={(e) => setData('name', e.target.value)} />
                            {err('name')}
                        </Field>
                        <Field label={t('Email')} id="c-email">
                            <input id="c-email" type="email" className={inputCls} value={data.email} maxLength={150} placeholder="email@empresa.pt" onChange={(e) => setData('email', e.target.value)} />
                            {err('email')}
                        </Field>
                        <p className={`text-[12.5px] ${free > 0 ? 'text-muted' : 'text-live-ink'}`}>
                            {free > 0 ? t('Lugares livres: :free.', { free }) : t('Não há lugares livres. O gestor de cursos vai propor um pack adicional.')}
                        </p>
                    </>
                )}
                {data.change_type === 'retirar' && (
                    <Field label={t('Quem sai da equipa?')} id="c-member">
                        <select id="c-member" className={inputCls} value={data.member_id} onChange={(e) => setData('member_id', e.target.value)}>
                            <option value="">{t('Escolher…')}</option>
                            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {err('member_id')}
                        <span className="text-[12.5px] text-muted">{t('A pessoa mantém os certificados já obtidos.')}</span>
                    </Field>
                )}
                {data.change_type === 'lugares' && (
                    <Field label={t('Quantos packs de 10 lugares?')} id="c-packs">
                        <select id="c-packs" className={inputCls} value={data.packs} onChange={(e) => setData('packs', Number(e.target.value))}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 1 ? t('1 pack (+10 lugares)') : t(':n packs (+:seats lugares)', { n, seats: n * 10 })}</option>)}
                        </select>
                    </Field>
                )}
                {data.change_type === 'curso' && (
                    <Field label={t('Curso')} id="c-course">
                        <select id="c-course" className={inputCls} value={data.course_id} onChange={(e) => setData('course_id', e.target.value)}>
                            {otherCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        {err('course_id')}
                    </Field>
                )}
                <Field label={data.change_type === 'outro' ? t('Mensagem') : t('Mensagem (opcional)')} id="c-msg">
                    <textarea id="c-msg" rows={4} className={inputCls} value={data.message} maxLength={3000}
                        placeholder={t('Ex.: entrou um técnico novo na oficina.')} onChange={(e) => setData('message', e.target.value)} />
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
