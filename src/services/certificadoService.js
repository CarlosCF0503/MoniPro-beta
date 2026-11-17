// src/services/certificadoService.js
// Certificados (RF-005): elegibilidade da declaração de horas do monitor, por semestre.
// Emissão (PR 3): uma declaração válida por semestre; emitir de novo substitui a anterior.

const certificadoRepository = require('../repositories/certificadoRepository');
const { resumirCargaHoraria, sessoesQueContam } = require('../utils/cargaHoraria');
const { gerarCodigo } = require('../utils/codigoCertificado');
const { ErroAplicacao, ErroNaoEncontrado } = require('../utils/erros');
const logger = require('../utils/logger');
const { periodoDe, limitesDoPeriodo } = require('../utils/periodo');
const { minimoMinutosCertificado } = require('../config/certificados');

class CertificadoService {
    /**
     * Horas comprovadas do monitor no semestre e o que falta para cada sessão contar.
     * @param {string} [periodo] - "2026.2"; sem ele, o semestre atual
     */
    async elegibilidade(idMonitor, periodo, agora = new Date()) {
        const p = periodo || periodoDe(agora);
        const vagas = await certificadoRepository.buscarVagasDoPeriodo(
            idMonitor,
            limitesDoPeriodo(p),
            agora
        );
        const resumo = resumirCargaHoraria(vagas, agora);
        const minimo = minimoMinutosCertificado();
        return {
            periodo: p,
            minutos: resumo.minutos,
            sessoes: resumo.sessoes,
            minimo_minutos: minimo,
            pode_emitir: resumo.minutos >= minimo,
            por_disciplina: resumo.por_disciplina,
            pendentes: resumo.pendentes
        };
    }
    // Emite a declaração do semestre; a válida anterior do mesmo semestre vira substituída
    async emitir(idMonitor, periodo, agora = new Date()) {
        const atual = periodoDe(agora);
        const p = periodo || atual;
        // Semestre que ainda não começou não tem horas (a comparação de texto funciona: AAAA.N)
        if (p > atual) {
            throw new ErroAplicacao('Escolha um semestre que já começou.', 422);
        }
        const minimo = minimoMinutosCertificado();

        const certificado = await certificadoRepository.emTransacao(async (tx) => {
            const usuario = await certificadoRepository.bloquearUsuario(idMonitor, tx);
            const vagas = await certificadoRepository.buscarVagasDoPeriodo(
                idMonitor,
                limitesDoPeriodo(p),
                agora,
                tx
            );
            const resumo = resumirCargaHoraria(vagas, agora);
            if (resumo.minutos < minimo) {
                throw new ErroAplicacao(
                    `Ainda não há horas suficientes neste semestre: são precisos pelo menos ${minimo} minutos comprovados.`,
                    422
                );
            }
            const substituidas = await certificadoRepository.substituirValidos(idMonitor, p, tx);
            const novo = await certificadoRepository.criar(
                {
                    codigo: gerarCodigo(),
                    id_usuario: idMonitor,
                    periodo: p,
                    carga_minutos: resumo.minutos,
                    // Congelado: o documento não muda se o nome mudar, se a retenção apagar vagas
                    // antigas ou se a regra das horas mudar depois
                    snapshot: {
                        nome: usuario.nome_completo,
                        periodo: p,
                        carga_minutos: resumo.minutos,
                        sessoes_total: resumo.sessoes,
                        por_disciplina: resumo.por_disciplina,
                        sessoes: sessoesQueContam(vagas)
                    }
                },
                tx
            );
            return { novo, substituidas };
        });

        // Sem o código no log: ele dá acesso à verificação pública
        logger.info(
            { id_monitor: idMonitor, periodo: p, substituidas: certificado.substituidas },
            'Declaração de horas emitida'
        );
        return publico(certificado.novo);
    }

    async listar(idMonitor) {
        return await certificadoRepository.listarDoUsuario(idMonitor);
    }
    /** O documento completo, só para o dono. Código de outra pessoa = 404, igual a inexistente. */
    async abrir(codigo, idUsuario) {
        const c = await certificadoRepository.buscarPorCodigo(codigo);
        if (!c || c.id_usuario !== idUsuario)
            throw new ErroNaoEncontrado('Declaração não encontrada.');
        return { ...publico(c), snapshot: c.snapshot };
    }
}

function publico(c) {
    return {
        codigo: c.codigo,
        periodo: c.periodo,
        carga_minutos: c.carga_minutos,
        situacao: c.situacao,
        emitido_em: c.emitido_em
    };
}

module.exports = new CertificadoService();
