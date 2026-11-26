// JS/marcar/tela_monitor.js
// Tela de criar vaga (monitor): validação do formulário, prévia da vaga e série recorrente
// (plano 9), nas montagens de computador (calendário + coluna) e celular (passo a passo).

import { escaparHtml } from '../api.js';
import { MarcarDatas } from './datas.js';
import { MarcarComponentes } from './componentes.js';

const D = MarcarDatas;
const C = MarcarComponentes;
const esc = escaparHtml;

/**
 * Monta a tela de criar vaga (monitor) a partir do estado `S`. Os eventos ficam em JS/marcar/tela.js.
 */
export function criarTelaMonitor({
    desktop,
    disciplinaNome,
    usuario,
    S,
    minhas,
    minhasNoDia,
    calendario,
    erroCarga
}) {
    // --- 7. Monitor ---
    function errosForm() {
        return { ...D.validarVaga(S.form, new Date(), minhasNoDia(S.form.dia)), ...S.errosApi };
    }

    // Erro só aparece no campo depois que ele foi usado (ou quando veio da API); o botão
    // "Revisar vaga" continua desativado enquanto qualquer campo for inválido.
    function errosVisiveis() {
        const todos = errosForm();
        const visiveis = {};
        Object.keys(todos).forEach((campo) => {
            if (S.tocados[campo] || S.errosApi[campo]) visiveis[campo] = todos[campo];
        });
        return visiveis;
    }

    function vagaDoForm() {
        const inicio = D.dataDoFormulario(S.form.dia, S.form.hora);
        if (!inicio) return null;
        const capacidade = Math.max(Math.floor(Number(S.form.capacidade)) || 1, 1);
        const online = S.form.modalidade === 'online';
        return {
            inicio,
            monitor: usuario.nome || 'Você',
            modalidade: online ? 'online' : 'presencial',
            link: online ? S.form.link.trim() : '',
            local: online ? D.LOCAL_ONLINE : S.form.local.trim(),
            descricao: S.form.descricao.trim(),
            capacidade,
            livres: capacidade
        };
    }

    function previa() {
        let corpo;
        if (!S.form.dia) corpo = '<p class="vazio">Escolha um dia para ver a prévia.</p>';
        // Sem horário completo o card mostraria "00:00" ou um minuto pela metade
        else if (!D.horaValida(S.form.hora))
            corpo = '<p class="vazio">Escolha o horário para ver a prévia.</p>';
        else corpo = C.cardVaga(vagaDoForm(), { estatico: true });
        return (
            '<p class="rotulo">' + C.icone('olho', 14) + 'Prévia: como o aluno vai ver</p>' + corpo
        );
    }

    const DICAS = {
        hora: 'Digite (ex.: 14:43) ou escolha na lista',
        capacidade: 'Alunos por vaga',
        local: 'Ex.: Lab 3, Bloco C',
        link: 'Meet, Teams, Zoom ou Jitsi. Só quem se inscrever vê o link.'
    };

    // Plano 11: presencial ou on-line, como dois botões de opção
    function campoModalidade(atual) {
        const opcao = (valor, rotulo, ico) =>
            '<label class="mod-op' +
            (atual === valor ? ' ativa' : '') +
            '"><input type="radio" name="modalidade" value="' +
            valor +
            '"' +
            (atual === valor ? ' checked' : '') +
            '>' +
            C.icone(ico, 16) +
            rotulo +
            '</label>';
        return (
            '<fieldset class="modalidade"><legend>Modalidade</legend><div class="mod-ops">' +
            opcao('presencial', 'Presencial', 'local') +
            opcao('online', 'On-line', 'video') +
            '</div></fieldset>'
        );
    }

    function campo(id, rotulo, controle, erro, dica) {
        return (
            '<div class="campo' +
            (erro ? ' err' : '') +
            '" data-campo="' +
            id +
            '"><label for="f-' +
            id +
            '">' +
            rotulo +
            '</label>' +
            controle +
            '<span class="dica" id="d-' +
            id +
            '">' +
            esc(erro || dica || '') +
            '</span></div>'
        );
    }

    // Plano 9: resumo da série embaixo do campo "Até": quantas vagas e quais datas (as puladas
    // riscadas, porque o monitor já tem vaga no mesmo horário)
    function resumoSerie() {
        const s = D.serieDoForm(S.form, minhas());
        if (!s || s.datas.length > D.MAX_OCORRENCIAS) return '';
        const itens = s.datas
            .map((d) => {
                const pulada = s.puladas.some((p) => p.getTime() === d.getTime());
                return (
                    '<li' +
                    (pulada ? ' class="pulada"' : '') +
                    '>' +
                    D.diaMes(d) +
                    (pulada ? '<span class="sr-only"> (pulada: você já tem vaga)</span>' : '') +
                    '</li>'
                );
            })
            .join('');
        return (
            '<p class="serie-txt"><b>' +
            D.plural(s.criadas.length, 'vaga', 'vagas') +
            '</b> · ' +
            esc(D.todaSemana(s.datas[0])) +
            ' às ' +
            esc(S.form.hora) +
            '</p><ul class="serie-datas" aria-label="Datas da série">' +
            itens +
            '</ul>' +
            (s.puladas.length
                ? '<p class="serie-pulas">' +
                  C.icone('alerta', 14) +
                  (s.puladas.length === 1 ? 'A data riscada fica' : 'As datas riscadas ficam') +
                  ' de fora: você já tem vaga às ' +
                  esc(S.form.hora) +
                  '.</p>'
                : '')
        );
    }

    function campoRepetir(e, extra) {
        const f = S.form;
        const maximo = f.dia ? D.somarSemanas(f.dia, D.MAX_OCORRENCIAS - 1) : '';
        return (
            '<div class="repetir">' +
            '<label class="f-chk"><input type="checkbox" id="f-repetir"' +
            (f.repetir ? ' checked' : '') +
            '>' +
            C.icone('calendario', 16) +
            'Repetir toda semana</label>' +
            (f.repetir
                ? campo(
                      'ate',
                      'Até',
                      '<input id="f-ate" type="date"' +
                          (f.dia ? ' min="' + f.dia + '" max="' + maximo + '"' : '') +
                          ' value="' +
                          esc(f.ate) +
                          '"' +
                          extra('ate') +
                          '>',
                      e.ate,
                      'No máximo ' + D.MAX_OCORRENCIAS + ' vagas'
                  ) +
                  '<div class="serie" id="serie-resumo" aria-live="polite">' +
                  resumoSerie() +
                  '</div>'
                : '') +
            '</div>'
        );
    }

    function campos() {
        const f = S.form;
        const e = errosVisiveis();
        const extra = (id) =>
            ' aria-describedby="d-' + id + '"' + (e[id] ? ' aria-invalid="true"' : '');
        return (
            '<div class="form">' +
            (S.erroForm
                ? '<p class="erro" id="erro-form" tabindex="-1" role="alert">' +
                  esc(S.erroForm) +
                  '</p>'
                : '') +
            '<div class="dois">' +
            campo(
                'hora',
                'Horário',
                C.campoHora(
                    f.hora,
                    minhasNoDia(f.dia).map((v) => D.hora(v.inicio)),
                    extra('hora')
                ),
                e.hora,
                DICAS.hora
            ) +
            campo(
                'capacidade',
                'Lugares',
                '<input id="f-capacidade" type="number" min="1" step="1" inputmode="numeric" value="' +
                    esc(f.capacidade) +
                    '"' +
                    extra('capacidade') +
                    '>',
                e.capacidade,
                DICAS.capacidade
            ) +
            '</div>' +
            campoModalidade(f.modalidade) +
            (f.modalidade === 'online'
                ? campo(
                      'link',
                      'Link da sala',
                      '<input id="f-link" type="url" inputmode="url" maxlength="500" autocomplete="off" placeholder="https://meet.google.com/abc-defg-hij" value="' +
                          esc(f.link) +
                          '"' +
                          extra('link') +
                          '>',
                      e.link,
                      DICAS.link
                  )
                : campo(
                      'local',
                      'Local',
                      '<input id="f-local" type="text" maxlength="140" autocomplete="off" placeholder="Laboratório 3, Bloco C" value="' +
                          esc(f.local) +
                          '"' +
                          extra('local') +
                          '>',
                      e.local,
                      DICAS.local
                  )) +
            campoRepetir(e, extra) +
            campo(
                'descricao',
                'Assunto (opcional)',
                '<textarea id="f-descricao" rows="2" placeholder="Ex.: Foco em SQL Joins"' +
                    extra('descricao') +
                    '>' +
                    esc(f.descricao) +
                    '</textarea>',
                e.descricao,
                f.descricao.length + '/' + D.LIMITE_DESCRICAO
            ) +
            '<div class="previa" id="previa">' +
            previa() +
            '</div></div>'
        );
    }

    function minhasVagas(k) {
        const vagas = minhasNoDia(k);
        const itens = vagas
            .map((v) => {
                const ocupados = v.capacidade - v.livres;
                return (
                    '<li class="minha"><span class="h">' +
                    C.icone('relogio', 13) +
                    D.hora(v.inicio) +
                    '</span><span class="l">' +
                    C.icone('local', 13) +
                    esc(v.local || 'A definir') +
                    '</span><span class="chip ' +
                    (v.livres <= 0 ? 'bad' : 'info') +
                    '">' +
                    C.icone('pessoas', 12) +
                    ocupados +
                    ' de ' +
                    v.capacidade +
                    ' inscritos</span></li>'
                );
            })
            .join('');
        return (
            '<div class="minhas"><p class="rotulo">Suas vagas neste dia</p>' +
            (vagas.length
                ? '<ul>' + itens + '</ul>'
                : '<p class="nada">Nenhuma vaga sua neste dia.</p>') +
            '</div>'
        );
    }

    function botaoRevisarVaga() {
        const ok = !Object.keys(errosForm()).length;
        return (
            '<button type="button" class="btn" id="btn-revisar-vaga" data-acao="m-revisar"' +
            (ok ? '' : ' disabled') +
            '>Revisar vaga</button>'
        );
    }

    function revisaoVaga() {
        const v = vagaDoForm();
        if (!v) return '';
        const serie = D.serieDoForm(S.form, minhas());
        const n = serie ? serie.criadas.length : 1;
        return (
            '<section class="revisao" id="revisao-vaga" tabindex="-1" aria-labelledby="revv-titulo">' +
            '<p class="rotulo" id="revv-titulo">Revise a vaga antes de criar</p><dl>' +
            C.linhaResumo('Disciplina', 'livro', disciplinaNome) +
            (serie
                ? C.linhaResumo(
                      'Repete',
                      'calendario',
                      D.todaSemana(v.inicio) +
                          ', de ' +
                          D.diaMes(serie.criadas[0] || v.inicio) +
                          ' a ' +
                          D.diaMes(serie.datas[serie.datas.length - 1])
                  ) +
                  (serie.puladas.length
                      ? C.linhaResumo(
                            'Fica de fora',
                            'alerta',
                            serie.puladas.map(D.diaMes).join(', ') +
                                ' (você já tem vaga nesse horário)'
                        )
                      : '')
                : C.linhaResumo('Dia', 'calendario', D.diaLongo(v.inicio))) +
            C.linhaResumo('Horário', 'relogio', D.hora(v.inicio)) +
            (v.modalidade === 'online'
                ? C.linhaResumo('Modalidade', 'video', 'On-line') +
                  // O link fica como foi digitado (sem a maiúscula da primeira letra)
                  '<dt>' +
                  C.icone('video') +
                  'Link da sala</dt><dd class="link">' +
                  esc(v.link) +
                  '</dd>'
                : C.linhaResumo('Local', 'local', v.local)) +
            (v.descricao ? C.linhaResumo('Assunto', 'assunto', v.descricao) : '') +
            C.linhaResumo('Lugares', 'pessoas', D.plural(v.capacidade, 'aluno', 'alunos')) +
            '</dl><div class="previa"><p class="rotulo">' +
            C.icone('olho', 14) +
            'Como o aluno vai ver</p>' +
            C.cardVaga(v, { estatico: true }) +
            '</div><p class="aviso">' +
            (n > 1
                ? 'São ' +
                  n +
                  ' vagas independentes: depois dá para editar ou cancelar cada uma, ou cancelar a série a partir de uma data, sempre até 24h antes do horário.'
                : 'Depois de criada, a vaga só pode ser cancelada até 24h antes do horário.') +
            '</p>' +
            '<div class="linha acoes"><button type="button" class="btn sec" data-acao="m-editar">Editar</button>' +
            '<button type="button" class="btn" data-acao="criar"' +
            (S.enviando ? ' disabled aria-busy="true"' : '') +
            '>' +
            (S.enviando
                ? n > 1
                    ? 'Criando vagas…'
                    : 'Criando vaga…'
                : C.icone('criar', 20) + (n > 1 ? 'Criar ' + n + ' vagas' : 'Criar vaga')) +
            '</button></div></section>'
        );
    }

    function sucessoMonitor() {
        const v = S.criada;
        const serie = S.serieCriada;
        if (serie && serie.vagas.length > 1) {
            const ultima = serie.vagas[serie.vagas.length - 1];
            return (
                '<section class="sucesso" id="sucesso" tabindex="-1"><span class="ok-icone">' +
                C.icone('ok', 28, 3) +
                '</span><h2>' +
                serie.vagas.length +
                ' vagas criadas!</h2><p>' +
                esc(D.todaSemana(v.inicio)) +
                ' às ' +
                D.hora(v.inicio) +
                ', de ' +
                D.diaMes(v.inicio) +
                ' a ' +
                D.diaMes(ultima.inicio) +
                ' · ' +
                esc(v.local) +
                (serie.puladas.length
                    ? '<br>Ficaram de fora: ' +
                      serie.puladas.map(D.diaMes).join(', ') +
                      ' (você já tinha vaga nesse horário).'
                    : '') +
                '<br>Os alunos de ' +
                esc(disciplinaNome) +
                ' já podem agendar.</p><div class="linha"><button type="button" class="btn sec" data-acao="nova-vaga">Criar outra</button>' +
                '<a class="btn" href="perfil_monitor.html">Ver minhas vagas</a></div></section>'
            );
        }
        return (
            '<section class="sucesso" id="sucesso" tabindex="-1"><span class="ok-icone">' +
            C.icone('ok', 28, 3) +
            '</span><h2>Vaga criada!</h2><p>' +
            esc(D.diaLongo(v.inicio)) +
            ' às ' +
            D.hora(v.inicio) +
            ' · ' +
            esc(v.local) +
            '<br>Os alunos de ' +
            esc(disciplinaNome) +
            ' já podem agendar.</p><div class="linha"><button type="button" class="btn sec" data-acao="nova-vaga">Criar outra</button>' +
            '<a class="btn" href="perfil_monitor.html">Ver minhas vagas</a></div></section>'
        );
    }

    function telaMonitor() {
        if (S.carregando) return C.carregando('Carregando suas vagas…');
        if (S.erroCarga) return erroCarga();
        if (S.criada) return sucessoMonitor();
        if (desktop()) {
            let direita;
            if (S.m.etapa === 'revisao') direita = revisaoVaga();
            else if (S.form.dia)
                direita =
                    '<h2 class="area-titulo">Nova vaga · ' +
                    esc(D.diaCurto(D.deChave(S.form.dia))) +
                    '</h2>' +
                    minhasVagas(S.form.dia) +
                    campos() +
                    botaoRevisarVaga();
            else
                direita =
                    '<h2 class="area-titulo">Nova vaga</h2><p class="vazio">Escolha um dia no calendário para começar.</p>';
            return (
                '<div class="colunas"><div class="col"><h2 class="area-titulo">Dia da vaga</h2>' +
                calendario(S.form.dia) +
                '</div><div class="col col-dir">' +
                direita +
                '</div></div>'
            );
        }
        let passo = S.m.etapa === 'revisao' ? 3 : S.m.passo;
        if (passo > 1 && !S.form.dia) passo = 1;
        let h = '<div class="colunas">' + C.passos(['Dia', 'Detalhes', 'Revisar'], passo);
        if (passo === 1)
            h +=
                calendario(S.form.dia) +
                (S.form.dia
                    ? '<div class="linha acoes"><button type="button" class="btn" data-acao="m-passo" data-passo="2">Continuar</button></div>'
                    : '');
        else if (passo === 2)
            h +=
                C.diaSelecionado(S.form.dia, 'm-passo') +
                minhasVagas(S.form.dia) +
                campos() +
                '<div class="linha acoes"><button type="button" class="btn sec" data-acao="m-passo" data-passo="1">Voltar</button>' +
                botaoRevisarVaga() +
                '</div>';
        else h += revisaoVaga();
        return h + '</div>';
    }

    return { errosForm, errosVisiveis, previa, DICAS, resumoSerie, telaMonitor };
}
