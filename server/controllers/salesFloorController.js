const db = require('../services/mockDatabase');

/**
 * Sales Floor Controller
 * Provides real-time team activity monitoring
 */

exports.getActivityLogs = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const filters = {};
    if (userId) filters.userId = userId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const logs = await db.getActivityLogs(filters);
    res.json(logs);
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

exports.getSalesFloorStats = async (req, res) => {
  try {
    const { userId } = req.query;
    
    const stats = await db.getSalesFloorStats(userId || null);
    res.json(stats);
  } catch (error) {
    console.error('Get sales floor stats error:', error);
    res.status(500).json({ error: 'Failed to fetch sales floor stats' });
  }
};

exports.getTeamActivity = async (req, res) => {
  try {
    // Get all team stats for today
    const stats = await db.getSalesFloorStats();
    
    // Get recent activity logs (last 50)
    const recentLogs = await db.getActivityLogs({});
    const limitedLogs = recentLogs.slice(0, 50);
    
    res.json({
      teamStats: stats,
      recentActivity: limitedLogs
    });
  } catch (error) {
    console.error('Get team activity error:', error);
    res.status(500).json({ error: 'Failed to fetch team activity' });
  }
};
