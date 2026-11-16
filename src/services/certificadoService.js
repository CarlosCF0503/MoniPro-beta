// src/services/certificadoService.js
// Certificados (RF-005): elegibilidade da declaração de horas do monitor, por semestre.
// A emissão, o documento e a verificação pública entram nos próximos PRs do plano.

const certificadoRepository = require('../repositories/certificadoRepository');
const { resumirCargaHoraria } = require('../utils/cargaHoraria');
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
}

module.exports = new CertificadoService();
