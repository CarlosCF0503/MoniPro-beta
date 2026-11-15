// src/services/pontuacaoService.js
// Plano 5 (RN-008 revisada, RF-011): extrato de pontos e ranking por disciplina e semestre.
// - Cada ponto é um evento com motivo, disciplina e semestre; o saldo continua em Usuario.pontos.
// - O ranking mostra só monitores, zera a cada semestre e nunca expõe e-mail nem matrícula.
// - A posição de um aluno só aparece para ele mesmo, no extrato.

const pontuacaoRepository = require('../repositories/pontuacaoRepository');
const { PONTOS_MONITOR, PONTOS_ALUNO } = require('../utils/regrasConclusao');
const { periodoDe, limitesDoPeriodo } = require('../utils/periodo');

const LIMITE_EXTRATO = 50;
const TAMANHO_RANKING = 10;

const TEXTO_EVENTO = {
    presenca_aluno: 'Presença confirmada',
    sessao_monitor: 'Monitoria com presença confirmada',
    saldo_inicial: 'Saldo anterior ao extrato',
    estorno: 'Estorno'
};

// Lugar de quem tem `pontos` numa lista ordenada: empate divide a mesma posição
const lugarDe = (lista, pontos) => 1 + lista.filter((g) => g.pontos > pontos).length;

class PontuacaoService {
    /**
     * D1: presença confirmada pelos dois lados vale +10 para o monitor e +2 para o aluno.
     * Grava os dois eventos na transação da confirmação; a chave por inscrição impede somar
     * de novo.
     */
    async creditarPresenca(
        { idAgendamento, idMonitor, idAluno, idDisciplina },
        db,
        agora = new Date()
    ) {
        const periodo = periodoDe(agora);
        const base = { id_disciplina: idDisciplina, id_agendamento: idAgendamento, periodo };
        await pontuacaoRepository.registrar(
            {
                ...base,
                id_usuario: idMonitor,
                tipo: 'sessao_monitor',
                pontos: PONTOS_MONITOR,
                chave: `sessao_monitor:agendamento:${idAgendamento}`
            },
            db
        );
        await pontuacaoRepository.registrar(
            {
                ...base,
                id_usuario: idAluno,
                tipo: 'presenca_aluno',
                pontos: PONTOS_ALUNO,
                chave: `presenca_aluno:agendamento:${idAgendamento}`
            },
            db
        );
    }

    /** RF-011: saldo, últimos eventos e a posição da própria pessoa no semestre. */
    async extrato(idUsuario, agora = new Date()) {
        const periodo = periodoDe(agora);
        const [conta, eventos, idDisciplina] = await Promise.all([
            pontuacaoRepository.buscarSaldo(idUsuario),
            pontuacaoRepository.buscarEventos(idUsuario, LIMITE_EXTRATO),
            pontuacaoRepository.buscarDisciplinaPrincipal(idUsuario, periodo)
        ]);

        let posicao = null;
        if (conta && idDisciplina) {
            const lista = await pontuacaoRepository.somarPorUsuario(
                idDisciplina,
                periodo,
                conta.tipo_usuario
            );
            const minha = lista.find((g) => g.id_usuario === idUsuario);
            if (minha) {
                posicao = {
                    disciplina: await pontuacaoRepository.buscarNomeDisciplina(idDisciplina),
                    lugar: lugarDe(lista, minha.pontos),
                    total: lista.length
                };
            }
        }

        return {
            saldo: conta ? conta.pontos : 0,
            periodo,
            posicao,
            eventos: eventos.map((e) => ({
                tipo: e.tipo,
                texto: TEXTO_EVENTO[e.tipo] || e.tipo,
                disciplina: e.disciplina ? e.disciplina.nome : null,
                data: e.criado_em,
                pontos: e.pontos
            }))
        };
    }

    /**
     * Ranking de monitores de uma disciplina no semestre atual: só nome, pontos, monitorias
     * finalizadas e horas. `voce` marca a linha de quem está vendo, sem expor ids.
     */
    async ranking(idDisciplina, idQuemVe, agora = new Date()) {
        const periodo = periodoDe(agora);
        const lista = (
            await pontuacaoRepository.somarPorUsuario(idDisciplina, periodo, 'monitor')
        ).slice(0, TAMANHO_RANKING);
        if (!lista.length) return { periodo, ranking: [] };

        const ids = lista.map((g) => g.id_usuario);
        const [nomes, sessoes] = await Promise.all([
            pontuacaoRepository.buscarNomes(ids),
            pontuacaoRepository.buscarSessoes(ids, idDisciplina, limitesDoPeriodo(periodo))
        ]);
        const nomePorId = new Map(nomes.map((u) => [u.id, u.nome_completo]));
        const resumo = new Map();
        for (const s of sessoes) {
            const r = resumo.get(s.id_monitor) || { sessoes: 0, minutos: 0 };
            r.sessoes += 1;
            r.minutos += Math.max(
                0,
                Math.round((new Date(s.data_fim) - new Date(s.horario)) / 60000)
            );
            resumo.set(s.id_monitor, r);
        }

        return {
            periodo,
            ranking: lista.map((g) => ({
                posicao: lugarDe(lista, g.pontos),
                nome: nomePorId.get(g.id_usuario),
                pontos: g.pontos,
                sessoes: (resumo.get(g.id_usuario) || {}).sessoes || 0,
                minutos: (resumo.get(g.id_usuario) || {}).minutos || 0,
                voce: g.id_usuario === idQuemVe
            }))
        };
    }
}

module.exports = new PontuacaoService();
module.exports.TEXTO_EVENTO = TEXTO_EVENTO;
