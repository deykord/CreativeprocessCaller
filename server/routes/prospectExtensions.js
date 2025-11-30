const express = require('express');
const router = express.Router();
const dbService = require('../services/databaseService');
const authMiddleware = require('../middleware/authMiddleware');

const USE_DATABASE = process.env.USE_DATABASE === 'true';

/**
 * Check if a prospect can be called (duplicate prevention)
 * GET /api/prospects/:id/can-call
 */
router.get('/:id/can-call', authMiddleware, async (req, res) => {
  try {
    if (!USE_DATABASE) {
      return res.json({ allowed: true, reason: 'Database not enabled' });
    }

    const { id } = req.params;
    const userId = req.userId;

    const result = await dbService.canCallProspect(id, userId);
    res.json(result);
  } catch (error) {
    console.error('Can call prospect error:', error);
    res.status(500).json({ error: 'Failed to check call availability' });
  }
});

/**
 * Start a call (create active call record)
 * POST /api/prospects/:id/start-call
 */
router.post('/:id/start-call', authMiddleware, async (req, res) => {
  try {
    if (!USE_DATABASE) {
      return res.json({ success: true, message: 'Database not enabled' });
    }

    const { id } = req.params;
    const userId = req.userId;
    const { phoneNumber, fromNumber } = req.body;

    const result = await dbService.startCall(id, userId, phoneNumber, fromNumber);
    res.json(result);
  } catch (error) {
    console.error('Start call error:', error);
    if (error.message.includes('Prospect')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to start call' });
    }
  }
});

/**
 * End a call
 * POST /api/prospects/:id/end-call
 */
router.post('/:id/end-call', authMiddleware, async (req, res) => {
  try {
    if (!USE_DATABASE) {
      return res.json({ success: true, message: 'Database not enabled' });
    }

    const { id } = req.params;
    const { callLogId, outcome, duration, notes, recordingUrl } = req.body;

    await dbService.endCall(id, callLogId, outcome, duration, notes, recordingUrl);
    res.json({ success: true });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ error: 'Failed to end call' });
  }
});

/**
 * Get prospect call history
 * GET /api/prospects/:id/call-history
 */
router.get('/:id/call-history', authMiddleware, async (req, res) => {
  try {
    if (!USE_DATABASE) {
      return res.json([]);
    }

    const { id } = req.params;
    const history = await dbService.getProspectCallHistory(id);
    
    // Transform to frontend format
    const formatted = history.map(call => ({
      id: call.id,
      prospectId: call.prospect_id,
      callerId: call.caller_id,
      callerName: call.caller_first_name && call.caller_last_name 
        ? `${call.caller_first_name} ${call.caller_last_name}` 
        : 'Unknown',
      phoneNumber: call.phone_number,
      fromNumber: call.from_number,
      outcome: call.outcome,
      duration: call.duration,
      notes: call.notes,
      recordingUrl: call.recording_url,
      timestamp: call.started_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

/**
 * Get prospect status history
 * GET /api/prospects/:id/status-history
 */
router.get('/:id/status-history', authMiddleware, async (req, res) => {
  try {
    if (!USE_DATABASE) {
      return res.json([]);
    }

    const { id } = req.params;
    const history = await dbService.getProspectStatusHistory(id);
    
    // Transform to frontend format
    const formatted = history.map(entry => ({
      id: entry.id,
      prospectId: entry.prospect_id,
      oldStatus: entry.old_status,
      newStatus: entry.new_status,
      changedBy: entry.changed_by_first_name && entry.changed_by_last_name
        ? `${entry.changed_by_first_name} ${entry.changed_by_last_name}`
        : 'System',
      reason: entry.reason,
      timestamp: entry.created_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get status history error:', error);
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

/**
 * Get all active calls
 * GET /api/active-calls
 */
router.get('/active-calls', authMiddleware, async (req, res) => {
  try {
    if (!USE_DATABASE) {
      return res.json([]);
    }

    const activeCalls = await dbService.getActiveCalls();
    
    // Transform to frontend format
    const formatted = activeCalls.map(call => ({
      id: call.id,
      prospectId: call.prospect_id,
      prospectName: `${call.prospect_first_name} ${call.prospect_last_name}`,
      prospectPhone: call.prospect_phone,
      callerId: call.caller_id,
      callerName: `${call.caller_first_name} ${call.caller_last_name}`,
      startedAt: call.started_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get active calls error:', error);
    res.status(500).json({ error: 'Failed to fetch active calls' });
  }
});

/**
 * Assign lead to agent
 * POST /api/prospects/:id/assign
 */
router.post('/:id/assign', authMiddleware, async (req, res) => {
  try {
    if (!USE_DATABASE) {
      return res.json({ success: true, message: 'Database not enabled' });
    }

    const { id } = req.params;
    const { assignedTo, expiresAt } = req.body;
    const userId = req.userId;

    const assignment = await dbService.assignLead(id, assignedTo, userId, expiresAt);
    res.json(assignment);
  } catch (error) {
    console.error('Assign lead error:', error);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
});

module.exports = router;
