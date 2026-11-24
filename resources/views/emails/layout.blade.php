<!doctype html>
<html lang="{{ app()->getLocale() === 'en' ? 'en' : 'pt-PT' }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>{{ $subject ?? 'T.Academy' }}</title>
{{-- A Manrope vem do nosso servidor (public/fonts/email), não da Google: o IP de quem abre o email não vai
     para terceiros (RGPD). Só aparece nos programas que carregam letras (Apple Mail, iOS); os outros usam Arial. --}}
<style>
    @font-face { font-family: 'Manrope'; font-style: normal; font-weight: 200 800; font-display: swap;
        src: url('{{ url('/fonts/email/manrope-latin-wght-normal.woff2') }}') format('woff2');
        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
    @font-face { font-family: 'Manrope'; font-style: normal; font-weight: 200 800; font-display: swap;
        src: url('{{ url('/fonts/email/manrope-latin-ext-wght-normal.woff2') }}') format('woff2');
        unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
</style>
<style>
    @media (max-width: 620px) {
        .ta-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .ta-h1 { font-size: 23px !important; }
        .ta-btn { display: block !important; text-align: center !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:Manrope,Arial,Helvetica,sans-serif;color:#18181B;-webkit-font-smoothing:antialiased;">
@isset($preheader)
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F4F4F4;">{{ $preheader }}</div>
@endisset
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;">
    <tr><td align="center" style="padding:32px 12px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
            {{-- Cabeçalho --}}
            <tr><td style="height:4px;background:#F8B101;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr><td class="ta-pad" style="background:#FFFFFF;padding:26px 36px 0;">
                <a href="{{ url('/') }}" style="text-decoration:none;"><img src="{{ url('/images/brand/logo-tacademy.png') }}" alt="T.Academy" height="30" style="display:block;height:30px;width:auto;border:0;"></a>
            </td></tr>

            {{-- Conteúdo --}}
            <tr><td class="ta-pad" style="background:#FFFFFF;padding:30px 36px 34px;font-size:15px;line-height:1.6;color:#3C3B38;">
                @yield('content')
            </td></tr>

            {{-- Ajuda --}}
            <tr><td class="ta-pad" style="background:#FFFFFF;padding:0 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="border-top:1px solid #E7E4DD;padding:18px 0 24px;font-size:13px;line-height:1.5;color:#6E6B63;">
                        {{ __('Precisas de ajuda?') }}
                        <a href="{{ url('/contactos') }}" style="color:#18181B;font-weight:600;text-decoration:underline;">{{ __('Fala connosco') }}</a>
                    </td>
                </tr></table>
            </td></tr>

            {{-- Rodapé --}}
            <tr><td class="ta-pad" style="background:#18181B;padding:22px 36px;font-size:12px;line-height:1.6;color:#9A9A96;">
                <strong style="color:#F4F4F2;font-weight:600;">T.Academy</strong> · {{ __('Formação e gestão de talentos para o setor automóvel') }}<br>
                {{ __('Recebeste este email por causa da tua conta na T.Academy.') }}
            </td></tr>
        </table>
    </td></tr>
</table>
</body>
</html>
