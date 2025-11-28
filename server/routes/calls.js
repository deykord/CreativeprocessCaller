const express = require('express');
const router = express.Router();
const controller = require('../controllers/callController');

router.get('/', controller.getCallHistory);
router.post('/', controller.logCall);
router.get('/stats', controller.getStats);

// Recording routes
router.post('/recording/status', controller.recordingStatus);
router.get('/recordings/:callSid', controller.getCallRecordings);
router.get('/recordings', controller.getAllRecordings);

module.exports = router;