{{-- Email simples: título, parágrafos e (opcional) um botão. Usado por App\Mail\PlatformMail. --}}
@extends('emails.layout')

@section('content')
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.2;">{{ $heading }}</h1>
    @foreach ($lines as $line)
        <p style="margin:0 0 12px;">{!! nl2br(e($line)) !!}</p>
    @endforeach
    @if ($quote)
        <div style="margin:16px 0;padding:14px 16px;background:#F4F3EF;border-left:3px solid #F8B101;white-space:pre-line;">{{ $quote }}</div>
    @endif
    @if ($actionUrl)
        <p style="margin:22px 0 6px;">
            <a href="{{ $actionUrl }}" style="display:inline-block;background:#F8B101;color:#18181B;text-decoration:none;font-weight:bold;padding:12px 20px;text-transform:uppercase;letter-spacing:.04em;font-size:14px;">{{ $actionText }}</a>
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#66666D;">Se o botão não funcionar, copia este endereço: {{ $actionUrl }}</p>
    @endif
@endsection
