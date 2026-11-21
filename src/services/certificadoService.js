// src/services/certificadoService.js
// Certificados (RF-005): elegibilidade da declaração de horas do monitor, por semestre.
// Emissão (PR 3): uma declaração válida por semestre; emitir de novo substitui a anterior.

const certificadoRepository = require('../repositories/certificadoRepository');
const { resumirCargaHoraria, sessoesQueContam } = require('../utils/cargaHoraria');
const { gerarCodigo, normalizarCodigo } = require('../utils/codigoCertificado');
const { ErroAplicacao, ErroNaoEncontrado } = require('../utils/erros');
const logger = require('../utils/logger');
const { periodoDe, limitesDoPeriodo } = require('../utils/periodo');
const { minimoMinutosCertificado } = require('../config/certificados');

// Tamanho do motivo da revogação (fica gravado e no log)
const MOTIVO_MIN = 5;
const MOTIVO_MAX = 500;

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
    /**
     * Verificação pública (PR 4): só o necessário para conferir o documento. Nunca e-mail,
     * matrícula, id nem a lista de sessões. O nome vem do snapshot: continua igual mesmo se a
     * conta mudar de nome ou for excluída (D-C4).
     */
    async verificar(codigo) {
        const c = await certificadoRepository.buscarPorCodigo(codigo);
        if (!c) throw new ErroNaoEncontrado('Nenhuma declaração com este código.');
        return {
            nome: c.snapshot.nome,
            periodo: c.periodo,
            carga_minutos: c.carga_minutos,
            emitido_em: c.emitido_em,
            situacao: c.situacao,
            ...assinatura(c),
            ...(c.situacao === 'revogado' ? { revogado_em: c.revogado_em } : {})
        };
    }

    /** O documento completo, só para o dono. Código de outra pessoa = 404, igual a inexistente. */
    async abrir(codigo, idUsuario) {
        const c = await certificadoRepository.buscarPorCodigo(codigo);
        if (!c || c.id_usuario !== idUsuario)
            throw new ErroNaoEncontrado('Declaração não encontrada.');
        return { ...publico(c), snapshot: c.snapshot };
    }

    /**
     * Revogação (PR 5), só pelo script scripts/certificados.js até existir o perfil
     * Administrador. Sem `aplicar`, só devolve o que faria. Vale para a válida e para a
     * substituída; a verificação pública passa a mostrar "Revogada" na hora.
     */
    async revogar(codigoDigitado, motivoDigitado, { aplicar = false, agora = new Date() } = {}) {
        const codigo = normalizarCodigo(codigoDigitado);
        if (!codigo) throw new ErroAplicacao('O código tem 26 letras e números.', 400);
        const motivo = String(motivoDigitado || '').trim();
        if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX)
            throw new ErroAplicacao(
                `Informe o motivo da revogação (de ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres).`,
                400
            );

        const c = await certificadoRepository.buscarPorCodigo(codigo);
        if (!c) throw new ErroNaoEncontrado('Nenhuma declaração com este código.');
        if (c.situacao === 'revogado')
            throw new ErroAplicacao(
                'Esta declaração já foi revogada em ' + c.revogado_em.toISOString() + '.',
                409
            );

        const declaracao = {
            nome: c.snapshot.nome,
            periodo: c.periodo,
            carga_minutos: c.carga_minutos,
            emitido_em: c.emitido_em,
            situacao: c.situacao
        };
        if (!aplicar) return { aplicado: false, declaracao, motivo };

        const alteradas = await certificadoRepository.revogar(c.id, motivo, agora);
        if (!alteradas) throw new ErroAplicacao('Esta declaração acabou de ser revogada.', 409);

        // Rastro da revogação (sem o código, como na emissão): id, quem era o titular e o motivo
        logger.info(
            {
                id_certificado: c.id,
                id_usuario: c.id_usuario,
                periodo: c.periodo,
                situacao_anterior: c.situacao,
                motivo
            },
            'Declaração de horas revogada'
        );
        return {
            aplicado: true,
            declaracao: { ...declaracao, situacao: 'revogado', revogado_em: agora },
            motivo
        };
    }
}

// Plano 7: quem da coordenação assinou e quando (nada, se ainda não foi assinado)
function assinatura(c) {
    return c.assinado_em ? { assinado_em: c.assinado_em, assinante: c.assinante_nome } : {};
}

function publico(c) {
    return {
        codigo: c.codigo,
        periodo: c.periodo,
        carga_minutos: c.carga_minutos,
        situacao: c.situacao,
        emitido_em: c.emitido_em,
        ...assinatura(c)
    };
}

module.exports = new CertificadoService();
