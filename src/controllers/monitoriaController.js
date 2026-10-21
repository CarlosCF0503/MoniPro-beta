// src/controllers/monitoriaController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
// Tarefa 9: o corpo de criar já chega validado por schemas/monitoriaSchemas.js.
const monitoriaService = require('../services/monitoriaService');
const { obterParametrosPaginacao, montarPaginacao } = require('../utils/paginacao');

class MonitoriaController {
    async criar(req, res) {
        const monitoria = await monitoriaService.criar({
            ...req.body,
            id_monitor: req.usuario.id
        });
        res.status(201).json({ success: true, monitoria });
    }

    async listar(req, res) {
        const paginacao = obterParametrosPaginacao(req.query);
        const { dados, total } = await monitoriaService.listarPorDisciplina(
            req.params.idDisciplina,
            paginacao
        );
        res.json({ monitorias: dados, paginacao: montarPaginacao(paginacao, total) });
    }

    async listarAgendamentosDoMonitor(req, res) {
        const paginacao = obterParametrosPaginacao(req.query);
        const { dados, total } = await monitoriaService.buscarAgendamentosPorMonitor(
            req.usuario.id,
            paginacao
        );
        res.json({
            success: true,
            agendamentos: dados,
            paginacao: montarPaginacao(paginacao, total)
        });
    }

    async cancelar(req, res) {
        const monitoria = await monitoriaService.cancelar(parseInt(req.params.id), req.usuario.id);
        res.json({
            success: true,
            mensagem: 'Vaga de monitoria cancelada com sucesso.',
            monitoria
        });
    }
}

module.exports = new MonitoriaController();
