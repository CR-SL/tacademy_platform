import { Head, Link } from '@inertiajs/react';
import StudentLayout from '@/Layouts/StudentLayout';
import { Bar, Chip, btnClass } from '@/Components/ui';

import { t } from '@/i18n';

// Certificados (versão simples, 2026-11-10): os que o aluno já tem e os que estão a caminho. O PDF vem depois.
export default function Certificates({ issued, coming }) {
    return (
        <StudentLayout>
            <Head title={t('Certificados')} />

            <div className="mb-6">
                <h1 className="font-display text-[clamp(30px,3.4vw,44px)] font-bold leading-none tracking-[-0.01em]">{t('Certificados')}</h1>
                <p className="mt-2 text-muted">{t('Os certificados dos cursos que concluíste, com o código de verificação.')}</p>
            </div>

            <section className="mb-10">
                <h2 className="pn-lab mb-3">{t('Os meus certificados')} · {issued.length}</h2>
                {issued.length ? (
                    <div className="grid gap-3">
                        {issued.map((c) => (
                            <div key={c.number} className="grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-2 bg-surface p-3 sm:grid-cols-[96px_1fr_auto] sm:gap-5 sm:pr-5">
                                <div className="h-14 w-14 bg-surface2 bg-cover bg-center sm:h-[68px] sm:w-24" style={{ backgroundImage: `url("${c.image}")` }} />
                                <div className="min-w-0">
                                    <h3 className="truncate font-display text-[17px] font-semibold">{c.title}</h3>
                                    <p className="text-[13px] text-muted">
                                        {t('Emitido a :date', { date: c.date })} · {t('Código')} <b className="font-mono text-ink">{c.number}</b>
                                    </p>
                                </div>
                                <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto">
                                    <Chip tone="ok">{t('Válido')}</Chip>
                                    <Link href={c.url} className={btnClass('soft', 'sm')}>{t('Ver o curso')}</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-surface px-6 py-12 text-center">
                        <p className="font-display text-xl font-bold">{t('Ainda não tens certificados')}</p>
                        <p className="mt-1 text-muted">{t('Quando concluíres um curso, o certificado aparece aqui.')}</p>
                    </div>
                )}
                <p className="mt-3 text-[13px] text-muted">{t('O certificado em PDF para descarregar chega em breve.')}</p>
            </section>

            {coming.length > 0 && (
                <section>
                    <h2 className="pn-lab mb-3">{t('A caminho')} · {coming.length}</h2>
                    <div className="grid gap-3">
                        {coming.map((c) => (
                            <div key={c.url} className="grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-2 bg-surface p-3 sm:grid-cols-[96px_1fr_auto] sm:gap-5 sm:pr-5">
                                <div className="h-14 w-14 bg-surface2 bg-cover bg-center sm:h-[68px] sm:w-24" style={{ backgroundImage: `url("${c.image}")` }} />
                                <div className="min-w-0">
                                    <h3 className="truncate font-display text-[17px] font-semibold">{c.title}</h3>
                                    <div className="mt-1.5 flex max-w-[280px] items-center gap-2">
                                        <Bar value={c.progress} className="flex-1" />
                                        <span className="text-[12px] font-semibold text-muted">{c.progress}%</span>
                                    </div>
                                    {c.missing.length > 0 && (
                                        <p className="mt-1 text-[13px] text-muted">{t('Falta:')} {c.missing.join(' · ')}</p>
                                    )}
                                </div>
                                <div className="col-start-2 sm:col-start-auto">
                                    <Link href={c.url} className={btnClass('soft', 'sm')}>{t('Continuar o curso')}</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </StudentLayout>
    );
}
