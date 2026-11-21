// src/services/disciplinaService.js
const disciplinaRepository = require('../repositories/disciplinaRepository');
const pontuacaoService = require('./pontuacaoService');
const { ErroConflito, ErroNaoEncontrado } = require('../utils/erros');

/** Plano 7: a pendente só aparece para quem criou e para a coordenação. */
function podeVer(disciplina, usuario) {
    if (!disciplina) return false;
    if (disciplina.status !== 'pendente') return true;
    return usuario.tipo === 'coordenador' || disciplina.id_criador === usuario.id;
}

class DisciplinaService {
    // O nome chega validado pelo schema. A unicidade no banco diferencia maiúsculas,
    // então a comparação sem diferenciar ("cálculo i" = "Cálculo I") é feita aqui.
    // Plano 7: a disciplina criada por monitor nasce pendente; o monitor já pode criar vagas
    // nela, mas os alunos só a veem depois que a coordenação aprova.
    async criar({ nome }, idMonitor) {
        const existente = await disciplinaRepository.buscarPorNome(nome);
        if (existente) {
            throw new ErroConflito(`Já existe uma disciplina com este nome: "${existente.nome}".`);
        }
        return await disciplinaRepository.criar({
            nome,
            status: 'pendente',
            id_criador: idMonitor
        });
    }

    async listar(usuario) {
        return await disciplinaRepository.buscarVisiveis(usuario);
    }

    /** A disciplina, se existir e o usuário puder vê-la; senão, 404 (igual a inexistente). */
    async exigirVisivel(idDisciplina, usuario) {
        const disciplina = await disciplinaRepository.buscarPorId(idDisciplina);
        if (!podeVer(disciplina, usuario)) {
            throw new ErroNaoEncontrado('Disciplina não encontrada.');
        }
        return disciplina;
    }

    async obterRanking(idDisciplina, usuario) {
        await this.exigirVisivel(idDisciplina, usuario);
        return await pontuacaoService.ranking(idDisciplina, usuario.id);
    }
}

module.exports = new DisciplinaService();
module.exports.podeVer = podeVer;
