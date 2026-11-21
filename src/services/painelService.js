// src/services/painelService.js
// Plano 7 (RF-012): painel da coordenação. Indicadores do semestre, tabela de monitores e o
// registro de auditoria. Só leitura neste PR; as ações (assinar e revogar certificados, revisar
// disciplinas) entram nos próximos e gravam a auditoria com `registrar`.

const painelRepository = require('../repositories/painelRepository');
const { periodoDe, limitesDoPeriodo, nomeDoPeriodo, periodoAnterior } = require('../utils/periodo');
const { resumirSemestre, resumirMonitores } = require('../utils/painelCoordenacao');
const { calcularRestricao, DIAS_CONSULTA } = require('../utils/restricao');

const DIA = 24 * 60 * 60 * 1000;
// Quantos semestres aparecem no seletor (o atual e os anteriores)
const SEMESTRES_NO_SELETOR = 4;

function janela(periodo, agora) {
    const { inicio, fim } = limitesDoPeriodo(periodo);
    return { inicio, fim, ate: fim < agora ? fim : agora };
}

/** Quantos alunos estão bloqueados agora pela regra de faltas. */
function contarBloqueados(ausencias, agora) {
    const porAluno = new Map();
    for (const a of ausencias) {
        if (!porAluno.has(a.id_aluno)) porAluno.set(a.id_aluno, []);
        porAluno.get(a.id_aluno).push(a.ausente_em);
    }
    let bloqueados = 0;
    for (const datas of porAluno.values()) if (calcularRestricao(datas, agora)) bloqueados += 1;
    return bloqueados;
}

function semestresDoSeletor(agora) {
    const lista = [periodoDe(agora)];
    while (lista.length < SEMESTRES_NO_SELETOR)
        lista.push(periodoAnterior(lista[lista.length - 1]));
    return lista;
}

class PainelService {
    async resumo(periodo, agora = new Date()) {
        const p = periodo || periodoDe(agora);
        const anterior = periodoAnterior(p);
        const atual = janela(p, agora);
        const antes = janela(anterior, agora);
        // O semestre que ainda não começou não tem vaga para buscar
        const vazio = (j) => j.inicio >= j.ate;
        const [vagas, vagasAntes, ausencias] = await Promise.all([
            vazio(atual) ? [] : painelRepository.buscarVagas(atual.inicio, atual.ate),
            vazio(antes) ? [] : painelRepository.buscarVagas(antes.inicio, antes.ate),
            painelRepository.buscarAusencias(new Date(agora.getTime() - DIAS_CONSULTA * DIA))
        ]);
        const r = resumirSemestre(vagas, { inicio: atual.inicio, fim: atual.fim, agora });
        const a = resumirSemestre(vagasAntes, { inicio: antes.inicio, fim: antes.fim, agora });
        return {
            periodo: p,
            rotulo_periodo: nomeDoPeriodo(p),
            periodos: semestresDoSeletor(agora),
            periodo_anterior: anterior,
            atualizado_em: agora.toISOString(),
            ...r,
            inscricoes: { ...r.inscricoes, bloqueados: contarBloqueados(ausencias, agora) },
            anterior: a.sessoes
                ? {
                      sessoes: a.sessoes,
                      minutos: a.minutos,
                      alunos: a.alunos,
                      taxa_presenca: a.taxa_presenca
                  }
                : null
        };
    }

    async monitores(periodo, agora = new Date()) {
        const p = periodo || periodoDe(agora);
        const j = janela(p, agora);
        if (j.inicio >= j.ate) return [];
        const [vagas, comCertificado] = await Promise.all([
            painelRepository.buscarVagas(j.inicio, j.ate),
            painelRepository.monitoresComCertificado(p)
        ]);
        return resumirMonitores(vagas, { fim: j.fim, agora, comCertificado });
    }

    async auditoria(quantos = 20) {
        return await painelRepository.listarAuditoria(quantos);
    }

    async registrar(dados, db) {
        return await painelRepository.registrar(dados, db);
    }
}

module.exports = new PainelService();
module.exports.contarBloqueados = contarBloqueados;
