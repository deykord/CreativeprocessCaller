const express = require('express');
const router = express.Router();
const controller = require('../controllers/prospectController');

router.get('/', controller.getProspects);
router.post('/', controller.createProspect);
router.patch('/:id', controller.updateProspect);

module.exports = router;