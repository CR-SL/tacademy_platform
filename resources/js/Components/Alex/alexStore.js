// A conversa com o Alex, partilhada por toda a plataforma (fora das páginas, para não cair ao navegar).
// O servidor cria a sala privada no Tavus (POST /plataforma/alex/conversas) e a página entra nela com o Daily,
// a biblioteca de vídeo que o Tavus usa. O Daily só se carrega quando o aluno começa uma conversa.
import { useSyncExternalStore } from 'react';
import { t } from '@/i18n';

const idle = { status: 'idle', error: null, conv: null, place: null, alexVideo: null, alexAudio: null, selfVideo: null, mic: true, cam: false, left: null, credits: null, docked: 0 };
let state = { ...idle };
const listeners = new Set();
let call = null;
let alexWasHere = false;

function set(patch) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
}

export function useAlexCall() {
    return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

// Estados: idle → starting (a pedir a sala) → waiting (na sala, à espera do Alex) → live → ended | error
export const isActive = (s) => ['starting', 'waiting', 'live'].includes(s.status);

/** A aula põe a conversa dentro do painel do avatar; enquanto estiver lá, a janela flutuante não aparece. */
export function dock(on) {
    set({ docked: Math.max(0, state.docked + (on ? 1 : -1)) });
}

const xsrf = () => decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || '');

export async function startAlex({ place, lesson = null }) {
    if (isActive(state)) return;
    set({ ...idle, docked: state.docked, status: 'starting', place });

    let conv;
    try {
        const { data } = await window.axios.post('/plataforma/alex/conversas', { place, lesson });
        conv = data;
    } catch (e) {
        const res = e.response;
        set({ status: 'error', error: res?.data?.message || t('O Alex não está disponível agora. Tenta daqui a pouco.'), left: res?.data?.left ?? state.left, credits: res?.data?.credits ?? state.credits });
        return;
    }
    set({ conv, left: conv.left, credits: conv.credits });

    try {
        const { default: Daily } = await import('@daily-co/daily-js');
        call?.destroy?.();
        call = Daily.createCallObject({ subscribeToTracksAutomatically: true });
        alexWasHere = false;
        const sync = () => syncTracks();
        call.on('participant-joined', sync).on('participant-updated', sync).on('participant-left', onParticipantLeft)
            .on('track-started', sync).on('track-stopped', sync)
            .on('joined-meeting', () => { set({ status: 'waiting' }); sync(); })
            .on('left-meeting', () => finish())
            .on('camera-error', () => fail(t('Precisamos do microfone para falares com o Alex. Autoriza-o no browser e tenta outra vez.')))
            .on('error', () => fail(t('A ligação ao Alex caiu. Tenta outra vez.')));
        await call.join({ url: conv.url, token: conv.token || undefined, startVideoOff: true, startAudioOff: false });
    } catch {
        fail(t('Não foi possível ligar ao Alex. Verifica o microfone e a ligação à internet.'));
    }
}

function syncTracks() {
    if (!call) return;
    const ps = call.participants();
    const alex = Object.values(ps).find((p) => !p.local);
    const track = (p, kind) => (p?.tracks?.[kind]?.state === 'playable' ? p.tracks[kind].persistentTrack : null);
    const alexVideo = track(alex, 'video');
    if (alex) alexWasHere = true;
    set({
        alexVideo,
        alexAudio: track(alex, 'audio'),
        selfVideo: track(ps.local, 'video'),
        mic: call.localAudio(),
        cam: call.localVideo(),
        status: alexVideo || (alex && state.status === 'live') ? 'live' : state.status,
    });
}

// O Alex sai quando o Tavus fecha a sala (tempo máximo); a conversa acaba também aqui
function onParticipantLeft(e) {
    if (e?.participant && !e.participant.local && alexWasHere) endAlex();
    else syncTracks();
}

function fail(message) {
    const conv = state.conv;
    teardown();
    if (conv) tellServer(conv.id);
    set({ status: 'error', error: message, alexVideo: null, alexAudio: null, selfVideo: null });
}

function finish() {
    if (state.status === 'ended' || state.status === 'error') return;
    teardown();
    set({ status: 'ended', alexVideo: null, alexAudio: null, selfVideo: null });
}

function teardown() {
    const c = call;
    call = null;
    if (c) {
        try { c.leave().finally(() => c.destroy()); } catch { /* já saiu */ }
    }
}

// Avisa o servidor (que fecha a sala no Tavus). keepalive: também funciona ao fechar o separador.
function tellServer(id, keepalive = false) {
    return fetch(`/plataforma/alex/conversas/${id}/terminar`, {
        method: 'POST',
        keepalive,
        credentials: 'same-origin',
        headers: { 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

export async function endAlex() {
    const conv = state.conv;
    if (!conv && !isActive(state)) return;
    finish();
    if (conv) {
        const data = await tellServer(conv.id);
        if (data?.left != null) set({ left: data.left });
    }
}

/** Fecha a janela depois de uma conversa terminada ou de um erro. */
export function dismissAlex() {
    if (isActive(state)) return;
    set({ ...idle, docked: state.docked, left: state.left, credits: state.credits });
}

export function toggleMic() {
    if (!call) return;
    call.setLocalAudio(!call.localAudio());
    syncTracks();
}

export function toggleCam() {
    if (!call) return;
    call.setLocalVideo(!call.localVideo());
    syncTracks();
}

// Ao fechar o separador ou o browser, a sala fecha logo (o Tavus também a fecha sozinho passados 30 s)
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        if (state.conv && isActive(state)) tellServer(state.conv.id, true);
    });
}
