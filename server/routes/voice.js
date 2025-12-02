const express = require('express');
const router = express.Router();
const controller = require('../controllers/voiceController');
const callController = require('../controllers/callController');

router.post('/', controller.handleVoiceRequest);
router.post('/status', controller.handleCallStatus);
router.post('/recording', callController.recordingStatus); // Twilio recording webhook
router.get('/incoming-numbers', controller.handleIncomingNumbers);
router.get('/numbers', controller.handleTwilioNumbers);

// Real-time call status endpoints
router.get('/calls/active', controller.getActiveCalls);
router.get('/calls/:callSid/status', controller.getCallStatus);
router.get('/calls/:callSid/cached-status', controller.getCachedCallStatus);
router.post('/calls/:callSid/end', controller.endCall);

module.exports = router;