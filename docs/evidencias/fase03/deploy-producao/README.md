# Deploy de produção do #64: falha e correção (08 e 09/11/2026)

O PR #64 levou a develop para a main em 08/11/2026, às 22h26 UTC, com P2, P3 e o Cache-Control. O deploy de produção falhou antes de trocar os containers, e produção ficou com o código anterior.

## Índice

| Arquivo | O que comprova |
|---|---|
| `falha-deploy-64.txt` | O deploy parou no passo `prisma migrate status`, que sai com código 1 quando há migração pendente. Com o `set -e`, o deploy não chegou ao `migrate deploy`, o passo que aplica as pendentes, nem ao `up -d`. O registro também mostra uma migração antiga no banco (`20260910120000_add_capacidade_monitoria`) que não existe mais no repositório |
| `simulacao-migracoes.txt` | Num banco descartável, montado igual ao de produção, o `migrate status` sai com 1 e o `migrate deploy` aplica as duas pendentes, mesmo com o registro antigo, saindo com 0 |

## Correção

PR #68: no `deploy.yml`, o `migrate status` passa a ser só informativo (o resultado não interrompe mais o deploy). Quem barra o deploy é o `migrate deploy`: se o banco recusar a conexão ou uma migração falhar, o `set -e` para antes de trocar os containers. A hml já funcionava assim.

## Situação

- **Em 09/11:** produção no ar com o código de antes do #64, sem perda de dados.
- **Próxima promoção para a main:** aplica três migrações, `versao_token` (P3), presença (P2) e `lgpd_retencao` (R3).
- **Registro antigo:** o registro antigo no banco de produção não impede o `migrate deploy` e pode ser limpo depois, com backup.
