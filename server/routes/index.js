const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const tokenRoutes = require('./token');
const voiceRoutes = require('./voice');
const telnyxRoutes = require('./telnyx');
const prospectRoutes = require('./prospects');
// const prospectExtensionsRoutes = require('./prospectExtensions'); // Temporarily disabled - has errors
const callRoutes = require('./calls');
const messageRoutes = require('./messages');
const leadListRoutes = require('./leadLists');
const salesFloorRoutes = require('./salesFloor');
const voicemailRoutes = require('./voicemails');
const dashboardRoutes = require('./dashboard');
const trainingRoutes = require('./training');

router.use('/auth', authRoutes);
router.use('/token', tokenRoutes);
router.use('/voice', voiceRoutes);
router.use('/telnyx', telnyxRoutes);
router.use('/prospects', prospectRoutes);
// router.use('/prospects', prospectExtensionsRoutes); // Additional prospect endpoints - temporarily disabled
router.use('/calls', callRoutes);
router.use('/messages', messageRoutes);
router.use('/lead-lists', leadListRoutes);
router.use('/sales-floor', salesFloorRoutes);
router.use('/voicemails', voicemailRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/training', trainingRoutes);

// Alias for recordings upload (frontend posts to /api/recordings/upload)
router.post('/recordings/upload', require('../controllers/callController').uploadRecording);

module.exports = router;