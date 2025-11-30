const express = require('express');
const router = express.Router();
const controller = require('../controllers/salesFloorController');

router.get('/activity', controller.getActivityLogs);
router.get('/stats', controller.getSalesFloorStats);
router.get('/team', controller.getTeamActivity);

module.exports = router;
