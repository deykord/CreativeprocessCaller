/**
 * AI Agent Settings Routes
 * API endpoints for managing AI training agent configuration
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/aiAgentSettingsController');
const authMiddleware = require('../middleware/authMiddleware');

// Admin-only middleware
const adminMiddleware = async (req, res, next) => {
  try {
    const pool = require('../config/database');
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Public endpoints (for training component to fetch prompts)
router.get('/scenarios', authMiddleware, controller.getScenarios);
router.get('/scenarios/:scenarioId/prompt', authMiddleware, controller.getScenarioPrompt);
router.get('/behavior', authMiddleware, controller.getBehaviorSettings);
router.get('/personality', authMiddleware, controller.getBasePersonality);

// Admin-only endpoints (for configuration)
router.get('/all', authMiddleware, adminMiddleware, controller.getAllSettings);
router.get('/category/:category', authMiddleware, adminMiddleware, controller.getSettingsByCategory);
router.get('/setting/:key', authMiddleware, adminMiddleware, controller.getSetting);
router.put('/setting/:key', authMiddleware, adminMiddleware, controller.updateSetting);
router.put('/bulk', authMiddleware, adminMiddleware, controller.updateMultipleSettings);
router.post('/reset', authMiddleware, adminMiddleware, controller.resetToDefaults);

// Scenario management (admin only)
router.post('/scenarios', authMiddleware, adminMiddleware, controller.createScenario);
router.put('/scenarios/:scenarioId', authMiddleware, adminMiddleware, controller.updateScenario);
router.delete('/scenarios/:scenarioId', authMiddleware, adminMiddleware, controller.deleteScenario);
router.post('/scenarios/:scenarioId/duplicate', authMiddleware, adminMiddleware, controller.duplicateScenario);

// Behavior settings (admin only)
router.put('/behavior', authMiddleware, adminMiddleware, controller.updateBehaviorSettings);

// Base personality (admin only)
router.put('/personality', authMiddleware, adminMiddleware, controller.updateBasePersonality);

module.exports = router;
