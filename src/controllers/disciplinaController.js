// src/controllers/disciplinaController.js
const disciplinaRepository = require('../repositories/disciplinaRepository'); // ✅ import que faltava

exports.listar = async (req, res) => {
    try {
        const disciplinas = await disciplinaRepository.buscarTodas();
        return res.status(200).json({ disciplinas });
    } catch (erro) {
        console.error('Erro ao listar disciplinas:', erro);
        return res.status(500).json({ erro: true, mensagem: 'Erro interno ao buscar disciplinas.' });
    }
};

exports.criar = async (req, res) => { // ✅ método que faltava
    try {
        const { nome } = req.body;
        if (!nome || nome.trim() === '') {
            return res.status(400).json({ erro: true, mensagem: 'O nome da disciplina é obrigatório.' });
        }
        const disciplina = await disciplinaRepository.criar({ nome: nome.trim() });
        return res.status(201).json({ mensagem: 'Disciplina criada com sucesso.', disciplina });
    } catch (erro) {
        console.error('Erro ao criar disciplina:', erro);
        return res.status(500).json({ erro: true, mensagem: 'Erro interno ao criar disciplina.' });
    }
};
