const dbService = require('../services/databaseService');

exports.getProspects = async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;
    
    const prospects = await dbService.getProspects(filters);
    
    // Transform to match frontend format
    const formatted = prospects.map(p => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      company: p.company,
      title: p.title,
      phone: p.phone,
      email: p.email,
      status: p.status,
      timezone: p.timezone,
      notes: p.notes,
      lastCall: p.last_call_time,
      totalCalls: p.total_calls || 0
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Get prospects error:', error);
    res.status(500).json({ error: 'Failed to fetch prospects' });
  }
};

exports.getProspectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const prospect = await dbService.getProspectById(id);
    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }
    
    // Transform to match frontend format
    res.json({
      id: prospect.id,
      firstName: prospect.first_name,
      lastName: prospect.last_name,
      company: prospect.company,
      title: prospect.title,
      phone: prospect.phone,
      email: prospect.email,
      status: prospect.status,
      timezone: prospect.timezone,
      notes: prospect.notes,
      lastCall: prospect.last_call_time,
      totalCalls: prospect.total_calls || 0
    });
  } catch (error) {
    console.error('Get prospect by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch prospect' });
  }
};

exports.createProspect = async (req, res) => {
  try {
    const { listId, ...prospectData } = req.body;
    const userId = req.userId; // Set by auth middleware

    const newProspect = await dbService.createProspect({
      firstName: prospectData.firstName,
      lastName: prospectData.lastName,
      company: prospectData.company,
      title: prospectData.title,
      phone: prospectData.phone,
      email: prospectData.email,
      status: prospectData.status || 'New',
      timezone: prospectData.timezone,
      notes: prospectData.notes
    }, userId);

    // Transform to frontend format
    const formatted = {
      id: newProspect.id,
      firstName: newProspect.first_name,
      lastName: newProspect.last_name,
      company: newProspect.company,
      title: newProspect.title,
      phone: newProspect.phone,
      email: newProspect.email,
      status: newProspect.status,
      timezone: newProspect.timezone,
      notes: newProspect.notes
    };

    res.json(formatted);
  } catch (error) {
    console.error('Create prospect error:', error);
    if (error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create prospect' });
    }
  }
};

exports.updateProspect = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const updated = await dbService.updateProspect(id, req.body, userId);
    if (!updated) return res.status(404).json({ error: 'Prospect not found' });

    // Transform to frontend format
    const formatted = {
      id: updated.id,
      firstName: updated.first_name,
      lastName: updated.last_name,
      company: updated.company,
      title: updated.title,
      phone: updated.phone,
      email: updated.email,
      status: updated.status,
      timezone: updated.timezone,
      notes: updated.notes,
      lastCall: updated.last_call,
      statusHistory: updated.status_history || [],
      lastUpdatedBy: updated.last_updated_by,
      lastUpdatedAt: updated.last_updated_at
    };

    res.json(formatted);
  } catch (error) {
    console.error('Update prospect error:', error);
    res.status(500).json({ error: 'Failed to update prospect' });
  }
};

exports.deleteProspect = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await dbService.deleteProspect(id);
    if (!deleted) return res.status(404).json({ error: 'Prospect not found' });
    
    res.json({ success: true, id, message: 'Prospect deleted successfully' });
  } catch (error) {
    console.error('Delete prospect error:', error);
    res.status(500).json({ error: 'Failed to delete prospect' });
  }
};

/**
 * Get status change history for a prospect
 */
exports.getStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await dbService.getProspectStatusHistory(id);
    
    // Transform to frontend format
    const formatted = history.map(h => ({
      id: h.id,
      oldStatus: h.old_status,
      newStatus: h.new_status,
      changedBy: h.changed_by,
      changedByName: h.changed_by_first_name && h.changed_by_last_name 
        ? `${h.changed_by_first_name} ${h.changed_by_last_name}` 
        : null,
      reason: h.reason,
      createdAt: h.created_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get status history error:', error);
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
};

/**
 * Get call history for a prospect
 */
exports.getCallHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await dbService.getProspectCallHistory(id);
    
    // Transform to frontend format
    const formatted = history.map(h => ({
      id: h.id,
      callerId: h.caller_id,
      callerName: h.caller_first_name && h.caller_last_name 
        ? `${h.caller_first_name} ${h.caller_last_name}` 
        : h.caller_email,
      phoneNumber: h.phone_number,
      fromNumber: h.from_number,
      outcome: h.outcome,
      duration: h.duration,
      notes: h.notes,
      recordingUrl: h.recording_url,
      startedAt: h.started_at,
      endedAt: h.ended_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
};

/**
 * Get full activity log for a prospect - everything that happened to this lead
 */
exports.getActivityLog = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const activityLog = await dbService.getProspectActivityLog(id, limit);
    
    // Transform to frontend format
    const formatted = activityLog.map(a => ({
      id: a.id,
      prospectId: a.prospect_id,
      userId: a.user_id,
      userName: a.user_first_name && a.user_last_name 
        ? `${a.user_first_name} ${a.user_last_name}` 
        : a.user_email || 'System',
      actionType: a.action_type,
      description: a.action_description,
      oldValue: a.old_value,
      newValue: a.new_value,
      fieldName: a.field_name,
      metadata: a.metadata,
      createdAt: a.created_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
};