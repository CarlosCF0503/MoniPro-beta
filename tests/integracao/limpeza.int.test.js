// R1: o script de limpeza de P1 (scripts/limpar-registros-teste.sql) roda no psql de verdade,
// contra as chaves estrangeiras reais. Ele apaga só os registros [TESTE] e, sem
// "-v confirmar=1", desfaz tudo.
//
// O psql vem de INTEGRACAO_PSQL (um comando, ex.: "docker exec -i monipro-int-pg psql -U monipro
// -d monipro_integracao") ou, sem ela, do "psql" do sistema com o DATABASE_URL.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const h = require('./helpers');

const SCRIPT = path.resolve(__dirname, '..', '..', 'scripts', 'limpar-registros-teste.sql');

function rodarScript(confirmar) {
    const variaveis = ['-v', 'ON_ERROR_STOP=1', ...(confirmar ? ['-v', 'confirmar=1'] : [])];
    const [comando, ...base] = process.env.INTEGRACAO_PSQL
        ? process.env.INTEGRACAO_PSQL.split(' ')
        : ['psql', process.env.DATABASE_URL];
    const resultado = spawnSync(comando, [...base, ...variaveis], {
        input: fs.readFileSync(SCRIPT),
        encoding: 'utf8'
    });
    if (resultado.error) throw resultado.error;
    if (resultado.status !== 0)
        throw new Error(`psql saiu com ${resultado.status}:\n${resultado.stderr}`);
    return resultado.stdout;
}

afterAll(() => h.prisma.$disconnect());

describe('scripts/limpar-registros-teste.sql (P1)', () => {
    let real;
    beforeEach(async () => {
        await h.limparBanco();
        const disciplina = await h.criarDisciplina('Algoritmos');
        // Dados reais que precisam ficar
        const monitorReal = await h.criarUsuario('monitor');
        real = await h.criarUsuario('aluno');
        const vagaReal = await h.criarVaga({ monitor: monitorReal, disciplina, capacidade: 3 });
        await h.inscrever(real, vagaReal);
        // Como os casos CT-08 a CT-11 deixaram: monitor e alunos [TESTE], uma vaga do monitor
        // de teste e inscrições, inclusive de um aluno de teste na vaga real
        const monitorTeste = await h.criarUsuario('monitor', {
            nome_completo: '[TESTE] Monitor',
            email: 'monitor@teste.invalid'
        });
        const alunoTeste = await h.criarUsuario('aluno', { email: 'aluno@teste.invalid' });
        const vagaTeste = await h.criarVaga({ monitor: monitorTeste, disciplina, capacidade: 3 });
        await h.inscrever(alunoTeste, vagaTeste);
        await h.inscrever(real, vagaTeste);
        await h.inscrever(alunoTeste, vagaReal);
    });

    it('sem confirmar: mostra o que apagaria e desfaz tudo', async () => {
        const saida = rodarScript(false);

        expect(saida).toContain('ROLLBACK');
        expect(await h.prisma.usuario.count()).toBe(4);
        expect(await h.prisma.agendamento.count()).toBe(4);
    });

    it('com confirmar=1: apaga os registros de teste e o que depende deles, e mais nada', async () => {
        const saida = rodarScript(true);

        expect(saida).toContain('COMMIT');
        const usuarios = await h.prisma.usuario.findMany({ select: { email: true } });
        expect(usuarios.map((u) => u.email)).not.toEqual(
            expect.arrayContaining([expect.stringContaining('@teste.invalid')])
        );
        expect(usuarios).toHaveLength(2);
        expect(await h.prisma.monitoria.count()).toBe(1);
        // Fica só a inscrição do aluno real na vaga real
        const restantes = await h.prisma.agendamento.findMany();
        expect(restantes).toHaveLength(1);
        expect(restantes[0].id_aluno).toBe(real.id);
    });
});
