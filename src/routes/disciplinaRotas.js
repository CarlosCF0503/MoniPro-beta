// src/routes/disciplinaRotas.js
const express = require('express');
const router = express.Router();
const disciplinaController = require('../controllers/disciplinaController');
const { autenticar, isMonitor } = require('../middlewares/autenticacaoMiddleware');
// AJUSTE: Mudamos para '/' pois no app.js já está app.use('/disciplinas', ...)
// Assim evitamos que a URL fique /disciplinas/disciplinas

router.post('/', autenticar, isMonitor, disciplinaController.criar);
router.get('/', autenticar, disciplinaController.listar);

module.exports = router;