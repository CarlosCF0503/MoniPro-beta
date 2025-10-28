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
// Usa a porta do ambiente (Render) ou 3000 como padrão (local)
const port = process.env.PORT || 3000;

// Configuração de CORS para produção
const corsOptions = {
  origin: 'https://moni-pro-beta.vercel.app' // << Garanta que esta é a URL correta do seu Vercel
};
app.use(cors(corsOptions));

app.use(express.json());

// Rota de teste para diagnóstico
app.get('/teste', (req, res) => {
  console.log('A ROTA DE TESTE FOI ACESSADA!');
  res.status(200).json({ success: true, message: 'O servidor está no ar e respondendo!' });
});

// --- ROTA DE CADASTRO (/cadastro) ---
app.post('/cadastro', async (req, res) => {
  const { nome_completo, email, senha, tipo_usuario } = req.body;

  // Validação de Senha Forte
  const senhaForteRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
  if (!senha || !senhaForteRegex.test(senha)) {
      return res.status(400).json({ 
          success: false, 
          message: 'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número.' 
      });
  }

  try {
    // ========================================================================= //
    // NOVA LÓGICA DE MATRÍCULA
    let matriculaParaSalvar;

    // 1. Primeiro, verifica se um usuário com este e-mail JÁ EXISTE, não importa o tipo
    const findUserByEmailQuery = 'SELECT * FROM usuarios WHERE email = $1 LIMIT 1';
    const existingUser = await db.query(findUserByEmailQuery, [email]);

    if (existingUser.rows.length > 0) {
        // Se o usuário já existe, usamos a matrícula dele
        matriculaParaSalvar = existingUser.rows[0].matricula;
    } else {
        // Se é um usuário totalmente novo, pegamos um novo número da sequência
        const newMatriculaResult = await db.query("SELECT nextval('matricula_seq') AS nova_matricula");
        matriculaParaSalvar = newMatriculaResult.rows[0].nova_matricula;
    }

    // 2. Agora, verifica se a combinação de email e TIPO já existe (para evitar duplicação)
    const checkUserQuery = 'SELECT * FROM usuarios WHERE email = $1 AND tipo_usuario = $2';
    const existingProfile = await db.query(checkUserQuery, [email, tipo_usuario]);

    if (existingProfile.rows.length > 0) {
        return res.status(409).json({ 
            success: false, 
            message: `Este e-mail já está cadastrado como ${tipo_usuario}.` 
        });
    }
    // ========================================================================= //

    // 3. Prossegue com o cadastro usando a matrícula correta
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(senha, saltRounds);

    // Adicionada a coluna 'matricula' e o 5º parâmetro ($5)
    const insertQuery = `
      INSERT INTO usuarios (nome_completo, email, senha, tipo_usuario, matricula)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, matricula;
    `;
    const values = [nome_completo, email, senhaHash, tipo_usuario, matriculaParaSalvar];
    const result = await db.query(insertQuery, values);

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      user: result.rows[0],
    });

  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// --- ROTA DE LOGIN (/login) ---
app.post('/login', async (req, res) => {
    // ALTERAÇÃO AQUI: Recebe 'identificador' em vez de 'email'
    const { identificador, senha, tipo_usuario } = req.body;

    if (!identificador || !senha || !tipo_usuario) {
        return res.status(400).json({ success: false, message: 'Identificador, senha e tipo de usuário são obrigatórios.' });
    }

    try {
        // ALTERAÇÃO CRÍTICA: A query agora verifica tanto a coluna de email
        // quanto a de matrícula (convertida para texto para uma comparação segura).
        const findUserQuery = `
            SELECT * FROM usuarios 
            WHERE (email = $1 OR CAST(matricula AS TEXT) = $1) 
            AND tipo_usuario = $2
        `;
        const result = await db.query(findUserQuery, [identificador, tipo_usuario]);

        if (result.rows.length === 0) {
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
            tipo: user.tipo_usuario,
            matricula: user.matricula
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ success: true, message: 'Login bem-sucedido!', token: token });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Inicia o servidor para ouvir na porta definida
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});


