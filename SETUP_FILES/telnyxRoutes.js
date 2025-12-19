/**
 * TELNYX ROUTES
 * API endpoints for inbound call handling
 * 
 * Installation:
 * 1. Copy to: server/routes/telnyx.js
 * 2. In your main app.js, add: app.use('/api/telnyx', require('./routes/telnyx'));
 */

const express = require('express');
const router = express.Router();
const telnyxController = require('../controllers/telnyxController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Webhook endpoint for Telnyx events (no auth required)
 * Configure in Telnyx Dashboard: https://portal.telnyx.com
 * URL: https://yourdomain.com/api/telnyx/webhook
 */
router.post('/webhook', telnyxController.handleWebhook);

/**
 * Get pending inbound calls (not yet answered)
 * GET /api/telnyx/calls/pending
 */
router.get('/calls/pending', authMiddleware, telnyxController.getPendingInboundCalls);

/**
 * Answer an inbound call
 * POST /api/telnyx/calls/:callControlId/answer
 */
router.post('/calls/:callControlId/answer', authMiddleware, telnyxController.answerInboundCall);

/**
 * End an inbound call
 * POST /api/telnyx/calls/:callControlId/end
 */
router.post('/calls/:callControlId/end', authMiddleware, telnyxController.endInboundCall);

module.exports = router;
