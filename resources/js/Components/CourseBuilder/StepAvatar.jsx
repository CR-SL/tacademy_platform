import { Field, inputCls, Panel, Toggle } from './ui';

import { t } from '@/i18n';

// Passo 3 · Avatar de ajuda: a persona do Tavus que tira dúvidas sobre a matéria do curso (o nome e a cara são da persona;
// o Alex é só um exemplo). Um por curso: os testes e roleplays têm a sua persona no Programa (2026-11-27).
// O formador liga-o e desliga-o nos seus cursos; o admin e o gestor de cursos (canManageAlex) também
// o podem bloquear, e então o formador já não o liga.
export default function StepAvatar({ c, update, canAlex, canManageAlex }) {
    const locked = c.alex_blocked && !canManageAlex;

    return (
        <div className="space-y-4">
            <Panel data-guide="avatar" title={t('Avatar de ajuda')} sub={t('Ligado, quem comprou o curso tira dúvidas com este avatar no Início e em todas as aulas do curso. Desligado, o curso não tem avatar de apoio, mas pode ter na mesma testes com avatar, roleplays e a avaliação final com avatar.')}>
                {locked ? (
                    <p className="border-l-[3px] border-live bg-live/10 px-4 py-3 text-sm">
                        <b className="block font-display font-semibold">{t('Avatar desligado pela equipa T.Academy')}</b>
                        {t('Neste curso o avatar não pode ser ligado. Se o quiseres de volta, ')}
                        <a className="ui-link" href="/plataforma/contactos" target="_blank" rel="noopener noreferrer">{t('fala connosco')}</a>.
                    </p>
                ) : canAlex ? (
                    <>
                        <Toggle checked={c.alex_enabled} onChange={(v) => update((d) => { d.alex_enabled = v; })} title={c.alex_enabled ? t('Avatar de ajuda ligado') : t('Avatar de ajuda desligado')}>
                            {t('Cada aluno tem 30 minutos de avatar incluídos no curso, para as dúvidas e os roleplays. Depois disso, compra créditos no botão do avatar.')}
                        </Toggle>
                        {c.alex_enabled && (
                            <div className="grid gap-x-4 pl-[52px] sm:grid-cols-2">
                                <Field label={t('Nome do avatar')} id="f-alex-name" required className="sm:col-span-2 sm:max-w-[calc(50%-8px)]" hint={t('O nome que o aluno vê no botão e na conversa. Ex.: Alex.')}>
                                    <input id="f-alex-name" className={inputCls} value={c.alex_name ?? ''} maxLength={40} placeholder="Alex" autoComplete="off"
                                        onChange={(e) => update((d) => { d.alex_name = e.target.value; })} />
                                </Field>
                                <Field label={t('PAL ID do avatar de ajuda')} id="f-alex-pal" required hint={t('A persona no Tavus que tira as dúvidas sobre a matéria do curso.')}>
                                    <input id="f-alex-pal" className={`${inputCls} font-mono`} value={c.alex_pal_id} maxLength={64} placeholder="p18d6e1b675e" autoComplete="off" spellCheck={false}
                                        onChange={(e) => update((d) => { d.alex_pal_id = e.target.value.trim(); })} />
                                </Field>
                                <Field label={t('FACE ID')} id="f-alex-face" hint={t('O rosto do avatar. Vazio = o rosto do PAL.')}>
                                    <input id="f-alex-face" className={`${inputCls} font-mono`} value={c.alex_face_id} maxLength={64} placeholder="rdea4449f835" autoComplete="off" spellCheck={false}
                                        onChange={(e) => update((d) => { d.alex_face_id = e.target.value.trim(); })} />
                                </Field>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-muted">
                        {c.alex_enabled
                            ? t('Este curso tem o avatar, ligado pela equipa T.Academy.')
                            : <>{t('O teu perfil não liga o avatar. Se o quiseres neste curso, ')}<a className="ui-link" href="/plataforma/contactos" target="_blank" rel="noopener noreferrer">{t('fala connosco')}</a>.</>}
                    </p>
                )}
            </Panel>

            {canManageAlex && (
                <Panel title={t('Controlo da equipa')} sub={t('Só o admin e o gestor de cursos veem esta parte.')}>
                    <Toggle
                        checked={c.alex_blocked}
                        onChange={(v) => update((d) => { d.alex_blocked = v; if (v) d.alex_enabled = false; })}
                        title={t('Bloquear o avatar neste curso')}
                    >
                        {t('Desliga o avatar e o formador já não o pode voltar a ligar.')}
                    </Toggle>
                </Panel>
            )}
        </div>
    );
}
