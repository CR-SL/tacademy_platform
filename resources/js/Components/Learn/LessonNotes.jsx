import { useState } from 'react';
import { IconX } from '@/Components/Learn/LessonIcons';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const byTime = (a, b) => (a.position ?? -1) - (b.position ?? -1) || a.id - b.id;

// Notas do aluno nesta aula. Nas aulas de vídeo cada nota guarda o segundo em que foi escrita; carregar no tempo volta a esse ponto.
export default function LessonNotes({ lessonUlid, title, initial, canSave, hasVideo, getTime, onSeek }) {
    const [notes, setNotes] = useState(initial);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const url = `/plataforma/aulas/${lessonUlid}/notas`;

    const add = async (e) => {
        e.preventDefault();
        const body = draft.trim();
        if (!body || busy) return;
        setBusy(true);
        setError(null);
        try {
            const { data } = await window.axios.post(url, { body, position: hasVideo ? getTime() : null });
            setNotes((n) => [...n, data].sort(byTime));
            setDraft('');
        } catch {
            setError('Não foi possível guardar a nota. Tenta outra vez.');
        }
        setBusy(false);
    };

    const remove = async (note) => {
        if (!window.confirm('Apagar esta nota?')) return;
        try {
            await window.axios.delete(`${url}/${note.id}`);
            setNotes((n) => n.filter((x) => x.id !== note.id));
        } catch {
            setError('Não foi possível apagar a nota. Tenta outra vez.');
        }
    };

    return (
        <>
            <div className="al-n-scroll">
                <h3>{title}</h3>
                {notes.length ? notes.map((n) => (
                    <div className="al-note" key={n.id}>
                        {n.position != null && (
                            <button type="button" className="at" onClick={() => onSeek(n.position)} aria-label={`Ir para ${fmt(n.position)} do vídeo`}>{fmt(n.position)}</button>
                        )}
                        <span className="tx">{n.body}</span>
                        <button type="button" className="rm" onClick={() => remove(n)} aria-label="Apagar nota"><IconX /></button>
                    </div>
                )) : (
                    <p className="al-note-empty">{canSave ? 'Ainda não há notas nesta aula.' : 'As notas ficam disponíveis depois de te inscreveres no curso.'}</p>
                )}
                {error && <p className="al-note-empty" role="alert">{error}</p>}
            </div>
            <form className="al-n-form" onSubmit={add}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Escrever nota" aria-label="Escrever nota" autoComplete="off" disabled={!canSave} />
                <button type="submit" className="al-pill" disabled={!canSave || busy || !draft.trim()}>Guardar</button>
            </form>
        </>
    );
}
