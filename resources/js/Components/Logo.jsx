// Logo T.Academy (PNG original da marca). No tema escuro troca para a versão
// com "Gestão de Talentos" em claro — a troca é feita em CSS (.ta-logo-*).
export default function Logo({ className = 'h-[26px]' }) {
    return (
        <>
            <img
                src="/images/brand/logo-tacademy.png"
                alt="T.Academy"
                className={`ta-logo-light w-auto ${className}`}
            />
            <img
                src="/images/brand/logo-tacademy-dark.png"
                alt="T.Academy"
                className={`ta-logo-dark w-auto ${className}`}
            />
        </>
    );
}
