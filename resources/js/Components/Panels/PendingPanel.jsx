import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { IconTri } from '@/Components/Panels/icons';

import { t } from '@/i18n';

// Caixa "Pendentes": a lista de tarefas de cada um (Início do aluno e Início de trabalho)
export default function PendingPanel({ pending }) {
    const [open, setOpen] = useState(0);
    if (!pending.length) return <p className="pn-empty">{t('Não tens nada por fazer agora.')}</p>;

    return pending.map((p, i) => (
        <div key={`${p.kind}-${p.url}`} className="pn-pend">
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span><span className="pn-lab">{t(p.kind)} · {p.course}</span><b>{p.title}</b></span>
                <IconTri />
            </button>
            {open === i && (
                <div className="pn-pend-c">
                    {p.text}
                    <br />
                    <Link href={p.url} className="ui-btn">{p.cta}</Link>
                </div>
            )}
        </div>
    ));
}
