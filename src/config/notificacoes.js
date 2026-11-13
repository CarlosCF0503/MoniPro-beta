// src/config/notificacoes.js
// Plano 3 (RF-010, RN-011): ritmo da fila de e-mails de aviso.

// De quanto em quanto tempo o backend processa a fila e procura lembretes. 0 desliga (a pilha
// de testes e quem roda scripts avulsos não precisam do temporizador).
const PADRAO_INTERVALO_SEGUNDOS = 60;

// Quantos avisos cada rodada envia, no máximo
const LOTE = 50;

// Depois de cada falha, espera antes de tentar de novo (minutos). Na 5ª falha, desiste.
const ESPERAS_MINUTOS = [1, 5, 15, 60];
const MAX_TENTATIVAS = 5;

// Um aviso reservado por uma rodada que caiu no meio volta para a fila depois disto
const MINUTOS_RESERVA = 5;

// O lembrete sai para as sessões que começam entre 20h e 24h a partir de agora. Quem se inscreve
// com menos de 20h de antecedência não recebe lembrete: acabou de receber a confirmação.
const HORAS_LEMBRETE_MAX = 24;
const HORAS_LEMBRETE_MIN = 20;

function intervaloNotificacoesMs(env = process.env) {
    const valor = env.NOTIFICACOES_INTERVALO_SEGUNDOS;
    if (valor === undefined || valor === '') return PADRAO_INTERVALO_SEGUNDOS * 1000;
    const segundos = Number(valor);
    return Number.isFinite(segundos) && segundos >= 0
        ? segundos * 1000
        : PADRAO_INTERVALO_SEGUNDOS * 1000;
}

module.exports = {
    LOTE,
    ESPERAS_MINUTOS,
    MAX_TENTATIVAS,
    MINUTOS_RESERVA,
    HORAS_LEMBRETE_MAX,
    HORAS_LEMBRETE_MIN,
    intervaloNotificacoesMs
};
