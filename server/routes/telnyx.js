/**
 * Telnyx Voice Routes
 * API endpoints for Telnyx voice functionality
 */

const express = require('express');
const router = express.Router();
const telnyxController = require('../controllers/telnyxController');
const authMiddleware = require('../middleware/authMiddleware');

// Webhook endpoint - NO auth required (Telnyx calls this)
router.post('/voice', telnyxController.handleVoiceWebhook);

// Protected endpoints
router.get('/configured', authMiddleware, telnyxController.isConfigured);
router.get('/numbers', authMiddleware, telnyxController.getPhoneNumbers);
router.get('/recordings', authMiddleware, telnyxController.getRecordings);
router.get('/calls/active', authMiddleware, telnyxController.getActiveCalls);
router.get('/calls/:callControlId/status', authMiddleware, telnyxController.getCachedCallStatus);
router.post('/calls/:callControlId/end', authMiddleware, telnyxController.endCall);

module.exports = router;
