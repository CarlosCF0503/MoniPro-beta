// src/controllers/pontosController.js
const pontuacaoService = require('../services/pontuacaoService');

exports.extrato = async (req, res) => {
    const extrato = await pontuacaoService.extrato(req.usuario.id);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, ...extrato });
};
