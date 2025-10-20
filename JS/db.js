// Importa o pacote 'pg' e extrai a classe Pool
const { Pool } = require('pg');

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Cria uma nova instância do Pool com as configurações do banco de dados
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,

  // ================================================================= //
  // ADICIONADO: Força o uso de uma conexão segura (SSL)
  // Isso é uma exigência da plataforma Aiven.
  ssl: {
    rejectUnauthorized: false
  }
  // ================================================================= //
});

// Exporta um objeto com um método 'query' para ser usado em outras partes da aplicação
module.exports = {
  query: (text, params) => pool.query(text, params),
};