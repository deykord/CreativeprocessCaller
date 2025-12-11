const express = require('express');
const router = express.Router();
const db = require('../services/databaseService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics from database
 * Query params:
 *   - period: 'today' (default), 'week', 'month', 'all'
 *   - userId: optional, filter by user
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { period = 'today', userId } = req.query;
    
    // If no userId specified, use the authenticated user's ID
    const targetUserId = userId || req.user?.id;
    
    const stats = await db.getDashboardStats(targetUserId, period);
    
    res.json({
      success: true,
      stats,
      period,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard stats',
      message: error.message 
    });
  }
});

/**
 * GET /api/dashboard/stats/team
 * Get team-wide dashboard statistics (admin only)
 */
router.get('/stats/team', authMiddleware, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // Get stats for all users (no userId filter)
    const stats = await db.getDashboardStats(null, period);
    
    res.json({
      success: true,
      stats,
      period,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching team dashboard stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch team dashboard stats',
      message: error.message 
    });
  }
});

module.exports = router;
