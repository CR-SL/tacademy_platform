// Ícones dos painéis e da navegação, os do protótipo aprovado.
const Line = ({ size = 16, width = 1.6, children }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
    </svg>
);

export const IconSun = () => <Line size={20}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.400 1.400M5.6 18.400 7 17M17 7l1.400-1.400" /></Line>;
export const IconMoon = () => <Line size={20}><path d="M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500z" /></Line>;
export const IconPanels = () => <Line size={22}><rect x="3" y="4.500" width="18" height="15" rx="1.500" /><path d="M3 10h18M10 10v9.500" /></Line>;
export const IconUser = () => <Line size={22}><circle cx="12" cy="8" r="4" /><path d="M4.500 21c1-4 4-6 7.500-6s6.500 2 7.500 6" /></Line>;
export const IconX = () => <Line width={1.4}><path d="M5.500 5.500l13 13M18.500 5.500l-13 13" /></Line>;
export const IconFold = () => <Line width={1.4}><path d="m6 15 6-6 6 6" /></Line>;
export const IconArrow = () => <Line size={17} width={1.7}><path d="M4 12h15M14 7l5 5-5 5" /></Line>;
export const IconBack = () => <Line width={1.7}><path d="M20 12H5M10 7l-5 5 5 5" /></Line>;
export const IconCheck = () => <Line size={14} width={1.8}><path d="m5 12.500 4.500 4.500L19 7.500" /></Line>;

export const IconHome = () => <Line size={20}><path d="m4 11 8-7 8 7v9h-5v-6H9v6H4z" /></Line>;
export const IconBook = () => <Line size={20}><path d="M5 4h14v16H5z" /><path d="M9 4v16" /></Line>;
export const IconTest = () => <Line size={20}><path d="M6 3h12v18H6z" /><path d="m9 9 1.500 1.500L13 8M9 15h6" /></Line>;
export const IconDoc = () => <Line size={20}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /></Line>;
export const IconTeam = () => <Line size={20}><circle cx="9" cy="9" r="3.500" /><path d="M3 20c.6-3.500 3-5.500 6-5.500s5.400 2 6 5.500" /><path d="M16 6a3 3 0 0 1 0 6M18 15c1.700.7 2.700 2.400 3 5" /></Line>;
export const IconCatalog = () => <Line size={20}><circle cx="11" cy="11" r="6.500" /><path d="m16 16 4.500 4.500" /></Line>;
export const IconInbox = () => <Line size={20}><path d="M4 13V5h16v8" /><path d="M4 13v6h16v-6h-5l-1.500 2.500h-3L9 13z" /></Line>;
export const IconAdmin = () => <Line size={20}><path d="M4 20V11M10 20V5M16 20v-6M2 20h20" /></Line>;
export const IconCreate = () => <Line size={20}><path d="M12 5v14M5 12h14" /></Line>;
export const IconCert = () => <Line size={20}><circle cx="12" cy="9" r="5" /><path d="M9 13.500 7.500 21l4.500-2.500 4.500 2.500L15 13.500" /></Line>;

export const IconGrip = () => (
    <svg width="8" height="14" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
        {[2.5, 8, 13.5].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.500" />))}
    </svg>
);
export const IconCorner = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" aria-hidden="true"><path d="M9 1 1 9M9 5 5 9" /></svg>
);
export const IconPlay = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2.500 1.200v9.600L10.500 6z" /></svg>
);
export const IconTri = () => (
    <svg className="pn-tri" width="7" height="7" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><path d="M2 .500v7L7.500 4z" /></svg>
);
