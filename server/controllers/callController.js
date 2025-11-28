const db = require('../services/mockDatabase');

exports.getCallHistory = async (req, res) => {
  try {
    const logs = await db.getAllCallLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
};

exports.logCall = async (req, res) => {
  try {
    const log = await db.createCallLog(req.body);
    
    // Auto-update prospect status if provided in request
    if (req.body.prospectId && req.body.outcome) {
      let status = 'Contacted';
      if (req.body.outcome === 'Meeting Set') status = 'Qualified';
      if (req.body.outcome === 'Not Interested') status = 'Lost';
      
      await db.updateProspect(req.body.prospectId, { 
        status, 
        lastCall: new Date().toISOString() 
      });
    }

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log call' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};