// src/controllers/disciplinaController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
const disciplinaService = require('../services/disciplinaService');
const { ErroValidacao } = require('../utils/erros');

exports.listar = async (req, res) => {
    const disciplinas = await disciplinaService.listar(req.usuario);
    return res.status(200).json({ disciplinas });
};

// req.body já passou por criarDisciplinaSchema (nome sem espaços sobrando, 3 a 80 caracteres)
exports.criar = async (req, res) => {
    const disciplina = await disciplinaService.criar({ nome: req.body.nome }, req.usuario.id);
    // Plano 7: fica pendente até a coordenação revisar
    return res.status(201).json({
        success: true,
        mensagem:
            'Disciplina enviada para a coordenação. Você já pode criar vagas nela; os alunos passam a ver depois da aprovação.',
        disciplina
    });
};

exports.obterRanking = async (req, res) => {
    const idDisciplina = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(idDisciplina)) {
        throw new ErroValidacao('ID de disciplina inválido.', { id: 'ID de disciplina inválido.' });
    }

    // Plano 5: só monitores, pontos da disciplina no semestre atual
    const { periodo, ranking } = await disciplinaService.obterRanking(idDisciplina, req.usuario);
    return res.status(200).json({ success: true, periodo, ranking });
};
