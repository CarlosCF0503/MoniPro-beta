const request = require('supertest');

jest.mock('../src/config/bancoDeDados', () => ({}));

const app = require('../src/app');

describe('limite geral de requisições (R10)', () => {
    it('aceita 120 requisições por minuto de um mesmo IP e recusa a 121ª com 429', async () => {
        // Qualquer caminho passa pelo limite geral, que é o primeiro middleware: uma rota
        // inexistente responde 404 sem tocar no banco, até o limite estourar.
        const pedir = () =>
            request(app).get('/rota-inexistente').set('X-Forwarded-For', '198.51.100.7');

        for (let i = 0; i < 120; i++) {
            expect((await pedir()).status).toBe(404);
        }
        const bloqueada = await pedir();

        expect(bloqueada.status).toBe(429);
        expect(bloqueada.body.erro).toMatch(/Muitas requisições/);
    });

    it('conta cada IP separadamente', async () => {
        const resposta = await request(app)
            .get('/rota-inexistente')
            .set('X-Forwarded-For', '198.51.100.8');

        expect(resposta.status).toBe(404);
    });
});
