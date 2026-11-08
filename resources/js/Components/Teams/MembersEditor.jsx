import { Box, inputCls } from './ui';

import { t } from '@/i18n';

// Lista editável de membros (nome, email, team leader) com a contagem de lugares.
// people = [{name, email}], leader = email. Só usado pelo Gestor de Cursos/admin.
export default function MembersEditor({ people, setPeople, leader, setLeader, seats, errors = {} }) {
    const set = (i, key, v) => setPeople(people.map((p, j) => (j === i ? { ...p, [key]: v } : p)));
    const over = people.length > seats;

    return (
        <Box title={t('Membros')} right={<span className={`font-mono text-[11px] tracking-[0.08em] ${over ? 'text-live-ink' : 'text-muted'}`}>{people.length} / {seats}{' '}{t('LUGARES')}</span>}>
            <div className="flex flex-col gap-1.5">
                {people.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-1.5 sm:grid-cols-[1fr_1.3fr_auto_auto]">
                        <input className={inputCls} value={p.name} placeholder={t('Nome')} aria-label={t('Nome :v1', { v1: i + 1 })} maxLength={150}
                            onChange={(e) => set(i, 'name', e.target.value)} />
                        <input className={`${inputCls} col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto`} value={p.email} placeholder="email@empresa.pt" aria-label={t('Email :v1', { v1: i + 1 })} maxLength={150}
                            onChange={(e) => {
                                if (leader && leader === p.email) setLeader(e.target.value);
                                set(i, 'email', e.target.value);
                            }} />
                        <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                            <input type="radio" name="leader" className="text-accent focus:ring-accent" checked={!!p.email && leader === p.email} onChange={() => setLeader(p.email)} />
                            {t('Team leader')}
                        </label>
                        <button type="button" aria-label={t('Retirar :v1', { v1: p.name || t('pessoa') })} onClick={() => setPeople(people.filter((_, j) => j !== i))}
                            className="h-8 w-8 bg-surface2 text-muted hover:text-live-ink">✕</button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={() => setPeople([...people, { name: '', email: '' }])} className="mt-2 py-1 font-display text-[13.5px] font-semibold text-accent-ink hover:text-ink">
                {t('+ Adicionar pessoa')}
            </button>
            {(errors.people || errors.leader || Object.keys(errors).some((k) => k.startsWith('people.'))) && (
                <p role="alert" className="mt-2 text-sm text-live-ink">
                    {errors.people || errors.leader || t('Verifica os nomes e emails assinalados.')}
                </p>
            )}
            {over && <p className="mt-2 text-sm text-live-ink">{t('Há mais pessoas do que lugares. Junta um pack ou retira alguém.')}</p>}
            <p className="mt-3 text-[12.5px] text-muted">{t('O team leader também ocupa um lugar. Pessoas novas recebem um email para definir a palavra-passe; quem sai deixa de ter acesso aos cursos da equipa (mantém os certificados).')}</p>
        </Box>
    );
}
