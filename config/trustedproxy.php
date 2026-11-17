<?php

return [

    /*
     | Proxies à frente da app: terminam o HTTPS e dizem o IP real do visitante (X-Forwarded-*).
     | Lido pelo middleware TrustProxies do Laravel. Uma lista separada por vírgulas, ou '*'.
     | - Railway: '*' (o IP do proxy muda; o Laravel confia só em quem fala diretamente com a app).
     | - OVH com nginx na mesma máquina: TRUSTED_PROXIES=127.0.0.1
     */
    'proxies' => env('TRUSTED_PROXIES', '*'),

];
