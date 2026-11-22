# Documentos de planejamento

Planos escritos antes da implementação das funcionalidades do MoniPro no 7º período. Cada plano traz o problema, os requisitos propostos para a especificação, o modelo de dados, a API, as etapas, os testes e os cuidados de segurança e LGPD. As telas foram aprovadas em prévias navegáveis, que não estão publicadas aqui.

Os planos estão como foram aprovados. A seção **Situação**, no início de cada arquivo, diz o que foi implementado, em qual PR e o que mudou em relação ao plano. O comportamento atual do sistema está na especificação (v7.3, seções 13 e 14) e nos PRs citados.

## Outubro de 2026 (propostas de escopo)

| Documento                                                              | Data       | Assunto                                   | Resultado                                                                          |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| [Certificados e gamificação](2026-10-14-certificados-e-gamificacao.md) | 14/10/2026 | Presença confiável, pontos e certificados | Base das decisões de escopo de 17/10; substituído pelos planos 5 e de certificados |
| [Painel administrativo](2026-10-17-painel-administrativo.md)           | 17/10/2026 | Perfil Administrador                      | Refinado no plano 7                                                                |

## Fase 03, resposta ao feedback (novembro de 2026)

| Documento                                                                    | Data       | Assunto                                             | Resultado                                             |
| ---------------------------------------------------------------------------- | ---------- | --------------------------------------------------- | ----------------------------------------------------- |
| [Resposta ao feedback da Fase 02](2026-11-07-fase03-resposta-ao-feedback.md) | 07/11/2026 | R12, R4, R7, evidências, testes, LGPD e usabilidade | Em produção pelo PR #70 (08/11), exceto a usabilidade |
| [Tela Marcar Monitoria](2026-11-07-tela-marcar-monitoria.md)                 | 07/11/2026 | Reescrita da tela de agendamento                    | PR #44                                                |
| [Tela Perfil do Monitor](2026-11-07-tela-perfil-do-monitor.md)               | 07/11/2026 | Reescrita do perfil                                 | PRs #51 e #57                                         |
| [Cadastro de disciplinas](2026-11-07-cadastro-de-disciplinas.md)             | 07/11/2026 | Tela e regras do cadastro                           | PR #53                                                |

## Novas funcionalidades (11/11 a 22/11/2026)

| Plano                                                                     | Requisitos             | Implementação                          | Release          |
| ------------------------------------------------------------------------- | ---------------------- | -------------------------------------- | ---------------- |
| [1 – Recuperar senha](2026-11-11-plano-01-recuperar-senha.md)             | RF-008, RN-009         | #72, #73, #74                          | #75              |
| [2 – Editar a vaga](2026-11-11-plano-02-editar-vaga.md)                   | RF-009, RN-010         | #71                                    | #75              |
| [3 – Notificações por e-mail](2026-11-11-plano-03-notificacoes-email.md)  | RF-010, RN-011         | #78                                    | #79              |
| [4 – Declaração de horas](2026-11-11-plano-04-declaracao-de-horas.md)     | RF-005, RN-012         | substituído pelo plano de certificados | —                |
| [Emissão de certificados](2026-11-11-emissao-certificados.md)             | RF-005, RN-012         | #83, #84, #85, #87, #88                | #89              |
| [5 – Extrato e ranking](2026-11-11-plano-05-extrato-e-ranking.md)         | RF-011, RN-008         | #80, #81                               | #82              |
| [6 – Avaliação do monitor](2026-11-11-plano-06-avaliacao-do-monitor.md)   | RF-006, RF-007, RN-013 | #109                                   | #110             |
| [7 – Painel da coordenação](2026-11-11-plano-07-painel-da-coordenacao.md) | RF-012, RN-014         | #102 a #107, #116                      | #105, #108, #117 |
| [8 – Lista de espera](2026-11-11-plano-08-lista-de-espera.md)             | RF-013, RN-015         | #90                                    | #91              |
| [9 – Vagas recorrentes](2026-11-11-plano-09-vagas-recorrentes.md)         | RF-014                 | #100                                   | #101             |
| [10 – Adicionar à agenda](2026-11-11-plano-10-agenda-ics.md)              | RF-015                 | #96                                    | #97              |
| [11 – Monitoria on-line](2026-11-11-plano-11-monitoria-online.md)         | RF-016                 | #92                                    | #93              |
| [12 – Regra de faltas](2026-11-11-plano-12-regra-de-faltas.md)            | RN-016                 | #94                                    | #95              |
| [13 – Busca e filtros](2026-11-11-plano-13-busca-e-filtros.md)            | RF-017                 | #98                                    | #99              |
| [14 – Confirmar o e-mail](2026-11-11-plano-14-confirmar-email.md)         | RF-018, RN-017         | #76                                    | #77              |

A ordem de implementação seguiu as dependências: primeiro a base de e-mail (planos 1, 14 e 3), depois a pontuação e os certificados (plano 5 e plano de certificados), a coordenação e as regras que dependem dela (planos 7, 6, 8, 11 e 12) e, em paralelo, os planos independentes (10, 13 e 9). As decisões da equipe estão na Tabela 7.4 da especificação.
