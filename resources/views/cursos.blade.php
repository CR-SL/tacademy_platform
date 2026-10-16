@php
    $loggedIn = auth()->check();
    $ctaHref = $loggedIn ? route('dashboard') : route('login');
    $ctaLabel = $loggedIn ? 'Ir para a plataforma' : 'Entrar';
    $euro = fn ($v) => number_format($v, 2, ',', ' ').' €';
    $dur = fn ($m) => $m >= 60 ? intdiv($m, 60).'h'.($m % 60 ? str_pad($m % 60, 2, '0', STR_PAD_LEFT) : '') : $m.' min';
    $count = $courses->count();
@endphp
<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cursos · T.Academy</title>
    <meta name="description" content="Catálogo de cursos da T.Academy para técnicos de oficina automóvel: diagnóstico, eletrónica, gestão de oficina e mais. Formação prática com aulas de IA e certificado.">
    <link rel="canonical" href="{{ route('courses') }}">
    <link rel="icon" type="image/png" href="/images/brand/passarinho.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">

    <script>document.documentElement.classList.add('js')</script>
    @vite(['resources/css/landing.css', 'resources/css/courses.css', 'resources/js/courses.js'])
</head>
<body class="landing landing-courses">

<a class="skip" href="#cursos">Saltar para os cursos</a>

<nav class="nav" aria-label="Principal">
    <div class="nav-bg" aria-hidden="true"></div>
    <a href="{{ route('home') }}" class="nav-logo"><img src="/images/brand/logo-tacademy.png" alt="T.Academy" width="110" height="26"></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav-links" data-menu>Menu</button>
    <ul id="nav-links">
        <li><a href="{{ route('home') }}#quem-somos">Quem Somos</a></li>
        <li><a href="{{ route('contacts') }}">Contactos</a></li>
        <li><a class="on" href="{{ route('courses') }}" aria-current="page">Cursos</a></li>
    </ul>
    <a class="btn btn-accent cut-8" href="{{ $ctaHref }}">{{ $ctaLabel }} ▶</a>
</nav>

<main id="cursos" class="cc">
    <div class="cc-top">
        <span class="cc-mono">Catálogo</span>
        <h1><span data-count>{{ $count }} {{ $count === 1 ? 'curso' : 'cursos' }}</span> disponíveis</h1>
    </div>

    <div class="cc-filters">
        <nav class="cc-tabs" aria-label="Filtrar por área">
            <button class="cc-tab" type="button" data-area="all" aria-pressed="true">Todas</button>
            @foreach ($areas as $area)
                <button class="cc-tab" type="button" data-area="{{ $area->slug }}" aria-pressed="false">{{ $area->name }}</button>
            @endforeach
        </nav>
        <button class="cc-sbtn" type="button" data-open-search aria-label="Pesquisar cursos" aria-expanded="false" aria-controls="cc-sheet">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>
    </div>
    <div class="cc-qline" data-qline hidden>A mostrar resultados para <b data-qtext></b><button class="cc-chip" type="button" data-clear-q>Limpar ✕</button></div>

    {{-- Cartões no HTML (indexáveis); o JS só filtra e abre o detalhe --}}
    <div class="cc-grid" data-grid>
        @foreach ($courses as $c)
            <a class="cc-card" href="{{ route('courses', ['curso' => $c['slug']]) }}" data-course="{{ $c['id'] }}" data-area="{{ $c['area'] }}" aria-haspopup="dialog">
                <span class="cc-lift"><span class="cc-ph">
                    <img src="{{ $c['image'] }}" alt="" loading="lazy" width="440" height="550">
                    @if ($c['ai'])
                        <span class="cc-badges"><span class="cc-badge">✦ Aula com IA</span></span>
                    @endif
                    <span class="cc-grad" aria-hidden="true"></span>
                    <span class="cc-txt">
                        <span class="cc-mono">{{ $c['areaName'] }} · {{ $c['level'] }}</span>
                        <span class="cc-ttl">{{ $c['title'] }}</span>
                        <span class="cc-meta"><span>{{ $dur($c['minutes']) }} · {{ $c['lessons'] }} aulas</span><span class="cc-price">{{ $euro($c['price']) }}</span></span>
                    </span>
                </span></span>
            </a>
        @endforeach
    </div>
    <div class="cc-empty" data-empty hidden><b>Nenhum curso corresponde a estes filtros</b><span>Limpe a pesquisa ou escolha «Todas» para ver o catálogo completo.</span></div>
</main>

@include('partials.public-footer')

{{-- Pesquisa: folha que desce do topo --}}
<div class="cc-scrim" data-search-scrim hidden></div>
<div class="cc-sheet" id="cc-sheet" role="dialog" aria-modal="true" aria-label="Pesquisar cursos" data-sheet hidden>
    <div class="cc-sheet-in">
        <div class="cc-field">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            <input type="text" data-q placeholder="O que quer aprender?" aria-label="Pesquisar cursos" autocomplete="off">
            <button class="cc-x" type="button" data-close-search aria-label="Fechar pesquisa"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
        </div>
        <div data-sugg-box>
            <span class="cc-mono">Sugestões</span>
            <div class="cc-sugg">
                @foreach (['Diagnóstico', 'OBD', 'Eletrónica', 'Bateria', 'Gestão'] as $s)
                    <button class="cc-chip" type="button" data-sugg="{{ $s }}">{{ $s }}</button>
                @endforeach
            </div>
        </div>
        <div data-res-box hidden><span class="cc-mono" data-res-label></span><div class="cc-results" data-results></div></div>
    </div>
</div>

{{-- Detalhe do curso: aba lateral (conteúdo gerado pelo courses.js) --}}
<div class="cc-scrim" data-detail-scrim hidden></div>
<aside class="cc-drawer" role="dialog" aria-modal="true" aria-labelledby="cc-d-title" data-drawer hidden></aside>

{{-- Dados para a pesquisa e o detalhe --}}
<script>
    window.TA_COURSES = @json($courses);
    window.TA_ENROL = { href: @json($loggedIn ? route('dashboard') : route('login')), label: @json($loggedIn ? 'Ir para a plataforma' : 'Inscrever-me') };
</script>
</body>
</html>
