// CT-07 (RF-001): sair da plataforma pelo menu.
// Esperado: sessão encerrada e retorno ao login. Desde P3 (R7) o "sair" também revoga a
// sessão no servidor: o cookie antigo deixa de valer.
const { test, expect } = require('@playwright/test');
const { criarConta, entrarNoNavegador } = require('./apoio/api');

test('CT-07 sair pelo menu encerra a sessão e volta ao login', async ({
    page,
    context,
    request,
    baseURL
}) => {
    const aluno = await criarConta(request, 'aluno');
    await entrarNoNavegador(context, request, aluno, baseURL);
    await page.goto('/base.html');
    await expect(page.getByRole('heading', { level: 1, name: /^Olá/ })).toBeVisible();
    const [cookieAntes] = await context.cookies();

    await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
    await page.getByRole('button', { name: 'Sair do sistema' }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();

    await expect(page).toHaveURL(/index\.html$/, { timeout: 10000 });
    expect(await context.cookies()).toEqual([]);

    // O cookie copiado antes do "sair" não abre mais a sessão
    const comCopia = await request.get('/auth/sessao', {
        headers: { Cookie: `${cookieAntes.name}=${cookieAntes.value}` }
    });
    expect(comCopia.status()).toBe(401);

    // E as páginas internas mandam de volta ao login
    await page.goto('/perfil_aluno.html');
    await expect(page).toHaveURL(/index\.html$/, { timeout: 10000 });
});
