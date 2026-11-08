// CT-03 (RF-003): abrir Monitoria e escolher uma disciplina → calendário com os dias que têm vagas.
// CT-04 (RF-003): como aluno, escolher dia, monitor e horário e agendar → aviso de sucesso e a
//                 inscrição aparece no perfil.
// CT-05 (RF-003): como monitor, criar vaga com horário, local e descrição → a vaga aparece no
//                 calendário para os alunos.
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { linha, abrirAba } = require('./apoio/perfil');
const { diaAFrente, horaMinuto, botaoDoDia, escolherDia, irParaRevisao } = require('./apoio/telas');

const aviso = (page) => page.locator('#toast-container');

/** Monitor com uma disciplina própria e uma vaga daqui a `dias` dias. */
async function prepararVaga(request, { dias = 3, hora = 14, capacidade = 2 } = {}) {
    const monitor = await api.criarConta(request, 'monitor');
    const cliente = await api.clienteDe(request, monitor);
    const disciplina = await api.criarDisciplina(cliente);
    const horario = diaAFrente(dias, hora);
    const vaga = await api.criarVaga(cliente, {
        disciplina,
        horario,
        capacidade,
        local: 'Bloco E2E, sala 1',
        descricao: 'Dúvidas da lista'
    });
    return { monitor, disciplina, horario, vaga };
}

async function abrirDisciplina(page, nome) {
    await page.goto('/base.html');
    await page.getByRole('link', { name: 'Ir para Monitoria' }).first().click();
    await expect(page).toHaveURL(/escolha_disciplina\.html/);
    await page.getByLabel('Buscar disciplina').fill(nome);
    await page.getByRole('link', { name: new RegExp(nome) }).click();
    await expect(
        page.getByRole('heading', { level: 1, name: `Monitoria de ${nome}` })
    ).toBeVisible();
}

test('CT-03 a disciplina abre o calendário com o dia que tem vaga', async ({
    page,
    context,
    request,
    baseURL
}) => {
    const { disciplina, horario } = await prepararVaga(request);
    const aluno = await api.criarConta(request, 'aluno');
    await api.entrarNoNavegador(context, request, aluno, baseURL);

    await abrirDisciplina(page, disciplina.nome);

    const dia = await botaoDoDia(page, horario);
    await expect(dia).toBeEnabled();
    await expect(dia).toHaveAccessibleName(/, 1 horário/);
    await expect(page.getByText(/1 horário em 1 dia/)).toBeVisible();
    // Só o dia da vaga fica habilitado
    await expect(page.getByRole('button', { name: /, 1 horário/ })).toHaveCount(1);
});

test('CT-04 o aluno agenda pela tela e a inscrição aparece no perfil', async ({
    page,
    context,
    request,
    baseURL
}, testInfo) => {
    const { monitor, disciplina, horario } = await prepararVaga(request);
    const aluno = await api.criarConta(request, 'aluno');
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await abrirDisciplina(page, disciplina.nome);

    await escolherDia(page, horario);
    await page
        .getByRole('button', { name: new RegExp(`${monitor.nome} ${horaMinuto(horario)}`) })
        .click();
    const revisao = await irParaRevisao(page);
    await expect(revisao).toContainText(disciplina.nome);
    await expect(revisao).toContainText(horaMinuto(horario));
    await revisao.getByRole('button', { name: 'Confirmar agendamento' }).click();

    await expect(aviso(page)).toHaveText(/agendad|sucesso/i);

    await page.goto('/perfil_aluno.html');
    await abrirAba(page, testInfo, { computador: /^Próximas/, celular: /^Em aberto/ });
    await expect(linha(page, disciplina.nome)).toContainText(horaMinuto(horario));
});

test('CT-05 o monitor cria a vaga pela tela e o aluno a vê no calendário', async ({
    page,
    context,
    browser,
    request,
    baseURL
}) => {
    const monitor = await api.criarConta(request, 'monitor');
    const disciplina = await api.criarDisciplina(await api.clienteDe(request, monitor));
    await api.entrarNoNavegador(context, request, monitor, baseURL);
    const horario = diaAFrente(4, 16);

    await abrirDisciplina(page, disciplina.nome);
    await escolherDia(page, horario);
    await page.getByRole('button', { name: 'Horário', exact: true }).click();
    await page.getByRole('option', { name: horaMinuto(horario) }).click();
    await page.getByLabel('Local').fill('Laboratório E2E');
    await page.getByLabel('Assunto (opcional)').fill('Revisão para a prova');
    await page.getByRole('button', { name: 'Revisar vaga' }).click();
    const revisao = page.getByRole('region', { name: 'Revise a vaga antes de criar' });
    await expect(revisao).toContainText('Laboratório E2E');
    await revisao.getByRole('button', { name: 'Criar vaga' }).click();
    await expect(aviso(page)).toHaveText(/vaga criada|sucesso/i);

    // Outro navegador, como aluno
    const aluno = await api.criarConta(request, 'aluno');
    const contextoAluno = await browser.newContext(test.info().project.use);
    await api.entrarNoNavegador(contextoAluno, request, aluno, baseURL);
    const paginaAluno = await contextoAluno.newPage();
    await abrirDisciplina(paginaAluno, disciplina.nome);
    await escolherDia(paginaAluno, horario);
    await expect(
        paginaAluno.getByRole('button', {
            name: new RegExp(
                `${monitor.nome} ${horaMinuto(horario)} Laboratório E2E Revisão para a prova`
            )
        })
    ).toBeVisible();
    await contextoAluno.close();
});
