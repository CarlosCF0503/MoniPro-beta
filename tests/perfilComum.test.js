// Peças comuns aos perfis do aluno e do monitor (Monipro_web/JS/perfil/comum.js)
jest.mock('../Monipro_web/JS/api.js', () => ({ obterSessao: jest.fn() }));
jest.mock('../Monipro_web/JS/toast.js', () => ({ showToast: jest.fn() }));

const { obterSessao } = require('../Monipro_web/JS/api.js');
const { showToast } = require('../Monipro_web/JS/toast.js');
const { conferirSessaoDoPerfil, icone } = require('../Monipro_web/JS/perfil/comum.js');

describe('perfil — conferência da sessão', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        global.window = { location: { href: 'perfil_aluno.html' } };
    });
    afterEach(() => {
        jest.useRealTimers();
        delete global.window;
    });

    test.each([
        [false, 'aluno'],
        [false, 'coordenador'],
        [true, 'monitor']
    ])('página do monitor = %s e conta %s: segue na página', async (paginaDoMonitor, tipo) => {
        obterSessao.mockResolvedValue({ id: 1, tipo });
        await expect(conferirSessaoDoPerfil(paginaDoMonitor)).resolves.toBe(true);
        expect(global.window.location.href).toBe('perfil_aluno.html');
    });

    test('monitor na página do aluno vai para o perfil do monitor', async () => {
        obterSessao.mockResolvedValue({ id: 2, tipo: 'monitor' });
        await expect(conferirSessaoDoPerfil(false)).resolves.toBe(false);
        expect(global.window.location.href).toBe('perfil_monitor.html');
    });

    test('aluno na página do monitor vai para o perfil do aluno', async () => {
        global.window.location.href = 'perfil_monitor.html';
        obterSessao.mockResolvedValue({ id: 1, tipo: 'aluno' });
        await expect(conferirSessaoDoPerfil(true)).resolves.toBe(false);
        expect(global.window.location.href).toBe('perfil_aluno.html');
    });

    test('sem sessão: avisa e volta ao login depois de 1,5 s', async () => {
        obterSessao.mockResolvedValue(null);
        await expect(conferirSessaoDoPerfil(true)).resolves.toBe(false);
        expect(showToast).toHaveBeenCalledWith('Sessão expirada. Faça login novamente.', 'error');
        expect(global.window.location.href).toBe('perfil_aluno.html');
        jest.advanceTimersByTime(1500);
        expect(global.window.location.href).toBe('index.html');
    });

    test('servidor fora do ar: mostra o erro e não segue', async () => {
        const erro = new Error('Não foi possível conectar ao servidor.');
        obterSessao.mockRejectedValue(erro);
        await expect(conferirSessaoDoPerfil(false)).resolves.toBe(false);
        expect(showToast).toHaveBeenCalledWith(erro.message, 'error', erro);
    });
});

describe('perfil — ícones', () => {
    test('monta o SVG decorativo com 14 px por padrão', () => {
        const svg = icone('ok');
        expect(svg).toContain('width="14" height="14"');
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).toContain('<polyline points="20 6 9 17 4 12"/>');
        expect(icone('ok', 18)).toContain('width="18" height="18"');
    });

    test('tem os ícones dos dois perfis (doc só do aluno, medalha só do monitor)', () => {
        expect(icone('doc')).toContain('M14 3H6');
        expect(icone('medalha')).toContain('M15.48 12.89');
    });
});
