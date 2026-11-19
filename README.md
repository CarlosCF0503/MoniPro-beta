# MoniPro

Sistema web para agendar, acompanhar e comprovar monitorias acadêmicas. O monitor publica
vagas por disciplina, o aluno se inscreve pelo calendário, os dois confirmam a sessão depois
do horário e a plataforma registra pontos e horas de monitoria.

- Produção: https://moni-pro.app.br (branch `main`)
- Homologação: https://dev.moni-pro.app.br (branch `develop`)

## Sumário

- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Como executar localmente](#como-executar-localmente)
- [Testes](#testes)
- [Sessão e segurança](#sessão-e-segurança)
- [Endpoints da API](#endpoints-da-api)
- [Fluxo de trabalho e deploy](#fluxo-de-trabalho-e-deploy)
- [Documentação e evidências](#documentação-e-evidências)

## Funcionalidades

| Código          | Funcionalidade                                                                                      | Situação  |
| :-------------- | :-------------------------------------------------------------------------------------------------- | :-------- |
| RF-001          | Cadastro e login de aluno e monitor, sessão por cookie                                              | Concluído |
| RF-002          | Vagas por disciplina e inscrição pelo calendário, com limite de capacidade                          | Concluído |
| RF-003          | Perfil do aluno e do monitor, com as inscrições, as vagas e a exclusão da conta (LGPD)              | Concluído |
| RF-004          | Gamificação: pontos depois da confirmação dos dois lados (monitor +10, aluno +2), extrato e ranking | Concluído |
| RF-005          | Declaração de horas do monitor, por semestre, com código de verificação                             | Concluído |
| RF-008 / RN-009 | Recuperar a senha por e-mail                                                                        | Concluído |
| RF-009 / RN-010 | Editar uma vaga ativa                                                                               | Concluído |
| RF-010 / RN-011 | Avisos por e-mail ao aluno (vaga alterada ou cancelada, lembretes)                                  | Concluído |
| RF-011 / RN-008 | Extrato de pontos e ranking por disciplina e semestre                                               | Concluído |
| RF-013 / RN-015 | Lista de espera nas vagas lotadas, com inscrição automática quando abre um lugar                    | Concluído |
| RF-016          | Monitoria on-line, com o link da sala só para os inscritos                                          | Concluído |
| RN-016          | Faltas marcadas pelo monitor; 3 em 30 dias bloqueiam novas inscrições por 7 dias                    | Concluído |
| RF-018 / RN-017 | Confirmação do e-mail no cadastro                                                                   | Concluído |
| RN-001          | Cancelamento com pelo menos 24 h de antecedência                                                    | Concluído |

No RF-005, a revogação da declaração é feita pelo script `scripts/certificados.js` até existir
o perfil Administrador. Os códigos a partir do RF-008 vêm dos planos de novas funcionalidades e
entram no Documento de Especificação na versão seguinte à v7.2.

### Páginas (`Monipro_web/`)

| Página                                                           | Uso                                                                        |
| :--------------------------------------------------------------- | :------------------------------------------------------------------------- |
| `index.html`                                                     | Login                                                                      |
| `escolha_cadastro.html`, `cadastro.html`, `confirmar_email.html` | Cadastro de aluno ou monitor e confirmação do e-mail                       |
| `redefinir_senha.html`                                           | Nova senha a partir do link enviado por e-mail                             |
| `base.html`                                                      | Página inicial depois do login                                             |
| `escolha_disciplina.html`, `cadastro_disciplina.html`            | Lista de disciplinas e cadastro de uma nova (monitor)                      |
| `marcar_monitoria.html`                                          | Calendário e lista de vagas: inscrição (aluno) e criação de vaga (monitor) |
| `perfil.html`, `perfil_aluno.html`, `perfil_monitor.html`        | Perfil de cada papel: inscrições, vagas, confirmação, pontos e horas       |
| `ranking.html`                                                   | Ranking de pontos por disciplina e semestre                                |
| `certificado.html`                                               | Declaração de horas para imprimir                                          |
| `privacidade.html`                                               | Aviso de privacidade (LGPD)                                                |

## Arquitetura

- **Backend:** Node.js 22, Express 5 e Prisma 7 (adaptador `pg`) sobre PostgreSQL 17. O código
  fica em `src/`, dividido em `routes` → `controllers` → `services` → `repositories`. Os
  esquemas de entrada ficam em `schemas` (Zod, que descarta os campos não declarados), e o
  tratador de erros é central (`middlewares/tratadorDeErros.js`). Os logs são estruturados,
  com pino.
- **Frontend:** HTML, CSS e JavaScript sem framework, servidos por Nginx sem root
  (`Monipro_web/Dockerfile`). As chamadas passam por `chamadaApi()` em `Monipro_web/JS/api.js`.
- **Banco:** migrações versionadas em `prisma/migrations/`. As regras que dependem de
  concorrência (capacidade da vaga, inscrição duplicada, confirmação de presença) rodam em
  `$transaction` com trava de linha.
- **Infraestrutura:** Docker Compose com os serviços `db`, `backend` e `frontend` numa VM da
  Oracle Cloud, atrás de um Nginx com TLS (Let's Encrypt), CSP e HSTS. Produção e
  homologação têm bancos separados.

## Como executar localmente

Pré-requisitos: Node.js 22 (o mesmo do CI e da imagem Docker) e Docker.

1. Copie `.env.example` para `.env` e preencha ao menos `DATABASE_URL` e `JWT_SECRET`. O
   próprio `.env.example` explica cada variável. Use um banco **local**, nunca o de
   homologação nem o de produção.
2. Instale as dependências com `npm ci`. O `postinstall` gera o Prisma Client.
3. Aplique as migrações com `npx prisma migrate dev`. Se quiser dados fictícios, rode
   `npm run seed` com `SEED_AMBIENTE=local` e `SEED_SENHA` definidos.
4. Suba a API com `npm run dev` (recarrega ao salvar) ou `npm start`. Ela responde na porta
   3000, e `GET /saude` confere se o banco está acessível.

Com Docker, `docker compose up --build` sobe o banco, o backend (porta 3000) e o frontend
(porta 8080) a partir do `.env`. A imagem do backend roda sem root (usuário `node`), só com as
dependências de produção, e tem `HEALTHCHECK` em `/saude`.

Sem `SMTP_HOST` no `.env`, nenhum e-mail sai: o backend só registra no log o e-mail que seria
enviado, com o link.

## Testes

| Comando                  | O que roda                                                                                                               |
| :----------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `npm test`               | Testes unitários e de API (Jest + Supertest), com o banco simulado                                                       |
| `npm run test:cobertura` | Os mesmos testes com relatório de cobertura em `coverage/`. Falha se a cobertura cair abaixo do piso de `jest.config.js` |
| `npm run test:int`       | Integração com um PostgreSQL real: migrações do zero, concorrência, restrições únicas e sessão                           |
| `npm run test:e2e`       | Casos CT-01 a CT-16 no navegador (Playwright), no computador e no celular                                                |
| `npm run lint`           | ESLint e Prettier                                                                                                        |

O `test:int` exige `DATABASE_URL_INTEGRACAO` apontando para um banco local cujo nome termine
em `_integracao`, e recusa qualquer outro. Exemplo com Docker:

```bash
docker run -d --name monipro-int -p 5434:5432 -e POSTGRES_USER=monipro \
  -e POSTGRES_PASSWORD=integracao -e POSTGRES_DB=monipro_integracao postgres:17
DATABASE_URL_INTEGRACAO=postgres://monipro:integracao@localhost:5434/monipro_integracao npm run test:int # pragma: allowlist secret
```

O `test:e2e` roda contra uma pilha descartável (Postgres com SSL, backend, frontend e um
gateway Nginx, como no servidor):

```bash
docker compose -f docker-compose.e2e.yml up -d --build --wait
npx playwright install chromium   # só na primeira vez
npm run test:e2e
docker compose -f docker-compose.e2e.yml down -v
```

## Sessão e segurança

- **Sessão:** o login grava um cookie `httpOnly`, `Secure` e `SameSite=Strict` com validade de
  2 horas. O token não fica acessível ao JavaScript da página. Sair (`POST /auth/sair`)
  incrementa `versao_token` do usuário, o que invalida todas as sessões abertas, inclusive
  uma cópia roubada do cookie. Trocar a senha tem o mesmo efeito.
- **Senhas:** bcrypt, com política de tamanho mínimo e limite de 72 caracteres. O login leva
  o mesmo tempo para e-mail existente ou não.
- **Defesas:** Helmet, CORS restrito às origens de `ALLOWED_ORIGINS`, limite global de
  requisições e limite extra em `/auth`. Os identificadores aparecem mascarados nos logs. O
  frontend escapa todo dado vindo da API antes de inserir no HTML (`escaparHtml`).
- **Banco:** conexão com SSL e validação da CA (`DB_CA_CERT`).
- **LGPD:** a exclusão da conta anonimiza os dados pessoais, e `scripts/retencao.js` aplica
  os prazos de retenção (só simula, a não ser que receba `--aplicar`).
- **Declarações de horas:** `scripts/certificados.js --revogar CODIGO --motivo "..."` revoga uma
  declaração (só simula sem `--aplicar`), grava a data e o motivo e registra no log.
- **Segredos:** ficam só no `.env` de cada servidor, que não é versionado.

## Endpoints da API

Todas as rotas exigem sessão, exceto as marcadas como públicas. "Monitor" indica rota
restrita a esse papel.

| Método | Caminho                            | Descrição                                                      |
| :----- | :--------------------------------- | :------------------------------------------------------------- |
| GET    | `/saude`                           | Situação da API e do banco (pública)                           |
| POST   | `/auth/cadastro`                   | Cria a conta e envia o link de confirmação do e-mail (pública) |
| POST   | `/auth/login`                      | Entra e grava o cookie de sessão (pública)                     |
| GET    | `/auth/sessao`                     | Dados da sessão atual                                          |
| POST   | `/auth/sair`                       | Encerra todas as sessões do usuário                            |
| POST   | `/auth/senha/esqueci`              | Envia o link para redefinir a senha (pública)                  |
| POST   | `/auth/senha/redefinir`            | Grava a senha nova a partir do link (pública)                  |
| POST   | `/auth/email/confirmar`            | Confirma o e-mail a partir do link (pública)                   |
| POST   | `/auth/email/reenviar`             | Reenvia o link de confirmação (pública)                        |
| POST   | `/auth/email/corrigir`             | Corrige o e-mail de uma conta ainda não confirmada (pública)   |
| GET    | `/disciplinas`                     | Lista as disciplinas                                           |
| POST   | `/disciplinas`                     | Cadastra uma disciplina (monitor)                              |
| GET    | `/disciplinas/:id/ranking`         | Ranking de pontos da disciplina                                |
| POST   | `/monitorias`                      | Cria uma vaga (monitor)                                        |
| GET    | `/monitorias/:idDisciplina`        | Vagas de uma disciplina                                        |
| GET    | `/monitorias/monitor/agendamentos` | Inscrições nas vagas do monitor                                |
| PATCH  | `/monitorias/:id`                  | Edita uma vaga ativa (monitor)                                 |
| PUT    | `/monitorias/:id/cancelar`         | Cancela uma vaga (monitor)                                     |
| POST   | `/monitorias/:id/espera`           | Entra na lista de espera de uma vaga lotada                    |
| PATCH  | `/monitorias/:id/finalizar`        | Registra o término da sessão (monitor)                         |
| POST   | `/agendamentos`                    | Inscreve o aluno numa vaga                                     |
| GET    | `/agendamentos`                    | Inscrições do usuário                                          |
| DELETE | `/agendamentos/:id`                | Cancela uma inscrição (RN-001) ou sai da lista de espera       |
| PATCH  | `/agendamentos/:id/presenca`       | O aluno confirma que a sessão aconteceu                        |
| PATCH  | `/agendamentos/:id/concluir`       | O monitor confirma a presença do aluno (monitor)               |
| PATCH  | `/agendamentos/:id/ausencia`       | O monitor marca que o aluno faltou (monitor)                   |
| GET    | `/perfil`                          | Dados do perfil                                                |
| GET    | `/perfil/agendamentos`             | Inscrições exibidas no perfil                                  |
| GET    | `/perfil/monitorias`               | Vagas exibidas no perfil do monitor                            |
| GET    | `/perfil/restricao`                | Bloqueio de novas inscrições por faltas (ou `null`)            |
| DELETE | `/perfil`                          | Exclui (anonimiza) a conta, com confirmação da senha           |
| GET    | `/pontos/extrato`                  | Extrato de pontos do usuário                                   |
| GET    | `/certificados/elegibilidade`      | Horas do semestre e se a declaração pode ser emitida (monitor) |
| GET    | `/certificados`                    | Declarações emitidas (monitor)                                 |
| POST   | `/certificados`                    | Emite a declaração do semestre (monitor)                       |
| GET    | `/certificados/:codigo`            | Abre uma declaração                                            |
| GET    | `/certificados/verificar/:codigo`  | Confere a situação de uma declaração (pública)                 |

Um prefixo novo na API também precisa entrar no Nginx do servidor (homologação e produção) e
em `e2e/pilha/gateway.conf`. Sem isso, o caminho cai no frontend.

## Fluxo de trabalho e deploy

1. Cada mudança sai de uma branch criada a partir da `develop` e volta por pull request.
2. Em todo PR para `develop` ou `main`, o CI roda os testes com cobertura, o lint, a
   auditoria de dependências de produção (barra vulnerabilidades altas e críticas), a
   integração com PostgreSQL real e os testes E2E (`.github/workflows/`).
3. O merge na `develop` publica a homologação (`deploy-develop.yml`). O merge da `develop` na
   `main` publica a produção (`deploy.yml`).
4. Os dois deploys repetem os testes e o lint, reconstroem as imagens e aplicam as migrações
   (`prisma migrate deploy`) antes de trocar os containers. Se uma migração falhar, os
   containers em uso não são trocados.

Mescle um PR de cada vez. Dois merges seguidos na `develop` disparam deploys simultâneos, e o
segundo falha ao recriar os containers.

## Documentação e evidências

- `docs/evidencias/`: registro de cada fase, com testes, DAST, LGPD, deploy e o incidente do
  deploy #64.
- Documento de Especificação do Projeto Integrador: requisitos, regras de negócio, casos de
  teste e decisões. É entregue à parte, fora do repositório.
