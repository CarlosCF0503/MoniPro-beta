# Evidências do R1: testes de ponta a ponta e integração com PostgreSQL real (09/11/2026)

O orientador recomendou implementar os testes de ponta a ponta no navegador para os casos CT-01 a CT-11 e alguns testes de integração com PostgreSQL real em contêiner.

## Índice

| Arquivo | O que comprova | Critério de aceite |
|---|---|---|
| `e2e-playwright-ci.txt` | Os 11 casos da Tabela 24.3 (15 testes) passaram no computador e no celular no CI de um PR: **30 de 30** | Os 11 casos passam nos dois projetos (22+ execuções) no CI |
| `integracao-postgres-ci.txt` | `npm run test:int` passou no CI com o banco criado do zero (**16 de 16**), e no mesmo commit os testes de unidade e de API passaram (237) | `npm run test:int` passa com o banco recriado do zero |
| `integracao-postgres-local.txt` | O nome e o resultado de cada teste de integração e a prova de que eles pegam erro. Sem as travas `FOR UPDATE`, os testes de capacidade e de presença simultânea falham; com um campo no schema sem migração, a suíte nem começa | Os testes detectam os defeitos que os mocks escondem |

## Onde está cada caso

| Caso | Requisito | Arquivo de teste |
|---|---|---|
| CT-01 | RF-001 | `e2e/ct01-cadastro.spec.js` |
| CT-02 | RF-001 | `e2e/ct02-login.spec.js` |
| CT-03, CT-04, CT-05 | RF-003 | `e2e/ct03-ct05-monitoria.spec.js` |
| CT-06, CT-08 | RF-003, RF-004, RN-001 | `e2e/ct06-ct08-cancelamentos.spec.js` |
| CT-07 | RF-001 | `e2e/ct07-sair.spec.js` |
| CT-09, CT-10, CT-11 | RF-003, RNF-005, RN-008 | `e2e/ct09-ct11-regras.spec.js` |

## Ambientes

- **Playwright:** pilha descartável `docker-compose.e2e.yml`, com Postgres 17 com SSL e CA própria, migrações, seed fictício, backend, frontend e um Nginx na frente com a mesma origem (como no servidor). Cada teste cria as próprias contas `@e2e.invalid`.
- **Integração:** PostgreSQL 17 vazio (service do GitHub Actions ou contêiner local). O `globalSetup` recusa qualquer banco que não seja local e com nome terminado em `_integracao`.
- **Relatório completo do Playwright** (com traces e capturas das falhas): artefato `e2e-relatorio` de cada execução do workflow "Testes de ponta a ponta", guardado por 30 dias. O desta evidência é o da execução [42540267091](https://github.com/CarlosCF0503/MoniPro-beta/actions/runs/42540267091).

## PRs

- #65: testes de integração e job no `pull-request.yml`.
- #66: Playwright, `docker-compose.e2e.yml` e workflow `e2e.yml`.

As execuções de CI são do PR #68, a primeira com a develop já contendo #65, #66 e #67.

## O que foi ocultado

A senha do banco de integração (já mascarada pelo GitHub como `***`) e os caminhos da máquina local.
