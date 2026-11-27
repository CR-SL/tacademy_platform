// Modelos para começar um curso (2026-11-26, exemplo em landing-concepts/criar-curso-modelos.html).
// Fase 2 (2026-11-27): cada modelo monta atividades (aulas, testes, roleplays) e escolhe a avaliação final.
import { blankActivity, blankCourse, newKey } from './model';

import { t } from '@/i18n';

// after: o que vem depois das aulas de cada módulo ('quiz' = teste escrito, 'avatar' = teste com avatar,
// 'roleplay' = um roleplay por aula). final: a avaliação final do curso.
export const MODELS = [
    { id: 'video', icon: '▶', name: 'Curso em vídeo', for: 'Formação técnica com aulas em vídeo.', parts: ['video', 'material', 'notas'], after: 'quiz', final: 'none', evaluation: 'Teste no fim de cada módulo', example: 'Ex.: Diagnóstico de sistemas OBD-II', tag: 'Mais usado' },
    { id: 'recert', icon: 'IA', name: 'Recertificação com o Alex', for: 'Como o curso AVAC: o Alex tira dúvidas e testa cada módulo; avaliação final com perguntas.', parts: ['video', 'material'], after: 'avatar', final: 'questions', evaluation: 'Teste com o Alex no fim de cada módulo + avaliação final', example: 'Ex.: Recertificação AVAC Automóvel', alex: true },
    { id: 'docs', icon: 'PDF', name: 'Leitura e documentos', for: 'Normas, procedimentos e fichas técnicas, sem vídeo.', parts: ['material', 'notas'], after: 'quiz', final: 'none', evaluation: 'Teste no fim de cada módulo', example: 'Ex.: Regras de segurança na oficina' },
    { id: 'pratica', icon: 'RP', name: 'Prática com o Alex', for: 'Situações reais: o aluno lê o caso e treina a conversa num roleplay com o avatar.', parts: ['notas'], after: 'roleplay', final: 'avatar', evaluation: 'Um roleplay por aula + avaliação final com o avatar', example: 'Ex.: Atendimento e fidelização de clientes', alex: true },
];

export const PART_LABELS = { video: 'Vídeo', material: 'Material', notas: 'Notas' };
export const KIND_LABELS = { aula: 'Aula', teste: 'Teste', exercicio: 'Exercício', roleplay: 'Roleplay' };

// O programa do modelo (também para a pré-visualização do ecrã): [{ lessons: [{ kind, parts, evaluation }] }]
export function outline(model, modules, lessons) {
    if (!model) return [{ lessons: [{ kind: 'aula', parts: ['video'], evaluation: 'none' }] }];
    const out = [];
    for (let i = 0; i < modules; i++) {
        const ls = [];
        for (let j = 0; j < lessons; j++) {
            ls.push({ kind: 'aula', parts: model.parts, evaluation: 'none' });
            if (model.after === 'roleplay') ls.push({ kind: 'roleplay', parts: [], evaluation: 'avatar' });
        }
        if (model.after === 'quiz') ls.push({ kind: 'teste', parts: [], evaluation: 'quiz' });
        if (model.after === 'avatar') ls.push({ kind: 'teste', parts: [], evaluation: 'avatar' });
        out.push({ lessons: ls });
    }
    return out;
}

// O curso novo, pronto para o editor (ainda não gravado: grava-se na primeira alteração, como antes)
export function courseFromModel(modelId, modules, lessons, { canAlex = false } = {}) {
    const c = blankCourse();
    const model = MODELS.find((m) => m.id === modelId);
    if (!model) return c;
    c.modules = outline(model, modules, lessons).map((m) => ({
        key: newKey(), id: null, title: '', description: '',
        lessons: m.lessons.map((x) => {
            const l = blankActivity(x.kind);
            if (x.kind === 'aula') l.parts = [...x.parts];
            if (x.kind === 'teste') l.evaluation = x.evaluation;
            return l;
        }),
    }));
    c.final_mode = model.final;
    if (model.final === 'questions') c.final_quiz = [{ key: newKey(), id: null, question: '', points: 1, options: ['', ''], option_ids: [null, null], correct: 0 }];
    // O avatar de ajuda só se liga sozinho para quem pode (o servidor ignora-o para os outros)
    if (model.alex && canAlex) { c.alex_enabled = true; c.alex_name = 'Alex'; }
    return c;
}
