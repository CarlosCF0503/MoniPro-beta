# Regra de faltas

> MoniPro · plano 12 de 14

O aluno que se inscreve e não aparece tira o lugar de outro. Não há nenhuma consequência, e o monitor não tem como registrar a ausência.

## Situação (registrada em 22/11/2026)

Implementado no PR #94, em produção pelo release #95 (19/11/2026), com os números propostos (3 faltas em 30 dias, 7 dias de bloqueio). O monitor desfaz a falta em até 7 dias; a coordenação e o recurso com atestado entraram com o plano 7 (PRs #106 e #107). Especificação v7.3: RN-016.

## Ficha

| Item       | Valor                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Prioridade | P3                                                                          |
| Risco      | Alto                                                                        |
| Esforço    | 2 a 3 dias                                                                  |
| Trilha     | Revisão de design + testes de autorização                                   |
| Depende de | Marcação explícita de ausência pelo monitor (hoje ele só confirma presença) |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Marcar com bloqueio temporário.

## Requisitos para a especificação

- **RN-016 (nova):** 3 ausências marcadas pelo monitor em 30 dias bloqueiam novas inscrições por 7 dias. Inscrições já feitas continuam valendo.
- **RF (complemento):** Ao finalizar a sessão, o monitor marca cada inscrito como presente ou ausente. Ausência pode ser contestada pelo aluno em até 7 dias (vai para a coordenação, plano 7).

## Decisões do time antes de começar

- Se o time aceita a regra: ela pune o aluno e precisa estar clara no cadastro e no aviso.
- Números finais (3 faltas, 30 dias, 7 dias de bloqueio).
- Cancelar com menos de 24h conta como falta? (recomendado: não, a RN-001 já impede).

## Modelo de dados

```
model Agendamento {
  // ...
  ausente_em DateTime?   // marcado pelo monitor ao finalizar; exclui presenca_monitor_em
}
// Bloqueio calculado na hora (contagem de ausente_em nos últimos 30 dias), sem tabela própria.
```

## API

| Método | Rota                         | Acesso               | Resposta                                     |
| ------ | ---------------------------- | -------------------- | -------------------------------------------- |
| PATCH  | `/agendamentos/:id/ausencia` | Monitor dono da vaga | marca ausência depois do horário             |
| GET    | `/perfil/restricao`          | Aluno                | null ou { ate, faltas }                      |
| POST   | `/agendamentos`              | Aluno                | 423 com a data de liberação quando bloqueado |

## Telas e arquivos

| Arquivo                                     | O que muda                                                     |
| ------------------------------------------- | -------------------------------------------------------------- |
| `marcar_monitoria.html (JS/marcar/tela.js)` | aviso com a data de liberação e as faltas, agendamento travado |
| `perfil_monitor.html`                       | Presente / Ausente na lista de inscritos ao finalizar          |

## Etapas

1. Migração de ausente_em.
2. Monitor marca ausência no mesmo diálogo de presenças do P2.
3. Função calcularRestricao(ausencias, agora) testada.
4. agendamentoService.criar barra com 423.
5. Texto da regra no cadastro e no aviso de privacidade.
6. Telas (prévia aprovada).

## Testes

- 3 faltas em 31 dias não bloqueiam.
- 3 faltas em 30 dias bloqueiam por 7 dias exatos.
- Presença e ausência na mesma inscrição: 409.
- Bloqueado tenta agendar: 423; inscrição antiga segue ativa.

## Segurança e LGPD

Ausência é dado de comportamento: guardar só a data, apagar depois de 180 dias no scripts/retencao.js e permitir contestação.

## Critério de pronto

Quem falta repetidamente para de tirar lugar dos outros, sabe por quê e até quando.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
