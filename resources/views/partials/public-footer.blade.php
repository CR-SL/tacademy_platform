{{-- Rodapé das páginas públicas (landing e contactos). --}}
@php
    $contact = config('tacademy.contact');
    $social = config('tacademy.social');
    $loggedIn = auth()->check();
@endphp
<footer class="footer" id="rodape">
    <div>
        <img src="/images/brand/logo-tacademy-dark.png" alt="T.Academy" width="144" height="34" class="footer-logo">
        <p>Formação e gestão de talentos para o setor automóvel.</p>
        <div class="footer-social">
            @foreach ($social as $key => $net)
                <a href="{{ $net['url'] }}" target="_blank" rel="noopener" aria-label="{{ $net['label'] }} da T.Academy" class="cut-8">@include('partials.social-icon', ['name' => $key])</a>
            @endforeach
        </div>
    </div>
    <div>
        <h2>CONTACTOS</h2>
        @if ($contact['email'])<p><a href="mailto:{{ $contact['email'] }}">{{ $contact['email'] }}</a></p>@endif
        @if ($contact['phone'])<p><a href="tel:{{ preg_replace('/\s+/', '', $contact['phone']) }}">{{ $contact['phone'] }}</a></p>@endif
        @if ($contact['address'])<p>{{ $contact['address'] }}</p>@endif
        <p><a href="{{ route('contacts') }}#pedir-contacto">Pedir contacto</a></p>
        <p><a href="{{ route('contacts') }}#faq">Perguntas frequentes</a></p>
    </div>
    <div>
        <h2>PLATAFORMA</h2>
        <p><a href="{{ $loggedIn ? route('dashboard') : route('login') }}">{{ $loggedIn ? 'Ir para a plataforma' : 'Entrar' }}</a></p>
        <p><a href="{{ route('courses') }}">Cursos</a></p>
        <p class="copy">© {{ date('Y') }} T.Academy</p>
    </div>
</footer>
