// CT-09 (RF-003): inscrever alunos numa vaga até exceder a capacidade → vaga exibida como
//        lotada; nova inscrição recusada.
// CT-10 (RNF-005): criar vaga com o local <b>teste</b> e abrir a listagem e o perfil → texto
//        exibido literalmente, sem formatação nem execução de script.
// CT-11 (RN-008): concluir um agendamento e consultar o perfil → a pontuação aumenta uma única
//        vez. Desde P2 (D1) a presença vale com a confirmação do aluno e a do monitor, depois do
//        horário: +2 para o aluno e +10 para o monitor.
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { moverVagaParaOPassado } = require('./apoio/banco');
const { diaAFrente, horaMinuto, escolherDia, irParaRevisao } = require('./apoio/telas');
const { ehCelular, linha, abrirAba, pontosNoPerfil } = require('./apoio/perfil');

const aviso = (page) => page.locator('#toast-container');

async function abrirMarcar(page, disciplina) {
    await page.goto(
        `/marcar_monitoria.html?disciplinaID=${disciplina.id}&disciplinaNome=${encodeURIComponent(disciplina.nome)}`
    );
    await expect(
        page.getByRole('heading', { level: 1, name: `Monitoria de ${disciplina.nome}` })
    ).toBeVisible();
}

test('CT-09 a vaga lota: a tela mostra "Lotada" e a nova inscrição é recusada', async ({
    page,
    context,
    request,
    baseURL
}) => {
    const monitor = await api.criarConta(request, 'monitor');
    const clienteMonitor = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(clienteMonitor);
    const horario = diaAFrente(3, 9);
    const vaga = await api.criarVaga(clienteMonitor, { disciplina, horario, capacidade: 2 });
    await api.inscrever(await api.clienteDe(request, await api.criarConta(request, 'aluno')), vaga);

    // Este aluno abre a tela com 1 lugar livre...
    const aluno = await api.criarConta(request, 'aluno');
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await abrirMarcar(page, disciplina);
    await escolherDia(page, horario);
    const card = page.getByRole('button', {
        name: new RegExp(`${monitor.nome} ${horaMinuto(horario)}`)
    });
    await expect(card).toContainText('Último lugar');
    await card.click();
    const revisao = await irParaRevisao(page);

    // ...e outro aluno ocupa o último lugar antes da confirmação
    await api.inscrever(await api.clienteDe(request, await api.criarConta(request, 'aluno')), vaga);
    await revisao.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page.getByText('Esta vaga de monitoria está lotada.')).toBeVisible();

    // Quem abre a tela depois já vê a vaga lotada e não consegue escolhê-la
    await abrirMarcar(page, disciplina);
    await escolherDia(page, horario);
    const cardLotado = page.getByRole('button', {
        name: new RegExp(`${monitor.nome} ${horaMinuto(horario)}`)
    });
    await expect(cardLotado).toContainText('Lotada');
    await expect(cardLotado).toBeDisabled();

    // Nem pela API, com a sessão do navegador
    const resposta = await page.evaluate(async (id) => {
        const r = await fetch('/agendamentos', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_monitoria: id })
        });
        return r.status;
    }, vaga.id);
    expect(resposta).toBe(409);
});

test('CT-10 local e assunto com HTML aparecem como texto, sem formatar nem executar', async ({
    page,
    context,
    browser,
    request,
    baseURL
}, testInfo) => {
    const monitor = await api.criarConta(request, 'monitor');
    const clienteMonitor = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(clienteMonitor);
    const horario = diaAFrente(3, 11);
    const local = '<b>teste</b>';
    const descricao = '<img src=x onerror="window.__xss=1">Revisão';
    await api.criarVaga(clienteMonitor, { disciplina, horario, local, descricao });

    // Listagem do aluno
    const aluno = await api.criarConta(request, 'aluno');
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await abrirMarcar(page, disciplina);
    await escolherDia(page, horario);
    const card = page.getByRole('button', { name: new RegExp(monitor.nome) });
    await expect(card).toContainText(local);
    await expect(card).toContainText(descricao);
    await expect(page.locator('main b', { hasText: /^teste$/ })).toHaveCount(0);
    await expect(page.locator('main img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    // Perfil do monitor (no celular, o local aparece nos detalhes da vaga)
    const contextoMonitor = await browser.newContext(testInfo.project.use);
    await api.entrarNoNavegador(contextoMonitor, request, monitor, baseURL);
    const paginaMonitor = await contextoMonitor.newPage();
    await paginaMonitor.goto('/perfil_monitor.html');
    await abrirAba(paginaMonitor, testInfo, { computador: /^Próximas/, celular: /^Em aberto/ });
    let escopo = linha(paginaMonitor, disciplina.nome);
    if (ehCelular(testInfo)) {
        await escopo.getByRole('button').first().click();
        escopo = paginaMonitor.getByRole('dialog');
    }
    await expect(escopo).toContainText(local);
    await expect(paginaMonitor.locator('main b, dialog b', { hasText: /^teste$/ })).toHaveCount(0);
    expect(await paginaMonitor.evaluate(() => window.__xss)).toBeUndefined();
    await contextoMonitor.close();
});

test('CT-11 com a presença confirmada pelos dois, a pontuação sobe uma vez só', async ({
    page,
    context,
    browser,
    request,
    baseURL
}, testInfo) => {
    const monitor = await api.criarConta(request, 'monitor');
    const clienteMonitor = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(clienteMonitor);
    const vaga = await api.criarVaga(clienteMonitor, { disciplina, horario: diaAFrente(3, 10) });
    const aluno = await api.criarConta(request, 'aluno');
    const agendamento = await api.inscrever(await api.clienteDe(request, aluno), vaga);
    // A sessão "aconteceu" há 2 horas
    await moverVagaParaOPassado(vaga.id, 2);

    // 1. O aluno confirma pelo perfil: ainda sem pontos
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await page.goto('/perfil_aluno.html');
    await page.getByRole('button', { name: `Confirmar presença em ${disciplina.nome}` }).click();
    await expect(aviso(page)).toHaveText(/monitor também confirmar/i);
    await expect(await pontosNoPerfil(page, testInfo)).toHaveText('0 pontos');

    // 2. O monitor confirma pelo perfil dele
    const contextoMonitor = await browser.newContext(testInfo.project.use);
    await api.entrarNoNavegador(contextoMonitor, request, monitor, baseURL);
    const paginaMonitor = await contextoMonitor.newPage();
    await paginaMonitor.goto('/perfil_monitor.html');
    await abrirAba(paginaMonitor, testInfo, {
        computador: /^Para finalizar/,
        celular: /^Em aberto/
    });
    const item = linha(paginaMonitor, disciplina.nome);
    if (ehCelular(testInfo)) await item.getByRole('button').first().click();
    else await item.getByRole('button', { name: 'Confirmar presença' }).click();
    const detalhes = paginaMonitor.getByRole('dialog');
    await detalhes.getByRole('button', { name: `Confirmar presença de ${aluno.nome}` }).click();
    await expect(aviso(paginaMonitor)).toHaveText(/\+10 pontos/);
    await paginaMonitor.reload();
    await expect(await pontosNoPerfil(paginaMonitor, testInfo)).toHaveText('10 pontos');
    await contextoMonitor.close();

    // 3. O perfil do aluno mostra +2, e confirmar de novo não soma mais nada
    await page.reload();
    await expect(
        page.getByRole('button', { name: `Confirmar presença em ${disciplina.nome}` })
    ).toHaveCount(0);
    await expect(await pontosNoPerfil(page, testInfo)).toHaveText('2 pontos');
    const repetida = await page.evaluate(async (id) => {
        const r = await fetch(`/agendamentos/${id}/presenca`, {
            method: 'PATCH',
            credentials: 'include'
        });
        return r.status;
    }, agendamento.id);
    expect(repetida).toBe(400);
    await page.reload();
    await expect(await pontosNoPerfil(page, testInfo)).toHaveText('2 pontos');
});
