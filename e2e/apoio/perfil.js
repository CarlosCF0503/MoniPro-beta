// R1 (E2E): ações nos perfis do aluno e do monitor. No computador as monitorias ficam em abas
// (Para confirmar/Para finalizar, Próximas, Histórico) com os botões na própria linha; no
// celular há duas abas (Em aberto, Histórico), cada linha é um botão que abre os detalhes, e
// os pontos ficam numa seção à parte.
const { expect } = require('@playwright/test');

function ehCelular(testInfo) {
    return testInfo.project.name === 'celular';
}

/** Linha da monitoria/vaga na lista visível, pelo nome da disciplina. */
function linha(page, disciplina) {
    return page.getByRole('tabpanel').getByRole('listitem').filter({ hasText: disciplina });
}

async function abrirAba(page, testInfo, { computador, celular }) {
    const nome = ehCelular(testInfo) ? celular : computador;
    await page.getByRole('tab', { name: nome }).click();
    await expect(page.getByRole('tab', { name: nome })).toHaveAttribute('aria-selected', 'true');
}

/**
 * Executa a ação de uma linha. No computador o botão está na linha; no celular, a linha abre o
 * diálogo de detalhes e o botão fica lá dentro. Devolve o escopo onde o botão foi clicado.
 */
async function acaoNaLinha(page, testInfo, disciplina, nomeBotao) {
    const item = linha(page, disciplina);
    await expect(item).toHaveCount(1);
    if (!ehCelular(testInfo)) {
        await item.getByRole('button', { name: nomeBotao }).click();
        return item;
    }
    await item.getByRole('button').first().click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: nomeBotao }).click();
    return dialogo;
}

/** Pontos mostrados nos dados do usuário (no celular, na seção "Perfil"). */
async function pontosNoPerfil(page, testInfo) {
    if (ehCelular(testInfo)) {
        await page
            .getByRole('navigation', { name: 'Seções do perfil' })
            .getByRole('button', { name: 'Perfil' })
            .click();
        await expect(page.getByRole('heading', { level: 1, name: 'Meus dados' })).toBeVisible();
    }
    return page
        .getByRole('main')
        .getByText(/^\d+ pontos$/)
        .first();
}

module.exports = { ehCelular, linha, abrirAba, acaoNaLinha, pontosNoPerfil };
