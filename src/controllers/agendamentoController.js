// src/controllers/agendamentoController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
// Tarefa 9: o corpo de criar já chega validado por schemas/agendamentoSchemas.js.
const agendamentoService = require('../services/agendamentoService');
const { obterParametrosPaginacao, montarPaginacao } = require('../utils/paginacao');

class AgendamentoController {
    async criar(req, res) {
        const { id_monitoria, data_hora, data_agendamento } = req.body;

        const agendamento = await agendamentoService.criar({
            id_monitoria,
            id_aluno: req.usuario.id,
            status: 'pendente',
            data_hora: data_hora || data_agendamento
        });
        res.status(201).json({ success: true, agendamento });
    }

    async listar(req, res) {
        const paginacao = obterParametrosPaginacao(req.query);
        const { dados, total } = await agendamentoService.listarPorAluno(req.usuario.id, paginacao);
        res.json({
            success: true,
            agendamentos: dados,
            paginacao: montarPaginacao(paginacao, total)
        });
    }

    async deletar(req, res) {
        await agendamentoService.deletar(parseInt(req.params.id), req.usuario.id);
        res.json({ success: true, mensagem: 'Inscrição cancelada com sucesso.' });
    }

    async concluir(req, res) {
        const idAgendamento = parseInt(req.params.id, 10);
        const resultado = await agendamentoService.concluir(idAgendamento, req.usuario.id);

        res.json({
            success: true,
            mensagem: 'Agendamento concluído e 10 pontos creditados com sucesso!',
            agendamento: resultado
        });
    }
}

module.exports = new AgendamentoController();
