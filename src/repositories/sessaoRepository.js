// src/repositories/sessaoRepository.js
// P3 (R7): versão da sessão de cada usuário. O JWT leva a versão do momento do login, e o
// middleware a compara com a do banco a cada requisição. O "sair" incrementa a versão, o que
// invalida todos os tokens emitidos antes, inclusive cópias roubadas.

const prisma = require('../config/bancoDeDados');

class SessaoRepository {
    // Retorna a versão atual, ou null se o usuário não existe mais.
    async buscarVersao(idUsuario) {
        const usuario = await prisma.usuario.findUnique({
            where: { id: parseInt(idUsuario) },
            select: { versao_token: true }
        });
        return usuario ? usuario.versao_token : null;
    }

    async incrementarVersao(idUsuario) {
        await prisma.usuario.update({
            where: { id: parseInt(idUsuario) },
            data: { versao_token: { increment: 1 } }
        });
    }
}

module.exports = new SessaoRepository();
