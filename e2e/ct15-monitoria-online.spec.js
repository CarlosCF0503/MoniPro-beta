// CT-15 (RF-016): o monitor cria uma vaga on-line pela tela; o aluno vê "On-line" na lista (sem
//        o link) e, depois de inscrito, o botão "Entrar na sala" com o link no perfil.
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { diaAFrente, horaMinuto, escolherDia } = require('./apoio/telas');
const { abrirAba, linha } = require('./apoio/perfil');

const LINK = 'https://meet.google.com/abc-defg-hij';
const marcar = (disciplina) =>
    `/marcar_monitoria.html?disciplinaID=${disciplina.id}&disciplinaNome=${encodeURIComponent(disciplina.nome)}`;

test('CT-15 vaga on-line: o link da sala só aparece para o aluno inscrito', async ({
    page,
    context,
    browser,
    request,
    baseURL
}, testInfo) => {
    const monitor = await api.criarConta(request, 'monitor');
    const disciplina = await api.criarDisciplina(await api.clienteDe(request, monitor));
    await api.entrarNoNavegador(context, request, monitor, baseURL);
    const horario = diaAFrente(4, 17);

    // 1. O monitor cria a vaga on-line
    await page.goto(marcar(disciplina));
    await escolherDia(page, horario);
    await page.getByRole('combobox', { name: 'Horário' }).click();
    await page.getByRole('option', { name: horaMinuto(horario) }).click();
    await page.getByRole('radio', { name: 'On-line' }).check();
    await expect(page.getByLabel('Local')).toHaveCount(0);
    await page.getByLabel('Link da sala').fill(LINK);
    await page.getByRole('button', { name: 'Revisar vaga' }).click();
    const revisao = page.getByRole('region', { name: 'Revise a vaga antes de criar' });
    await expect(revisao).toContainText(LINK);
    await revisao.getByRole('button', { name: 'Criar vaga' }).click();
    await expect(page.locator('#toast-container')).toHaveText(/vaga criada|sucesso/i);

    // 2. O aluno vê a vaga como on-line, sem o link
    const aluno = await api.criarConta(request, 'aluno');
    const contextoAluno = await browser.newContext(testInfo.project.use);
    await api.entrarNoNavegador(contextoAluno, request, aluno, baseURL);
    const paginaAluno = await contextoAluno.newPage();
    await paginaAluno.goto(marcar(disciplina));
    await escolherDia(paginaAluno, horario);
    const card = paginaAluno.getByRole('button', {
        name: new RegExp(`${monitor.nome} ${horaMinuto(horario)} On-line`)
    });
    await expect(card).toBeVisible();
    await expect(paginaAluno.locator('body')).not.toContainText('meet.google.com');

    // 3. Inscrito, o perfil mostra "Entrar na sala" com o link
    const vagas = await (
        await api.clienteDe(request, aluno)
    ).get(`/monitorias/${disciplina.id}?limit=100`);
    const vaga = (await vagas.json()).monitorias[0];
    expect(vaga).not.toHaveProperty('link');
    await api.inscrever(await api.clienteDe(request, aluno), vaga);
    await paginaAluno.goto('/perfil_aluno.html');
    await abrirAba(paginaAluno, testInfo, { computador: 'Próximas', celular: 'Em aberto' });
    const item = linha(paginaAluno, disciplina.nome);
    if (testInfo.project.name === 'celular') {
        await item.getByRole('button').first().click();
        const dialogo = paginaAluno.getByRole('dialog');
        await expect(dialogo.getByRole('link', { name: 'Entrar na sala' })).toHaveAttribute(
            'href',
            LINK
        );
    } else {
        await expect(item.getByRole('link', { name: 'Entrar na sala' })).toHaveAttribute(
            'href',
            LINK
        );
    }
    await contextoAluno.close();
});
