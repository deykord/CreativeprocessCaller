/**
 * Telnyx Voice Routes
 * API endpoints for Telnyx voice functionality
 */

const express = require('express');
const router = express.Router();
const telnyxController = require('../controllers/telnyxController');
const authMiddleware = require('../middleware/authMiddleware');

// Webhook endpoints - NO auth required (Telnyx calls these)
router.post('/voice', telnyxController.handleVoiceWebhook);
router.post('/voice/failover', telnyxController.handleFailoverWebhook);

// Health check endpoint for webhook monitoring
router.get('/voice/health', telnyxController.webhookHealthCheck);

// Protected endpoints
router.get('/configured', authMiddleware, telnyxController.isConfigured);
router.get('/numbers', authMiddleware, telnyxController.getPhoneNumbers);
router.get('/recordings', authMiddleware, telnyxController.getRecordings);
router.get('/recording/:recordingId/url', authMiddleware, telnyxController.getRecordingUrl);
router.get('/calls/active', authMiddleware, telnyxController.getActiveCalls);
router.get('/calls/inbound/pending', authMiddleware, telnyxController.getPendingInboundCalls);
router.get('/calls/:callControlId/status', authMiddleware, telnyxController.getCachedCallStatus);
router.post('/calls/:callControlId/answer', authMiddleware, telnyxController.answerInboundCall);
router.post('/calls/:callControlId/end', authMiddleware, telnyxController.endCall);

module.exports = router;
