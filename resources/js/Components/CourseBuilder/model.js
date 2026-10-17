// Estado do editor de cursos e as mesmas regras de publicação do servidor (CourseBuilder::publishProblems).
import { isHttpUrl } from './format';

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
        sequential: true,
        certificate_enabled: true,
        certificate_min_progress: 100,
        certificate_min_score: 70,
        sample_lesson_key: '',
        modules: [{
            key: newKey(), id: null, title: '', description: '',
            lessons: [{ key: newKey(), id: null, title: '', type: 'video_link', url: '', minutes: '', body: '', attachments: [], quiz: [] }],
        }],
    };
}

export const totalMinutes = (c) => c.modules.reduce((a, m) => a + m.lessons.reduce((b, l) => b + (Number(l.minutes) || 0), 0), 0);
export const lessonCount = (c) => c.modules.reduce((a, m) => a + m.lessons.length, 0);

export function lessonComplete(l) {
    if (!l.title.trim()) return false;
    switch (l.type) {
        case 'video_link':
        case 'video_upload':
        case 'avatar':
            return isHttpUrl(l.url);
        case 'document':
            return l.attachments.length > 0;
        case 'text':
            return l.body.trim().length > 0;
        case 'quiz':
            return l.quiz.length > 0 && l.quiz.every((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2);
        default:
            return true;
    }
}

// [texto, passo do editor, ok]
export function checklist(c, shortMax) {
    const lessons = c.modules.flatMap((m) => m.lessons);
    return [
        ['Título do curso', 0, !!c.title.trim()],
        ['Área e nível', 0, !!c.category_id && !!c.level],
        ['Imagem de capa', 0, !!c.thumbnail_url],
        ['Descrição curta', 0, !!c.short_description.trim() && c.short_description.length <= shortMax],
        ['Pelo menos 1 módulo com 1 aula', 1, lessons.length > 0],
        ['Todos os módulos têm título', 1, c.modules.every((m) => m.title.trim())],
        ['Todas as aulas completas (título + link/conteúdo)', 1, lessons.every(lessonComplete)],
        ['Preço definido', 2, c.is_free || Number(c.price) > 0],
    ];
}
