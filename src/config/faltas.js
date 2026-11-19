// src/config/faltas.js
// Plano 12 (RN-016, decisão de 19/11): quem falta repetidamente fica um tempo sem poder se
// inscrever. As faltas são marcadas pelo monitor e contadas pela data da marcação.

const FALTAS_PARA_BLOQUEAR = 3;
const DIAS_JANELA = 30;
const DIAS_BLOQUEIO = 7;
// O monitor pode desfazer a falta (confirmando a presença) no mesmo prazo da presença: 7 dias
// depois da sessão (src/utils/regrasConclusao.js)

module.exports = { FALTAS_PARA_BLOQUEAR, DIAS_JANELA, DIAS_BLOQUEIO };
