const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create-user', authMiddleware, authController.createUser);
router.post('/login', authController.login);
router.post('/verify', authController.verifyToken);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/team-members', authMiddleware, authController.getTeamMembers);

module.exports = router;
