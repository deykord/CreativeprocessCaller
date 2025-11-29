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
        lastCall: updated.last_call
      };

      res.json(formatted);
    } else {
      const updated = await db.updateProspect(id, req.body);
      if (!updated) return res.status(404).json({ error: 'Prospect not found' });
      res.json(updated);
    }
  } catch (error) {
    console.error('Update prospect error:', error);
    res.status(500).json({ error: 'Failed to update prospect' });
  }
};