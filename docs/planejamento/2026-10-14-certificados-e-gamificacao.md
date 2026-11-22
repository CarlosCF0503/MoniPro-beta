# Plano de implementação: Certificados (RF-005) e Gamificação (RN-008)

## Situação (registrada em 22/11/2026)

Proposta registrada na especificação v7.1 (decisões de escopo de 17/10/2026). A parte de gamificação foi implementada pela presença confirmada dos dois lados (Fase 03) e pelo plano 5; a de certificados foi substituída pelo plano de emissão de certificados de 11/11/2026.

**Projeto:** MoniPro, Projeto Integrador do 7º período
**Data:** 14/10/2026
**Origem:** feedback da Fase 01, que pede para "formalizar se gamificação (RN-008) e certificado (RF-005) seguem no escopo [...] atualizando a documentação"

---

## 1. Resumo

As duas features dependem do mesmo dado: **uma sessão de monitoria que comprovadamente aconteceu, com presença confirmada**. Hoje esse dado não existe de forma confiável no sistema. O plano começa por ele (Etapa 0). Depois disso, a gamificação e os certificados podem ser feitos em paralelo.

Proposta de valor em uma frase: **o monitor acumula horas comprovadas que viram certificado, e a gamificação mostra esse progresso**. O monitor ganha motivo para abrir vagas, e o aluno ganha mais oferta de monitoria.

---

## 2. Diagnóstico do estado atual

| #   | Achado                                                                                          | Onde                                                                                                                          | Impacto                                                                                       |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D1  | O próprio aluno conclui o agendamento e ganha +10 pontos, mesmo antes da sessão acontecer       | `src/services/agendamentoService.js` (`concluir`), `src/repositories/agendamentoRepository.js` (`concluirEIncrementarPontos`) | Os pontos podem ser fraudados. Um certificado construído em cima disso teria o mesmo problema |
| D2  | A RN-008 prevê +2 para o aluno e +10 para o monitor; o código dá +10 ao aluno e nada ao monitor | idem                                                                                                                          | Divergência entre especificação e código                                                      |
| D3  | O ranking ordena pelos pontos **globais**, filtrando só quem teve alguma sessão na disciplina   | `src/repositories/disciplinaRepository.js` (`buscarRankingPorDisciplina`)                                                     | Um aluno com muitos pontos em Cálculo aparece no topo de Física                               |
| D4  | `Usuario.pontos` é um contador solto, sem histórico                                             | `prisma/schema.prisma`                                                                                                        | Não dá para auditar nem estornar pontos, nem calcular por disciplina                          |
| D5  | `Monitoria` não tem duração                                                                     | `prisma/schema.prisma`                                                                                                        | Sem duração não existe carga horária, e o certificado fica impossível                         |
| D6  | O horário da vaga não é validado como futuro                                                    | `src/schemas/monitoriaSchemas.js`                                                                                             | O monitor pode criar uma vaga no passado e "realizá-la" na hora                               |
| D7  | Não existe papel de coordenador/admin                                                           | `src/middlewares/autenticacaoMiddleware.js`                                                                                   | Nenhuma parte externa valida as sessões nem assina o certificado                              |

---

## 3. Decisões de escopo propostas (para registrar no documento v8.0)

### 3.1 RN-008 revisada: Regras de Pontuação

| Evento               | Quem ganha | Pontos | Condição                                                                |
| -------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| Presença confirmada  | Aluno      | +2     | Monitor e aluno confirmaram a presença                                  |
| Sessão realizada     | Monitor    | +10    | Pelo menos uma presença com dupla confirmação                           |
| Avaliar o monitor    | Aluno      | +1     | **Adiado** até RF-006/007 (avaliações) existirem                        |
| Avaliação 5 estrelas | Monitor    | ~~+5~~ | **Proposta: descartar**, porque incentiva conluio entre monitor e aluno |

Os pontos desbloqueiam emblemas e a posição no ranking. O ranking é calculado **por disciplina**.

### 3.2 RF-005 mantido, com descrição revisada: Emissão de Certificados

> Gera uma declaração de horas (monitor) ou de participação (aluno) emitida pela plataforma, calculada a partir das sessões com presença confirmada e verificável publicamente por código único. A assinatura institucional e a automação "premium" ficam fora do escopo do Projeto Integrador.

### 3.3 Ranking e privacidade (LGPD)

- O ranking público mostra só **monitores**, onde o reconhecimento é positivo.
- O aluno vê apenas a **própria** posição. Expor quem precisa de monitoria é um risco de privacidade.

---

## 4. Etapas de implementação

```
Etapa 0 (presença confiável)
   ├── G1 → G2 → G3 → G4   (gamificação)
   └── C1 → C2 → C3 → C4 → C5   (certificados)
```

G4 usa a elegibilidade de C1 para a barra de progresso.

### Etapa 0: Presença confiável (pré-requisito)

Área de **risco alto** (concluir agendamento / pontos): exige revisão de design, testes de autorização cruzada e verificação manual em dev.

| Passo | Entrega                                                                                                                                                                                                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1   | Adicionar `duracao_minutos Int @default(60)` em `Monitoria` e validar no zod (15 a 240). Exigir `horario` no futuro na criação da vaga (corrige D5 e D6)                                                                                                                                              |
| 0.2   | Novo endpoint `PATCH /monitorias/:id/presencas` com corpo `{ presentes: [ids], ausentes: [ids] }`. Acesso: `isMonitor`, dono da vaga e só depois de `horario + duracao`. Grava `presenca_monitor` em cada agendamento e muda a monitoria para `realizada` (valor já existente no enum e hoje sem uso) |
| 0.3   | O `PATCH /agendamentos/:id/concluir` passa a ser a **confirmação do aluno**. Fica bloqueado antes do fim da sessão, e o agendamento só vira `concluido` com dupla confirmação (monitor e aluno). Corrige D1                                                                                           |
| 0.4   | Testes automatizados (Jest), mapeados para RF-003 e RN-008                                                                                                                                                                                                                                            |

Alterações de schema:

```prisma
model Monitoria {
  // ...
  duracao_minutos Int @default(60)
}

model Agendamento {
  // ...
  presenca_monitor Boolean?   // null = não marcado
  presenca_aluno   Boolean?
  concluido_em     DateTime?
}
```

Cenários de teste:

- O aluno conclui antes do fim da sessão → **422**
- Outro monitor tenta marcar presença na vaga → **403**
- Marcar presença duas vezes → idempotente, sem duplicar efeitos
- Um aluno marcado como ausente não consegue concluir → **422**
- Uma vaga criada com horário no passado → **400**

**Critério de pronto:** nenhum usuário consegue, sozinho, gerar uma presença "verdadeira".

### Gamificação

#### G1: Livro-razão de pontos

```prisma
enum TipoEventoPontuacao {
  presenca_aluno
  sessao_monitor
}

model EventoPontuacao {
  id                 Int                 @id @default(autoincrement())
  id_usuario         Int
  tipo               TipoEventoPontuacao
  pontos             Int
  id_disciplina      Int
  chave_idempotencia String              @unique // ex.: "presenca:agendamento:42"
  criado_em          DateTime            @default(now())

  @@index([id_usuario])
  @@index([id_disciplina])
  @@map("eventos_pontuacao")
}
```

- Os eventos são gravados **na mesma transação** da dupla confirmação.
- A chave de idempotência é uma string em vez de um `@@unique` composto porque, no Postgres, colunas nulas não colidem em restrições únicas. A chave única impede pontuar duas vezes, mesmo sob concorrência.
- `Usuario.pontos` vira cache do total, ou passa a ser calculado com `SUM`.

#### G2: Ranking por disciplina

- `SUM(pontos) GROUP BY id_usuario WHERE id_disciplina = X` (corrige D3).
- Aplica a regra de privacidade da seção 3.3.

#### G3: Emblemas

```prisma
model Conquista {
  id             Int      @id @default(autoincrement())
  id_usuario     Int
  codigo         String   // ex.: "primeira_sessao"
  concedida_em   DateTime @default(now())

  @@unique([id_usuario, codigo])
  @@map("conquistas")
}
```

O catálogo de emblemas fica fixo no código (sem CRUD). Os emblemas são avaliados ao gravar um evento de pontuação.

| Código            | Nome            | Regra                                                           |
| ----------------- | --------------- | --------------------------------------------------------------- |
| `primeira_sessao` | Primeira sessão | 1ª presença confirmada (aluno) ou 1ª sessão realizada (monitor) |
| `dez_horas`       | 10h monitoradas | Monitor com 600 min em sessões realizadas                       |
| `especialista`    | Frequentador    | 5 sessões na mesma disciplina                                   |
| `assiduo`         | Assíduo         | 5 presenças seguidas sem ausência                               |

#### G4: Frontend do perfil

- Total de pontos, histórico dos últimos eventos e emblemas conquistados.
- Barra de progresso de horas até o certificado, usando os dados de C1. Exemplo: "7h30 de 20h".

Testes da gamificação:

- Duas requisições simultâneas → **um** evento só
- A soma do ranking considera apenas a disciplina consultada
- O emblema é concedido exatamente no limiar, e não uma vez antes dele
- O ranking não expõe o nome de outros alunos

### Certificados

#### C1: Elegibilidade (só leitura)

`GET /certificados/elegibilidade?periodo=2026.2`

- **Monitor:** soma de `duracao_minutos` das sessões `realizada` com pelo menos uma presença com dupla confirmação.
- **Aluno:** número de sessões e horas assistidas com dupla confirmação.
- Já entrega valor sozinha, porque alimenta a barra de progresso do perfil.

#### C2: Modelo `Certificado`

```prisma
enum TipoCertificado {
  horas_monitoria
  participacao
}

model Certificado {
  id                    Int             @id @default(autoincrement())
  codigo                String          @unique // aleatório, 128 bits; nunca o id
  id_usuario            Int
  tipo                  TipoCertificado
  periodo               String          // ex.: "2026.2"
  id_disciplina         Int?
  carga_horaria_minutos Int
  snapshot              Json            // nome e lista de sessões congelados na emissão
  emitido_em            DateTime        @default(now())
  revogado_em           DateTime?

  @@unique([id_usuario, tipo, periodo, id_disciplina])
  @@map("certificados")
}
```

- Com o `snapshot`, o certificado emitido não muda se os dados mudarem depois.
- A restrição `@@unique` tem a mesma ressalva de NULL que G1. Se forem permitidos certificados sem disciplina, usar uma chave textual única no lugar.

#### C3: Emissão

| Método | Rota                        | Acesso             | Função                                             |
| ------ | --------------------------- | ------------------ | -------------------------------------------------- |
| POST   | `/certificados`             | autenticado        | Emite, se a carga mínima configurável for atingida |
| GET    | `/certificados`             | autenticado        | Lista os certificados do usuário                   |
| GET    | `/certificados/:codigo/pdf` | **somente o dono** | Gera o PDF                                         |

- O PDF é gerado **sob demanda** a partir do snapshot com `pdfkit` (JavaScript puro, sem Chromium no container). Não precisa de volume para armazenar arquivos.
- O PDF traz o código e o link (opcionalmente um QR code) de verificação.

#### C4: Verificação pública

`GET /verificar/:codigo`, sem login.

- Tem rate limit próprio, mais restrito que o geral.
- A resposta é mínima: nome, tipo, carga horária, período e situação (válido ou revogado). **Não** expõe matrícula nem e-mail.
- No frontend, a página `verificar.html` faz a consulta.

#### C5: Frontend

Seção "Certificados" no perfil, com elegibilidade, botão "Emitir" e a lista de certificados para download.

Testes dos certificados:

- Uma sessão sem presença confirmada não entra na carga horária
- Baixar o PDF de outro usuário → **403/404** (IDOR)
- Um código inexistente → **404**
- Tentar emitir duas vezes para o mesmo período → **409**
- Alterar o nome do usuário não altera o certificado já emitido (snapshot)
- O rate limit de `/verificar` é aplicado

---

## 5. Ordem sugerida e paralelização

1. **Etapa 0**, com todo o time revisando, porque é a base de tudo
2. **G1** e **C1**, em paralelo
3. **G2, G3** e **C2, C3**, em paralelo
4. **C4**
5. **G4** e **C5** (frontend)
6. Atualizar o documento de especificação (seções 13, 14, 20, 22, 24 e 25, e o Histórico de Versão)

---

## 6. Riscos residuais (para a seção 25: Segurança)

| Risco                                                | Mitigação                                                         | Residual                                |
| ---------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| Monitor e aluno combinam uma sessão falsa            | Dupla confirmação, sessão só depois do horário, vaga só no futuro | Persiste sem um papel de coordenador    |
| O certificado não tem valor institucional automático | Verificação pública por código                                    | Depende de a coordenação aceitar o link |
| Enumeração de `/verificar/:codigo`                   | Código aleatório de 128 bits e rate limit                         | Baixo                                   |
| Pontuação duplicada sob concorrência                 | Chave de idempotência única e transação                           | Baixo                                   |
| Exposição de alunos no ranking                       | Ranking público só de monitores                                   | Baixo                                   |
| Dev e prod compartilham o mesmo banco (R12)          | Migrações testadas com cuidado e sem dados de teste               | Alto até separar os bancos              |

---

## 7. Relação com a Fase 02 (entrega em 18/10/2026)

A Fase 02 avalia **qualidade, testes e segurança**, não features novas. Recomendação:

- **Entregar agora:** a **Etapa 0**. Ela é uma correção de integridade e segurança e entra na seção 22 como "melhoria após testes e análises". Os testes dela servem de evidência para os critérios 2 e 3.
- **Registrar agora:** as decisões da seção 3 deste plano, no documento v8.0 e no cronograma da Parte 02. Isso responde diretamente à recomendação do orientador e pesa no critério 6 (análise crítica).
- **Fases seguintes:** as etapas G e C.

---

## 8. Decisões pendentes do time

1. **Pontos já gravados.** Foram concedidos sem confirmação: zerar, ou migrar como "legado" fora do ranking?
2. **Carga mínima para emitir certificado.** Exemplos: 1h, ou o mínimo exigido pela coordenação.
3. **Ranking de alunos.** Remover, ou tornar opcional (opt-in)?
4. **+5 por avaliação 5 estrelas.** Confirmar o descarte.
