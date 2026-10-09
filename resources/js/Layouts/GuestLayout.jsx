import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-pearl px-4 py-10">
            <Link href="/" className="mb-6 flex items-center gap-2">
                <img
                    src="/images/passarinho.png"
                    alt="T.Academy"
                    className="h-8 w-auto"
                />
                <span className="text-lg font-bold text-ink">
                    T.Academy <span className="text-tblue">Platform</span>
                </span>
            </Link>

            <div className="w-full overflow-hidden rounded-2xl border border-mist bg-white px-6 py-7 shadow-card sm:max-w-md">
                {children}
            </div>
        </div>
    );
}
