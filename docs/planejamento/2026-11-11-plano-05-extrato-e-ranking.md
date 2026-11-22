# Extrato de pontos e ranking por disciplina

> MoniPro · plano 5 de 14

Usuario.pontos é um contador sem histórico: não dá para auditar, estornar nem separar por disciplina. O ranking de uma disciplina usa os pontos de todas, então quem pontua em Cálculo aparece no topo de Física.

## Situação (registrada em 22/11/2026)

Implementado nos PRs #80 e #81, em produção pelo release #82 (16/11/2026). Decisões: o ranking zera a cada semestre civil (jan–jun e jul–dez); a regra de pontos D1 foi mantida (monitor +10 por presença confirmada pelos dois lados, não por sessão). Especificação v7.3: RF-011 e revisão da RN-008.

## Ficha

| Item       | Valor                                                      |
| ---------- | ---------------------------------------------------------- |
| Prioridade | P2                                                         |
| Risco      | Alto                                                       |
| Esforço    | 3 a 4 dias                                                 |
| Trilha     | Revisão de design + testes de autorização                  |
| Depende de | Nenhuma (corrige D3 e D4 do plano de gamificação de 14/10) |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Extrato no perfil do aluno; Ranking de monitores.

## Requisitos para a especificação

- **RN-008 (revisada):** Cada ganho de pontos vira um evento com disciplina e motivo. O saldo é a soma dos eventos. Monitor +10 por sessão realizada com presença dupla; aluno +2 por presença dupla.
- **RF-011 (novo):** O usuário vê o extrato dos próprios pontos.
- **Ranking (ajuste):** O ranking é por disciplina e por semestre, mostra só monitores, e o aluno vê apenas a própria posição.

## Decisões do time antes de começar

- Se o ranking zera a cada semestre (recomendado) ou acumula.

## Modelo de dados

```
enum TipoEventoPontuacao { presenca_aluno sessao_monitor saldo_inicial estorno }

model EventoPontuacao {
  id                 Int                 @id @default(autoincrement())
  id_usuario         Int
  usuario            Usuario             @relation(fields: [id_usuario], references: [id], onDelete: Cascade)
  tipo               TipoEventoPontuacao
  pontos             Int
  id_disciplina      Int?
  periodo            String              // "2026.2"
  chave_idempotencia String              @unique  // "presenca:agendamento:42"
  criado_em          DateTime            @default(now())

  @@index([id_usuario])
  @@index([id_disciplina, periodo])
  @@map("eventos_pontuacao")
}
```

## API

| Método | Rota                       | Acesso | Resposta                                                 |
| ------ | -------------------------- | ------ | -------------------------------------------------------- |
| GET    | `/pontos/extrato`          | Logado | saldo, eventos e posição do próprio aluno                |
| GET    | `/disciplinas/:id/ranking` | Logado | só monitores, somando eventos do período e da disciplina |

## Telas e arquivos

| Arquivo                                  | O que muda                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `perfil_aluno.html / JS/perfil/aluno.js` | cartão Pontos vira extrato, com a posição privada e link para o ranking |
| `ranking.html (nova)`                    | escolha da disciplina e lista de monitores com pontos, sessões e horas  |

## Etapas

1. Migração da tabela e de um evento saldo_inicial por usuário com o valor atual de pontos (para o saldo não mudar).
2. Trocar concluirEIncrementarPontos em agendamentoRepository por criar os eventos dentro da mesma transação; a chave única garante idempotência.
3. Usuario.pontos continua como cache atualizado na mesma transação (para não reescrever as telas de uma vez). Remover numa versão seguinte.
4. buscarRankingPorDisciplina passa a somar eventos por disciplina e período.
5. Extrato e página de ranking (prévias aprovadas).

## Testes

- Confirmar a mesma presença duas vezes cria um evento só.
- Pontos em Cálculo não aparecem no ranking de Física.
- A soma dos eventos é igual a Usuario.pontos depois da migração.
- O ranking não lista alunos.
- O extrato de outro usuário não é acessível.

## Segurança e LGPD

Exclusão da conta apaga os eventos (cascade) e tira a pessoa do ranking. A posição do aluno não aparece para ninguém além dele.

## Critério de pronto

Todo ponto tem origem rastreável, e o ranking de cada disciplina reflete só o que aconteceu nela.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
