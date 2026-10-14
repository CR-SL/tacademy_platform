<?php

return [

    /*
     | Contactos mostrados na landing page (secção Contactos).
     | Definir no .env; os que ficarem vazios não aparecem.
     */
    'contact' => [
        'email' => env('TACADEMY_CONTACT_EMAIL'),
        'phone' => env('TACADEMY_CONTACT_PHONE'),
        'address' => env('TACADEMY_CONTACT_ADDRESS'),
    ],

];
