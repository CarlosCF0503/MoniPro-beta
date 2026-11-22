MoniPro · Projeto Integrador · 7º período

# Plano de implementação da Fase 03

## Situação (registrada em 22/11/2026)

Executado entre 04/11 e 08/11/2026 e em produção pelo PR #70 (08/11/2026), exceto a avaliação de usabilidade (pendente) e o contato do controlador no Aviso de Privacidade (decisão D4). A situação de cada item está na Tabela 7.1 da especificação.

Este plano responde ao feedback da Fase 02 (nota 12,0/12,0, avaliação de 03/11/2026, orientador Wosney Ramos de Souza). Ele cobre os quatro **pontos a melhorar** e as três **recomendações para a próxima fase**. Cada item foi conferido no código da branch atual antes de ser planejado.

7 itens 4 pontos a melhorar 3 recomendações Situação conferida em 07/11/2026 Atualizado em 08/11/2026: P1 pronto (#54, \#55, evidências no \#56); P2 na develop (#57); P3 em revisão (#61 e \#62); www no \#60, falta o DNS

## Resumo

Os prazos são estimativas em dias de trabalho de uma pessoa. A coluna "Depende de" mostra por que a ordem importa: quase tudo que grava dados ou roda no navegador espera a separação dos bancos (P1).

| Item               | Tipo             | O que entrega                                                                 | Situação hoje                                                                                                                                                                                                                                                                                                                                              | Depende de                       | Estimativa |
| ------------------ | ---------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------- |
| **P1** R12         | Ponto a melhorar | Banco de homologação separado do de produção; registros \[TESTE\] removidos   | Pronto bancos separados, \[TESTE\] removidos, hml só com dados fictícios e T16 invertido ok (#41, \#54, \#55; evidências no \#56). Falta atualizar o documento.                                                                                                                                                                                            | Nenhum                           | 3–4 d      |
| **P2** R4          | Ponto a melhorar | Conclusão da sessão feita pelo monitor, só depois do horário                  | Testado em hml [PR \#57](https://github.com/CarlosCF0503/MoniPro-beta/pull/57). Em 08/11, pelas telas: o aluno confirmou, ficou aguardando, o monitor confirmou e entraram +10 e +2. Falta a ida para a main                                                                                                                                               | P1 (testes em hml)               | 2–3 d      |
| **P3** R7          | Ponto a melhorar | Sessão em cookie httpOnly, validade curta e revogação no logout               | Testado em hml [\#61](https://github.com/CarlosCF0503/MoniPro-beta/pull/61) e [\#62](https://github.com/CarlosCF0503/MoniPro-beta/pull/62) na develop, com [\#63](https://github.com/CarlosCF0503/MoniPro-beta/pull/63) (Cache-Control). Cookie HttpOnly/Secure/Strict, revogação no sair e 403 de outra origem conferidos na hml. Falta a ida para a main | P1                               | 3–4 d      |
| **P4** Evidências  | Ponto a melhorar | Arquivo de evidências da seção 24.3 publicado no repositório                  | Pronto [PR \#52](https://github.com/CarlosCF0503/MoniPro-beta/pull/52) aberto, CI passou                                                                                                                                                                                                                                                                   | Nenhum                           | 0,5 d      |
| **P5** Disciplinas | Ponto a melhorar | Tela de cadastro de disciplinas; testes de RF-004, RN-006 e ranking           | Pronto branch `feat/tela-cadastro-disciplinas`, falta o PR                                                                                                                                                                                                                                                                                                 | Nenhum (tela); P1 (teste manual) | 3–4 d      |
| **R1** E2E         | Recomendação     | CT-01 a CT-11 no Playwright; testes de integração com PostgreSQL em contêiner | Não iniciado                                                                                                                                                                                                                                                                                                                                               | P1, P2, P3, P5                   | 5–6 d      |
| **R2** Usabilidade | Recomendação     | Avaliação de usabilidade no sistema integrado                                 | Não iniciado última foi nos protótipos do 2º período                                                                                                                                                                                                                                                                                                       | P1, P5                           | 3 d        |
| **R3** LGPD        | Recomendação     | Aviso de privacidade publicado e prazo de retenção aplicado                   | Não iniciado                                                                                                                                                                                                                                                                                                                                               | P1 (rotina de retenção)          | 2 d        |

## Ordem de execução

A onda 0 vem primeiro porque o orientador a marcou como **IMPORTANTE** e porque ela trava as demais. Dentro de cada onda, os itens podem correr em paralelo entre pessoas diferentes.

Onda 0 · bloqueiaSeparar os bancos

- P1: hml e prod em containers (#41 ✓)
- P1: SSL, seed e script de limpeza (#54, \#55 ✓)
- P1: limpar \[TESTE\] em prod ✓
- P1: recriar a hml com o seed ✓
- P4: publicar evidências (independente, rápido)

Onda 1 · segurançaRiscos R4 e R7

- P2: conclusão pelo monitor (implementado)
- P3: cookie httpOnly e revogação (implementado)

Onda 2 · coberturaLacunas de teste

- P5: tela de disciplinas
- P5: testes RF-004, RN-006, ranking
- R1: integração com Postgres real
- R3: aviso e retenção

Onda 3 · sistemaValidar de ponta a ponta

- R1: Playwright CT-01 a CT-11
- R2: teste de usabilidade
- Atualizar o documento

R1 (Playwright) fica por último porque P2 e P3 mudam o fluxo de conclusão e o login. Escrever os testes de navegador antes disso obrigaria a reescrevê-los.

P1Ponto a melhorar · IMPORTANTE

## Separar homologação e produção (R12) e limpar os dados de teste

**Feedback:** "separar o banco de dados de homologação do de produção (R12) antes de qualquer novo teste que grave dados, e remover os registros \[TESTE\] do banco de produção."

#### Situação hoje

- `dev.moni-pro.app.br` e `moni-pro.app.br` usam o mesmo database no Aiven (`db_monipro`). No teste T16, um aluno criado em dev conseguiu entrar em produção.
- Em produção estão os usuários 25–27 ("\[TESTE\] …", `@teste.invalid`), a vaga 10 e o agendamento 6, criados pelos casos CT-08 a CT-11.
- A migração para dois containers (`postgres-prod` e `postgres-hml` na rede `monipro-net` do servidor Oracle) começou em 06/11.
- [bancoDeDados.js](MoniPro-beta-main/src/config/bancoDeDados.js) trata como produção qualquer URL com `aivencloud.com` e exige `DB_CA_CERT`.

#### O que fazer

1.  Terminar os dois containers, cada um com seu volume, usuário e senha. O usuário de hml não pode ter acesso ao banco de prod.
2.  Fazer o `pg_dump` do Aiven e restaurá-lo em `postgres-prod`. Em `postgres-hml`, rodar só `prisma migrate deploy` e um seed com dados fictícios.
3.  Em `bancoDeDados.js`, tirar a detecção por `aivencloud.com`. Manter o SSL obrigatório com o certificado do próprio container (o CN precisa ser igual ao nome do serviço, por exemplo `postgres-prod`).
4.  Apontar o `DATABASE_URL` do deploy da `develop` para `postgres-hml` e o da `main` para `postgres-prod`. Como o deploy faz `git reset --hard`, a mudança no compose vai por PR.
5.  Limpar os registros \[TESTE\] em `postgres-prod`, depois do corte (script abaixo). O Aiven fica parado e intocado por 7 dias, como cópia de volta.
6.  Criar `prisma/seed.js` com disciplinas, monitores e alunos marcados "\[FICTÍCIO\]" e vagas futuras. R1 e R2 usam esse mesmo seed.

### Limpeza dos registros \[TESTE\] em produção

Primeiro a consulta e só depois a exclusão, na ordem das chaves estrangeiras. Rodar dentro de uma transação, com backup feito antes. A consulta também pega registros de teste que não estejam na lista conhecida.

```
-- 1. Conferir (esperado: ids 25, 26, 27)
SELECT id, nome_completo, email, tipo_usuario FROM usuarios
 WHERE email LIKE '%@teste.invalid' OR nome_completo LIKE '[TESTE]%';

-- 2. Excluir na ordem das FKs
BEGIN;
CREATE TEMP TABLE alvo AS SELECT id FROM usuarios
 WHERE email LIKE '%@teste.invalid' OR nome_completo LIKE '[TESTE]%';
DELETE FROM agendamentos WHERE id_aluno IN (SELECT id FROM alvo)
   OR id_monitoria IN (SELECT id FROM monitorias WHERE id_monitor IN (SELECT id FROM alvo));
DELETE FROM monitorias WHERE id_monitor IN (SELECT id FROM alvo);
DELETE FROM usuarios WHERE id IN (SELECT id FROM alvo);
-- conferir as contagens (esperado: 1 agendamento, 1 monitoria, 3 usuários) antes de
COMMIT;
```

### Critério de aceite

- T16 invertido: uma conta criada em `dev.moni-pro.app.br` recebe **401** no login em `moni-pro.app.br`.
- A consulta 1 devolve zero linhas em `postgres-prod`, e o ranking da disciplina "algoritmos" não mostra nenhum aluno de teste.
- `prisma migrate status` está limpo nos dois bancos, sem migrações pendentes nem divergentes.
- O R12 aparece como "Mitigado" na Tabela 25 com a data, e a seção 20 traz o novo diagrama de implantação (dois bancos, rede interna).

### Feito até 08/11/2026

- **Containers (PR \#41, Carlos, 07/11):** serviço `db` (`postgres:17`, SSL com CA própria, volume `pgdata`) no `docker-compose.yml`, já na `main` e na `develop`. A separação ficou diferente do desenho acima, mas com o mesmo efeito: cada deploy sobe seu próprio compose (prod em `~/moni-pro-beta`; hml em `~/moni-pro-beta-develop`, projeto `monipro-dev`, porta 5433), com volume e banco separados. Não há rede `monipro-net` compartilhada.
- **Ajustes no código ([PR \#54](https://github.com/CarlosCF0503/MoniPro-beta/pull/54), contra a `develop`, CI e Semgrep passaram):**
    - `src/config/sslBanco.js`: saiu a detecção por `aivencloud.com`. O SSL validado com a `DB_CA_CERT` passa a ser obrigatório para todo banco fora de `localhost`, ou com `NODE_ENV=production`. Antes, hml no host `db` sem `NODE_ENV` conectava sem SSL.
    - `prisma/seed.js`: 5 disciplinas, 3 monitores e 5 alunos "\[FICTÍCIO\]" (`@ficticio.invalid`), 20 vagas futuras e 5 já realizadas com um inscrito cada. Só roda com `SEED_AMBIENTE=hml` ou `local`, para se houver usuários reais no banco, e a senha vem de `SEED_SENHA`.
    - `scripts/limpar-registros-teste.sql`: o script de limpeza acima, que por padrão só mostra o que apagaria e faz ROLLBACK. Só apaga com `-v confirmar=1`.
- **Testado contra um PostgreSQL 17 real com SSL e CA própria:** migrações num banco vazio, seed idempotente e recusando nos três casos, conexão recusada com a CA errada, login da API com as contas fictícias, e limpeza removendo exatamente 3 usuários, 1 vaga e 1 inscrição.
- **Ambiente local:** o `.env` de desenvolvimento apontava para a Aiven, então rodar o app localmente gravava no banco compartilhado. Agora ele usa um contêiner local (porta 5433) com o seed.
- **Achado fora do escopo:** o backend lista vagas `ativa` que já passaram e aceita inscrição nelas. Só a tela bloqueia dias passados. Fica para um PR separado.
- **Servidor (lido em 08/11):** o corte foi feito. Prod usa `db:5432/db_monipro` e hml usa `db:5432/db_monipro_dev`, cada um com volume e senha próprios. O `migrate status` está limpo nos dois, e nenhum `.env` aponta mais para a Aiven.
- **Em produção (PR \#55, 08/11):** o backend passou a conectar ao banco com TLS 1.3. Antes do \#55, a conexão era sem SSL, porque o código antigo só ligava o SSL para `aivencloud.com`.
- **Limpeza em prod (08/11):** backup feito e restaurado num banco descartável para conferir, simulação com ROLLBACK e, por fim, remoção dos usuários 25–27, da vaga 10 e do agendamento 6. Agora há 0 registros \[TESTE\] e nenhum agendamento sem vaga ou sem aluno.
- **T16 invertido:** a conta criada em `dev.moni-pro.app.br` recebe 201 no cadastro, 200 no login em hml e **401** em `moni-pro.app.br`.
- **Hml recriada (08/11, com o aval do time):** o banco tinha sido restaurado com o mesmo dump de prod e guardava os 28 usuários reais. Depois do backup, ele foi recriado vazio, com as migrações e o seed fictício. Agora são 8 contas fictícias e 0 usuários reais. As contas fictícias entram em hml (200) e não existem em prod (401).
- **Evidências:** `docs/evidencias/fase03/p1-r12/` ([PR \#56](https://github.com/CarlosCF0503/MoniPro-beta/pull/56)).
- **Falta:**
    - Atualizar o documento: R12 como "Mitigado" na Tabela 25 (PRs \#41, \#54, \#55) e o diagrama de dois bancos na seção 20.
    - Apagar o serviço da Aiven depois de 7 dias sem uso (a partir de 15/11).

P2Ponto a melhorar

## Conclusão da sessão confirmada pelo monitor (R4)

**Feedback:** "Tratar os riscos R4 (conclusão da sessão sem confirmação do monitor) \[…\], que afetam a integridade da pontuação."

#### Situação hoje

- `PATCH /agendamentos/:id/concluir` ([agendamentoRotas.js:14](MoniPro-beta-main/src/routes/agendamentoRotas.js#L14)) só exige token. O serviço confere se quem chama é o **aluno dono** e credita +10 a ele ([agendamentoService.js:72](MoniPro-beta-main/src/services/agendamentoService.js#L72)).
- Não há checagem de horário. O aluno pode concluir uma sessão que ainda não aconteceu e somar pontos.
- A crédito é idempotente graças ao `updateMany` condicional ([agendamentoRepository.js:95](MoniPro-beta-main/src/repositories/agendamentoRepository.js#L95)). Essa parte continua valendo.
- Nenhuma tela do frontend chama essa rota hoje. A mudança no backend não quebra o uso atual.

#### O que fazer

1.  Trocar o dono da ação: a rota passa a exigir `isMonitor`, e o serviço confere se `monitoria.id_monitor === req.usuario.id`.
2.  Recusar com **400** quando `agora < monitoria.horario` (a mensagem informa a partir de quando é possível confirmar).
3.  No repositório, manter a transação e o `updateMany` condicional, mas filtrar pelo monitor da vaga e creditar os pontos conforme a decisão D1.
4.  No perfil do monitor ([perfil/monitor.js](MoniPro-beta-main/Monipro_web/JS/perfil/monitor.js)), colocar o botão "Confirmar presença" em cada inscrito de vaga já passada, com o estado "Confirmada" depois.
5.  Regra de prazo (D1): o monitor pode confirmar até 7 dias depois da sessão. Passado esse prazo, o agendamento continua pendente e não gera pontos.

### Testes (Jest + Supertest)

- Os três testes de autorização por rota que o grupo adotou como processo: sem token (401), aluno chamando (403) e monitor de outra vaga (403).
- Antes do horário (400), agendamento cancelado (400), já concluído (400) e sucesso (200, com pontos creditados uma única vez).
- Atualizar a linha da RN-008 e do R4 na matriz de rastreabilidade (Tabela 24.2).

### Feito em 08/11/2026

- **D1 revisada:** a presença vale com duas confirmações, a do aluno e a do monitor. Só com as duas entram os pontos (+10 monitor, +2 aluno), e cada lado tem 7 dias depois do horário. Se só o monitor confirmasse, ele ganharia +10 por presença marcada e poderia confirmar quem faltou.
- **Confirmação dos dois lados** (`00e9ffd`): o monitor confirma em `PATCH /agendamentos/:id/concluir` e o aluno em `PATCH /agendamentos/:id/presenca`. As colunas novas `presenca_aluno_em` e `presenca_monitor_em` guardam cada confirmação, e quem confirma por último conclui. A inscrição fica travada (`SELECT … FOR UPDATE`) durante a confirmação. No Postgres local, aluno e monitor confirmando ao mesmo tempo concluíram e pontuaram uma vez só. As telas do monitor e do aluno estão nas prévias do monitor e do aluno e só entram nos commits depois da aprovação.
- Quatro commits na branch `feat/p2-conclusao-pelo-monitor`, a partir da `develop` e ainda sem push: `174f2b7`, `435c252`, `a519f6c` e `65ad63d`.
- **API:** `PATCH /agendamentos/:id/concluir` exige `isMonitor` e o monitor dono da vaga. A rota recusa com 400 antes do horário (a mensagem diz a partir de quando), depois de 7 dias, em vaga cancelada, em inscrição cancelada e em inscrição já confirmada. As regras ficam em `src/utils/regrasConclusao.js`. O crédito continua numa transação com o `updateMany` condicional, que agora filtra também pelo monitor da vaga.
- **Achado durante a implementação:** cancelar a vaga não muda o status das inscrições, então sem uma checagem própria o monitor conseguiria confirmar presença e somar pontos numa vaga cancelada. Corrigido em `435c252`.
- **Tela (perfil do monitor):** o diálogo de detalhes da vaga lista os inscritos com "Confirmar presença" e depois "Presença confirmada". As vagas com presenças pendentes ganham o botão na lista, a linha do celular avisa quantas faltam e um aviso acima das abas leva ao Histórico. As vagas já finalizadas ficam no Histórico, e sem o aviso o monitor não saberia que há confirmações pendentes.
- **Achado fora do escopo:** o `* { margin: 0 }` de `base.css` fazia os diálogos do perfil do monitor (detalhes, finalizar e cancelar) abrirem no canto superior esquerdo do computador. Corrigido em `65ad63d`.
- **Testes:** 189 no Jest (12 novos na rota, 5 nas regras da tela), incluindo os três de autorização (401, 403 do aluno e 403 de outro monitor), os limites do prazo e a corrida entre duas confirmações.
- **No Postgres 17 local:** 403, 400 e 404 conferidos, e duas confirmações simultâneas creditaram os pontos uma vez só (monitor +10, aluno +2). No Edge, contra a API local, 17 de 17 verificações passaram no computador e no celular (360 px, sem rolagem lateral).
- **Falta:** abrir o PR, fazer o teste manual em hml e atualizar o R4 e a RN-008 no documento. Observação: o ranking já lista só alunos com presença confirmada na disciplina, mas os ordena pelos pontos totais do aluno, somados em todas as disciplinas. Isso já era assim antes de P2.

P3Ponto a melhorar

## Sessão em cookie httpOnly, com revogação (R7)

**Feedback:** "Tratar os riscos \[…\] R7 (JWT no localStorage sem revogação), que afetam \[…\] a segurança das sessões."

#### Situação hoje

- O token é gerado com `expiresIn: '24h'` ([autenticacaoService.js:63](MoniPro-beta-main/src/services/autenticacaoService.js#L63)) e gravado em `localStorage.monipro_token` ([login.js:60](MoniPro-beta-main/Monipro_web/JS/login.js#L60)).
- O token é lido em 6 arquivos: `api.js`, `base.js`, `login.js`, `marcar/tela.js`, `perfil/monitor.js` e `perfil.js`.
- O "sair" só apaga o token do navegador. Uma cópia roubada continua válida até expirar.

#### O que fazer

1.  O `POST /auth/login` passa a responder com o cookie `monipro_sessao` (`HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=7200`), sem o token no corpo.
2.  Criar a coluna `versao_token Int @default(0)` em `usuarios`, levada dentro do JWT. O middleware confere a versão com o banco.
3.  O novo `POST /auth/sair` incrementa `versao_token` (o que invalida todas as sessões do usuário) e apaga o cookie.
4.  Novo `GET /auth/sessao`, usado pelas páginas para saber quem está logado (substitui a leitura de `monipro_usuario`).
5.  Para CSRF: `SameSite=Strict` mais a checagem de `Origin` nas requisições que alteram dados. No frontend, `fetch(..., { credentials: 'include' })` em `api.js`.
6.  Transição em dois PRs. No primeiro, o middleware aceita o cookie **ou** o Bearer. No segundo, que sai depois que o frontend publicado usar o cookie, o Bearer é removido.

### Critério de aceite

- Depois do login, `localStorage` não tem nenhum token, e o cookie aparece como HttpOnly nas ferramentas do navegador.
- Um token copiado antes do "sair" recebe 401 depois dele (novo teste).
- Uma requisição com `Origin` de outro site recebe 403 em `POST/PATCH/PUT/DELETE`.
- O teste dinâmico de segurança (T1–T16) foi repetido em hml, e a linha do R7 na Tabela 25 está atualizada.

### Feito em 08/11/2026

- **D2 adotada como recomendada:** cookie e JWT de 2 h, sem renovação silenciosa.
- **PR 1, branch `feat/p3-sessao-cookie`** (`dcfee91` na API e `562bd29` na tela):
    - O login grava o cookie `monipro_sessao` (`HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=7200`), e o JWT não leva mais o e-mail.
    - A migração `20261108180000_add_versao_token_usuario` cria a coluna `versao_token`, que vai no JWT como `v`. O middleware confere a versão com o banco a cada requisição.
    - `POST /auth/sair` incrementa a versão e apaga o cookie. `GET /auth/sessao` devolve `{ id, nome, tipo }`.
    - O CORS passa a aceitar credenciais. A checagem de `Origin` já existia, pela lista `ALLOWED_ORIGINS`, e agora tem testes nos quatro métodos.
    - Nenhuma página decodifica mais o JWT. `api.js` oferece `obterSessao()` e `encerrarSessao()` e apaga o token que versões antigas deixaram no `localStorage`. `base.html` não carregava `api.js` e passou a carregar.
    - Na transição, o middleware ainda aceita o Bearer e o login ainda devolve o token no corpo, para páginas antigas em cache.
- **PR 2, branch `feat/p3-remover-bearer`** (`2abcb37`, empilhada sobre a do PR 1): o middleware só aceita o cookie, o login não devolve o token no corpo e os testes de rota autenticam pelo cookie.
- **Testes:** 196 no Jest, 20 deles novos em `tests/sessao.test.js`: atributos do cookie, validade de 2 h, token adulterado, usuário removido, revogação, origem de outro site recebendo 403 nos quatro métodos e leitura do cookie.
- **No Postgres 17 local:** uma cópia do token recebe 401 depois do "sair", tanto pelo cookie quanto pelo Bearer, e um novo login volta a funcionar. No Edge, 23 de 23 verificações passaram: o cookie é HttpOnly, Secure e Strict, o `localStorage` fica vazio, o `document.cookie` não enxerga a sessão, e o login, as telas do aluno e do monitor e o sair funcionam.
- **Junto com P2:** o merge das três branches dá um conflito pequeno em `tests/agendamento.test.js`. A solução é ficar com a versão de P2 e trocar o Bearer pelo cookie. Com isso resolvido, passaram 208 testes no Jest e as duas verificações no Edge.
- **Falta:**
    - Abrir os PRs na ordem PR 1, depois PR 2 (depois que o PR 1 estiver publicado).
    - Conferir no servidor se `ALLOWED_ORIGINS` tem as origens de prod e de hml.
    - Repetir T1–T16 em hml e atualizar o R7 na Tabela 25.

P4Ponto a melhorar

## Publicar o arquivo de evidências da seção 24.3

**Feedback:** "Disponibilizar o 'arquivo de evidências' citado na seção 24.3 (link no repositório ou anexo), para que as requisições e respostas dos casos CT-08 a CT-11 possam ser consultadas."

#### Situação hoje

- Os arquivos existem, mas ficam fora do git, em `relatorios/evidencias-fase02-2026-10-12/`: `casos-de-teste-sistema/` (`ct08-ct11-dev.txt`, `ct08_ct11.mjs`, `ct11_reteste.mjs`), as pastas `apos-correcoes/` e `apos-pr27/`, além de `jest-saida.txt`, `coverage-summary.json`, `dast-dev.txt`, `runs.tsv` e `audit.json`.

### Ocultar antes de publicar

O repositório é público. `ct08-ct11-dev.txt` traz 3 JWTs completos, e `ct11_reteste.mjs` traz a senha das contas de teste escrita no código. Os tokens já expiraram e as contas saem em P1, mas o histórico do git guarda tudo para sempre.

Na cópia apareceram mais dois itens: o nome da máquina no log do Jest e o caminho local (com o nome de usuário do Windows) nos relatórios de cobertura.

#### O que fazer

1.  Copiar a pasta para `docs/evidencias/fase02/` no repositório. A pasta `docs/agentes/` está no .gitignore, mas `docs/evidencias/` não.
2.  Trocar cada token por `eyJ…[omitido]` e a senha por `process.env.SENHA_TESTE`. Conferir com `grep -rn "eyJ\|senha" docs/evidencias` e com o detect-secrets.
3.  Escrever um `README.md` com o índice: o que cada arquivo comprova, o caso (CT/T) e o requisito, o commit e o ambiente.
4.  Na seção 24.3 do documento, usar um link fixo para o commit (`…/tree/<sha>/docs/evidencias/fase02`) para que o link não mude depois.
5.  Daqui em diante, toda execução manual ou de API grava a evidência em `docs/evidencias/fase03/` já com os dados ocultados.

### Feito em 07/11/2026

- Commit `32d45cf` no [PR \#52](https://github.com/CarlosCF0503/MoniPro-beta/pull/52), contra a `develop`. CI e Semgrep passaram.
- Pasta `docs/evidencias/fase02/` com o `README.md` de índice. Ocultados: 3 tokens, a senha nos dois scripts (agora `process.env.SENHA_TESTE`), o nome da máquina e os caminhos locais (trocados por `<repo>`).
- A pasta ficou fora do ESLint e do Prettier, porque as evidências são registros fixos e não código do projeto.
- O detect-secrets acusou 74 "Hex High Entropy String" nos JSON do Jest. São os campos `hash` e `_coverageSchema` do Istanbul, não segredos, e foram registrados no `.secrets.baseline` local.
- Falta: depois do merge, colocar o link fixo para o commit na seção 24.3.

P5Ponto a melhorar

## Tela de cadastro de disciplinas e testes de RF-004, RN-006 e ranking

**Feedback:** "Concluir a interface de cadastro de disciplinas, pendente desde a Fase 01, e cobrir com testes o RF-004 (histórico), a RN-006 e o ranking."

#### Tela de disciplinas

- O backend está pronto: `POST /disciplinas` com `isMonitor` ([disciplinaRotas.js:6](MoniPro-beta-main/src/routes/disciplinaRotas.js#L6)), e o nome é único no schema.
- O desenho da tela já está em [Plano_Cadastro_Disciplinas_MoniPro.html](Plano_Cadastro_Disciplinas_MoniPro.html). Segui-lo, com o mesmo padrão das telas reescritas: computador e celular, toast e AA.
- Validar o corpo com um schema zod (hoje a rota não tem `validarCorpo`): nome com 3 a 80 caracteres, sem espaços sobrando, comparação sem diferenciar maiúsculas. O duplicado recebe 409.

#### Testes que faltam

| Alvo              | Casos                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| POST /disciplinas | 401 sem token, 403 aluno, 201, 409 duplicado, 400 nome inválido                                                 |
| Ranking           | 401, 404 disciplina inexistente, ordem por pontos, empate, lista vazia, não expõe e-mail nem matrícula          |
| RF-004 histórico  | `/perfil/agendamentos` e `/perfil/monitorias`: só os dados do dono, ordem, separação entre próximas e histórico |
| RN-006            | Mesmo e-mail como aluno e como monitor (201), e-mail+tipo repetido (409), matrícula+tipo repetida (409)         |

A RN-006 é testada como o sistema funciona hoje (perfis separados). Se a decisão D3 mudar o modelo, os testes mudam junto.

### Feito em 07/11/2026

- Cinco commits na branch `feat/tela-cadastro-disciplinas` (`c8cb355`, `d62c3dd`, `c37e4a3`, `ffc76be`, `9f698ad`), ainda não enviados ao GitHub. `npm test`: 172 testes passando (48 novos; eram 124).
- `POST /disciplinas` com `criarDisciplinaSchema` (3 a 80 caracteres, espaços repetidos juntados) e 409 para nome repetido sem diferenciar maiúsculas, inclusive na corrida entre duas criações (P2002).
- Ranking: 404 para disciplina inexistente e empate desfeito pelo nome. Nenhuma tela chama o ranking hoje, então a troca da lista vazia pelo 404 não quebra nada.
- RF-004 é testado no que o backend faz: dados só do dono do token, ordem decrescente e paginação. A separação entre próximas e histórico acontece na tela e já é coberta em `perfilDados.test.js`.
- Respostas no padrão do plano de disciplinas: 201 com `success: true`, 409 com o nome já salvo ("Cálculo I") e 403 do `isMonitor` como `{ success: false, erro }`, com a mensagem genérica "Acesso permitido apenas a monitores.".
- Tela `cadastro_disciplina.html` e botão "+ Nova disciplina" em Minhas Disciplinas, só para monitor, seguindo o [plano de disciplinas](Plano_Cadastro_Disciplinas_MoniPro.html). Depois do 201 a tela segue para criar a primeira vaga.
- Conferida no Edge com a API simulada: 20 de 20 verificações do checklist passaram (acesso do aluno, aviso de repetida, 400, 409, clique duplo, só teclado, 360 px sem rolagem lateral).
- Em 08/11 a branch rodou contra um PostgreSQL 17 real, num contêiner local descartável e isolado do `.env` (que aponta para o Aiven): 29 de 29 verificações de API e de tela passaram, incluindo RN-006 com as restrições únicas reais, o 409 sem diferenciar maiúsculas e o clique duplo gravando uma linha só.
- Esse teste achou um defeito que os mocks escondiam: com o `@prisma/adapter-pg`, o P2002 não traz `meta.target`, então o 409 vindo da unicidade do banco saía como "Registro duplicado", inclusive para e-mail e matrícula no cadastro. Corrigido em `9f698ad`, com os testes usando o formato real do erro. É um bom argumento para os testes de integração do R1.
- Falta: abrir o PR e o teste manual em hml (depois de P1).

R1Recomendação

## Testes no navegador (Playwright) e integração com PostgreSQL real

**Feedback:** "Implementar os testes de ponta a ponta no navegador (ex.: Playwright) para os casos CT-01 a CT-11 e alguns testes de integração com PostgreSQL real em contêiner, como o próprio grupo propôs."

#### Integração com Postgres (fazer primeiro)

- Novo projeto do Jest, `tests/integracao/*.int.test.js`, com `npm run test:int` rodando contra um banco de verdade (contêiner `postgres:17` como _service_ do GitHub Actions).
- Antes da suíte: `prisma migrate deploy` num banco vazio. Isso valida as migrações, que foram a origem do incidente da coluna `pontos`.
- Cenários que o mock não consegue provar:
    - duas conclusões simultâneas creditam os pontos uma única vez;
    - inscrições simultâneas na última vaga deixam passar só uma (capacidade);
    - as restrições únicas da RN-006;
    - a ordem de exclusão e as FKs (o mesmo caminho do script de limpeza de P1).
- Cada teste roda numa transação ou num schema próprio, e o banco é recriado a cada execução. Ele **nunca** aponta para hml nem para prod.

#### Playwright CT-01 a CT-11

- A pilha completa sobe em `docker-compose.e2e.yml` (db + backend + frontend), com o seed de P1.
- Pasta `e2e/`, com um arquivo por caso (`ct01-cadastro.spec.ts` …), usando seletores por papel e texto acessível em vez de classes CSS.
- Dois projetos: **Chromium no computador** e **celular** (Pixel 7), porque Marcar Monitoria e Perfil do Monitor têm layouts diferentes por tamanho de tela.
- As contas são criadas pela API em _fixtures_ com e-mail `@e2e.invalid` e nunca são reaproveitadas entre testes.
- CT-10 verifica no DOM que `<b>` aparece como texto. CT-11 confere a pontuação no perfil depois da confirmação do monitor (o novo fluxo de P2).
- O job `e2e` entra em `pull-request.yml`. Quando falha, guarda o trace e as capturas como artefato da execução, e isso vira a evidência da Fase 03 (P4).

### Critério de aceite

- Os 11 casos passam nos dois projetos (22 execuções) no CI de um PR.
- `npm run test:int` passa com o banco recriado do zero.
- A Tabela 24.1 mostra "Sistema" e "Integração com banco real" como automatizados, e a Tabela 24.3 tem uma coluna nova com o arquivo de teste.

R2Recomendação

## Avaliação de usabilidade no sistema integrado

**Feedback:** "Repetir a avaliação de usabilidade no sistema integrado, já que a última foi feita sobre os protótipos do 2º período."

#### Como conduzir

- **Participantes:** 5 alunos e 3 monitores reais do curso, sem ninguém da equipe. Cinco pessoas por perfil costumam revelar a maior parte dos problemas.
- **Ambiente:** hml com o seed fictício, nunca prod. Metade usa o celular e metade o computador.
- **Roteiro:** moderado, com o participante pensando em voz alta e de 20 a 25 minutos por pessoa.
- **Medidas:** taxa de sucesso por tarefa, tempo, erros e pedidos de ajuda, além do questionário SUS no final (meta: 68 ou mais).

#### Tarefas

| Perfil  | Tarefa                                           | CT      |
| ------- | ------------------------------------------------ | ------- |
| Aluno   | Criar conta e entrar                             | 01–03   |
| Aluno   | Marcar monitoria de algoritmos na próxima semana | 04–05   |
| Aluno   | Desistir de uma monitoria e ver a pontuação      | 06, 11  |
| Monitor | Cadastrar uma disciplina e criar uma vaga        | 07 + P5 |
| Monitor | Confirmar a presença de um aluno                 | P2      |

Entrega: um relatório curto com a comparação com o resultado dos protótipos do 2º período, os problemas classificados por gravidade (0–4, Nielsen) e as correções feitas ou planejadas. Ele entra como subseção nova na seção 16 ou 24.

R3Recomendação

## Aviso de privacidade e prazo de retenção (LGPD)

**Feedback:** "Publicar um aviso de privacidade e definir o prazo de retenção dos dados, completando o tratamento da LGPD."

#### Aviso de privacidade

- Página `Monipro_web/privacidade.html`, com link no rodapé de todas as páginas e no formulário de cadastro ("Ao criar a conta você declara ter lido o Aviso de Privacidade").
- Conteúdo:
    - quem controla os dados e como entrar em contato;
    - os dados tratados (nome, e-mail, matrícula, pontuação, agendamentos, registros de acesso com identificador mascarado);
    - a finalidade e a base legal (art. 7º);
    - os operadores (Oracle Cloud);
    - os prazos de retenção;
    - os direitos do titular (art. 18) e como exercê-los.
- Linguagem simples, com versão e data no topo.

#### Retenção (proposta para D4)

| Dado                 | Prazo    | Como                                              |
| -------------------- | -------- | ------------------------------------------------- |
| Conta sem acesso     | 12 meses | Aviso por e-mail, depois anonimização             |
| Agendamentos e vagas | 2 anos   | Anonimizar o aluno e manter os números do ranking |
| Logs da aplicação    | 90 dias  | Rotação no Docker (`max-size`, `max-file`)        |
| Backups do banco     | 30 dias  | Rotação do `pg_dump`                              |

Implementação: a coluna `ultimo_acesso` em `usuarios`, um script `scripts/retencao.js` agendado no servidor e uma opção "Excluir minha conta" no perfil.

## Decisões que a equipe precisa tomar

Estes pontos mudam regra de negócio ou arquitetura e por isso não devem ser decididos por uma pessoa só. O que está em cada linha é a recomendação deste plano.

| \#     | Pergunta                                                                          | Recomendação                                                                                                                                                                                                                                                                                                      | Afeta               |
| ------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **D1** | Quem ganha pontos na conclusão, quantos, e qual o prazo para o monitor confirmar? | Revisada em 08/11 A presença vale quando o aluno e o monitor confirmam, cada um do seu lado, em até 7 dias depois do horário. Com as duas confirmações, o monitor ganha +10 e o aluno +2. Só o monitor confirmando criava outro conflito de interesse, porque ele ganharia pontos por cada presença que marcasse. | P2, RN-008, ranking |
| **D2** | Validade da sessão e renovação                                                    | Adotada em 08/11 Cookie de 2 h sem renovação silenciosa. Depois disso o usuário entra de novo. É simples e basta para o uso em sala.                                                                                                                                                                              | P3                  |
| **D3** | RN-006: ajustar o modelo ou a regra?                                              | Revisar a regra no documento para refletir os perfis separados, que já funcionam e estão testados. Unificar a matrícula exigiria migrar os dados de produção.                                                                                                                                                     | P5, seção 13        |
| **D4** | Prazos de retenção e quem responde pelos dados                                    | Os prazos da tabela de R3. Validar com o orientador quem consta como controlador (a equipe ou a instituição).                                                                                                                                                                                                     | R3                  |

## Atualizações no documento de especificação

| Seção                | Mudança                                                                                                    | Vem de     |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| 20 Arquitetura       | Diagrama de implantação com dois bancos e a sessão em cookie                                               | P1, P3     |
| 13 Regras de negócio | RN-006 revisada (D3) e RN-008 com a confirmação do monitor (D1)                                            | P2, P5     |
| 24.1 / 24.2 / 24.3   | Novos níveis automatizados, a matriz sem lacunas em RF-004, RN-006 e ranking, e o link fixo das evidências | P4, P5, R1 |
| 25 Segurança         | R4, R7 e R12 como "Mitigado", com o PR e a data; o parágrafo de LGPD fechado                               | P1–P3, R3  |
| 16 ou 24             | Nova subseção com a avaliação de usabilidade no sistema integrado                                          | R2         |
| Parte 02 e histórico | Situação das atividades e a versão 8.0 com o resumo da Fase 03                                             | Todos      |

Plano montado a partir do feedback da Fase 02 (03/11/2026) e da leitura do repositório na branch `feat/perfil-monitor-redesign` (commit `877d13d`) em 07/11/2026. As estimativas são em dias de trabalho de uma pessoa e devem ser revistas depois das decisões D1–D4.
