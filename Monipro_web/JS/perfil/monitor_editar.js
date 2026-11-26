// JS/perfil/monitor_editar.js
// Perfil do monitor: diálogo de editar vaga (RF-009), com o calendário do mês e o campo de horário.

import { showToast, mensagemDaApi } from '../toast.js';
import { chamadaApi, escaparHtml } from '../api.js';
import { PerfilDados } from './dados.js';
import { MarcarDatas } from '../marcar/datas.js';
import { ligarCampoHora } from '../marcar/campo_hora.js';

const D = PerfilDados;
const esc = escaparHtml;

/**
 * Liga o diálogo de editar vaga (#dlg-editar) e devolve o botão que o abre e a função que o
 * preenche. `render` redesenha o perfil depois de salvar.
 */
export function criarEditarVaga({ S, render }) {
    // Editar vaga (PATCH /monitorias/:id). Dia e horário só mudam até 24h antes; local, lugares
    // e assunto, até o início. Lugares nunca abaixo do número de inscritos. Se dia, horário ou
    // local mudarem, os inscritos podem cancelar sem a regra das 24h (o e-mail vem no plano 3).
    const dlgEd = document.getElementById('dlg-editar');
    const edForm = document.getElementById('ed-form');
    const ed = (id) => document.getElementById('ed-' + id);
    const isoDia = (d) =>
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
    function botaoEditar(v, classe) {
        return (
            '<button type="button" class="' +
            (classe || 'pp-btn pp-btn-sec') +
            '" data-acao="editar" data-id="' +
            esc(v.id) +
            '">Editar</button>'
        );
    }
    // --- Horário: digitado (HH:MM, qualquer minuto) ou escolhido na lista, como em "Abrir nova
    // vaga" (JS/marcar/campo_hora.js). Sugestões de 15 em 15, das 07:00 às 22:00; o horário atual
    // da vaga entra na lista mesmo fora desse passo.
    const horaInput = ed('hora');
    const horaLista = document.getElementById('ed-hora-lista');
    function definirHora(valor) {
        horaInput.value = valor;
        horaLista.innerHTML = MarcarDatas.horarios(valor)
            .map(
                (h) =>
                    '<li role="option" id="ed-h-' +
                    h.replace(':', '') +
                    '" data-hora="' +
                    h +
                    '" aria-selected="' +
                    (h === valor) +
                    '">' +
                    h +
                    '</li>'
            )
            .join('');
    }
    ligarCampoHora(dlgEd, () => {
        horaInput.removeAttribute('aria-invalid');
        edAtualizarAviso();
    });

    // --- Dia: calendário do mês dentro do diálogo ---
    // Dias que já passaram ficam bloqueados. Setas andam de um dia (←/→) ou de uma semana (↑/↓),
    // Page Up/Down trocam de mês, Enter escolhe e Esc fecha só o calendário.
    const diaBtn = ed('data');
    const cal = document.getElementById('ed-cal');
    const meiaNoite = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const CAL = { mes: null, foco: null };
    function definirDia(data) {
        const d = meiaNoite(data);
        diaBtn.dataset.valor = isoDia(d);
        diaBtn.querySelector('.valor').textContent = D.diaCurto(d);
    }
    function diaEscolhido() {
        const [a, m, d] = diaBtn.dataset.valor.split('-').map(Number);
        return new Date(a, m - 1, d);
    }
    function desenharCal() {
        const hoje = meiaNoite(new Date());
        const escolhido = diaBtn.dataset.valor;
        const ano = CAL.mes.getFullYear();
        const mes = CAL.mes.getMonth();
        const vazios = new Date(ano, mes, 1).getDay();
        const ultimo = new Date(ano, mes + 1, 0).getDate();
        let grade = D.DIAS_SEMANA.map(
            (n) => '<span class="cal-dw" aria-hidden="true">' + n + '</span>'
        ).join('');
        grade += '<span></span>'.repeat(vazios);
        for (let n = 1; n <= ultimo; n++) {
            const data = new Date(ano, mes, n);
            const k = isoDia(data);
            const passado = data < hoje;
            grade +=
                '<button type="button" class="cal-dia' +
                (k === isoDia(hoje) ? ' hoje' : '') +
                '" data-dia="' +
                k +
                '" tabindex="' +
                (k === isoDia(CAL.foco) ? 0 : -1) +
                '" aria-pressed="' +
                (k === escolhido) +
                '" aria-label="' +
                n +
                ' de ' +
                D.MESES[mes] +
                (k === isoDia(hoje) ? ', hoje' : '') +
                '"' +
                (passado ? ' disabled' : '') +
                '>' +
                n +
                '</button>';
        }
        const voltarBloqueado = ano === hoje.getFullYear() && mes === hoje.getMonth();
        cal.innerHTML =
            '<div class="cal-topo"><button type="button" class="cal-nav" data-mes="-1" aria-label="Mês anterior"' +
            (voltarBloqueado ? ' disabled' : '') +
            '><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>' +
            '<strong aria-live="polite">' +
            D.MESES[mes] +
            ' ' +
            ano +
            '</strong><button type="button" class="cal-nav" data-mes="1" aria-label="Próximo mês"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button></div>' +
            '<div class="cal-grade">' +
            grade +
            '</div>';
    }
    function focarDia(data, focar) {
        const hoje = meiaNoite(new Date());
        CAL.foco = data < hoje ? hoje : data;
        CAL.mes = new Date(CAL.foco.getFullYear(), CAL.foco.getMonth(), 1);
        desenharCal();
        if (focar) cal.querySelector('[data-dia="' + isoDia(CAL.foco) + '"]').focus();
    }
    function abrirCal() {
        if (diaBtn.disabled) return;
        cal.hidden = false;
        diaBtn.setAttribute('aria-expanded', 'true');
        focarDia(diaEscolhido(), true);
    }
    function fecharCal(devolverFoco) {
        if (cal.hidden) return;
        cal.hidden = true;
        diaBtn.setAttribute('aria-expanded', 'false');
        if (devolverFoco) diaBtn.focus();
    }
    diaBtn.addEventListener('click', () => (cal.hidden ? abrirCal() : fecharCal(true)));
    horaInput.addEventListener('focus', () => fecharCal(false));
    cal.addEventListener('click', (ev) => {
        const nav = ev.target.closest('[data-mes]');
        if (nav) {
            const passo = Number(nav.dataset.mes);
            const alvo = new Date(CAL.mes.getFullYear(), CAL.mes.getMonth() + passo, 1);
            focarDia(alvo, false);
            return;
        }
        const dia = ev.target.closest('[data-dia]');
        if (!dia || dia.disabled) return;
        const [a, m, d] = dia.dataset.dia.split('-').map(Number);
        definirDia(new Date(a, m - 1, d));
        diaBtn.removeAttribute('aria-invalid');
        fecharCal(true);
        edAtualizarAviso();
    });
    cal.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
            // Esc fecha só o calendário, não o diálogo
            ev.preventDefault();
            ev.stopPropagation();
            fecharCal(true);
            return;
        }
        if (!ev.target.closest('[data-dia]')) return;
        const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
        if (passo) {
            ev.preventDefault();
            const alvo = new Date(CAL.foco);
            alvo.setDate(alvo.getDate() + passo);
            focarDia(alvo, true);
        } else if (ev.key === 'PageUp' || ev.key === 'PageDown') {
            ev.preventDefault();
            const alvo = new Date(CAL.foco);
            alvo.setMonth(alvo.getMonth() + (ev.key === 'PageUp' ? -1 : 1));
            focarDia(alvo, true);
        }
    });
    dlgEd.addEventListener('pointerdown', (ev) => {
        if (!ev.target.closest('#ed-cal, #ed-data')) fecharCal(false);
    });
    dlgEd.addEventListener('close', () => fecharCal(false));

    // Plano 11: presencial ou on-line no diálogo; troca o campo Local pelo Link da sala
    const edOnline = () => ed('mod-online').checked;
    function edMostrarModalidade() {
        ed('campo-local').hidden = edOnline();
        ed('campo-link').hidden = !edOnline();
    }
    function edMudancas(v) {
        const hora = horaInput.value.trim();
        const novo = MarcarDatas.horaValida(hora)
            ? new Date(diaBtn.dataset.valor + 'T' + hora)
            : new Date(NaN);
        const online = edOnline();
        return {
            novo,
            hora,
            online,
            // Por minuto: os segundos do horário gravado não contam como mudança
            quando: !isNaN(novo) && Math.floor(novo / 60000) !== Math.floor(v.inicio / 60000),
            // Trocar a modalidade ou o link conta como mudar o local (plano 11)
            local:
                online !== v.online ||
                (online
                    ? ed('link').value.trim() !== (v.link || '')
                    : ed('local').value.trim() !== v.local)
        };
    }
    function edAtualizarAviso() {
        const v = S.alvo;
        const m = edMudancas(v);
        const aviso = ed('aviso');
        if ((m.quando || m.local) && v.inscritos)
            aviso.textContent =
                (v.inscritos === 1
                    ? 'O aluno inscrito vê a mudança no perfil e pode'
                    : 'Os ' + v.inscritos + ' alunos inscritos veem a mudança no perfil e podem') +
                ' cancelar sem a regra das 24h.';
        else if (m.quando || m.local) aviso.textContent = 'Ninguém se inscreveu ainda.';
        aviso.hidden = !(m.quando || m.local);
    }
    function abrirEditar(v) {
        S.alvo = v;
        const perto = v.inicio - S.agora < D.HORAS_CANCELAMENTO * 3600e3;
        ed('sub').textContent =
            v.disciplina + ' · ' + D.diaCurto(v.inicio) + ' às ' + D.hora(v.inicio);
        definirDia(v.inicio);
        definirHora(D.hora(v.inicio));
        diaBtn.disabled = perto;
        horaInput.disabled = perto;
        ed('nota-24h').hidden = !perto;
        ed('local').value = v.online ? '' : v.local;
        ed('link').value = v.link || '';
        ed('mod-online').checked = v.online;
        ed('mod-presencial').checked = !v.online;
        edMostrarModalidade();
        ed('cap').value = v.capacidade;
        ed('cap').min = Math.max(1, v.inscritos || 0);
        ed('cap-dica').textContent =
            (v.inscritos
                ? 'Mínimo ' +
                  v.inscritos +
                  ': já há ' +
                  D.plural(v.inscritos, 'inscrito', 'inscritos') +
                  '.'
                : 'Ninguém inscrito ainda.') +
            // Plano 8: lugares a mais vão na hora para quem está na fila
            (v.naFila
                ? ' Com mais lugares, ' +
                  (v.naFila === 1
                      ? 'quem está na lista de espera é inscrito na hora.'
                      : 'os primeiros dos ' +
                        v.naFila +
                        ' da lista de espera são inscritos na hora.')
                : '');
        ed('desc').value = v.descricao || '';
        ed('erro').textContent = '';
        edForm.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
        edAtualizarAviso();
        dlgEd.showModal();
    }
    edForm.addEventListener('input', (ev) => {
        if (ev.target.name === 'ed-modalidade') edMostrarModalidade();
        edAtualizarAviso();
    });
    edForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = S.alvo;
        const m = edMudancas(v);
        const cap = Number(ed('cap').value);
        const erro = (campo, texto) => {
            ed('erro').textContent = texto;
            ed(campo).setAttribute('aria-invalid', 'true');
            ed(campo).focus();
        };
        edForm.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
        if (!MarcarDatas.horaValida(m.hora))
            return erro('hora', 'Use o formato HH:MM, ex.: 14:43.');
        // O limite vale para um horário novo; o de uma vaga antiga fora dele continua valendo
        if (m.hora !== D.hora(v.inicio) && !MarcarDatas.horaNoLimite(m.hora))
            return erro('hora', 'Escolha um horário ' + MarcarDatas.TEXTO_LIMITE_HORARIO + '.');
        if (m.quando && m.novo <= new Date())
            return erro('hora', 'Escolha um dia e horário que ainda não passaram.');
        if (m.online && !D.linkSalaValido(ed('link').value))
            return erro('link', 'Use um link https do Meet, Teams, Zoom ou Jitsi.');
        if (!m.online && !ed('local').value.trim())
            return erro('local', 'Informe onde a monitoria acontece.');
        if (!Number.isInteger(cap) || cap < Math.max(1, v.inscritos || 0))
            return erro(
                'cap',
                'Lugares não pode ficar abaixo de ' + Math.max(1, v.inscritos || 0) + '.'
            );
        const btn = ed('salvar');
        btn.disabled = true;
        btn.textContent = 'Salvando…';
        const r = await chamadaApi('/monitorias/' + v.id, {
            method: 'PATCH',
            body: JSON.stringify(
                Object.assign(
                    m.quando ? { horario: m.novo.toISOString() } : {},
                    m.online
                        ? { modalidade: 'online', link: ed('link').value.trim() }
                        : { modalidade: 'presencial', local: ed('local').value.trim() },
                    { capacidade: cap, descricao: ed('desc').value.trim() }
                )
            )
        });
        btn.disabled = false;
        btn.textContent = 'Salvar alterações';
        if (!r.success)
            return (ed('erro').textContent = mensagemDaApi(r, 'Não foi possível salvar a vaga.'));
        if (m.quando) v.inicio = m.novo;
        v.online = m.online;
        v.link = m.online ? r.monitoria.link : null;
        v.local = r.monitoria.local;
        v.capacidade = cap;
        v.descricao = ed('desc').value.trim();
        dlgEd.close();
        showToast(
            r.liberados
                ? 'Vaga atualizada. Os inscritos podem cancelar sem a regra das 24h.'
                : 'Vaga atualizada.',
            'success'
        );
        render();
    });
    dlgEd.querySelector('[data-fechar]').addEventListener('click', () => dlgEd.close());

    return { botaoEditar, abrirEditar };
}
