// src/routes/disciplinaRotas.js
const express = require('express');
const router = express.Router();
const disciplinaController = require('../controllers/disciplinaController');

// AJUSTE: Mudamos para '/' pois no app.js já está app.use('/disciplinas', ...)
// Assim evitamos que a URL fique /disciplinas/disciplinas
router.post('/', disciplinaController.criar);
router.get('/', disciplinaController.listar);

module.exports = router;