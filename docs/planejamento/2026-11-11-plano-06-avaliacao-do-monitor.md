# Avaliação do monitor (RF-006/007)

> MoniPro · plano 6 de 14

Os RF-006/007 estão na especificação e o ponto por avaliar foi adiado até eles existirem. Sem avaliação, o monitor não sabe o que melhorar e a coordenação não tem retorno.

## Situação (registrada em 22/11/2026)

Implementado no PR #109, em produção pelo release #110 (22/11/2026). Decisões: a coordenação oculta comentários ofensivos ou pessoais, e a nota do comentário oculto sai da média; a nota é escolhida numa escala de 1 a 5, sem a fileira de estrelas. Especificação v7.3: RF-006, RF-007 e RN-013.

## Ficha

| Item       | Valor                                             |
| ---------- | ------------------------------------------------- |
| Prioridade | P2                                                |
| Risco      | Médio                                             |
| Esforço    | 3 dias                                            |
| Trilha     | Testes de regra + revisão                         |
| Depende de | P2 (presença dupla). Aparece no painel do plano 7 |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Avaliar no perfil do aluno; Avaliações no perfil do monitor.

## Requisitos para a especificação

- **RF-006:** O aluno com presença confirmada pelos dois lados avalia a monitoria com nota de 1 a 5 e comentário opcional, uma vez por inscrição, até 7 dias depois.
- **RF-007:** O monitor vê a média, a distribuição das notas e os comentários, sem saber quem avaliou.
- **RN-013 (nova):** A média só aparece com 3 ou mais avaliações. Comentários aparecem sem nome e sem data exata. Avaliação não dá pontos ao monitor.

## Decisões do time antes de começar

- Se a coordenação pode ocultar um comentário ofensivo (recomendado: sim, pelo painel do plano 7).

## Modelo de dados

```
model Avaliacao {
  id             Int         @id @default(autoincrement())
  id_agendamento Int         @unique
  agendamento    Agendamento @relation(fields: [id_agendamento], references: [id], onDelete: Cascade)
  id_monitor     Int                     // desnormalizado para o resumo
  nota           Int                     // 1 a 5 (check no zod e na migração)
  comentario     String?     @db.VarChar(300)
  oculto_em      DateTime?               // moderação da coordenação
  criado_em      DateTime    @default(now())

  @@index([id_monitor])
  @@map("avaliacoes")
}
```

## API

| Método | Rota                          | Acesso                  | Resposta                                                     |
| ------ | ----------------------------- | ----------------------- | ------------------------------------------------------------ |
| POST   | `/agendamentos/:id/avaliacao` | Aluno dono da inscrição | 201; 409 já avaliou; 422 sem presença dupla ou fora do prazo |
| GET    | `/perfil/avaliacoes`          | Aluno                   | mapa inscrição → nota dada                                   |
| GET    | `/perfil/avaliacoes/resumo`   | Monitor                 | total, média (se 3+), distribuição e comentários sem nome    |

## Telas e arquivos

| Arquivo                                      | O que muda                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `perfil_aluno.html / JS/perfil/aluno.js`     | botão Avaliar monitor no histórico e nos detalhes, diálogo com estrelas |
| `perfil_monitor.html / JS/perfil/monitor.js` | cartão Avaliações na coluna lateral e na aba Horas do celular           |

## Etapas

1. Migração com check de nota entre 1 e 5.
2. avaliacaoService com as três regras (dono, presença dupla, prazo) e unicidade por agendamento.
3. Resumo agregado no banco (sem devolver id do aluno nem do agendamento).
4. Telas (prévias aprovadas).

## Testes

- Aluno sem presença do monitor tenta avaliar: 422.
- Segunda avaliação: 409.
- Com 2 avaliações o resumo não traz média.
- O resumo não contém id_aluno nem id_agendamento.
- Comentário com 301 caracteres: 400.
- Comentário com HTML aparece escapado.

## Segurança e LGPD

A avaliação liga aluno e monitor; o anonimato depende do mínimo de 3 e de não expor datas exatas. Exclusão da conta do aluno apaga a avaliação (cascade).

## Critério de pronto

O monitor recebe retorno útil sem conseguir identificar quem avaliou.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
