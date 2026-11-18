import { t } from '@/i18n';
// Formatação partilhada pelo editor de cursos e pela lista "Os meus cursos".

export const levelLabels = {
    get iniciante() { return t('Iniciante'); },
    get intermedio() { return t('Intermédio'); },
    get avancado() { return t('Avançado'); },
};

// "1 curso" / "3 cursos": o texto do plural leva o número no :n
export const plural = (n, one, many) => (n === 1 ? one : many.replace(':n', n));

export function formatMinutes(m) {
    if (!m) return t('0 min');
    return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
}

export function formatEuro(v) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
}

export function formatBytes(b = 0) {
    return b > 1e6 ? `${(b / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
}

export const isHttpUrl = (u) => /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test((u ?? '').trim());

// Sites aceites no link do avatar (config tacademy.avatar_hosts, enviados pelo editor; também os subdomínios)
let avatarHosts = ['daily.co', 'tavus.io', 'avatar.tacademy.pt'];
export const setAvatarHosts = (hosts) => { if (Array.isArray(hosts) && hosts.length) avatarHosts = hosts; };
export const avatarHostList = () => avatarHosts;
export function isAvatarUrl(u) {
    const v = (u ?? '').trim();
    if (!/^https:\/\//i.test(v) || !isHttpUrl(v)) return false;
    try {
        const host = new URL(v).hostname.toLowerCase();
        return avatarHosts.some((h) => host === h || host.endsWith('.' + h));
    } catch {
        return false;
    }
}

// Vídeo carregado pelo formador (leitor próprio)
export const isUploadedVideo = (u) => /^\/storage\/cursos\/videos\/[\w-]+\.(mp4|webm)$/i.test((u ?? '').trim());

// Reconhece YouTube/Vimeo para mostrar a miniatura e o nome do serviço
export function linkInfo(url) {
    const u = (url ?? '').trim();
    if (isUploadedVideo(u)) return { tag: t('Vídeo carregado') };
    const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (yt) return { tag: 'YouTube', thumb: `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg` };
    if (/vimeo\.com\/\d+/.test(u)) return { tag: t('Vimeo') };
    if (isHttpUrl(u)) return { tag: t('Link externo') };
    return null;
}
