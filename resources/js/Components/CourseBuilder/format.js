// Formatação partilhada pelo editor de cursos e pela lista "Os meus cursos".

export const levelLabels = { iniciante: 'Iniciante', intermedio: 'Intermédio', avancado: 'Avançado' };

export function formatMinutes(m) {
    if (!m) return '0 min';
    return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
}

export function formatEuro(v) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
}

export function formatBytes(b = 0) {
    return b > 1e6 ? `${(b / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
}

export const isHttpUrl = (u) => /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test((u ?? '').trim());

// Reconhece YouTube/Vimeo para mostrar a miniatura e o nome do serviço
export function linkInfo(url) {
    const u = (url ?? '').trim();
    const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (yt) return { tag: 'YouTube', thumb: `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg` };
    if (/vimeo\.com\/\d+/.test(u)) return { tag: 'Vimeo' };
    if (isHttpUrl(u)) return { tag: 'Link externo' };
    return null;
}
