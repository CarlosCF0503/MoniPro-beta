// Execução dos casos de teste de sistema CT-08 a CT-11 contra o ambiente dev (homologação).
// Dados criados ficam identificados como teste: nomes "[TESTE] ...", e-mails @teste.invalid,
// matrículas 99900xx, vaga em "Sala de testes" daqui a ~3 h (some do calendário no mesmo dia).
import { writeFileSync } from 'node:fs';

const BASE = 'https://dev.moni-pro.app.br';
const SUFIXO = Date.now().toString().slice(-5); // evita conflito se for preciso repetir
const log = [];
const registrar = (linha) => { log.push(linha); console.log(linha); };

async function chamar(metodo, rota, { token, corpo } = {}) {
    const resp = await fetch(BASE + rota, {
        method: metodo,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        },
        body: corpo ? JSON.stringify(corpo) : undefined
    });
    const texto = await resp.text();
    let json;
    try { json = JSON.parse(texto); } catch { json = texto; }
    const corpoLog = corpo ? ' ' + JSON.stringify(corpo).replace(/"senha":"[^"]*"/, '"senha":"***"') : '';
    registrar(`  ${metodo} ${rota}${corpoLog}\n    → ${resp.status} ${JSON.stringify(json).slice(0, 400)}`);
    return { status: resp.status, json };
}

const resultados = [];
function verificar(caso, descricao, condicao) {
    resultados.push({ caso, descricao, ok: !!condicao });
    registrar(`  [${condicao ? 'OK' : 'FALHOU'}] ${caso}: ${descricao}`);
}

registrar(`### ${new Date().toISOString()} — CT-08 a CT-11 em ${BASE} (sufixo ${SUFIXO})`);

// ---------------------------------------------------------------- preparação
registrar('\n== Preparação: 1 monitor e 2 alunos de teste');
const SENHA = process.env.SENHA_TESTE; // a senha usada em 12/10/2026 foi omitida
const contas = {
    monitor: { nome_completo: '[TESTE] Monitor CT', email: `ct.monitor.${SUFIXO}@teste.invalid`, matricula: Number(`999${SUFIXO}`), tipo_usuario: 'monitor' },
    aluno1: { nome_completo: '[TESTE] Aluno CT 1', email: `ct.aluno1.${SUFIXO}@teste.invalid`, matricula: Number(`998${SUFIXO}`), tipo_usuario: 'aluno' },
    aluno2: { nome_completo: '[TESTE] Aluno CT 2', email: `ct.aluno2.${SUFIXO}@teste.invalid`, matricula: Number(`997${SUFIXO}`), tipo_usuario: 'aluno' }
};
const tokens = {};
for (const [chave, c] of Object.entries(contas)) {
    await chamar('POST', '/auth/cadastro', { corpo: { ...c, senha: SENHA } });
    const r = await chamar('POST', '/auth/login', { corpo: { identificador: c.email, senha: SENHA, tipo_usuario: c.tipo_usuario } });
    tokens[chave] = r.json.token;
    contas[chave].id = r.json.usuario?.id;
}
if (!tokens.monitor || !tokens.aluno1 || !tokens.aluno2) {
    registrar('Falha na preparação (login). Abortando.');
    writeFileSync(process.argv[2], log.join('\n'));
    process.exit(1);
}

// Vaga única para os quatro casos: capacidade 1, daqui a ~3 h, local com marcação HTML (CT-10)
const horario = new Date(Date.now() + 3 * 60 * 60 * 1000);
horario.setUTCSeconds(0, 0);
const LOCAL = '[TESTE] <b>Sala de testes</b>';
const disc = await chamar('GET', '/disciplinas', { token: tokens.aluno1 });
const idDisciplina = (disc.json.disciplinas || disc.json)[0].id;
const vaga = await chamar('POST', '/monitorias', {
    token: tokens.monitor,
    corpo: { id_disciplina: idDisciplina, horario: horario.toISOString(), local: LOCAL,
             descricao: '[TESTE] Vaga criada para os casos de teste de sistema CT-08 a CT-11', capacidade: 1 }
});
const idVaga = vaga.json.monitoria?.id;

// ---------------------------------------------------------------- CT-08
registrar('\n== CT-08 (RN-001): sair de monitoria que começa em menos de 24 h');
const insc = await chamar('POST', '/agendamentos', { token: tokens.aluno1, corpo: { id_monitoria: idVaga, data_hora: horario.toISOString() } });
const idAgendamento = insc.json.agendamento?.id;
verificar('CT-08', 'aluno 1 se inscreve na vaga (201)', insc.status === 201);
const sair = await chamar('DELETE', `/agendamentos/${idAgendamento}`, { token: tokens.aluno1 });
verificar('CT-08', 'saída recusada com 400 e mensagem das 24 h', sair.status === 400 && /24h/.test(sair.json.erro || ''));
const cancelarVaga = await chamar('PUT', `/monitorias/${idVaga}/cancelar`, { token: tokens.monitor });
verificar('CT-08', 'cancelamento da vaga pelo monitor também recusado (400, 24 h)', cancelarVaga.status === 400 && /24h/.test(cancelarVaga.json.erro || ''));

// ---------------------------------------------------------------- CT-09
registrar('\n== CT-09 (RF-003): exceder a capacidade da vaga');
// A listagem traz as vagas ativas em ordem de horário (paginada): percorre até achar a de teste
let naLista;
for (let pagina = 1; pagina <= 20 && !naLista; pagina++) {
    const lista = await chamar('GET', `/monitorias/${idDisciplina}?limit=100&page=${pagina}`, { token: tokens.aluno2 });
    naLista = (lista.json.monitorias || []).find((m) => m.id === idVaga);
    if (!lista.json.paginacao || pagina >= lista.json.paginacao.totalPaginas) break;
}
verificar('CT-09', 'listagem mostra a vaga com vagas_disponiveis = 0 (frontend exibe "Lotada")', naLista && naLista.vagas_disponiveis === 0);
const lotada = await chamar('POST', '/agendamentos', { token: tokens.aluno2, corpo: { id_monitoria: idVaga, data_hora: horario.toISOString() } });
verificar('CT-09', 'inscrição do aluno 2 recusada com 409 "lotada"', lotada.status === 409 && /lotada/i.test(lotada.json.erro || ''));

// ---------------------------------------------------------------- CT-10
registrar('\n== CT-10 (RNF-005): local com marcação HTML');
const localApi = naLista?.local;
verificar('CT-10', 'API devolve o local como texto, exatamente como digitado', localApi === LOCAL);
const apiJs = await (await fetch(`${BASE}/JS/api.js`)).text();
const fn = apiJs.match(/function escaparHtml[\s\S]*?\n}/)[0];
const escaparHtml = new Function(`${fn}; return escaparHtml;`)();
const renderizado = escaparHtml(localApi);
registrar(`    local escapado pelo api.js publicado: ${renderizado}`);
verificar('CT-10', 'escaparHtml publicado neutraliza a marcação (sem "<b>" no HTML gerado)', !renderizado.includes('<b>') && renderizado.includes('&lt;b&gt;'));
const marcarJs = await (await fetch(`${BASE}/JS/marcar_monitoria.js`)).text();
const perfilJs = await (await fetch(`${BASE}/JS/perfil.js`)).text();
verificar('CT-10', 'marcar_monitoria.js e perfil.js publicados escapam o local antes do innerHTML',
    /escaparHtml\(monitoria\.local/.test(marcarJs) && /escaparHtml\(m\.local/.test(perfilJs));

// ---------------------------------------------------------------- CT-11
registrar('\n== CT-11 (RN-008): concluir agendamento e conferir a pontuação');
const rankingAntes = await chamar('GET', `/disciplinas/${idDisciplina}/ranking`, { token: tokens.aluno1 });
const pontosAntes = (rankingAntes.json.ranking || []).find((u) => u.id === contas.aluno1.id)?.pontos ?? 0;
const alheio = await chamar('PATCH', `/agendamentos/${idAgendamento}/concluir`, { token: tokens.aluno2 });
verificar('CT-11', 'aluno 2 não consegue concluir o agendamento do aluno 1 (403)', alheio.status === 403);
const concluir = await chamar('PATCH', `/agendamentos/${idAgendamento}/concluir`, { token: tokens.aluno1 });
verificar('CT-11', 'aluno 1 conclui o próprio agendamento (200)', concluir.status === 200);
const repetir = await chamar('PATCH', `/agendamentos/${idAgendamento}/concluir`, { token: tokens.aluno1 });
verificar('CT-11', 'segunda conclusão recusada (400 "já foi concluído")', repetir.status === 400);
const rankingDepois = await chamar('GET', `/disciplinas/${idDisciplina}/ranking`, { token: tokens.aluno1 });
const pontosDepois = (rankingDepois.json.ranking || []).find((u) => u.id === contas.aluno1.id)?.pontos;
registrar(`    pontos do aluno 1 no ranking: antes ${pontosAntes}, depois ${pontosDepois}`);
verificar('CT-11', 'pontuação aumenta uma única vez (+10)', pontosDepois === pontosAntes + 10);
const perfil = await chamar('GET', '/perfil', { token: tokens.aluno1 });
verificar('CT-11', 'perfil do aluno informa a pontuação (o frontend exibe data.user.pontos)', typeof perfil.json.user?.pontos === 'number');

// ---------------------------------------------------------------- resumo
registrar('\n== Resumo');
for (const caso of ['CT-08', 'CT-09', 'CT-10', 'CT-11']) {
    const r = resultados.filter((x) => x.caso === caso);
    registrar(`  ${caso}: ${r.filter((x) => x.ok).length}/${r.length} verificações ok`);
}
registrar(`\nDados de teste criados: usuários ${Object.values(contas).map((c) => c.id).join(', ')}; vaga ${idVaga}; agendamento ${idAgendamento}.`);
writeFileSync(process.argv[2], log.join('\n') + '\n');
