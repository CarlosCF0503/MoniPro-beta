// src/controllers/painelController.js
// Plano 7 (RF-012): rotas /admin/* do painel da coordenação (só coordenador; ver painelRotas.js).
const painelService = require('../services/painelService');
const { ErroValidacao } = require('../utils/erros');

const FORMATO_PERIODO = /^\d{4}\.[12]$/;
const MAX_AUDITORIA = 100;
const SITUACOES_CERTIFICADO = ['pendente', 'assinado'];

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

function idDaRota(valor, mensagem = 'Certificado inválido.') {
    const id = Number(valor);
    if (!Number.isInteger(id) || id <= 0) {
        throw new ErroValidacao(mensagem, { id: mensagem });
    }
    return id;
}

const coordenadorDe = (req) => ({ id: req.usuario.id, nome: req.usuario.nome_completo });

// GET /admin/certificados?situacao=pendente|assinado&periodo=2026.2
exports.certificados = async (req, res) => {
    const situacao = req.query.situacao || 'pendente';
    if (!SITUACOES_CERTIFICADO.includes(situacao)) {
        const mensagem = "A situação deve ser 'pendente' ou 'assinado'.";
        throw new ErroValidacao(mensagem, { situacao: mensagem });
    }
    const certificados = await painelService.certificados(
        situacao,
        periodoDaConsulta(req.query.periodo)
    );
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, certificados });
};

// GET /admin/certificados/:id/sessoes: as sessões guardadas na emissão, para conferir
exports.sessoesDoCertificado = async (req, res) => {
    const resultado = await painelService.sessoesDoCertificado(idDaRota(req.params.id));
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, ...resultado });
};

// POST /admin/certificados/:id/assinar
exports.assinarCertificado = async (req, res) => {
    const r = await painelService.assinarCertificado(idDaRota(req.params.id), coordenadorDe(req));
    return res.status(200).json({ success: true, ...r });
};

// POST /admin/certificados/:id/revogar { motivo }
exports.revogarCertificado = async (req, res) => {
    const motivo = req.body ? req.body.motivo : undefined;
    const r = await painelService.revogarCertificado(
        idDaRota(req.params.id),
        motivo,
        coordenadorDe(req)
    );
    return res.status(200).json({ success: true, ...r });
};

// GET /admin/disciplinas: pendentes de revisão (com a aprovada mais parecida) e as aprovadas
exports.disciplinas = async (req, res) => {
    const r = await painelService.disciplinasPendentes();
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, ...r });
};

// POST /admin/disciplinas/:id/aprovar
exports.aprovarDisciplina = async (req, res) => {
    const r = await painelService.aprovarDisciplina(
        idDaRota(req.params.id, 'Disciplina inválida.'),
        coordenadorDe(req)
    );
    return res.status(200).json({ success: true, ...r });
};

// POST /admin/disciplinas/:id/mesclar { id_destino }
exports.mesclarDisciplina = async (req, res) => {
    const destino = req.body ? Number(req.body.id_destino) : NaN;
    const r = await painelService.mesclarDisciplina(
        idDaRota(req.params.id, 'Disciplina inválida.'),
        destino,
        coordenadorDe(req)
    );
    return res.status(200).json({ success: true, ...r });
};

// GET /admin/faltas?periodo=2026.2: faltas do semestre, inscrições sem presença e bloqueados
exports.faltas = async (req, res) => {
    const r = await painelService.faltas(periodoDaConsulta(req.query.periodo));
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, ...r });
};

// POST /admin/agendamentos/:id/falta
exports.marcarFalta = async (req, res) => {
    const r = await painelService.marcarFalta(
        idDaRota(req.params.id, 'Inscrição inválida.'),
        coordenadorDe(req)
    );
    return res.status(200).json({ success: true, ...r });
};

// POST /admin/agendamentos/:id/anular-falta { motivo }
exports.anularFalta = async (req, res) => {
    const r = await painelService.anularFalta(
        idDaRota(req.params.id, 'Inscrição inválida.'),
        req.body ? req.body.motivo : undefined,
        coordenadorDe(req)
    );
    return res.status(200).json({ success: true, ...r });
};
