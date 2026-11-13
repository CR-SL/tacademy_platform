import { useEffect } from 'react';
import { t } from '@/i18n';
import { AlexCallView, AlexStart } from './AlexCall';
import { dismissAlex, dock, isActive, useAlexCall } from './alexStore';

// O Alex dentro do painel do avatar da aula. Com o painel aberto, a conversa fica aqui;
// ao fechar o painel ou mudar de página, passa para a janela flutuante e não cai.
export default function AlexLessonPanel({ alex, open, onStart }) {
    const s = useAlexCall();
    const inCall = s.status !== 'idle';

    useEffect(() => {
        if (!open || !inCall) return undefined;
        dock(true);
        return () => dock(false);
    }, [open, inCall]);

    // O vídeo da aula fica em pausa enquanto o aluno fala com o Alex
    useEffect(() => { if (isActive(s)) onStart?.(); }, [s.status]); // eslint-disable-line react-hooks/exhaustive-deps

    if (inCall) {
        return (
            <div className="ax-docked">
                <AlexCallView onClose={dismissAlex} />
            </div>
        );
    }
    return (
        <div className="ax-intro">
            <img src="/images/alex.png" alt={t('Alex, o tutor do curso, numa oficina')} />
            <div>
                <AlexStart alex={alex} />
            </div>
        </div>
    );
}
