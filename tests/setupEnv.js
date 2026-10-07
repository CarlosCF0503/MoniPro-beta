// Garante variáveis obrigatórias (src/config/env.js) antes de qualquer módulo ser carregado nos testes,
// sem depender de um .env real (que não existe no ambiente de CI).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';
process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgres://usuario:senha@localhost:5432/teste';
