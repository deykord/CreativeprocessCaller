const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/trainingController');
const authMiddleware = require('../middleware/authMiddleware');

// Provider status (check which providers are configured)
router.get('/providers/status', authMiddleware, trainingController.getProviderStatus);
router.get('/providers/:providerId/test', authMiddleware, trainingController.testProvider);

// Training sessions
router.get('/sessions', authMiddleware, trainingController.getSessions);
router.post('/sessions/start', authMiddleware, trainingController.startSession);
router.post('/sessions/:id/end', authMiddleware, trainingController.endSession);

// Cost tracking
router.get('/costs', authMiddleware, trainingController.getCosts);

module.exports = router;
