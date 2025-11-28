const express = require('express');
const router = express.Router();
const controller = require('../controllers/voiceController');

router.post('/', controller.handleVoiceRequest);
router.post('/status', controller.handleCallStatus);
router.get('/incoming-numbers', controller.handleIncomingNumbers);
router.get('/numbers', controller.handleTwilioNumbers);

module.exports = router;