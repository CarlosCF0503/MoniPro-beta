// JS/marcar/tela_aluno.js
// Tela de marcar monitoria (aluno): filtros (plano 13), calendário, horários do dia e confirmação,
// nas montagens de computador (calendário + coluna) e celular (passo a passo).

import { escaparHtml } from '../api.js';
import { MarcarDatas } from './datas.js';
import { MarcarComponentes } from './componentes.js';

const D = MarcarDatas;
const C = MarcarComponentes;
const esc = escaparHtml;
// Plano 8: com menos que isso até o início, a lista de espera não anda (src/config/listaEspera.js)
const HORAS_FILA = 2;

/**
 * Monta a tela de marcar monitoria (aluno) a partir do estado `S`. Os eventos ficam em JS/marcar/tela.js.
 */
export function criarTelaAluno({ desktop, disciplinaNome, S, filtradas, calendario, erroCarga }) {
    // --- 6. Aluno ---
    // Plano 13 (RF-017): período, monitor e só com lugar livre. Calendário e lista mostram só o
    // que combina; o resumo é anunciado pelo leitor de tela.
    function barraFiltros() {
        const f = S.filtros;
        const monitores = D.monitoresDe(S.vagas);
        const periodo = D.TURNOS.map(
            ([valor, rotulo]) =>
                '<button type="button" class="f-op" data-acao="periodo" data-valor="' +
                valor +
                '" aria-pressed="' +
                (f.periodo === valor) +
                '">' +
                rotulo +
                '</button>'
        ).join('');
        const opcoes =
            '<option value="">Todos</option>' +
            monitores
                .map(
                    (m) =>
                        '<option value="' +
                        esc(m.id) +
                        '"' +
                        (String(m.id) === f.monitor ? ' selected' : '') +
                        '>' +
                        esc(m.nome) +
                        '</option>'
                )
                .join('');
        const total = D.vagasFuturas(S.vagas, new Date()).length;
        const mostradas = D.vagasFuturas(filtradas(), new Date()).length;
        const ativos = D.filtrosAtivos(f);
        return (
            '<div class="filtros" role="group" aria-labelledby="filtros-titulo">' +
            '<p class="filtros-titulo" id="filtros-titulo">' +
            C.icone('filtro', 16) +
            'Filtrar horários</p>' +
            '<div class="f-grupo" role="group" aria-label="Período do dia"><span class="f-rotulo" aria-hidden="true">Período</span><div class="f-ops">' +
            periodo +
            '</div></div>' +
            (monitores.length > 1
                ? '<label class="f-grupo"><span class="f-rotulo">Monitor</span><select id="filtro-monitor">' +
                  opcoes +
                  '</select></label>'
                : '') +
            '<label class="f-chk"><input type="checkbox" id="filtro-livres"' +
            (f.livres ? ' checked' : '') +
            '>Só com lugar livre</label>' +
            '<p class="filtros-resumo" aria-live="polite">' +
            (ativos
                ? '<span>' +
                  D.plural(mostradas, 'horário', 'horários') +
                  ' de ' +
                  total +
                  '</span><button type="button" class="f-limpar" data-acao="limpar-filtros">Limpar filtros</button>'
                : '') +
            '</p></div>'
        );
    }
    function semCombinar() {
        return (
            '<div class="vazio vazio-filtro"><p>Nenhum horário deste dia combina com os filtros.</p>' +
            '<button type="button" class="btn sec" data-acao="limpar-filtros">Limpar filtros</button></div>'
        );
    }
    function lista(semTitulo) {
        if (!S.dia) return '<p class="vazio">Selecione um dia disponível (marcado em azul).</p>';
        const vagas = D.vagasDoDia(filtradas(), S.dia);
        if (!vagas.length && D.vagasDoDia(S.vagas, S.dia).length) return semCombinar();
        if (!vagas.length)
            return '<p class="vazio">Nenhuma monitoria encontrada para este dia.</p>';
        return (
            '<div class="lista" aria-live="polite">' +
            (semTitulo
                ? ''
                : '<p class="rotulo">' +
                  esc(D.diaLongo(D.deChave(S.dia))) +
                  ' · ' +
                  D.plural(vagas.length, 'horário', 'horários') +
                  '</p>') +
            '<div class="lista-itens">' +
            vagas.map((v) => C.cardVaga(v, { selecionada: v.id === S.vagaId })).join('') +
            '</div></div>'
        );
    }

    // Plano 8: revisão da vaga lotada, para entrar na lista de espera
    function revisaoFila(v) {
        const botoes =
            S.erro && S.erroDefinitivo
                ? '<div class="linha acoes"><button type="button" class="btn" data-acao="voltar">Ver outros horários</button></div>'
                : '<div class="linha acoes"><button type="button" class="btn sec" data-acao="voltar">Trocar horário</button>' +
                  '<button type="button" class="btn" data-acao="confirmar"' +
                  (S.enviando ? ' disabled aria-busy="true"' : '') +
                  '>' +
                  (S.enviando
                      ? 'Entrando na fila…'
                      : C.icone('pessoas', 20) + 'Entrar na lista de espera') +
                  '</button></div>';
        return (
            '<section class="revisao" id="revisao" tabindex="-1" aria-labelledby="rev-titulo">' +
            '<p class="rotulo" id="rev-titulo">Vaga lotada: entre na lista de espera</p>' +
            (S.erro ? '<p class="erro" role="alert">' + esc(S.erro) + '</p>' : '') +
            '<dl>' +
            C.linhaResumo('Disciplina', 'livro', disciplinaNome) +
            C.linhaResumo('Monitor', 'pessoa', v.monitor) +
            C.linhaResumo('Dia', 'calendario', D.diaLongo(v.inicio)) +
            C.linhaResumo('Horário', 'relogio', D.hora(v.inicio)) +
            C.linhaResumo('Local', 'local', v.local || 'A definir') +
            (v.descricao ? C.linhaResumo('Assunto', 'assunto', v.descricao) : '') +
            C.linhaResumo(
                'Lista de espera',
                'pessoas',
                v.naFila
                    ? D.plural(v.naFila, 'pessoa', 'pessoas') + ' na sua frente'
                    : 'Você será o primeiro'
            ) +
            '</dl>' +
            (S.erro && S.erroDefinitivo
                ? ''
                : '<p class="aviso">Se alguém cancelar até ' +
                  HORAS_FILA +
                  'h antes do início, você é inscrito na hora e recebe um e-mail. Dá para sair da fila pelo seu perfil quando quiser.</p>') +
            botoes +
            '</section>'
        );
    }

    function revisao() {
        const v = S.vagas.find((x) => x.id === S.vagaId);
        if (!v) return '';
        if (D.aceitaFila(v)) return revisaoFila(v);
        const prazo = D.prazoCancelamento(v.inicio);
        const prazoTexto =
            prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
            ' às ' +
            D.hora(prazo);
        let botoes;
        if (S.erro && S.erroDefinitivo)
            botoes =
                '<div class="linha acoes"><button type="button" class="btn" data-acao="voltar">Ver outros horários</button></div>';
        else
            botoes =
                '<div class="linha acoes"><button type="button" class="btn sec" data-acao="voltar">Trocar horário</button>' +
                '<button type="button" class="btn" data-acao="confirmar"' +
                (S.enviando ? ' disabled aria-busy="true"' : '') +
                '>' +
                (S.enviando ? 'Agendando…' : C.icone('agendar', 20) + 'Confirmar agendamento') +
                '</button></div>';
        return (
            '<section class="revisao" id="revisao" tabindex="-1" aria-labelledby="rev-titulo">' +
            '<p class="rotulo" id="rev-titulo">Revise antes de confirmar</p>' +
            (S.erro ? '<p class="erro" role="alert">' + esc(S.erro) + '</p>' : '') +
            '<dl>' +
            C.linhaResumo('Disciplina', 'livro', disciplinaNome) +
            C.linhaResumo('Monitor', 'pessoa', v.monitor) +
            C.linhaResumo('Dia', 'calendario', D.diaLongo(v.inicio)) +
            C.linhaResumo('Horário', 'relogio', D.hora(v.inicio)) +
            C.linhaResumo('Local', 'local', v.local || 'A definir') +
            (v.descricao ? C.linhaResumo('Assunto', 'assunto', v.descricao) : '') +
            C.linhaResumo('Lugares', 'pessoas', v.livres + ' de ' + v.capacidade + ' livres') +
            '</dl>' +
            (S.erro && S.erroDefinitivo
                ? ''
                : '<p class="aviso">Você pode cancelar até ' +
                  prazoTexto +
                  ' (24h antes do horário).</p>') +
            botoes +
            '</section>'
        );
    }

    function sucessoAluno() {
        const v = S.vagas.find((x) => x.id === S.vagaId);
        if (v.situacao === 'fila')
            return (
                '<section class="sucesso" id="sucesso" tabindex="-1"><span class="ok-icone">' +
                C.icone('ok', 28, 3) +
                '</span><h2>Você está na lista de espera</h2><p>' +
                (S.posicao ? '<b>' + S.posicao + 'º da fila</b><br>' : '') +
                esc(v.monitor) +
                ' · ' +
                esc(D.diaLongo(v.inicio)) +
                ' às ' +
                D.hora(v.inicio) +
                '<br>Se abrir um lugar, você é inscrito na hora e recebe um e-mail.</p>' +
                '<div class="linha"><button type="button" class="btn sec" data-acao="novo">Ver outros horários</button>' +
                '<a class="btn" href="perfil_aluno.html">Ver no meu perfil</a></div></section>'
            );
        return (
            '<section class="sucesso" id="sucesso" tabindex="-1"><span class="ok-icone">' +
            C.icone('ok', 28, 3) +
            '</span><h2>Monitoria agendada!</h2><p>' +
            esc(v.monitor) +
            ' · ' +
            esc(D.diaLongo(v.inicio)) +
            ' às ' +
            D.hora(v.inicio) +
            '<br>' +
            esc(v.local || 'Local a definir') +
            '</p><div class="linha"><button type="button" class="btn sec" data-acao="novo">Agendar outra</button>' +
            '<a class="btn" href="perfil_aluno.html">Ver no meu perfil</a></div></section>'
        );
    }

    // Plano 12: aviso de bloqueio por faltas, no topo da tela do aluno
    function avisoBloqueio() {
        const r = S.restricao;
        if (!r) return '';
        const ate = new Date(r.ate);
        return (
            '<div class="aviso-bloqueio" role="status">' +
            C.icone('lotada', 18) +
            '<p><b>Novas inscrições bloqueadas até ' +
            ate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
            ' às ' +
            D.hora(ate) +
            '.</b> Você faltou a ' +
            r.faltas +
            ' monitorias nos últimos 30 dias. Dá para ver os horários, mas não se inscrever nem entrar na lista de espera. As inscrições que você já tem continuam valendo.</p></div>'
        );
    }

    function telaAluno() {
        if (S.carregando) return C.carregando('Carregando horários…');
        if (S.erroCarga) return erroCarga();
        if (S.restricao && S.etapa !== 'sucesso') return avisoBloqueio() + telaAlunoLivre();
        return telaAlunoLivre();
    }

    function telaAlunoLivre() {
        if (S.etapa === 'sucesso') return sucessoAluno();
        if (!S.vagas.length)
            return '<p class="vazio">Ainda não há horários de monitoria para esta disciplina.</p>';
        const selecionada = S.vagas.find((x) => x.id === S.vagaId);
        const naFila = selecionada && D.aceitaFila(selecionada);
        const botaoAgendar =
            '<button type="button" class="btn" data-acao="revisar"' +
            (S.vagaId && !S.restricao ? '' : ' disabled') +
            '>' +
            (naFila
                ? C.icone('pessoas', 20) + 'Entrar na lista de espera'
                : C.icone('agendar', 20) + 'Agendar monitoria') +
            '</button>';
        if (desktop()) {
            const direita =
                S.etapa === 'revisao'
                    ? revisao()
                    : '<h2 class="area-titulo">Monitores disponíveis</h2>' +
                      lista(false) +
                      botaoAgendar;
            return (
                (S.etapa === 'revisao' ? '' : barraFiltros()) +
                '<div class="colunas"><div class="col"><h2 class="area-titulo">Dias disponíveis</h2>' +
                calendario(S.dia) +
                '</div><div class="col col-dir">' +
                direita +
                '</div></div>'
            );
        }
        let passo = S.etapa === 'revisao' ? 3 : S.passo;
        if (passo === 2 && !S.dia) passo = 1;
        let h = '<div class="colunas">' + C.passos(['Dia', 'Horário', 'Confirmar'], passo);
        if (passo === 1) h += barraFiltros() + calendario(S.dia);
        else if (passo === 2)
            h +=
                C.diaSelecionado(S.dia, 'passo') +
                lista(true) +
                '<div class="linha acoes"><button type="button" class="btn sec" data-acao="passo" data-passo="1">Voltar</button>' +
                '<button type="button" class="btn" data-acao="revisar"' +
                (S.vagaId && !S.restricao ? '' : ' disabled') +
                '>Continuar</button></div>';
        else h += revisao();
        return h + '</div>';
    }

    return { telaAluno };
}
