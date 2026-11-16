# Revisão de código da T.Academy — V1

Data: 2026-11-15 · Estado do código: commit `4895314` ("Admin Log's parte 2"), branch `main`.

Fizeram a revisão dois revisores, um para o **servidor** (`app/`, `routes/`, `config/`, `database/`, `lang/`) e outro para a **interface** (`resources/js`, `resources/css`, `resources/views`). Todos os problemas desta lista foram confirmados a ler o código, e os principais foram confirmados uma segunda vez. Não se alterou código nenhum.

Os problemas de segurança vêm marcados com **[Segurança]**. A auditoria de segurança completa fica para depois das correções.

**Estado dos testes:** `php artisan test` → **129 testes passaram** (3423 verificações), 0 falharam, em cerca de 50 s.

**Corrigidos (2026-11-15, ainda sem commit):** A1, A2 e A3, com 5 testes novos (CourseBuilderTest e TeamsAndRequestsTest). Depois das correções: **134 testes passaram** (3463 verificações). O A2 traz uma migração nova (`2026_11_15_000002_add_personal_to_enrollments`).

**Corrigidos (grupo 2, deploy e contas, ainda sem commit):** A10, A12 e A14, com 7 testes novos. Depois: **140 testes passaram**.
- A12: o `db:seed` do deploy cria sempre os perfis e as áreas (`CategorySeeder`). Os dados de demonstração só se criam em local ou com `SEED_DEMO=true`, e fora de local exigem `SEED_DEMO_PASSWORD`. Os dados de demonstração que já estão em produção não foram apagados.
- A14: `User` implementa `MustVerifyEmail`. Definir a palavra-passe pelo link do convite confirma o email. A migração `2026_11_15_000003` dá como confirmadas as contas que já existem.
- A10: o middleware `TouchLastActive` atualiza `last_active_at`, no máximo uma vez a cada 5 minutos.

**Corrigidos (grupo 3, progresso e certificado, ainda sem commit):** A4, A5, A6, A7, A8, A15 e A16, com 6 testes novos. Depois: **146 testes passaram**. Inclui a migração `2026_11_15_000004_add_video_pinged_at_to_lesson_progress`.
- A4: os segundos novos aceites em cada envio não passam do tempo real que passou, à velocidade máxima de 2×, e a duração enviada pelo browser só conta se for pelo menos metade da indicada pelo formador.
- A5 e A15: o progresso, as tentativas e o certificado de cada pessoa gravam-se um pedido de cada vez (bloqueio da linha da pessoa).
- A6: um acesso expirado pode ser comprado outra vez e a validade conta a partir de hoje; no catálogo o curso volta a aparecer com "Comprar".
- A7 (decisão): em rascunho, os inscritos continuam a ter acesso; um curso com inscritos não se pode apagar.
- A8 (decisão): gravar um curso publicado incompleto é recusado. Os ficheiros retirados só se apagam do disco depois de a gravação ser aceite.
- A16: a inscrição passa a concluída quando sai o certificado.

**Corrigidos (grupo 4, aula e Alex, ainda sem commit):** B1, B2, B8, B10, B11 e B12. Os testes continuam a passar (146) e a interface compila. Não foi experimentado no browser.
- B9 (decisão): a Avaliação fica como está, como demonstração do que vem aí.
- B1: se o teste do microfone fechar enquanto o browser pede autorização, o microfone desliga-se assim que a autorização chega.
- B2: "Terminar" enquanto a conversa com o Alex se prepara cancela-a e fecha a sala no servidor.
- B8: o leitor de vídeo deixa de acumular envios de posições antigas ao fechar a página.
- B10: depois dos 90%, há um botão "Perguntas rápidas" no painel do material para as reabrir.
- B11: sem a resposta certa (aula de amostra), mostra só "A tua escolha", sem certo nem errado.
- B12: mensagem com "Tentar outra vez" quando o vídeo próprio não carrega, e aviso quando a resposta rápida não é guardada.

**Pendente para a mudança para o OVH (domínio tacademy.pt):**
1. Verificar o domínio (ou um subdomínio, como `envio.tacademy.pt`) no serviço de email e mudar `MAIL_FROM_ADDRESS`.
2. Retirar `MAIL_ALWAYS_TO`.
3. Tornar seguros os emails de confirmação de conta e de reposição da palavra-passe, que usam o envio padrão do Laravel: se o envio falhar, deve ficar só registado no log, como nos outros emails da plataforma. Hoje uma falha nesses dois mostra um erro a quem está a usar a plataforma. Não acontece enquanto `MAIL_ALWAYS_TO` estiver definido.

Regra decidida para o A2: quem sai da equipa (ou perde um curso da equipa) nunca tem a conta apagada. Mantém os cursos que comprou e os que já concluiu ou de que tem certificado, com o certificado. Perde só o acesso aos cursos da equipa por concluir; o progresso fica guardado.

Gravidades:
- **Crítico:** perde dados ou quebra uma regra central do produto.
- **Importante:** erro real que se vê, lentidão séria ou falha de segurança.
- **Menor:** erro com pouco impacto ou que só acontece em casos raros.
- **Sugestão:** limpeza ou dívida de design.

---

## Parte A — Servidor

### Crítico

**A1. Guardar o curso no editor estraga as notas dos testes e as respostas às perguntas rápidas**
- **Onde:** `app/Services/CourseBuilder.php:316-349` (`syncChecks`, `syncQuiz`)
- **O que está mal:** cada gravação automática apaga e volta a criar as perguntas dos testes, as opções e as perguntas rápidas, que ficam com números (ids) novos. As tentativas (`quiz_attempts.answers`) e as respostas rápidas (`check_answers`) continuam a apontar para os números antigos. E se uma aula deixa de ser teste, `quiz()->delete()` apaga também todas as tentativas, por causa da cascata na base de dados.
- **Quando falha:** o formador corrige uma vírgula num curso publicado. Daí em diante:
  - nas Avaliações, todos os alunos aparecem com 0 acertos;
  - as perguntas rápidas voltam a aparecer por responder, e o aluno pode respondê-las outra vez.

  Se o formador mudar uma aula de teste para texto, as notas desaparecem e a média do certificado muda.
- **Correção:** atualizar perguntas e opções pelo id, como já se faz com as aulas, apagar só as que foram retiradas e nunca apagar um teste que já tem tentativas.

**A2. Quem sai de uma equipa perde o curso que comprou a título pessoal**
- **Onde:** `app/Services/TeamService.php:144-150` (`enroll`) e `:100-102`; `app/Http/Controllers/Staff/TeamController.php:108-109`
- **O que está mal:** `enroll()` grava o `company_id` da equipa por cima de uma inscrição pessoal que já existia. Ao sair da equipa, ou quando o curso é retirado da equipa, apagam-se todas as inscrições com esse `company_id`, incluindo as que foram pagas.
- **Quando falha:**
  1. A Ana compra "OBD-II".
  2. Mais tarde, a empresa dela inclui o mesmo curso na equipa.
  3. A Ana sai da empresa e perde o curso que pagou.
- **Correção:** guardar a origem da inscrição. Ao sair da equipa, se a inscrição era pessoal, só se limpa o `company_id`.

**A3. "Atualizar equipa" grava metade das alterações quando dá erro**
- **Onde:** `app/Http/Controllers/Staff/TeamController.php:105-116`
- **O que está mal:** a função faz por esta ordem, sem transação:
  1. grava os packs;
  2. sincroniza os cursos;
  3. apaga as inscrições;
  4. só então valida os membros (`syncMembers`), que pode recusar.
- **Quando falha:** o gestor passa de 2 para 1 pack, retira um curso e deixa 15 pessoas. Aparece o erro "A equipa tem 10 lugares", mas os packs já ficaram em 1, o curso já saiu e as inscrições já foram apagadas.
- **Correção:** validar os membros primeiro e pôr tudo dentro de `DB::transaction`.

### Importante

**A4. [Segurança] A conclusão do vídeo confia no que o browser envia**
- **Onde:** `app/Services/LearningService.php:91-108` (`recordProgress`)
- **O que está mal:** o servidor aceita, tal como o browser os envia, o mapa dos segundos vistos e a duração do vídeo. A duração enviada pelo browser tem prioridade para calcular os 90%.
- **Quando falha:** o aluno envia `duration=1` e um mapa com 1 segundo, e a aula fica concluída. Repetindo isto em todas as aulas, recebe o certificado sem ver nada.
- **Correção:** não aceitar uma duração menor do que a do formador ou a já guardada, e limitar os segundos novos ao tempo real que passou desde o pedido anterior.

**A5. Pedidos ao mesmo tempo dão mais de 3 tentativas e certificados repetidos**
- **Onde:** `app/Services/LearningService.php:158-185` (`submitQuiz`) e `:213-233` (`afterProgress`); a tabela `certificates` não tem `unique(user_id, course_id)`.
- **O que está mal:** as tentativas e a pergunta "já tem certificado?" são contadas antes de gravar, sem bloqueio.
- **Quando falha:**
  - um duplo clique em "Entregar", com 2 tentativas já usadas, cria a 3.ª e a 4.ª;
  - dois pedidos de progresso que chegam ao mesmo tempo emitem dois certificados para o mesmo curso.
- **Correção:** usar `lockForUpdate` dentro de uma transação e acrescentar um índice único `(user_id, course_id)` em `certificates`.

**A6. Um acesso expirado nunca se renova**
- **Onde:** `app/Http/Controllers/PurchaseController.php:33`; `app/Services/TeamService.php:144-147`
- **O que está mal:** a compra é recusada se existir qualquer inscrição, mesmo expirada. E `enroll()` não atualiza a data de inscrição (`enrolled_at`) de uma inscrição antiga.
- **Quando falha:**
  - um aluno com o curso expirado não o consegue voltar a comprar;
  - alguém que já teve o curso há mais de um ano entra numa equipa nova com o curso logo expirado.
- **Correção:** tratar a inscrição expirada como renovável e atualizar `enrolled_at` quando se volta a dar acesso.

**A7. Passar um curso a rascunho tira o acesso a quem está inscrito**
- **Onde:** `app/Http/Controllers/Learn/LessonController.php:34`; `app/Http/Controllers/Learn/CourseController.php:26`
- **O que está mal:** a aula dá erro 404 sempre que o curso não está publicado, mesmo a inscritos dentro da validade.
- **Quando falha:** o formador passa o curso a rascunho para o corrigir. Todos os alunos ficam com 404 a meio do curso, mas o curso continua em "Os meus cursos".
- **Correção:** deixar entrar quem está inscrito, ou não deixar passar a rascunho (nem apagar) um curso com inscrições.

**A8. Um curso publicado pode ficar incompleto**
- **Onde:** `app/Services/CourseBuilder.php:108-216`; `app/Http/Controllers/Instructor/CourseBuilderController.php:86-92`
- **O que está mal:** as regras de publicação (`publishProblems`) só se verificam no momento de publicar.
- **Quando falha:** depois de publicar, o formador apaga todas as aulas ou deixa o título vazio, e o curso continua à venda.
- **Correção:** num curso publicado, recusar a gravação (ou passá-lo a rascunho) quando houver problemas.

**A9. [Segurança] Um formador pode apagar ficheiros de cursos de outros**
- **Onde:** `app/Services/CourseBuilder.php:296-310`
- **O que está mal:** o caminho de um anexo só tem de começar por `cursos/anexos/`. Não se verifica a quem pertence o ficheiro nem se o caminho tem `..`. Ao retirar o anexo, o ficheiro é apagado do disco.
- **Quando falha:** o formador A indica como anexo o PDF de outro curso, ou `cursos/anexos/../videos/x.mp4`, e depois retira-o. O ficheiro do formador B desaparece.
- **Correção:** aceitar só caminhos de uploads feitos pela própria pessoa, recusar `..` e não apagar ficheiros que outra aula ainda usa.

**A10. "Última atividade" (`last_active_at`) nunca é atualizada**
- **Onde:** é lida em `TeamService.php:217` e `:344`, `AdminStats.php:160`, `WorkArea.php:166` e `AdminController.php:154`, mas não é escrita em nenhum sítio de `app/`.
- **O que está mal:** tudo o que depende de saber se a pessoa já entrou na plataforma está errado.
- **Quando falha:** um membro já entrou, mas ainda não concluiu nenhuma aula:
  - o team leader vê-o como "Ainda não entrou";
  - os lembretes mandam-lhe "Definir palavra-passe" em vez do link do curso;
  - a Administração conta-o como "nunca entrou".
- **Correção:** atualizar `last_active_at` quando a pessoa entra (evento `Login`) ou num middleware, no máximo uma vez a cada alguns minutos.

**A11. Incluir numa equipa o email de uma conta desativada dá erro 500, mas os convites já foram enviados**
- **Onde:** `app/Services/TeamService.php:90`, `:113-121`, `:136`
- **O que está mal:**
  - a procura por email não vê as contas desativadas, por isso o código tenta criar uma conta repetida e a base de dados recusa-a;
  - os emails de convite são enviados antes de a transação terminar.
- **Quando falha:** a 7.ª pessoa da lista tem a conta desativada. Dá erro 500, a equipa não é criada, mas as primeiras 6 pessoas já receberam convite.
- **Correção:** procurar também as contas desativadas (`withTrashed()`) e reativá-las, e enviar os emails só depois de a transação terminar (`DB::afterCommit`).

**A12. [Segurança] Os dados de demonstração entram em produção em cada deploy**
- **Onde:** `railway.json:7` (`php artisan db:seed --force`); `database/seeders/DemoContentSeeder.php`
- **O que está mal:** cada deploy corre os seeders, que criam:
  - equipas, pedidos e progresso fictícios (o que quebra a regra "só dados reais");
  - contas de demonstração, incluindo `admin@tacademy.pt`, com a palavra-passe `password` se `SEED_DEMO_PASSWORD` não estiver definida.

  Além disso, o `DemoContentSeeder` volta a criar aulas que o formador apagou ou renomeou, e pode fazer falhar o deploy se uma conta ou curso de demonstração tiver sido desativado.
- **Correção:** tirar o `db:seed` do deploy (correr em produção só o `RoleSeeder`) e proteger os seeders de demonstração com `app()->environment('local')`.

**A13. Lentidão séria: contas pesadas em todas as páginas**
- **Onde:** `app/Http/Middleware/HandleInertiaRequests.php:53` (`navCounts`); `app/Services/Tasks.php:102-128` e `:141-159`; `app/Services/TeamService.php:200-245` (`report`); `app/Services/WorkArea.php:64`
- **O que está mal:**
  - os números da navegação calculam-se em todos os cliques;
  - para o team leader, esse cálculo inclui o relatório da equipa inteira, com várias consultas por pessoa e por curso;
  - para o formador, faz uma consulta por inscrição.
- **Quando falha:** com uma equipa de 30 pessoas e 4 cursos, cada clique do team leader faz cerca de 300 consultas à base de dados, e o Início dele calcula o mesmo relatório 3 vezes.
- **Correção:** calcular o relatório com consultas agrupadas e guardar os números da navegação em cache durante alguns minutos.

**A14. [Segurança] O email nunca é verificado, e as equipas confiam no email**
- **Onde:** `app/Models/User.php:15` (não implementa `MustVerifyEmail`, por isso o middleware `verified` não faz nada); `app/Services/TeamService.php:113`
- **O que está mal:** qualquer pessoa pode criar uma conta com o email de outra. Quando esse email é incluído numa equipa, a conta falsa recebe os cursos da empresa.
- **Quando falha:**
  1. Alguém regista-se como `rui@oficina.pt`.
  2. A oficina compra a formação e inclui o Rui na equipa.
  3. Quem fica com acesso aos cursos é a conta falsa.
- **Correção:** ativar a verificação de email (`MustVerifyEmail`), ou exigi-la antes de associar uma conta a uma equipa.

### Menor

**A15. Dois envios de progresso ao mesmo tempo dão erro 500 ou perdem segundos**
- **Onde:** `app/Services/LearningService.php:93-110`
- **O que está mal:** `firstOrNew` + `save`, sem bloqueio.
- **Quando falha:** no primeiro envio de progresso de uma aula, chegam dois pedidos ao mesmo tempo: um dá erro 500. Mais tarde, juntar os mapas sem bloqueio pode perder segundos vistos.
- **Correção:** criar e atualizar o progresso dentro de uma transação, com `lockForUpdate`.

**A16. O certificado sai, mas a inscrição não passa a "concluída"**
- **Onde:** `app/Services/LearningService.php:217-233`
- **O que está mal:** a inscrição só passa a `completed` com 100% das aulas, mas o certificado pode sair antes (por exemplo, com 80%).
- **Quando falha:** o aluno tem o certificado e continua "a meio" nas estatísticas.
- **Correção:** marcar a inscrição como concluída quando se emite o certificado.

**A17. Duplo clique a autorizar dá créditos a dobrar**
- **Onde:** `app/Http/Controllers/Staff/RequestController.php:125-155`
- **O que está mal:** o estado "pago" é verificado sem bloqueio e só depois se somam os créditos.
- **Quando falha:** dois cliques seguidos dão 2 × 10 créditos.
- **Correção:** mudar o estado de forma condicional e só dar os créditos se o estado mudou mesmo.

**A18. É possível pôr cursos em rascunho numa equipa**
- **Onde:** `app/Http/Controllers/Staff/TeamController.php:96`
- **O que está mal:** ao atualizar a equipa, falta a regra "só cursos publicados", que já existe ao criá-la.
- **Quando falha:** os membros ficam inscritos num curso que dá erro 404.
- **Correção:** usar a mesma regra que ao criar a equipa.

**A19. [Segurança] Quem tem a permissão "pessoas" pode tornar-se admin**
- **Onde:** `app/Http/Controllers/Admin/PeopleController.php:29`, `:61`, `:105-113`
- **O que está mal:** um perfil que não é admin mas tem a permissão "pessoas" pode dar o perfil admin a qualquer conta, incluindo a sua.
- **Quando falha:** o admin dá "pessoas" ao gestor de cursos, e o gestor promove-se a admin.
- **Correção:** só um admin pode atribuir o perfil admin e mudar permissões.

**A20. [Segurança] A exportação CSV do registo de atividade permite injetar fórmulas**
- **Onde:** `app/Http/Controllers/Admin/AdminController.php:289-295`
- **O que está mal:** o browser usado, os nomes e os títulos vão para o CSV sem tratamento.
- **Quando falha:** alguém tenta entrar com um browser identificado como `=HYPERLINK(...)`, e a fórmula corre no Excel do admin quando ele abre a exportação.
- **Correção:** pôr `'` antes dos valores que começam por `= + - @`.

**A21. As estatísticas da Administração são lentas**
- **Onde:** `app/Services/AdminStats.php:92-115` e `:148`
- **O que está mal:** `completion()` faz uma consulta por curso e corre 3 vezes na mesma página.
- **Correção:** calcular uma vez por pedido.

**A22. O Início do aluno faz consultas a mais**
- **Onde:** `app/Services/StudentArea.php` (inscrições carregadas cerca de 8 vezes; `documents()` na linha 320 faz uma consulta por curso); `app/Services/AlexService.php:125` (corre em todos os pedidos)
- **Correção:** carregar as inscrições uma vez por pedido e trazer o resto em lote.

**A23. A receita usa o preço atual do curso**
- **Onde:** `app/Services/AdminStats.php:52` e `:228`
- **Quando falha:** o formador muda o preço, e o valor das vendas antigas muda também.
- **Correção:** guardar o preço no pedido de compra.

**A24. Ficam ficheiros órfãos no disco**
- **Onde:** `app/Http/Controllers/Instructor/CourseBuilderController.php:165-250`
- **O que está mal:** vídeos e anexos carregados mas nunca guardados, e pedaços de envios interrompidos, nunca são apagados.
- **Correção:** fazer uma limpeza periódica dos ficheiros sem referência com mais de 24 h.

**A25. Pode haver uma pergunta de teste impossível de acertar**
- **Onde:** `app/Services/CourseBuilder.php:343-347` e `:254-256`
- **O que está mal:** as opções vazias são gravadas, e a opção certa pode ser uma delas. `publishProblems` não verifica isto.
- **Correção:** ignorar as opções vazias e exigir uma opção certa com texto.

**A26. Restos da gamificação e dados a mais enviados para o browser**
- **Onde:** `app/Models/User.php` (`level`, `streak_days`); `app/Http/Middleware/HandleInertiaRequests.php:36` (envia o utilizador inteiro para o browser); tabelas `badges`, `payments`, `live_sessions` e `reviews` sem uso
- **Correção:** retirar os campos e as tabelas que não se usam, e enviar para o browser só os campos necessários.

### Sugestão

**A27. Código duplicado ou morto**
- A validade do acesso calcula-se em dois sítios (`LearningService::access` e `StudentArea::expiry`).
- `clock()` está repetido (`BuildsProgram` e `StudentArea`).
- A ordem das aulas calcula-se em dois sítios.
- `LessonController::newCertificate` (linha 180) decide se o certificado é novo pelo "emitido há menos de 10 s".
- Há comentários soltos em `StudentArea.php:366` e `:466`.

**A28. Faltam testes para a lógica importante**
- Gravar o editor mantém as tentativas e as respostas.
- Sair da equipa mantém a compra pessoal.
- A atualização da equipa desfaz tudo quando falha.
- Renovar um acesso expirado.
- Vídeo com duração ou mapa forjados.
- Pedidos ao mesmo tempo no teste e no certificado.
- Conta desativada incluída numa equipa.

---

## Parte B — Interface

Nota: não se encontrou nenhum problema crítico na interface. Já estão bem:
- as respostas certas só saem do servidor quando devem;
- não há HTML injetado com dados do utilizador;
- todos os `_blank` têm `rel`;
- já não há `confirm()` do browser;
- já não restam `pn-btn`, `ta-cut-*` nem `rounded-md/lg/xl`;
- a gaveta prende e devolve o foco;
- os atalhos do leitor não disparam quando se escreve nas notas.

### Importante

**B1. [Segurança] O microfone pode ficar ligado depois de fechar o teste do microfone**
- **Onde:** `resources/js/Components/Learn/MicCheck.jsx:19-31`
- **O que está mal:** se o componente fecha enquanto o browser ainda está a pedir autorização, o microfone abre depois e nunca é desligado.
- **Quando falha:** o aluno carrega em Continuar com o pedido de autorização aberto e depois autoriza. O microfone fica a gravar até fechar o separador.
- **Correção:** marcar "cancelado" ao fechar e, quando a autorização chegar, se estiver marcado, desligar o microfone de imediato.

**B2. Alex: carregar em "Terminar" enquanto a conversa se prepara não a cancela**
- **Onde:** `resources/js/Components/Alex/alexStore.js:32-59` (botão em `AlexCall.jsx:192`)
- **O que está mal:** depois de "Terminar", o arranque continua e acaba por entrar na chamada.
- **Quando falha:** em "A preparar a conversa…", o aluno carrega em Terminar e depois em Fechar. A janela do Alex volta a aparecer com o microfone aberto, e gasta-se a conversa grátis ou o crédito.
- **Correção:** a cada passo do arranque, verificar se a conversa foi cancelada (ou desativar "Terminar" até a conversa estar pronta).

**B3. O vídeo carregado pode ir parar à aula errada, ou o editor rebenta**
- **Onde:** `resources/js/Components/CourseBuilder/StepProgram.jsx:90` e `:384`
- **O que está mal:** no fim do upload, a aula é procurada pela posição que tinha no início do upload.
- **Quando falha:** a meio de um upload de 800 MB, o formador apaga ou sobe uma aula anterior. O vídeo fica noutra aula, ou a página fica em branco e perdem-se as alterações por gravar.
- **Correção:** procurar a aula pela sua chave (`l.key`), não pela posição.

**B4. Sair do editor a meio de um upload não avisa**
- **Onde:** `resources/js/Pages/Instructor/CourseEditor.jsx:113-124`
- **O que está mal:** o aviso de saída não tem em conta os uploads em curso.
- **Quando falha:** a 60% do envio, o formador clica em "← Os meus cursos". Não aparece aviso, o vídeo perde-se e os pedaços já enviados ficam órfãos no disco.
- **Correção:** contar os uploads ativos e tratá-los como alterações por gravar.

**B5. Em inglês, "Gerir membros" dá os pedidos como concluídos sem os aplicar**
- **Onde:** `resources/js/Pages/Staff/TeamShow.jsx:47-48` e `:59` (o servidor traduz o texto em `Staff/TeamController.php:80`)
- **O que está mal:** a página procura os textos portugueses "Adicionar"/"Retirar", mas em inglês recebe "Add person"/"Remove person".
- **Quando falha:** um gestor com a plataforma em inglês guarda as alterações. Os pedidos ficam concluídos e ninguém é adicionado nem retirado.
- **Correção:** o servidor envia também a chave (`adicionar`/`retirar`) e a página compara a chave.

**B6. Permissões: dois cliques seguidos perdem o primeiro**
- **Onde:** `resources/js/Pages/Admin/Index.jsx:431-436`
- **O que está mal:** a lista nova calcula-se a partir dos dados antigos, que ainda não mudaram.
- **Quando falha:** o admin liga "Equipas" e logo a seguir "Pedidos" no mesmo perfil. "Equipas" fica desligada.
- **Correção:** guardar uma cópia local das permissões, ou bloquear a linha inteira do perfil enquanto se grava.

**B7. [Segurança] A exportação da equipa para Excel permite injetar fórmulas**
- **Onde:** `resources/js/Components/Teams/TeamReport.jsx:11-13`
- **O que está mal:** os nomes e os emails vão para o CSV sem tratamento.
- **Quando falha:** um membro muda o nome para `=HYPERLINK(...)`, e a fórmula corre no Excel do team leader quando ele abre a exportação.
- **Correção:** pôr `'` antes dos valores que começam por `= + - @`, tab ou CR (a mesma regra que em A20).

**B8. O leitor de vídeo acumula envios de progresso ao fechar a página**
- **Onde:** `resources/js/Components/Learn/VideoPlayer.jsx:151`
- **O que está mal:** o ouvinte `pagehide` nunca é removido, por isso junta-se um novo em cada aula aberta.
- **Quando falha:** ao fechar o separador, enviam-se várias posições antigas, que podem estragar o "retomar onde ficou".
- **Correção:** guardar a função numa variável e removê-la na limpeza, como já se faz com `onHide`.

**B9. A "Avaliação" final aparece na aula, mas ainda não existe**
- **Onde:** `resources/js/Pages/Learn/Lesson.jsx:346`, `:357-362`, `:510-522`
- **O que está mal:** o botão pede o microfone e arranca uma contagem de 10 minutos que bloqueia a navegação, mas o painel só diz "fica disponível em breve".
- **Quando falha:** o aluno pensa que está a fazer o teste final e fica 10 minutos sem nada.
- **Correção:** esconder o botão, ou mostrá-lo desativado com "em breve", sem contagem nem microfone.

### Menor

**B10. As perguntas rápidas não se voltam a abrir**
- **Onde:** `resources/js/Pages/Learn/Lesson.jsx:159-166`
- **O que está mal:** só abrem quando o vídeo passa os 90% durante a visita.
- **Quando falha:** se o aluno as fechar, ou recarregar a página depois dos 90%, deixa de as conseguir abrir nessa aula.
- **Correção:** acrescentar um botão "Perguntas rápidas" no painel do material.

**B11. Na aula de amostra e na pré-visualização, todas as respostas rápidas aparecem erradas**
- **Onde:** `resources/js/Components/Learn/QuickChecks.jsx:13` e `:30`
- **O que está mal:** sem a resposta certa (`correct` é `null`), qualquer escolha é marcada a vermelho.
- **Correção:** só marcar certo ou errado quando houver resposta certa.

**B12. Falta o estado de erro nas perguntas rápidas e no vídeo**
- **Onde:** `QuickChecks.jsx:19-22`; `CinemaPlayer.jsx:92-108` e `:214-238`
- **Quando falha:** sem rede, o aluno carrega numa opção e nada acontece. Ou o vídeo fica preto, com o indicador de carregamento, e sem mensagem.
- **Correção:** mostrar uma mensagem de erro com "Tentar outra vez".

**B13. Teclado no leitor de vídeo**
- **Onde:** `CinemaPlayer.jsx:179-197` e `:126-132`
- **O que está mal:**
  - o Espaço pausa o vídeo mesmo com o foco num botão do leitor (por exemplo, "1×");
  - os menus de velocidade e qualidade não fecham com Esc.
- **Correção:** ignorar o Espaço e o Enter quando o foco está num botão, e fechar os menus com Esc.

**B14. Janelas marcadas como modais deixam o Tab sair para a página por trás**
- **Onde:** `Lesson.jsx:511`; `Catalog.jsx:128` e `:190`; `Components/Learn/CourseDrawer.jsx:64`
- **Correção:** reutilizar a lógica de foco da `Drawer` de `Components/ui`.

**B15. Menu da conta**
- **Onde:** `resources/js/Components/Dropdown.jsx:72-101`
- **O que está mal:** não fecha com Esc, não diz se está aberto (`aria-expanded`) e não leva o foco para os itens.
- **Correção:** usar o mesmo `useDismiss` do `PanelsMenu`.

**B16. A barra de baixo do telemóvel esconde os contadores aos leitores de ecrã**
- **Onde:** `resources/js/Layouts/StudentLayout.jsx:214`
- **O que está mal:** o `aria-label` substitui o texto do link, incluindo o contador escondido (por exemplo, "3 mensagens por ler").
- **Correção:** retirar o `aria-label`.

**B17. O contorno de foco amarelo tem pouco contraste no tema claro (cerca de 1,8:1; o mínimo é 3:1)**
- **Onde:** `resources/css/ui.css:30`, `:75`, `:103`; `entrada.css:39`; `alex.css:10`, `:20`, `:49`
- **Correção:** usar `--color-ink` no contorno de foco, como já faz `lesson.css:24`.

**B18. Alguns textos para leitores de ecrã não são lidos**
- **Onde:** `QuizRunner.jsx:56`, `Learn/Course.jsx:133`, `MessagesPanel.jsx:113`, `AlexCall.jsx:155`, `Lesson.jsx:330`
- **O que está mal:** o `aria-label` está num `span` sem papel, e os leitores de ecrã ignoram-no.
- **Correção:** usar `<span className="sr-only">` com o texto.

**B19. Há um `<main>` dentro de outro `<main>` na Administração**
- **Onde:** `resources/js/Pages/Admin/Index.jsx:53`
- **Correção:** trocar o de dentro por `<section>`.

**B20. Dois campos com `id="password"` nas Definições**
- **Onde:** `Profile/Partials/DeleteUserForm.jsx:62-64` e `UpdatePasswordForm.jsx:90`
- **Quando falha:** com a janela "Apagar a conta" aberta, carregar na etiqueta "Palavra-passe" leva o foco ao campo errado.
- **Correção:** dar `id="delete-password"` ao campo da janela.

**B21. A animação da página de entrada ignora "reduzir movimento"**
- **Onde:** `resources/js/Pages/Auth/Entrada.jsx:28-30`
- **Correção:** não mostrar a animação quando o sistema pede `prefers-reduced-motion`.

**B22. Painéis no telemóvel: pega invisível e botões pequenos**
- **Onde:** `resources/css/panels.css:77-80`; `Components/Panels/usePanelBoard.js:364`
- **O que está mal:** a pega de arrastar só aparece com o rato por cima, o que não existe num ecrã tátil. Os botões minimizar e fechar têm 28 px.
- **Correção:** em ecrãs táteis, mostrar sempre a pega e dar aos botões pelo menos 40 px.

**B23. A disposição dos painéis perde-se se se sair logo a seguir**
- **Onde:** `resources/js/Components/Panels/usePanelBoard.js:187-190`
- **O que está mal:** a gravação espera 400 ms e é cancelada se a página fechar antes disso.
- **Correção:** ao sair, enviar a gravação que está pendente.

**B24. "Os meus cursos": abrir um curso não mostra que está a carregar**
- **Onde:** `resources/js/Pages/Student/MyCourses.jsx:78-88`
- **Quando falha:** numa rede lenta, o aluno clica várias vezes, o que faz vários pedidos, e um erro nunca é mostrado.
- **Correção:** abrir logo a gaveta com "A carregar…" e mostrar o erro, se houver.

**B25. Números trocados no Início do admin**
- **Onde:** `resources/js/Components/Home/workBoxes.jsx:91`
- **O que está mal:** a caixa "Cliques no catálogo" mostra por baixo "N contas novas".
- **Correção:** corrigir o texto de apoio dessa caixa.

**B26. O carrossel de sugestões não se pode parar no telemóvel**
- **Onde:** `resources/js/Components/Home/learningBoxes.jsx:142-165`
- **O que está mal:** só para com o rato por cima ou com o foco do teclado.
- **Correção:** acrescentar um botão Pausar/Continuar.

**B27. Textos por traduzir ou misturados**
- **Etiquetas escritas à mão, sem `t()`:** "Palavra-passe" e "Nome" (`Entrada.jsx:195`, `DeleteUserForm.jsx:62`, `ResetPassword.jsx:55`, `UpdatePasswordForm.jsx:87`, `UpdateProfileInformationForm.jsx:43`).
- **Frases em português dentro do código:**
  - `Team/Show.jsx:180` e `:217`;
  - `Staff/Requests.jsx:50` ("pack(s)");
  - `'sim'` no CSV (`TeamReport.jsx:11`);
  - os avisos lidos pelo leitor de ecrã dos painéis (`usePanelBoard.js:289` e `:482`).
- **`builderCount` traduzido antes de a língua ser escolhida:** fica sempre em português (`StudentLayout.jsx:31`).
- **Email com uma frase sem tradução:** `resources/views/emails/message.blade.php:16`.
- **Tratamento misturado:** o catálogo trata por "você" (`Catalog.jsx:200`, `:228`, `:342`) e o resto da plataforma trata por "tu".
- **Correção:** passar tudo por `t()`/`__()` e usar "tu" em toda a plataforma.

### Sugestão

**B28. Hex escrito à mão (quebra o tema escuro)**
- **No JSX, 8 casos:**
  - `accent-[#F8B101]` em `AttendanceDrawer.jsx:60`, `StepPrice.jsx:90` e `Team/Show.jsx:211`;
  - `bg-[#18181B]` em `CinemaPlayer.jsx:333` e `Contacts.jsx:76`, que deve ser `bg-carbon`;
  - `app.jsx:40`.
- **No CSS da plataforma, cerca de 70:**
  - `panels.css`, `lesson.css` e `alex.css`;
  - `#FDB51F` e `#7A1F12` em `lesson.css:168` e `:191`.
- **Correção:** usar os tokens `--color-*`.

**B29. Restos da aparência antiga**
- **Cantos que não são retos nem cápsula:** `lesson.css:179` (12px), `admin.css:5`, `:26`, `:44`, `:45` e `lesson.css:185`.
- **Sombras em caixas em repouso:** `CourseBuilder/ui.jsx:49` e `Team/Show.jsx:269`.
- **Letra fora da Archivo:** `CinemaPlayer.jsx:29` (Geist Mono) e `lesson.css:162`.

**B30. Componentes duplicados**
- **`Field`:** 3 versões (`Components/ui`, `CourseBuilder/ui.jsx:29`, `Team/Show.jsx:326`).
- **`Kpi`:** 3 versões (`Components/ui`, `Admin/Index.jsx:78`, `Instructor/Courses.jsx:127`).
- **`Box`:** 2 versões (`Teams/ui.jsx` e `Admin/Index.jsx:69`).
- **Componentes do Breeze** (`InputError`, `TextInput`, `PrimaryButton`…): fazem o mesmo que `Field`/`Button`, mas não ligam o erro ao campo.
- **`CloseIcon`:** 2 iguais (`Catalog.jsx:55`, `CourseDrawer.jsx`).
- **Correção:** deixar uma só versão de cada em `Components/ui`.

**B31. Código e CSS mortos**
- **Em `StudentLayout.jsx`:**
  - `formatXp`, um resto do XP (linha 135);
  - `notice`/`setNotice` (linhas 147-149 e 224).
- **Parâmetros que não se usam:**
  - a prop `position` (`Lesson.jsx:103`);
  - o parâmetro `url` de `alexDef` (`PanelBoard.jsx:190`).
- **CSS que não se usa:**
  - `.ta-fill`, `.ta-toast`, `.ta-live-dot` e `.ta-slide-in`, com as respetivas animações (`app.css:80-112`);
  - `.pn-link-row` (`panels.css:370`).

---

## Resumo

| Gravidade | Servidor | Interface | Total | Dos quais Segurança |
|---|---|---|---|---|
| Crítico | 3 | 0 | **3** | 0 |
| Importante | 11 | 9 | **20** | 6 (A4, A9, A12, A14, B1, B7) |
| Menor | 12 | 18 | **30** | 2 (A19, A20) |
| Sugestão | 2 | 4 | **6** | 0 |
| **Total** | **28** | **31** | **59** | **8** |

## Ordem recomendada para as correções

1. **Proteger os dados dos alunos** (A1, A2, A3). São os únicos críticos e estragam notas, compras e equipas sem ninguém dar por isso. Escrever os testes do ponto A28 ao mesmo tempo.
2. **Deploy e contas** (A12, A14, A10). Tirar o `db:seed` do deploy antes de haver clientes reais, ativar a verificação de email e atualizar a "última atividade", que afeta lembretes, convites e relatórios.
3. **Regras do progresso e do certificado** (A4, A5, A6, A7, A8, A16). Garantem que o progresso e o certificado são verdadeiros.
4. **Aula e Alex** (B1, B2, B8, B9, B10, B11, B12). Mexem com o microfone, com o "retomar" e com o que o aluno vê.
5. **Editor e gestão** (B3, B4, B5, B6, A9, A11, A17, A18, A19). Erros que aparecem a formadores, gestores e admin.
6. **Exportações CSV** (A20, B7): uma só função partilhada resolve os dois.
7. **Rapidez** (A13, A21, A22). Antes de haver equipas grandes.
8. **Acessibilidade, telemóvel e traduções** (B13–B27).
9. **Limpeza e design** (A26, A27, B28–B31), quando se mexer em cada página.

Depois das correções: voltar a correr os testes, fazer o commit e só então lançar o `security-auditor`.
