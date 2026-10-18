<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $subject ?? 'T.Academy' }}</title>
</head>
<body style="margin:0;padding:0;background:#F4F3EF;font-family:Arial,Helvetica,sans-serif;color:#18181B;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;padding:28px 12px;">
    <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;">
            <tr><td style="padding:22px 28px;border-bottom:3px solid #F8B101;">
                <img src="{{ url('/images/brand/logo-tacademy.png') }}" alt="T.Academy" height="26" style="height:26px;">
            </td></tr>
            <tr><td style="padding:28px;font-size:15px;line-height:1.6;">
                @yield('content')
            </td></tr>
            <tr><td style="padding:18px 28px;background:#18181B;color:#9095A0;font-size:12px;">
                T.Academy · Formação e gestão de talentos para o setor automóvel
            </td></tr>
        </table>
    </td></tr>
</table>
</body>
</html>
