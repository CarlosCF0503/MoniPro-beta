const express = require('express');
const router = express.Router();
const disciplinaController = require('../controllers/disciplinaController');
const { autenticar, isMonitor } = require('../middlewares/autenticacaoMiddleware');
const validarCorpo = require('../middlewares/validarCorpo');
const { criarDisciplinaSchema } = require('../schemas/disciplinaSchemas');

router.post(
    '/',
    autenticar,
    isMonitor,
    validarCorpo(criarDisciplinaSchema),
    disciplinaController.criar
);
router.get('/', autenticar, disciplinaController.listar);
router.get('/:id/ranking', autenticar, disciplinaController.obterRanking);

module.exports = router;
