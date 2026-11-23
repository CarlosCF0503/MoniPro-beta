MoniPro · Plano de entrega

# Cadastro de Disciplinas

## Situação (registrada em 22/11/2026)

Implementado no PR #53 e em produção desde 08/11/2026. Desde o PR #104 (21/11/2026), a disciplina criada por monitor passa pela revisão da coordenação.

Hoje só dá para criar disciplina chamando a API na mão (Postman, curl) ou direto no banco. O backend já funciona; o trabalho é **endurecer a rota** `POST /disciplinas` e **criar a tela**. Depois de cadastrada, a disciplina aparece em “Minhas Disciplinas” e passa a aceitar vagas de monitoria.

Branch feat/tela-cadastro-disciplinas → develop ~2 dias Sem migration Depende de fix/ux-correcoes-rapidas (só o foco)

Prévia interativa

## Como a tela fica no MoniPro

A prévia usa as cores, o header, o botão Voltar, o campo e o toast do próprio sistema. O formulário funciona: digite um nome, tente um repetido (“cálculo i”), deixe vazio ou passe de 80 caracteres. As disciplinas da lista são exemplos.

Ver estado:

Como monitor: o botão “+ Nova disciplina” aparece ao lado da busca. Ao cadastrar, a tela real segue para `marcar_monitoria.html`; na prévia ela volta para a lista com o card novo destacado.

Antes de começar

## Decisões para o time

O plano assume as opções marcadas. Mudar qualquer uma delas muda o escopo.

1\. Quem pode cadastrar?

A**Qualquer monitor.** Não muda banco nem regras.

BPerfil `admin`/coordenação. Exige migration no enum `TipoUsuario`, cadastro e JWT; fica para outra tarefa.

2\. Onde fica a tela?

A**Página nova** `cadastro_disciplina.html`, aberta por “+ Nova disciplina”.

BModal em `escolha_disciplina.html`. Não temos diálogo acessível pronto (fase 2 da avaliação de UX).

3\. Editar e excluir

Fora**Ficam fora desta entrega.** Excluir esbarra nas monitorias vinculadas (chave estrangeira) e precisa de regra própria.

Em aberto para a revisão: tratar “Calculo” igual a “Cálculo” (acentos) e o destino depois do 201 (criar vaga ou voltar para a lista).

Ponto de partida

## O que já existe

| Parte                     | Situação                                                                                    | Onde                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Rota `POST /disciplinas`  | Existe exige login e perfil monitor                                                         | `src/routes/disciplinaRotas.js`             |
| Validação                 | Fraca só checa nome vazio; sem limite de tamanho, sem zod                                   | `src/services/disciplinaService.js`         |
| Nome único                | Parcial `@unique` diferencia maiúsculas e acentos: “Cálculo I” e “cálculo i” entram as duas | `prisma/schema.prisma`                      |
| Nome repetido             | Genérico 409 “Registro duplicado. Verifique os dados informados.”                           | `src/utils/tratarErro.js`                   |
| Resposta de sucesso       | Fora do padrão `201 { mensagem, disciplina }` sem `success: true`                           | `src/controllers/disciplinaController.js`   |
| 403 de quem não é monitor | Fora do padrão `{ erro }` sem `success: false`                                              | `src/middlewares/autenticacaoMiddleware.js` |
| Testes                    | Faltam só `GET /disciplinas` tem teste                                                      | `tests/disciplina.test.js`                  |
| Tela                      | Não existe                                                                                  | —                                           |

Commit 1 · ~0,5 dia

## Backend: endurecer a rota

### Schema zod para a criação

Arquivo novo `src/schemas/disciplinaSchemas.js`, no padrão de `monitoriaSchemas.js`. O `textoObrigatorio` de `comuns.js` já faz `trim`, mínimo 1, máximo e a mensagem “Deve ser um texto.”.

```
const { z } = require('zod');
const { textoObrigatorio } = require('./comuns');

const criarDisciplinaSchema = z.object({
    nome: textoObrigatorio('O nome da disciplina é obrigatório.', 80)
        // junta espaços repetidos: "Cálculo   I" → "Cálculo I"
        .transform((nome) => nome.replace(/\s+/g, ' '))
});

module.exports = { criarDisciplinaSchema };

// disciplinaRotas.js
router.post('/', autenticar, isMonitor, validarCorpo(criarDisciplinaSchema), disciplinaController.criar);
```

Com isso, o `trim` manual do controller e o `if (!dados.nome)` do service saem.

### Nome repetido sem diferenciar maiúsculas

- No `disciplinaService.criar`, antes de inserir: `prisma.disciplina.findFirst({ where: { nome: { equals: nome, mode: 'insensitive' } } })`.
- Se existir: `throw new ErroConflito('Já existe uma disciplina com este nome: "<nome salvo>".')`.
- Acentos (“Calculo” = “Cálculo”): comparar `nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()` em memória, já que a lista é pequena. **Sugestão:** só maiúsculas agora, acentos decididos na revisão.
- O `@unique` continua como última barreira contra duas requisições simultâneas. Em `tratarErro.js`, quando o `target` do P2002 for `nome`, trocar a mensagem genérica por uma específica.

### Padronizar as respostas

- Sucesso: `201 { success: true, mensagem: 'Disciplina criada com sucesso.', disciplina }`.
- 403 do `isMonitor`: `{ success: false, erro }`, de preferência lançando um erro de `src/utils/erros.js` para o tratador central montar a resposta.
- **Atenção:** o `isMonitor` também protege as rotas de monitoria. A mensagem deve ficar genérica (“Acesso permitido apenas a monitores.”); o texto específico de disciplinas fica no front.

### Testes: `describe('POST /disciplinas')`

| Cenário                                   | Esperado                                               |
| ----------------------------------------- | ------------------------------------------------------ |
| Monitor com nome válido                   | 201 `success: true`, `create` chamado com o nome limpo |
| `" Cálculo I "`                           | Salvo como `"Cálculo I"`                               |
| Nome vazio ou só espaços                  | 400 com `campos.nome`                                  |
| Mais de 80 caracteres                     | 400                                                    |
| `nome: 123`                               | 400 “Deve ser um texto.”                               |
| Já existe com outra caixa (`"cálculo i"`) | 409 sem chamar `create`                                |
| P2002 vindo do banco (corrida)            | 409 com a mensagem específica                          |
| Aluno                                     | 403 sem chamar `create`                                |
| Sem token                                 | 401                                                    |
| `{ nome, id: 99 }`                        | O `id` é descartado pelo zod                           |

Commits 2 e 3 · ~1 dia

## Frontend: tela e ponto de entrada

### Arquivos

| Arquivo                                   | Conteúdo                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Monipro_web/cadastro_disciplina.html`    | Esqueleto de `escolha_disciplina.html`: header, menu lateral, janela de sair, `#toast-container`, scripts `toast.js`, `config.js`, `api.js`, `base.js` |
| `Monipro_web/JS/cadastro_disciplina.js`   | Acesso, contador, aviso de repetido, envio                                                                                                             |
| `Monipro_web/CSS/cadastro_disciplina.css` | Reaproveita `.dashboard-wrapper` e `.page-header`; botões escopados (a regra global de `button` do `base.css` usa padding 45px e fonte 25px)           |
| `escolha_disciplina.html` e `.js`         | Link “+ Nova disciplina” no `.page-header`, `hidden` por padrão, exibido só para monitor; o mesmo link na lista vazia                                  |

O `Dockerfile` do front já copia `*.html`, `CSS/` e `JS/`. A CSP do Nginx proíbe script inline: nada de `onclick=` no HTML.

### Comportamento do envio

É um `<form>` com `submit`, para o Enter funcionar. Ao enviar: limpar o erro anterior, desativar o botão com “Cadastrando…” e chamar `chamadaApi('/disciplinas', { method: 'POST', body: JSON.stringify({ nome }) })`.

201

Toast de sucesso e ir para `marcar_monitoria.html?disciplinaID=<id>&disciplinaNome=<nome>` para criar a primeira vaga.

400 / 409

`mensagemDaApi(data)` junto ao campo, `aria-invalid="true"`, foco de volta no campo.

401

Sessão expirada: voltar para o login.

rede

Toast “Não foi possível conectar ao servidor.”

- Em todo erro, o botão volta a ficar ativo. Enquanto está desativado, o clique duplo não gera duas requisições.
- **Acesso:** ler o tipo no token, como `marcar_monitoria.js` já faz. Aluno vê o toast “Apenas monitores podem cadastrar disciplinas.” e volta para `escolha_disciplina.html`. Quem barra de verdade é o 403 da API.
- **Aviso de repetido:** com o `GET /disciplinas`, comparar sem diferenciar maiúsculas enquanto o monitor digita e mostrar “Já existe: Cálculo I”. É só um aviso; vale a regra do backend.
- Todo texto vindo da API entra por `textContent` ou `escaparHtml`, nunca `innerHTML` com dado cru.

### Acessibilidade

- Label visível acima do campo; o placeholder é só exemplo. `maxlength="80"`, o mesmo limite do backend, com contador.
- Erro em `<p id="erro-nome" role="alert">`, ligado ao campo por `aria-describedby`. Não depender só do toast, que some em 3 segundos.
- `<button>` e `<a>` de verdade, sem `div role="button"`. Foco visível pela regra `:focus-visible` do `base.css`.
- No celular, os botões ficam empilhados e com largura total, com “Cadastrar” em cima.

Entrega

## Branch, commits e PR

Um PR de `feat/tela-cadastro-disciplinas` para `develop`, nunca push direto. Antes do PR: `npm test` e `npm run lint` passando. Se `fix/ux-correcoes-rapidas` ainda não tiver entrado, a tela funciona igual, só sem o contorno de foco.

1`feat(disciplinas): valida criação com zod e bloqueia nome repetido`

2`feat(web): tela de cadastro de disciplinas`

3`feat(web): botão "Nova disciplina" em Minhas Disciplinas para monitores`

### Estimativa

**0,5 dia**Backend: schema, nome repetido, respostas, testes

**1 dia**Tela: HTML, JS, CSS e botão de entrada

**0,5 dia**Revisão e teste manual

Total: ~2 dias.

Aceite

## Checklist de aceite

- Monitor vê “+ Nova disciplina” em Minhas Disciplinas; aluno não vê.
- Aluno que abre `cadastro_disciplina.html` direto volta para a lista, e a API responde 403.
- Cadastrar “Estrutura de Dados” cria a disciplina, que aparece na lista e aceita vaga.
- Cadastrar “estrutura de dados” de novo mostra o erro junto ao campo (409), sem duplicar.
- Nome vazio ou só com espaços não é enviado; se for, a API responde 400 com a mensagem no campo.
- Clique duplo em “Cadastrar” não cria duas disciplinas.
- Funciona só com o teclado (Tab até o campo, digitar, Enter).
- Layout ok em 360px de largura.
- Testes novos do `POST /disciplinas` passando no CI.

As marcações ficam só neste navegador.
