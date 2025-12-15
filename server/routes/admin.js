const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/authMiddleware');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
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

// Helper to get date range filter
const getDateFilter = (range) => {
  switch (range) {
    case '7d':
      return "AND ts.started_at > NOW() - INTERVAL '7 days'";
    case '30d':
      return "AND ts.started_at > NOW() - INTERVAL '30 days'";
    case '90d':
      return "AND ts.started_at > NOW() - INTERVAL '90 days'";
    default:
      return ''; // all time
  }
};

// Helper to get date range in days for call logs
const getDateIntervalDays = (range) => {
  switch (range) {
    case '7d':
      return '7';
    case '30d':
      return '30';
    case '90d':
      return '90';
    default:
      return '365'; // all time - last year
  }
};

// OpenAI pricing (as of Dec 2024)
const PRICING = {
  'gpt-4o-mini': {
    input: 0.15 / 1_000_000,  // $0.15 per 1M input tokens
    output: 0.60 / 1_000_000   // $0.60 per 1M output tokens
  },
  'tts-1': {
    perChar: 15.00 / 1_000_000  // $15 per 1M characters
  }
};

// GET /api/admin/training/costs - Get total training costs
router.get('/training/costs', authMiddleware, requireAdmin, async (req, res) => {
  const range = req.query.range || '30d';
  const dateFilter = getDateFilter(range).replace('ts.', '');
  
  try {
    // Get costs from training_usage table
    const usageResult = await pool.query(`
      SELECT 
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COALESCE(SUM(CASE WHEN api_type = 'chat' THEN cost_usd ELSE 0 END), 0) as chat_cost,
        COALESCE(SUM(CASE WHEN api_type = 'tts' THEN cost_usd ELSE 0 END), 0) as tts_cost,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(audio_seconds), 0) as audio_seconds
      FROM training_usage
      WHERE 1=1 ${dateFilter.replace('started_at', 'created_at')}
    `);

    // Get session/message counts
    const sessionResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT ts.id) as total_sessions,
        COALESCE(SUM(ts.message_count), 0) as total_messages
      FROM training_sessions ts
      WHERE 1=1 ${getDateFilter(range)}
    `);

    const usage = usageResult.rows[0];
    const sessions = sessionResult.rows[0];

    // If no usage data yet, estimate from sessions/messages
    let estimatedCost = parseFloat(usage.total_cost) || 0;
    if (estimatedCost === 0 && parseInt(sessions.total_messages) > 0) {
      // Estimate: ~500 tokens per message average, 50 chars TTS per response
      const estTokens = parseInt(sessions.total_messages) * 500;
      const estTtsChars = parseInt(sessions.total_messages) * 50;
      estimatedCost = (estTokens * PRICING['gpt-4o-mini'].output) + (estTtsChars * PRICING['tts-1'].perChar);
    }

    res.json({
      totalCostUsd: estimatedCost,
      chatCost: parseFloat(usage.chat_cost) || estimatedCost * 0.3,
      ttsCost: parseFloat(usage.tts_cost) || estimatedCost * 0.7,
      totalSessions: parseInt(sessions.total_sessions) || 0,
      totalMessages: parseInt(sessions.total_messages) || 0,
      totalAudioSeconds: parseFloat(usage.audio_seconds) || 0,
      inputTokens: parseInt(usage.input_tokens) || 0,
      outputTokens: parseInt(usage.output_tokens) || 0
    });
  } catch (error) {
    console.error('Error fetching training costs:', error);
    res.status(500).json({ error: 'Failed to fetch costs' });
  }
});

// GET /api/admin/training/agents - Get per-agent statistics (training + call activity)
router.get('/training/agents', authMiddleware, requireAdmin, async (req, res) => {
  const range = req.query.range || '30d';
  const dateFilter = getDateFilter(range);
  const dayInterval = getDateIntervalDays(range);
  
  try {
    const result = await pool.query(`
      SELECT 
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email,
        u.role,
        COUNT(DISTINCT ts.id) as total_sessions,
        COALESCE(SUM(ts.message_count), 0) as total_messages,
        COALESCE(AVG(ts.duration_seconds), 0) as avg_session_duration,
        COALESCE(AVG(ts.score), 0) as avg_score,
        MAX(ts.started_at) as last_training_date,
        ARRAY_AGG(DISTINCT ts.scenario_id) FILTER (WHERE ts.scenario_id IS NOT NULL) as scenarios_completed,
        -- Call statistics
        COUNT(DISTINCT cl.id) as total_calls,
        COUNT(DISTINCT CASE WHEN cl.outcome IN ('completed', 'answered') THEN cl.id END) as connected_calls,
        COALESCE(SUM(CASE WHEN cl.outcome IN ('completed', 'answered') THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(DISTINCT cl.id)::numeric, 0) * 100, 0) as success_rate,
        COALESCE(SUM(cl.duration), 0) as total_call_duration,
        COALESCE(SUM(CASE WHEN cl.started_at > NOW() - INTERVAL '1 day' THEN 1 ELSE 0 END), 0) as calls_last_24h,
        MAX(cl.started_at) as last_call_date
      FROM users u
      LEFT JOIN training_sessions ts ON ts.user_id = u.id ${dateFilter}
      LEFT JOIN call_logs cl ON cl.caller_id = u.id AND cl.started_at > NOW() - INTERVAL '${dayInterval} days'
      WHERE u.is_active = true AND u.role IN ('agent', 'admin', 'supervisor')
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.role
      HAVING COUNT(DISTINCT ts.id) > 0 OR COUNT(DISTINCT cl.id) > 0
      ORDER BY COALESCE(COUNT(DISTINCT ts.id), 0) + COALESCE(COUNT(DISTINCT cl.id), 0) DESC
    `);

    // Calculate performance metrics per agent
    const agents = result.rows.map(row => {
      const totalCalls = parseInt(row.total_calls) || 0;
      const connectedCalls = parseInt(row.connected_calls) || 0;
      const successRate = parseFloat(row.success_rate) || 0;
      const totalSessions = parseInt(row.total_sessions) || 0;
      const avgScore = parseFloat(row.avg_score) || 0;
      
      // Calculate online hours (approximate: based on last 30 days activity)
      const onlineHours = Math.round((parseInt(row.total_call_duration) || 0) / 3600);
      
      // Performance score: 50% success rate, 30% training quality, 20% activity
      const trainingScore = totalSessions > 0 ? avgScore : 0;
      const activityScore = totalCalls > 0 ? 100 : 0;
      const performanceScore = Math.round(
        (successRate * 0.5) + 
        (trainingScore * 0.3) + 
        (activityScore * 0.2)
      );

      return {
        userId: row.user_id,
        userName: row.user_name?.trim() || 'Unknown',
        email: row.email,
        role: row.role,
        // Training metrics
        totalSessions: totalSessions,
        totalMessages: parseInt(row.total_messages) || 0,
        avgSessionDuration: parseFloat(row.avg_session_duration) || 0,
        avgScore: avgScore,
        trainingScore: Math.round(avgScore),
        lastTrainingDate: row.last_training_date,
        scenariosCompleted: row.scenarios_completed || [],
        // Call metrics
        totalCalls: totalCalls,
        connectedCalls: connectedCalls,
        successRate: Math.round(successRate * 100) / 100,
        totalCallDuration: parseInt(row.total_call_duration) || 0,
        onlineHours: onlineHours,
        callsLast24h: parseInt(row.calls_last_24h) || 0,
        lastCallDate: row.last_call_date,
        // Overall performance
        performanceScore: performanceScore,
        // Cost estimate: ~$0.001 per message
        totalCostUsd: (parseInt(row.total_messages) || 0) * 0.001
      };
    });

    res.json({ agents });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({ error: 'Failed to fetch agent statistics' });
  }
});

// GET /api/admin/training/daily-usage - Get daily usage trends
router.get('/training/daily-usage', authMiddleware, requireAdmin, async (req, res) => {
  const range = req.query.range || '30d';
  
  let days = 30;
  if (range === '7d') days = 7;
  else if (range === '90d') days = 90;
  else if (range === 'all') days = 365;
  
  try {
    const result = await pool.query(`
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as sessions,
        COALESCE(SUM(message_count), 0) as messages
      FROM training_sessions
      WHERE started_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(started_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    const usage = result.rows.map(row => ({
      date: row.date,
      sessions: parseInt(row.sessions),
      messages: parseInt(row.messages),
      // Estimate cost per day
      costUsd: parseInt(row.messages) * 0.001
    }));

    res.json({ usage });
  } catch (error) {
    console.error('Error fetching daily usage:', error);
    res.status(500).json({ error: 'Failed to fetch daily usage' });
  }
});

// GET /api/admin/training/scenarios - Get scenario performance
router.get('/training/scenarios', authMiddleware, requireAdmin, async (req, res) => {
  const range = req.query.range || '30d';
  const dateFilter = getDateFilter(range);
  
  try {
    const result = await pool.query(`
      SELECT 
        scenario_id,
        scenario_name,
        COUNT(*) as total_sessions,
        COALESCE(AVG(score), 0) as avg_score,
        COALESCE(AVG(duration_seconds), 0) as avg_duration
      FROM training_sessions ts
      WHERE scenario_id IS NOT NULL ${dateFilter}
      GROUP BY scenario_id, scenario_name
      ORDER BY total_sessions DESC
    `);

    const scenarios = result.rows.map(row => ({
      scenarioId: row.scenario_id,
      scenarioName: row.scenario_name || row.scenario_id,
      totalSessions: parseInt(row.total_sessions),
      avgScore: parseFloat(row.avg_score),
      avgDuration: parseFloat(row.avg_duration)
    }));

    res.json({ scenarios });
  } catch (error) {
    console.error('Error fetching scenario stats:', error);
    res.status(500).json({ error: 'Failed to fetch scenario statistics' });
  }
});

module.exports = router;
