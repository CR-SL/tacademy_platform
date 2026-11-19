# Mudança do Railway para o servidor OVH

Lista do que é preciso fazer para passar a plataforma T.Academy do Railway para um servidor OVH, com o domínio final (provavelmente `tacademy.pt`).
Está pela ordem em que se faz. Onde aparece `<domínio>`, usar o domínio final, por exemplo `tacademy.pt`.

Os detalhes técnicos de cada ponto de segurança estão em [auditoria-seguranca.md](auditoria-seguranca.md).

---

## 1. Decidir antes de começar

- [ ] **Domínio final.** Confirmar qual é (por exemplo `tacademy.pt` ou `plataforma.tacademy.pt`). Tudo o resto depende dele.
- [ ] **Como montar o servidor.** Escolher um de dois caminhos e seguir sempre esse nas secções abaixo:
  - **Caminho A — Docker com FrankenPHP (igual ao Railway).** A imagem é a mesma do Railway e o `Caddyfile` do projeto já protege os vídeos. É o que dá menos surpresas. Precisa de um proxy à frente para o HTTPS (Caddy ou nginx).
  - **Caminho B — nginx + PHP-FPM.** É a montagem clássica num VPS. Os vídeos e os anexos passam para a pasta privada com um comando, uma vez.
- [ ] **Dia e hora da mudança.** Escolher uma hora com pouco uso. Avisar os alunos e formadores de que a plataforma fica parada uns minutos.
- [ ] **Na véspera:** baixar o TTL do DNS do domínio para 5 minutos, para a troca chegar depressa a toda a gente.

## 2. Preparar o servidor OVH

- [ ] PHP 8.2 ou mais recente (só no caminho B; no A vem na imagem), com as extensões `pdo_mysql`, `mbstring`, `intl`, `gd`, `zip`, `bcmath`, `fileinfo`, `curl` e `openssl`.
- [ ] MariaDB ou MySQL.
  - Só aceita ligações da própria máquina: a porta 3306 fica fechada ao exterior.
  - Base de dados `tacademy` com um utilizador próprio, que só tem acesso a essa base.
- [ ] Composer e Node (para compilar o site), ou compilar noutra máquina e copiar `public/build`.
- [ ] Firewall: só as portas 22 (SSH), 80 e 443 abertas.
- [ ] HTTPS com Let's Encrypt (certbot, ou o Caddy no caminho A), renovado automaticamente.
- [ ] Cópias de segurança automáticas, cifradas e guardadas fora do servidor:
  - da base de dados, todos os dias;
  - das pastas `storage/app/public` e `storage/app/private`.
- [ ] Alerta de disco cheio. Os vídeos ocupam muito: cada um pode ter até 1 GB.

### Só no caminho B (nginx)

- [ ] A raiz do site é a pasta `public/` do projeto.
- [ ] `server_name <domínio>` exato, e um bloco por defeito que recusa qualquer outro domínio (`return 444`).
- [ ] O nginx define os cabeçalhos `X-Forwarded-For`, `X-Forwarded-Proto` e `X-Forwarded-Host`, em vez de os deixar passar de fora.
- [ ] `autoindex off`.
- [ ] Nada de PHP dentro de `/storage` nem de `/cursos-demo`.
- [ ] `client_max_body_size 3M`. Os vídeos sobem em pedaços de 1,5 MB, por isso não é preciso mais.

## 3. Instalar a plataforma

- [ ] Copiar o código do GitHub (`CR-SL/tacademy_platform`, ramo `main`).
- [ ] Instalar e compilar:
  ```bash
  composer install --no-dev --optimize-autoloader
  ```
  ```bash
  npm ci
  ```
  ```bash
  npm run build
  ```
- [ ] Criar o ficheiro `.env` (ver a secção 4).
- [ ] Dar à pasta `storage` e à pasta `bootstrap/cache` permissão de escrita para o utilizador do PHP.
- [ ] Ligar a pasta pública dos ficheiros:
  ```bash
  php artisan storage:link
  ```

## 4. O ficheiro `.env` do servidor

Começar pelo `.env` do Railway (valores em Railway › serviço › Variables) e mudar o seguinte.

**Obrigatório mudar ou confirmar:**

| Variável | Valor no OVH | Porquê |
|---|---|---|
| `APP_ENV` | `production` | |
| `APP_DEBUG` | `false` | Nunca mostrar erros técnicos aos visitantes |
| `APP_URL` | `https://<domínio>` | Tem de ser **exatamente** o endereço por onde se entra. Com outro domínio, a plataforma responde 400. Os links dos emails e o aviso do Tavus usam este valor |
| `APP_KEY` | uma nova (`php artisan key:generate`) | Toda a gente tem de voltar a entrar uma vez. Não se perde mais nada |
| `TRUSTED_PROXIES` | `127.0.0.1` | O endereço do nginx ou do proxy na mesma máquina. No Railway era `*` |
| `SESSION_DRIVER` | `database` | |
| `SESSION_SECURE_COOKIE` | `true` | O cookie da sessão só viaja em HTTPS |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | os da base de dados do OVH | |
| `MAIL_FROM_ADDRESS` | um endereço do domínio (ex.: `plataforma@<domínio>`) | Tem de ser do domínio verificado no Resend |
| `LOG_STACK` | `daily` | Um ficheiro de registo por dia, guardado 14 dias |

**Tirar (apagar a linha):**

- [ ] `MAIL_ALWAYS_TO`: enquanto existir, todos os emails vão para esse endereço e não para as pessoas.
- [ ] `SEED_DEMO` e `SEED_DEMO_PASSWORD`: não pode haver dados nem contas de demonstração em produção.
- [ ] `RAILWAY_ENVIRONMENT`, se tiver vindo na cópia.

**Ficheiros dos cursos (depende do caminho):**

| Variável | Caminho A (Docker) | Caminho B (nginx) |
|---|---|---|
| `COURSE_FILES_PRIVATE` | `false` (o `Caddyfile` faz a proteção) | não pôr: fica ligado sozinho |

**Copiar do Railway sem mudar:**

- `RESEND_API_KEY`;
- `TAVUS_API_KEY`, `TAVUS_PAL_ID`, `TAVUS_FACE_ID` e os `TAVUS_*` que existam;
- `TACADEMY_CONTACT_*` e `TACADEMY_RESPONSE_TIME`;
- `AVATAR_HOSTS`, se tiver sido mudado. Por defeito aceita `daily.co`, `tavus.io` e `avatar.tacademy.pt`.

**Para mais tarde (não pôr já):** `CSP_ENFORCE=true`. Ver a secção 9.

## 5. Copiar os dados do Railway

Fazer isto já com a plataforma do Railway parada, ou em modo de manutenção, para ninguém escrever nada a meio da cópia.

- [ ] Pôr o Railway em manutenção:
  ```bash
  php artisan down
  ```
- [ ] Exportar a base de dados do Railway (por exemplo com `mysqldump`) e importá-la na MariaDB do OVH.
- [ ] Copiar os ficheiros carregados, que no Railway estão no volume `tacademy-uploads` (`/app/storage/app/public`): capas, vídeos e anexos. Por exemplo, com `railway ssh` e um `tar` dessa pasta.
- [ ] Pôr esses ficheiros na mesma pasta do OVH: `storage/app/public`.
- [ ] Correr as alterações da base de dados que faltem:
  ```bash
  php artisan migrate --force
  ```
- [ ] **Só no caminho B:** passar os vídeos e os anexos para a pasta privada. Primeiro, ver a lista:
  ```bash
  php artisan files:make-private
  ```
  Depois, passar mesmo. O comando copia, confirma que a cópia ficou inteira, e só então tira o original:
  ```bash
  php artisan files:make-private --force
  ```
- [ ] **Contas de demonstração:** se o Railway tiver sido criado com dados de demonstração, desativar ou apagar essas contas em Administração › Pessoas. As palavras-passe delas são conhecidas.
- [ ] Guardar as configurações em cache:
  ```bash
  php artisan optimize
  ```

## 6. Tarefas automáticas

- [ ] Uma linha no `cron` do utilizador do PHP, que corre as limpezas diárias (registo de atividade com mais de 12 meses, transcrições do Alex com mais de 90 dias):
  ```
  * * * * * cd /caminho/para/tacademy_platform && php artisan schedule:run >> /dev/null 2>&1
  ```
- [ ] A limpeza dos ficheiros sem uso **não** é automática, de propósito, porque apaga ficheiros. Corre-se à mão de vez em quando: primeiro sem `--force`, para ver a lista.
  ```bash
  php artisan files:clean
  ```

## 7. Serviços externos

- [ ] **DNS:** apontar o domínio (registo `A`, e `AAAA` se houver IPv6) para o IP do servidor OVH.
- [ ] **Resend (emails):**
  - verificar o domínio no Resend e pôr no DNS os registos SPF, DKIM e DMARC que ele indica;
  - sem isto, os emails vão para o spam ou não chegam.
- [ ] **Tavus (Alex):**
  - o endereço dos avisos (`https://<domínio>/webhooks/tavus`) é enviado sozinho em cada conversa, a partir do `APP_URL`, por isso não há nada a configurar;
  - pôr um limite de gasto mensal na conta do Tavus;
  - pedir e assinar o acordo de tratamento de dados (DPA) com o Tavus, por causa do RGPD.
- [ ] **Plataforma de avatares** (`avatar.tacademy.pt`): os links das aulas de avatar só abrem se forem desse site, do Tavus ou do Daily.

## 8. Verificar depois de ligar

Abrir `https://<domínio>` e confirmar:

- [ ] `https://<domínio>/up` responde.
- [ ] A página de entrada abre e dá para entrar com uma conta real.
- [ ] Com outro endereço (por exemplo o IP do servidor), a plataforma **não** abre (400 ou ligação recusada).
- [ ] **Emails:** pedir "Esqueci-me da palavra-passe". O email chega, não vai para o spam, e o link aponta para `https://<domínio>`. Este link dura 60 minutos.
- [ ] **Vídeos:**
  - um vídeo de uma aula aberto sem sessão iniciada manda para a entrada;
  - com um aluno inscrito, o vídeo arranca e deixa avançar para o meio.
- [ ] **Anexos:** um PDF de uma aula abre dentro da aula.
- [ ] **Editor:** carregar um vídeo pequeno no editor de cursos e confirmar que fica na aula.
- [ ] **Alex:** fazer uma conversa curta e confirmar no Administração › Registo que a conversa terminou (o aviso do Tavus chegou).
- [ ] **Certificados:** com um aluno que já concluiu um curso, a página Certificados mostra o certificado e o PDF descarrega.
- [ ] **Cabeçalhos de segurança:**
  ```bash
  curl -sI https://<domínio>/login
  ```
  Têm de aparecer `strict-transport-security`, `x-frame-options`, `x-content-type-options`, `content-security-policy` e `content-security-policy-report-only`.
- [ ] Os registos (`storage/logs/`) não mostram erros novos.

## 9. Depois da mudança

- [ ] **Deixar o Railway parado uns dias**, sem o apagar, para poder voltar atrás.
  - Os emails enviados antes da mudança (convites, "esqueci-me") têm links para o endereço do Railway. Quem não os usou pede outro na nova plataforma.
- [ ] **Política de conteúdo (CSP):**
  - nos primeiros dias, procurar avisos `CSP` nos registos (`storage/logs/`), depois de usar a plataforma normalmente, incluindo uma conversa com o Alex e um vídeo do YouTube;
  - se não houver avisos, pôr `CSP_ENFORCE=true` no `.env` e correr `php artisan optimize`;
  - se houver, enviar os avisos a quem mantém o código antes de a ligar.
- [ ] **HSTS:** quando o domínio estiver definitivo, pode passar a incluir os subdomínios (`includeSubDomains`), em `app/Http/Middleware/SecurityHeaders.php`.
- [ ] **Página de privacidade:** publicar a página de privacidade do site (RGPD).
- [ ] Depois de tudo confirmado, apagar o serviço do Railway e o volume `tacademy-uploads`.

## Se correr mal

- Voltar a apontar o DNS para o Railway e tirar o Railway de manutenção:
  ```bash
  php artisan up
  ```
- O que tiver sido escrito no OVH entretanto (contas novas, progresso) não volta sozinho para o Railway. Por isso convém decidir depressa e manter a janela de mudança curta.
