// R20: hash de senha com o bcrypt nativo no lugar do bcryptjs.
const bcrypt = require('bcrypt');
const { CUSTO_BCRYPT } = require('../src/config/senha');
const { cadastroSchema } = require('../src/schemas/autenticacaoSchemas');

// Gerado pelo bcryptjs 3.0.3 (a biblioteca anterior) para a senha "SenhaAntiga2026"
const HASH_DO_BCRYPTJS = '$2b$10$dKTjBKYRJq31YpWOVfAjROpX.ZNkGas4nLhSEotVzpl.UJCyfCdDG'; // pragma: allowlist secret

const cadastro = (senha) => ({
    nome_completo: 'Pessoa de Teste',
    email: 'pessoa@exemplo.invalid',
    matricula: 123456,
    senha,
    tipo_usuario: 'aluno'
});

describe('hash de senha (R20)', () => {
    test('os hashes gravados pelo bcryptjs continuam valendo', async () => {
        await expect(bcrypt.compare('SenhaAntiga2026', HASH_DO_BCRYPTJS)).resolves.toBe(true);
        await expect(bcrypt.compare('senhaantiga2026', HASH_DO_BCRYPTJS)).resolves.toBe(false);
    });

    test('hash novo usa o custo configurado e um sal diferente a cada vez', async () => {
        const a = await bcrypt.hash('MoniPro2026', CUSTO_BCRYPT);
        const b = await bcrypt.hash('MoniPro2026', CUSTO_BCRYPT);
        expect(a).toMatch(/^\$2b\$10\$/);
        expect(a).not.toBe(b);
        expect(bcrypt.getRounds(a)).toBe(CUSTO_BCRYPT);
    });

    test('o hash não trava o event loop: um timer agendado depois roda antes de o hash terminar', async () => {
        let timerRodou = false;
        let timerAntesDoFim = false;
        const hash = bcrypt.hash('MoniPro2026', 12).then(() => {
            timerAntesDoFim = timerRodou;
        });
        setTimeout(() => {
            timerRodou = true;
        }, 0);
        await hash;
        expect(timerAntesDoFim).toBe(true);
    });
});

describe('limite de 72 bytes da senha', () => {
    test('aceita 72 caracteres sem acento', () => {
        const r = cadastroSchema.safeParse(cadastro('a1'.repeat(36)));
        expect(r.success).toBe(true);
    });

    test('recusa senha com até 72 caracteres que passa de 72 bytes por causa dos acentos', () => {
        const senha = 'á'.repeat(40) + '1';
        expect(senha.length).toBeLessThanOrEqual(72);
        const r = cadastroSchema.safeParse(cadastro(senha));
        expect(r.success).toBe(false);
        expect(r.error.issues[0].message).toMatch(/longa demais/);
    });
});
