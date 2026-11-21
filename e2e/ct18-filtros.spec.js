// CT-18 (RF-017): em Marcar monitoria, o aluno filtra os horários por período do dia, monitor e
//        "só com lugar livre"; o calendário e a lista mostram só o que combina.
const { test, expect } = require('@playwright/test');
const api = require('./apoio/api');
const { diaAFrente, horaMinuto, escolherDia, botaoDoDia } = require('./apoio/telas');

const marcar = (disciplina) =>
    `/marcar_monitoria.html?disciplinaID=${disciplina.id}&disciplinaNome=${encodeURIComponent(disciplina.nome)}`;

test('CT-18 filtros de horários: período, monitor e só com lugar livre', async ({
    page,
    context,
    request,
    baseURL
}) => {
    const ana = await api.criarConta(request, 'monitor');
    const bruno = await api.criarConta(request, 'monitor');
    const daAna = await api.clienteDe(request, ana);
    const disciplina = await api.criarDisciplina(daAna);
    const tarde = diaAFrente(3, 15);
    const noiteAna = diaAFrente(3, 19);
    const noiteBruno = diaAFrente(3, 20);
    await api.criarVaga(daAna, { disciplina, horario: tarde });
    const lotada = await api.criarVaga(daAna, { disciplina, horario: noiteAna });
    await api.criarVaga(await api.clienteDe(request, bruno), {
        disciplina,
        horario: noiteBruno,
        capacidade: 2
    });
    // Outro aluno ocupa o único lugar da vaga das 19:00
    await api.inscrever(
        await api.clienteDe(request, await api.criarConta(request, 'aluno')),
        lotada
    );

    const aluno = await api.criarConta(request, 'aluno');
    await api.entrarNoNavegador(context, request, aluno, baseURL);
    await page.goto(marcar(disciplina));
    const filtros = page.getByRole('group', { name: 'Filtrar horários' });
    const dia = await botaoDoDia(page, tarde);
    await expect(dia).toHaveAccessibleName(/3 horários/);

    // 1. Noite: o dia passa a contar só as vagas das 19:00 e das 20:00
    await filtros.getByRole('button', { name: 'Noite' }).click();
    await expect(filtros.getByRole('button', { name: 'Noite' })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await expect(dia).toHaveAccessibleName(/2 horários/);
    await expect(filtros).toContainText('2 horários de 3');

    // 2. Só com lugar livre: a vaga lotada das 19:00 some
    await filtros.getByLabel('Só com lugar livre').check();
    await expect(dia).toHaveAccessibleName(/1 horário/);

    // 3. Monitor Ana: nenhuma vaga dela à noite com lugar; o dia fica sem horários
    await filtros.getByLabel('Monitor').selectOption({ label: ana.nome });
    await expect(filtros).toContainText('0 horários de 3');
    await expect(dia).toBeDisabled();

    // 4. Limpar filtros volta ao começo; com Noite, a lista do dia mostra só as da noite
    await filtros.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(dia).toHaveAccessibleName(/3 horários/);
    await filtros.getByRole('button', { name: 'Noite' }).click();
    await escolherDia(page, tarde);
    await expect(
        page.getByRole('button', { name: new RegExp(`${bruno.nome} ${horaMinuto(noiteBruno)}`) })
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: new RegExp(`${ana.nome} ${horaMinuto(tarde)}`) })
    ).toHaveCount(0);
});
