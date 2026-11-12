// src/services/privacidadeService.js
// R3 (LGPD): direito de eliminação (art. 18, VI) pela opção "Excluir minha conta" e a rotina
// de retenção que aplica os prazos do Aviso de Privacidade (src/config/retencao.js).

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const privacidadeRepository = require('../repositories/privacidadeRepository');
const {
    MESES_CONTA_PARADA,
    ANOS_HISTORICO,
    HORAS_TOKEN_REDEFINICAO
} = require('../config/retencao');
const { ErroValidacao, ErroNaoEncontrado } = require('../utils/erros');

// Hash de uma senha aleatória que ninguém conhece: a conta anonimizada não entra mais
async function hashInutilizavel() {
    return await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
}

function mesesAtras(agora, meses) {
    const d = new Date(agora);
    d.setUTCMonth(d.getUTCMonth() - meses);
    return d;
}

class PrivacidadeService {
    /**
     * Exclui (anonimiza) a conta de quem está logado, depois de conferir a senha.
     */
    async excluirConta(idUsuario, senha, agora = new Date()) {
        const usuario = await privacidadeRepository.buscarSenha(idUsuario);
        if (!usuario || usuario.anonimizado_em) {
            throw new ErroNaoEncontrado('Conta não encontrada.');
        }
        const senhaConfere = await bcrypt.compare(senha, usuario.senha);
        if (!senhaConfere) {
            throw new ErroValidacao('Senha incorreta.', { senha: 'Senha incorreta.' });
        }
        const hash = await hashInutilizavel();
        await privacidadeRepository.emTransacao((tx) =>
            privacidadeRepository.anonimizar(usuario.id, hash, agora, tx)
        );
    }

    /**
     * Aplica os prazos de retenção. Sem `aplicar`, só conta o que seria feito.
     * @returns {Promise<{contasParadas:number, agendamentos:number, vagas:number, tokens:number, aplicado:boolean}>}
     */
    async aplicarRetencao({ aplicar = false, agora = new Date() } = {}) {
        const limiteConta = mesesAtras(agora, MESES_CONTA_PARADA);
        const limiteHistorico = mesesAtras(agora, ANOS_HISTORICO * 12);
        const limiteTokens = new Date(agora.getTime() - HORAS_TOKEN_REDEFINICAO * 60 * 60 * 1000);

        const contas = await privacidadeRepository.buscarContasParadas(limiteConta);
        if (!aplicar) {
            const antigo = await privacidadeRepository.contarHistoricoAntigo(limiteHistorico);
            const tokens = await privacidadeRepository.contarTokensAntigos(limiteTokens);
            return { contasParadas: contas.length, ...antigo, tokens, aplicado: false };
        }

        for (const { id } of contas) {
            const hash = await hashInutilizavel();
            await privacidadeRepository.emTransacao((tx) =>
                privacidadeRepository.anonimizar(id, hash, agora, tx)
            );
        }
        const apagado = await privacidadeRepository.emTransacao((tx) =>
            privacidadeRepository.apagarHistoricoAntigo(limiteHistorico, tx)
        );
        const tokens = await privacidadeRepository.apagarTokensAntigos(limiteTokens);
        return { contasParadas: contas.length, ...apagado, tokens, aplicado: true };
    }
}

module.exports = new PrivacidadeService();
