const express = require('express');
const router = express.Router();
const controller = require('../controllers/prospectController');

router.get('/', controller.getProspects);
router.post('/', controller.createProspect);
router.get('/:id', controller.getProspectById);
router.patch('/:id', controller.updateProspect);
router.delete('/:id', controller.deleteProspect);

// Status history and call history routes
router.get('/:id/status-history', controller.getStatusHistory);
router.get('/:id/call-history', controller.getCallHistory);

// Phone number change history
router.get('/:id/phone-history', controller.getPhoneHistory);

// Full activity log - everything that happened to a lead
router.get('/:id/activity-log', controller.getActivityLog);

module.exports = router;