const prisma = require('../config/bancoDeDados');

class UsuarioRepository {
    async criar(dados) {
        return await prisma.usuario.create({ data: dados });
    }

    // Trocado para findFirst e adicionado o tipo_usuario
    async buscarPorEmail(email, tipo_usuario) {
        return await prisma.usuario.findFirst({
            where: {
                email: email,
                tipo_usuario: tipo_usuario
            }
        });
    }

    // Trocado para findFirst e adicionado o tipo_usuario
    async buscarPorMatricula(matricula, tipo_usuario) {
        return await prisma.usuario.findFirst({
            where: {
                matricula: parseInt(matricula),
                tipo_usuario: tipo_usuario
            }
        });
    }

    // Plano 14: corrigir o e-mail de uma conta que ainda não confirmou
    async atualizarEmail(id, email) {
        await prisma.usuario.update({ where: { id: parseInt(id) }, data: { email } });
    }

    // R3 (LGPD): o último login conta o prazo de retenção de contas paradas
    async registrarAcesso(id, quando = new Date()) {
        await prisma.usuario.update({
            where: { id: parseInt(id) },
            data: { ultimo_acesso: quando }
        });
    }

    // O ID continua sendo único no banco, então o findUnique continua funcionando perfeitamente aqui!
    async buscarPorId(id) {
        return await prisma.usuario.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                nome_completo: true,
                email: true,
                matricula: true,
                tipo_usuario: true
            }
        });
    }
}

module.exports = new UsuarioRepository();
