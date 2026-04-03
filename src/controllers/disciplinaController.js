// src/controllers/disciplinaController.js
exports.listar = async (req, res) => {
    try {
        const disciplinas = await disciplinaRepository.buscarTodas();
        // ✅ Retorna sempre { disciplinas: [...] } e com Content-Type JSON explícito
        return res.status(200).json({ disciplinas });
    } catch (erro) {
        console.error('Erro ao listar disciplinas:', erro);
        return res.status(500).json({ erro: true, mensagem: 'Erro interno ao buscar disciplinas.' });
    }
};
