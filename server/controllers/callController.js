const db = require('../services/mockDatabase');

exports.getCallHistory = async (req, res) => {
  try {
    const calls = await db.getAllCallLogs();
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
};

exports.logCall = async (req, res) => {
  try {
    const newLog = await db.createCallLog(req.body);
    res.json(newLog);
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