// src/controllers/certificadoController.js
const certificadoService = require('../services/certificadoService');
const { ErroValidacao } = require('../utils/erros');

const FORMATO_PERIODO = /^\d{4}\.[12]$/;

// GET /certificados/elegibilidade?periodo=2026.2 (só monitor; sem periodo, o semestre atual)
exports.elegibilidade = async (req, res) => {
    const { periodo } = req.query;
    if (periodo !== undefined && !FORMATO_PERIODO.test(String(periodo))) {
        const mensagem = 'Informe o semestre no formato AAAA.1 ou AAAA.2 (ex.: 2026.2).';
        throw new ErroValidacao(mensagem, { periodo: mensagem });
    }
    const resultado = await certificadoService.elegibilidade(req.usuario.id, periodo);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, ...resultado });
};
