# MoniPro

> Plataforma digital de gestão de monitorias acadêmicas.

**Projeto Integrador · 6º Período · Engenharia de Software — UniEVANGÉLICA**

---

## Sobre o Projeto

O MoniPro resolve um problema real nos programas de monitoria de instituições de ensino superior: a gestão manual via planilhas, grupos de mensagens e controle de frequência impreciso. A plataforma centraliza em um único ambiente o agendamento de monitorias, a autenticação de alunos e monitores, o rastreamento de horas complementares e a emissão de certificados.

**Usuários atendidos:**
- **Alunos** — encontram monitores disponíveis e agendam sessões online
- **Monitores** — gerenciam vagas, acompanham inscrições e acumulam pontos de gamificação
- **Coordenações** — acessam relatórios e validam participação (módulo premium)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (Fetch API) |
| Backend | Node.js, Express 5 |
| ORM | Prisma |
| Banco de dados | PostgreSQL (Aiven) |
| Autenticação | JWT (HS256) + bcryptjs |
| Hospedagem frontend | Vercel |
| Hospedagem backend | Render |

---

## Demonstração

- **Frontend:** https://moni-pro-beta.vercel.app
- **API:** https://monipro-api.onrender.com

---

## Estrutura do Projeto

```
MoniPro-beta-main/
├── Monipro_web/          # Frontend (HTML, CSS, JS, imagens)
│   ├── index.html
│   ├── cadastro.html
│   ├── escolha_disciplina.html
│   ├── marcar_monitoria.html
│   ├── CSS/
│   ├── JS/
│   └── IMG/
└── src/                  # Backend (API REST)
    ├── app.js
    ├── server.js
    ├── config/
    │   └── bancoDeDados.js
    ├── routes/
    ├── controllers/
    ├── services/
    ├── repositories/
    ├── middlewares/
    └── utils/
```

O backend segue **Layered Architecture** com responsabilidades bem separadas:

- `routes/` — mapeamento dos endpoints HTTP
- `middlewares/` — validação de JWT antes das rotas protegidas
- `controllers/` — recebem a requisição e delegam ao service
- `services/` — regras de negócio (cancelamento com 24h de antecedência, validação de perfil, gamificação)
- `repositories/` — operações no banco via Prisma

---

## Instalação e Execução Local

**Pré-requisitos:** Node.js 18+, acesso a um banco PostgreSQL (local ou remoto, ex: Aiven)

```bash
# 1. Entre na pasta do backend
cd MoniPro-beta-main

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com sua DATABASE_URL (string de conexão do Aiven) e JWT_SECRET

# 3. Instale as dependências (o postinstall já gera o Prisma Client automaticamente)
npm install --ignore-scripts
npm run generate

# 4. Inicie o servidor em modo desenvolvimento
npm run dev
```

O servidor sobe em `http://localhost:3000`.

> **Por que `--ignore-scripts`?**
> O Prisma normalmente tenta baixar binários nativos do domínio `binaries.prisma.sh`, que pode ser bloqueado por proxies ou firewalls. O script `generate.js` usa o engine WASM embutido no pacote e não precisa de nenhum download adicional.

> **Migrations:** o banco já está configurado no Aiven com as migrations aplicadas. Para rodar em um banco local do zero:
> ```bash
> npx prisma migrate deploy
> ```

---

## Variáveis de Ambiente

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
JWT_SECRET=sua_chave_secreta
PORT=3000
```

---

## API — Endpoints

### Autenticação (públicos)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/cadastro` | Cria novo usuário |
| POST | `/auth/login` | Retorna JWT (24h) |
| GET | `/auth/disciplinas` | Lista disciplinas disponíveis |

### Agendamentos (requer Bearer token)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/agendamentos` | Cria agendamento (RN-001: mín. 24h de antecedência) |
| GET | `/agendamentos` | Lista agendamentos do usuário |
| DELETE | `/agendamentos/:id` | Cancela agendamento |

### Monitorias (requer Bearer token)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/monitorias` | Cria vaga de monitoria (somente monitor) |
| GET | `/monitorias/:idDisciplina` | Lista vagas por disciplina (público) |
| GET | `/monitorias/monitor/agendamentos` | Lista inscrições do monitor |
| PUT | `/monitorias/:id/cancelar` | Cancela vaga de monitoria |

### Disciplinas (requer Bearer token)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/disciplinas` | Cadastra disciplina (somente monitor) |
| GET | `/disciplinas` | Lista todas as disciplinas |

### Perfil (requer Bearer token)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/perfil` | Dados do usuário autenticado |
| GET | `/perfil/agendamentos` | Agendamentos do perfil |
| GET | `/perfil/monitorias` | Monitorias do perfil |

**Padrão de resposta:**
```json
// Sucesso
{ "success": true, "message": "...", "data": { ... } }

// Erro
{ "success": false, "message": "...", "error": "..." }
```

---

## Autenticação

O fluxo JWT funciona assim:

1. `POST /auth/login` com `{ email, senha, perfil }` → retorna `{ token }`
2. Todas as rotas protegidas exigem o header: `Authorization: Bearer <token>`
3. O middleware `autenticacaoMiddleware.js` valida o token e extrai `id` e `tipo` do usuário
4. Token com validade de **24 horas**; expirado, a API retorna `401 Unauthorized`

---

## Regras de Negócio

| ID | Regra |
|---|---|
| RN-001 | Cancelamento de agendamento só é permitido com mínimo de 24h de antecedência |
| RN-002 | Somente usuários com `tipo: monitor` podem criar vagas de monitoria |
| RN-003 | Um usuário não pode se inscrever em uma vaga com o perfil errado |
| RN-006 | Um mesmo e-mail pode ter os perfis `aluno` e `monitor` simultaneamente |

---

## Segurança

- Senhas armazenadas com **hash bcrypt**
- Tokens JWT assinados com **HS256** e expiração de 24h
- Prisma ORM previne **SQL Injection**
- CORS configurado na API

---

## Testes

Os testes de integração foram realizados com **Postman**. O fluxo completo validado:

```
Cadastro → Login → JWT → Criar Vaga → Agendar → Cancelar
```

Códigos HTTP validados: `200`, `201`, `400`, `401`, `403`, `409`.

---

## Equipe

| Nome | Papel |
|---|---|
| Carlos | Dev Líder / P.O. |
| Deivison | QA / Tester |
| Isaac | Analista de Negócios |
| Miguel | Designer UI/UX |

---

## Licença

Projeto acadêmico desenvolvido para o Projeto Integrador do curso de Engenharia de Software — UniEVANGÉLICA.
