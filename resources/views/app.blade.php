<!DOCTYPE html>
@php($themePref = auth()->user()?->theme)
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-theme="{{ $themePref === 'dark' ? 'dark' : 'light' }}" data-theme-pref="{{ $themePref }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" type="image/png" href="/images/brand/passarinho.png">

        <!-- Tema: o da conta (Definições) ou, sem sessão, o deste browser. Aplicado antes de pintar (evita o flash claro→escuro). -->
        <script nonce="{{ Vite::cspNonce() }}">
            try {
                var p = document.documentElement.getAttribute('data-theme-pref') || localStorage.getItem('ta-theme') || 'light';
                if (p === 'system') p = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', p === 'dark' ? 'dark' : 'light');
            } catch (e) {}
        </script>

        <!-- Letra da plataforma: Archivo, alojada na própria plataforma (importada em app.jsx; RGPD, sem pedidos à Google) -->

        <!-- Scripts -->
        @routes(nonce: Vite::cspNonce())
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
