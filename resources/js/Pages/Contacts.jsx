import { Head, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { Button, Field, Pills, inputCls } from '@/Components/ui';

import { t } from '@/i18n';

// Contactos da plataforma (2026-11-10): abertos com e sem sessão. O pedido entra nos Pedidos do
// Gestor de Cursos; com sessão, o nome e o email vêm da conta (ContactRequestForm).

// Ícones das redes sociais (os do antigo /contactos), na cor de destaque sobre fundo escuro
const SOCIAL_ICONS = {
    linkedin: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3 9h3v12H3zM9 9h2.9v1.7h.1c.4-.8 1.4-1.9 3.1-1.9 3.3 0 3.9 2.2 3.9 5V21h-3v-6.2c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21H9z" /></svg>,
    instagram: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
    facebook: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.6V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.4H7.6V13h2.7v8z" /></svg>,
};
export default function Contacts({ courses, teamSizes, faqs, contact, social, sent }) {
    const { auth } = usePage().props;
    const user = auth?.user ?? null;
    const [who, setWho] = useState('particular');
    const direct = [
        ['Email', contact?.email, contact?.email && `mailto:${contact.email}`],
        ['Telefone', contact?.phone, contact?.phone && `tel:${contact.phone.replace(/\s+/g, '')}`],
        ['Horário', contact?.hours],
        ['Morada', contact?.address],
    ].filter(([, v]) => v);

    return (
        <StudentLayout>
            <Head title={t('Contactos')} />

            <div className="mb-8 max-w-2xl">
                <h1 className="font-display text-[clamp(30px,3.4vw,44px)] font-bold leading-none tracking-[-0.01em]">{t('Contactos')}</h1>
                <p className="mt-2 text-muted">{t('Dúvidas sobre um curso, formação para a tua equipa ou ajuda com a plataforma. Respondemos por email.')}</p>
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section aria-labelledby="ct-form" className="bg-surface p-6 sm:p-8">
                    {sent ? (
                        <Sent sent={sent} responseTime={contact?.response_time} />
                    ) : (
                        <>
                            <h2 id="ct-form" className="font-display text-xl font-bold">{t('Pedir contacto')}</h2>
                            {user && (
                                <p className="mt-1 text-sm text-muted">
                                    {t('Respondemos para :email.', { email: user.email ?? '' })}
                                </p>
                            )}
                            <ContactForm guest={!user} who={who} setWho={setWho} courses={courses} teamSizes={teamSizes} responseTime={contact?.response_time} />
                        </>
                    )}
                </section>

                <aside className="grid gap-3">
                    {direct.length > 0 && (
                        <div className="bg-surface p-6">
                            <h2 className="pn-lab mb-3">{t('Contacto direto')}</h2>
                            <dl className="grid gap-3 text-sm">
                                {direct.map(([label, value, href]) => (
                                    <div key={label}>
                                        <dt className="text-[12px] font-semibold text-muted">{t(label)}</dt>
                                        <dd className="font-semibold">{href ? <a href={href} className="underline underline-offset-4">{value}</a> : value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                    <div className="bg-surface p-6">
                        <h2 className="pn-lab mb-1">{t('Segue-nos')}</h2>
                        <p className="mb-3 text-sm text-muted">{t('Novidades, cursos novos e dicas de oficina.')}</p>
                        <ul className="grid gap-2">
                            {Object.entries(social ?? {}).map(([key, net]) => (
                                <li key={key}>
                                    <a href={net.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3.5 bg-page p-3 pr-4 text-sm transition-[transform,background-color] duration-200 hover:translate-x-1.5 hover:bg-surface2 motion-reduce:transition-none">
                                        {SOCIAL_ICONS[key] && (
                                            <span aria-hidden="true" className="grid h-[46px] w-[46px] flex-none place-items-center bg-[#18181B] text-accent [&>svg]:h-[22px] [&>svg]:w-[22px]">{SOCIAL_ICONS[key]}</span>
                                        )}
                                        <span className="min-w-0 flex-1"><b className="block font-display text-base">{net.label}</b><span className="text-muted">{net.handle}</span></span>
                                        <span className="sr-only">{t('(abre num separador novo)')}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </div>

            <Faq faqs={faqs} who={who} />
        </StudentLayout>
    );
}

function ContactForm({ guest, who, setWho, courses, teamSizes, responseTime }) {
    // Com sessão, o nome e o email vêm da conta, no servidor (ContactRequestForm)
    const { data, setData, post, processing, errors } = useForm({
        name: '', email: '', type: who, phone: '', course_id: '', company: '', team_size: Object.keys(teamSizes)[0] ?? '',
        participants: '', message: '', consent: false, website: '',
    });
    const company = data.type === 'empresa';
    const choose = (v) => { setWho(v); setData('type', v); };
    const submit = (e) => { e.preventDefault(); post(route('contacts.store'), { preserveScroll: true }); };

    return (
        <form onSubmit={submit} noValidate className="mt-6 grid gap-5">
            <Pills label={t('Quem és')} value={data.type} onChange={choose} items={[['particular', t('Sou particular')], ['empresa', t('Sou empresa')]]} />
            <p className="-mt-2 text-sm text-muted">
                {company ? t('Conta-nos o que a tua equipa precisa. Preparamos uma proposta à medida.') : t('Tens dúvidas sobre um curso? Pergunta à vontade.')}
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
                {guest && (
                    <>
                        <Field id="ct-name" label={t('Nome')} error={errors.name}>
                            <input id="ct-name" autoComplete="name" maxLength={150} className={inputCls} value={data.name} onChange={(e) => setData('name', e.target.value)} />
                        </Field>
                        <Field id="ct-email" label={t('Email')} error={errors.email}>
                            <input id="ct-email" type="email" autoComplete="email" maxLength={150} className={inputCls} value={data.email} onChange={(e) => setData('email', e.target.value)} />
                        </Field>
                    </>
                )}
                <Field id="ct-phone" label={t('Telefone')} hint={t('Opcional')} error={errors.phone}>
                    <input id="ct-phone" type="tel" autoComplete="tel" maxLength={30} className={inputCls} value={data.phone} onChange={(e) => setData('phone', e.target.value)} />
                </Field>
                <Field id="ct-course" label={t('Curso de interesse')} error={errors.course_id}>
                    <select id="ct-course" className={inputCls} value={data.course_id} onChange={(e) => setData('course_id', e.target.value)}>
                        <option value="">{t('Ainda não sei / vários')}</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </Field>

                {company && (
                    <>
                        <Field id="ct-company" label={t('Empresa / Oficina')} error={errors.company}>
                            <input id="ct-company" autoComplete="organization" maxLength={150} className={inputCls} value={data.company} onChange={(e) => setData('company', e.target.value)} />
                        </Field>
                        <Field id="ct-size" label={t('Nº de pessoas a formar')} error={errors.team_size}>
                            <select id="ct-size" className={inputCls} value={data.team_size} onChange={(e) => setData('team_size', e.target.value)}>
                                {Object.entries(teamSizes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </Field>
                        <Field id="ct-people" className="sm:col-span-2" label={t('Alunos a incluir')} hint={t('Opcional. Um por linha: nome, email')} error={errors.participants}>
                            <textarea id="ct-people" rows={4} maxLength={6000} className={inputCls} placeholder={'Rui Silva, rui@oficina.pt\nMarta Costa, marta@oficina.pt'} value={data.participants} onChange={(e) => setData('participants', e.target.value)} />
                        </Field>
                    </>
                )}

                <Field id="ct-msg" className="sm:col-span-2" label={t('Mensagem')} error={errors.message}>
                    <textarea id="ct-msg" rows={5} maxLength={3000} className={inputCls} placeholder={t('Em que podemos ajudar?')} value={data.message} onChange={(e) => setData('message', e.target.value)} />
                </Field>
            </div>

            {/* Armadilha para bots: invisível para pessoas */}
            <div className="hidden" aria-hidden="true">
                <input name="website" tabIndex={-1} autoComplete="off" value={data.website} onChange={(e) => setData('website', e.target.value)} />
            </div>

            <div>
                <label className="flex items-start gap-2.5 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]" checked={data.consent} onChange={(e) => setData('consent', e.target.checked)} aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? 'ct-consent-err' : undefined} />
                    <span>{t('Aceito que a T.Academy use estes dados para responder ao meu pedido.')}</span>
                </label>
                {errors.consent && <span id="ct-consent-err" className="ui-err mt-1 block">{errors.consent}</span>}
            </div>

            {/* Erros de campos que não aparecem no formulário (conta sem nome, por exemplo) */}
            {((!guest && (errors.name || errors.email)) || errors.type) && (
                <p role="alert" className="ui-err">{(!guest && (errors.name || errors.email)) || errors.type}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <small className="text-muted">{responseTime ? t('Respondemos em até :time.', { time: responseTime }) : t('Respondemos por email.')}</small>
                <Button type="submit" variant="accent" disabled={processing}>{t('Enviar pedido')}</Button>
            </div>
        </form>
    );
}

function Sent({ sent, responseTime }) {
    return (
        <div role="status" className="py-6 text-center">
            <p className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-accent font-bold text-on-accent" aria-hidden="true">✓</p>
            <h2 className="font-display text-2xl font-bold">{t('Pedido enviado')}</h2>
            <p className="mx-auto mt-2 max-w-md text-muted">
                {responseTime
                    ? t('Obrigado, :name! Vamos responder para :email em até :time.', { name: sent.name, email: sent.email, time: responseTime })
                    : t('Obrigado, :name! Vamos responder para :email assim que possível.', { name: sent.name, email: sent.email })}
            </p>
            <Button href={route('contacts')} variant="soft" className="mt-6">{t('Enviar outro pedido')}</Button>
        </div>
    );
}

function Faq({ faqs, who }) {
    const [group, setGroup] = useState(null);
    const [q, setQ] = useState('');
    const current = group ?? who;
    const list = useMemo(() => {
        const term = q.trim().toLowerCase();
        return (faqs?.[current] ?? []).filter(([question, answer]) => !term || `${question} ${answer}`.toLowerCase().includes(term));
    }, [faqs, current, q]);

    return (
        <section aria-labelledby="ct-faq" className="mt-12">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <h2 id="ct-faq" className="font-display text-[clamp(22px,2.4vw,30px)] font-bold">{t('Perguntas frequentes')}</h2>
                <Pills label={t('Tipo de pergunta')} value={current} onChange={setGroup} items={[
                    ['particular', t('Particulares'), faqs?.particular?.length ?? 0],
                    ['empresa', t('Empresas'), faqs?.empresa?.length ?? 0],
                ]} />
            </div>
            <label className="mb-3 block">
                <span className="sr-only">{t('Procurar nas perguntas frequentes')}</span>
                <input type="search" className={inputCls} placeholder={t('Procurar nas perguntas (ex.: certificado, fatura)')} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="grid gap-px bg-line">
                {list.map(([question, answer]) => (
                    <details key={question} className="group bg-surface">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display font-semibold [&::-webkit-details-marker]:hidden">
                            {t(question)}
                            <span aria-hidden="true" className="text-xl leading-none text-muted transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <p className="px-5 pb-5 text-muted">{t(answer)}</p>
                    </details>
                ))}
                {!list.length && <p className="bg-surface px-5 py-8 text-center text-muted">{t('Nenhuma pergunta encontrada.')}</p>}
            </div>
        </section>
    );
}
