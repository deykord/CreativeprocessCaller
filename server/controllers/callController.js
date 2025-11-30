const db = require('../services/mockDatabase');
const dbService = require('../services/databaseService');

// Use database service if available
const USE_DATABASE = process.env.USE_DATABASE === 'true';

exports.getCallHistory = async (req, res) => {
  try {
    if (USE_DATABASE) {
      const calls = await dbService.getAllCallLogs();
      // Transform to frontend format
      const formatted = calls.map(c => ({
        id: c.id,
        prospectId: c.prospect_id,
        prospectName: c.prospect_first_name && c.prospect_last_name 
          ? `${c.prospect_first_name} ${c.prospect_last_name}` 
          : 'Unknown',
        phoneNumber: c.phone_number,
        fromNumber: c.from_number,
        outcome: c.outcome,
        duration: c.duration || 0,
        note: c.notes || '',
        timestamp: c.started_at,
        callerName: c.caller_first_name && c.caller_last_name 
          ? `${c.caller_first_name} ${c.caller_last_name}` 
          : null
      }));
      res.json(formatted);
    } else {
      const calls = await db.getAllCallLogs();
      res.json(calls);
    }
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
};

exports.logCall = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    const { prospectId, prospectName, phoneNumber, fromNumber, outcome, duration, note, notes, callSid, endReason, answeredBy } = req.body;
    
    if (USE_DATABASE) {
      // Create call log entry in database
      const callLog = await dbService.createCallLog({
        prospectId: prospectId || null,
        callerId: userId,
        phoneNumber: phoneNumber,
        fromNumber: fromNumber,
        outcome: outcome,
        duration: duration || 0,
        notes: note || notes || '',
        callSid: callSid || null,
        endReason: endReason || null,
        answeredBy: answeredBy || null
      });

      // If prospect exists, update their last_call timestamp and status
      if (prospectId) {
        try {
          await dbService.updateProspect(prospectId, { 
            status: 'Contacted',
            lastCall: new Date().toISOString()
          }, userId);
        } catch (updateErr) {
          console.warn('Failed to update prospect after call:', updateErr);
        }
      }

      // Transform to frontend format
      const formatted = {
        id: callLog.id,
        prospectId: callLog.prospect_id,
        prospectName: prospectName || 'Unknown',
        phoneNumber: callLog.phone_number,
        fromNumber: callLog.from_number,
        outcome: callLog.outcome,
        duration: callLog.duration || 0,
        note: callLog.notes || '',
        timestamp: callLog.started_at,
        callSid: callLog.call_sid,
        endReason: callLog.end_reason,
        answeredBy: callLog.answered_by
      };

      res.json(formatted);
    } else {
      const callData = {
        ...req.body,
        userId: userId
      };
      const newLog = await db.createCallLog(callData);
      res.json(newLog);
    }
  } catch (error) {
    console.error('Log call error:', error);
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

// Delete a single recording by id
exports.deleteRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteCallRecording(id);
    if (!deleted) return res.status(404).json({ error: 'Recording not found' });
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Failed to delete recording:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
};

// Delete multiple recordings (ids in body)
exports.deleteMultipleRecordings = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
    const deleted = await db.deleteCallRecordings(ids);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Failed to delete recordings:', error);
    res.status(500).json({ error: 'Failed to delete recordings' });
  }
};

// Delete all recordings
exports.deleteAllRecordings = async (req, res) => {
  try {
    const deleted = await db.deleteAllCallRecordings();
    res.json({ success: true, deletedCount: deleted.length });
  } catch (error) {
    console.error('Failed to delete all recordings:', error);
    res.status(500).json({ error: 'Failed to delete all recordings' });
  }
};

// Download (proxy) a recording by id - redirect to the recording URL
exports.downloadRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const all = await db.getAllCallRecordings();
    const rec = all.find(r => r.id === id);
    if (!rec) return res.status(404).json({ error: 'Recording not found' });
    // If recordingUrl is a remote URL, redirect so browser downloads from Twilio
    if (rec.recordingUrl) {
      return res.redirect(rec.recordingUrl);
    }
    res.status(404).json({ error: 'Recording URL not available' });
  } catch (error) {
    console.error('Failed to proxy recording download:', error);
    res.status(500).json({ error: 'Failed to download recording' });
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

// Delete a single call log by id
exports.deleteCallLog = async (req, res) => {
  try {
    const { id } = req.params;
    if (USE_DATABASE) {
      const deleted = await dbService.deleteCallLog(id);
      if (!deleted) return res.status(404).json({ error: 'Call log not found' });
      res.json({ success: true, deleted });
    } else {
      // Mock database doesn't have call log deletion
      res.status(501).json({ error: 'Not implemented in mock mode' });
    }
  } catch (error) {
    console.error('Failed to delete call log:', error);
    res.status(500).json({ error: 'Failed to delete call log' });
  }
};

// Delete multiple call logs (ids in body)
exports.deleteMultipleCallLogs = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
    if (USE_DATABASE) {
      const deleted = await dbService.deleteCallLogs(ids);
      res.json({ success: true, deleted, deletedCount: deleted.length });
    } else {
      res.status(501).json({ error: 'Not implemented in mock mode' });
    }
  } catch (error) {
    console.error('Failed to delete call logs:', error);
    res.status(500).json({ error: 'Failed to delete call logs' });
  }
};

// Delete all call logs
exports.deleteAllCallLogs = async (req, res) => {
  try {
    if (USE_DATABASE) {
      const deleted = await dbService.deleteAllCallLogs();
      res.json({ success: true, deletedCount: deleted.length });
    } else {
      res.status(501).json({ error: 'Not implemented in mock mode' });
    }
  } catch (error) {
    console.error('Failed to delete all call logs:', error);
    res.status(500).json({ error: 'Failed to delete all call logs' });
  }
};

// Upload a recording from the browser (browser-recorded audio blob)
exports.uploadRecording = async (req, res) => {
  try {
    // For now, just acknowledge the upload - in production you'd save the file
    // The actual call recording from Twilio comes via recordingStatus webhook
    console.log('Browser recording upload received');
    res.json({ success: true, message: 'Recording upload acknowledged' });
  } catch (error) {
    console.error('Failed to handle recording upload:', error);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
};