// Porte de Monipro_web/JS/perfil/dados.js (global PerfilDados) para módulo ES: as mesmas funções
// puras dos perfis do aluno e do monitor, sem mudança de regra. Classificação das vagas e das
// inscrições, presença, horas comprovadas, regra de cancelamento e opções de término.
// O original continua valendo para o Monipro_web e para o Jest (tests/perfilDados.test.js).

export const MESES = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
];
export const MESES_CURTOS = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez'
];
export const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// RN-001: o backend só aceita cancelar com no mínimo 24h de antecedência
export const HORAS_CANCELAMENTO = 24;
// Término oferecido ao finalizar: de 15 em 15 minutos, até 4h depois do início
const TERMINO_PASSO = 15;
const TERMINO_MAXIMO = 240;

// P2 (R4) e D1: aluno e monitor confirmam a presença, cada um do seu lado, depois do início
// da sessão e em até 7 dias. Com as duas confirmações, o monitor ganha +10 e o aluno +2
// (as mesmas regras da API)
export const DIAS_CONFIRMACAO = 7;
export const PONTOS_MONITOR = 10;
export const PONTOS_ALUNO = 2;
const MS_DIA = 24 * 60 * 60 * 1000;

const ATIVAS = ['ativa', 'pendente'];
const REALIZADAS = ['realizada', 'concluida'];

const pad = (n) => String(n).padStart(2, '0');

export function hora(data) {
    return pad(data.getHours()) + ':' + pad(data.getMinutes());
}
export function diaMes(data) {
    return pad(data.getDate()) + '/' + pad(data.getMonth() + 1);
}
export function diaCurto(data) {
    return (
        DIAS_SEMANA[data.getDay()] +
        ', ' +
        pad(data.getDate()) +
        ' ' +
        MESES_CURTOS[data.getMonth()]
    );
}

/** 90 -> "1h30", 60 -> "1h", 45 -> "45min" */
export function duracao(minutos) {
    const total = Math.max(0, Math.round(minutos));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (!h) return m + 'min';
    return h + 'h' + (m ? pad(m) : '');
}

export function iniciais(nome) {
    const partes = String(nome || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!partes.length) return '?';
    const primeira = partes[0][0];
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primeira + ultima).toUpperCase();
}

/**
 * Converte uma monitoria de GET /perfil/monitorias no formato da tela.
 * `inscritos` fica null quando a API ainda não manda o campo.
 */
export function normalizar(m) {
    return {
        id: m.id,
        disciplina: (m.disciplina && m.disciplina.nome) || 'Disciplina',
        local: m.local || 'Local a definir',
        inicio: new Date(m.horario),
        fim: m.data_fim ? new Date(m.data_fim) : null,
        status: String(m.status || '').toLowerCase(),
        capacidade: Number(m.capacidade) || 1,
        inscritos: Number.isInteger(m.inscritos) ? m.inscritos : null,
        descricao: m.descricao || ''
    };
}

/** 'finalizar' (ativa e já começou) | 'proximas' (ativa e futura) | 'historico' */
export function grupo(vaga, agora) {
    if (ATIVAS.includes(vaga.status)) return vaga.inicio < agora ? 'finalizar' : 'proximas';
    return 'historico';
}

/** Separa nas três listas da tela: próximas em ordem de data, histórico do mais recente. */
export function separar(vagas, agora) {
    const finalizar = [];
    const proximas = [];
    const historico = [];
    vagas.forEach((v) => {
        const g = grupo(v, agora);
        if (g === 'finalizar') finalizar.push(v);
        else if (g === 'proximas') proximas.push(v);
        else historico.push(v);
    });
    finalizar.sort((a, b) => a.inicio - b.inicio);
    proximas.sort((a, b) => a.inicio - b.inicio);
    historico.sort((a, b) => b.inicio - a.inicio);
    return { finalizar, proximas, historico };
}

export function realizada(vaga) {
    return REALIZADAS.includes(vaga.status);
}

function minutosDaVaga(vaga) {
    if (!realizada(vaga) || !vaga.fim) return 0;
    return Math.max(0, (vaga.fim - vaga.inicio) / 60000);
}

/** Minutos de monitorias finalizadas (data_fim - horario). */
export function minutosComprovados(vagas) {
    return vagas.reduce((soma, v) => soma + minutosDaVaga(v), 0);
}

/** [{ disciplina, minutos }] das finalizadas, da que tem mais horas para a que tem menos. */
export function horasPorDisciplina(vagas) {
    const mapa = new Map();
    vagas.forEach((v) => {
        const min = minutosDaVaga(v);
        if (min > 0) mapa.set(v.disciplina, (mapa.get(v.disciplina) || 0) + min);
    });
    return Array.from(mapa, ([disciplina, minutos]) => ({ disciplina, minutos })).sort(
        (a, b) => b.minutos - a.minutos
    );
}

/** RN-001: só vagas futuras com 24h ou mais até o início podem ser canceladas. */
export function podeCancelar(vaga, agora) {
    if (grupo(vaga, agora) !== 'proximas') return false;
    return vaga.inicio - agora >= HORAS_CANCELAMENTO * 60 * 60 * 1000;
}

/** Opções de término: [{ minutos, hora: "HH:MM" }] a partir do início. */
export function opcoesTermino(inicio) {
    const lista = [];
    for (let m = TERMINO_PASSO; m <= TERMINO_MAXIMO; m += TERMINO_PASSO) {
        lista.push({ minutos: m, hora: hora(new Date(inicio.getTime() + m * 60000)) });
    }
    return lista;
}

/** Histórico agrupado por mês: [{ rotulo: "Outubro de 2026", vagas }] na ordem recebida. */
export function agruparPorMes(vagas) {
    const grupos = [];
    vagas.forEach((v) => {
        const rotulo = MESES[v.inicio.getMonth()] + ' de ' + v.inicio.getFullYear();
        let g = grupos.find((x) => x.rotulo === rotulo);
        if (!g) {
            g = { rotulo, vagas: [] };
            grupos.push(g);
        }
        g.vagas.push(v);
    });
    return grupos;
}

/** Inscrição da API (monitor ou aluno) no formato da tela. */
export function normalizarInscricao(a) {
    return {
        id: a.id,
        idVaga: a.id_monitoria,
        aluno: (a.aluno && a.aluno.nome_completo) || 'Aluno',
        status: String(a.status || '').toLowerCase(),
        alunoConfirmou: Boolean(a.presenca_aluno_em),
        monitorConfirmou: Boolean(a.presenca_monitor_em)
    };
}

/** Map idVaga -> inscrições em ordem alfabética, sem as canceladas. */
export function agruparInscricoes(lista) {
    const mapa = new Map();
    lista.forEach((i) => {
        if (i.status === 'cancelado') return;
        if (!mapa.has(i.idVaga)) mapa.set(i.idVaga, []);
        mapa.get(i.idVaga).push(i);
    });
    mapa.forEach((l) => l.sort((a, b) => a.aluno.localeCompare(b.aluno, 'pt-BR')));
    return mapa;
}

export function limiteConfirmacao(vaga) {
    return new Date(vaga.inicio.getTime() + DIAS_CONFIRMACAO * MS_DIA);
}

/**
 * Situação da presença vista por um dos lados (lado: 'monitor' ou 'aluno'):
 * 'confirmada' (os dois confirmaram) | 'cancelada' | 'antes' (sessão não começou) |
 * 'expirada' (prazo acabou) | 'aguardando' (este lado já confirmou, falta o outro) |
 * 'confirmar' (este lado ainda pode confirmar)
 */
export function situacaoPresenca(inscricao, vaga, agora, lado) {
    if (inscricao.status === 'concluido') return 'confirmada';
    if (inscricao.status === 'cancelado' || vaga.status === 'cancelada') return 'cancelada';
    if (agora < vaga.inicio) return 'antes';
    if (agora > limiteConfirmacao(vaga)) return 'expirada';
    const jaConfirmou = lado === 'aluno' ? inscricao.alunoConfirmou : inscricao.monitorConfirmou;
    return jaConfirmou ? 'aguardando' : 'confirmar';
}

/** Quantas presenças desta vaga o monitor ainda pode confirmar agora. */
export function presencasAConfirmar(inscricoes, vaga, agora) {
    return (inscricoes || []).filter(
        (i) => situacaoPresenca(i, vaga, agora, 'monitor') === 'confirmar'
    ).length;
}

// --- Perfil do aluno ---

/** Inscrição de GET /perfil/agendamentos no formato do perfil do aluno. */
export function normalizarMinhaInscricao(a) {
    const m = a.monitoria || {};
    return {
        id: a.id,
        disciplina: (m.disciplina && m.disciplina.nome) || 'Disciplina',
        monitor: (m.monitor && m.monitor.nome_completo) || 'Monitor',
        local: m.local || 'Local a definir',
        inicio: new Date(m.horario || a.data_hora),
        fim: m.data_fim ? new Date(m.data_fim) : null,
        status: String(a.status || '').toLowerCase(),
        statusVaga: String(m.status || '').toLowerCase(),
        alunoConfirmou: Boolean(a.presenca_aluno_em),
        monitorConfirmou: Boolean(a.presenca_monitor_em),
        // A vaga mudou de dia, horário ou local depois da inscrição (editar vaga)
        liberado: Boolean(a.liberado_cancelar_em),
        horarioAnterior: a.horario_anterior ? new Date(a.horario_anterior) : null,
        localAnterior: a.local_anterior || null
    };
}

/** Situação da presença vista pelo aluno (ver situacaoPresenca). */
export function situacaoDoAluno(inscricao, agora) {
    return situacaoPresenca(
        inscricao,
        { inicio: inscricao.inicio, status: inscricao.statusVaga },
        agora,
        'aluno'
    );
}

/**
 * Separa nas três listas do perfil do aluno: para confirmar (da mais antiga, que vence
 * antes), próximas (em ordem de data) e histórico (da mais recente).
 */
export function separarInscricoes(lista, agora) {
    const confirmar = [];
    const proximas = [];
    const historico = [];
    lista.forEach((i) => {
        const sit = situacaoDoAluno(i, agora);
        if (sit === 'confirmar') confirmar.push(i);
        else if (sit === 'antes') proximas.push(i);
        else historico.push(i);
    });
    confirmar.sort((a, b) => a.inicio - b.inicio);
    proximas.sort((a, b) => a.inicio - b.inicio);
    historico.sort((a, b) => b.inicio - a.inicio);
    return { confirmar, proximas, historico };
}

/**
 * RN-001: o aluno só cancela a inscrição com 24h ou mais até o início. Se a vaga mudou de
 * dia, horário ou local depois da inscrição, pode cancelar até o início.
 */
export function podeCancelarInscricao(inscricao, agora) {
    if (inscricao.status === 'cancelado' || inscricao.statusVaga === 'cancelada') return false;
    if (inscricao.liberado) return inscricao.inicio > agora;
    return inscricao.inicio - agora >= HORAS_CANCELAMENTO * 60 * 60 * 1000;
}

/** [{ disciplina, n }] das presenças confirmadas pelos dois, da maior para a menor. */
export function presencasPorDisciplina(lista) {
    const mapa = new Map();
    lista.forEach((i) => {
        if (i.status === 'concluido') mapa.set(i.disciplina, (mapa.get(i.disciplina) || 0) + 1);
    });
    return Array.from(mapa, ([disciplina, n]) => ({ disciplina, n })).sort(
        (a, b) => b.n - a.n || a.disciplina.localeCompare(b.disciplina, 'pt-BR')
    );
}

/**
 * O que mudou na vaga desde a inscrição, em frases para o aluno. Fica vazio se a vaga voltou
 * a ser como era (o horário é comparado por minuto).
 */
export function mudancasDaVaga(inscricao) {
    const lista = [];
    const antes = inscricao.horarioAnterior;
    if (antes && Math.floor(antes / 60000) !== Math.floor(inscricao.inicio / 60000))
        lista.push('Horário alterado: era ' + diaCurto(antes) + ' às ' + hora(antes) + '.');
    if (inscricao.localAnterior && inscricao.localAnterior !== inscricao.local)
        lista.push('Local alterado: era ' + inscricao.localAnterior + '.');
    return lista;
}

export function plural(n, um, varios) {
    return n + ' ' + (n === 1 ? um : varios);
}
