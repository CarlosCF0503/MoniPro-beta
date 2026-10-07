// src/controllers/disciplinaController.js
const disciplinaService = require('../services/disciplinaService'); //o controller estava chamando o repository diretamente, agora chama o service, e o service chama o repository.

exports.listar = async (req, res) => {
    try {
        const disciplinas = await disciplinaService.listar();
        return res.status(200).json({ disciplinas });
    } catch (erro) {
        console.error('Erro ao listar disciplinas:', erro);
        return res.status(500).json({ erro: true, mensagem: 'Erro interno ao buscar disciplinas.' });
    }
};

exports.criar = async (req, res) => {
    try {
        const { nome } = req.body;
        
        // Proteção para evitar que o .trim() quebre se "nome" vier vazio/undefined
        if (!nome || typeof nome !== 'string') {
            return res.status(400).json({ erro: true, mensagem: 'O nome da disciplina é obrigatório e deve ser um texto.' });
        }

        const disciplina = await disciplinaService.criar({ nome: nome.trim() }); 
        return res.status(201).json({ mensagem: 'Disciplina criada com sucesso.', disciplina });
    } catch (erro) {
        console.error('Erro ao criar disciplina:', erro);
        return res.status(400).json({ erro: true, mensagem: erro.message || 'Erro interno ao criar disciplina.' });
    }
};

exports.obterRanking = async (req, res) => {
    try {
        const idDisciplina = parseInt(req.params.id, 10);

        // ✅ Chamando o SERVICE ao invés de acessar o REPOSITORY diretamente
        const ranking = await disciplinaService.obterRanking(idDisciplina);
        
        return res.status(200).json({ success: true, ranking });
    } catch (erro) {
        console.error('Erro ao buscar ranking da disciplina:', erro);
        return res.status(400).json({ erro: true, mensagem: erro.message || 'Erro interno ao buscar ranking.' });
    }
};