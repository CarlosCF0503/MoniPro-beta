// src/controllers/disciplinaController.js
const disciplinaService = require('../services/disciplinaService');
const tratarErro        = require('../utils/tratarErro');

class DisciplinaController {
    async criar(req, res) {
        if (!req.body.nome) {
            return res.status(400).json({
                success: false,
                erro: 'O nome da disciplina é obrigatório.'
            });
        }

        try {
            const novaDisciplina = await disciplinaService.criar(req.body);
            res.status(201).json({ success: true, disciplina: novaDisciplina });
        } catch (error) {
            console.error('❌ Erro ao criar disciplina:', error);
            const mensagem = tratarErro(error, {
                P2002:   'Já existe uma disciplina com este nome.',
                default: 'Não foi possível criar a disciplina. Tente novamente.'
            });
            res.status(400).json({ success: false, erro: mensagem });
        }
    }

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
}

module.exports = new DisciplinaController();
