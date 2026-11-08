// CT-02 (RF-001): entrar com e-mail ou matrícula, escolhendo o perfil.
// Esperado: acesso à página principal; credenciais erradas exibem erro.
const { test, expect } = require('@playwright/test');
const { criarConta } = require('./apoio/api');

const aviso = (page) => page.locator('#toast-container');

async function entrar(page, perfil, identificador, senha) {
    await page.goto('/index.html');
    await page.getByText(perfil, { exact: true }).click();
    await page.getByLabel('E-mail ou Matrícula').fill(String(identificador));
    await page.getByLabel('Senha', { exact: true }).fill(senha);
    await page.getByRole('button', { name: 'Acessar Sistema' }).click();
}

test('CT-02 aluno entra pelo e-mail e vê a página principal', async ({ page, request }) => {
    const aluno = await criarConta(request, 'aluno');

    await entrar(page, 'Aluno', aluno.email, aluno.senha);

    await expect(aviso(page)).toHaveText(/login realizado/i);
    await expect(page).toHaveURL(/base\.html$/, { timeout: 10000 });
    await expect(page.getByRole('heading', { level: 1, name: /^Olá, E2E!$/ })).toBeVisible();
});

test('CT-02 monitor entra pela matrícula', async ({ page, request }) => {
    const monitor = await criarConta(request, 'monitor');

    await entrar(page, 'Monitor', monitor.matricula, monitor.senha);

    await expect(page).toHaveURL(/base\.html$/, { timeout: 10000 });
});

test('CT-02 credenciais erradas e perfil errado exibem erro e não entram', async ({
    page,
    request
}) => {
    const aluno = await criarConta(request, 'aluno');

    await entrar(page, 'Aluno', aluno.email, 'senhaErrada99');
    await expect(aviso(page)).toHaveText('E-mail/matrícula ou senha incorretos.');
    await expect(page).toHaveURL(/index\.html$/);

    // Conta de aluno tentando entrar como monitor: mesma mensagem (sem revelar o que existe)
    await entrar(page, 'Monitor', aluno.email, aluno.senha);
    await expect(aviso(page)).toHaveText('E-mail/matrícula ou senha incorretos.');
    await expect(page).toHaveURL(/index\.html$/);
});
