const express = require('express');
const router = express.Router();
const controller = require('../controllers/callController');
const authMiddleware = require('../middleware/authMiddleware');

// Optional auth - try to get user if token present, but don't require it
const optionalAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const authService = require('../services/authService');
      const user = authService.verifyToken(token);
      req.userId = user.id;
      req.user = user;
    }
  } catch (error) {
    // Token invalid or missing, continue without user
    console.log('Optional auth: no valid token');
  }
  next();
};

router.get('/', optionalAuth, controller.getCallHistory);
router.post('/', optionalAuth, controller.logCall);
router.get('/stats', optionalAuth, controller.getStats);

// Call log delete routes (admin only)
router.delete('/logs/:id', authMiddleware, controller.deleteCallLog);
router.post('/logs/delete', authMiddleware, controller.deleteMultipleCallLogs);
router.delete('/logs', authMiddleware, controller.deleteAllCallLogs);

// Recording routes
router.post('/recording/status', controller.recordingStatus);
router.post('/recordings/upload', controller.uploadRecording);
router.get('/recording/:id/stream', controller.streamRecording); // Stream with auth
router.get('/recording/:id/download', controller.downloadRecording);
router.get('/recordings/:callSid', controller.getCallRecordings);
router.get('/recordings', controller.getAllRecordings);
router.delete('/recordings/:id', controller.deleteRecording);
router.post('/recordings/delete', controller.deleteMultipleRecordings);
router.delete('/recordings', controller.deleteAllRecordings);

module.exports = router;