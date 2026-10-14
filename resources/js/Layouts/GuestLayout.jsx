import Logo from '@/Components/Logo';
import ThemeToggle from '@/Components/ThemeToggle';

export default function GuestLayout({ children }) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-page px-4 py-10 text-ink">
            <ThemeToggle className="absolute right-4 top-4" />

            {/* A landing é Blade (não Inertia): link normal */}
            <a href="/" className="mb-7">
                <Logo className="h-9" />
            </a>

            <div className="ta-cut-16 w-full bg-surface px-6 py-7 sm:max-w-md">{children}</div>
        </div>
    );
}
