---
name: T.Academy — Plataforma de cursos
description: Formação para técnicos de oficina automóvel; área do aluno, aula, formador, equipas e gestão (o website fica de fora)
colors:
  sinal-amarelo: "#F8B101"
  amarelo-tinta: "#946A00"
  sobre-amarelo: "#111111"
  fundo-bancada: "#F5F3EE"
  superficie: "#FFFFFF"
  superficie-2: "#EFEBE4"
  tinta: "#111111"
  sobre-tinta: "#FFFFFF"
  carvao: "#18181B"
  texto: "#3C3B38"
  texto-suave: "#6E6B63"
  linha: "#E7E4DD"
  pista: "#EFEBE4"
  pastilha: "#D9D5CB"
  campo: "#CFCBBF"
  alerta: "#E5484D"
  sucesso: "#2F9E5B"
  info: "#3A6FD8"
  noite-fundo: "#0F1013"
  noite-superficie: "#191B20"
  noite-superficie-2: "#262930"
  noite-tinta: "#F4F4F2"
  noite-texto: "#C9C9C6"
  noite-texto-suave: "#9A9A96"
  noite-linha: "#2C2F36"
  noite-pastilha: "#3C3F46"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body-strong:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  small:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  nenhum: "0"
  icone: "6px"
  capsula: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  margem-caixa: "18px"
  "6": "24px"
  "8": "32px"
  linha-grelha: "36px"
components:
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.sobre-tinta}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.capsula}"
    padding: "0 20px"
    height: "44px"
  button-primary-sm:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.sobre-tinta}"
    rounded: "{rounded.capsula}"
    padding: "0 16px"
    height: "36px"
  button-accent:
    backgroundColor: "{colors.sinal-amarelo}"
    textColor: "{colors.sobre-amarelo}"
    rounded: "{rounded.capsula}"
    padding: "0 20px"
    height: "44px"
  button-soft:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.capsula}"
    padding: "0 20px"
    height: "44px"
  button-soft-hover:
    backgroundColor: "{colors.pastilha}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    rounded: "{rounded.capsula}"
    padding: "0 20px"
    height: "44px"
  pill:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.capsula}"
    padding: "0 14px"
    height: "36px"
  pill-selected:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.sobre-tinta}"
  chip:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.texto-suave}"
    typography: "{typography.label}"
    rounded: "{rounded.capsula}"
    padding: "3px 8px"
  panel:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.nenhum}"
  panel-header:
    typography: "{typography.label}"
    padding: "0 12px 0 18px"
    height: "60px"
  input:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.nenhum}"
    padding: "10px 12px"
  progress-bar:
    backgroundColor: "{colors.pista}"
    height: "6px"
    rounded: "{rounded.nenhum}"
  nav:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto-suave}"
    height: "64px"
---

# Design System: T.Academy — Plataforma de cursos

> Âmbito: só a plataforma com sessão iniciada (Início, Os meus cursos, aula, avaliações, documentos, formador, equipas, gestão, perfil e entrada). O website (landing, `/cursos` público, contactos) vai sair deste projeto e não segue este documento.
> Fundamentos (cores com os valores nos dois temas, temas, tipografia, espaços e grelha, formas, profundidade, movimento): `public/landing-concepts/fundamentos.html`.
> Guia de componentes (para que serve, quando usar e não usar, como escrever, acessibilidade, código): `public/landing-concepts/componentes.html`. Abrir pelo servidor local, porque os exemplos usam o CSS compilado da plataforma.
> Guia de padrões (tarefas inteiras: entrar, retomar, comprar, testes, certificado, formulários, guardar sozinho, confirmar, filtrar, agir sobre várias pessoas, prazos, pedidos, painéis): `public/landing-concepts/padroes.html`.
> Guia de voz e tom (como a plataforma escreve: princípios, tom por situação, regras, números e datas, glossário, palavras a evitar): `public/landing-concepts/voz-e-tom.html`.

## Overview

**Creative North Star: "A bancada da oficina"**

Uma bancada bem arrumada: cada ferramenta tem o seu lugar, está à mão e vê-se logo para que serve. A plataforma é isso para um técnico que estuda entre trabalhos. As superfícies são planas e limpas, o espaço é usado sem desperdício, e um único amarelo de sinalização marca o que importa agora: a aula a retomar, o separador ativo, o progresso. As etiquetas pequenas em maiúsculas fazem o papel das etiquetas das gavetas: dizem o que está dentro sem levantar a voz.

A referência de precisão é o software tipo Linear e Stripe: tipografia cuidada, detalhes finos, nada decorativo que não ajude a ler. O carácter vem da firmeza (letra Archivo em peso forte nos títulos, cantos retos nas caixas, cápsulas nos botões), não de efeitos. É uma interface de trabalho: densidade média-alta, leitura rápida, o mesmo peso no computador e no telemóvel.

O progresso mostrado é sempre real. Nenhum elemento visual inventa estado: barras, números e etiquetas refletem dados da base de dados.

**Key Characteristics:**
- Caixas brancas planas, sem cantos arredondados, sobre um fundo cor de bancada.
- Um só acento: o amarelo T.Academy, usado com moderação.
- Botões, separadores e etiquetas de estado em cápsula.
- Etiquetas de secção em maiúsculas, pequenas e espaçadas.
- Títulos em Archivo 800, corpo em Archivo 400, números tabulares.
- Temas claro e escuro com os mesmos tokens, escolhidos nas Definições (claro, escuro ou automático; claro por omissão).

## Colors

Neutros quentes de oficina (papel, cinza-pedra, carvão) com um amarelo de sinalização como única cor da marca.

### Primary
- **Amarelo de sinalização** (`sinal-amarelo`): a cor do logótipo. Preenche barras de progresso, o sublinhado do separador ativo na navegação, o botão de destaque (raro) e o foco de elementos especiais. Nunca como fundo de áreas grandes.
- **Amarelo-tinta** (`amarelo-tinta`): o amarelo escurecido para texto sobre fundo claro (o amarelo puro não tem contraste para texto). No tema escuro passa a ser o próprio amarelo.
- **Sobre amarelo** (`sobre-amarelo`): texto em cima do amarelo; é sempre quase preto, nos dois temas.

### Secondary
- **Sucesso** (`sucesso`): concluído, certificado emitido, resposta certa. Etiquetas com fundo a ~10% da mesma cor; como texto usa `--color-success-ink`.
- **Info** (`info`): estados informativos nas etiquetas da gestão.
- **Alerta** (`alerta`): erros, fora do prazo, "precisa de atenção". Fundo a ~10% ou contorno; nunca um bloco vermelho cheio. Como texto usa `--color-live-ink`.

### Neutral
- **Fundo da bancada** (`fundo-bancada`): o fundo da página, atrás das caixas.
- **Superfície** (`superficie`): o interior das caixas, gavetas, menus e navegação.
- **Superfície 2** (`superficie-2`): tiles de números, botões suaves, separadores por selecionar, fundos de estado neutro.
- **Tinta** (`tinta`): títulos, texto forte e o botão principal. Inverte no tema escuro.
- **Texto** (`texto`): parágrafos e descrições mais longas.
- **Texto suave** (`texto-suave`): etiquetas, metadados, links da navegação em repouso.
- **Linha** (`linha`): divisórias de 1px entre linhas de lista e por baixo dos cabeçalhos das caixas.
- **Pista** (`pista`): o trilho vazio das barras de progresso.
- **Pastilha** (`pastilha`): hover dos botões suaves e dos separadores.
- **Campo** (`campo`): contorno dos campos de formulário.
- **Carvão** (`carvao`): sempre escuro nos dois temas, para vídeo e áreas com texto branco sobre fotografia.
- **Tema escuro** (`noite-*`): os mesmos papéis com valores próprios; `--color-accent` não muda.

### Named Rules
**A Regra do Sinal Único.** O amarelo é a única cor de marca e ocupa pouco espaço: marca o que está ativo ou em progresso. Se um ecrã tem mais de três elementos amarelos, algum deles está a mais.

**A Regra dos Tokens.** Cores só através das variáveis `--color-*` (ou das classes Tailwind que as usam). Um hex escrito à mão numa página quebra o tema escuro.

## Typography

**Display Font:** Archivo (com system-ui, sans-serif)
**Body Font:** Archivo (com system-ui, sans-serif)
**Label/Mono Font:** Archivo em maiúsculas espaçadas (não há letra mono)

**Character:** Uma só família, com o carácter a vir dos pesos: 800 compacto nos títulos, 400 limpo no texto, 600 espaçado nas etiquetas. Números sempre tabulares para que percentagens e contagens não dancem.

### Hierarchy
- **Display** (800, 36–42px, 1.05): o número ou título principal de um destaque (aula a retomar, título do curso na faixa). Raro.
- **Headline** (800, 28–32px, 1.1): título de página ou de pessoa num painel de detalhe.
- **Title** (800, 20–23px, 1.15): saudação do Início, títulos dentro de caixas, avisos de estado vazio.
- **Body strong** (600, 15px, 1.3): nomes em listas (curso, aula, pessoa).
- **Body** (400, 14px, 1.45): texto corrente das caixas. Na página da aula sobe para 15px. Parágrafos até ~65 carateres.
- **Small** (400, 12.5–13px, 1.4): metadados, ajudas de campo, notas por baixo de listas.
- **Label** (600, 11px, 0.1em, maiúsculas, texto suave): cabeçalhos das caixas, nomes de estatísticas, contexto por cima de títulos.

### Named Rules
**A Regra da Etiqueta de Gaveta.** Cada caixa e cada grupo começa por uma etiqueta em maiúsculas, não por um título grande. O título grande fica para o conteúdo principal da caixa.

**A Regra dos Pesos.** Só 400, 500 (links da navegação), 600, 700 (botões) e 800 (títulos). Nada de 300 nem 900.

## Layout

- **Quadro de caixas:** grelha de 24 colunas, linhas de 36px e espaço de 12px entre caixas. Cada pessoa pode mover, redimensionar, minimizar e fechar as caixas, e a disposição fica guardada por página.
- **Margens:** o interior das caixas usa 18px na horizontal; listas usam 12px na vertical por linha.
- **Escala de espaços:** 4, 8, 12, 16, 24 e 32px. O 8px é o espaço mais comum entre elementos. O 18px é exclusivo da margem interior das caixas.
- **Navegação:** barra de 64px no topo, logótipo e links à esquerda, ferramentas à direita. Na página da aula, cabeçalho próprio de 56px.
- **Responsivo:** pontos de quebra em 1100px (menos colunas), 760px (caixas empilhadas pela ordem guardada) e 600px (telemóvel, com barra de navegação em baixo). O telemóvel tem o mesmo peso que o computador.

## Elevation & Depth

A plataforma é plana. A profundidade vem da cor: caixas brancas sobre o fundo de bancada, tiles em `superficie-2` dentro das caixas. As sombras só aparecem em camadas que flutuam por cima da página.

### Shadow Vocabulary
- **Menu** (`box-shadow: 0 14px 40px rgba(0,0,0,.18)`): menus abertos, como o dos painéis visíveis.
- **Gaveta** (`box-shadow: -20px 0 60px rgba(0,0,0,.15)`): painel lateral de formulários (Pedir alteração, Atribuir formação, Presença).
- **Caixa a mover** (`box-shadow: 0 16px 44px -12px rgba(20,16,8,.35), 0 0 0 1px var(--color-line)`): só enquanto se arrasta uma caixa.

### Named Rules
**A Regra da Bancada Plana.** Uma caixa em repouso não tem sombra. Se precisa de se destacar, muda de fundo, não ganha sombra.

## Shapes

Duas formas, sem meio-termo: o **retângulo reto** para tudo o que contém (caixas, campos, barras, tiles, gavetas) e a **cápsula** para tudo o que se carrega (botões, separadores, etiquetas de estado). A única exceção são os botões de ícone da navegação, com cantos de 6px no hover.

**A Regra das Duas Formas.** Raio 0 ou raio de cápsula. Qualquer outro valor (4px, 8px, 12px) é um resto da aparência antiga.

## Components

### Buttons
Firmes e diretos; o texto diz a ação ("Continuar", "Enviar lembrete").
- **Código:** `<Button variant="accent" size="sm">` de `Components/ui`, ou as classes `ui-btn` + variante.
- **Shape:** cápsula (999px); 44px de altura, ou 36px na versão pequena.
- **Primary:** fundo tinta, texto inverso, 700, 13.5px, 0 20px. Uma ação principal por zona.
- **Accent:** fundo amarelo, texto quase preto. Reservado para a ação que avança o estudo ou confirma um formulário importante.
- **Soft:** fundo `superficie-2`, 600; hover em `pastilha`. Ações secundárias.
- **Line:** contorno de 1px em tinta, fundo transparente. Alternativa secundária quando há fundo de cor.
- **Link:** texto 600 sublinhado (offset 3px). Ações de terceira linha.
- **Press / Disabled:** encolhe para 0.98 ao carregar; desativado a 45% de opacidade com cursor proibido.

### Chips
- **Style:** cápsula, 11px 600 em maiúsculas, fundo a ~10% da cor do estado e texto na cor do estado.
- **State:** neutro (superfície 2 + texto suave), sucesso, aviso (amarelo-tinta), alerta, info, escuro (tinta).

### Separadores (Pills)
- Cápsulas de 36px em `superficie-2`; a selecionada fica em tinta com texto inverso. Usados para filtrar (estado dos cursos, curso da equipa).

### Cards / Containers
- **Corner Style:** reto (0).
- **Background:** superfície; dentro, tiles em superfície 2.
- **Shadow Strategy:** nenhuma em repouso (ver Elevation & Depth).
- **Border:** nenhuma à volta; 1px `linha` por baixo do cabeçalho e entre linhas de lista.
- **Internal Padding:** 18px na horizontal.
- **Cabeçalho:** etiqueta de gaveta à esquerda, pega de arrastar visível no hover, minimizar e fechar à direita; 60px (40px na versão compacta).

### Inputs / Fields
- **Style:** retângulo reto, 1px `campo`, fundo de página ou superfície, 15px.
- **Focus:** contorno amarelo e anel amarelo de 3px a 20%.
- **Error:** mensagem em `--color-live-ink` por baixo do campo, 13px (`ui-err`). Etiqueta do campo em maiúsculas 12.5px por cima (`ui-label`).
- **Código:** `ui-input` ou `<Field>` de `Components/ui`.

### Navigation
- Barra branca de 64px com linha de 1px por baixo. Links 14px 500 em texto suave; o ativo fica em tinta 600 com sublinhado amarelo de 3px colado à linha. No telemóvel, barra de ícones fixa em baixo.

### Barra de progresso
- Trilho de 6px em `pista`, preenchimento amarelo, cantos retos. Mostra sempre um valor real; anima de 0 ao valor ao aparecer (desligado com movimento reduzido).

### Gaveta
- Painel à direita (até 520–640px), fundo de página, cabeçalho com etiqueta e título, rodapé com a ação principal. Fecha com Esc ou no fundo escurecido.

### Movimento
- Mudanças de disposição: 200ms `cubic-bezier(.16,1,.3,1)`. Painéis da aula: 500ms `cubic-bezier(.32,.72,0,1)`. Botões: 150ms. Com `prefers-reduced-motion`, as animações de preenchimento e entrada desligam-se.

## Do's and Don'ts

### Do:
- **Do** usar só os tokens `--color-*` e as classes Tailwind que os usam; o tema escuro depende disso.
- **Do** começar cada caixa com uma etiqueta de gaveta (11px, 600, maiúsculas, 0.1em).
- **Do** usar cápsula para tudo o que se carrega e cantos retos para tudo o que contém.
- **Do** manter uma ação principal por zona, em tinta; o amarelo só para a ação que faz avançar.
- **Do** mostrar números com algarismos tabulares e dados reais.
- **Do** garantir foco visível em tudo o que é interativo (contorno de 2px).

### Don't:
- **Don't** arredondar caixas, campos ou barras (nada de 4px, 8px, 12px).
- **Don't** pôr sombra em caixas em repouso.
- **Don't** usar o amarelo em fundos grandes ou para texto sobre fundo claro (usar amarelo-tinta).
- **Don't** escrever cores em hex dentro das páginas.
- **Don't** mostrar progresso, XP, classificações ou atividade "ao vivo" que não venham de dados reais.
- **Don't** usar outra família de letra além da Archivo.

### Base única (arrumada a 2026-11-07)
- **Botões e campos:** um só conjunto, em `resources/css/ui.css` (classes `ui-btn`, `ui-btn-accent|soft|line|danger|glass`, `ui-btn-sm|lg|block|icon`, `ui-link`, `ui-input`, `ui-label`, `ui-hint`, `ui-err`, `ui-check`) e em `resources/js/Components/ui/` (`Button`, `Field`, `btnClass`). Os componentes do Laravel (`PrimaryButton`, `TextInput`…) e os atalhos `btn`/`inputCls` de `Teams/ui` e `CourseBuilder/ui` usam esta base. `pn-btn` e `ta-cut-*` deixaram de existir.
- **Cores de estado em tokens:** `--color-success`, `--color-info` e `--color-live` para preenchimentos e contornos; `--color-success-ink`, `--color-info-ink` e `--color-live-ink` para texto (≥4.5:1). Em Tailwind: `text-success-ink`, `bg-success/10`, `text-live-ink`, etc.
- **Peças juntas (2026-11-07, depois do guia de componentes):** `Chip` (cápsula), `Bar`/`Progress` (`ui-bar`), `Pills` (`ui-pills`, também o `Tabs` da gestão), `Kpi`, `Drawer` (foco preso e devolvido; contexto em `sub` por baixo do título), `Toast`/`FlashToast` (`ui-toast`, com tokens) e `useConfirm` (janela de confirmação em vez do `confirm()` do browser) vivem em `Components/ui`. `Teams/ui` reexporta-os. Saíram `pn-bar`, `pn-pills`, `pn-toast` e `pn-link`. O `Field` liga sozinho a ajuda e o erro ao campo. Nenhuma página tem rótulo por cima do título.
- **Cantos:** nas folhas da plataforma (`panels.css`, `lesson.css`) só ficam 0, 999px e os 6px dos botões de ícone.

### Definições, tema, primeiro uso e avisos (2026-11-07/08)
- **Definições** (`/definicoes`, no menu da conta; `/profile` redireciona): Conta, Aparência, Notificações (só quem está numa equipa) e Apagar a conta. Preferências guardam ao escolher, sem botão; formulários têm botão.
- **Tema:** `light | dark | system` em `users.theme` (vazio = claro). Aplicado antes de pintar em `app.blade.php` (`data-theme` e `data-theme-pref`); um só estado em `hooks/useTheme.js`, partilhado pelo botão da lua e pelas Definições; Automático acompanha a mudança do sistema. Sem sessão, fica no browser (`ta-theme`).
- **Lembretes:** `users.email_reminders`; quem desliga não recebe os lembretes do team leader, e o team leader vê "Desligou os lembretes por email". Emails essenciais não se desligam.
- **Emails para pessoas de fora** (sem conta) tratam por "você"; dentro da plataforma, sempre "tu".
- **Primeiro uso:** sem cursos, tarefas nem conversas, o Início mostra `Welcome` (três cursos publicados mais recentes e "Ver o catálogo").
- **Tarefas e números:** `app/Services/Tasks.php` junta aos Pendentes as mensagens por ler, cursos atribuídos por começar, a equipa (team leader) e as presenças por confirmar (formador); `navCounts` mostra números em Início, Os meus cursos, Equipas e Criar cursos, sempre com o texto escondido. O sino é só do gestor de cursos.

### Dívida conhecida (por arrumar)
- Ainda há botões escritos com classes Tailwind soltas em algumas páginas (por exemplo, separadores e etiquetas de estado). Passam a `Button`/`ui-btn` quando a página for mexida.
- O texto suave sobre superfície 2 está no limite do contraste (4.48:1).
- As cores das peças do minijogo da Pausa são próprias do jogo e ficam fora da paleta.
