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
    const prospect = await db.createProspect(req.body);
    res.status(201).json(prospect);
  } catch (error) {
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