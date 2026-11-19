// src/config/listaEspera.js
// Plano 8 (RF-013, RN-015): regras da lista de espera das vagas lotadas.

// Com menos que isso até o início, um lugar liberado não promove ninguém da fila: o aviso
// chegaria tarde demais para a pessoa se organizar. O lugar fica livre para quem quiser.
const HORAS_MIN_PROMOCAO = 2;

// A fila de uma vaga tem no máximo tantas pessoas quantos lugares a vaga tem (decisão de 18/11)
function tamanhoMaximoFila(capacidade) {
    return Math.max(1, capacidade);
}

module.exports = { HORAS_MIN_PROMOCAO, tamanhoMaximoFila };
