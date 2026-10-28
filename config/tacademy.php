<?php

return [

    /*
     | Contactos mostrados nas páginas públicas (landing e /contactos).
     | Definir no .env; os que ficarem vazios não aparecem.
     */
    // Desenvolvimento/testes: todos os emails da plataforma são entregues só a este endereço.
    'mail_always_to' => env('MAIL_ALWAYS_TO'),

    'contact' => [
        'email' => env('TACADEMY_CONTACT_EMAIL'),
        'phone' => env('TACADEMY_CONTACT_PHONE'),
        'address' => env('TACADEMY_CONTACT_ADDRESS'),
        'hours' => env('TACADEMY_CONTACT_HOURS'),          // ex.: "Dias úteis, 9h – 18h"
        'response_time' => env('TACADEMY_RESPONSE_TIME'),  // ex.: "2 dias úteis"
    ],

    /*
     | Redes sociais (rodapé e página de contactos).
     */
    'social' => [
        'linkedin' => ['label' => 'LinkedIn', 'handle' => 'T.Academy', 'url' => 'https://www.linkedin.com/company/t-academy/home/'],
        'instagram' => ['label' => 'Instagram', 'handle' => '@gestao.de.talentos', 'url' => 'https://www.instagram.com/gestao.de.talentos/'],
        'facebook' => ['label' => 'Facebook', 'handle' => '/gestao.talentos', 'url' => 'https://www.facebook.com/gestao.talentos'],
    ],

    /*
     | Fotografia de cada curso no catálogo público (/cursos), pelo slug do curso.
     | Se o curso tiver thumbnail_url preenchido (backoffice), esse tem prioridade.
     | Imagens em public/images/cursos/ (escolhidas da pasta /assets).
     */
    'course_images' => [
        'diagnostico-de-sistemas-obd-ii' => '/images/cursos/obd-ii.jpg',
        'introducao-a-eletronica-automovel' => '/images/cursos/eletronica-intro.jpg',
        'diagnostico-de-falhas-eletricas' => '/images/cursos/falhas-eletricas.jpg',
        'scanner-e-osciloscopio-na-pratica' => '/images/cursos/scanner-osciloscopio.jpg',
        'redes-can-bus-no-automovel' => '/images/cursos/can-bus.jpg',
        'baterias-e-sistemas-de-carga' => '/images/cursos/baterias-carga.jpg',
        'gestao-de-oficina-moderna' => '/images/cursos/gestao-oficina.jpg',
        'atendimento-e-fidelizacao-de-clientes' => '/images/cursos/atendimento.jpg',
        'orcamentacao-e-faturacao' => '/images/cursos/orcamentacao.jpg',
    ],
    'course_image_fallback' => '/images/cursos/cta-oficina.jpg',

    // Fotografia de cada área na secção "Cursos" da landing (slug da categoria → imagem).
    'area_images' => [
        'diagnostico-automovel' => '/images/cursos/scanner-osciloscopio.jpg',
        'eletronica-automovel' => '/images/cursos/eletronica-intro.jpg',
        'gestao-de-oficina' => '/images/cursos/gestao-oficina.jpg',
    ],

    /*
     | Perguntas frequentes da página /contactos, por público.
     | EXEMPLOS: a afinar quando o fluxo da plataforma (inscrições, pagamentos, certificados) estiver fechado.
     */
    'faqs' => [
        'empresa' => [
            ['Como inscrevo a minha equipa?', 'Envia-nos o pedido de contacto com o número de pessoas a formar. Criamos a conta da empresa e convidamos cada técnico por email — cada um entra com o seu acesso.'],
            ['Consigo acompanhar o progresso dos técnicos?', 'Sim. A área de gestor mostra as aulas concluídas, os certificados obtidos e as tarefas de cada pessoa e da equipa toda.'],
            ['Há preços para grupos?', 'Sim. O preço por pessoa baixa com o número de inscrições. Pede-nos uma proposta com o tamanho da equipa.'],
            ['Emitem fatura com o NIF da empresa?', 'Sim. Indica os dados de faturação da empresa no pedido e a fatura sai em nome da empresa.'],
            ['Podem criar formação à medida da nossa oficina?', 'Podemos adaptar trilhos de cursos às marcas e equipamentos com que trabalham. Fala connosco para avaliarmos.'],
            ['Os cursos são certificados?', 'Cada curso concluído gera um certificado com código de verificação, que a empresa pode consultar na área de gestor.'],
        ],
        'particular' => [
            ['Como compro um curso?', 'Escolhe o curso, cria conta e faz o pagamento online. O acesso fica disponível logo a seguir.'],
            ['Durante quanto tempo tenho acesso ao curso?', 'Tens acesso ao curso e às atualizações do conteúdo enquanto a tua conta estiver ativa.'],
            ['Recebo certificado no fim?', 'Sim. Ao concluir todas as aulas e quizzes recebes um certificado com código de verificação.'],
            ['Preciso de experiência para começar?', 'Não. Cada curso indica o nível (iniciante, intermédio ou avançado) para escolheres o ponto de partida certo.'],
            ['Posso aprender pelo telemóvel?', 'Sim. A plataforma funciona no telemóvel e no computador, e retomas sempre onde ficaste.'],
            ['O que é uma «Aula com IA»?', 'É uma aula dada por um avatar de IA, que explica a matéria e responde às tuas dúvidas a qualquer hora.'],
        ],
    ],

    // Vídeos carregados pelo formador (leitor próprio). Por agora ficam no volume do Railway (disco public);
    // no fim do projeto passam para o servidor da empresa (OVH).
    'video_max_mb' => (int) env('VIDEO_MAX_MB', 1024),

];
