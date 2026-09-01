// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Rotas
const autenticacaoRotas = require('./routes/autenticacaoRotas');
const agendamentoRotas = require('./routes/agendamentoRotas');
const disciplinaRotas = require('./routes/disciplinaRotas');
const monitoriaRotas = require('./routes/monitoriaRotas');
const perfilRotas = require('./routes/perfilRotas');

// Middlewares globais
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);

app.use(helmet());
app.use(
    cors({
        origin(origem, callback) {
            // Requisições sem Origin (server-to-server, apps mobile, curl) são permitidas
            if (!origem || allowedOrigins.includes(origem)) {
                callback(null, true);
            } else {
                callback(new Error('Não permitido pelo CORS'));
            }
        }
    })
);
app.use(express.json());

// Endpoints
app.use('/auth', autenticacaoRotas);
app.use('/agendamentos', agendamentoRotas);
app.use('/disciplinas', disciplinaRotas);
app.use('/monitorias', monitoriaRotas);
app.use('/perfil', perfilRotas);
// Rota de teste
app.get('/teste', (req, res) => {
    res.json({ mensagem: 'O servidor atualizado está respondendo!' });
});
module.exports = app;
