const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepository = require('../repositories/usuarioRepository');
const sessaoRepository = require('../repositories/sessaoRepository');
const { DURACAO_SESSAO_SEGUNDOS } = require('../config/sessao');
const { JWT_SECRET } = require('../config/env');
const confirmacaoEmailService = require('./confirmacaoEmailService');
const { exigirConfirmacaoEmail } = require('../config/confirmacaoEmail');
const { ErroAplicacao, ErroCredenciaisInvalidas, ErroConflito } = require('../utils/erros');
const logger = require('../utils/logger');

const MENSAGEM_CREDENCIAIS_INVALIDAS = 'E-mail/matrícula ou senha incorretos.';

// Plano 14 (RF-018): senha certa, mas o e-mail ainda não foi confirmado
class ErroEmailNaoConfirmado extends ErroAplicacao {
    constructor() {
        super(
            'Confirme seu e-mail para entrar. Abra o link que enviamos quando você se cadastrou.',
            403,
            'email_nao_confirmado'
        );
    }
}
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
        const usuario = await usuarioRepository.criar({ ...dados, senha: hashSenha });

        // 3. Plano 14 (RF-018): link de confirmação para o e-mail informado. A conta nasce sem
        // confirmação; se o link não puder ser gerado, a pessoa pede outro pela tela de login.
        try {
            await confirmacaoEmailService.gerar(usuario);
        } catch (erro) {
            logger.error(
                { id: usuario.id, err: erro.message },
                'Não foi possível gerar o link de confirmação'
            );
        }
        return usuario;
    }

    /**
     * Confere e-mail/matrícula + senha + perfil e devolve a conta, ou lança 401 com a mensagem
     * única de credenciais inválidas.
     */
    async conferirCredenciais(identificador, senha, tipo_usuario) {
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
        return usuario;
    }

    async login(identificador, senha, tipo_usuario) {
        const usuario = await this.conferirCredenciais(identificador, senha, tipo_usuario);

        // Plano 14 (RF-018): só depois da senha certa, para não revelar quais contas existem
        if (exigirConfirmacaoEmail() && !usuario.email_confirmado_em) {
            throw new ErroEmailNaoConfirmado();
        }

        // R3 (LGPD): registra o login. Uma falha aqui não impede a entrada; no pior caso a
        // conta parece parada há mais tempo do que está.
        try {
            await usuarioRepository.registrarAcesso(usuario.id);
        } catch (erro) {
            logger.warn(
                { id: usuario.id, err: erro.message },
                'Não foi possível registrar o acesso'
            );
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

    /**
     * Plano 14 ("digitei o e-mail errado"): troca o e-mail de uma conta que ainda não confirmou
     * e manda o link para o endereço novo. Exige a senha da conta: só quem a criou corrige o
     * e-mail, e ninguém consegue sequestrar o cadastro pendente de outra pessoa.
     * @returns {Promise<string>} o e-mail gravado
     */
    async corrigirEmail({ identificador, senha, tipo_usuario, email_novo }) {
        const usuario = await this.conferirCredenciais(identificador, senha, tipo_usuario);
        if (usuario.email_confirmado_em) {
            throw new ErroConflito('O e-mail desta conta já foi confirmado. Entre normalmente.');
        }
        if (email_novo.toLowerCase() !== usuario.email.toLowerCase()) {
            const outra = await usuarioRepository.buscarPorEmail(email_novo, tipo_usuario);
            if (outra && outra.id !== usuario.id) {
                throw new ErroConflito(`Este e-mail já está cadastrado como ${tipo_usuario}.`);
            }
            // Duas correções simultâneas para o mesmo e-mail: a unicidade do banco devolve 409
            await usuarioRepository.atualizarEmail(usuario.id, email_novo);
        }
        await confirmacaoEmailService.gerar({ ...usuario, email: email_novo });
        logger.info({ id: usuario.id }, 'E-mail de conta pendente corrigido');
        return email_novo;
    }

    // P3 (R7): invalida todas as sessões do usuário, inclusive cópias do token
    async sair(idUsuario) {
        await sessaoRepository.incrementarVersao(idUsuario);
    }
}

module.exports = new AutenticacaoService();
module.exports.ErroEmailNaoConfirmado = ErroEmailNaoConfirmado;
