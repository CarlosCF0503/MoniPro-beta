// CT-16 (RN-016): o monitor marca pela tela que o aluno faltou; o aluno vê a falta no perfil;
//        com 3 faltas em 30 dias, a nova inscrição é recusada (423) e o perfil avisa até quando.
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { moverVagaParaOPassado } = require('./apoio/banco');
const { diaAFrente } = require('./apoio/telas');
const { ehCelular, linha, abrirAba } = require('./apoio/perfil');

/** Vaga do monitor que "aconteceu" há `horas` horas, com o aluno inscrito. */
async function sessaoPassada(_request, clienteMonitor, clienteAluno, horas) {
    const disciplina = await api.criarDisciplina(clienteMonitor);
    const vaga = await api.criarVaga(clienteMonitor, { disciplina, horario: diaAFrente(3, 10) });
    const agendamento = await api.inscrever(clienteAluno, vaga);
    await moverVagaParaOPassado(vaga.id, horas);
    return { disciplina, vaga, agendamento };
}

test('CT-16 faltas: o monitor marca pela tela e, na terceira, o aluno fica bloqueado', async ({
    page,
    context,
    browser,
    request,
    baseURL
}, testInfo) => {
    const monitor = await api.criarConta(request, 'monitor');
    const clienteMonitor = await api.clienteDe(request, monitor);
    const aluno = await api.criarConta(request, 'aluno');
    const clienteAluno = await api.clienteDe(request, aluno);

    // Duas sessões anteriores (as faltas delas são marcadas abaixo, pela sessão do monitor)
    for (const horas of [5, 4]) await sessaoPassada(request, clienteMonitor, clienteAluno, horas);
    const { disciplina } = await sessaoPassada(request, clienteMonitor, clienteAluno, 2);

    // 1. O monitor marca a falta da sessão mais recente pela tela
    const contextoMonitor = await browser.newContext(testInfo.project.use);
    await api.entrarNoNavegador(contextoMonitor, request, monitor, baseURL);
    const paginaMonitor = await contextoMonitor.newPage();
    await paginaMonitor.goto('/perfil_monitor.html');
    // As duas faltas anteriores, pela sessão do navegador do monitor
    const anteriores = await paginaMonitor.evaluate(async () => {
        const r = await fetch('/monitorias/monitor/agendamentos?limit=100', {
            credentials: 'include'
        });
        const { agendamentos } = await r.json();
        return agendamentos.map((a) => ({ id: a.id, horario: a.monitoria.horario }));
    });
    const maisAntigas = anteriores
        .sort((a, b) => new Date(a.horario) - new Date(b.horario))
        .slice(0, 2);
    for (const a of maisAntigas) {
        const status = await paginaMonitor.evaluate(async (id) => {
            const r = await fetch(`/agendamentos/${id}/ausencia`, {
                method: 'PATCH',
                credentials: 'include'
            });
            return r.status;
        }, a.id);
        expect(status).toBe(200);
    }
    await paginaMonitor.reload();
    await abrirAba(paginaMonitor, testInfo, {
        computador: /^Para finalizar/,
        celular: /^Em aberto/
    });
    const item = linha(paginaMonitor, disciplina.nome);
    if (ehCelular(testInfo)) await item.getByRole('button').first().click();
    else await item.getByRole('button', { name: 'Confirmar presença' }).click();
    const detalhes = paginaMonitor.getByRole('dialog');
    await detalhes.getByRole('button', { name: `Marcar falta de ${aluno.nome}` }).click();
    await expect(paginaMonitor.locator('#toast-container')).toHaveText(/Falta de .* registrada/);
    await expect(
        detalhes.getByRole('button', { name: `Corrigir: ${aluno.nome} estava presente` })
    ).toBeVisible();
    await contextoMonitor.close();

    // 2. O aluno vê a falta no histórico e o aviso de bloqueio
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await page.goto('/perfil_aluno.html');
    await expect(page.getByText(/Novas inscrições bloqueadas até/)).toBeVisible();
    await abrirAba(page, testInfo, { computador: 'Histórico', celular: 'Histórico' });
    await expect(linha(page, disciplina.nome)).toContainText('Falta registrada');

    // 3. Uma nova inscrição é recusada com 423
    const outra = await api.criarDisciplina(clienteMonitor);
    const vagaNova = await api.criarVaga(clienteMonitor, {
        disciplina: outra,
        horario: diaAFrente(4, 15)
    });
    const status = await page.evaluate(async (id) => {
        const r = await fetch('/agendamentos', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_monitoria: id })
        });
        return r.status;
    }, vagaNova.id);
    expect(status).toBe(423);
});
