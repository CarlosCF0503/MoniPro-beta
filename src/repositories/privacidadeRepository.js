// src/repositories/privacidadeRepository.js
// R3 (LGPD): exclusão da conta a pedido do titular e rotina de retenção.
//
// A conta não é apagada, e sim anonimizada: as inscrições e vagas continuam ligadas a ela
// (contagens, ranking e horas do monitor não mudam), mas nome, e-mail, matrícula e senha
// deixam de existir. Apagar a linha quebraria as chaves estrangeiras dessas tabelas.

const prisma = require('../config/bancoDeDados');
const { NOME_ANONIMO, DOMINIO_ANONIMO } = require('../config/retencao');

class PrivacidadeRepository {
    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }

    async buscarSenha(idUsuario) {
        return await prisma.usuario.findUnique({
            where: { id: parseInt(idUsuario) },
            select: { id: true, senha: true, anonimizado_em: true }
        });
    }

    /**
     * Anonimiza a conta e cancela o que ainda ia acontecer: as inscrições futuras do aluno
     * (libera os lugares) e as vagas futuras do monitor. Revoga as sessões (versao_token).
     * @param {number} idUsuario
     * @param {string} hashInutilizavel - hash bcrypt de uma senha aleatória, descartada
     */
    async anonimizar(idUsuario, hashInutilizavel, agora, db = prisma) {
        const id = parseInt(idUsuario);
        await db.agendamento.updateMany({
            where: {
                id_aluno: id,
                status: { in: ['pendente', 'confirmado'] },
                data_hora: { gt: agora }
            },
            data: { status: 'cancelado' }
        });
        await db.monitoria.updateMany({
            where: { id_monitor: id, status: 'ativa', horario: { gt: agora } },
            data: { status: 'cancelada' }
        });
        return await db.usuario.update({
            where: { id },
            data: {
                nome_completo: NOME_ANONIMO,
                email: `removido-${id}${DOMINIO_ANONIMO}`,
                // Negativa: nunca colide com uma matrícula real (o cadastro só aceita positivas)
                matricula: -id,
                senha: hashInutilizavel,
                anonimizado_em: agora,
                ultimo_acesso: null,
                versao_token: { increment: 1 }
            },
            select: { id: true }
        });
    }

    async buscarContasParadas(limite) {
        return await prisma.usuario.findMany({
            where: { anonimizado_em: null, ultimo_acesso: { lt: limite } },
            select: { id: true }
        });
    }

    async contarHistoricoAntigo(limite) {
        const [agendamentos, vagas] = await Promise.all([
            prisma.agendamento.count({ where: { data_hora: { lt: limite } } }),
            prisma.monitoria.count({ where: { horario: { lt: limite } } })
        ]);
        return { agendamentos, vagas };
    }

    // Inscrições primeiro (FK), depois as vagas que ficaram sem nenhuma inscrição
    async apagarHistoricoAntigo(limite, db = prisma) {
        const agendamentos = await db.agendamento.deleteMany({
            where: { data_hora: { lt: limite } }
        });
        const vagas = await db.monitoria.deleteMany({
            where: { horario: { lt: limite }, inscricoes: { none: {} } }
        });
        return { agendamentos: agendamentos.count, vagas: vagas.count };
    }
}

module.exports = new PrivacidadeRepository();
