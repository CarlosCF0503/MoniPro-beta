// CT-19 (RF-014): o monitor cria uma vaga que se repete toda semana; a data em que ele já tem
//        vaga no horário fica de fora. No perfil, "Esta e as próximas" cancela a série de uma vez.
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { diaAFrente, horaMinuto, escolherDia } = require('./apoio/telas');
const { ehCelular, linha, abrirAba } = require('./apoio/perfil');

const DIA = 24 * 60 * 60 * 1000;
const marcar = (disciplina) =>
    `/marcar_monitoria.html?disciplinaID=${disciplina.id}&disciplinaNome=${encodeURIComponent(disciplina.nome)}`;
const emBrasilia = (data) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data);

test('CT-19 vaga semanal: pula a data com conflito e cancela esta e as próximas', async ({
    page,
    context,
    request,
    baseURL
}, testInfo) => {
    const monitor = await api.criarConta(request, 'monitor');
    const cliente = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(cliente);
    const primeira = diaAFrente(3, 16);
    const ultima = new Date(primeira.getTime() + 21 * DIA);
    // O monitor já tem vaga na segunda semana, no mesmo horário
    await api.criarVaga(cliente, {
        disciplina,
        horario: new Date(primeira.getTime() + 7 * DIA),
        local: 'Sala avulsa'
    });
    await api.entrarNoNavegador(context, request, monitor, baseURL);

    // 1. Cria a série: 4 semanas, uma fica de fora
    await page.goto(marcar(disciplina));
    await escolherDia(page, primeira);
    await page.getByRole('button', { name: 'Horário', exact: true }).click();
    await page.getByRole('option', { name: horaMinuto(primeira) }).click();
    await page.getByLabel('Local').fill('Sala 12');
    await page.getByLabel('Repetir toda semana').check();
    await page.getByLabel('Até', { exact: true }).fill(emBrasilia(ultima));
    await expect(page.locator('#serie-resumo')).toContainText('3 vagas');
    await page.getByRole('button', { name: 'Revisar vaga' }).click();
    const revisao = page.getByRole('region', { name: 'Revise a vaga antes de criar' });
    await expect(revisao).toContainText('Fica de fora');
    await revisao.getByRole('button', { name: 'Criar 3 vagas' }).click();
    await expect(page.getByRole('heading', { name: '3 vagas criadas!' })).toBeVisible();

    const minhas = await (await cliente.get(`/monitorias/${disciplina.id}?limit=100`)).json();
    const daSerie = minhas.monitorias.filter((v) => v.local === 'Sala 12');
    expect(daSerie).toHaveLength(3);

    // 2. No perfil, cancela a primeira da série com "Esta e as próximas"
    await page.goto('/perfil_monitor.html');
    await abrirAba(page, testInfo, { computador: /^Próximas/, celular: /^Em aberto/ });
    await expect(linha(page, disciplina.nome)).toHaveCount(4);
    // A lista vem em ordem de data: a primeira é a primeira da série
    const item = linha(page, disciplina.nome).first();
    if (ehCelular(testInfo)) {
        await item.getByRole('button').first().click();
        await page.getByRole('dialog').getByRole('button', { name: 'Cancelar vaga' }).click();
    } else {
        await item.getByRole('button', { name: 'Cancelar vaga' }).click();
    }
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('radio', { name: /^Esta e as próximas: 3 vagas/ }).check();
    await dialogo.getByRole('button', { name: 'Cancelar 3 vagas' }).click();
    await expect(page.locator('#toast-container')).toHaveText(/3 vagas canceladas/);

    // A vaga avulsa continua; as da série vão para o histórico como canceladas
    await expect(linha(page, disciplina.nome)).toHaveCount(1);
    const depois = await (await cliente.get(`/monitorias/${disciplina.id}?limit=100`)).json();
    expect(depois.monitorias.map((v) => v.local)).toEqual(['Sala avulsa']);
    await abrirAba(page, testInfo, { computador: /^Histórico/, celular: /^Histórico/ });
    await expect(linha(page, disciplina.nome).filter({ hasText: /Cancelada/ })).toHaveCount(3);
});
