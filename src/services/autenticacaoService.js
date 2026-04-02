const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepository = require('../repositories/usuarioRepository');

class AutenticacaoService {
    async cadastrar(dados) {
        const hashSenha = await bcrypt.hash(dados.senha, 10);
        return await usuarioRepository.criar({ ...dados, senha: hashSenha });
    }

    async login(identificador, senha, tipo_usuario) {
        // 1. Descobre se o identificador é um e-mail (tem '@') ou matrícula
        const isEmail = identificador.includes('@');
        let usuario;

        // 2. Faz a busca usando o método correto do repositório
        if (isEmail) {
            usuario = await usuarioRepository.buscarPorEmail(identificador);
        } else {
            // Converte para número, pois a matrícula costuma ser Int no Prisma
            usuario = await usuarioRepository.buscarPorMatricula(Number(identificador));
        }

        // 3. Validações de segurança
        if (!usuario) {
            throw new Error('Usuário não encontrado. Verifique suas credenciais.');
        }

        // Verifica se o usuário está tentando entrar com o perfil correto (Aluno vs Monitor)
        if (usuario.tipo_usuario !== tipo_usuario) {
            throw new Error(`Este usuário não está cadastrado como ${tipo_usuario}.`);
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            throw new Error('Senha incorreta.');
        }

        // 4. Cria o Token JWT com os dados exatos que o seu frontend espera ler
        const token = jwt.sign(
            { 
                id: usuario.id, 
                nome_completo: usuario.nome_completo,
                email: usuario.email,
                tipo: usuario.tipo_usuario 
            },
            process.env.JWT_SECRET || 'segredo_padrao',
            { expiresIn: '24h' }
        );

        // Retorna success: true para o frontend saber que deu tudo certo
        return { success: true, token, usuario: { id: usuario.id, nome: usuario.nome_completo, tipo: usuario.tipo_usuario } };
    }
}

module.exports = new AutenticacaoService();
