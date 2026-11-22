# Editar a vaga

> MoniPro · plano 2 de 14

O monitor só pode cancelar uma vaga. Se a sala mudar ou ele errar o horário, a única saída é cancelar e criar outra, e os inscritos perdem a inscrição.

## Situação (registrada em 22/11/2026)

Implementado no PR #71, em produção pelo release #75 (12/11/2026). A janela de 24 horas para dia e horário foi mantida; fora da janela a API responde 400 (convenção do código), e não 422. O aviso por e-mail aos inscritos entrou com o plano 3. Especificação v7.3: RF-009, RN-010 e ajuste da RN-001.

## Ficha

| Item       | Valor                                                                                 |
| ---------- | ------------------------------------------------------------------------------------- |
| Prioridade | P1                                                                                    |
| Risco      | Médio                                                                                 |
| Esforço    | 2 a 3 dias                                                                            |
| Trilha     | Testes de regra + revisão                                                             |
| Depende de | Plano 3 para avisar os inscritos (sem ele, a edição funciona e o aviso fica pendente) |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Perfil do monitor com Editar.

## Requisitos para a especificação

- **RF-009 (novo):** O monitor dono da vaga pode alterar dia, horário, local, lugares e assunto de uma vaga ativa e futura.
- **RN-010 (nova):** Dia e horário só mudam até 24h antes do início; local, lugares e assunto, até o início. Lugares nunca ficam abaixo do número de inscritos.
- **RN-001 (ajuste):** Se dia, horário ou local mudarem, o aluno inscrito pode cancelar sem a regra das 24h.

## Decisões do time antes de começar

- Confirmar a janela de 24h para dia e horário (é a mesma do cancelamento, o que facilita explicar).

## Modelo de dados

```
// Sem tabela nova. Agendamento ganha um campo para liberar o cancelamento fora do prazo:
model Agendamento {
  // ...
  liberado_cancelar_em DateTime?  // preenchido quando a vaga muda de dia, horário ou local
}
```

## API

| Método | Rota              | Acesso                   | Resposta                                                                                |
| ------ | ----------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| PATCH  | `/monitorias/:id` | isMonitor e dono da vaga | 200 com a vaga; 403 outro monitor; 409 lugares abaixo dos inscritos; 422 fora da janela |

## Telas e arquivos

| Arquivo                | O que muda                                                               |
| ---------------------- | ------------------------------------------------------------------------ |
| `perfil_monitor.html`  | botão Editar em Próximas e nos detalhes do celular, diálogo de edição    |
| `JS/perfil/monitor.js` | abrirEditar, validação local e aviso de quantos inscritos serão avisados |
| `JS/perfil/dados.js`   | normalizar passa a trazer a descrição                                    |

## Etapas

1. Schema zod de atualização parcial em monitoriaSchemas.js (todos os campos opcionais, horário no futuro).
2. monitoriaService.atualizar: confere dono, status ativa, janela de 24h para horário, lugares >= inscritos (dentro de uma transação, contando inscrições não canceladas).
3. Se dia, horário ou local mudaram: marcar liberado_cancelar_em nos agendamentos e enfileirar o e-mail "vaga alterada" (plano 3).
4. agendamentoService.cancelar passa a aceitar liberado_cancelar_em como exceção da RN-001.
5. Tela (prévia aprovada).

## Testes

- Outro monitor edita: 403.
- Lugares abaixo dos inscritos: 409.
- Mudar horário com 23h de antecedência: 422; mudar só o local no mesmo momento: 200.
- Vaga cancelada ou realizada: 422.
- Depois de mudar o local, o aluno cancela com 2h de antecedência: 200.
- Integração: duas edições simultâneas de lugares não deixam a vaga abaixo dos inscritos.

## Segurança e LGPD

Nada novo. A edição fica registrada no log do servidor com id da vaga e do monitor, sem dados dos alunos.

## Critério de pronto

O monitor corrige uma vaga sem cancelá-la, e quem já estava inscrito fica sabendo da mudança e pode sair sem penalidade.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
