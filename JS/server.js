// Importa o Express
const express = require('express');
// Importa o bcrypt para hashing de senhas
const bcrypt = require('bcrypt');
// Importa o jsonwebtoken para gerenciar sessões
const jwt = require('jsonwebtoken');
// Importa o nosso módulo de banco de dados configurado
const db = require('./db');
// Importa o CORS
const cors = require('cors');

// Inicializa a aplicação Express
const app = express();
// Usa a porta do ambiente (Render) ou 3000 como padrão (local)
const port = process.env.PORT || 3000;

// Configuração de CORS para produção
const corsOptions = {
  origin: ['https://moni-pro-beta.vercel.app','http://127.0.0.1:5500']
};
app.use(cors(corsOptions));
app.use(express.json());

// Middleware de Autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    if (token == null) return res.sendStatus(401); 
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); 
        req.user = user; 
        next(); 
    });
};

// --- ROTA DE TESTE ---
app.get('/teste', (req, res) => {
  console.log('A ROTA DE TESTE FOI ACESSADA!');
  res.status(200).json({ success: true, message: 'O servidor está no ar e respondendo!' });
});

// --- ROTA DE CADASTRO (/cadastro) ---
app.post('/cadastro', async (req, res) => {
  const { nome_completo, email, senha, tipo_usuario } = req.body;
  const senhaForteRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
  if (!senha || !senhaForteRegex.test(senha)) {
      return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número.' });
  }
  try {
    let matriculaParaSalvar;
    const findUserByEmailQuery = 'SELECT * FROM usuarios WHERE email = $1 LIMIT 1';
    const existingUser = await db.query(findUserByEmailQuery, [email]);
    if (existingUser.rows.length > 0) {
        matriculaParaSalvar = existingUser.rows[0].matricula;
    } else {
        const newMatriculaResult = await db.query("SELECT nextval('matricula_seq') AS nova_matricula");
        matriculaParaSalvar = newMatriculaResult.rows[0].nova_matricula;
    }
    const checkUserQuery = 'SELECT * FROM usuarios WHERE email = $1 AND tipo_usuario = $2';
    const existingProfile = await db.query(checkUserQuery, [email, tipo_usuario]);
    if (existingProfile.rows.length > 0) {
        return res.status(409).json({ success: false, message: `Este e-mail já está cadastrado como ${tipo_usuario}.` });
    }
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(senha, saltRounds);
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
    console.error('Erro ao cadastrar utilizador:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// --- ROTA DE LOGIN (/login) ---
app.post('/login', async (req, res) => {
    const { identificador, senha, tipo_usuario } = req.body;
    if (!identificador || !senha || !tipo_usuario) {
        return res.status(400).json({ success: false, message: 'Identificador, senha e tipo de utilizador são obrigatórios.' });
    }
    try {
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

// --- ROTAS DE PERFIL ---
app.get('/perfil', authenticateToken, async (req, res) => {
    try {
        const findUserQuery = 'SELECT nome_completo, email, tipo_usuario, matricula FROM usuarios WHERE id = $1';
        const result = await db.query(findUserQuery, [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        }
        res.status(200).json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Erro ao buscar perfil do utilizador:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// <<<<<<<<<<<< ATUALIZAÇÃO AQUI (ALUNOS) >>>>>>>>>>>>
// Busca os agendamentos feitos pelo aluno logado
app.get('/perfil/agendamentos', authenticateToken, async (req, res) => {
    if (req.user.tipo !== 'aluno') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    
    try {
        const query = `
            SELECT 
                a.id AS agendamento_id, -- <<< ADICIONADO ID DO AGENDAMENTO
                a.data_hora, 
                a.status,
                d.nome AS disciplina_nome,
                u.nome_completo AS monitor_nome
            FROM Agendamento a
            JOIN Monitoria m ON a.id_monitoria = m.id
            JOIN Disciplina d ON m.id_disciplina = d.id
            JOIN usuarios u ON m.id_monitor = u.id
            WHERE a.id_aluno = $1
            ORDER BY a.data_hora DESC
        `;
        const result = await db.query(query, [req.user.id]);
        res.status(200).json({ success: true, agendamentos: result.rows });
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// <<<<<<<<<<<< ATUALIZAÇÃO AQUI (MONITORES) >>>>>>>>>>>>
// Busca as monitorias (vagas) criadas pelo monitor logado
app.get('/perfil/monitorias', authenticateToken, async (req, res) => {
    if (req.user.tipo !== 'monitor') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    try {
        const query = `
            SELECT 
                m.id AS monitoria_id, -- <<< "m.id" RENOMEADO PARA CLAREZA
                m.horario, 
                m.local, 
                m.status,
                d.nome AS disciplina_nome
            FROM Monitoria m
            JOIN Disciplina d ON m.id_disciplina = d.id
            WHERE m.id_monitor = $1
            ORDER BY m.horario DESC
        `;
        const result = await db.query(query, [req.user.id]);
        res.status(200).json({ success: true, monitorias: result.rows });
    } catch (error) {
        console.error('Erro ao buscar monitorias criadas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// --- ROTAS DE MONITORIA E AGENDAMENTO ---
app.get('/disciplinas', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT id, nome FROM Disciplina ORDER BY nome');
        res.status(200).json({ success: true, disciplinas: result.rows });
    } catch (error) {
        console.error('Erro ao buscar disciplinas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/monitorias/:disciplinaId', authenticateToken, async (req, res) => {
    const { disciplinaId } = req.params;
    try {
        const query = `
            SELECT m.id AS monitoria_id, u.nome_completo, m.horario, m.local, m.descricao
            FROM Monitoria m
            JOIN usuarios u ON m.id_monitor = u.id
            WHERE m.id_disciplina = $1 AND u.tipo_usuario = 'monitor' AND m.status = 'ativa'
        `;
        const result = await db.query(query, [disciplinaId]);
        res.status(200).json({ success: true, monitorias: result.rows });
    } catch (error) {
        console.error('Erro ao buscar monitorias:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/monitoria', authenticateToken, async (req, res) => {
    if (req.user.tipo !== 'monitor') {
        return res.status(403).json({ success: false, message: 'Apenas monitores podem criar monitorias.' });
    }
    const { id_disciplina, horario, descricao, local } = req.body;
    const id_monitor = req.user.id; 
    if (!id_disciplina || !horario || !local) {
        return res.status(400).json({ success: false, message: 'Disciplina, horário e local são obrigatórios.' });
    }
    try {
        const insertQuery = `
            INSERT INTO Monitoria (id_monitor, id_disciplina, horario, descricao, local, status)
            VALUES ($1, $2, $3, $4, $5, 'ativa')
            RETURNING *
        `;
        const values = [id_monitor, id_disciplina, horario, descricao, local];
        const result = await db.query(insertQuery, values);
        res.status(201).json({ success: true, monitoria: result.rows[0] });
    } catch (error) {
        console.error('Erro ao criar monitoria:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ========================================================================= //
// ATUALIZAÇÃO: ROTA DE AGENDAMENTO COM VERIFICAÇÃO
// ========================================================================= //
app.post('/agendamento', authenticateToken, async (req, res) => {
    // Apenas alunos podem agendar
    if (req.user.tipo !== 'aluno') {
        return res.status(403).json({ success: false, message: 'Apenas alunos podem agendar monitorias.' });
    }
        
    const { id_monitoria, data_agendamento } = req.body;
    const id_aluno = req.user.id; // O id_aluno é pego do token

    if (!id_monitoria || !data_agendamento) {
        return res.status(400).json({ success: false, message: 'ID da monitoria e data são obrigatórios.' });
    }

    try {
        // <<<<<<<<<<<<<<< CORREÇÃO DE LÓGICA ADICIONADA AQUI >>>>>>>>>>>>
        // 1. Verifica se o aluno já está inscrito nesta vaga
        const checkQuery = `SELECT * FROM Agendamento WHERE id_aluno = $1 AND id_monitoria = $2`;
        const checkResult = await db.query(checkQuery, [id_aluno, id_monitoria]);

        if (checkResult.rows.length > 0) {
            // Se encontrou um registo, retorna um erro 409 (Conflict)
            return res.status(409).json({ success: false, message: 'Você já está inscrito nesta vaga de monitoria.' });
        }
        // <<<<<<<<<<<<<<< FIM DA CORREÇÃO >>>>>>>>>>>>

        // 2. Se não houver conflito, insere o novo agendamento
        const insertQuery = `
            INSERT INTO Agendamento (id_monitoria, id_aluno, data_hora, status)
            VALUES ($1, $2, $3, 'pendente')
            RETURNING *
        `;
        const values = [id_monitoria, id_aluno, data_agendamento];
        const result = await db.query(insertQuery, values);
        
        res.status(201).json({ success: true, agendamento: result.rows[0] });

    } catch (error) {
        // Este catch agora irá apanhar outros erros (como falha de conexão)
        console.error('Erro ao criar agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ========================================================================= //
// NOVAS ROTAS: Cancelamento de Agendamento e Monitoria
// ========================================================================= //

// <<<<<<<<<<<< NOVA ROTA (ALUNO) >>>>>>>>>>>>
// Aluno "sai" de um agendamento (APAGA O AGENDAMENTO)
app.delete('/agendamento/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; // ID do Agendamento
    const id_aluno = req.user.id; // ID do Aluno (do token)

    try {
        // Verifica se o agendamento pertence ao aluno logado antes de apagar
        const deleteQuery = `
            DELETE FROM Agendamento
            WHERE id = $1 AND id_aluno = $2
            RETURNING *
        `;
        const result = await db.query(deleteQuery, [id, id_aluno]);

        if (result.rows.length === 0) {
            // Se não apagou nada, ou o agendamento não existe ou não pertence ao aluno
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado ou não pertence a você.' });
        }

        res.status(200).json({ success: true, message: 'Você saiu da monitoria.' });
    } catch (error) {
        console.error('Erro ao sair do agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// <<<<<<<<<<<< NOVA ROTA (MONITOR) >>>>>>>>>>>>
// Monitor "cancela" uma monitoria (MUDA O STATUS)
app.put('/monitoria/:id/cancelar', authenticateToken, async (req, res) => {
    const { id } = req.params; // ID da Monitoria
    const id_monitor = req.user.id; // ID do Monitor (do token)

    try {
        // Verifica se a monitoria pertence ao monitor logado antes de atualizar
        const updateQuery = `
            UPDATE Monitoria
            SET status = 'cancelada'
            WHERE id = $1 AND id_monitor = $2
            RETURNING *
        `;
        const result = await db.query(updateQuery, [id, id_monitor]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Monitoria não encontrada ou não pertence a você.' });
        }

        // TODO: No futuro, você pode querer notificar os alunos inscritos
        res.status(200).json({ success: true, message: 'Monitoria cancelada.' });
    } catch (error) {
        console.error('Erro ao cancelar monitoria:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Inicia o servidor para ouvir na porta definida
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});


