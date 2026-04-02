// src/utils/tratarErro.js
// Centraliza a conversão de erros técnicos em mensagens amigáveis

/**
 * Mapeia erros do Prisma (P2xxx) e erros genéricos para mensagens legíveis.
 * @param {Error} error
 * @param {Object} mapaPersonalizado - mensagens específicas por contexto
 * @returns {string}
 */
function tratarErro(error, mapaPersonalizado = {}) {
    // --- Erros do Prisma ---
    if (error.code === 'P2002') {
        const campo = error.meta?.target?.[0];
        if (campo === 'email')     return 'Este e-mail já está cadastrado.';
        if (campo === 'matricula') return 'Esta matrícula já está cadastrada.';
        return 'Registro duplicado. Verifique os dados informados.';
    }

    if (error.code === 'P2025') {
        return mapaPersonalizado.P2025 || 'Registro não encontrado.';
    }

    if (error.code === 'P2003') {
        return mapaPersonalizado.P2003 || 'Referência inválida. Verifique os dados informados.';
    }

    if (error.code === 'P2014') {
        return 'Operação inválida: violação de relacionamento no banco de dados.';
    }

    // --- Erros de negócio lançados manualmente nos services ---
    const msg = error.message || '';

    if (msg.includes('não encontrad'))   return mapaPersonalizado.naoEncontrado  || 'Registro não encontrado.';
    if (msg.includes('Não autorizado'))  return mapaPersonalizado.naoAutorizado  || 'Você não tem permissão para realizar esta ação.';
    if (msg.includes('não está cadastrado como')) return msg; // mensagem clara, manter
    if (msg.includes('Senha incorreta')) return 'Senha incorreta.';
    if (msg.includes('não encontrado'))  return mapaPersonalizado.naoEncontrado  || 'Registro não encontrado.';

    // Fallback — nunca expõe stack trace ou mensagem técnica crua
    return mapaPersonalizado.default || 'Ocorreu um erro inesperado. Tente novamente.';
}

module.exports = tratarErro;
