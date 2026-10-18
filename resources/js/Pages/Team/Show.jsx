import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import TeamReport from '@/Components/Teams/TeamReport';
import { btn, Drawer, FlashToast, inputCls, Over, PageHead } from '@/Components/Teams/ui';

// "Equipa" do team leader: só a sua equipa e os cursos da equipa. Alterações são pedidas ao Gestor de Cursos.
export default function Show({ team, report, otherCourses, changeTypes }) {
    const [asking, setAsking] = useState(false);

    return (
        <StudentLayout>
            <Head title="Equipa" />
            <PageHead
                over={<Over>A minha equipa</Over>}
                title={team.name}
                sub={`${report.members.length} membros · ${report.courses.length} ${report.courses.length === 1 ? 'curso' : 'cursos'}${team.created ? ` · equipa criada a ${team.created}` : ''}`}
            >
                <button type="button" className={btn.accent} onClick={() => setAsking(true)}>Pedir alteração</button>
            </PageHead>

            <TeamReport
                team={team}
                report={report}
                note="Vês apenas os cursos da equipa — cursos que os alunos comprem a título pessoal não aparecem aqui. Para adicionar ou retirar pessoas, usa “Pedir alteração”."
            />

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
