import { useCallback, useEffect, useState } from 'react';
import { Drawer } from '@/Components/Teams/ui';

// Presença dos alunos num curso que a exige: o formador confirma quem esteve presente.
// Com a presença confirmada, o certificado é emitido se as aulas e os testes já estiverem cumpridos.
export default function AttendanceDrawer({ course, onClose }) {
    const [students, setStudents] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(null);
    const close = useCallback(onClose, [onClose]);

    useEffect(() => {
        window.axios.get(`/formador/cursos/${course.ulid}/alunos`)
            .then((r) => setStudents(r.data.students))
            .catch(() => setError('Não foi possível carregar os alunos. Tenta outra vez.'));
    }, [course.ulid]);

    const mark = async (s, attended) => {
        setBusy(s.id);
        setError(null);
        try {
            const r = await window.axios.post(`/formador/cursos/${course.ulid}/alunos/${s.ulid}/presenca`, { attended });
            setStudents((list) => list.map((x) => (x.id === s.id ? r.data.student : x)));
        } catch {
            setError(`Não foi possível guardar a presença de ${s.name}.`);
        } finally {
            setBusy(null);
        }
    };

    const present = students?.filter((s) => s.attended).length ?? 0;

    return (
        <Drawer
            sub={course.title}
            title="Presença dos alunos"
            onClose={close}
            width="w-[min(560px,100%)]"
            footer={students && <span className="text-[13px] text-muted">{present} de {students.length} com presença confirmada</span>}
        >
            <p className="text-muted">Este curso exige presença para o certificado. Confirma quem esteve presente; o certificado sai assim que o aluno cumprir também as aulas e os testes.</p>
            {error && <p role="alert" className="text-[13.5px] text-live-ink">{error}</p>}
            {!students && !error && <p className="text-muted">A carregar…</p>}
            {students?.length === 0 && <p className="text-muted">O curso ainda não tem alunos.</p>}
            {students?.length > 0 && (
                <ul className="border border-line">
                    {students.map((s) => (
                        <li key={s.id} className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-b-0">
                            <span className="min-w-0 flex-1">
                                <b className="block truncate font-semibold">{s.name}</b>
                                <small className="block truncate text-[12.5px] text-muted">
                                    {s.email} · {s.progress}% das aulas{s.certificate ? ' · certificado emitido' : ''}
                                </small>
                            </span>
                            <label className={`flex flex-none items-center gap-2 font-display text-[13px] font-semibold ${busy === s.id ? 'opacity-50' : 'cursor-pointer'}`}>
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-[#F8B101]"
                                    checked={!!s.attended}
                                    disabled={busy === s.id}
                                    onChange={(e) => mark(s, e.target.checked)}
                                />
                                {s.attended ? `Presente · ${s.attended}` : 'Presente'}
                            </label>
                        </li>
                    ))}
                </ul>
            )}
        </Drawer>
    );
}
