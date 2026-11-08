import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { initials } from '@/Layouts/StudentLayout';
import { IconBack } from './icons';

// Ao ler ou enviar, atualiza também as tarefas do Início e os números da navegação
const options = { preserveScroll: true, preserveState: true, only: ['messages', 'pending', 'navCounts', 'errors'] };

// Mensagens com o formador: lista das conversas, conversa aberta e início de uma nova.
export default function MessagesPanel({ messages, startWith }) {
    const { errors } = usePage().props;
    const { threads, canStart } = messages;
    const [openKey, setOpenKey] = useState(() => {
        if (!startWith) return null;
        return threads.find((t) => t.key === startWith || String(t.course_id) === String(startWith))?.key ?? null;
    });
    const [newCourse, setNewCourse] = useState(() => {
        const wanted = canStart.find((c) => String(c.id) === String(startWith));
        return wanted ? wanted.id : '';
    });
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const threadRef = useRef(null);
    const thread = threads.find((t) => t.key === openKey);

    // Aberta a partir de uma tarefa do Início (?conversa=…): marca como lida e mostra a caixa
    useEffect(() => {
        if (!startWith || !thread) return;
        if (thread.unread) router.post('/plataforma/mensagens/lidas', { course_id: thread.course_id, student_id: thread.student_id }, options);
        threadRef.current?.closest('.pn-box')?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openThread = (t) => {
        setOpenKey(t.key);
        setBody('');
        if (t.unread) router.post('/plataforma/mensagens/lidas', { course_id: t.course_id, student_id: t.student_id }, options);
    };

    useEffect(() => {
        if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }, [openKey, thread?.items.length]);

    const send = (e, payload, onDone) => {
        e.preventDefault();
        if (!body.trim() || sending) return;
        setSending(true);
        router.post('/plataforma/mensagens', { ...payload, body }, {
            ...options,
            onSuccess: () => {
                setBody('');
                onDone?.();
            },
            onFinish: () => setSending(false),
        });
    };

    const error = errors?.body && <p className="pn-err">{errors.body}</p>;

    if (thread) {
        return (
            <div className="pn-sent">
                <div className="pn-thread-h">
                    <button type="button" className="pn-tool" aria-label="Voltar às conversas" title="Voltar às conversas" onClick={() => setOpenKey(null)}><IconBack /></button>
                    <span><b>{thread.name}</b><small>{thread.context}</small></span>
                </div>
                <div className="pn-thread" ref={threadRef}>
                    {thread.items.map((m) => (
                        <p key={m.id} className={`pn-bubble ${m.mine ? 'pn-mine' : ''}`}>{m.body}<small>{m.when}</small></p>
                    ))}
                </div>
                {error}
                <form className="pn-reply" onSubmit={(e) => send(e, { course_id: thread.course_id, student_id: thread.student_id })}>
                    <label className="pn-sr" htmlFor="pn-reply-text">Responder a {thread.name}</label>
                    <textarea id="pn-reply-text" rows={2} maxLength={3000} placeholder="Escreve a tua resposta" value={body} onChange={(e) => setBody(e.target.value)} />
                    <button type="submit" className="ui-btn ui-btn-sm" disabled={sending}>{sending ? 'A enviar…' : 'Enviar'}</button>
                </form>
            </div>
        );
    }

    return (
        <>
            {canStart.length > 0 && (
                <form className="pn-new" onSubmit={(e) => send(e, { course_id: newCourse }, () => setNewCourse(''))}>
                    <label className="pn-sr" htmlFor="pn-new-course">Curso</label>
                    <select id="pn-new-course" value={newCourse} onChange={(e) => setNewCourse(e.target.value)}>
                        <option value="">Nova mensagem ao formador de…</option>
                        {canStart.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    {newCourse && (
                        <>
                            <label className="pn-sr" htmlFor="pn-new-text">Mensagem</label>
                            <span className="pn-reply" style={{ flexBasis: '100%', padding: 0, border: 0 }}>
                                <textarea id="pn-new-text" rows={2} maxLength={3000} placeholder="Escreve a tua dúvida" value={body} onChange={(e) => setBody(e.target.value)} />
                                <button type="submit" className="ui-btn ui-btn-sm" disabled={sending}>{sending ? 'A enviar…' : 'Enviar'}</button>
                            </span>
                        </>
                    )}
                </form>
            )}
            {error}
            {threads.map((t) => (
                <button key={t.key} type="button" className={`pn-msg ${t.unread ? 'pn-new-m' : ''}`} onClick={() => openThread(t)}>
                    <span className="pn-av">{initials(t.name)}</span>
                    <span style={{ minWidth: 0 }}>
                        <b>{t.name}</b>
                        <small>{t.context}</small>
                        <p>{t.last}</p>
                    </span>
                    <span className="pn-w">{t.when}{t.unread > 0 && <span className="pn-dot" aria-label="Por ler" />}</span>
                </button>
            ))}
            {threads.length === 0 && canStart.length === 0 && <p className="pn-empty">Ainda não tens mensagens. Podes falar com o formador quando estiveres inscrito num curso.</p>}
            {threads.length === 0 && canStart.length > 0 && <p className="pn-empty">Ainda não tens mensagens. Escolhe um curso acima para falares com o formador.</p>}
        </>
    );
}
