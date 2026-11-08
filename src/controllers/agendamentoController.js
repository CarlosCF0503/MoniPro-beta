// src/controllers/agendamentoController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
// Tarefa 9: o corpo de criar já chega validado por schemas/agendamentoSchemas.js.
const agendamentoService = require('../services/agendamentoService');
const { obterParametrosPaginacao, montarPaginacao } = require('../utils/paginacao');
const { PONTOS_MONITOR, PONTOS_ALUNO } = require('../utils/regrasConclusao');

class AgendamentoController {
    async criar(req, res) {
        // Tarefa 31: só id_monitoria vem do cliente. status nasce sempre 'pendente' e a
        // data/hora é derivada do horário da vaga no service.
        const { id_monitoria } = req.body;

        const agendamento = await agendamentoService.criar({
            id_monitoria,
            id_aluno: req.usuario.id,
            status: 'pendente'
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

    // P2 (R4): o monitor dono da vaga confirma a presença do aluno
    async concluir(req, res) {
        const { agendamento, concluiu } = await agendamentoService.registrarPresenca(
            parseInt(req.params.id, 10),
            'monitor',
            req.usuario.id
        );
        res.json({
            success: true,
            concluido: concluiu,
            mensagem: concluiu
                ? `Presença confirmada pelos dois. +${PONTOS_MONITOR} pontos para você e +${PONTOS_ALUNO} para o aluno.`
                : 'Presença registrada. Os pontos entram quando o aluno também confirmar.',
            agendamento
        });
    }

    // P2 (R4): o aluno confirma a própria presença
    async confirmarPresenca(req, res) {
        const { agendamento, concluiu } = await agendamentoService.registrarPresenca(
            parseInt(req.params.id, 10),
            'aluno',
            req.usuario.id
        );
        res.json({
            success: true,
            concluido: concluiu,
            mensagem: concluiu
                ? `Presença confirmada pelos dois. +${PONTOS_ALUNO} pontos para você.`
                : 'Presença registrada. Os pontos entram quando o monitor também confirmar.',
            agendamento
        });
    }
}

module.exports = new AgendamentoController();
