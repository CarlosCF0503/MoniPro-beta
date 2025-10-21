// Importa o Express
const express = require('express');
// Importa o bcrypt para hashing de senhas
const bcrypt = require('bcrypt');
// Importa o jsonwebtoken para gerenciar sessões
const jwt = require('jsonwebtoken');
// Importa nosso módulo de banco de dados configurado
const db = require('./db');
// Importa o CORS
const cors = require('cors');

// Inicializa a aplicação Express
const app = express();
// Define a porta do servidor
const port = process.env.PORT || 3000;

// ========================================================================= //
// CORREÇÃO: Configuração de CORS para produção
const corsOptions = {
  origin: 'https://moni-pro-beta.vercel.app'
};
app.use(cors(corsOptions));
// ========================================================================= //

app.use(express.json());

// --- ROTA DE CADASTRO (/cadastro) ---
// (Esta rota já está correta e não precisa de alterações)
app.post('/cadastro', async (req, res) => {
    // ... seu código de cadastro ...
});

// --- ROTA DE LOGIN (/login) ---
// (Esta rota já está correta e não precisa de alterações)
app.post('/login', async (req, res) => {
    // ... seu código de login ...
});

// Inicia o servidor para ouvir na porta definida
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);

});

