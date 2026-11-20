// CT-17 (RF-015): "Adicionar à agenda" baixa um .ics com a monitoria — para o aluno, da
//        inscrição; para o monitor, da vaga. O arquivo é montado no navegador.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { diaAFrente } = require('./apoio/telas');
const { abrirAba, acaoNaLinha } = require('./apoio/perfil');

const ABAS = { computador: 'Próximas', celular: 'Em aberto' };
const utc = (d) =>
    d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');

async function baixarAgenda(page, testInfo, disciplina) {
    const [arquivo] = await Promise.all([
        page.waitForEvent('download'),
        acaoNaLinha(page, testInfo, disciplina, 'à agenda')
    ]);
    expect(arquivo.suggestedFilename()).toMatch(/^monitoria-de-disciplina-e2e-.*\.ics$/);
    await expect(page.locator('#toast-container')).toHaveText(/Arquivo baixado/);
    // Desfaz as dobras de linha do .ics antes de comparar
    return fs.readFileSync(await arquivo.path(), 'utf8').replace(/\r\n /g, '');
}

test('CT-17 adicionar à agenda: aluno e monitor baixam o .ics da monitoria', async ({
    page,
    context,
    browser,
    request,
    baseURL
}, testInfo) => {
    const monitor = await api.criarConta(request, 'monitor');
    const doMonitor = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(doMonitor);
    const horario = diaAFrente(3, 15);
    const vaga = await api.criarVaga(doMonitor, {
        disciplina,
        horario,
        local: 'Bloco B, sala 204'
    });
    const aluno = await api.criarConta(request, 'aluno');
    const inscricao = await api.inscrever(await api.clienteDe(request, aluno), vaga);

    // 1. O aluno baixa o evento da inscrição
    const contextoAluno = await browser.newContext(testInfo.project.use);
    await api.entrarNoNavegador(contextoAluno, request, aluno, baseURL);
    const paginaAluno = await contextoAluno.newPage();
    await paginaAluno.goto('/perfil_aluno.html');
    await abrirAba(paginaAluno, testInfo, ABAS);
    const ics = await baixarAgenda(paginaAluno, testInfo, disciplina.nome);
    expect(ics).toContain(`UID:inscricao-${inscricao.id}@moni-pro.app.br\r\n`);
    expect(ics).toContain(`DTSTART:${utc(horario)}\r\n`);
    expect(ics).toContain(`SUMMARY:Monitoria de ${disciplina.nome}\r\n`);
    expect(ics).toContain('LOCATION:Bloco B\\, sala 204\r\n');
    expect(ics).toContain(`DESCRIPTION:Monitor: ${monitor.nome}`);
    expect(ics).toContain('TRIGGER:-PT60M\r\n');
    await contextoAluno.close();

    // 2. O monitor baixa o evento da vaga
    await api.entrarNoNavegador(context, request, monitor, baseURL);
    await page.goto('/perfil_monitor.html');
    await abrirAba(page, testInfo, ABAS);
    const icsMonitor = await baixarAgenda(page, testInfo, disciplina.nome);
    expect(icsMonitor).toContain(`UID:vaga-${vaga.id}@moni-pro.app.br\r\n`);
    expect(icsMonitor).toContain(`SUMMARY:Monitoria de ${disciplina.nome} (monitor)\r\n`);
    expect(icsMonitor).toContain(`DTSTART:${utc(horario)}\r\n`);
});
