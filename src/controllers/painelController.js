// src/controllers/painelController.js
// Plano 7 (RF-012): rotas /admin/* do painel da coordenação (só coordenador; ver painelRotas.js).
const painelService = require('../services/painelService');
const { ErroValidacao } = require('../utils/erros');

const FORMATO_PERIODO = /^\d{4}\.[12]$/;
const MAX_AUDITORIA = 100;

function periodoDaConsulta(valor) {
    if (valor === undefined) return undefined;
    if (!FORMATO_PERIODO.test(String(valor))) {
        const mensagem = 'Informe o semestre no formato AAAA.1 ou AAAA.2 (ex.: 2026.2).';
        throw new ErroValidacao(mensagem, { periodo: mensagem });
    }
    return String(valor);
}

// GET /admin/resumo?periodo=2026.2: indicadores e gráficos do semestre
exports.resumo = async (req, res) => {
    const resumo = await painelService.resumo(periodoDaConsulta(req.query.periodo));
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, ...resumo });
};

// GET /admin/monitores?periodo=2026.2: uma linha por monitor com vaga no semestre
exports.monitores = async (req, res) => {
    const monitores = await painelService.monitores(periodoDaConsulta(req.query.periodo));
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, monitores });
};

// GET /admin/auditoria?limit=20: últimas ações registradas
exports.auditoria = async (req, res) => {
    const pedido = Number(req.query.limit);
    const quantos = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, MAX_AUDITORIA) : 20;
    const registros = await painelService.auditoria(quantos);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, registros });
};
