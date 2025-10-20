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
const port = 3000;

// ========================================================================= //
// MANUTENÇÃO DE SEGURANÇA: Configuração de CORS para produção
const corsOptions = {
  // Permite acesso apenas do seu front-end na Vercel
  origin: 'https://moni-pro-tela-de-login-funcional.vercel.app' 
};
app.use(cors(corsOptions));
// ========================================================================= //

app.use(express.json());

// --- ROTA DE CADASTRO (/cadastro) ---
// (Esta rota já está correta e não precisa de manutenção)
app.post('/cadastro', async (req, res) => {
    // ... seu código de cadastro continua o mesmo ...
});

// --- ROTA DE LOGIN (/login) ---
app.post('/login', async (req, res) => {
    // ========================================================================= //
    // MANUTENÇÃO DE LÓGICA: Agora recebemos o tipo_usuario do front-end
    const { email, senha, tipo_usuario } = req.body;

    if (!email || !senha || !tipo_usuario) {
        return res.status(400).json({ success: false, message: 'E-mail, senha e tipo de usuário são obrigatórios.' });
    }
    // ========================================================================= //

    try {
        // ========================================================================= //
        // MANUTENÇÃO DE LÓGICA: A query agora busca pela combinação exata
        const findUserQuery = 'SELECT * FROM usuarios WHERE email = $1 AND tipo_usuario = $2';
        const result = await db.query(findUserQuery, [email, tipo_usuario]);
        // ========================================================================= //

        if (result.rows.length === 0) {
            // A mensagem agora pode ser mais genérica, pois o tipo pode estar errado
            return res.status(401).json({ success: false, message: 'Credenciais inválidas ou perfil não encontrado.' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(senha, user.senha);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas ou perfil não encontrado.' });
        }

        const payload = { 
            id: user.id, 
            email: user.email, 
            tipo: user.tipo_usuario 
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ success: true, message: 'Login bem-sucedido!', token: token });

    } catch (error) inaction {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Inicia o servidor para ouvir na porta definida
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});