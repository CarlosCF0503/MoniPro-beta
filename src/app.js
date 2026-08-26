// src/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(express.json());

// Rotas
const autenticacaoRotas = require('./routes/autenticacaoRotas');
const agendamentoRotas  = require('./routes/agendamentoRotas');
const disciplinaRotas   = require('./routes/disciplinaRotas');
const monitoriaRotas    = require('./routes/monitoriaRotas');
const perfilRotas       = require('./routes/perfilRotas');


app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    :[];

const CorsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Acesso bloqueado pela  política de CORS'));
        }
    }
};

// Middlewares globais
app.use(cors({
    origin: [
        'https://moni-pro-b-orm.vercel.app',
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'http://127.0.0.1:5501', 
        'http://localhost:5501',  
        'http://localhost:3000',
        'https://moni-pro-beta-git-carlos-carlos-cruzs-projects-38b28e08.vercel.app',
        'https://moni-pro-beta-git-orm-carlos-cruzs-projects-38b28e08.vercel.app'
    ]
}));


// Endpoints
app.use('/auth',         autenticacaoRotas);
app.use('/agendamentos', agendamentoRotas);
app.use('/disciplinas',  disciplinaRotas);
app.use('/monitorias',   monitoriaRotas);
app.use('/perfil',       perfilRotas);

// Rota de teste
app.get('/teste', (req, res) => {
    res.json({ mensagem: 'O servidor atualizado está respondendo!' });
});
module.exports = app;
