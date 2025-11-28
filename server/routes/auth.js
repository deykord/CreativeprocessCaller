const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create-user', authMiddleware, authController.createUser);
router.post('/login', authController.login);
router.post('/verify', authController.verifyToken);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
