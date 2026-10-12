// src/schemas/autenticacaoSchemas.js
// Tarefa 9: validação de cadastro e login.
const { z } = require('zod');
const { textoObrigatorio, inteiroPositivo } = require('./comuns');

const tipoUsuario = z.enum(['aluno', 'monitor'], {
    error: (iss) =>
        iss.input === undefined
            ? 'O tipo de usuário é obrigatório.'
            : "O tipo de usuário deve ser 'aluno' ou 'monitor'."
});

// Política de senha forte: mín. 8 caracteres, com pelo menos uma letra e um número.
// Máx. 72 porque o bcrypt ignora o que passa de 72 bytes.
const senhaForte = z
    .string({ error: 'A senha é obrigatória.' })
    .min(8, 'A senha deve ter no mínimo 8 caracteres.')
    .max(72, 'A senha deve ter no máximo 72 caracteres.')
    .regex(/\p{L}/u, 'A senha deve conter pelo menos uma letra.')
    .regex(/\d/, 'A senha deve conter pelo menos um número.');

const cadastroSchema = z.object({
    nome_completo: textoObrigatorio('O nome completo é obrigatório.', 150),
    email: textoObrigatorio('O e-mail é obrigatório.', 254).pipe(
        z.email('Informe um e-mail válido.')
    ),
    matricula: inteiroPositivo({
        obrigatorio: 'A matrícula é obrigatória.',
        invalido: 'A matrícula deve ser um número inteiro positivo.'
    }),
    senha: senhaForte,
    tipo_usuario: tipoUsuario
});

// No login a política de senha NÃO é aplicada: contas criadas antes dela
// precisam continuar entrando. Só se exige que os campos venham preenchidos.
const loginSchema = z.object({
    identificador: textoObrigatorio('Informe o e-mail ou a matrícula.', 254),
    senha: z.string({ error: 'A senha é obrigatória.' }).min(1, 'A senha é obrigatória.'),
    tipo_usuario: tipoUsuario
});

module.exports = { cadastroSchema, loginSchema };
