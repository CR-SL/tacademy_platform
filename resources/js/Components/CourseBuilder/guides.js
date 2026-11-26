// Guia do editor de cursos (2026-11-26): balões em todos os passos. Cada passo abre o seu guia na primeira visita;
// o botão "Ver o guia" volta a mostrá-lo. target = valor de data-guide (ver EditorGuide).
import { t } from '@/i18n';

const SIDE = () => ({ target: 'ready-side', title: t('Vê o que falta'), body: t('Aqui à esquerda vês quanto falta para publicar. Carrega em Fazer → para ir direto ao sítio certo.') });

export function guideFor(step, { openFirstLesson }) {
    switch (step) {
        case 0:
            return [
                { target: 'info-title', title: t('Começa pelo título'), body: t('Curto e claro: é o que o aluno procura no catálogo. Ex.: Recertificação AVAC Automóvel.') },
                { target: 'info-area', title: t('Área e nível'), body: t('Ajudam o aluno a encontrar o curso no catálogo e a perceber se é para ele.') },
                { target: 'info-cover', title: t('Escolhe a capa'), body: t('Usa uma imagem da biblioteca ou carrega a tua. Aparece no cartão do catálogo.') },
                { target: 'info-short', title: t('Resume numa frase'), body: t('A descrição curta aparece no cartão do catálogo; a completa, na página do curso. Tudo fica guardado sozinho.') },
                SIDE(),
            ];
        case 1:
            return [
                { target: 'lesson-row', title: t('Cada linha é uma aula'), body: t('Carrega na aula para a abrir. À direita vês o que falta para ficar completa.') },
                { target: 'parts', title: t('Escolhe o que a aula tem'), body: t('Liga o vídeo, o material didático, as notas ou o avatar. Só aparecem os campos do que ligares.'), before: openFirstLesson },
                { target: 'evaluation', title: t('Escolhe a avaliação'), body: t('Um questionário (3 tentativas) ou uma conversa de avaliação com o avatar. Também podes não avaliar.'), before: openFirstLesson },
                { target: 'ready', title: t('Acompanha o que falta'), body: t('Aqui vês quantas aulas estão prontas e o que falta em cada uma. Carrega numa para a abrir.') },
            ];
        case 2:
            return [
                { target: 'avatar', title: t('Liga o Alex'), body: t('Com o avatar ligado, o aluno fala com o Alex nas aulas que têm o Avatar ligado no Programa.') },
                { target: 'avatar-modules', title: t('Um Alex por módulo'), body: t('Cada módulo pode ter o seu PAL ID, com a avaliação desse módulo. Vazio = o Alex do curso.') },
            ];
        case 3:
            return [
                { target: 'price', title: t('Define o preço'), body: t('Valor final pago pelo aluno, com IVA. Também podes deixar o curso gratuito.') },
                { target: 'access', title: t('Acesso e certificado'), body: t('Escolhe durante quanto tempo o aluno tem acesso, o prazo para concluir e o que conta para o certificado.') },
                { target: 'sample', title: t('Aula de amostra'), body: t('Escolhe uma aula que qualquer pessoa pode ver antes de comprar. Ajuda a vender o curso.') },
            ];
        default:
            return [
                { target: 'review-card', title: t('Assim fica no catálogo'), body: t('É o cartão que os alunos vão ver. Para mudar o título ou a capa, volta ao passo Informação.') },
                { target: 'review-list', title: t('O que falta'), body: t('Cada ponto em falta tem Corrigir → para ires direto ao sítio certo.') },
                { target: 'review-actions', title: t('Vê e publica'), body: t('Pré-visualiza o curso como aluno e, quando estiver tudo certo, publica.') },
            ];
    }
}

const key = (step) => `ta-guia-editor-${step}`;

export function guideSeen(step) {
    try {
        return !!localStorage.getItem(key(step)) || (step === 1 && !!localStorage.getItem('ta-guia-editor'));
    } catch {
        return true; // sem armazenamento: não abre sozinho
    }
}

export function markGuideSeen(step) {
    try { localStorage.setItem(key(step), '1'); } catch { /* ignora */ }
}
