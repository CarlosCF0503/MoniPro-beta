// src/utils/painelCoordenacao.js
// Plano 7 (RF-012): as contas do painel da coordenação, a partir das vagas de um semestre já
// lidas do banco (uma consulta só; ver painelRepository). Funções puras, sem acesso ao banco.
//
// Regras (as mesmas do resto do sistema):
// - Sessão realizada = vaga finalizada com pelo menos uma presença confirmada pelos dois lados
//   (src/utils/cargaHoraria.js); vale data_fim − horario, no máximo 4h.
// - Presença = inscrições concluídas ÷ (concluídas + faltas marcadas pelo monitor).
// - Semanas de segunda a domingo e turnos (manhã, tarde, noite) no fuso do campus, UTC−3 o ano
//   todo (src/utils/periodo.js e src/config/turnos.js).

const { minutosDaSessao } = require('./cargaHoraria');
const { TURNOS } = require('../config/turnos');

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const SEMANA = 7 * DIA;
const DESLOCAMENTO_CAMPUS = -3 * HORA;
const FINALIZADAS = ['realizada', 'concluida'];
const SEMANAS_DO_MONITOR = 8;
// Segunda a sábado: domingo quase não tem vaga e só alargaria o mapa
const DIAS_DO_MAPA = 6;

/** Instante em que começa (segunda, 00:00 no campus) a semana que contém `data`. */
function inicioDaSemana(data) {
    const local = new Date(new Date(data).getTime() + DESLOCAMENTO_CAMPUS);
    const diasDesdeSegunda = (local.getUTCDay() + 6) % 7;
    const meiaNoite = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    return new Date(meiaNoite - diasDesdeSegunda * DIA - DESLOCAMENTO_CAMPUS);
}

/** Dia da semana (0 = segunda ... 6 = domingo) e hora no campus. */
function diaEHoraNoCampus(data) {
    const local = new Date(new Date(data).getTime() + DESLOCAMENTO_CAMPUS);
    return { dia: (local.getUTCDay() + 6) % 7, hora: local.getUTCHours() };
}

function turnoDaHora(hora) {
    return Object.keys(TURNOS).find((t) => hora >= TURNOS[t][0] && hora < TURNOS[t][1]);
}

/** A vaga conta como sessão realizada? */
function ehSessao(vaga) {
    return (
        FINALIZADAS.includes(vaga.status) &&
        Boolean(vaga.data_fim) &&
        vaga.inscricoes.some((i) => i.status === 'concluido')
    );
}

/** Em que pé ficou cada inscrição de uma vaga que já passou. */
function situacaoDaInscricao(vaga, inscricao) {
    if (inscricao.status === 'concluido') return 'presentes';
    if (inscricao.ausente_em) return 'faltas';
    if (vaga.status === 'cancelada') return 'canceladas_monitor';
    return 'sem_confirmacao';
}

const taxa = (presentes, faltas) =>
    presentes + faltas ? Math.round((presentes / (presentes + faltas)) * 1000) / 1000 : null;

/**
 * Semanas de `inicio` até `ate` (exclusivo), com quantas sessões começaram em cada uma.
 * A última é parcial (semana em andamento) quando o semestre ainda não acabou e `ate` (agora)
 * cai no meio dela.
 */
function porSemana(sessoes, inicio, ate, emAndamento) {
    const semanas = [];
    for (let t = inicioDaSemana(inicio).getTime(); t < ate.getTime(); t += SEMANA) {
        semanas.push({
            inicio: new Date(t),
            sessoes: 0,
            parcial: emAndamento && t + SEMANA > ate.getTime()
        });
    }
    if (!semanas.length) return semanas;
    const primeira = semanas[0].inicio.getTime();
    for (const v of sessoes) {
        const i = Math.floor((inicioDaSemana(v.horario).getTime() - primeira) / SEMANA);
        if (semanas[i]) semanas[i].sessoes += 1;
    }
    return semanas;
}

/**
 * Indicadores do semestre.
 * @param {Array} vagas - vagas que começaram no semestre até agora (com as canceladas), cada uma
 *   com { horario, data_fim, status, disciplina, id_monitor, inscricoes: [{ id_aluno, status,
 *   ausente_em }] }, sem a lista de espera
 * @param {{ inicio: Date, fim: Date, agora: Date }} janela
 */
function resumirSemestre(vagas, { inicio, fim, agora }) {
    const ate = fim < agora ? fim : agora;
    const sessoes = vagas.filter(ehSessao);
    const alunos = new Set();
    const inscricoes = { presentes: 0, faltas: 0, sem_confirmacao: 0, canceladas_monitor: 0 };
    const procura = Object.fromEntries(
        Object.keys(TURNOS).map((t) => [t, new Array(DIAS_DO_MAPA).fill(0)])
    );
    const disciplinas = new Map();
    let minutos = 0;

    for (const v of vagas) {
        const { dia, hora } = diaEHoraNoCampus(v.horario);
        for (const i of v.inscricoes) {
            inscricoes[situacaoDaInscricao(v, i)] += 1;
            if (i.status === 'concluido') alunos.add(i.id_aluno);
            if (dia < DIAS_DO_MAPA) procura[turnoDaHora(hora)][dia] += 1;
        }
    }
    for (const v of sessoes) {
        const m = minutosDaSessao(v.horario, v.data_fim);
        minutos += m;
        disciplinas.set(v.disciplina, (disciplinas.get(v.disciplina) || 0) + m);
    }

    return {
        sessoes: sessoes.length,
        minutos,
        alunos: alunos.size,
        faltas: inscricoes.faltas,
        taxa_presenca: taxa(inscricoes.presentes, inscricoes.faltas),
        por_semana: porSemana(sessoes, inicio, ate, agora < fim),
        por_disciplina: [...disciplinas]
            .map(([nome, min]) => ({ nome, minutos: min }))
            .sort((a, b) => b.minutos - a.minutos || a.nome.localeCompare(b.nome)),
        inscricoes,
        procura
    };
}

/** nenhum | pendente (emitido, esperando a assinatura) | assinado */
function situacaoDoCertificado(comCertificado, idMonitor) {
    if (!comCertificado.has(idMonitor)) return 'nenhum';
    return comCertificado.get(idMonitor) ? 'assinado' : 'pendente';
}

/**
 * Uma linha por monitor que teve vaga no semestre, das mais horas para as menos.
 * @param {Array} vagas - as mesmas de resumirSemestre, com monitor: { nome, email }
 * @param {{ fim: Date, agora: Date, comCertificado: Map<number, boolean> }} opcoes - id do
 *   monitor com certificado válido no semestre -> true se a coordenação já assinou
 */
function resumirMonitores(vagas, { fim, agora, comCertificado = new Map() }) {
    const ate = fim < agora ? fim : agora;
    const ultimaSemana = inicioDaSemana(new Date(ate.getTime() - 1)).getTime();
    const primeiraSemana = ultimaSemana - (SEMANAS_DO_MONITOR - 1) * SEMANA;
    const porMonitor = new Map();

    for (const v of vagas) {
        let m = porMonitor.get(v.id_monitor);
        if (!m) {
            m = {
                id: v.id_monitor,
                nome: v.monitor.nome,
                email: v.monitor.email,
                disciplinas: new Set(),
                sessoes: 0,
                minutos: 0,
                alunos: new Set(),
                presentes: 0,
                faltas: 0,
                semanas: new Array(SEMANAS_DO_MONITOR).fill(0)
            };
            porMonitor.set(v.id_monitor, m);
        }
        if (v.status !== 'cancelada') m.disciplinas.add(v.disciplina);
        for (const i of v.inscricoes) {
            if (i.status === 'concluido') {
                m.presentes += 1;
                m.alunos.add(i.id_aluno);
            } else if (i.ausente_em) m.faltas += 1;
        }
        if (!ehSessao(v)) continue;
        m.sessoes += 1;
        m.minutos += minutosDaSessao(v.horario, v.data_fim);
        const s = Math.floor((inicioDaSemana(v.horario).getTime() - primeiraSemana) / SEMANA);
        if (s >= 0 && s < SEMANAS_DO_MONITOR) m.semanas[s] += 1;
    }

    return [...porMonitor.values()]
        .map((m) => ({
            id: m.id,
            nome: m.nome,
            email: m.email,
            disciplinas: [...m.disciplinas].sort((a, b) => a.localeCompare(b)),
            sessoes: m.sessoes,
            minutos: m.minutos,
            alunos: m.alunos.size,
            presenca: taxa(m.presentes, m.faltas),
            semanas: m.semanas,
            certificado: situacaoDoCertificado(comCertificado, m.id)
        }))
        .sort(
            (a, b) => b.minutos - a.minutos || b.sessoes - a.sessoes || a.nome.localeCompare(b.nome)
        );
}

module.exports = {
    inicioDaSemana,
    diaEHoraNoCampus,
    turnoDaHora,
    ehSessao,
    resumirSemestre,
    resumirMonitores
};
