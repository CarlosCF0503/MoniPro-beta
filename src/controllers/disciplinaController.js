// src/controllers/disciplinaController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
const disciplinaRepository = require('../repositories/disciplinaRepository');
const disciplinaService = require('../services/disciplinaService');
const { ErroValidacao } = require('../utils/erros');

exports.listar = async (req, res) => {
    const disciplinas = await disciplinaRepository.buscarTodas();
    return res.status(200).json({ disciplinas });
};

exports.criar = async (req, res) => {
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const disciplina = await disciplinaService.criar({ nome });
    return res.status(201).json({ mensagem: 'Disciplina criada com sucesso.', disciplina });
};

exports.obterRanking = async (req, res) => {
    const idDisciplina = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(idDisciplina)) {
        throw new ErroValidacao('ID de disciplina inválido.', { id: 'ID de disciplina inválido.' });
    }

    const ranking = await disciplinaRepository.buscarRankingPorDisciplina(idDisciplina);
    return res.status(200).json({ success: true, ranking });
};
