const express = require('express');
const router = express.Router();

const tokenRoutes = require('./token');
const voiceRoutes = require('./voice');
const prospectRoutes = require('./prospects');
const callRoutes = require('./calls');

router.use('/token', tokenRoutes);
router.use('/voice', voiceRoutes);
router.use('/prospects', prospectRoutes);
router.use('/calls', callRoutes);

module.exports = router;