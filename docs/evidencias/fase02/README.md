# Evidências da Fase 02 (12/10/2026)

Arquivo de evidências citado na seção 24.3 do Documento de Especificação. Os arquivos foram gerados em 12/10/2026, durante os testes da Fase 02, e foram copiados para cá sem alterar os resultados.

## O que foi ocultado

O repositório é público. Antes da cópia, estes dados foram trocados:

| Dado | Onde aparecia | Trocado por |
|---|---|---|
| Tokens JWT das contas de teste | `casos-de-teste-sistema/ct08-ct11-dev.txt` | `eyJ…[omitido]` |
| Senha das contas de teste | `ct08_ct11.mjs` e `ct11_reteste.mjs` | `process.env.SENHA_TESTE` |
| Nome da máquina que rodou o Jest | `jest-saida.txt` | `[omitido]` |
| Caminho local do repositório | relatórios do Jest e de cobertura | `<repo>` |

Nas requisições registradas, a senha já aparecia como `***` desde a execução original. Os e-mails das contas de teste usam o domínio `@teste.invalid`, que não recebe mensagens.

## Índice

| Arquivo | O que comprova | Casos e requisitos | Ambiente |
|---|---|---|---|
| `casos-de-teste-sistema/ct08-ct11-dev.txt` | Requisições e respostas dos casos de teste de sistema | CT-08 (RN-001), CT-09 (RF-003), CT-10 (RNF-005), CT-11 (RN-008) | dev.moni-pro.app.br |
| `casos-de-teste-sistema/ct08_ct11.mjs` | Script que executou os casos acima e gerou o registro | CT-08 a CT-11 | dev |
| `casos-de-teste-sistema/ct11_reteste.mjs` | Reteste do CT-11 depois do PR #27 (o perfil passa a mostrar a pontuação) | CT-11 (RN-008) | dev e produção |
| `jest-saida.txt`, `titulos.txt` | Saída do Jest e a lista de testes com o resultado de cada um | Testes de unidade e de API | local |
| `coverage-summary.json` | Cobertura de código por arquivo | Seção 24.1 | local |
| `audit.json` | Resultado do `npm audit` antes das correções | R9 | local |
| `dast-dev.txt` | Teste dinâmico de segurança T1 a T13 (cabeçalhos, token, CORS, TLS, limite de login) | T1 a T13 da seção 25 | dev e produção |
| `producao-pos-deploy.txt` | Conferência da produção depois do deploy | T1 a T6, validação zod | moni-pro.app.br |
| `runs.tsv` | Histórico das execuções do GitHub Actions | R11 | GitHub Actions |
| `apos-correcoes/` | Jest, cobertura, auditoria e conferência da produção depois das correções R5 a R11 | R5 a R11 | local e produção |
| `apos-pr27/` | Jest, cobertura e execuções depois do PR #27 | RN-008, CT-11 | local |

## Commits

Os testes rodaram sobre a `develop` de 12/10/2026, entre o merge do PR #16 (`96c9362`, controle de acesso na conclusão) e o merge do PR #30 (`ed729a0`). As pastas `apos-correcoes/` e `apos-pr27/` correspondem aos merges dos PRs #21 a #25 e do PR #27 (`5bd92ef`).

## Observações

- Os casos CT-08 a CT-11 rodaram em dev, mas na época dev e produção usavam o mesmo banco (risco R12). Por isso as contas `[TESTE]` (ids 25 a 27), a vaga 10 e o agendamento 6 também existem em produção. A remoção está no plano da Fase 03 (item P1).
- Em CT-11 o próprio aluno conclui o agendamento. Esse comportamento é o risco R4, que a Fase 03 troca pela confirmação do monitor (item P2).

## Fase 03

As evidências da Fase 03 ficam em `docs/evidencias/fase03/`, gravadas já com os dados ocultados.
