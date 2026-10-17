@php
    $loggedIn = auth()->check();
    $ctaHref = $loggedIn ? route('dashboard') : route('login');
    $ctaLabel = $loggedIn ? 'Ir para a plataforma' : 'Entrar';
    // Caixa de login do botão "Entrar": começa sempre fechada e só abre ao carregar no botão.
    // Exceção: sem JavaScript o botão não a consegue abrir, por isso aí mostra-se quando há erros ou uma mensagem.
    $loginNoJsOpen = ! $loggedIn && ($errors->any() || session('status'));
    // Depois do logout a caixa abre sozinha com a mensagem "Sessão terminada"
    $loginOpenAfterLogout = ! $loggedIn && session('login_open');
@endphp
<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>T.Academy · Formação para técnicos de oficina automóvel</title>
    <meta name="description" content="A T.Academy forma técnicos de oficina automóvel com cursos práticos, aulas com IA, tarefas e certificados. Diagnóstico, eletrónica, redes CAN e gestão de oficina.">
    <link rel="canonical" href="{{ url('/') }}">
    <link rel="icon" type="image/png" href="/images/brand/passarinho.png">

    <meta property="og:type" content="website">
    <meta property="og:title" content="T.Academy · Gestão de Talentos">
    <meta property="og:description" content="Formação prática para técnicos de oficina automóvel.">
    <meta property="og:image" content="{{ url('/images/brand/logo-tacademy.png') }}">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
    {{-- Só as letras da palavra de fundo do hero ("T.ACADEMY") --}}
    <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&text=T.ACDEMY&display=swap" rel="stylesheet">

    @if ($loginNoJsOpen)
        <noscript><style>.login-pop[hidden] { display: block !important; }</style></noscript>
    @endif

    {{-- Pré-carregar as peças do pássaro para a montagem do hero --}}
    <link rel="preload" as="image" href="/images/logo3d/bird_whole.png">

    {{-- Marca a página como "com JS" antes de pintar, para as revelações não piscarem --}}
    <script>document.documentElement.classList.add('js')</script>
    @vite(['resources/css/landing.css', 'resources/js/landing.js'])
</head>
<body class="landing landing-home">

<a class="skip" href="#quem-somos">Saltar para o conteúdo</a>

{{-- A navbar "nasce" quando o logo do hero sobe e encaixa no canto (landing.js). data-in = entra em cascata. --}}
<nav class="nav" aria-label="Principal">
    <div class="nav-bg" data-nav-bg aria-hidden="true"></div>
    <a href="#top" class="nav-logo"><img data-nav-logo src="/images/brand/logo-tacademy.png" alt="T.Academy" width="110" height="26"></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav-links" data-menu data-in>Menu</button>
    <ul id="nav-links">
        <li data-in><a href="#quem-somos">Quem Somos</a></li>
        <li data-in><a href="{{ route('contacts') }}">Contactos</a></li>
        <li data-in><a href="{{ route('courses') }}">Cursos</a></li>
    </ul>
    <a class="btn btn-accent cut-8" href="{{ $ctaHref }}" data-in @guest data-login-open aria-haspopup="dialog" aria-expanded="false" aria-controls="login-pop" @endguest>{{ $ctaLabel }} ▶</a>
</nav>

@guest
    {{-- Login: o botão "Entrar" cresce e transforma-se nesta caixa (landing.js). Sem JS é um formulário normal. --}}
    <div class="login-pop" id="login-pop" role="dialog" aria-modal="false" aria-labelledby="login-pop-title" data-login-pop @if ($loginOpenAfterLogout) data-open-on-load @endif hidden>
        <button class="login-pop-close" type="button" aria-label="Fechar" data-login-close>×</button>
        <div class="login-pop-in">
            <h2 id="login-pop-title">Entra na oficina.</h2>
            @if (session('status'))
                <p class="login-pop-status" role="status">{{ session('status') }}</p>
            @endif
            <form method="POST" action="{{ route('login') }}" novalidate data-login-form>
                @csrf
                <div class="login-pop-field">
                    <label for="lp-email">Email</label>
                    <input id="lp-email" name="email" type="email" value="{{ old('email') }}" autocomplete="username" placeholder="nome@oficina.pt" required @error('email') class="bad" aria-invalid="true" @enderror>
                </div>
                <div class="login-pop-field">
                    <label for="lp-password">Palavra-passe <a href="{{ route('password.request') }}">Esqueceste-te?</a></label>
                    <input id="lp-password" name="password" type="password" autocomplete="current-password" required>
                </div>
                <label class="login-pop-remember"><input type="checkbox" name="remember" value="1" @checked(old('remember'))> Manter sessão iniciada</label>
                <p class="login-pop-err" role="alert" data-login-err>{{ $errors->first('email') ?: $errors->first('password') }}</p>
                <button class="btn cut-8 login-pop-go" type="submit">Entrar ▶</button>
                <p class="login-pop-alt">Sem conta? <a href="{{ route('register') }}">Criar conta</a></p>
            </form>
        </div>
    </div>
@endguest
<div class="progress" aria-hidden="true"></div>

<main>
    {{-- 1 · HERO: o pássaro monta-se peça a peça --}}
    <section class="hero" id="top">
        <div class="stage">
            <div class="grid-bg" data-hero="grid" aria-hidden="true"></div>
            <div class="ghost" data-hero="ghost" aria-hidden="true">T.ACADEMY</div>

            <div class="hero-copy top" data-hero="copyA">
                <p class="label">Gestão de Talentos · Formação Automóvel</p>
                <h1 class="h-display">Um bom técnico<br>não nasce feito.</h1>
            </div>

            {{-- As imagens das peças são criadas pelo landing.js; o pássaro inteiro fica como estado final sem JS --}}
            <div class="logo" data-hero="logo">
                <img data-hero="whole" src="/images/logo3d/bird_whole.png" alt="">
                <img data-hero="name" src="/images/logo3d/name.png" alt="T.Academy">
                <img data-hero="phrase" src="/images/logo3d/phrase.png" alt="Gestão de Talentos">
            </div>

            <div class="hero-copy bottom" data-hero="copyB">
                <h2 class="h-display">Constrói-se, peça a peça.</h2>
                <p>Cada curso é uma peça. Cada peça faz-te voar mais alto.</p>
            </div>
            <div class="scroll-hint" data-hero="hint" aria-hidden="true">FAZ SCROLL ↓</div>
        </div>
    </section>

    {{-- 2 · QUEM SOMOS --}}
    <section class="about" id="quem-somos">
        <div class="wrap">
            <div>
                <p class="label reveal">Quem somos</p>
                <h2 class="h-display reveal" style="--d:.08s">Formamos as pessoas que <em>mantêm Portugal em movimento.</em></h2>
                <p class="lead reveal" style="--d:.16s">A T.Academy é a área de formação e gestão de talentos para oficinas automóveis. Juntamos aulas práticas, avatares de IA e acompanhamento de equipa para que cada profissional aprenda ao seu ritmo — na oficina, no telemóvel ou em casa.</p>
                <div class="stats reveal" style="--d:.24s">
                    <div><b data-count="{{ $stats['courses'] }}">{{ $stats['courses'] }}</b><span>cursos</span></div>
                    <div><b data-count="{{ $stats['areas'] }}">{{ $stats['areas'] }}</b><span>áreas de formação</span></div>
                    <div><b data-count="{{ $stats['lessons'] }}">{{ $stats['lessons'] }}</b><span>aulas</span></div>
                </div>
            </div>
            <div class="depth" aria-hidden="true">
                <div class="stripe" data-speed="-0.25"></div>
                <div class="card-a cut-16" data-speed="0.12">
                    <b>IA</b>
                    <span>Avatares que dão a aula e respondem às tuas dúvidas, a qualquer hora.</span>
                </div>
                <div class="card-b cut-12" data-speed="-0.18">Formação certificada, feita por quem conhece a oficina.</div>
                <img class="bird-float" src="/images/brand/passarinho.png" alt="" data-speed="-0.2">
            </div>
        </div>
    </section>

    {{-- 3 · O QUE FAZEMOS --}}
    <section class="what" id="o-que-fazemos">
        <div class="head">
            <p class="label reveal">O que fazemos</p>
            <h2 class="h-display reveal" style="--d:.08s">Do primeiro diagnóstico ao certificado.</h2>
        </div>
        <div class="steps" data-steps>
            <svg viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden="true"><line data-step-line x1="0" y1="1" x2="100" y2="1" stroke="#F8B101" stroke-width="2" vector-effect="non-scaling-stroke" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
            <article class="step cut-16 reveal"><div class="n cut-8">01</div><h3>Aprende</h3><p>Cursos curtos e práticos, com vídeo, quizzes e aulas com avatar de IA que respondem às tuas dúvidas.</p></article>
            <article class="step cut-16 reveal" style="--d:.12s"><div class="n cut-8">02</div><h3>Pratica</h3><p>Tarefas diárias, desafios de equipa e XP. A aprendizagem transforma-se em rotina.</p></article>
            <article class="step cut-16 reveal" style="--d:.24s"><div class="n cut-8">03</div><h3>Certifica</h3><p>Certificados no fim de cada curso e uma área de gestor para acompanhar a evolução de toda a equipa.</p></article>
        </div>
    </section>

    {{-- 4 · CURSOS (uma fotografia por área → catálogo /cursos) --}}
    <section class="courses" id="cursos">
        <div class="head">
            <div>
                <p class="label reveal">Cursos</p>
                <h2 class="h-display reveal" style="--d:.08s">Escolhe o próximo curso.</h2>
            </div>
            <a class="btn btn-dark cut-8 reveal" style="--d:.16s" href="{{ route('courses') }}">Ver os {{ $stats['courses'] }} cursos <span aria-hidden="true">→</span></a>
        </div>
        <div class="area-tiles">
            @forelse ($areas as $area)
                <a class="area-tile cut-16 reveal" style="--d:{{ $loop->index * 0.12 }}s" href="{{ route('courses', ['area' => $area['slug']]) }}">
                    <img src="{{ $area['image'] }}" alt="" loading="lazy">
                    <span class="txt">
                        <span class="n">{{ $area['count'] }} {{ $area['count'] === 1 ? 'CURSO' : 'CURSOS' }}</span>
                        <h3>{{ $area['name'] }}</h3>
                        <span class="go">Explorar <span aria-hidden="true">→</span></span>
                    </span>
                </a>
            @empty
                <p class="empty">Novos cursos a caminho.</p>
            @endforelse
        </div>
    </section>

    {{-- 5 · CTA --}}
    <section class="cta">
        <img class="bird-big" data-bird-big src="/images/brand/passarinho.png" alt="" aria-hidden="true">
        <p class="label">Pronto para levantar voo?</p>
        <h2 class="h-display">Começa hoje.</h2>
        <p class="cta-text">Entra na plataforma e retoma onde ficaste — ou fala connosco para formar a tua equipa.</p>
        <a class="btn btn-dark cut-8" href="{{ $ctaHref }}" @guest data-login-trigger aria-haspopup="dialog" aria-controls="login-pop" @endguest>{{ $loggedIn ? 'Ir para a plataforma' : 'Entrar na plataforma' }} ▶</a>
    </section>
</main>

@include('partials.public-footer')

</body>
</html>
