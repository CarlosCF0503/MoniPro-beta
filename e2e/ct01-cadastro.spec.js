// CT-01 (RF-001): cadastrar um aluno e um monitor preenchendo os 5 campos.
// Esperado: conta criada, aviso de sucesso e volta ao login; senha fraca recusada.
const { test, expect } = require('@playwright/test');
const { sufixo, matriculaUnica, SENHA } = require('./apoio/api');

const aviso = (page) => page.locator('#toast-container');

async function preencherCadastro(page, { nome, email, matricula, senha }) {
    await page.getByLabel('Nome Completo').fill(nome);
    await page.getByLabel('Endereço de E-mail').fill(email);
    await page.getByLabel('Matrícula').fill(String(matricula));
    await page.getByLabel('Senha', { exact: true }).fill(senha);
    await page.getByLabel('Confirmar Senha').fill(senha);
}

for (const perfil of ['Aluno', 'Monitor']) {
    test(`CT-01 cadastro de ${perfil.toLowerCase()} pela tela`, async ({ page }) => {
        const s = sufixo();
        const dados = {
            nome: `E2E ${perfil} ${s}`,
            email: `ct01.${perfil.toLowerCase()}.${s}@e2e.invalid`,
            matricula: matriculaUnica()
        };

        await page.goto('/index.html');
        await page.getByRole('link', { name: 'Cadastre-se' }).click();
        await expect(page.getByRole('heading', { name: 'Qual é o seu perfil?' })).toBeVisible();
        await page.getByRole('link', { name: perfil, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`cadastro\\.html\\?tipo=${perfil.toLowerCase()}`));

        // Senha fraca: a API recusa e a tela explica o motivo
        await preencherCadastro(page, { ...dados, senha: 'abc' });
        await page.getByRole('button', { name: 'Cadastrar' }).click();
        await expect(aviso(page)).toHaveText(/senha/i);
        await expect(page).toHaveURL(/cadastro\.html/);

        await preencherCadastro(page, { ...dados, senha: SENHA });
        await page.getByRole('button', { name: 'Cadastrar' }).click();
        await expect(aviso(page)).toHaveText(/conta criada com sucesso/i);
        await expect(page).toHaveURL(/index\.html$/, { timeout: 10000 });

        // A conta nova entra pelo login, no perfil em que foi criada
        await page.getByText(perfil, { exact: true }).click();
        await page.getByLabel('E-mail ou Matrícula').fill(dados.email);
        await page.getByLabel('Senha', { exact: true }).fill(SENHA);
        await page.getByRole('button', { name: 'Acessar Sistema' }).click();
        await expect(page).toHaveURL(/base\.html$/, { timeout: 10000 });
    });
}
