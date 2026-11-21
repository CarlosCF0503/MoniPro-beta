const prisma = require('../config/bancoDeDados');

// Plano 7: quem vê cada disciplina. Pendente (criada por monitor, ainda não revisada) só para
// quem criou e para a coordenação.
function filtroVisivel(usuario) {
    if (usuario.tipo === 'coordenador') return {};
    if (usuario.tipo === 'monitor')
        return { OR: [{ status: 'aprovada' }, { status: 'pendente', id_criador: usuario.id }] };
    return { status: 'aprovada' };
}

class DisciplinaRepository {
    async criar(dados) {
        return await prisma.disciplina.create({
            data: { nome: dados.nome, status: dados.status, id_criador: dados.id_criador }
        });
    }

    async buscarVisiveis(usuario) {
        return await prisma.disciplina.findMany({
            where: filtroVisivel(usuario),
            orderBy: { nome: 'asc' },
            select: { id: true, nome: true, status: true }
        });
    }

    async buscarPorId(id) {
        return await prisma.disciplina.findUnique({
            where: { id },
            select: { id: true, status: true, id_criador: true }
        });
    }

    async buscarPorNome(nome) {
        return await prisma.disciplina.findFirst({
            where: { nome: { equals: nome, mode: 'insensitive' } },
            select: { id: true, nome: true }
        });
    }
}

module.exports = new DisciplinaRepository();
module.exports.filtroVisivel = filtroVisivel;
