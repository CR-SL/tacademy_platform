<!doctype html>
<html lang="{{ app()->getLocale() === 'en' ? 'en' : 'pt-PT' }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>{{ $subject ?? 'T.Academy' }}</title>
{{-- A Manrope só aparece nos programas que carregam letras (Apple Mail, iOS); os outros usam Arial --}}
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap" rel="stylesheet">
<style>
    @media (max-width: 620px) {
        .ta-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .ta-h1 { font-size: 23px !important; }
        .ta-btn { display: block !important; text-align: center !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background:#F4F3EF;font-family:Manrope,Arial,Helvetica,sans-serif;color:#18181B;-webkit-font-smoothing:antialiased;">
@isset($preheader)
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F4F3EF;">{{ $preheader }}</div>
@endisset
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;">
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
