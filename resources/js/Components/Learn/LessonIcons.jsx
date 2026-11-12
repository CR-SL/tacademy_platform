// Ícones da página da aula
const S = ({ size = 16, width = 1.9, children }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const IconVideo = () => <S><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" /></S>;
export const IconDoc = () => <S><path d="M6 3h8l4 4v14H6z" /><path d="M9 12h6M9 16h6" /></S>;
export const IconPen = () => <S><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></S>;
export const IconUser = ({ size = 16 }) => <S size={size}><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.9-3.6 3.6-5.4 7-5.4s6.1 1.8 7 5.4" /></S>;
export const IconHelp = () => <S size={18} width={1.8}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.8" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></S>;
export const IconX = () => <S size={14} width={2}><path d="M5 5l14 14M19 5L5 19" /></S>;
export const IconDown = () => <S size={12} width={2.6}><path d="M6 9l6 6 6-6" /></S>;
export const IconLeft = () => <S size={13} width={2.4}><path d="M15 6l-6 6 6 6" /></S>;
export const IconRight = () => <S size={13} width={2.4}><path d="M9 6l6 6-6 6" /></S>;
export const IconCheck = () => <S size={13} width={2.4}><path d="M5 12.5l4.5 4.5L19 7.5" /></S>;
export const IconSwap = () => <S size={14} width={2}><path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" /></S>;
export const IconLock = () => <S size={12} width={2.2}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></S>;
export const IconSide = () => <S><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M9 5v14" /></S>;
