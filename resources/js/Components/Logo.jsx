// Logo T.Academy sem a assinatura. No tema escuro troca para a versão clara
// (a troca é feita em CSS, .ta-logo-*).
export default function Logo({ className = 'h-[26px]' }) {
    return (
        <>
            <img
                src="/images/brand/logo-nav.png"
                alt="T.Academy"
                className={`ta-logo-light w-auto ${className}`}
            />
            <img
                src="/images/brand/logo-nav-dark.png"
                alt="T.Academy"
                className={`ta-logo-dark w-auto ${className}`}
            />
        </>
    );
}
