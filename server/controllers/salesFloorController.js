const pool = require('../config/database');

/**
 * Sales Floor Controller
 * Provides real-time team activity monitoring using PostgreSQL
 */

exports.getActivityLogs = async (req, res) => {
  try {
    const { userId, startDate, endDate, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        cl.id,
        cl.caller_id as "userId",
        'call_made' as action,
        cl.prospect_id as "prospectId",
        p.first_name || ' ' || p.last_name as "prospectName",
        CASE 
          WHEN cl.outcome IS NOT NULL THEN 'made a call - ' || cl.outcome
          ELSE 'made a call'
        END as details,
        cl.started_at as timestamp,
        cl.duration,
        cl.outcome as disposition
      FROM call_logs cl
      LEFT JOIN prospects p ON cl.prospect_id = p.id
      WHERE cl.caller_id IS NOT NULL
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (userId) {
      query += ` AND cl.caller_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }
    
    if (startDate) {
      query += ` AND cl.started_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      query += ` AND cl.started_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    query += ` ORDER BY cl.started_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    
    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

exports.getSalesFloorStats = async (req, res) => {
  try {
    const { userId } = req.query;
    
    // Get today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let query = `
      SELECT 
        u.id as "userId",
        u.first_name || ' ' || u.last_name as "userName",
        u.email,
        COUNT(cl.id) as "callsMade",
        MAX(cl.started_at) as "lastActivity",
        COALESCE(
          jsonb_object_agg(cl.outcome, outcome_count) FILTER (WHERE cl.outcome IS NOT NULL),
          '{}'::jsonb
        ) as dispositions
      FROM users u
      LEFT JOIN (
        SELECT 
          caller_id,
          outcome,
          COUNT(*) as outcome_count,
          MAX(started_at) as started_at,
          id
        FROM call_logs
        WHERE started_at >= $1
        GROUP BY caller_id, outcome, id
      ) cl ON u.id = cl.caller_id
      WHERE u.is_active = true
    `;
    
    const params = [today.toISOString()];
    
    if (userId) {
      query += ` AND u.id = $2`;
      params.push(userId);
    }
    
    query += ` GROUP BY u.id, u.first_name, u.last_name, u.email`;
    
    const result = await pool.query(query, params);
    
    // Transform the data
    const stats = result.rows.map(row => ({
      userId: row.userId,
      userName: row.userName || row.email,
      callsMade: parseInt(row.callsMade) || 0,
      statusChanges: 0, // TODO: Track status changes separately
      lastActivity: row.lastActivity,
      dispositions: row.dispositions || {}
    }));
    
    res.json({ stats });
  } catch (error) {
    console.error('Get sales floor stats error:', error);
    res.status(500).json({ error: 'Failed to fetch sales floor stats' });
  }
};

exports.getTeamActivity = async (req, res) => {
  try {
    // Get today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get total team calls today (including unassigned)
    const totalCallsQuery = `
      SELECT COUNT(*) as total FROM call_logs WHERE started_at >= $1
    `;
    const totalCallsResult = await pool.query(totalCallsQuery, [today.toISOString()]);
    const totalTeamCalls = parseInt(totalCallsResult.rows[0].total) || 0;
    
    // Get team stats for today (per user)
    const statsQuery = `
      SELECT 
        u.id as "userId",
        u.first_name || ' ' || u.last_name as "userName",
        u.email,
        COUNT(cl.id) as "callsMade",
        MAX(cl.started_at) as "lastActivity"
      FROM users u
      LEFT JOIN call_logs cl ON u.id = cl.caller_id AND cl.started_at >= $1
      WHERE u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name, u.email
      HAVING COUNT(cl.id) > 0 OR u.role = 'agent' OR u.role = 'admin'
      ORDER BY COUNT(cl.id) DESC
    `;
    
    const statsResult = await pool.query(statsQuery, [today.toISOString()]);
    
    // Get disposition counts (including unassigned calls)
    const dispositionsQuery = `
      SELECT 
        outcome,
        COUNT(*) as count
      FROM call_logs
      WHERE started_at >= $1 AND outcome IS NOT NULL
      GROUP BY outcome
    `;
    
    const dispResult = await pool.query(dispositionsQuery, [today.toISOString()]);
    
    // Map dispositions to "Team" aggregate
    const teamDispositions = {};
    dispResult.rows.forEach((row) => {
      teamDispositions[row.outcome] = parseInt(row.count);
    });
    
    // Get disposition counts per user (for assigned calls)
    const userDispositionsQuery = `
      SELECT 
        caller_id as "userId",
        outcome,
        COUNT(*) as count
      FROM call_logs
      WHERE started_at >= $1 AND outcome IS NOT NULL AND caller_id IS NOT NULL
      GROUP BY caller_id, outcome
    `;
    
    const userDispResult = await pool.query(userDispositionsQuery, [today.toISOString()]);
    const dispositionsByUser = {};
    userDispResult.rows.forEach((row) => {
      if (!dispositionsByUser[row.userId]) {
        dispositionsByUser[row.userId] = {};
      }
      dispositionsByUser[row.userId][row.outcome] = parseInt(row.count);
    });
    
    // Get status change counts
    const statusChangesQuery = `
      SELECT 
        changed_by as "userId",
        COUNT(*) as count
      FROM prospect_status_log
      WHERE created_at >= $1 AND changed_by IS NOT NULL
      GROUP BY changed_by
    `;
    
    const statusResult = await pool.query(statusChangesQuery, [today.toISOString()]);
    const statusChangesByUser = {};
    statusResult.rows.forEach((row) => {
      statusChangesByUser[row.userId] = parseInt(row.count);
    });
    
    // Count unassigned calls
    const unassignedCallsQuery = `
      SELECT COUNT(*) as count FROM call_logs 
      WHERE started_at >= $1 AND caller_id IS NULL
    `;
    const unassignedResult = await pool.query(unassignedCallsQuery, [today.toISOString()]);
    const unassignedCalls = parseInt(unassignedResult.rows[0].count) || 0;
    
    // Get last activity from any call
    const lastActivityQuery = `
      SELECT MAX(started_at) as last FROM call_logs WHERE started_at >= $1
    `;
    const lastActivityResult = await pool.query(lastActivityQuery, [today.toISOString()]);
    const teamLastActivity = lastActivityResult.rows[0].last;
    
    const teamStats = statsResult.rows.map((row) => ({
      userId: row.userId,
      userName: row.userName || row.email,
      callsMade: parseInt(row.callsMade) || 0,
      statusChanges: statusChangesByUser[row.userId] || 0,
      lastActivity: row.lastActivity,
      dispositions: dispositionsByUser[row.userId] || {}
    }));
    
    // Add a "Team Total" entry if there are unassigned calls
    if (unassignedCalls > 0) {
      teamStats.unshift({
        userId: 'team-total',
        userName: '📊 Team Total (includes unassigned)',
        callsMade: totalTeamCalls,
        statusChanges: 0,
        lastActivity: teamLastActivity,
        dispositions: teamDispositions,
        isTeamTotal: true
      });
    }
    
    // Get recent activity logs (last 50 calls - include unassigned)
    const activityQuery = `
      SELECT 
        cl.id,
        cl.caller_id as "userId",
        'call_made' as action,
        cl.prospect_id as "prospectId",
        p.first_name || ' ' || p.last_name as "prospectName",
        CASE 
          WHEN cl.outcome IS NOT NULL THEN 'made a call - ' || cl.outcome
          ELSE 'made a call'
        END as details,
        cl.started_at as timestamp,
        cl.duration,
        cl.outcome as disposition,
        CASE WHEN cl.caller_id IS NULL THEN true ELSE false END as "isUnassigned"
      FROM call_logs cl
      LEFT JOIN prospects p ON cl.prospect_id = p.id
      WHERE cl.started_at >= $1
      ORDER BY cl.started_at DESC
      LIMIT 50
    `;
    
    const activityResult = await pool.query(activityQuery, [today.toISOString()]);
    
    res.json({
      teamStats,
      recentActivity: activityResult.rows,
      summary: {
        totalCalls: totalTeamCalls,
        assignedCalls: totalTeamCalls - unassignedCalls,
        unassignedCalls: unassignedCalls
      }
    });
  } catch (error) {
    console.error('Get team activity error:', error);
    res.status(500).json({ error: 'Failed to fetch team activity' });
  }
};
