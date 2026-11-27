// Estado do editor de cursos e as mesmas regras de publicação do servidor (CourseBuilder::publishProblems).
import { isHttpUrl, isUploadedVideo } from './format';

import { t } from '@/i18n';

let n = 0;
// Chave dos módulos/aulas novos até o servidor lhes dar um id
export const newKey = () => `n${Date.now().toString(36)}${(n++).toString(36)}`;

export function blankCourse() {
    return {
        ulid: null,
        slug: null,
        status: 'draft',
        title: '',
        category_id: null,
        level: null,
        thumbnail_url: null,
        short_description: '',
        description: '',
        learning_outcomes: [''],
        prerequisites: '',
        audience: '',
        is_free: false,
        price: '',
        access_months: null,
        deadline_days: null,
        requires_attendance: false,
        alex_enabled: false,
        alex_pal_id: '',
        alex_face_id: '',
        alex_blocked: false,
        certificate_enabled: true,
        certificate_min_progress: 100,
        certificate_min_score: 70,
        sample_lesson_key: '',
        final_mode: 'none',
        final_pass: 70,
        final_minutes: 15,
        final_prompt: '',
        final_pal_id: '',
        final_weight: 50,
        final_weighted: false,
        final_quiz: [],
        modules: [{
            key: newKey(), id: null, title: '', description: '',
            lessons: [blankLessonData()],
        }],
    };
}

export const totalMinutes = (c) => c.modules.reduce((a, m) => a + m.lessons.reduce((b, l) => b + (Number(l.minutes) || 0), 0), 0);
export const lessonCount = (c) => c.modules.reduce((a, m) => a + m.lessons.length, 0);

// Atividade nova (fase 2, 2026-11-27): aula, teste, exercício ou roleplay
export const blankLessonData = () => ({
    key: newKey(), id: null, kind: 'aula', title: '', type: 'video_link', parts: ['video'], evaluation: 'none', evaluation_prompt: '',
    evaluation_pal_id: '', avatar_link: '', roleplay_role: '', graded: false, weighted: false,
    url: '', minutes: '', body: '', attachments: [], quiz: [], checks: [],
});

const newQuestion = () => ({ key: newKey(), id: null, question: '', points: 1, options: ['', ''], option_ids: [null, null], correct: 0 });

export function blankActivity(kind) {
    const l = blankLessonData();
    l.kind = kind;
    if (kind === 'aula') return l;
    l.parts = [];
    if (kind === 'teste') { l.evaluation = 'quiz'; l.quiz = [newQuestion()]; }
    if (kind === 'exercicio') l.evaluation = 'none';
    if (kind === 'roleplay') { l.evaluation = 'avatar'; l.graded = true; l.minutes = 8; }
    return l;
}

// Cada pergunta: texto, 2 opções com texto e a opção certa com texto (igual a CourseBuilder::quizReady)
export const questionsReady = (list) => (list ?? []).length > 0 && list.every((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2 && (q.options[q.correct] ?? '').trim());

// O que ainda falta na atividade (igual a CourseBuilder::lessonComplete no servidor); vazio = completa
export function lessonMissing(l) {
    const parts = l.parts ?? [];
    const kind = l.kind ?? 'aula';
    const miss = [];
    if (!l.title.trim()) miss.push(t('título'));
    if (kind === 'aula') {
        if (!parts.length) miss.push(t('escolher o que a aula tem'));
        if (parts.includes('video') && !(isHttpUrl(l.url) || isUploadedVideo(l.url))) miss.push(t('vídeo'));
        if (parts.includes('video') && !(Number(l.minutes) > 0)) miss.push(t('minutos do vídeo'));
        if (parts.includes('material') && !l.attachments.length) miss.push(t('material'));
        if (parts.includes('notas') && !l.body.trim()) miss.push(t('notas'));
    }
    if ((kind === 'teste' || kind === 'exercicio') && l.evaluation === 'quiz' && !questionsReady(l.quiz)) miss.push(t('perguntas'));
    if (kind === 'exercicio' && l.evaluation !== 'quiz' && !l.body.trim()) miss.push(t('o que o aluno tem de fazer'));
    if (kind === 'roleplay') {
        if (!(l.roleplay_role ?? '').trim()) miss.push(t('papel do avatar'));
        if (!l.body.trim()) miss.push(t('situação'));
    }
    return miss;
}

export const lessonComplete = (l) => lessonMissing(l).filter((m) => m !== t('minutos do vídeo')).length === 0;
// [texto, passo do editor, ok] (passos: 0 Informação, 1 Programa, 2 Avatar de ajuda, 3 Avaliação final, 4 Preço, 5 Rever)
export function checklist(c, shortMax) {
    const lessons = c.modules.flatMap((m) => m.lessons);
    return [
        [t('Título do curso'), 0, !!c.title.trim()],
        [t('Área e nível'), 0, !!c.category_id && !!c.level],
        [t('Imagem de capa'), 0, !!c.thumbnail_url],
        [t('Descrição curta'), 0, !!c.short_description.trim() && c.short_description.length <= shortMax],
        [t('Pelo menos 1 módulo com 1 aula'), 1, lessons.length > 0],
        [t('Todos os módulos têm título'), 1, c.modules.every((m) => m.title.trim())],
        [t('Todas as aulas completas (título + link/conteúdo)'), 1, lessons.every(lessonComplete)],
        // Igual ao servidor: sem os minutos, o vídeo não conclui a aula
        [t('Minutos em todas as aulas de vídeo'), 1, lessons.every((l) => !(l.parts ?? []).includes('video') || Number(l.minutes) > 0)],
        [t('Perguntas da avaliação final'), 3, c.final_mode !== 'questions' || questionsReady(c.final_quiz)],
        [t('Preço definido'), 4, c.is_free || Number(c.price) > 0],
    ];
}
