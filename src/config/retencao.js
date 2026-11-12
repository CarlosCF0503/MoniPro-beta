// src/config/retencao.js
// R3 (LGPD): prazos de retenção dos dados (proposta da decisão D4 do plano da Fase 03). Os
// mesmos valores aparecem no Aviso de Privacidade (Monipro_web/privacidade.html); ao mudar um,
// mude o outro.

// Conta sem login há mais deste tempo é anonimizada pela rotina de retenção
const MESES_CONTA_PARADA = 12;

// Inscrições e vagas mais antigas que isso são apagadas. Os pontos ficam na conta do usuário.
const ANOS_HISTORICO = 2;

// Tokens de redefinição de senha (RF-008) valem 30 minutos; os registros são apagados depois disto
const HORAS_TOKEN_REDEFINICAO = 24;

// Dados que substituem os pessoais numa conta anonimizada
const NOME_ANONIMO = 'Usuário removido';
const DOMINIO_ANONIMO = '@anonimo.invalid';

module.exports = {
    MESES_CONTA_PARADA,
    ANOS_HISTORICO,
    HORAS_TOKEN_REDEFINICAO,
    NOME_ANONIMO,
    DOMINIO_ANONIMO
};
