// R3 (LGPD): excluir a conta (DELETE /perfil), registro do último acesso no login e rotina de
// retenção (scripts/retencao.js).
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { gerarToken } = require('./helpers/token');

jest.mock('../src/config/bancoDeDados', () => {
    const prisma = {
        usuario: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            deleteMany: jest.fn()
        },
        agendamento: { updateMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
        monitoria: { updateMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
        tokenRedefinicao: { count: jest.fn(), deleteMany: jest.fn() },
        tokenConfirmacaoEmail: { count: jest.fn(), deleteMany: jest.fn() }
    };
    prisma.$transaction = jest.fn((fn) => fn(prisma));
    return prisma;
});

const prisma = require('../src/config/bancoDeDados');
const privacidadeService = require('../src/services/privacidadeService');
const app = require('../src/app');

const COOKIE = 'monipro_sessao';
const cookieDe = (id, tipo = 'aluno') => `${COOKIE}=${gerarToken({ id, tipo })}`;
const AGORA = new Date('2026-11-09T12:00:00.000Z');

let hashSenha;
beforeAll(async () => {
    hashSenha = await bcrypt.hash('senhaCerta1', 4);
});
beforeEach(() => {
    jest.clearAllMocks();
    prisma.agendamento.updateMany.mockResolvedValue({ count: 0 });
    prisma.monitoria.updateMany.mockResolvedValue({ count: 0 });
    prisma.usuario.update.mockResolvedValue({ id: 7 });
    prisma.tokenRedefinicao.deleteMany.mockResolvedValue({ count: 0 });
    prisma.tokenConfirmacaoEmail.deleteMany.mockResolvedValue({ count: 0 });
    prisma.tokenConfirmacaoEmail.count.mockResolvedValue(0);
    prisma.usuario.count.mockResolvedValue(0);
    prisma.usuario.deleteMany.mockResolvedValue({ count: 0 });
});

describe('DELETE /perfil — excluir a minha conta', () => {
    const excluir = (corpo, cookie = cookieDe(7)) =>
        request(app).delete('/perfil').set('Cookie', cookie).send(corpo);

    it('sem sessão: 401', async () => {
        const resposta = await request(app).delete('/perfil').send({ senha: 'senhaCerta1' });
        expect(resposta.status).toBe(401);
    });

    it('sem a senha: 400, e nada é alterado', async () => {
        const resposta = await excluir({});
        expect(resposta.status).toBe(400);
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('senha errada: 400 "Senha incorreta.", e nada é alterado', async () => {
        prisma.usuario.findUnique.mockResolvedValue({
            id: 7,
            senha: hashSenha,
            email_confirmado_em: new Date(),
            anonimizado_em: null
        });

        const resposta = await excluir({ senha: 'outraSenha2' });

        expect(resposta.status).toBe(400);
        expect(resposta.body.erro).toBe('Senha incorreta.');
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('senha certa: anonimiza a conta, cancela o futuro, revoga as sessões e apaga o cookie', async () => {
        prisma.usuario.findUnique.mockResolvedValue({
            id: 7,
            senha: hashSenha,
            email_confirmado_em: new Date(),
            anonimizado_em: null
        });

        const resposta = await excluir({ senha: 'senhaCerta1' });

        expect(resposta.status).toBe(200);
        expect(resposta.body).toEqual({ success: true, mensagem: 'Sua conta foi excluída.' });
        const cookie = resposta.headers['set-cookie'].find((c) => c.startsWith(`${COOKIE}=`));
        expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);

        // Inscrições futuras do aluno canceladas (libera os lugares)
        expect(prisma.agendamento.updateMany).toHaveBeenCalledWith({
            where: {
                id_aluno: 7,
                status: { in: ['pendente', 'confirmado'] },
                data_hora: { gt: expect.any(Date) }
            },
            data: { status: 'cancelado' }
        });
        // Vagas futuras (se for monitor) canceladas
        expect(prisma.monitoria.updateMany).toHaveBeenCalledWith({
            where: { id_monitor: 7, status: 'ativa', horario: { gt: expect.any(Date) } },
            data: { status: 'cancelada' }
        });
        const { data } = prisma.usuario.update.mock.calls[0][0];
        expect(data).toMatchObject({
            nome_completo: 'Usuário removido',
            email: 'removido-7@anonimo.invalid',
            matricula: -7,
            ultimo_acesso: null,
            versao_token: { increment: 1 }
        });
        expect(data.anonimizado_em).toBeInstanceOf(Date);
        // Links de redefinição de senha somem junto (RF-008)
        expect(prisma.tokenRedefinicao.deleteMany).toHaveBeenCalledWith({
            where: { id_usuario: 7 }
        });
        // A senha antiga deixa de valer
        expect(await bcrypt.compare('senhaCerta1', data.senha)).toBe(false);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('conta já anonimizada: 404', async () => {
        prisma.usuario.findUnique.mockResolvedValue({
            id: 7,
            senha: hashSenha,
            email_confirmado_em: new Date(),
            anonimizado_em: AGORA
        });
        const resposta = await excluir({ senha: 'senhaCerta1' });
        expect(resposta.status).toBe(404);
    });

    it('vinda de outro site: 403 (a lista de origens também vale para o DELETE)', async () => {
        const resposta = await request(app)
            .delete('/perfil')
            .set('Cookie', cookieDe(7))
            .set('Origin', 'https://site-malicioso.example')
            .send({ senha: 'senhaCerta1' });
        expect(resposta.status).toBe(403);
        expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
});

describe('Login registra o último acesso', () => {
    it('grava ultimo_acesso no login bem-sucedido', async () => {
        prisma.usuario.findFirst.mockResolvedValue({
            id: 3,
            nome_completo: 'Ana',
            email: 'ana@exemplo.com',
            senha: hashSenha,
            email_confirmado_em: new Date(),
            tipo_usuario: 'aluno',
            versao_token: 0
        });

        const resposta = await request(app)
            .post('/auth/login')
            .set('X-Forwarded-For', '203.0.113.50')
            .send({
                identificador: 'ana@exemplo.com',
                senha: 'senhaCerta1',
                tipo_usuario: 'aluno'
            });

        expect(resposta.status).toBe(200);
        expect(prisma.usuario.update).toHaveBeenCalledWith({
            where: { id: 3 },
            data: { ultimo_acesso: expect.any(Date) }
        });
    });

    it('se o registro falhar, o login continua funcionando', async () => {
        prisma.usuario.findFirst.mockResolvedValue({
            id: 3,
            nome_completo: 'Ana',
            email: 'ana@exemplo.com',
            senha: hashSenha,
            email_confirmado_em: new Date(),
            tipo_usuario: 'aluno',
            versao_token: 0
        });
        prisma.usuario.update.mockRejectedValue(new Error('banco fora'));

        const resposta = await request(app)
            .post('/auth/login')
            .set('X-Forwarded-For', '203.0.113.51')
            .send({
                identificador: 'ana@exemplo.com',
                senha: 'senhaCerta1',
                tipo_usuario: 'aluno'
            });

        expect(resposta.status).toBe(200);
    });
});

describe('Rotina de retenção', () => {
    beforeEach(() => {
        prisma.usuario.findMany.mockResolvedValue([{ id: 11 }, { id: 12 }]);
        prisma.agendamento.count.mockResolvedValue(4);
        prisma.monitoria.count.mockResolvedValue(2);
        prisma.agendamento.deleteMany.mockResolvedValue({ count: 4 });
        prisma.monitoria.deleteMany.mockResolvedValue({ count: 2 });
        prisma.tokenRedefinicao.count.mockResolvedValue(5);
        prisma.tokenRedefinicao.deleteMany.mockResolvedValue({ count: 5 });
        prisma.usuario.count.mockResolvedValue(3);
        prisma.usuario.deleteMany.mockResolvedValue({ count: 3 });
        prisma.tokenConfirmacaoEmail.count.mockResolvedValue(6);
        prisma.tokenConfirmacaoEmail.deleteMany.mockResolvedValue({ count: 6 });
    });

    it('sem --aplicar só conta: nada é alterado', async () => {
        const r = await privacidadeService.aplicarRetencao({ agora: AGORA });

        expect(r).toEqual({
            contasParadas: 2,
            agendamentos: 4,
            vagas: 2,
            tokens: 5,
            contasPendentes: 3,
            tokensConfirmacao: 6,
            aplicado: false
        });
        expect(prisma.usuario.update).not.toHaveBeenCalled();
        expect(prisma.tokenRedefinicao.deleteMany).not.toHaveBeenCalled();
        expect(prisma.usuario.deleteMany).not.toHaveBeenCalled();
        expect(prisma.tokenConfirmacaoEmail.deleteMany).not.toHaveBeenCalled();
        expect(prisma.agendamento.deleteMany).not.toHaveBeenCalled();
        expect(prisma.monitoria.deleteMany).not.toHaveBeenCalled();
    });

    it('usa 12 meses para contas paradas e 2 anos para o histórico', async () => {
        await privacidadeService.aplicarRetencao({ agora: AGORA });

        expect(prisma.usuario.findMany).toHaveBeenCalledWith({
            where: {
                anonimizado_em: null,
                ultimo_acesso: { lt: new Date('2025-11-09T12:00:00.000Z') }
            },
            select: { id: true }
        });
        expect(prisma.agendamento.count).toHaveBeenCalledWith({
            where: { data_hora: { lt: new Date('2024-11-09T12:00:00.000Z') } }
        });
        // Links de redefinição de senha: 24 horas
        expect(prisma.tokenRedefinicao.count).toHaveBeenCalledWith({
            where: { criado_em: { lt: new Date('2026-11-08T12:00:00.000Z') } }
        });
        // Plano 14: conta sem confirmar o e-mail e links de confirmação, 7 dias
        const seteDias = new Date('2026-11-02T12:00:00.000Z');
        expect(prisma.usuario.count).toHaveBeenCalledWith({
            where: {
                email_confirmado_em: null,
                anonimizado_em: null,
                criado_em: { lt: seteDias },
                meus_agendamentos: { none: {} },
                monitorias_criadas: { none: {} }
            }
        });
        expect(prisma.tokenConfirmacaoEmail.count).toHaveBeenCalledWith({
            where: { criado_em: { lt: seteDias } }
        });
    });

    it('com --aplicar anonimiza cada conta parada e apaga o histórico antigo', async () => {
        const r = await privacidadeService.aplicarRetencao({ aplicar: true, agora: AGORA });

        expect(r).toEqual({
            contasParadas: 2,
            agendamentos: 4,
            vagas: 2,
            tokens: 5,
            contasPendentes: 3,
            tokensConfirmacao: 6,
            aplicado: true
        });
        const anonimizadas = prisma.usuario.update.mock.calls.map(([arg]) => arg.where.id);
        expect(anonimizadas).toEqual([11, 12]);
        // Inscrições antes das vagas (chave estrangeira), e só vagas sem inscrição restante
        expect(prisma.monitoria.deleteMany).toHaveBeenCalledWith({
            where: {
                horario: { lt: new Date('2024-11-09T12:00:00.000Z') },
                inscricoes: { none: {} }
            }
        });
        const ordemAgendamento = prisma.agendamento.deleteMany.mock.invocationCallOrder[0];
        const ordemVaga = prisma.monitoria.deleteMany.mock.invocationCallOrder[0];
        expect(ordemAgendamento).toBeLessThan(ordemVaga);
    });
});
