<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    // O Alex (avatar do Tavus) pela API. A chave fica só no servidor (.env e Railway).
    // O pal_id e o face_id não são secretos: só identificam o Alex e o rosto dele.
    // Os cursos com o Alex ligam-se no editor do curso (formador IA), por quem tem a permissão cursos.alex.
    'tavus' => [
        'api_key' => env('TAVUS_API_KEY'),
        'base_url' => env('TAVUS_BASE_URL', 'https://tavusapi.com'),
        'pal_id' => env('TAVUS_PAL_ID', 'p18d6e1b675e'),
        'face_id' => env('TAVUS_FACE_ID', 'rdea4449f835'),
        'minutes' => (int) env('TAVUS_ALEX_MINUTES', 15),
        'per_day' => (int) env('TAVUS_ALEX_PER_DAY', 3),
        // Créditos de avatar: 1 crédito = 1 conversa. Pacotes à venda: créditos => preço em euros (IVA incluído)
        'packs' => [5 => 20, 10 => 35, 20 => 60],
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
