const prisma = require('../config/bancoDeDados');

class PerfilRepository {
    async buscarPerfilCompleto(idUsuario) {
        return await prisma.usuario.findUnique({
            where: { id: parseInt(idUsuario) },
            select: {
                id: true,
                nome_completo: true,
                email: true,
                matricula: true,
                tipo_usuario: true,
                // Pode incluir os agendamentos do utilizador se a relação existir no schema.prisma
                // agendamentos: true
            }
        });
    }
}

module.exports = new PerfilRepository();