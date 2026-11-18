// src/controllers/certificadoController.js
const certificadoService = require('../services/certificadoService');
const { ErroValidacao, ErroNaoEncontrado } = require('../utils/erros');
const { normalizarCodigo } = require('../utils/codigoCertificado');

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

function periodoDoCorpo(valor) {
    if (valor === undefined) return undefined;
    if (!FORMATO_PERIODO.test(String(valor))) {
        const mensagem = 'Informe o semestre no formato AAAA.1 ou AAAA.2 (ex.: 2026.2).';
        throw new ErroValidacao(mensagem, { periodo: mensagem });
    }
    return String(valor);
}

// POST /certificados { periodo? } (só monitor): emite a declaração do semestre
exports.emitir = async (req, res) => {
    const periodo = periodoDoCorpo(req.body ? req.body.periodo : undefined);
    const certificado = await certificadoService.emitir(req.usuario.id, periodo);
    return res.status(201).json({ success: true, certificado });
};

// GET /certificados (só monitor): as próprias declarações
exports.listar = async (req, res) => {
    const certificados = await certificadoService.listar(req.usuario.id);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, certificados });
};

// GET /certificados/:codigo (só o dono): os dados para a página da declaração
exports.abrir = async (req, res) => {
    const codigo = normalizarCodigo(req.params.codigo);
    if (!codigo) throw new ErroNaoEncontrado('Declaração não encontrada.');
    const certificado = await certificadoService.abrir(codigo, req.usuario.id);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, certificado });
};

// GET /certificados/verificar/:codigo (público, com limite por IP): confere uma declaração
exports.verificar = async (req, res) => {
    // Código mal formado responde 404 antes de ir ao banco
    const codigo = normalizarCodigo(req.params.codigo);
    if (!codigo) throw new ErroNaoEncontrado('Nenhuma declaração com este código.');
    const declaracao = await certificadoService.verificar(codigo);
    // Sem cache: uma revogação aparece na hora
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, declaracao });
};
