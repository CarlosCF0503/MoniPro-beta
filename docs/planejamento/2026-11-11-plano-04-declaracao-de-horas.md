# Declaração de horas (RF-005)

> MoniPro · plano 4 de 14

O monitor acumula horas comprovadas (o perfil já mostra 6h), mas não tem como provar isso fora do sistema. O RF-005 está na especificação desde a Fase 01.

## Situação (registrada em 22/11/2026)

Não implementado como descrito aqui: em 16/11/2026 a equipe adotou no lugar dele o plano de emissão de certificados (2026-11-11-emissao-certificados.md), implementado nos PRs #83 a #88 e em produção pelo release #89 (18/11/2026). Diferenças principais: declaração em página para imprimir (sem pdfkit), emitir de novo substitui a anterior, teto de 4 horas por sessão e a correção do R14 antes da emissão. Especificação v7.3: RF-005 e RN-012.

## Ficha

| Item       | Valor                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------ |
| Prioridade | P2                                                                                         |
| Risco      | Alto                                                                                       |
| Esforço    | 4 a 5 dias                                                                                 |
| Trilha     | Revisão de design + testes de autorização                                                  |
| Depende de | P2 (presença dos dois lados, já em produção). Assinatura da coordenação depende do plano 7 |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Perfil do monitor; Verificação pública.

## Requisitos para a especificação

- **RF-005 (revisado):** O monitor emite uma declaração de horas por semestre, em PDF, verificável publicamente por um código único.
- **RN-012 (nova):** Entram só monitorias finalizadas com pelo menos uma presença confirmada pelos dois lados. Horas = data_fim − horário. Mínimo de 1h para emitir.
- **RN-012 (cont.):** A declaração emitida não muda. Emitir de novo gera uma nova versão; as anteriores continuam válidas na verificação, marcadas como substituídas.

## Decisões do time antes de começar

- Se a coordenação assina (plano 7) ou se a declaração sai só como "emitida pela plataforma" no PI.
- Se o aluno também recebe declaração de participação (o plano cobre o monitor; o aluno fica para depois).

## Modelo de dados

```
model Declaracao {
  id          Int       @id @default(autoincrement())
  codigo      String    @unique          // MP-26B-7K3Q: ano, semestre, 4 caracteres sem ambíguos (sem 0/O/1/I)
  id_usuario  Int
  usuario     Usuario   @relation(fields: [id_usuario], references: [id])
  periodo     String                     // "2026.2"
  minutos     Int
  detalhe     Json                       // [{ disciplina, minutos, sessoes }] congelado na emissão
  nome        String                     // nome no momento da emissão
  versao      Int       @default(1)
  assinada_em DateTime?                  // plano 7
  criado_em   DateTime  @default(now())

  @@unique([id_usuario, periodo, versao])
  @@map("declaracoes")
}
```

## API

| Método | Rota                              | Acesso                 | Resposta                                                  |
| ------ | --------------------------------- | ---------------------- | --------------------------------------------------------- |
| GET    | `/certificados`                   | Monitor                | lista as declarações do próprio monitor                   |
| POST   | `/certificados`                   | Monitor                | 201 com a declaração; 422 menos de 1h no período          |
| GET    | `/certificados/:codigo/pdf`       | Dono ou coordenação    | PDF gerado na hora a partir do registro                   |
| GET    | `/certificados/verificar/:codigo` | Público, limite por IP | nome, período, horas, disciplinas; 404 código inexistente |

## Telas e arquivos

| Arquivo                                      | O que muda                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `perfil_monitor.html / JS/perfil/monitor.js` | cartão Certificados com total, botão Emitir, lista das emitidas, copiar link |
| `verificar.html (nova)`                      | página pública com o código e a declaração como sai no PDF                   |
| `PDF`                                        | pdfkit no servidor, com QR code para a página de verificação                 |

## Etapas

1. Função pura minutosComprovados(vagas, inscrições, período) em src/utils, com testes de tabela (é a regra que mais pode ser contestada).
2. Migração da tabela declaracoes.
3. certificadoService.emitir: calcula, congela o detalhe, gera código sem colisão (tenta de novo no P2002).
4. Geração do PDF com pdfkit (dependência nova: rodar o Semgrep e conferir licença MIT).
5. Página de verificação com limite por IP (30 por 15 min) para dificultar varrer códigos.
6. Telas (prévias aprovadas).

## Testes

- Sessão finalizada sem nenhuma presença dupla não conta.
- Sessão com 3 inscritos e 1 confirmado conta inteira.
- Período 2026.1 não soma sessões de agosto.
- Código verificado devolve só nome, período, horas e disciplinas (nunca e-mail ou matrícula).
- Aluno chamando POST /certificados: 403.
- Emitir de novo cria versão 2 e a 1 continua verificável.

## Segurança e LGPD

A página pública expõe nome e horas: base legal é o interesse do próprio titular em comprovar a atividade, e isso vai no aviso de privacidade. Declarações ficam fora da anonimização do DELETE /perfil por obrigação de comprovação; a verificação passa a mostrar "titular excluiu a conta".

## Critério de pronto

Um terceiro confere, sem login, que a declaração apresentada pelo monitor foi emitida pelo MoniPro com as horas que ela diz.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
