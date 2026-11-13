// src/repositories/tokenConfirmacaoRepository.js
// Plano 14 (RF-018, RN-017): tokens do link de confirmação do e-mail, guardados só como hash.

const prisma = require('../config/bancoDeDados');

class TokenConfirmacaoRepository {
    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }

    // Um link novo invalida os anteriores ainda não usados (RN-017)
    async invalidarAbertos(idUsuario, agora, db = prisma) {
        await db.tokenConfirmacaoEmail.updateMany({
            where: { id_usuario: idUsuario, usado_em: null },
            data: { usado_em: agora }
        });
    }

    async criar({ idUsuario, hash, expiraEm }, db = prisma) {
        return await db.tokenConfirmacaoEmail.create({
            data: { id_usuario: idUsuario, hash, expira_em: expiraEm },
            select: { id: true }
        });
    }

    /**
     * Marca o token como usado só se ele ainda vale (não usado e não vencido), numa única
     * escrita. Duas requisições com o mesmo token ao mesmo tempo: só uma consegue.
     * @returns {Promise<number|null>} id do usuário dono do token, ou null se não vale
     */
    async consumir(hash, agora, db = prisma) {
        const { count } = await db.tokenConfirmacaoEmail.updateMany({
            where: { hash, usado_em: null, expira_em: { gt: agora } },
            data: { usado_em: agora }
        });
        if (count === 0) return null;
        const token = await db.tokenConfirmacaoEmail.findUnique({
            where: { hash },
            select: { id_usuario: true }
        });
        return token.id_usuario;
    }

    // Grava a confirmação só se ainda não havia uma: a data da primeira confirmação fica
    async marcarConfirmado(idUsuario, agora, db = prisma) {
        await db.usuario.updateMany({
            where: { id: idUsuario, email_confirmado_em: null },
            data: { email_confirmado_em: agora }
        });
    }
}

module.exports = new TokenConfirmacaoRepository();
