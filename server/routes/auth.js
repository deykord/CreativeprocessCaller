const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify', authController.verifyToken);
router.get('/me', authMiddleware, authController.getProfile);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/team-members', authMiddleware, authController.getTeamMembers);

// User management (Admin only)
router.get('/users', authMiddleware, authController.getAllUsers);
router.post('/users', authMiddleware, authController.createUser);
router.post('/create-user', authMiddleware, authController.createUser);
router.get('/users/:id', authMiddleware, authController.getUserById);
router.patch('/users/:id', authMiddleware, authController.updateUser);
router.put('/users/:id', authMiddleware, authController.updateUser);
router.delete('/users/:id', authMiddleware, authController.deleteUser);

module.exports = router;
