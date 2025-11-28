const express = require('express');
const router = express.Router();
const controller = require('../controllers/callController');

router.get('/', controller.getCallHistory);
router.post('/', controller.logCall);
router.get('/stats', controller.getStats);

module.exports = router;