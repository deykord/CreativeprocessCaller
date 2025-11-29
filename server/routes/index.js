const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const tokenRoutes = require('./token');
const voiceRoutes = require('./voice');
const prospectRoutes = require('./prospects');
const prospectExtensionsRoutes = require('./prospectExtensions');
const callRoutes = require('./calls');
const messageRoutes = require('./messages');
const leadListRoutes = require('./leadLists');

router.use('/auth', authRoutes);
router.use('/token', tokenRoutes);
router.use('/voice', voiceRoutes);
router.use('/prospects', prospectRoutes);
router.use('/prospects', prospectExtensionsRoutes); // Additional prospect endpoints
router.use('/calls', callRoutes);
router.use('/messages', messageRoutes);
router.use('/lead-lists', leadListRoutes);

// Alias for recordings upload (frontend posts to /api/recordings/upload)
router.post('/recordings/upload', require('../controllers/callController').uploadRecording);

module.exports = router;