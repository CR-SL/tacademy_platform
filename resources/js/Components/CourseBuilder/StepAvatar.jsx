import { Field, inputCls, Panel, Toggle } from './ui';

import { t } from '@/i18n';

// Passo 3 · Avatar (Alex, o formador IA do Tavus).
// O formador liga-o e desliga-o nos seus cursos; o admin e o gestor de cursos (canManageAlex) também
// o podem bloquear, e então o formador já não o liga.
export default function StepAvatar({ c, update, canAlex, canManageAlex }) {
    const locked = c.alex_blocked && !canManageAlex;

    return (
        <div className="space-y-4">
            <Panel title={t('Avatar')} sub={t('O aluno fala com o Alex, um avatar com vídeo e voz, no Início, nas Avaliações e durante as aulas deste curso.')}>
                {locked ? (
                    <p className="border-l-[3px] border-live bg-live/10 px-4 py-3 text-sm">
                        <b className="block font-display font-semibold">{t('Avatar desligado pela equipa T.Academy')}</b>
                        {t('Neste curso o avatar não pode ser ligado. Se o quiseres de volta, ')}
                        <a className="ui-link" href="/plataforma/contactos" target="_blank" rel="noopener noreferrer">{t('fala connosco')}</a>.
                    </p>
                ) : canAlex ? (
                    <>
                        <Toggle checked={c.alex_enabled} onChange={(v) => update((d) => { d.alex_enabled = v; })} title={c.alex_enabled ? t('Avatar ativo') : t('Avatar inativo')}>
                            {t('Até 15 minutos por conversa e 3 conversas por dia por aluno. Cada conversa gasta minutos no Tavus.')}
                        </Toggle>
                        {c.alex_enabled && (
                            <div className="grid gap-x-4 pl-[52px] sm:grid-cols-2">
                                <Field label={t('PAL ID')} htmlFor="f-alex-pal" className="mb-0" help={t('O Alex deste curso no Tavus. Vazio = o Alex geral da T.Academy.')}>
                                    <input id="f-alex-pal" className={`${inputCls} font-mono`} value={c.alex_pal_id} maxLength={64} placeholder="p18d6e1b675e" autoComplete="off" spellCheck={false}
                                        onChange={(e) => update((d) => { d.alex_pal_id = e.target.value.trim(); })} />
                                </Field>
                                <Field label={t('FACE ID')} htmlFor="f-alex-face" className="mb-0" help={t('O rosto do avatar. Vazio = o rosto do PAL.')}>
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
