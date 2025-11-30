const db = require('../services/mockDatabase');
const dbService = require('../services/databaseService');

// Use database service if available, fallback to mock
const USE_DATABASE = process.env.USE_DATABASE === 'true';

exports.getProspects = async (req, res) => {
  try {
    if (USE_DATABASE) {
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
    } else {
      const prospects = await db.getAllProspects();
      res.json(prospects);
    }
  } catch (error) {
    console.error('Get prospects error:', error);
    res.status(500).json({ error: 'Failed to fetch prospects' });
  }
};

exports.getProspectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (USE_DATABASE) {
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
    } else {
      const prospect = await db.getProspect(id);
      if (!prospect) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      res.json(prospect);
    }
  } catch (error) {
    console.error('Get prospect by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch prospect' });
  }
};

exports.createProspect = async (req, res) => {
  try {
    const { listId, ...prospectData } = req.body;
    const userId = req.userId; // Set by auth middleware

    if (USE_DATABASE) {
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
    } else {
      const newProspect = await db.createProspect({
        ...prospectData,
        createdBy: userId,
        listId: listId || null,
      });

      // If part of a list, add to that list
      if (listId) {
        const list = await db.getLeadList(listId);
        if (list && list.createdBy === userId) {
          const updatedIds = [...(list.prospectIds || []), newProspect.id];
          await db.updateLeadList(listId, {
            prospectIds: updatedIds,
            prospectCount: updatedIds.length,
          });
        }
      }

      res.json(newProspect);
    }
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

    if (USE_DATABASE) {
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
    } else {
      const updated = await db.updateProspect(id, req.body, userId);
      if (!updated) return res.status(404).json({ error: 'Prospect not found' });
      res.json(updated);
    }
  } catch (error) {
    console.error('Update prospect error:', error);
    res.status(500).json({ error: 'Failed to update prospect' });
  }
};

exports.deleteProspect = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check user permissions
    // TODO: Add proper permission check based on user role
    
    if (USE_DATABASE) {
      const deleted = await dbService.deleteProspect(id);
      if (!deleted) return res.status(404).json({ error: 'Prospect not found' });
      
      res.json({ success: true, id, message: 'Prospect deleted successfully' });
    } else {
      const deleted = await db.deleteProspect(id);
      if (!deleted) return res.status(404).json({ error: 'Prospect not found' });
      
      res.json({ success: true, id, message: 'Prospect deleted successfully' });
    }
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

    if (USE_DATABASE) {
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
    } else {
      // Mock database doesn't track status history
      res.json([]);
    }
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

    if (USE_DATABASE) {
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
    } else {
      // Mock database - return empty array
      res.json([]);
    }
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

    if (USE_DATABASE) {
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
    } else {
      // Mock database - return empty array
      res.json([]);
    }
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
};