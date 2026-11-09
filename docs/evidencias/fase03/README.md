# Evidências da Fase 03

Registros das execuções que comprovam os itens do plano da Fase 03, a resposta ao feedback da Fase 02 de 03/11/2026. Cada pasta tem um `README.md` com o índice dos arquivos, o que cada um comprova e o que foi ocultado.

| Pasta | Item do plano | Ambiente | Data |
|---|---|---|---|
| [`p1-r12/`](p1-r12/) | P1: separação de homologação e produção (R12) e limpeza dos registros `[TESTE]` | servidor, hml e prod | 08/11/2026 |
| [`p2-p3-hml/`](p2-p3-hml/) | P2: presença confirmada pelo aluno e pelo monitor (R4). P3: sessão em cookie com revogação (R7) | hml | 09/11/2026 |
| [`r1-testes/`](r1-testes/) | R1: CT-01 a CT-11 no navegador (Playwright) e testes de integração com PostgreSQL real | CI (GitHub Actions) e local | 09/11/2026 |
| [`r3-lgpd/`](r3-lgpd/) | R3: Aviso de Privacidade, exclusão da conta e retenção (LGPD) | hml, local e navegador | 09/11/2026 |
| [`deploy-producao/`](deploy-producao/) | Falha do deploy de produção do #64 e a correção do #68 | GitHub Actions e local | 08 e 09/11/2026 |

As evidências do P4 (publicação do arquivo da Fase 02) estão em [`../fase02/`](../fase02/).

## Regras para os registros

- Senhas, tokens (`eyJ…[omitido]`), segredos do `.env` e caminhos da máquina local (`<repo>`) são ocultados antes do commit.
- Os e-mails usam domínios `.invalid` (`@ficticio.invalid`, `@e2e.invalid`, `@integracao.invalid`, `@r3.invalid`), que não recebem mensagens.
- Testes que gravam dados rodam em hml ou em bancos descartáveis, nunca em produção.
