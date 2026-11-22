# Plano de implementação: Painel Administrativo (Coordenação)

## Situação (registrada em 22/11/2026)

Proposta registrada na especificação v7.1 (perfil Administrador). Foi refinada no plano 7 (painel da coordenação), implementado entre 21 e 22/11/2026.

**Projeto:** MoniPro, Projeto Integrador do 7º período
**Data:** 17/10/2026
**Relação:** complementa o `Plano_Certificados_Gamificacao_MoniPro.md` (14/10/2026), que aponta a ausência de papel de coordenador/admin como achado D7 e como causa de dois riscos residuais

---

## 1. Resumo

O MoniPro só tem dois papéis, `aluno` e `monitor`. O papel é escolhido pela própria pessoa no cadastro público. Por isso, nenhuma parte externa consegue:

- validar quem é monitor de verdade;
- moderar vagas, agendamentos e disciplinas;
- revogar um certificado ou estornar pontos indevidos.

O painel administrativo cria o papel `admin`, usado pela coordenação, e as telas desse papel. É o terceiro pilar da proposta de certificados e gamificação. Sem um terceiro que valide, a dupla confirmação de presença ainda pode ser combinada entre monitor e aluno, e o certificado não tem quem responda por ele.

---

## 2. Diagnóstico do estado atual

| #   | Achado                                                                                               | Onde                                                        | Impacto                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A1  | O enum `TipoUsuario` só tem `aluno` e `monitor`                                                      | `prisma/schema.prisma`                                      | Não existe papel administrativo                                                                                                |
| A2  | O cadastro é público e o próprio usuário escolhe `tipo_usuario`                                      | `src/schemas/autenticacaoSchemas.js`, `POST /auth/cadastro` | Qualquer pessoa vira monitor. As horas de monitoria (certificado) e o ranking de monitores (gamificação) ficam sem lastro      |
| A3  | Quem cria disciplina é o monitor (`isMonitor`)                                                       | `src/routes/disciplinaRotas.js`                             | O catálogo de disciplinas não tem dono institucional                                                                           |
| A4  | A checagem de papel está fixa em `isMonitor`, com mensagem específica                                | `src/middlewares/autenticacaoMiddleware.js`                 | Não serve para um terceiro papel                                                                                               |
| A5  | O papel vem só do JWT, que não tem revogação                                                         | idem                                                        | Um usuário rebaixado ou desativado mantém o acesso até o token expirar                                                         |
| A6  | Não existe registro de ações administrativas                                                         | —                                                           | Não há como auditar quem alterou o quê (passo 6 do `AGENTS.md`)                                                                |
| A7  | O frontend ainda renderiza com `innerHTML`, protegido pela função `escaparHtml` (PR #17, 12/10/2026) | `Monipro_web/JS/*.js`                                       | Um único dado esquecido sem escape, num painel que lista todos os usuários, rouba o token do admin, que fica em `localStorage` |

---

## 3. Decisões de escopo propostas (para registrar no documento v8.0)

### 3.1 Novo papel: Administrador (coordenação)

- O admin **nunca** é criado pela API. O primeiro sai de um script de seed com credencial em variável de ambiente. Os seguintes são promovidos por outro admin.
- O cadastro público continua aceitando só `aluno` e `monitor`.

### 3.2 Funções do painel

| Função                                                         | Fase              | Ligação com o plano de certificados e gamificação                                     |
| -------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| CRUD de disciplinas                                            | MVP               | Base de `id_disciplina` no ranking (G2) e no certificado (C2)                         |
| Aprovar ou recusar monitores                                   | MVP               | Dá lastro às horas de monitoria (C1) e ao ranking público de monitores (seção 3.3)    |
| Listar, buscar e desativar usuários (desativar, nunca apagar)  | MVP               | Certificados já emitidos continuam válidos pelo `snapshot`                            |
| Cancelar monitorias e agendamentos indevidos                   | MVP               | —                                                                                     |
| Indicadores (sessões, presenças, horas, certificados emitidos) | MVP               | Lê `eventos_pontuacao` (G1) e `certificados` (C2)                                     |
| Log de auditoria (só leitura)                                  | MVP               | —                                                                                     |
| Revogar certificado                                            | Fase 2            | Preenche `Certificado.revogado_em` (C2), que hoje ninguém pode alterar                |
| Estorno e ajuste de pontos pelo livro-razão                    | Fase 2            | Evento novo em `EventoPontuacao` (G1), nunca edição de `Usuario.pontos`               |
| Auditoria de sessões suspeitas                                 | Fase 2            | Mitiga o risco residual "monitor e aluno combinam uma sessão falsa"                   |
| Configurar a carga mínima do certificado                       | Fase 2 (opcional) | Resolve a decisão pendente 2 do outro plano. Pode continuar como variável de ambiente |

### 3.3 Privacidade (LGPD)

- O admin vê dados de todos os usuários pela **finalidade** de gestão acadêmica. As listagens devolvem só os campos necessários: sem `senha` e com a matrícula mascarada (`mascararIdentificador.js` já existe).
- A regra de ranking da seção 3.3 do outro plano continua valendo para alunos e monitores. O painel não é um ranking público.

---

## 4. Etapas de implementação

```
Pré-requisito (Etapa 0 do plano de certificados)
   └── A1 → A2 → A3 → A4
                  └── (depois de G1 e C2) A5
```

### Pré-requisitos

| Item                                                                         | Situação                                         | Por quê                                                                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Posse e papel em "concluir agendamento"                                      | **Feito** (PR #16, em produção desde 12/10/2026) | —                                                                                                                        |
| Escape de dados renderizados com `innerHTML`                                 | **Feito** (PR #17, em produção desde 12/10/2026) | O painel novo deve usar `textContent` desde o início, em vez de depender de `escaparHtml`                                |
| **Etapa 0 do plano de certificados** (presença confiável, dupla confirmação) | Pendente                                         | O aluno ainda conclui sozinho e antes da sessão (D1). Os indicadores e o estorno só fazem sentido com presença confiável |
| **Status do agendamento decidido pelo servidor**                             | Conferir                                         | Achado da matriz de risco de 02/10/2026. A Etapa 0 do outro plano mexe nesse fluxo                                       |

> O `docs/agentes/riscos-e-backlog.md` ainda lista os dois primeiros itens como abertos. A matriz precisa ser atualizada.

### A1: Papel e controle de acesso

| Passo | Entrega                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1.1  | Acrescentar `admin` ao enum `TipoUsuario`. Acrescentar `ativo Boolean @default(true)` e `status_monitor` em `Usuario` (corrige A1)                     |
| A1.2  | Script `prisma/seed-admin.js`, que lê e-mail e senha de variáveis de ambiente                                                                          |
| A1.3  | Middleware `exigirPapel(...papeis)` no lugar de `isMonitor`. Nas rotas `/admin`, papel e `ativo` são relidos do banco, não só do JWT (corrige A4 e A5) |
| A1.4  | `loginSchema` passa a aceitar `admin`. `cadastroSchema` continua com `['aluno', 'monitor']`                                                            |

Alterações de schema:

```prisma
enum TipoUsuario {
  aluno
  monitor
  admin
}

enum StatusMonitor {
  pendente
  aprovado
  recusado
}

model Usuario {
  // ...
  ativo          Boolean        @default(true)
  status_monitor StatusMonitor? // null para aluno e admin
}

model LogAdmin {
  id        Int      @id @default(autoincrement())
  id_admin  Int
  acao      String   // ex.: "disciplina.criar", "monitor.aprovar"
  entidade  String
  id_alvo   Int?
  detalhes  Json?
  criado_em DateTime @default(now())

  @@index([id_admin])
  @@map("logs_admin")
}
```

Os monitores que já existem entram como `aprovado` na migração, para não travar ninguém.

### A2: Disciplinas e monitores

| Método | Rota                               | Função                                                                         |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/admin/disciplinas`               | Lista as disciplinas                                                           |
| POST   | `/admin/disciplinas`               | Cria uma disciplina. `POST /disciplinas` deixa de aceitar monitor (corrige A3) |
| PATCH  | `/admin/disciplinas/:id`           | Renomeia                                                                       |
| GET    | `/admin/monitores?status=pendente` | Fila de aprovação                                                              |
| PATCH  | `/admin/monitores/:id`             | Aprova ou recusa                                                               |

- Um monitor `pendente` não cria vaga (`POST /monitorias` → 403). Isso fecha A2.
- Toda escrita grava a ação e o `LogAdmin` na mesma `$transaction`.

### A3: Usuários e moderação

| Método | Rota                             | Função                                                                |
| ------ | -------------------------------- | --------------------------------------------------------------------- |
| GET    | `/admin/usuarios`                | Lista paginada (`paginacao.js`) com busca                             |
| PATCH  | `/admin/usuarios/:id/ativo`      | Desativa ou reativa                                                   |
| PUT    | `/admin/monitorias/:id/cancelar` | Cancela uma vaga, sem a regra de 24h (RN-001), com motivo obrigatório |
| GET    | `/admin/logs`                    | Log de auditoria, só leitura                                          |

### A4: Indicadores e frontend

- `GET /admin/indicadores`: contagens por disciplina e por período.
- `admin.html`, `JS/admin.js` e `CSS/admin.css`, reaproveitando `api.js`, `toast.js` e `base.js`. A renderização usa só `textContent`.
- `base.js` redireciona quem for `admin`. A proteção no cliente é só estética: quem garante o acesso é o backend.

### A5: Integração com certificados e gamificação (depois de G1 e C2)

| Passo | Entrega                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A5.1  | `PATCH /admin/certificados/:codigo/revogar` preenche `revogado_em`. `/verificar/:codigo` (C4) passa a mostrar "revogado"                                  |
| A5.2  | `POST /admin/pontuacao/ajustes` grava um evento `ajuste_admin` (positivo ou negativo) em `EventoPontuacao`, com `chave_idempotencia` e motivo obrigatório |
| A5.3  | Fila de sessões suspeitas (ex.: sessão realizada com uma única presença, ou monitor e aluno sempre os mesmos) para revisão manual                         |
| A5.4  | Tratar os pontos legados (decisão pendente 1 do outro plano) por um ajuste em lote, registrado no log                                                     |

Alteração no enum do livro-razão (G1):

```prisma
enum TipoEventoPontuacao {
  presenca_aluno
  sessao_monitor
  ajuste_admin
}
```

### Testes

Área de **risco alto**: dado pessoal de todos os usuários e ações sobre outras contas. Cadastrar a área "Painel administrativo" em `docs/agentes/riscos-e-backlog.md` e rodar `node docs/agentes/priorizacao.js --escrever`.

- Sem token → **401**. Aluno ou monitor em **cada** rota `/admin` → **403**
- Cadastro com `tipo_usuario: 'admin'` → **400**
- Admin desativado ou rebaixado com token ainda válido → **403**
- Monitor `pendente` cria vaga → **403**
- Toda escrita gera exatamente uma linha em `LogAdmin`
- A listagem de usuários não devolve `senha` nem a matrícula completa
- Nome com `<script>` aparece como texto no painel (verificação manual em dev)
- (A5) Revogar um certificado não altera o `snapshot`, e `/verificar` mostra "revogado"
- (A5) Ajustar pontos duas vezes com a mesma chave gera **um** evento

---

## 5. Como este plano se encaixa no de certificados e gamificação

### 5.1 O que ele complementa

| Lacuna no plano de certificados e gamificação                                             | O que o painel entrega                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| D7: não existe papel de coordenador/admin                                                 | A1                                                                                        |
| Risco residual: "monitor e aluno combinam uma sessão falsa", **persiste sem coordenador** | Aprovação de monitores (A2) e auditoria de sessões (A5.3)                                 |
| Risco residual: o certificado não tem valor institucional automático                      | A coordenação passa a ser dona do processo: aprova monitores e revoga certificados (A5.1) |
| `Certificado.revogado_em` existe, mas ninguém pode preenchê-lo                            | A5.1                                                                                      |
| `EventoPontuacao` não prevê correção                                                      | Tipo `ajuste_admin` (A5.2), que mantém o livro-razão como fonte única                     |
| Decisão pendente 1: o que fazer com os pontos legados                                     | Ajuste em lote auditado (A5.4)                                                            |
| Decisão pendente 2: carga mínima configurável                                             | Configuração pelo painel, ou variável de ambiente                                         |
| Ranking público só de monitores                                                           | Só tem valor se os monitores forem aprovados (A2)                                         |

### 5.2 Ajustes necessários entre os dois planos

1. **Um só pré-requisito.** A correção de "concluir agendamento" é a Etapa 0 do plano de certificados. O painel não deve corrigir o `concluir` por conta própria.
2. **Pontos só pelo livro-razão.** Nenhuma rota de admin edita `Usuario.pontos` diretamente. Qualquer ajuste é um `EventoPontuacao`.
3. **Ordem das migrações.** As duas frentes alteram o schema (`Monitoria`, `Agendamento`, `Usuario`, enums novos). Como dev e prod compartilham o mesmo banco (R12), as migrações devem sair em sequência, uma por PR, nunca em paralelo.
4. **Auditoria separada da pontuação.** `LogAdmin` registra a ação administrativa. `EventoPontuacao` registra o efeito nos pontos. O ajuste grava nos dois, na mesma transação.
5. **Seção de segurança do v8.0.** Atualizar a tabela de riscos residuais (seção 6 do outro plano): os dois riscos que dependiam do coordenador passam a ter mitigação.

### 5.3 Ordem combinada sugerida

1. **Etapa 0** (certificados)
2. **A1** (papel admin)
3. **G1** e **C1**, em paralelo com **A2**
4. **G2, G3, C2, C3** e **A3**
5. **C4** e **A5**
6. **G4, C5** e **A4** (frontends)
7. Atualizar o documento de especificação (seções 13, 14, 20, 22, 24 e 25, e o Histórico de Versão)

---

## 6. Riscos residuais

| Risco                                       | Mitigação                                                                 | Residual                                       |
| ------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| Admin criado por autocadastro               | `cadastroSchema` sem `admin`, seed por variável de ambiente, teste de 400 | Baixo                                          |
| Token de admin roubado por XSS              | `escaparHtml` no frontend atual (PR #17), `textContent` no painel         | Médio enquanto o token ficar em `localStorage` |
| Admin rebaixado mantém o acesso             | Papel e `ativo` relidos do banco nas rotas `/admin`                       | Baixo                                          |
| Ação administrativa sem rastro              | `LogAdmin` na mesma transação                                             | Baixo                                          |
| Abuso pelo próprio admin                    | Log de auditoria só leitura e motivo obrigatório                          | Médio (não há segundo aprovador)               |
| Migração quebra o banco compartilhado (R12) | Uma migração por PR, testada em banco local antes                         | Alto até separar os bancos                     |

---

## 7. Relação com a Fase 02 (entrega em 18/10/2026)

O painel **não** entra na Fase 02. Recomendação:

- **Registrar agora:** a decisão de criar o papel de coordenação (seção 3) no documento v8.0, como resposta ao risco residual do plano de certificados.
- **Experimento opcional:** um protótipo em branch separada e banco **local** (nunca o banco compartilhado), com escopo mínimo: papel `admin` + seed, `exigirPapel`, listagem de usuários, indicadores e CRUD de disciplinas, com três testes (401, 403 e 200).
- **Fases seguintes:** A1 a A5, na ordem da seção 5.3.

---

## 8. Decisões pendentes do time

1. **Quem é o admin:** só a coordenação, ou também professores com permissões menores?
2. **Aprovação de monitor:** os monitores novos ficam bloqueados até a aprovação?
3. **Cancelamento pelo admin:** ignora a regra de 24h (RN-001)? Quem avisa o aluno?
4. **Ajuste manual de pontos:** fica restrito aos casos de fraude e legado, ou vale para qualquer motivo?
