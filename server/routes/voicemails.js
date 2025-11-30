const express = require('express');
const router = express.Router();
const voicemailController = require('../controllers/voicemailController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get voicemail stats (must be before /:id route)
router.get('/stats', voicemailController.getVoicemailStats);

// Get all voicemails for current user
router.get('/', voicemailController.getVoicemails);

// Get a single voicemail with audio
router.get('/:id', voicemailController.getVoicemail);

// Create a new voicemail
router.post('/', voicemailController.createVoicemail);

// Log a voicemail drop
router.post('/drop-log', voicemailController.dropVoicemail);

// Update a voicemail
router.patch('/:id', voicemailController.updateVoicemail);

// Delete a voicemail
router.delete('/:id', voicemailController.deleteVoicemail);

// Set voicemail as default
router.post('/:id/default', voicemailController.setDefaultVoicemail);

module.exports = router;
