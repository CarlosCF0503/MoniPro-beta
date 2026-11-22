// src/controllers/monitoriaController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
// Tarefa 9: o corpo de criar já chega validado por schemas/monitoriaSchemas.js.
const monitoriaService = require('../services/monitoriaService');
const listaEsperaService = require('../services/listaEsperaService');
const disciplinaService = require('../services/disciplinaService');
const { obterParametrosPaginacao, montarPaginacao } = require('../utils/paginacao');
const { filtrosListagemSchema } = require('../schemas/monitoriaSchemas');
const { ErroValidacao, ErroNaoEncontrado, ErroNaoAutorizado } = require('../utils/erros');

// Plano 13: filtros da query string. No Express 5 o req.query é só leitura, então a validação
// fica aqui e não no validarCorpo.
function validarFiltros(query) {
    const { periodo, monitor, livres } = query;
    const r = filtrosListagemSchema.safeParse({ periodo, monitor, livres });
    if (!r.success) {
        const issue = r.error.issues[0];
        throw new ErroValidacao(issue.message, { [issue.path.join('.')]: issue.message });
    }
    return r.data;
}

class MonitoriaController {
    async criar(req, res) {
        // Plano 7: em disciplina pendente, só quem a criou abre vaga (para os outros ela não existe)
        try {
            await disciplinaService.exigirVisivel(Number(req.body.id_disciplina), req.usuario);
        } catch (erro) {
            if (!(erro instanceof ErroNaoEncontrado)) throw erro;
            throw new ErroValidacao('A disciplina informada não existe.', {
                id_disciplina: 'A disciplina informada não existe.'
            });
        }
        const resultado = await monitoriaService.criar({
            ...req.body,
            id_monitor: req.usuario.id
        });
        // Plano 9: na série, a resposta traz as vagas criadas e as datas puladas
        if (resultado.criadas) {
            return res.status(201).json({
                success: true,
                monitoria: resultado.criadas[0],
                criadas: resultado.criadas,
                puladas: resultado.puladas
            });
        }
        res.status(201).json({ success: true, monitoria: resultado });
    }

    async listar(req, res) {
        const paginacao = obterParametrosPaginacao(req.query);
        const filtros = validarFiltros(req.query);
        // Plano 7: disciplina pendente responde 404 para quem não pode vê-la
        const idDisciplina = Number(req.params.idDisciplina);
        if (!Number.isInteger(idDisciplina) || idDisciplina <= 0)
            throw new ErroNaoEncontrado('Disciplina não encontrada.');
        await disciplinaService.exigirVisivel(idDisciplina, req.usuario);
        const { dados, total } = await monitoriaService.listarPorDisciplina(
            req.params.idDisciplina,
            paginacao,
            filtros
        );
        res.json({
            monitorias: dados,
            paginacao: montarPaginacao(paginacao, total)
        });
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
    async finalizar(req, res) {
        const monitoria = await monitoriaService.finalizar(
            parseInt(req.params.id, 10),
            req.usuario.id,
            req.body.data_fim
        );
        res.json({
            success: true,
            mensagem: 'Monitoria finalizada com sucesso.',
            monitoria
        });
    }

    async atualizar(req, res) {
        const { monitoria, alterouQuandoOuOnde, inscritos } = await monitoriaService.atualizar(
            parseInt(req.params.id, 10),
            req.usuario.id,
            req.body
        );
        res.json({
            success: true,
            mensagem: 'Vaga de monitoria atualizada com sucesso.',
            monitoria,
            // Inscritos liberados para cancelar sem a regra das 24h (0 se só lugares/assunto mudaram)
            liberados: alterouQuandoOuOnde ? inscritos : 0
        });
    }

    // Plano 8 (RF-013): entra na lista de espera de uma vaga lotada
    async entrarNaFila(req, res) {
        if (req.usuario.tipo !== 'aluno')
            throw new ErroNaoAutorizado('Só alunos entram na lista de espera.');
        const id = parseInt(req.params.id, 10);
        const { agendamento, posicao } = await listaEsperaService.entrar(id, req.usuario.id);
        res.status(201).json({
            success: true,
            mensagem: `Você entrou na lista de espera. Sua posição: ${posicao}º.`,
            agendamento,
            posicao
        });
    }

    // Plano 9: "Cancelar esta e as próximas" da série
    async cancelarProximas(req, res) {
        const r = await monitoriaService.cancelarProximas(
            parseInt(req.params.id, 10),
            req.usuario.id
        );
        const n = r.canceladas.length;
        res.json({
            success: true,
            mensagem: n === 1 ? '1 vaga cancelada.' : `${n} vagas canceladas.`,
            canceladas: r.canceladas,
            mantidas: r.mantidas
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
