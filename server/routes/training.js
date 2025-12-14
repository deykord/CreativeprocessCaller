const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/trainingController');
const trainingAIController = require('../controllers/trainingAIController');
const authMiddleware = require('../middleware/authMiddleware');

// Provider status (check which providers are configured)
router.get('/providers/status', authMiddleware, trainingController.getProviderStatus);

// API Key management
router.post('/test-key', authMiddleware, trainingController.testApiKey);
router.post('/save-key', authMiddleware, trainingController.saveApiKey);

// Real-time AI conversation
router.post('/generate-response', authMiddleware, trainingAIController.generateResponse);
router.post('/realtime-token', authMiddleware, trainingAIController.getRealtimeToken);
router.post('/text-to-speech', authMiddleware, trainingAIController.generateSpeech);

// Voice options
router.get('/voices', authMiddleware, trainingAIController.getVoices);

// AI Training sessions with DB persistence
router.post('/ai-sessions/start', authMiddleware, trainingAIController.startSession);
router.post('/ai-sessions/end', authMiddleware, trainingAIController.endSession);
router.get('/ai-sessions/history', authMiddleware, trainingAIController.getHistory);
router.get('/ai-sessions/:sessionId/messages', authMiddleware, trainingAIController.getSessionMessages);

// Training sessions (disabled for now)
router.get('/sessions', authMiddleware, trainingController.getSessions);
router.post('/sessions/start', authMiddleware, trainingController.startSession);
router.post('/sessions/:id/end', authMiddleware, trainingController.endSession);

// Cost tracking (disabled for now)
router.get('/costs', authMiddleware, trainingController.getCosts);

module.exports = router;
