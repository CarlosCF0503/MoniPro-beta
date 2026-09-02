- Demonstração e Acesso ao Sistema
URL de Produção: https://moni-pro.app.br (Login - MoniPro)

- Visão Geral da Arquitetura e Decisões de Projeto
Domínio de Aplicação: Sistema web para agendamento, gestão e acompanhamento de monitorias acadêmicas.

Módulos Próximos (Roadmap):

RN-001 (Regra das 24h para cancelamento): Planejado para implementação completa nas Tarefas 14 e 15.

Módulo de Gamificação (Moedas/Pontos): Planejado para finalização e integração total nas Tarefas 14 e 15.

Perfil "Coordenações (Módulo Premium)": Movido para o Roadmap de extensões futuras da plataforma.

Documentação de Fluxo e Utilidade das Telas
Fluxo de Autenticação e Entrada
index.html (Landing Page): Apresenta o sistema e redireciona os usuários para login ou cadastro.

login.html: Interface de autenticação via e-mail e senha com validação JWT.

escolha_cadastro.html: Tela de decisão onde o usuário escolhe se criará uma conta de Aluno ou de Monitor.

cadastro.html: Formulário de registro com validações de dados (Nome, E-mail acadêmico, Senha, Matrícula).

Fluxo Principal de Navegação e Agendamento
base.html: Painel principal (Dashboard) após o login, fornecendo atalhos para as funcionalidades essenciais.

escolha_disciplina.html: Catálogo de disciplinas ativas no sistema para seleção de monitoria ou consulta de ranking.

marcar_monitoria.html: Interface interativa com calendário para seleção de datas, horários e criação/confirmação de agendamentos.

Fluxo de Perfil e Painéis de Gestão
perfil.html: Roteador central que identifica o papel do usuário no token JWT e o redireciona para a visão adequada.

perfil_aluno.html: Painel exclusivo do aluno. Exibe informações da conta, saldo de pontos/moedas e a lista de monitorias inscritas (permitindo cancelamento via modal de confirmação).

perfil_monitor.html: Painel exclusivo do monitor. Exibe as vagas criadas, agendamentos sob sua responsabilidade, opções de cancelamento de horários e modal de certificados.

# Especificação Acadêmica

## Tabela de Status de RF e RN (Código Real)

| Código | Descrição | Tipo | Status Atual | Observações / Mapeamento |
| :--- | :--- | :--- | :--- | :--- |
| **RF-001** | Autenticação JWT e Controle de Acesso | Requisito Funcional | **Concluído** | Rotas `/autenticacao` e middlewares ativos no Express. |
| **RF-002** | Agendamento de Monitorias via Calendário | Requisito Funcional | **Concluído** | Interface interativa em `marcar_monitoria.html`. |
| **RF-003** | Gestão de Perfil (Aluno / Monitor) | Requisito Funcional | **Concluído** | Integrado às rotas `/perfil`, `/agendamentos` e `/monitorias`. |
| **RF-004** | Sistema de Gamificação (Ranking/Pontos) | Requisito Funcional | **Planejado** | Estruturado para ser finalizado nas Tarefas 14 e 15. |
| **RN-001** | Cancelamento Prévio com 24h de Antecedência | Regra de Negócio | **Planejado** | Validação no backend em desenvolvimento para as Tarefas 14 e 15. |
| **RN-002** | Isolamento de Perfis e Permissões | Regra de Negócio | **Concluído** | Controle de acesso via middleware de autenticação JWT. |


Seções Acadêmicas (24 a 27)
Seção 24: Qualidade de Código
O projeto adota uma arquitetura RESTful modular no backend (Node.js/Express) com separação em rotas, controladores e middlewares de segurança. No frontend, utiliza-se a centralização de requisições através do helper chamadaApi(), garantindo padronização na comunicação, tratamento único de headers JWT e suporte uniforme a respostas de erro.

Seção 25: Segurança e Infraestrutura
Criptografia: Senhas armazenadas com hashing forte (bcrypt).

Comunicação Segura: SSL/TLS ativo em ambiente de produção via Certbot para o domínio moni-pro.app.br.

Proteção de Rede: Proteção contra solicitações abusivas via express-rate-limit e restrição de origens via middleware CORS.

Seção 26: Extensões e Decisões de Design (Curso / Avaliação / Certificado)
A emissão automática de certificados com base em avaliações de curso foi simplificada para a versão atual. As tabelas complexas de Avaliação e Curso foram temporariamente removidas do escopo ativo e movidas para o roadmap. A exibição de certificados no painel do monitor permanece como um componente visual direto.

Seção 27: Avaliação Geral e Conclusão
A plataforma atende aos critérios fundamentais de usabilidade e integridade para agendamento de monitorias acadêmicas. Os módulos pendentes (Gamificação completa e Regra RN-001 de 24h) possuem infraestrutura preparada e cronograma definido para finalização imediata nas etapas subsequentes.
