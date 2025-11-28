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

// Handle Twilio Recording Completion Webhook
exports.recordingStatus = async (req, res) => {
  try {
    const { CallSid, RecordingSid, RecordingUrl, RecordingDuration } = req.body;
    
    console.log(`Recording webhook - CallSid: ${CallSid}, RecordingSid: ${RecordingSid}`);

    const recording = await db.saveCallRecording({
      callSid: CallSid,
      recordingSid: RecordingSid,
      recordingUrl: RecordingUrl,
      duration: parseInt(RecordingDuration) || 0,
      status: 'completed'
    });

    res.json({ success: true, recordingId: recording.id });
  } catch (error) {
    console.error('Error handling recording status:', error);
    res.status(500).json({ error: 'Failed to save recording' });
  }
};

// Get recordings for a specific call
exports.getCallRecordings = async (req, res) => {
  try {
    const { callSid } = req.params;
    const recordings = await db.getCallRecordings(callSid);
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
};

// Get all recordings
exports.getAllRecordings = async (req, res) => {
  try {
    const recordings = await db.getAllCallRecordings();
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recordings' });
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