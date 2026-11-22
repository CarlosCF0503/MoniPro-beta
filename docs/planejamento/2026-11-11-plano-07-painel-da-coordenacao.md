# Painel da coordenação

> MoniPro · plano 7 de 14

Não existe nenhum papel acima do monitor. Ninguém valida sessões, assina declarações ou modera disciplinas criadas por monitores (D7 do plano de gamificação).

## Situação (registrada em 22/11/2026)

Implementado nos PRs #102 a #107, em produção pelos releases #105 e #108 (21 e 22/11/2026); convite por e-mail no PR #116 (release #117). O papel foi aprovado em 21/11/2026. Acréscimos ao plano: a coordenação é instância de recurso das faltas e decide os pedidos de revisão com atestado; a conta é criada por script com convite por e-mail, sem senha no terminal. Especificação v7.3: RF-012 e RN-014.

## Ficha

| Item       | Valor                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Prioridade | P2                                                                                              |
| Risco      | Alto                                                                                            |
| Esforço    | 5 a 6 dias                                                                                      |
| Trilha     | Revisão de design + testes de autorização                                                       |
| Depende de | Plano detalhado já existe em Plano_Painel_Administrativo_MoniPro.md. Usa dados dos planos 4 e 6 |

**Prévias das telas** (protótipos navegáveis usados na aprovação, não publicados): Painel da coordenação.

## Requisitos para a especificação

- **RF-012 (novo):** A coordenação acompanha indicadores do semestre, assina declarações, aprova ou mescla disciplinas pendentes e vê o desempenho dos monitores.
- **RN-014 (nova):** O papel coordenador só é criado por script no servidor, nunca pelo cadastro público. Toda ação de escrita do painel fica registrada com quem e quando.

## Decisões do time antes de começar

- Se o time quer este papel no PI (ele destrava a assinatura do plano 4 e a moderação do plano 6).
- Quem será o coordenador nas contas de hml e prod.

## Modelo de dados

```
enum TipoUsuario { aluno monitor coordenador }

model Disciplina {
  // ...
  status        StatusDisciplina @default(aprovada)  // pendente quando criada por monitor
  id_criador    Int?
}
enum StatusDisciplina { pendente aprovada }

model Auditoria {
  id         Int      @id @default(autoincrement())
  id_usuario Int
  acao       String   // assinar_declaracao | aprovar_disciplina | mesclar_disciplina | ocultar_avaliacao
  alvo       String   // "declaracao:12"
  criado_em  DateTime @default(now())
  @@map("auditoria")
}
```

## API

| Método     | Rota                                             | Acesso        | Resposta                                        |
| ---------- | ------------------------------------------------ | ------------- | ----------------------------------------------- |
| GET        | `/admin/resumo, /admin/monitores`                | isCoordenador | indicadores e tabela por monitor no período     |
| GET / POST | `/admin/declaracoes, /:id/assinar`               | isCoordenador | pendentes e assinatura                          |
| GET / POST | `/admin/disciplinas, /:id/aprovar, /:id/mesclar` | isCoordenador | moderação; mesclar move as vagas numa transação |

## Telas e arquivos

| Arquivo                                 | O que muda                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `painel.html (nova)`                    | indicadores, abas Declarações para assinar, Monitores e Disciplinas pendentes |
| `JS/painel.js e CSS/painel.css (novos)` | mesma montagem dos perfis                                                     |
| `base.js`                               | item Painel no menu lateral só para coordenador                               |

## Etapas

1. Migração: valor novo no enum, status em Disciplina (as existentes ficam aprovadas), tabela auditoria.
2. Middleware isCoordenador ao lado de isMonitor, com teste de 403 para aluno e monitor em cada rota /admin.
3. scripts/criar-coordenador.js (pede e-mail e senha no terminal do servidor).
4. Serviços do painel com consultas agregadas (sem N+1: uma consulta por indicador).
5. Disciplina criada por monitor nasce pendente e só aparece para alunos depois de aprovada.
6. Tela (prévia aprovada).

## Testes

- Aluno e monitor recebem 403 em todas as rotas /admin.
- Cadastro público com tipo_usuario coordenador: 400.
- Mesclar move as vagas e apaga a duplicada numa transação.
- Cada ação de escrita cria uma linha em auditoria.
- Indicadores batem com uma contagem manual num banco de teste.

## Segurança e LGPD

A coordenação vê nome e e-mail dos monitores; é tratamento necessário à gestão acadêmica e vai no aviso. A auditoria guarda só ids.

## Critério de pronto

Existe alguém de fora que valida o que os monitores registram, e só essa pessoa consegue fazer isso.

Vale para todos os planos: CI verde (Jest, integração com Postgres, Semgrep), prévia aprovada antes do PR, migração testada num banco descartável, RF/RN registrados na especificação.
