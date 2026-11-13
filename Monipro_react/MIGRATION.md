# Migração Monipro_web → Monipro_react

Acompanhamento da migração do front estático (`Monipro_web/`, HTML/CSS/JS) para React.

**Legenda:** ✅ feito · 🔄 em andamento · ⏳ pendente · ➖ não migrar

Uma tela só conta como **feita** quando passou em lint, build, comparação visual com a tela original e revisão de código.

> **Migração em andamento.** 10 de 12 telas commitadas em `feat/migracao-react`, que já recebeu a develop com a recuperação de senha (PR #72), a confirmação de e-mail (PR #76) e as notificações (PR #78).

## Próximos passos

1. **Telas de autenticação** (Login, Cadastro, Privacidade, Redefinir senha, Confirmar e-mail) e a trava de envio duplo em Nova disciplina: escritas e verificadas (191 capturas em 4 tamanhos, chamadas de API iguais); em revisão de código e de segurança.
2. Commitar, atualizar a prévia navegável e abrir o PR de `feat/migracao-react` para a `develop`.

## Como a migração está organizada

- Vite + React, JS/JSX. Uma entrada HTML por tela, sem roteador, para manter as URLs `.html` e o CSS global original sem colisão.
- Cada tela tem três arquivos: `<tela>.html` (raiz de `Monipro_react/`), `src/entradas/<tela>.jsx` e `src/telas/<Tela>.jsx`.
- O `vite.config.js` transforma toda `*.html` da raiz em entrada. Uma tela com `.html` aqui substitui a versão estática em dev/preview.
- CSS, imagens e fontes são importados direto de `Monipro_web/`, sem cópia.

## Páginas

| Página | Arquivo original | Componente | Status | Observações |
|---|---|---|---|---|
| Login | `index.html` | `src/telas/Login.jsx` | 🔄 em andamento | Versão commitada é anterior aos PRs #72 e #76; recebendo "Esqueci minha senha" e a confirmação de e-mail |
| Redefinir senha | `redefinir_senha.html` | `src/telas/RedefinirSenha.jsx` | 🔄 em andamento | Tela nova do PR #72; escrita, em verificação |
| Confirmar e-mail | `confirmar_email.html` | `src/telas/ConfirmarEmail.jsx` | 🔄 em andamento | Tela nova do PR #76 |
| Escolha de cadastro | `escolha_cadastro.html` | `src/telas/EscolhaCadastro.jsx` | ✅ feito | |
| Cadastro | `cadastro.html` | `src/telas/Cadastro.jsx` | 🔄 em andamento | Recebendo a confirmação de e-mail do PR #76 |
| Privacidade | `privacidade.html` | `src/telas/Privacidade.jsx` | 🔄 em andamento | Versão commitada é anterior aos PRs #72 e #76; o texto do Brevo e o prazo do link de senha estão escritos, falta conferir com o original. Contato do encarregado ainda "[contato a definir]", igual ao original |
| Início (dashboard) | `base.html` | `src/telas/Base.jsx` | ✅ feito | |
| Minhas disciplinas | `escolha_disciplina.html` | `src/telas/EscolhaDisciplina.jsx` | ✅ feito | Busca continua sem filtrar, igual ao original |
| Nova disciplina | `cadastro_disciplina.html` | `src/telas/CadastroDisciplina.jsx` | ✅ feito | Regras em `src/disciplinaRegras.js`. Trava síncrona contra envio duplo escrita (sem commit), falta conferir |
| Marcar monitoria | `marcar_monitoria.html` | `src/telas/MarcarMonitoria.jsx` | ✅ feito | Componentes e datas em `src/telas/marcar/`. O foco continua no card de vaga após o clique (o original perde o foco ao redesenhar); melhor para teclado, sem diferença visual |
| Perfil do aluno | `perfil_aluno.html` | `src/telas/PerfilAluno.jsx` | ✅ feito | Revisão de código e de segurança sem pendências. Inclui a edição de vaga (PR #71). Diferenças a confirmar: excluir conta no celular abre sempre como painel (o original abre como modal só no primeiro clique); após erro ao confirmar presença o botão volta para "Confirmar" |
| Perfil do monitor | `perfil_monitor.html` | `src/telas/PerfilMonitor.jsx` | ✅ feito | Diálogos de editar e finalizar vaga em `src/telas/monitor/`; reaproveita `src/perfil/`. Revisão de código e de segurança sem pendências. O foco fica onde o usuário estava depois de trocar o mês, salvar a edição e fechar o detalhe (o original perde o foco ao redesenhar) |
| Perfil (antigo) | `perfil.html` | — | ➖ não migrar | Legado: substituído por `perfil_aluno` e `perfil_monitor`, nenhuma tela aponta para ele. Continua em `Monipro_web` como está; remoção (e a linha do README) fica para um PR à parte |

## Componentes e módulos compartilhados

| Módulo | Função | Status |
|---|---|---|
| `src/api.js` | `chamadaApi`, `mensagemDaApi`, `obterSessao`, `encerrarSessao` | ✅ feito |
| `src/toast.jsx` | `useToast` / `Toast` | ✅ feito |
| `src/Casca.jsx` | Cabeçalho, menu lateral e modal de sair (lógica de `JS/base.js`) | ✅ feito |
| `src/perfil/` | Dados do perfil e exclusão de conta, compartilhados entre aluno e monitor | ✅ feito |

## Integração (fora das telas)

| Item | Status | Observações |
|---|---|---|
| Ordem do CSS no build | ⏳ pendente | CSS compartilhado vira chunk e muda de ordem no build (ex.: `legal.css` e `escolha_disciplina.css` depois do CSS da tela). Medido sem efeito nas telas atuais, mas frágil; decidir se fixa no `vite.config.js` |
| Gradiente de fundo no build | ✅ feito | `build.cssMinify: false`: o CSS sai igual ao original (antes o gradiente do `base.css` era reescrito e o build acrescentava `-webkit-backdrop-filter`). Custo ~7 KB gzip no total |
| Deploy (Dockerfile / Nginx) | ⏳ pendente | Precisa de um estágio de build do React |
| CI (lint e build de `Monipro_react`) | ⏳ pendente | O CI atual não cobre o front novo |
| API local em dev | ⏳ pendente | Em dev a API padrão é a de produção; backend local exige `API_BASE_URL` e a origem `http://localhost:5173` em `ALLOWED_ORIGINS` |

## Defeitos encontrados no original

A migração mantém o comportamento do `Monipro_web`. Estes defeitos apareceram na comparação e ficam para um PR à parte no front original:

- **Marcar monitoria:** se a rede falhar ao criar uma vaga, a tela de revisão não mostra nenhum aviso.
- **Marcar monitoria:** o campo "local" aceita 140 caracteres, mas a validação para em 120.
- **Perfis:** no celular, o primeiro "Excluir conta" abre como modal em vez de painel (`excluir_conta.js` cria o diálogo sem `pp-painel`).
- **Perfis:** depois de um erro ao confirmar presença, o botão fica com o texto "Confirmar presença" até a tela ser redesenhada.
- **Perfil do monitor:** editar vaga não trata erro de rede (o botão fica em "Salvando…", mesmo ao reabrir) nem sessão expirada; "Carregar vagas mais antigas" também não trata sessão expirada.
