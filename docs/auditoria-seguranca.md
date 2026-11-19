# Auditoria de segurança da T.Academy — V1

Data: 2026-11-16 · Estado do código: commit `a5570eb`, branch `main`.

A auditoria foi feita pelo agente `security-auditor`, só de leitura: sem alterar código, sem correr testes nem migrações e sem pedidos a serviços externos. Correu apenas o `composer audit` e o `npm audit --omit=dev`. Todos os problemas foram confirmados no código; os principais foram confirmados uma segunda vez antes de entrarem neste relatório. O que depende da configuração do servidor está na secção "A verificar no servidor de produção (OVH)".

Gravidades:
- **Alta:** dá para tomar uma conta ou tirar conteúdo pago sem pagar.
- **Média:** abuso, custos, batota nos certificados ou dados pessoais.
- **Baixa:** risco pequeno ou que exige outra falha antes.
- **Informativa:** não é uma falha, mas convém arrumar.

---

## Alta

**1. Os links de reposição da palavra-passe podem apontar para um site do atacante** (Autenticação)
- **Onde:** `bootstrap/app.php:28` (`trustProxies(at: '*')`). Não há `trustHosts()` nem domínio fixo nos links. Os links dos emails vêm de `url(route('password.reset', …))` (envio padrão do Laravel, `PeopleController:43`, `TeamService:180,415`).
- **O que está mal:** a aplicação aceita de qualquer origem os cabeçalhos que dizem qual é o domínio. Por isso, os links dos emails podem ser montados com um domínio escolhido por quem faz o pedido.
- **Cenário:** o atacante pede "esqueci-me" para o email da vítima, com o cabeçalho `X-Forwarded-Host: tacademy-login.com`. A vítima recebe um email verdadeiro da T.Academy, mas o link leva ao site do atacante, que fica com o token e entra na conta (incluindo a de um admin). Funciona se o servidor deixar passar esse cabeçalho.
- **Correção:**
  - em `trustProxies`, indicar só o proxy real e acrescentar `trustHosts(['tacademy.pt'])`;
  - em produção, fixar `URL::forceRootUrl(config('app.url'))` e `URL::forceScheme('https')`.

**2. Os vídeos e anexos dos cursos pagos abrem para quem tiver o link** (Ficheiros)
- **Onde:** `CourseBuilderController:201, 253-262, 315-325` (disco `public`, servido em `/storage/...`); `LessonAttachment::url()`; `StudentArea:309`.
- **O que está mal:** o servidor entrega os ficheiros sem verificar sessão, inscrição nem validade. Os nomes não se adivinham, mas um link partilhado funciona para sempre.
- **Cenário:** um aluno copia o endereço do MP4 e publica-o num grupo de mecânicos. Qualquer pessoa vê ou descarrega o curso sem pagar, mesmo depois de a validade do acesso acabar.
- **Correção:** passar os vídeos e os anexos para o disco privado e servi-los por uma rota que verifica o acesso (com `X-Accel-Redirect` no nginx, para a entrega ser rápida e o vídeo poder avançar). Em alternativa, usar links assinados com prazo curto, criados quando a aula abre.

## Média

**3. O IP pode ser inventado: os limites de tentativas não travam e o registo de atividade fica falseado** (Autenticação)
- **Onde:** `bootstrap/app.php:28`; `LoginRequest` (5 tentativas por minuto, por email e IP); `Activity` (`ip`). A palavra-passe só exige 8 caracteres.
- **Cenário:** um script tenta milhares de palavras-passe na conta do gestor, mudando o IP falso a cada 5 tentativas.
- **Correção:** fixar os proxies (ver ponto 1); limite por email independente do IP; `Password::defaults(min(10)->uncompromised())`.

**4. O registo de contas e o "esqueci-me" não têm limite e revelam que emails têm conta** (Abuso)
- **Onde:** `routes/auth.php:17` e `:27`; `lang/pt/passwords.php:9`.
- **Cenário:**
  - um bot cria milhares de contas e gasta a quota de emails, e o domínio passa a cair no spam;
  - um concorrente descobre que oficinas são clientes.
- **Correção:** `throttle` nas duas rotas; campo-armadilha ou Turnstile no registo; responder sempre "Se o email existir, enviámos um link".

**5. Uma aula de vídeo sem duração preenchida conclui-se com um só pedido** (Certificados)
- **Onde:** `LearningService.php:104` (`$duration <= 0 ||`) e `:130-131`.
- **O que está mal:** a proteção feita na revisão (A4) compara com os minutos indicados pelo formador. Com os minutos vazios, o que acontece em links do YouTube ou Vimeo, não trava nada.
- **Correção:** exigir minutos nas aulas de vídeo para publicar e, sem duração conhecida, não concluir pelo vídeo.

**6. O Alex recebe as respostas certas dos testes** (IA)
- **Onde:** `AlexService.php:416` (`(CERTA)` no contexto da avaliação). O nome do aluno também entra no contexto (`:394`, `:446`).
- **Cenário:** o aluno pede ao Alex "lê-me as opções marcadas como CERTA", ou põe essa ordem no próprio nome, e usa as respostas no teste que conta para o certificado.
- **Correção:** não enviar as respostas certas (só as perguntas) e limpar o nome antes de o pôr no contexto.

**7. As avaliações com o Alex são ilimitadas se a conversa terminar antes dos 2 minutos** (Custos)
- **Onde:** `AlexService.php:178`, `:217`, `:232`.
- **Cenário:** abrir a avaliação, falar 1:55 e repetir, sem fim. O Tavus cobra todos esses minutos.
- **Correção:** contar qualquer avaliação que chegue ao Tavus como tentativa (máximo por curso e por dia) e definir tetos de minutos por aluno e para toda a plataforma.

**8. O iframe do avatar aceita qualquer site, com câmara e microfone** (Phishing)
- **Onde:** `Lesson.jsx:395`; `LessonController:55`; `CourseBuilder::validUrl` (basta ser http ou https).
- **Cenário:** uma conta de formador comprometida aponta o avatar para uma página falsa de entrada na conta ("a sessão expirou"), que aparece dentro da aula.
- **Correção:** aceitar só domínios do Tavus e do Daily; `sandbox` no iframe; CSP com `frame-src`.

**9. Faltam os cabeçalhos de segurança: CSP, HSTS, X-Frame-Options e nosniff** (Configuração)
- **Cenário:** clickjacking. Um site mostra a Administração por baixo de um botão falso, e o clique do admin desativa uma conta ou muda uma permissão.
- **Correção:**
  - um middleware ou a configuração do nginx com `X-Frame-Options: DENY`, HSTS, `nosniff` e `Referrer-Policy`;
  - uma CSP básica que permita as fontes da Google e os iframes do YouTube, do Vimeo e do Tavus.

**10. As compras ficam "Pagas" sem pagamento nenhum** (Negócio)
- **Onde:** `PurchaseController.php:38`; `AlexController.php:62`.
- **Cenário:** um aluno "compra" todos os cursos e 20 créditos, e um gestor com pressa autoriza porque o pedido diz "Pago".
- **Correção:** até haver pagamento real, criar estes pedidos como "A aguardar pagamento" e só autorizar com uma referência do pagamento.

**11. Apagar a conta não apaga nada** (RGPD)
- **Onde:** `ProfileController.php:77` (apaga só de forma reversível); `Activity::forget` nunca corre; transcrições do Alex sem prazo.
- **O que está mal:** ficam guardados o nome, o email, as notas, as mensagens, o progresso, as transcrições e os IPs. O admin pode até reativar a conta, e a pessoa não volta a conseguir registar-se com o mesmo email.
- **Correção:**
  - separar "desativar" (gestão) de "apagar a minha conta" (anonimizar e apagar os dados pessoais);
  - pôr um prazo nas transcrições;
  - acordo de tratamento de dados (DPA) com o Tavus e uma página de privacidade.

## Baixa

12. **Sessões:** mudar ou repor a palavra-passe não termina as outras sessões (`PasswordController`, `NewPasswordController`). Correção: `Auth::logoutOtherDevices()`.
13. **Prazo dos links:** os links de "esqueci-me" duram 3 dias, o mesmo que os convites (`config/auth.php:99`). Correção: 60 minutos para o "esqueci-me", 72 horas só para os convites.
14. **Mudança de email:** quem tem "pessoas" muda o email de outra conta e ela continua confirmada (`PeopleController:76-80`). Correção: pedir nova confirmação e avisar o email antigo.
15. **Disco:** os envios de vídeo interrompidos podem encher o disco (`.part`, até 1 GB cada). Correção: quota por formador e limpeza automática só da pasta `video-uploads`.
16. **Spam:** o formulário de contactos pode ser usado para enviar spam aos gestores (só tem o campo-armadilha). Correção: Turnstile e um limite diário.
17. **Conversas grátis:** pedidos simultâneos podem dar conversas grátis a mais com o Alex (`AlexService:232`). Correção: bloquear a linha do utilizador antes de contar.
18. **Dependências PHP com avisos** (`composer audit`):
    - `symfony/http-foundation` (links com um domínio escolhido pelo cliente: agrava o ponto 1), `symfony/http-kernel`, `symfony/routing` e `symfony/mime`;
    - `league/commonmark`;
    - `laravel/framework` (gravidade baixa).

    O `npm audit` não encontrou nada. Correção: `composer update` e voltar a correr os testes.
19. **Google Fonts:** enviam à Google o IP de todos os visitantes (RGPD). Correção: alojar a letra no próprio servidor.

## Informativa

20. **Fechar a aula:** o último progresso enviado ao fechar a aula perde-se (erro 419), porque falta o meta `csrf-token` em `app.blade.php` (`VideoPlayer.jsx:75`). Confirmado no browser a 2026-11-16. Correção: usar `fetch` com `keepalive` e o `X-XSRF-TOKEN`, como o `alexStore.js`.
21. **Lista de rotas:** a lista de todas as rotas (Ziggy) é enviada a qualquer visitante. Correção: filtrar em `config/ziggy.php`.
22. **Webhook do Tavus:** está bem feito (HMAC-SHA256 com `hash_equals`). Não tem proteção contra repetição, mas o impacto é nulo.
23. **Logs:** emails e, às vezes, palavras-passe escritas no campo errado ficam nos logs e no registo de atividade. Correção: prazo e rotação dos logs.
24. **Atribuições:** o team leader pode reenviar o email de atribuição sem limite (só afeta a sua equipa).

## O que está bem (confirmado)
- **Correções da revisão de código:** confirmadas, exceto a falha do ponto 5.
- **Autorização:** não há falhas em nenhuma rota. Os endereços usam ULID, o team leader está limitado à sua empresa e o formador só vê os seus cursos.
- **Injeções:**
  - não há SQL com dados do utilizador;
  - não há HTML injetado com dados;
  - os emails escapam tudo;
  - os links das aulas só aceitam http ou https.
- **Uploads:** o tipo real do ficheiro é confirmado, as extensões estão numa lista fechada, os nomes são criados pelo servidor e as capas não aceitam SVG.
- **Sessões:**
  - a sessão é regenerada ao entrar;
  - desativar uma conta apaga as suas sessões;
  - há CSRF em tudo, exceto no webhook assinado;
  - os cookies são `HttpOnly` e `SameSite=lax`.
- **Segredos:** não há segredos no repositório nem no histórico do git.

## Contagem

| Gravidade | Número |
|---|---|
| Crítica | 0 |
| Alta | 2 |
| Média | 9 |
| Baixa | 8 |
| Informativa | 5 |

## A verificar no servidor de produção (OVH)
- `APP_ENV=production`, `APP_DEBUG=false`, `SEED_DEMO` desligado e uma `APP_KEY` nova.
- Não ficarem contas de demonstração com palavras-passe conhecidas.
- `SESSION_SECURE_COOKIE=true` (hoje vazio em `config/session.php:172`) e `SESSION_DRIVER=database`.
- **nginx:**
  - `server_name tacademy.pt` estrito, com um bloco por defeito que recusa outros domínios;
  - cabeçalhos `X-Forwarded-*` definidos pelo próprio nginx;
  - `autoindex off`;
  - sem PHP em `/storage` nem em `/cursos-demo`;
  - raiz do site em `public/`;
  - `client_max_body_size` de 2-3 MB.
- HTTPS com HSTS e os cabeçalhos do ponto 9.
- MariaDB fechada ao exterior, utilizador da base de dados com privilégios mínimos e backups cifrados.
- `cron` com `schedule:run`, rotação dos logs e alerta de disco.
- Resend com o domínio verificado (SPF, DKIM, DMARC) e sem `MAIL_ALWAYS_TO`.
- Tavus com `callback_url` em https e um limite de gasto na conta.
- `php artisan storage:link`.

## Estado das correções

**Grupo 1 — corrigido (2026-11-17): pontos 1, 3 e 18.**
- **Ponto 1:**
  - `App\Http\Middleware\TrustHosts` só aceita o domínio do `APP_URL` (e subdomínios); outros domínios recebem 400. O `/up` fica de fora, porque o Railway chama-o com um domínio seu.
  - Em produção, `URL::forceRootUrl(APP_URL)` e `https`, para os links dos emails usarem sempre o `APP_URL`.
- **Ponto 3:**
  - os proxies de confiança vêm de `config/trustedproxy.php` (`TRUSTED_PROXIES`, por defeito `*`, como no Railway);
  - novo limite de 20 tentativas de login falhadas por conta em 15 minutos, seja qual for o IP;
  - as palavras-passe novas precisam de 10 carateres e, em produção, não podem aparecer em fugas de dados conhecidas (Have I Been Pwned).
- **Ponto 18:** `composer update` do Laravel, do commonmark e do Symfony. O `composer audit` já não encontra nada.
- **Testes:** `tests/Feature/Auth/HostAndThrottleTest.php`. O total passou a 166 testes, todos a passar.

**Na mudança para a OVH, acrescentar ao `.env`:**
- `APP_URL=https://<domínio final>`;
- `TRUSTED_PROXIES=127.0.0.1` (nginx na mesma máquina).

**No Railway, já agora:** o `APP_URL` tem de ser exatamente o endereço por onde se entra. Se não for, a plataforma recusa os pedidos (400) e os links dos emails ficam errados.

**Grupo 2 — corrigido (2026-11-17): ponto 10.**
- **Como nascem as compras:** as compras pessoais de cursos pagos e as compras de créditos do Alex começam em "A aguardar pagamento". As de cursos gratuitos continuam em "Pago".
- **Referência obrigatória:** o gestor só autoriza escrevendo a referência do pagamento (MB Way, transferência, fatura…), que fica guardada no pedido (coluna `payment_ref`). Um pedido marcado "Pago" à mão também precisa da referência. Os pedidos antigos, sem preço guardado, contam como pagos.
- **Contadores:** os do gestor e do admin incluem as compras que aguardam pagamento.
- **Valor das compras de créditos:** passa a ficar guardado no pedido.
- **Testes:** atualizados (166, todos a passar).

**Grupo 3 — corrigido (2026-11-17): pontos 4, 6 e 7.**
- **Ponto 4:**
  - limites por IP: registo com 10 contas por hora, "esqueci-me" com 5 pedidos em 10 minutos. Quando se passa o limite, o formulário mostra um aviso em vez da página 429;
  - campo-armadilha `website` no registo;
  - o "esqueci-me" responde sempre "Se existir uma conta com este email…". O registo ainda diz "email já usado", como quase todos os sites.
- **Ponto 6:**
  - a avaliação final já não envia ao Tavus as opções nem a marca `(CERTA)`, só as perguntas, como temas. O Alex avalia pelo que sabe da matéria;
  - o nome do aluno entra limpo (`safeName`): só letras e sinais simples, numa linha, com 60 carateres no máximo.
- **Ponto 7:** cada avaliação que chega ao Tavus conta como tentativa, com um máximo de 3 por curso (ou por módulo com PAL próprio). O aluno é avisado antes de começar. O limite de gasto mensal fica na conta do Tavus (ver a lista do OVH).
- **Testes:** 170, todos a passar.

**Grupo 4 — corrigido (2026-11-17): ponto 2.**
- **Onde ficam os ficheiros:** os vídeos e anexos das aulas vão para a pasta privada (`storage/app/private/cursos/…`), entregue pelo servidor web. Os endereços não mudam (`/storage/cursos/videos/…`, `/storage/cursos/anexos/…`): quando o ficheiro não está na pasta pública, o pedido chega à app.
- **Quem os recebe:** o `Learn\MediaController` só entrega o ficheiro a quem pode abrir a aula (a mesma regra da página da aula). Quem não tem acesso recebe 404.
  - A entrega suporta avançar no vídeo (Range) e a cache é só do browser (`private`).
  - Um ficheiro acabado de carregar no editor só abre para quem o carregou.
- **Ficheiros antigos:** passam com `php artisan files:make-private` (lista) e `--force` (passa). O comando copia, confirma o tamanho e só depois tira o original. As capas continuam públicas.
- **No Railway, protegido de outra forma:** lá, o volume que sobrevive aos deploys é só `storage/app/public` e há apenas um volume por serviço, por isso a pasta privada perdia-se em cada deploy. Os ficheiros ficam na pasta pública (`COURSE_FILES_PRIVATE`; por defeito, desligado se houver `RAILWAY_ENVIRONMENT`). O `Caddyfile` na raiz do projeto (o servidor web do Railway) manda os pedidos a `/storage/cursos/videos/*` e `/storage/cursos/anexos/*` para a app, em vez de entregar o ficheiro diretamente. Assim passam pela mesma verificação de acesso.
- **Testes:** passam a usar sempre discos falsos (`TestCase::setUp`), para nenhum teste voltar a mexer nos ficheiros reais. Há testes novos em `tests/Feature/MediaTest.php`. O total passou a 176 testes, todos a passar.

**Grupo 5 — corrigido (2026-11-17): pontos 5 e 20.**
- **Ponto 5:** sem os minutos do formador, o vídeo deixa de concluir a aula. Antes, bastava um pedido a dizer "o vídeo tem 1 segundo".
  - Os minutos passam a ser obrigatórios em todas as aulas de vídeo para publicar (no editor e no servidor).
  - Um curso já publicado sem minutos continua a gravar o resto, como antes.
  - O aluno vê o aviso "Esta aula fica concluída quando o formador indicar a duração do vídeo".
  - Os vídeos carregados preenchem os minutos sozinhos.
- **Ponto 20:** ao fechar a aula ou o separador, o leitor envia o progresso com `fetch` `keepalive` e o cabeçalho `X-XSRF-TOKEN`, como o `alexStore.js`. A forma antiga (`sendBeacon` com `_token` vazio) dava 419; confirmado no browser.
- **Testes:** 178, todos a passar.

**Grupo 6 — corrigido (2026-11-17): pontos 9 e 8.**
- **Ponto 9:** `App\Http\Middleware\SecurityHeaders` em todas as respostas da app.
  - Sempre: `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy` e, em HTTPS, HSTS (1 ano, sem subdomínios enquanto o domínio não está fixo).
  - Uma CSP sempre aplicada: `frame-ancestors 'self'` (clickjacking), `object-src 'none'`, `base-uri 'self'` e `frame-src` só para a plataforma, YouTube, Vimeo e o avatar.
  - A CSP completa (scripts com nonce e `strict-dynamic`, ligações, imagens) começa em modo "só reportar". Os avisos ficam no registo como `CSP` (rota `/csp-report`).
  - Depois de uns dias sem avisos, incluindo uma conversa com o Alex, passa-se a aplicar com `CSP_ENFORCE=true`.
  - Nas páginas ficam fora o PDF e o vídeo, para o leitor de PDF do browser continuar a funcionar.
  - Os ficheiros que o Caddy entrega diretamente (capas) não levam estes cabeçalhos.
- **Ponto 8:** o link das aulas de avatar só é aceite em https e nos sites do Tavus, do Daily e da plataforma de avatares da T.Academy (`AVATAR_HOSTS`, por defeito `daily.co,tavus.io,avatar.tacademy.pt`, com os subdomínios).
  - Isto vale no editor, para publicar, e na aula: outro link não abre.
  - O iframe tem `sandbox` (não navega a página da plataforma nem abre janelas) e `referrerpolicy="no-referrer"`.
- **Verificado no browser local:** o vídeo próprio e o do YouTube carregam sem avisos da CSP, e os relatórios chegam ao registo.
- **Testes:** 183, todos a passar.

**Grupo 7 — corrigido (2026-11-18): pontos 11 e 19.**
- **Ponto 11 (decidido com a dona do projeto):**
  - "Desativar" (gestão, reversível) fica separado de "Apagar a minha conta" (`App\Support\AccountEraser`).
  - Apagar a conta remove o progresso, os testes, as notas, as mensagens com o formador, as conversas com o Alex, as inscrições, os certificados, as avaliações, as notificações e as sessões.
  - A conta fica sem nome, email, telefone nem palavra-passe utilizável (`erased_at`), e o email verdadeiro fica livre para uma conta nova.
  - Os pedidos de compra ficam para a faturação. Os outros pedidos perdem os dados de contacto.
  - O registo de atividade fica sem nome nem IP.
  - Uma conta apagada não se pode reativar.
  - Só alunos apagam a própria conta. Os outros perfis pedem à administração.
  - Antes de confirmar, o aluno é avisado para descarregar os certificados.
  - As transcrições do Alex apagam-se ao fim de 90 dias (`ALEX_TRANSCRIPT_DAYS`). Corre na limpeza diária, com o registo de atividade.
  - **Fica para a dona do projeto:** o acordo de tratamento de dados (DPA) com o Tavus e a página de privacidade.
- **Ponto 19:** a letra da plataforma vem da própria plataforma (`@fontsource-variable/manrope`, desde 2026-11-19; antes a Archivo) e já não da Google. A CSP deixou de permitir as fontes da Google.
- **Testes:** 187, todos a passar.

**Grupo 8 — corrigido (2026-11-18): pontos 12 a 17, 21, 23 e 24.**
- **12. Sessões:** mudar a palavra-passe termina as outras sessões; repor a palavra-passe termina todas. Também invalida o "manter a sessão iniciada" (`InviteLink::endOtherSessions`).
- **13. Prazo dos links:** o "esqueci-me" dura 60 minutos. Os convites duram 3 dias, numa tabela à parte (`invite_tokens`, broker `invites`, links com `?convite=1`), por isso um link de "esqueci-me" nunca vale 3 dias.
- **14. Mudança de email pela gestão:** o email novo tem de ser confirmado pela pessoa, e o antigo recebe um aviso com o novo endereço.
- **15. Disco:** cada pessoa pode ter no máximo 3 envios de vídeo ou anexo a decorrer.
  - Ao começar um envio, saem os pedaços interrompidos da própria pessoa com mais de 24 h. São só ficheiros temporários, nunca de um curso.
  - O `files:clean` continua para o resto.
- **16. Spam:** o formulário de contactos tem limites de 5 por minuto, 20 por dia por ligação e 5 por dia por email.
  - O Turnstile fica para quando houver conta na Cloudflare.
- **17. Conversas grátis:** a contagem das conversas do dia (e das tentativas da avaliação) e a criação da conversa correm com a linha da pessoa bloqueada.
- **21. Lista de rotas:** só vão para as páginas as 12 rotas que o React usa (`config/ziggy.php`). Ao usar `route('nome')` num `.jsx` novo, juntar o nome lá.
- **23. Logs:**
  - ficheiro por dia, guardado 14 dias (`LOG_STACK=daily`, `LOG_DAILY_DAYS`);
  - no registo de atividade, as entradas falhadas só guardam o que é mesmo um email.
- **24. Atribuições:** voltar a atribuir o mesmo curso muda o prazo, mas o email só sai uma vez por dia a cada pessoa.
- **22:** não precisou de correção.
- **Testes:** 194, todos a passar (`tests/Feature/LowFindingsTest.php`).

**Na mudança para a OVH (escolher um dos dois caminhos):**
- **Com Docker/FrankenPHP, como no Railway:** levar o mesmo `Caddyfile` e definir `COURSE_FILES_PRIVATE=false`. Os ficheiros ficam onde estão e não é preciso correr nada.
- **Com nginx ou Apache:**
  - o disco de ficheiros tem de incluir `storage/app/private`, além de `storage/app/public`;
  - depois de copiar os ficheiros do Railway, correr uma vez `php artisan files:make-private` (ver a lista) e depois com `--force`;
  - (opcional, mais rápido) usar `X-Accel-Redirect` no nginx para a entrega dos vídeos.
- **Em qualquer dos casos:** confirmar que um vídeo sem sessão iniciada vai para a entrada e não abre.

## Ordem recomendada para as correções
1. **Antes da mudança para a OVH:** pontos 1, 3 e 18 (proxies e domínio fixos, atualização das dependências). São pequenos e fecham a tomada de contas.
2. **Pagamentos simulados:** ponto 10.
3. **Abuso e custos:** pontos 4, 7 e 6.
4. **Conteúdo pago:** ponto 2.
5. **Certificados:** ponto 5 (com o 20, que também mexe no progresso do vídeo).
6. **Cabeçalhos e avatar:** pontos 9 e 8.
7. **RGPD:** pontos 11 e 19.
8. **Restantes pontos Baixa e Informativa.**
