// CT-14 (RF-013, RN-015): numa vaga lotada, o aluno entra na lista de espera e vê a posição;
//        quando o inscrito cancela, ele passa a inscrito sozinho e o perfil mostra isso.
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { diaAFrente, horaMinuto, escolherDia } = require('./apoio/telas');
const { abrirAba, linha } = require('./apoio/perfil');

test('CT-14 lista de espera: entra na fila da vaga lotada e é inscrito quando abre um lugar', async ({
    page,
    context,
    request,
    baseURL
}, testInfo) => {
    const monitor = await api.criarConta(request, 'monitor');
    const clienteMonitor = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(clienteMonitor);
    const horario = diaAFrente(3, 11);
    const vaga = await api.criarVaga(clienteMonitor, { disciplina, horario, capacidade: 1 });
    const clienteInscrito = await api.clienteDe(request, await api.criarConta(request, 'aluno'));
    const inscricao = await api.inscrever(clienteInscrito, vaga);

    // 1. O aluno encontra a vaga lotada e entra na lista de espera
    const aluno = await api.criarConta(request, 'aluno');
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await page.goto(
        `/marcar_monitoria.html?disciplinaID=${disciplina.id}&disciplinaNome=${encodeURIComponent(disciplina.nome)}`
    );
    await escolherDia(page, horario);
    const card = page.getByRole('button', {
        name: new RegExp(`${monitor.nome} ${horaMinuto(horario)}`)
    });
    await expect(card).toContainText('Lotada · lista de espera');
    await card.click();
    await page
        .getByRole('button', { name: /^(Entrar na lista de espera|Continuar)$/ })
        .first()
        .click();
    const revisao = page.getByRole('region', { name: 'Vaga lotada: entre na lista de espera' });
    await expect(revisao).toContainText('Você será o primeiro');
    await revisao.getByRole('button', { name: 'Entrar na lista de espera' }).click();
    const sucesso = page.locator('#sucesso');
    await expect(sucesso).toContainText('Você está na lista de espera');
    await expect(sucesso).toContainText('1º da fila');

    // 2. No perfil, a inscrição aparece como lista de espera
    await page.goto('/perfil_aluno.html');
    await abrirAba(page, testInfo, { computador: 'Próximas', celular: 'Em aberto' });
    await expect(linha(page, disciplina.nome)).toContainText('Lista de espera');

    // 3. O inscrito cancela: o aluno da fila vira inscrito na hora
    const cancelamento = await clienteInscrito.delete(`/agendamentos/${inscricao.id}`);
    expect(cancelamento.status()).toBe(200);
    await page.reload();
    await abrirAba(page, testInfo, { computador: 'Próximas', celular: 'Em aberto' });
    await expect(linha(page, disciplina.nome)).not.toContainText('Lista de espera');
    if (testInfo.project.name === 'computador')
        await expect(linha(page, disciplina.nome)).toContainText(
            'Você entrou pela lista de espera'
        );
});
