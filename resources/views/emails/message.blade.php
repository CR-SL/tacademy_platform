{{-- Email da plataforma: estado, título, texto e, quando houver, o cartão do curso, o resumo,
     os próximos passos e um botão. Usado por App\Mail\PlatformMail. --}}
@extends('emails.layout')

@section('content')
    @if ($badge)
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr>
            <td style="background:#E6F4EC;color:#1E7A45;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">&#10003;&nbsp; {{ $badge }}</td>
        </tr></table>
    @endif

    <h1 class="ta-h1" style="margin:0 0 12px;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-.01em;color:#18181B;">{{ $heading }}</h1>
    @foreach ($lines as $line)
        <p style="margin:0 0 12px;">{!! nl2br(e($line)) !!}</p>
    @endforeach

    @if ($quote)
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr>
            <td style="padding:14px 16px;background:#F4F4F4;border-left:3px solid #F8B101;white-space:pre-line;color:#18181B;">{{ $quote }}</td>
        </tr></table>
    @endif

    {{-- Cartão do curso: capa pequena ao lado (serve para capas na vertical e na horizontal) --}}
    @if ($card)
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;background:#F4F4F4;">
            <tr>
                @if (! empty($card['image']))
                    <td width="128" valign="top" style="padding:16px 0 16px 16px;">
                        <img src="{{ $card['image'] }}" alt="" width="112" style="display:block;width:112px;height:auto;border:0;">
                    </td>
                @endif
                <td valign="top" style="padding:16px 18px;">
                    @if (! empty($card['label']))
                        <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6E6B63;">{{ $card['label'] }}</div>
                    @endif
                    <div style="margin-top:6px;font-size:18px;line-height:1.25;font-weight:800;color:#18181B;">{{ $card['title'] }}</div>
                    @if (! empty($card['facts']))
                        <div style="margin-top:10px;font-size:13px;line-height:1.6;color:#3C3B38;">{{ implode('  ·  ', $card['facts']) }}</div>
                    @endif
                </td>
            </tr>
        </table>
    @endif

    {{-- Botão --}}
    @if ($actionUrl)
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr>
            <td style="border-radius:999px;background:#F8B101;">
                <a class="ta-btn" href="{{ $actionUrl }}" style="display:inline-block;padding:14px 30px;border-radius:999px;color:#111111;text-decoration:none;font-weight:700;font-size:15px;">{{ $actionText }} &rarr;</a>
            </td>
        </tr></table>
    @endif

    {{-- Resumo (ex.: a compra) --}}
    @if ($summary)
        <div style="margin:30px 0 8px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6E6B63;">{{ $summaryTitle ?? __('Resumo') }}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            @foreach ($summary as [$label, $value])
                <tr>
                    <td style="padding:10px 0;border-top:1px solid #E7E4DD;color:#6E6B63;">{{ $label }}</td>
                    <td align="right" style="padding:10px 0;border-top:1px solid #E7E4DD;color:#18181B;font-weight:600;">{{ $value }}</td>
                </tr>
            @endforeach
        </table>
    @endif

    {{-- Próximos passos --}}
    @if ($steps)
        <div style="margin:28px 0 10px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6E6B63;">{{ __('Próximos passos') }}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            @foreach ($steps as $i => $step)
                <tr>
                    <td width="34" valign="top" style="padding:0 0 12px;">
                        <div style="width:24px;height:24px;line-height:24px;border-radius:999px;background:#18181B;color:#FFFFFF;text-align:center;font-size:12px;font-weight:700;">{{ $i + 1 }}</div>
                    </td>
                    <td valign="top" style="padding:2px 0 12px;color:#3C3B38;">{{ $step }}</td>
                </tr>
            @endforeach
        </table>
    @endif

    {{-- Nota final (ex.: validade do link, "se não foste tu, ignora") --}}
    @if (! empty($note))
        <p style="margin:22px 0 0;font-size:13px;line-height:1.55;color:#6E6B63;">{{ $note }}</p>
    @endif

    @if ($actionUrl)
        <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#6E6B63;">{{ __('Se o botão não funcionar, copia este endereço:') }}<br><a href="{{ $actionUrl }}" style="color:#6E6B63;word-break:break-all;">{{ $actionUrl }}</a></p>
    @endif
@endsection
