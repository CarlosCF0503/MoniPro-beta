# Lista de espera

> MoniPro · plano 8 de 14

Vaga lotada some para o aluno. Quando alguém cancela, o lugar fica livre sem que ninguém saiba, e a monitoria acontece com menos gente do que poderia.

## Situação (registrada em 22/11/2026)

Implementado no PR #90, em produção pelo release #91 (19/11/2026). Decisões: promoção automática; a fila tem no máximo tantas pessoas quantos lugares a vaga tem; promovido a menos de 24 horas do início pode cancelar até o horário. Especificação v7.3: RF-013 e RN-015.

## Ficha

| Item       | Valor                                     |
| ---------- | ----------------------------------------- |
| Prioridade | P3                                        |
| Risco      | Alto                                      |
| Esforço    | 3 dias                                    |
| Trilha     | Revisão de design + testes de autorização |
| Depende de | Plano 3 (e-mail "abriu um lugar")         |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Marcar com vaga lotada; E-mail "abriu um lugar".

## Requisitos para a especificação

- **RF-013 (novo):** Em vaga lotada, o aluno entra numa lista de espera e vê a própria posição.
- **RN-015 (nova):** Quando um inscrito cancela, o primeiro da fila é inscrito na hora e avisado por e-mail. A promoção não acontece com menos de 2h para o início. O aluno pode sair da fila a qualquer momento.

## Decisões do time antes de começar

- Promover automaticamente (recomendado, mais simples) ou oferecer o lugar com prazo para aceitar.

## Modelo de dados

```
enum StatusAgendamento { pendente confirmado concluido cancelado em_espera }

// Agendamento em_espera ocupa posição pela data de criação; não conta na capacidade.
// Índice para pegar o primeiro da fila:
// @@index([id_monitoria, status, criado_em])
```

## API

| Método | Rota                     | Acesso     | Resposta                                                                |
| ------ | ------------------------ | ---------- | ----------------------------------------------------------------------- |
| POST   | `/monitorias/:id/espera` | Aluno      | 201 com a posição; 409 já inscrito ou na fila; 422 vaga com lugar livre |
| DELETE | `/agendamentos/:id`      | Aluno dono | sair da fila                                                            |

## Telas e arquivos

| Arquivo                                                      | O que muda                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `marcar_monitoria.html (JS/marcar/componentes.js e tela.js)` | vaga lotada continua selecionável, botão Entrar na lista de espera, aviso da posição |
| `perfil_aluno.html`                                          | inscrição em espera aparece em Próximas com a posição e o botão Sair da fila         |

## Etapas

1. Migração do valor novo do enum e do índice.
2. agendamentoService.cancelar: na mesma transação, com SELECT ... FOR UPDATE na vaga, promover o primeiro em_espera e enfileirar o e-mail.
3. Contagem de capacidade ignora em_espera em todos os lugares (conferir monitoriaRepository e o ranking).
4. Telas (prévia aprovada).

## Testes

- Dois cancelamentos simultâneos promovem duas pessoas diferentes, sem passar da capacidade (teste de concorrência como o concorrencia.int.test.js).
- Cancelamento com 1h59 para o início não promove.
- A posição muda quando alguém da frente sai.
- Entrar na fila de vaga com lugar livre: 422.

## Segurança e LGPD

Nada novo além do e-mail do plano 3.

## Critério de pronto

Nenhum lugar liberado fica vazio enquanto houver alguém esperando, e a vaga nunca passa da capacidade.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
