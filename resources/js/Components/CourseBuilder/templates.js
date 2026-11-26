// Modelos para começar um curso (2026-11-26, exemplo em landing-concepts/criar-curso-modelos.html).
// Cada modelo diz o que cada aula tem e onde fica a avaliação; o editor abre com o programa montado.
import { blankCourse, blankLessonData, newKey } from './model';

import { t } from '@/i18n';

// where: 'module-quiz' = questionário na última aula de cada módulo; 'module-avatar-final' = Alex na última aula de
// cada módulo e um módulo "Teste final" com questionário; 'lesson-avatar' = o Alex avalia cada aula
export const MODELS = [
    { id: 'video', icon: '▶', name: 'Curso em vídeo', for: 'Formação técnica com aulas em vídeo.', parts: ['video', 'material', 'notas'], where: 'module-quiz', evaluation: 'Questionário no fim de cada módulo', example: 'Ex.: Diagnóstico de sistemas OBD-II', tag: 'Mais usado' },
    { id: 'recert', icon: 'IA', name: 'Recertificação com o Alex', for: 'Como o curso AVAC: o Alex tira dúvidas e avalia cada módulo.', parts: ['video', 'material', 'avatar'], where: 'module-avatar-final', evaluation: 'Alex no fim de cada módulo + teste final', example: 'Ex.: Recertificação AVAC Automóvel', alex: true },
    { id: 'docs', icon: 'PDF', name: 'Leitura e documentos', for: 'Normas, procedimentos e fichas técnicas, sem vídeo.', parts: ['material', 'notas'], where: 'module-quiz', evaluation: 'Questionário no fim de cada módulo', example: 'Ex.: Regras de segurança na oficina' },
    { id: 'pratica', icon: 'Aa', name: 'Prática com o Alex', for: 'Situações reais: o aluno lê o caso e treina a conversa com o Alex.', parts: ['notas', 'avatar'], where: 'lesson-avatar', evaluation: 'Alex avalia cada aula', example: 'Ex.: Atendimento e fidelização de clientes', alex: true },
];

export const PART_LABELS = { video: 'Vídeo', material: 'Material', notas: 'Notas', avatar: 'Alex' };

const blankQuestion = () => ({ key: newKey(), id: null, question: '', options: ['', ''], option_ids: [null, null], correct: 0 });

function lesson(parts, evaluation, title = '') {
    return {
        ...blankLessonData(),
        title,
        type: parts.includes('video') ? 'video_link' : evaluation === 'quiz' ? 'quiz' : 'text',
        parts: [...parts],
        evaluation,
        quiz: evaluation === 'quiz' ? [blankQuestion()] : [],
    };
}

// O programa do modelo: [{ final, lessons: [{ parts, evaluation }] }] (também para a pré-visualização do ecrã)
export function outline(model, modules, lessons) {
    if (!model) return [{ final: false, lessons: [{ parts: ['video'], evaluation: 'none' }] }];
    const out = [];
    for (let i = 0; i < modules; i++) {
        const ls = [];
        for (let j = 0; j < lessons; j++) {
            const last = j === lessons - 1;
            let evaluation = 'none';
            if (model.where === 'lesson-avatar') evaluation = 'avatar';
            if (last && model.where === 'module-quiz') evaluation = 'quiz';
            if (last && model.where === 'module-avatar-final') evaluation = 'avatar';
            ls.push({ parts: model.parts, evaluation });
        }
        out.push({ final: false, lessons: ls });
    }
    if (model.where === 'module-avatar-final') out.push({ final: true, lessons: [{ parts: [], evaluation: 'quiz' }] });
    return out;
}

// O curso novo, pronto para o editor (ainda não gravado: grava-se na primeira alteração, como antes)
export function courseFromModel(modelId, modules, lessons, { canAlex = false } = {}) {
    const c = blankCourse();
    const model = MODELS.find((m) => m.id === modelId);
    if (!model) return c;
    c.modules = outline(model, modules, lessons).map((m) => ({
        key: newKey(), id: null, title: m.final ? t('Teste final') : '', description: '',
        lessons: m.lessons.map((l) => lesson(l.parts, l.evaluation, m.final ? t('Teste final') : '')),
    }));
    // O Alex do curso só se liga sozinho para quem pode (o servidor ignora-o para os outros)
    if (model.alex && canAlex) c.alex_enabled = true;
    return c;
}
