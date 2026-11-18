// CT-12 (RF-005): com horas suficientes no semestre, o monitor emite a declaração pelo perfil e
//        abre o documento para imprimir, com o nome, a carga horária e o código de verificação.
// CT-13 (RF-005): um visitante sem login confere o código na página pública; depois da
//        revogação pelo script (scripts/certificados.js), a mesma página mostra "Revogada".
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { concluirSessao } = require('./apoio/banco');
const { rodarScript } = require('./apoio/script');
const { diaAFrente } = require('./apoio/telas');
const { ehCelular } = require('./apoio/perfil');

/** Monitor com uma monitoria de 1h30 já finalizada e com a presença confirmada. */
async function monitorComHoras(request) {
    const monitor = await api.criarConta(request, 'monitor');
    const clienteMonitor = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(clienteMonitor);
    const vaga = await api.criarVaga(clienteMonitor, { disciplina, horario: diaAFrente(3, 10) });
    await api.inscrever(await api.clienteDe(request, await api.criarConta(request, 'aluno')), vaga);
    await concluirSessao(vaga.id, { horasAtras: 3, minutos: 90 });
    return { monitor, clienteMonitor, disciplina };
}

test('CT-12 o monitor emite a declaração do semestre e abre o documento', async ({
    page,
    context,
    request,
    baseURL
}, testInfo) => {
    const { monitor, disciplina } = await monitorComHoras(request);
    await api.entrarNoNavegador(context, request, monitor, baseURL);
    await page.goto('/perfil_monitor.html');

    // No computador o cartão fica na coluna lateral; no celular, na seção "Horas"
    if (ehCelular(testInfo)) {
        await page
            .getByRole('navigation', { name: 'Seções do perfil' })
            .getByRole('button', { name: 'Horas' })
            .click();
        await expect(
            page.getByRole('heading', { level: 1, name: 'Horas e certificados' })
        ).toBeVisible();
    }
    const cartao = ehCelular(testInfo)
        ? page.getByRole('main')
        : page.getByRole('region', { name: 'Certificados' });
    await expect(cartao.getByText(/1h30.*pronta para emitir/)).toBeVisible();

    await cartao.getByRole('button', { name: 'Emitir declaração' }).click();
    await expect(page.locator('#toast-container')).toHaveText(/Declaração emitida/);
    const lista = cartao.getByRole('list', { name: 'Declarações emitidas' });
    await expect(lista.getByRole('listitem')).toHaveCount(1);
    await expect(lista).toContainText('Válida');
    // Com uma válida no semestre, emitir de novo avisa que substitui
    await expect(
        cartao.getByRole('button', { name: 'Emitir de novo (substitui a anterior)' })
    ).toBeVisible();

    await lista.getByRole('link', { name: 'Abrir' }).click();
    await expect(page).toHaveURL(/\/certificado\.html\?c=[A-Z0-9]{26}$/);
    const folha = page.getByRole('main');
    await expect(
        folha.getByRole('heading', { level: 1, name: 'Declaração de horas de monitoria' })
    ).toBeVisible();
    await expect(folha).toContainText(monitor.nome);
    await expect(folha.getByRole('table')).toContainText(disciplina.nome);
    await expect(folha.getByRole('table')).toContainText('1h30');
    await expect(folha.locator('.cert-codigo')).toHaveText(/^([A-Z0-9]{4}-){6}[A-Z0-9]{2}$/);
    await expect(page.getByRole('button', { name: 'Imprimir ou salvar em PDF' })).toBeVisible();
});

test('CT-13 a verificação sem login mostra a situação, antes e depois da revogação', async ({
    browser,
    request
}, testInfo) => {
    // Cada "docker compose exec" do script leva alguns segundos
    test.slow();
    const { monitor, clienteMonitor } = await monitorComHoras(request);
    const emissao = await clienteMonitor.post('/certificados', {});
    expect(emissao.status(), await emissao.text()).toBe(201);
    const { codigo } = (await emissao.json()).certificado;
    const impresso = codigo.match(/.{1,4}/g).join('-');

    // Visitante: contexto novo, sem cookie de sessão
    const visitante = await browser.newContext(testInfo.project.use);
    const page = await visitante.newPage();
    const resultado = page.locator('#vf-resultado');

    // Digita o código como está impresso na declaração
    await page.goto('/verificar.html');
    await page.getByLabel('Código de verificação').fill(impresso.toLowerCase());
    await page.getByRole('button', { name: 'Conferir' }).click();
    await expect(resultado).toContainText('Válida');
    await expect(resultado).toContainText(monitor.nome);
    await expect(resultado).toContainText('1h30');
    await expect(resultado).not.toContainText('Revogada em');

    // Simular a revogação não muda nada
    const simulacao = rodarScript('certificados.js', [
        '--revogar',
        impresso,
        '--motivo',
        'Teste de ponta a ponta'
    ]);
    expect(simulacao).toContain('simulação, nada foi alterado');
    await page.goto('/verificar.html?c=' + codigo);
    await expect(resultado).toContainText('Válida');

    // Revogada de fato: o link impresso na declaração passa a mostrar a revogação
    const aplicada = rodarScript('certificados.js', [
        '--revogar',
        impresso,
        '--motivo',
        'Teste de ponta a ponta',
        '--aplicar'
    ]);
    expect(aplicada).toContain('declaração revogada');
    await page.goto('/verificar.html?c=' + codigo);
    await expect(resultado).toContainText('Revogada');
    await expect(resultado).toContainText('Revogada em');
    await expect(resultado).not.toContainText('Teste de ponta a ponta');

    // O dono também vê a situação no perfil
    const lista = await clienteMonitor.get('/certificados');
    expect((await lista.json()).certificados[0]).toMatchObject({ codigo, situacao: 'revogado' });

    await visitante.close();
});
