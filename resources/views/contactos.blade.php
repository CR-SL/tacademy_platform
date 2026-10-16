@php
    $loggedIn = auth()->check();
    $ctaHref = $loggedIn ? route('dashboard') : route('login');
    $ctaLabel = $loggedIn ? 'Ir para a plataforma' : 'Entrar';
    $sent = session('contact_sent');
    $type = old('type', request('tipo') === 'particular' ? 'particular' : 'empresa');
    $hasDirect = collect($contact)->only(['email', 'phone', 'hours', 'address'])->filter()->isNotEmpty();
    $responseTime = $contact['response_time'] ?? null;
@endphp
<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Contactos · T.Academy</title>
    <meta name="description" content="Fala com a T.Academy: pede contacto sobre cursos para a tua empresa ou para ti, segue-nos nas redes sociais e consulta as perguntas frequentes.">
    <link rel="canonical" href="{{ route('contacts') }}">
    <link rel="icon" type="image/png" href="/images/brand/passarinho.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">

    <script>document.documentElement.classList.add('js')</script>
    @vite(['resources/css/landing.css', 'resources/js/contact.js'])
</head>
<body class="landing landing-contact">

<a class="skip" href="#pedir-contacto">Saltar para o formulário</a>

<nav class="nav" aria-label="Principal">
    <div class="nav-bg" aria-hidden="true"></div>
    <a href="{{ route('home') }}" class="nav-logo"><img src="/images/brand/logo-tacademy.png" alt="T.Academy" width="110" height="26"></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav-links" data-menu>Menu</button>
    <ul id="nav-links">
        <li><a href="{{ route('home') }}#quem-somos">Quem Somos</a></li>
        <li><a class="on" href="{{ route('contacts') }}" aria-current="page">Contactos</a></li>
        <li><a href="{{ route('courses') }}">Cursos</a></li>
    </ul>
    <a class="btn btn-accent cut-8" href="{{ $ctaHref }}">{{ $ctaLabel }} ▶</a>
</nav>

<main>
    <header class="c-head">
        <div>
            <p class="label reveal">Contactos</p>
            <h1 class="h-display reveal" style="--d:.06s">Fala connosco.</h1>
            <p class="c-lead reveal" style="--d:.12s">Dúvidas sobre um curso, formação para a tua equipa ou ajuda com a plataforma. Diz-nos quem és e mostramos-te o caminho mais rápido.</p>
        </div>
        <div class="who cut-8 reveal" style="--d:.18s" role="group" aria-label="Quem és" data-who-group hidden>
            <button type="button" data-who="empresa" aria-pressed="{{ $type === 'empresa' ? 'true' : 'false' }}">Sou empresa</button>
            <button type="button" data-who="particular" aria-pressed="{{ $type === 'particular' ? 'true' : 'false' }}">Sou particular</button>
        </div>
    </header>

    <section class="c-main">
        {{-- Pedido de contacto --}}
        <div class="c-card cut-16" id="pedir-contacto">
            @if ($sent)
                <div class="c-success" role="status">
                    <div class="tick cut-8" aria-hidden="true">✓</div>
                    <h2>Pedido enviado.</h2>
                    <p class="c-sub">Obrigado, {{ $sent['name'] }}! Vamos responder para {{ $sent['email'] }}{{ $responseTime ? ' em até '.$responseTime : ' assim que possível' }}.</p>
                    <a class="btn btn-ghost cut-8" href="{{ route('contacts') }}#pedir-contacto">Enviar outro pedido</a>
                </div>
            @else
                <h2>Pedir contacto</h2>
                <p class="c-sub" data-form-sub
                   data-empresa="Conta-nos o que a tua equipa precisa. Preparamos uma proposta à medida."
                   data-particular="Tens dúvidas sobre um curso? Pergunta à vontade — respondemos por email.">
                    {{ $type === 'empresa' ? 'Conta-nos o que a tua equipa precisa. Preparamos uma proposta à medida.' : 'Tens dúvidas sobre um curso? Pergunta à vontade — respondemos por email.' }}
                </p>

                <form class="c-form" method="POST" action="{{ route('contacts.store') }}" novalidate data-contact-form>
                    @csrf
                    {{-- Sem JS, a escolha empresa/particular é feita aqui --}}
                    <fieldset class="field full c-type" data-type-fallback>
                        <legend>Sou</legend>
                        <label><input type="radio" name="type" value="empresa" @checked($type === 'empresa')> Empresa</label>
                        <label><input type="radio" name="type" value="particular" @checked($type === 'particular')> Particular</label>
                    </fieldset>

                    <div class="field @error('name') bad @enderror">
                        <label for="f-name">Nome <i>*</i></label>
                        <input id="f-name" name="name" value="{{ old('name') }}" autocomplete="name" required maxlength="150">
                        @error('name')<span class="err">{{ $message }}</span>@enderror
                    </div>
                    <div class="field @error('email') bad @enderror">
                        <label for="f-email">Email <i>*</i></label>
                        <input id="f-email" name="email" type="email" value="{{ old('email') }}" autocomplete="email" required maxlength="150">
                        @error('email')<span class="err">{{ $message }}</span>@enderror
                    </div>
                    <div class="field">
                        <label for="f-phone">Telefone</label>
                        <input id="f-phone" name="phone" type="tel" value="{{ old('phone') }}" autocomplete="tel" placeholder="Opcional" maxlength="30">
                    </div>
                    <div class="field">
                        <label for="f-course">Curso de interesse</label>
                        <select id="f-course" name="course_id">
                            <option value="">Ainda não sei / vários</option>
                            @foreach ($courses as $course)
                                <option value="{{ $course->id }}" @selected(old('course_id') == $course->id)>{{ $course->title }}</option>
                            @endforeach
                        </select>
                    </div>

                    <div class="c-company" data-company @if ($type !== 'empresa') hidden @endif>
                        <div class="field @error('company') bad @enderror">
                            <label for="f-company">Empresa / Oficina <i>*</i></label>
                            <input id="f-company" name="company" value="{{ old('company') }}" autocomplete="organization" maxlength="150">
                            @error('company')<span class="err">{{ $message }}</span>@enderror
                        </div>
                        <div class="field">
                            <label for="f-size">Nº de pessoas a formar</label>
                            <select id="f-size" name="team_size">
                                @foreach ($teamSizes as $value => $label)
                                    <option value="{{ $value }}" @selected(old('team_size') === $value)>{{ $label }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                    <div class="field full @error('message') bad @enderror">
                        <label for="f-msg">Mensagem <i>*</i></label>
                        <textarea id="f-msg" name="message" placeholder="Em que podemos ajudar?" required maxlength="3000">{{ old('message') }}</textarea>
                        @error('message')<span class="err">{{ $message }}</span>@enderror
                    </div>

                    {{-- Armadilha para bots: invisível para pessoas --}}
                    <div class="hp" aria-hidden="true"><label for="f-website">Website</label><input id="f-website" name="website" tabindex="-1" autocomplete="off"></div>

                    <div class="field full @error('consent') bad @enderror">
                        <label class="consent"><input type="checkbox" id="f-consent" name="consent" value="1" @checked(old('consent'))> <span>Aceito que a T.Academy use estes dados para responder ao meu pedido.</span></label>
                        @error('consent')<span class="err">{{ $message }}</span>@enderror
                    </div>

                    <div class="actions">
                        <small>{{ $responseTime ? 'Respondemos em até '.$responseTime.'.' : 'Respondemos por email.' }}</small>
                        <button class="btn btn-accent cut-8" type="submit">Enviar pedido ▶</button>
                    </div>
                </form>
            @endif
        </div>

        {{-- Redes sociais + contacto direto --}}
        <aside class="c-side">
            <div class="c-card cut-16">
                <h2>Segue-nos</h2>
                <p class="c-sub">Novidades, cursos novos e dicas de oficina.</p>
                <div class="socials">
                    @foreach ($social as $key => $net)
                        <a class="social cut-12" href="{{ $net['url'] }}" target="_blank" rel="noopener">
                            <span class="ic cut-8">@include('partials.social-icon', ['name' => $key])</span>
                            <span><b>{{ $net['label'] }}</b><span>{{ $net['handle'] }}</span></span>
                            <span class="go" aria-hidden="true">↗</span>
                        </a>
                    @endforeach
                </div>
            </div>
            @if ($hasDirect)
                <div class="c-dark cut-16">
                    <p class="label">Contacto direto</p>
                    <dl>
                        @if ($contact['email'])<div><dt>EMAIL</dt><dd><a href="mailto:{{ $contact['email'] }}">{{ $contact['email'] }}</a></dd></div>@endif
                        @if ($contact['phone'])<div><dt>TELEFONE</dt><dd><a href="tel:{{ preg_replace('/\s+/', '', $contact['phone']) }}">{{ $contact['phone'] }}</a></dd></div>@endif
                        @if ($contact['hours'])<div><dt>HORÁRIO</dt><dd>{{ $contact['hours'] }}</dd></div>@endif
                        @if ($contact['address'])<div><dt>MORADA</dt><dd>{{ $contact['address'] }}</dd></div>@endif
                    </dl>
                </div>
            @endif
        </aside>
    </section>

    {{-- Perguntas frequentes --}}
    <section class="c-faq" id="faq">
        <div class="c-faq-in">
            <div class="c-faq-top">
                <div>
                    <p class="label">Perguntas frequentes</p>
                    <h2 class="h-display">Antes de falares connosco.</h2>
                </div>
                <div class="tabs cut-8" role="tablist" aria-label="Tipo de pergunta" data-tabs hidden>
                    <button type="button" role="tab" data-tab="empresa" aria-selected="{{ $type === 'empresa' ? 'true' : 'false' }}">Empresas <span class="n" data-count="empresa">{{ count($faqs['empresa']) }}</span></button>
                    <button type="button" role="tab" data-tab="particular" aria-selected="{{ $type === 'particular' ? 'true' : 'false' }}">Particulares <span class="n" data-count="particular">{{ count($faqs['particular']) }}</span></button>
                </div>
            </div>
            <label class="search" data-search-wrap hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                <input type="search" id="faq-search" placeholder="Procurar nas perguntas (ex.: certificado, fatura, telemóvel)" aria-label="Procurar nas perguntas frequentes" data-search>
            </label>

            @foreach (['empresa' => 'Empresas', 'particular' => 'Particulares'] as $group => $title)
                <div class="faq-group" data-group="{{ $group }}">
                    <h3 class="faq-group-title">{{ $title }}</h3>
                    @foreach ($faqs[$group] as [$question, $answer])
                        <details class="cut-12" data-faq>
                            <summary><span data-q>{{ $question }}</span><span class="pm cut-8" aria-hidden="true">+</span></summary>
                            <div class="ans"><p data-a>{{ $answer }}</p></div>
                        </details>
                    @endforeach
                </div>
            @endforeach
            <div class="empty-faq cut-12" data-empty hidden></div>

            <div class="faq-cta cut-12">
                <b>Não encontraste a resposta?</b>
                <a class="btn btn-dark cut-8" href="#pedir-contacto">Pedir contacto ▶</a>
            </div>
        </div>
    </section>
</main>

@include('partials.public-footer')

</body>
</html>
