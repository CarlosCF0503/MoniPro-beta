// src/controllers/autenticacaoController.js
// Tarefa 8: erros sobem para o middleware central (src/middlewares/tratadorDeErros.js).
// Tarefa 9: os corpos já chegam validados por schemas/autenticacaoSchemas.js.
const autenticacaoService = require('../services/autenticacaoService');
const { ErroCredenciaisInvalidas } = require('../utils/erros');
const logger = require('../utils/logger');

class AutenticacaoController {
    async cadastrar(req, res) {
        const usuario = await autenticacaoService.cadastrar(req.body);
        logger.info({ id: usuario.id, tipo_usuario: req.body.tipo_usuario }, 'Usuário cadastrado');
        res.status(201).json({
            success: true,
            mensagem: 'Conta criada com sucesso!',
            id: usuario.id
        });
    }

    async login(req, res) {
        const { identificador, senha, tipo_usuario } = req.body;

        try {
            const resultado = await autenticacaoService.login(identificador, senha, tipo_usuario);
            res.json(resultado);
        } catch (error) {
            if (error instanceof ErroCredenciaisInvalidas) {
                logger.warn({ identificador, tipo_usuario }, 'Tentativa de login falhou');
            }
            throw error;
        }
    }
}

module.exports = new AutenticacaoController();
