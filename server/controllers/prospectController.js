// TODO: Integrate with real database for prospects

const db = require('../services/mockDatabase');

exports.getProspects = async (req, res) => {
  try {
    const prospects = await db.getAllProspects();
    res.json(prospects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prospects' });
  }
};

exports.createProspect = async (req, res) => {
  try {
    const { listId, ...prospectData } = req.body;
    const userId = req.userId; // Set by auth middleware

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
  } catch (error) {
    console.error('Create prospect error:', error);
    res.status(500).json({ error: 'Failed to create prospect' });
  }
};

exports.updateProspect = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.updateProspect(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Prospect not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update prospect' });
  }
};