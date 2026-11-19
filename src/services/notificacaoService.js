// src/services/notificacaoService.js
// Plano 3 (RF-010, RN-011): avisos por e-mail ao aluno.
// - inscrição confirmada, vaga alterada (dia, horário ou local), vaga cancelada pelo monitor e
//   lembrete 24h antes. O monitor não recebe aviso por enquanto (decisão do time).
// - Plano 8: "abriu um lugar" para quem sai da lista de espera; quem está na fila também recebe
//   os avisos de vaga alterada e cancelada (com o texto da fila), mas não o lembrete.
// - Quem faz a ação só grava o aviso na fila, na mesma transação: se a ação desfaz, o aviso
//   some junto, e uma queda do provedor de e-mail não atrasa nem quebra nenhuma tela.
// - O backend processa a fila a cada minuto (iniciar), com novas tentativas em caso de falha.

const notificacaoRepository = require('../repositories/notificacaoRepository');
const email = require('./email');
const config = require('../config/notificacoes');
const logger = require('../utils/logger');

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

// Só o que os modelos precisam. Horários vão em ISO e são formatados no envio. Plano 11: o link
// da sala on-line vai só para quem tem lugar (comLink); quem está na fila não recebe.
function dadosDaVaga(vaga, comLink = true) {
    return {
        disciplina: vaga.disciplina.nome,
        id_disciplina: vaga.id_disciplina,
        monitor: vaga.monitor.nome_completo,
        horario: new Date(vaga.horario).toISOString(),
        local: vaga.local,
        ...(vaga.descricao ? { assunto: vaga.descricao } : {}),
        ...(comLink && vaga.modalidade === 'online' && vaga.link ? { link: vaga.link } : {})
    };
}

class NotificacaoService {
    async avisarInscricao({ idAgendamento, idAluno, idMonitoria }, db) {
        const vaga = await notificacaoRepository.buscarVaga(idMonitoria, db);
        await notificacaoRepository.enfileirar(
            [
                {
                    id_usuario: idAluno,
                    modelo: 'inscricao',
                    dados: dadosDaVaga(vaga),
                    chave: `inscricao:agendamento:${idAgendamento}`
                }
            ],
            db
        );
    }

    // Plano 8: saiu da lista de espera e já está inscrito
    async avisarPromocao({ idAgendamento, idAluno, idMonitoria, podeCancelarAteOInicio }, db) {
        const vaga = await notificacaoRepository.buscarVaga(idMonitoria, db);
        await notificacaoRepository.enfileirar(
            [
                {
                    id_usuario: idAluno,
                    modelo: 'espera',
                    dados: {
                        ...dadosDaVaga(vaga),
                        ...(podeCancelarAteOInicio ? { cancelar_ate_inicio: true } : {})
                    },
                    chave: `espera:agendamento:${idAgendamento}`
                }
            ],
            db
        );
    }

    /**
     * Vaga mudou de dia, horário ou local: um aviso para cada inscrito, com o antes e o depois.
     * @param {{ horario: Date, local: string }} antes - como a vaga estava
     */
    async avisarAlteracao(idMonitoria, antes, agora, db) {
        const [vaga, inscritos] = await Promise.all([
            notificacaoRepository.buscarVaga(idMonitoria, db),
            notificacaoRepository.buscarInscritosAtivos(idMonitoria, db)
        ]);
        const dados = dadosDaVaga(vaga);
        const antesIso = new Date(antes.horario).toISOString();
        if (antesIso !== dados.horario) dados.horario_anterior = antesIso;
        if (antes.local !== dados.local) dados.local_anterior = antes.local;
        // Plano 11: o link da sala mudou (o local continua "On-line")
        if (antes.link !== undefined && antes.link !== (vaga.link ?? null) && vaga.link)
            dados.link_alterado = true;
        // Quem está na fila recebe o aviso sem o link (e sem a menção a ele)
        const paraFila = { ...dados, na_fila: true };
        delete paraFila.link;
        delete paraFila.link_alterado;
        await notificacaoRepository.enfileirar(
            inscritos.map((i) => ({
                id_usuario: i.id_aluno,
                modelo: 'vaga-alterada',
                dados: i.status === 'em_espera' ? paraFila : dados,
                chave: `vaga-alterada:agendamento:${i.id}:${agora.toISOString()}`
            })),
            db
        );
    }

    async avisarCancelamento(idMonitoria, db) {
        const [vaga, inscritos] = await Promise.all([
            notificacaoRepository.buscarVaga(idMonitoria, db),
            notificacaoRepository.buscarInscritosAtivos(idMonitoria, db)
        ]);
        await notificacaoRepository.enfileirar(
            inscritos.map((i) => ({
                id_usuario: i.id_aluno,
                modelo: 'vaga-cancelada',
                dados: {
                    ...dadosDaVaga(vaga, false),
                    ...(i.status === 'em_espera' ? { na_fila: true } : {})
                },
                chave: `vaga-cancelada:agendamento:${i.id}`
            })),
            db
        );
        return inscritos.length;
    }

    // Lembretes das sessões que começam entre 20h e 24h a partir de agora. A chave leva o
    // horário: rodar de novo não duplica, e uma vaga que muda de dia ganha um lembrete novo.
    async enfileirarLembretes(agora = new Date()) {
        const sessoes = await notificacaoRepository.buscarSessoesParaLembrete(
            new Date(agora.getTime() + config.HORAS_LEMBRETE_MIN * HORA),
            new Date(agora.getTime() + config.HORAS_LEMBRETE_MAX * HORA)
        );
        if (!sessoes.length) return 0;
        const vagas = new Map();
        const lista = [];
        for (const s of sessoes) {
            if (!vagas.has(s.id_monitoria)) {
                vagas.set(s.id_monitoria, await notificacaoRepository.buscarVaga(s.id_monitoria));
            }
            const horario = new Date(s.data_hora).toISOString();
            lista.push({
                id_usuario: s.id_aluno,
                modelo: 'lembrete',
                dados: dadosDaVaga(vagas.get(s.id_monitoria)),
                chave: `lembrete:agendamento:${s.id}:${horario}`
            });
        }
        return await notificacaoRepository.enfileirar(lista);
    }

    /**
     * Envia os avisos vencidos. Falha soma uma tentativa e adia (1, 5, 15, 60 min); na 5ª,
     * desiste e marca "falhou". Conta removida (LGPD) não recebe nada.
     * @returns {Promise<{enviadas:number, falhas:number}>}
     */
    async processarFila(agora = new Date()) {
        const lote = await notificacaoRepository.reservarLote(
            agora,
            new Date(agora.getTime() + config.MINUTOS_RESERVA * MINUTO),
            config.LOTE
        );
        let enviadas = 0;
        let falhas = 0;
        for (const aviso of lote) {
            const destino = await notificacaoRepository.buscarDestinatario(aviso.id_usuario);
            if (!destino || destino.anonimizado_em) {
                await notificacaoRepository.registrarFalha(aviso.id, {
                    tentativas: aviso.tentativas,
                    erro: 'Conta removida',
                    desistir: true
                });
                continue;
            }
            try {
                await email.enviar({
                    para: destino.email,
                    modelo: aviso.modelo,
                    dados: { ...aviso.dados, nome: destino.nome_completo }
                });
                await notificacaoRepository.marcarEnviada(aviso.id, new Date());
                enviadas += 1;
            } catch (erro) {
                falhas += 1;
                const tentativas = aviso.tentativas + 1;
                const espera =
                    config.ESPERAS_MINUTOS[Math.min(tentativas, config.ESPERAS_MINUTOS.length) - 1];
                await notificacaoRepository.registrarFalha(aviso.id, {
                    tentativas,
                    proximaTentativa: new Date(agora.getTime() + espera * MINUTO),
                    erro: erro.message,
                    desistir: tentativas >= config.MAX_TENTATIVAS
                });
                // Sem destinatário no log: só o aviso e o motivo
                logger.warn(
                    {
                        id_notificacao: aviso.id,
                        modelo: aviso.modelo,
                        tentativas,
                        err: erro.message
                    },
                    'Falha ao enviar aviso por e-mail'
                );
            }
        }
        return { enviadas, falhas };
    }

    // Uma rodada: procura lembretes e envia o que venceu
    async rodar(agora = new Date()) {
        const lembretes = await this.enfileirarLembretes(agora);
        const { enviadas, falhas } = await this.processarFila(agora);
        if (lembretes || enviadas || falhas) {
            logger.info({ lembretes, enviadas, falhas }, 'Fila de avisos processada');
        }
        return { lembretes, enviadas, falhas };
    }

    /**
     * Liga o temporizador da fila (chamado só pelo server.js). Uma rodada nunca começa antes
     * da anterior terminar, e erro numa rodada não derruba o servidor.
     * @returns {() => void} função que desliga o temporizador
     */
    iniciar(intervaloMs = config.intervaloNotificacoesMs()) {
        if (!intervaloMs) return () => {};
        let rodando = false;
        const tique = async () => {
            if (rodando) return;
            rodando = true;
            try {
                await this.rodar();
            } catch (erro) {
                logger.error({ err: erro.message }, 'Erro ao processar a fila de avisos');
            } finally {
                rodando = false;
            }
        };
        const timer = setInterval(tique, intervaloMs);
        timer.unref();
        return () => clearInterval(timer);
    }
}

module.exports = new NotificacaoService();
