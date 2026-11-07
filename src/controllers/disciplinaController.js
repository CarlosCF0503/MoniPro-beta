// src/controllers/disciplinaController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
const disciplinaService = require('../services/disciplinaService');
const { ErroValidacao } = require('../utils/erros');

exports.listar = async (req, res) => {
    const disciplinas = await disciplinaService.listar();
    return res.status(200).json({ disciplinas });
};

// req.body já passou por criarDisciplinaSchema (nome sem espaços sobrando, 3 a 80 caracteres)
exports.criar = async (req, res) => {
    const disciplina = await disciplinaService.criar({ nome: req.body.nome });
    return res.status(201).json({ mensagem: 'Disciplina criada com sucesso.', disciplina });
};

exports.obterRanking = async (req, res) => {
    const idDisciplina = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(idDisciplina)) {
        throw new ErroValidacao('ID de disciplina inválido.', { id: 'ID de disciplina inválido.' });
    }

    const ranking = await disciplinaService.obterRanking(idDisciplina);
    return res.status(200).json({ success: true, ranking });
};
