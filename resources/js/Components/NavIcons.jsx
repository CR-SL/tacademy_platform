// Ícones de linha da sidebar do aluno — portados do protótipo tacademy-platform-blue.html.
// SVG (não emoji) para respeitarem `color` (amarelo por defeito, azul quando ativos).

const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

export function HomeIcon(props) {
    return (
        <svg {...base} {...props}>
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10h14V10" />
        </svg>
    );
}

export function CatalogIcon(props) {
    return (
        <svg {...base} {...props}>
            <path d="M4 5c2-1 5-1 7 0v14c-2-1-5-1-7 0V5z" />
            <path d="M20 5c-2-1-5-1-7 0v14c2-1 5-1 7 0V5z" />
        </svg>
    );
}

export function ExploreIcon(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M15 9l-2 6-6 2 2-6z" />
        </svg>
    );
}

export function AchievementsIcon(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="12" cy="8" r="5" />
            <path d="M8 13l-2 8 6-3 6 3-2-8" />
        </svg>
    );
}

export function GoalsIcon(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1" />
        </svg>
    );
}

export function TeamIcon(props) {
    return (
        <svg {...base} {...props}>
            <circle cx="9" cy="8" r="3" />
            <path d="M2 20c0-3 3-5 7-5s7 2 7 5" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M16 15c2.5.3 4 1.8 4 5" />
        </svg>
    );
}
