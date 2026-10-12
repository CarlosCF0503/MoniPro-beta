const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepository = require('../repositories/usuarioRepository');
const { JWT_SECRET } = require('../config/env');
const { ErroCredenciaisInvalidas, ErroConflito } = require('../utils/erros');

const MENSAGEM_CREDENCIAIS_INVALIDAS = 'E-mail/matrícula ou senha incorretos.';
// Hash de uma senha que ninguém usa, com o mesmo custo dos hashes reais: comparado
// quando o usuário não existe, para igualar o tempo de resposta (ver login).
const HASH_FICTICIO = bcrypt.hashSync('senha-ficticia-sem-usuario', 10);

class AutenticacaoService {
    async cadastrar(dados) {
        // 1. Verifica se já existe ALGUÉM com este e-mail neste MESMO CARGO
        const usuarioExistente = await usuarioRepository.buscarPorEmail(
            dados.email,
            dados.tipo_usuario
        );
        if (usuarioExistente) {
            throw new ErroConflito(`Este e-mail já está cadastrado como ${dados.tipo_usuario}.`);
        }

        // Você também pode fazer a mesma verificação para a matrícula se quiser!
        const matriculaExistente = await usuarioRepository.buscarPorMatricula(
            dados.matricula,
            dados.tipo_usuario
        );
        if (matriculaExistente) {
            throw new ErroConflito(`Esta matrícula já está cadastrada como ${dados.tipo_usuario}.`);
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
        } else if (/^\d+$/.test(identificador)) {
            usuario = await usuarioRepository.buscarPorMatricula(
                Number(identificador),
                tipo_usuario
            );
        }

        // R5 (enumeração de usuários): usuário inexistente, perfil errado e senha errada
        // devolvem a MESMA mensagem, e o bcrypt roda mesmo sem usuário para que o tempo de
        // resposta não revele quais e-mails/matrículas existem.
        const usuarioValido = usuario && usuario.tipo_usuario === tipo_usuario;
        const senhaValida = await bcrypt.compare(
            senha,
            usuarioValido ? usuario.senha : HASH_FICTICIO
        );
        if (!usuarioValido || !senhaValida) {
            throw new ErroCredenciaisInvalidas(MENSAGEM_CREDENCIAIS_INVALIDAS);
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                nome_completo: usuario.nome_completo,
                email: usuario.email,
                tipo: usuario.tipo_usuario
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return {
            success: true,
            token,
            usuario: { id: usuario.id, nome: usuario.nome_completo, tipo: usuario.tipo_usuario }
        };
    }
}

module.exports = new AutenticacaoService();
