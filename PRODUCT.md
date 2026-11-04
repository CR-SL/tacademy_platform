# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Aluno** (técnico de oficina): retoma o curso, vê as aulas, faz os testes e obtém certificados. É o utilizador principal.
- **Team leader**: acompanha o progresso, as notas e os certificados da sua equipa.
- **Gestor de cursos**: trata pedidos, cria equipas e autoriza acessos.
- **Formador**: cria e publica os seus cursos e define o preço.
- **Admin**: gere tudo o que os outros perfis gerem.

## Product Purpose

Plataforma de cursos online para o setor automóvel, em português de Portugal. Os cursos cobrem diagnóstico automóvel, eletrónica automóvel e gestão de oficina, com vídeo, testes, certificados e aulas com avatar de IA.

A tarefa principal é o aluno entrar e retomar a aula onde ficou. O resto do Dashboard apoia esta ação e não compete com ela.

## Positioning

Formação feita para técnicos de oficina, em que o progresso é real: conta os segundos de vídeo realmente vistos, os testes contam para o certificado, e as empresas acompanham a equipa inteira.

## Operating Context

O computador e o telemóvel têm a mesma importância: tanto sessões de estudo longas como sessões curtas. Ainda não há dados de utilização que confirmem esta repartição.

## Capabilities and Constraints

- O redesign muda o aspeto, não as regras do produto: desbloqueio de aulas, meta de 90% do vídeo, tentativas dos testes, certificados e perfis.
- Os temas claro e escuro têm de funcionar.
- O XP, as missões e a classificação ficam **discretos, em segundo plano**. Hoje são dados de demonstração, porque ainda não há tabelas para eles. Em aberto: quando passam a dados reais.
- A landing page está fora de âmbito por agora. O hero "nuvem" e a aula em ecrã dividido estão em espera.
- Detalhes técnicos e histórico de decisões: `../docs/CLAUDE.md`.

## Brand Commitments

- **Personalidade:** ousada, futurista e marcante. A referência é Linear / Stripe: software de grande precisão, com tipografia cuidada, detalhes finos e muita clareza.
- **Cor da marca:** o amarelo do logótipo, `#F8B101`.
- **Logótipo:** os PNG originais em `public/images/brand/`.
- **Decisões recentes do cliente, a respeitar salvo indicação em contrário:** navbar com o logótipo à esquerda e as opções ao centro, sem XP nem contador de dias; caixas com cantos de 8 px; botões com corte na diagonal.

## Evidence on Hand

- Cursos reais na base de dados, com fotografias em `public/images/cursos/`.
- Curso de demonstração "Mecânica Automóvel — Formação Completa" (10 módulos, 61 aulas).
- Não há testemunhos, clientes nem métricas de utilização: não inventar.

## Product Principles

1. Retomar a aprendizagem é sempre a ação mais fácil do ecrã.
2. O progresso mostrado é verdadeiro e vem de dados reais.
3. A clareza e a rapidez de leitura vêm antes do efeito visual nas páginas de trabalho.
4. O impacto vem da precisão e de uma ideia visual forte, não da quantidade de efeitos.
