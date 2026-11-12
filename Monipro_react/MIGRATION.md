# Migração Monipro_web → Monipro_react

Acompanhamento da migração do front estático (`Monipro_web/`, HTML/CSS/JS) para React.

**Legenda:** ✅ feito · 🔄 em andamento · ⏳ pendente · ➖ não migrar

Uma tela só conta como **feita** quando passou em lint, build e comparação visual com a tela original.

## Como a migração está organizada

- Vite + React, JS/JSX. Uma entrada HTML por tela, sem roteador, para manter as URLs `.html` e o CSS global original sem colisão.
- Cada tela tem três arquivos: `<tela>.html` (raiz de `Monipro_react/`), `src/entradas/<tela>.jsx` e `src/telas/<Tela>.jsx`.
- O `vite.config.js` transforma toda `*.html` da raiz em entrada. Uma tela com `.html` aqui substitui a versão estática em dev/preview.
- CSS, imagens e fontes são importados direto de `Monipro_web/`, sem cópia.

## Páginas

| Página | Arquivo original | Componente | Status | Observações |
|---|---|---|---|---|
| Login | `index.html` | `src/telas/Login.jsx` | ✅ feito | |
| Escolha de cadastro | `escolha_cadastro.html` | `src/telas/EscolhaCadastro.jsx` | ✅ feito | |
| Cadastro | `cadastro.html` | `src/telas/Cadastro.jsx` | ✅ feito | |
| Privacidade | `privacidade.html` | `src/telas/Privacidade.jsx` | ✅ feito | Contato do encarregado ainda "[contato a definir]", igual ao original |
| Início (dashboard) | `base.html` | `src/telas/Base.jsx` | ✅ feito | |
| Minhas disciplinas | `escolha_disciplina.html` | `src/telas/EscolhaDisciplina.jsx` | ✅ feito | Busca continua sem filtrar, igual ao original |
| Nova disciplina | `cadastro_disciplina.html` | `src/telas/CadastroDisciplina.jsx` | ✅ feito | Regras em `src/disciplinaRegras.js`. Ajuste pendente: travar envio duplo com `useRef` (o original trava de forma síncrona) |
| Marcar monitoria | `marcar_monitoria.html` | `src/telas/MarcarMonitoria.jsx` | 🔄 em andamento | |
| Perfil do aluno | `perfil_aluno.html` | `src/telas/PerfilAluno.jsx` | 🔄 em andamento | |
| Perfil do monitor | `perfil_monitor.html` | `src/telas/PerfilMonitor.jsx` | ⏳ pendente | Depende de `src/perfil/` |
| Perfil (antigo) | `perfil.html` | — | ➖ não migrar | Legado: substituído por `perfil_aluno` e `perfil_monitor`, nenhuma tela aponta para ele. Continua em `Monipro_web` como está; remoção (e a linha do README) fica para um PR à parte |

## Componentes e módulos compartilhados

| Módulo | Função | Status |
|---|---|---|
| `src/api.js` | `chamadaApi`, `mensagemDaApi`, `obterSessao`, `encerrarSessao` | ✅ feito |
| `src/toast.jsx` | `useToast` / `Toast` | ✅ feito |
| `src/Casca.jsx` | Cabeçalho, menu lateral e modal de sair (lógica de `JS/base.js`) | ✅ feito |
| `src/perfil/` | Dados do perfil e exclusão de conta, compartilhados entre aluno e monitor | 🔄 em andamento |

## Integração (fora das telas)

| Item | Status | Observações |
|---|---|---|
| Ordem do CSS no build | ⏳ pendente | CSS compartilhado vira chunk e muda de ordem no build (ex.: `legal.css` e `escolha_disciplina.css` depois do CSS da tela). Medido sem efeito nas telas atuais, mas frágil; decidir se fixa no `vite.config.js` |
| Gradiente de fundo no build | ✅ feito | `build.cssMinify: false`: o CSS sai igual ao original (antes o gradiente do `base.css` era reescrito e o build acrescentava `-webkit-backdrop-filter`). Custo ~7 KB gzip no total |
| Deploy (Dockerfile / Nginx) | ⏳ pendente | Precisa de um estágio de build do React |
| CI (lint e build de `Monipro_react`) | ⏳ pendente | O CI atual não cobre o front novo |
| API local em dev | ⏳ pendente | Em dev a API padrão é a de produção; backend local exige `API_BASE_URL` e a origem `http://localhost:5173` em `ALLOWED_ORIGINS` |
