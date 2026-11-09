// CT-06 (RF-003, RF-004): no perfil, sair de uma monitoria (aluno) e cancelar uma vaga
//        (monitor) → inscrição removida; vaga com status cancelada.
// CT-08 (RN-001): tentar sair de uma monitoria que começa em menos de 24 horas → operação
//        recusada, com mensagem sobre a antecedência de 24 horas.
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { diaAFrente, HORA } = require('./apoio/telas');
const { ehCelular, linha, abrirAba, acaoNaLinha } = require('./apoio/perfil');

const aviso = (page) => page.locator('#toast-container');

async function vagaComAluno(request, horario) {
    const monitor = await api.criarConta(request, 'monitor');
    const clienteMonitor = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(clienteMonitor);
    const vaga = await api.criarVaga(clienteMonitor, { disciplina, horario, capacidade: 2 });
    const aluno = await api.criarConta(request, 'aluno');
    const clienteAluno = await api.clienteDe(request, aluno);
    const agendamento = await api.inscrever(clienteAluno, vaga);
    return { monitor, disciplina, vaga, aluno, clienteAluno, agendamento };
}

test('CT-06 o aluno sai de uma monitoria pelo perfil', async ({
    page,
    context,
    request,
    baseURL
}, testInfo) => {
    const { disciplina, aluno } = await vagaComAluno(request, diaAFrente(3, 15));
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await page.goto('/perfil_aluno.html');
    await abrirAba(page, testInfo, { computador: /^Próximas/, celular: /^Em aberto/ });

    await acaoNaLinha(page, testInfo, disciplina.nome, 'Cancelar inscrição');
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: /^(Cancelar inscrição|Confirmar|Sim)/ }).click();

    await expect(aviso(page)).toHaveText('Inscrição cancelada.');
    await expect(linha(page, disciplina.nome)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(disciplina.nome)).toHaveCount(0);
});

test('CT-06 o monitor cancela uma vaga pelo perfil e ela fica como cancelada', async ({
    page,
    context,
    request,
    baseURL
}, testInfo) => {
    const monitor = await api.criarConta(request, 'monitor');
    const cliente = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(cliente);
    await api.criarVaga(cliente, { disciplina, horario: diaAFrente(5, 10) });
    await api.entrarNoNavegador(context, request, monitor, baseURL);
    await page.goto('/perfil_monitor.html');
    await abrirAba(page, testInfo, { computador: /^Próximas/, celular: /^Em aberto/ });

    await acaoNaLinha(page, testInfo, disciplina.nome, 'Cancelar vaga');
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: /^(Cancelar vaga|Confirmar|Sim)/ }).click();

    await expect(aviso(page)).toHaveText(/cancelada/i);
    await abrirAba(page, testInfo, { computador: /^Histórico/, celular: /^Histórico/ });
    await expect(linha(page, disciplina.nome)).toContainText(/Cancelada/);
});

test('CT-08 a menos de 24 horas o aluno não consegue sair da monitoria', async ({
    page,
    context,
    request,
    baseURL
}, testInfo) => {
    const daquiADuasHoras = new Date(Date.now() + 2 * HORA);
    const { disciplina, aluno, agendamento } = await vagaComAluno(request, daquiADuasHoras);
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await page.goto('/perfil_aluno.html');
    await abrirAba(page, testInfo, { computador: /^Próximas/, celular: /^Em aberto/ });

    // A tela não oferece o cancelamento e explica o motivo (no celular, nos detalhes)
    const item = linha(page, disciplina.nome);
    await expect(item).toHaveCount(1);
    let escopo = item;
    if (ehCelular(testInfo)) {
        await item.getByRole('button').first().click();
        escopo = page.getByRole('dialog');
    }
    await expect(escopo.getByText(/Cancelamento só até 24h antes/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar inscrição' })).toHaveCount(0);

    // E a API recusa mesmo que alguém tente direto, com a sessão do aluno
    const resposta = await page.evaluate(async (id) => {
        const r = await fetch(`/agendamentos/${id}`, { method: 'DELETE', credentials: 'include' });
        return { status: r.status, corpo: await r.json() };
    }, agendamento.id);
    expect(resposta.status).toBe(400);
    expect(resposta.corpo.erro).toMatch(/24h de antecedência/);
});
