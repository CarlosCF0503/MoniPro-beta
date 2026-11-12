// src/repositories/tokenRedefinicaoRepository.js
// RF-008 / RN-009: tokens do link "esqueci minha senha", guardados só como hash SHA-256.

const prisma = require('../config/bancoDeDados');

class TokenRedefinicaoRepository {
    async emTransacao(fn) {
        return await prisma.$transaction(fn);
    }

    // Um link novo invalida os anteriores ainda não usados (RN-009)
    async invalidarAbertos(idUsuario, agora, db = prisma) {
        await db.tokenRedefinicao.updateMany({
            where: { id_usuario: idUsuario, usado_em: null },
            data: { usado_em: agora }
        });
    }

    async criar({ idUsuario, hash, expiraEm }, db = prisma) {
        return await db.tokenRedefinicao.create({
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
        const { count } = await db.tokenRedefinicao.updateMany({
            where: { hash, usado_em: null, expira_em: { gt: agora } },
            data: { usado_em: agora }
        });
        if (count === 0) return null;
        const token = await db.tokenRedefinicao.findUnique({
            where: { hash },
            select: { id_usuario: true }
        });
        return token.id_usuario;
    }

    // Grava a senha nova e revoga todas as sessões abertas (P3: versao_token)
    async trocarSenha(idUsuario, hashSenha, db = prisma) {
        await db.usuario.update({
            where: { id: idUsuario },
            data: { senha: hashSenha, versao_token: { increment: 1 } }
        });
    }
}

module.exports = new TokenRedefinicaoRepository();
