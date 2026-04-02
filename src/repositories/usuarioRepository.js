const prisma = require('../config/bancoDeDados');

class UsuarioRepository {
    async criar(dados) {
        return await prisma.usuario.create({ data: dados });
    }
    async buscarPorEmail(email) {
        return await prisma.usuario.findUnique({ where: { email } });
    }
    async buscarPorMatricula(matricula) {
        return await prisma.usuario.findUnique({ where: { matricula: parseInt(matricula) } });
    }
    async buscarPorId(id) {
        return await prisma.usuario.findUnique({
            where: { id: parseInt(id) },
            select: { id: true, nome_completo: true, email: true, matricula: true, tipo_usuario: true }
        });
    }
}
module.exports = new UsuarioRepository();