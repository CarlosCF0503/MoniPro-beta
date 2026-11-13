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

// RF-008: pedir o link de redefinição. O e-mail só precisa ter formato válido: a resposta é a
// mesma exista a conta ou não.
const esqueciSenhaSchema = z.object({
    email: cadastroSchema.shape.email,
    tipo_usuario: tipoUsuario
});

// RF-008: criar a senha nova com o token do link. A senha segue a mesma política do cadastro.
// O token tem 43 caracteres (32 bytes em base64url); o limite folgado só barra lixo.
const redefinirSenhaSchema = z.object({
    token: z
        .string({ error: 'O link de redefinição está incompleto.' })
        .trim()
        .min(20, 'O link de redefinição está incompleto.')
        .max(200, 'O link de redefinição está incompleto.'),
    senha: senhaForte
});

// Plano 14 (RF-018): token do link de confirmação, no mesmo formato do de redefinição
const confirmarEmailSchema = z.object({
    token: z
        .string({ error: 'O link de confirmação está incompleto.' })
        .trim()
        .min(20, 'O link de confirmação está incompleto.')
        .max(200, 'O link de confirmação está incompleto.')
});

// Plano 14 (RF-018): pedir outro link de confirmação, pelo e-mail ou pela matrícula (a tela
// de login aceita os dois). A resposta é a mesma exista a conta ou não.
const reenviarConfirmacaoSchema = z.object({
    identificador: loginSchema.shape.identificador,
    tipo_usuario: tipoUsuario
});

// Plano 14: corrigir o e-mail digitado errado no cadastro. Exige a senha da conta.
const corrigirEmailSchema = z.object({
    identificador: loginSchema.shape.identificador,
    senha: loginSchema.shape.senha,
    tipo_usuario: tipoUsuario,
    email_novo: cadastroSchema.shape.email
});

module.exports = {
    cadastroSchema,
    loginSchema,
    esqueciSenhaSchema,
    redefinirSenhaSchema,
    confirmarEmailSchema,
    reenviarConfirmacaoSchema,
    corrigirEmailSchema
};
