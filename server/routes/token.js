const express = require('express');
const router = express.Router();
const controller = require('../controllers/tokenController');

router.post('/', controller.generateToken);

module.exports = router;