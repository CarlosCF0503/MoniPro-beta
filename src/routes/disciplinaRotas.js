const express = require('express');
const router = express.Router();
const disciplinaController = require('../controllers/disciplinaController');
const { autenticar, isMonitor } = require('../middlewares/autenticacaoMiddleware');

router.post('/', autenticar, isMonitor, disciplinaController.criar);
router.get('/', autenticar, disciplinaController.listar);
router.get('/:id/ranking', autenticar, disciplinaController.obterRanking); // <-- ROTA DE RANKING

module.exports = router;
