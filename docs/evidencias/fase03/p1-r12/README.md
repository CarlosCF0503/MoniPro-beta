# Evidências do P1 / R12: separação de homologação e produção (08/11/2026)

O item P1 do plano da Fase 03 responde ao feedback da Fase 02: separar o banco de homologação do de produção (risco R12) e remover os registros `[TESTE]` de produção.

## Índice

| Arquivo | O que comprova | Critério de aceite |
|---|---|---|
| `servidor-2026-11-08.txt` | Cada ambiente tem o próprio Postgres (database, volume e senha), nenhum aponta para a Aiven, as migrações estão em dia e a produção passou a conectar com TLS 1.3 depois do PR #55 | `migrate status` limpo nos dois bancos |
| `limpeza-producao.txt` | Backup conferido, simulação com ROLLBACK e remoção dos usuários 25 a 27, da vaga 10 e do agendamento 6 | Nenhum registro `[TESTE]` em produção e nenhum aluno de teste no ranking |
| `t16-invertido.txt` | Uma conta criada em `dev.moni-pro.app.br` entra em hml (200), mas recebe 401 em `moni-pro.app.br` | T16 invertido |

## PRs

- #41: containers Postgres no lugar da Aiven (`docker-compose.yml`)
- #54: SSL obrigatório fora de localhost, seed fictício e script de limpeza
- #55: leva o #54 para produção

## O que foi ocultado

Senhas, segredos do `.env`, a senha da conta do T16 e o token JWT (`eyJ…[omitido]`). Os e-mails das contas usam os domínios `@teste.invalid` e `@ficticio.invalid`, que não recebem mensagens.

## Observações

- No controle do T16, o nome aparece como `[FICT�CIO]` porque o terminal Windows que rodou o `curl` não enviou o corpo em UTF-8. Isso afeta só o nome dessa conta na hml.
- A homologação ainda tem cópia dos usuários de produção, porque foi criada com o mesmo dump. A recriação dela com o seed fictício é o último passo do P1.
