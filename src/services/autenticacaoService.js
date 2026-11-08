const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepository = require('../repositories/usuarioRepository');
const sessaoRepository = require('../repositories/sessaoRepository');
const { DURACAO_SESSAO_SEGUNDOS } = require('../config/sessao');
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

        // P3 (R7): validade de 2 h (D2) e a versão da sessão ("v"), conferida pelo middleware
        const token = jwt.sign(
            {
                id: usuario.id,
                nome_completo: usuario.nome_completo,
                tipo: usuario.tipo_usuario,
                v: usuario.versao_token ?? 0
            },
            JWT_SECRET,
            { expiresIn: DURACAO_SESSAO_SEGUNDOS }
        );

        return {
            token,
            usuario: { id: usuario.id, nome: usuario.nome_completo, tipo: usuario.tipo_usuario }
        };
    }

    // P3 (R7): invalida todas as sessões do usuário, inclusive cópias do token
    async sair(idUsuario) {
        await sessaoRepository.incrementarVersao(idUsuario);
    }
}

module.exports = new AutenticacaoService();
