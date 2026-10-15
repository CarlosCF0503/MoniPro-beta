// src/controllers/disciplinaController.js
const disciplinaService = require('../services/disciplinaService');
const tratarErro = require('../utils/tratarErro');

class DisciplinaController {
    async listar(req, res) {
        try {
            const disciplinas = await disciplinaService.listar();
            res.json({ success: true, disciplinas });
        } catch (error) {
            console.error('❌ Erro ao listar disciplinas:', error);
            res.status(500).json({
                success: false,
                erro: 'Não foi possível carregar as disciplinas. Tente novamente.'
            });
        }
    }

    async criar(req, res) {
        const { nome } = req.body;

        // Proteção para evitar que o .trim() quebre se "nome" vier vazio/undefined
        if (!nome || typeof nome !== 'string' || !nome.trim()) {
            return res.status(400).json({
                success: false,
                erro: 'O nome da disciplina é obrigatório e deve ser um texto.'
            });
        }

        try {
            const disciplina = await disciplinaService.criar({ nome: nome.trim() });
            res.status(201).json({
                success: true,
                mensagem: 'Disciplina criada com sucesso.',
                disciplina
            });
        } catch (error) {
            console.error('❌ Erro ao criar disciplina:', error);
            const mensagem = tratarErro(error, {
                P2002: 'Já existe uma disciplina com esse nome.',
                default: 'Não foi possível criar a disciplina. Tente novamente.'
            });
            res.status(400).json({ success: false, erro: mensagem });
        }
    }

    async obterRanking(req, res) {
        const idDisciplina = parseInt(req.params.id, 10);

        if (Number.isNaN(idDisciplina)) {
            return res.status(400).json({ success: false, erro: 'ID de disciplina inválido.' });
        }

        try {
            const ranking = await disciplinaService.obterRanking(idDisciplina);
            res.json({ success: true, ranking });
        } catch (error) {
            console.error('❌ Erro ao buscar ranking da disciplina:', error);
            const mensagem = tratarErro(error, {
                naoEncontrado: 'Disciplina não encontrada.',
                default: 'Não foi possível carregar o ranking. Tente novamente.'
            });
            res.status(400).json({ success: false, erro: mensagem });
        }
    }
}

module.exports = new DisciplinaController();
