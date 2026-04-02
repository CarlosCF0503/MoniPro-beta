// src/controllers/agendamentoController.js
const agendamentoService = require('../services/agendamentoService');
const tratarErro         = require('../utils/tratarErro');

class AgendamentoController {
    async criar(req, res) {
        const { id_monitoria, data_hora, data_agendamento } = req.body;
        const dataFinal = data_hora || data_agendamento;

        if (!id_monitoria) {
            return res.status(400).json({
                success: false,
                erro: 'Selecione uma monitoria antes de agendar.'
            });
        }

        try {
            const agendamento = await agendamentoService.criar({
                id_monitoria: parseInt(id_monitoria),
                id_aluno:     req.usuario.id,
                status:       req.body.status || 'pendente',
                data_hora:    dataFinal
            });
            res.status(201).json({ success: true, agendamento });
        } catch (error) {
            console.error('❌ Erro ao criar agendamento:', error);
            const mensagem = tratarErro(error, {
                P2003:   'A monitoria selecionada não existe ou foi cancelada.',
                P2025:   'A monitoria selecionada não foi encontrada.',
                default: 'Não foi possível realizar o agendamento. Tente novamente.'
            });
            res.status(400).json({ success: false, erro: mensagem });
        }
    }

    async listar(req, res) {
        try {
            const agendamentos = await agendamentoService.listarPorAluno(req.usuario.id);
            res.json({ success: true, agendamentos });
        } catch (error) {
            console.error('❌ Erro ao buscar agendamentos:', error);
            res.status(500).json({
                success: false,
                erro: 'Não foi possível carregar seus agendamentos. Tente novamente.'
            });
        }
    }

    async deletar(req, res) {
        try {
            await agendamentoService.deletar(parseInt(req.params.id), req.usuario.id);
            res.json({ success: true, mensagem: 'Inscrição cancelada com sucesso.' });
        } catch (error) {
            console.error('❌ Erro ao deletar agendamento:', error);
            const mensagem = tratarErro(error, {
                naoEncontrado:  'Agendamento não encontrado.',
                naoAutorizado:  'Você não tem permissão para cancelar este agendamento.',
                default:        'Não foi possível cancelar o agendamento. Tente novamente.'
            });
            const status = error.message?.includes('autorizado') ? 403 : 400;
            res.status(status).json({ success: false, erro: mensagem });
        }
    }
}

module.exports = new AgendamentoController();
