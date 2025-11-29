const express = require('express');
const router = express.Router();
const leadListController = require('../controllers/leadListController');
const authMiddleware = require('../middleware/authMiddleware');

// All lead list routes require authentication
router.use(authMiddleware);

// Lead List CRUD
router.post('/', leadListController.createLeadList);
router.get('/', leadListController.getLeadLists);
router.get('/:id', leadListController.getLeadList);
router.patch('/:id', leadListController.updateLeadList);
router.delete('/:id', leadListController.deleteLeadList);

// Permissions
router.post('/:id/permissions', leadListController.addPermission);
router.get('/:id/permissions', leadListController.getPermissions);
router.delete('/:id/permissions/:permissionId', leadListController.removePermission);

module.exports = router;
