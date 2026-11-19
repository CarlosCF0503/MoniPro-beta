// src/services/restricaoService.js
// Plano 12 (RN-016): bloqueio de novas inscrições por faltas. Usado na inscrição, na entrada na
// lista de espera e no perfil do aluno (GET /perfil/restricao).

const agendamentoRepository = require('../repositories/agendamentoRepository');
const { calcularRestricao, DIAS_CONSULTA } = require('../utils/restricao');
const { FALTAS_PARA_BLOQUEAR, DIAS_JANELA } = require('../config/faltas');
const { ErroAplicacao } = require('../utils/erros');

const DIA = 24 * 60 * 60 * 1000;

function formatarAte(data) {
    return data.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

class RestricaoService {
    /** null = pode se inscrever; senão { ate, faltas }. */
    async restricaoDe(idAluno, agora = new Date(), db) {
        const datas = await agendamentoRepository.datasDeAusencia(
            idAluno,
            new Date(agora.getTime() - DIAS_CONSULTA * DIA),
            db
        );
        return calcularRestricao(datas, agora);
    }

    /** Recusa a nova inscrição (ou a entrada na fila) de quem está bloqueado: 423 com a data. */
    async exigirSemRestricao(idAluno, db) {
        const r = await this.restricaoDe(idAluno, new Date(), db);
        if (!r) return;
        const faltas = Math.max(r.faltas, FALTAS_PARA_BLOQUEAR);
        throw new ErroAplicacao(
            `Você faltou a ${faltas} monitorias nos últimos ${DIAS_JANELA} dias. Novas inscrições ficam bloqueadas até ${formatarAte(r.ate)}.`,
            423,
            'bloqueado_por_faltas'
        );
    }
}

module.exports = new RestricaoService();
