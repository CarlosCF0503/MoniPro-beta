const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepository = require('../repositories/usuarioRepository');

class AutenticacaoService {
    async cadastrar(dados) {
        // 1. Verifica se já existe ALGUÉM com este e-mail neste MESMO CARGO
        const usuarioExistente = await usuarioRepository.buscarPorEmail(dados.email, dados.tipo_usuario);
        if (usuarioExistente) {
            throw new Error(`Este e-mail já está cadastrado como ${dados.tipo_usuario}.`);
        }

        // Você também pode fazer a mesma verificação para a matrícula se quiser!
        const matriculaExistente = await usuarioRepository.buscarPorMatricula(dados.matricula, dados.tipo_usuario);
        if (matriculaExistente) {
            throw new Error(`Esta matrícula já está cadastrada como ${dados.tipo_usuario}.`);
        }

        // 2. Se passou pelas validações, cria o cadastro
        const hashSenha = await bcrypt.hash(dados.senha, 10);
        return await usuarioRepository.criar({ ...dados, senha: hashSenha });
    }

    async login(identificador, senha, tipo_usuario) {
        const isEmail = identificador.includes('@');
        let usuario;

        // AGORA PASSAMOS O TIPO_USUARIO PARA A BUSCA!
        if (isEmail) {
            usuario = await usuarioRepository.buscarPorEmail(identificador, tipo_usuario);
        } else {
            usuario = await usuarioRepository.buscarPorMatricula(Number(identificador), tipo_usuario);
        }

        if (!usuario) {
            // Ajustamos a mensagem para ficar mais clara
            throw new Error(`Nenhum ${tipo_usuario} encontrado com essas credenciais.`);
        }

        // Como a busca já filtrou pelo tipo, essa linha abaixo virou apenas uma garantia extra de segurança
        if (usuario.tipo_usuario !== tipo_usuario) {
            throw new Error(`Este usuário não está cadastrado como ${tipo_usuario}.`);
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            throw new Error('Senha incorreta.');
        }

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

        return { success: true, token, usuario: { id: usuario.id, nome: usuario.nome_completo, tipo: usuario.tipo_usuario } };
    }
}

module.exports = new AutenticacaoService();
