# Evidências do RF-005: declaração de horas de monitoria (17/11/2026)

Execuções que comprovam o plano de certificados (5 PRs): as horas que contam, a emissão da declaração pelo monitor, a verificação pública pelo código e a revogação pelo script `scripts/certificados.js`.

## Índice

| Arquivo | O que comprova | Critério de aceite |
|---|---|---|
| `e2e-playwright-local.txt` | Os casos CT-01 a CT-13 no navegador, no computador e no celular: **34 de 34**. CT-12 e CT-13 são novos | CT-12 e CT-13 passam nos dois projetos, sem quebrar CT-01 a CT-11 |
| `integracao-postgres-local.txt` | Os testes de certificados contra o PostgreSQL real: horas, emissão simultânea, substituição, nome congelado, verificação depois da exclusão da conta e revogação (**12 de 12**) | Uma única declaração válida por semestre, mesmo com pedidos simultâneos; revogação gravada uma vez só |
| `unitarios-local.txt` | Os testes de unidade e de API de certificados e do R14 (**45 de 45**) | Campos mínimos na verificação, limite por IP (429), validações do script |
| `script-revogacao-e2e.txt` | O script rodado no container do backend da pilha descartável: uso, código mal formado, código inexistente, motivo curto, simulação, revogação, verificação antes e depois e a segunda tentativa recusada | Sem `--aplicar` nada muda; com `--aplicar` grava data e motivo, registra no log e a verificação mostra "Revogada" na hora |

## Onde está cada caso

| Caso | Requisito | Arquivo de teste |
|---|---|---|
| CT-12: emitir e abrir a declaração (computador e celular) | RF-005 | `e2e/ct12-ct13-certificados.spec.js` |
| CT-13: verificar sem login, antes e depois da revogação | RF-005 | `e2e/ct12-ct13-certificados.spec.js` |
| Horas, emissão, verificação e revogação com Postgres real | RF-005 | `tests/integracao/certificados.int.test.js` |
| R14, elegibilidade, emissão, verificação e revogação | RF-005, R14 | `tests/r14.test.js`, `tests/certificados.test.js`, `tests/verificacao.test.js`, `tests/revogacao.test.js` |

## Ambientes

- **Playwright:** a pilha descartável `docker-compose.e2e.yml` (a mesma da evidência `r1-testes/`). O CT-13 roda o script de revogação com `docker compose exec` no container do backend, como no servidor.
- **Integração:** PostgreSQL 17 local, banco `monipro_integracao`, recriado a cada execução.
- **CI:** os mesmos testes rodam no workflow "Testes de ponta a ponta" e no job de integração de cada PR.

## PRs

- #83: R14 (horário passado) e teto de 4h por sessão.
- #84: regra das horas e elegibilidade.
- #85: modelo `Certificado`, emissão e `certificado.html`.
- #87: verificação pública e `verificar.html`.
- PR 5 (este): revogação por script, CT-12, CT-13 e estas evidências.

## O que foi ocultado

Os códigos de verificação no registro do script (`<código>`), mesmo sendo de um banco descartável. Os nomes são de contas fictícias `@e2e.invalid`.
