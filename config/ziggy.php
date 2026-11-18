<?php

// Rotas com nome enviadas a cada página (para route() no React). Só as que o React usa: antes ia a lista de todas
// as rotas, incluindo as da administração, a qualquer visitante (auditoria, ponto 21).
// Ao usar route('nome') num ficheiro .jsx, juntar aqui o nome.
return [
    'only' => [
        'login', 'logout', 'register',
        'password.request', 'password.email', 'password.store', 'password.update',
        'verification.send',
        'profile.update', 'profile.destroy',
        'contacts', 'contacts.store',
    ],
];
