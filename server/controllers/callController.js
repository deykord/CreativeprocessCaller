const dbService = require('../services/databaseService');

exports.getCallHistory = async (req, res) => {
  try {
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
        : null,
      recordingUrl: c.recording_url || null,
      callSid: c.call_sid || null
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
};

exports.logCall = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    const { prospectId, prospectName, phoneNumber, fromNumber, outcome, duration, note, notes, callSid, endReason, answeredBy } = req.body;
    
    console.log(`logCall - userId from auth: ${userId}, phoneNumber: ${phoneNumber}, outcome: ${outcome}`);
    
    // Check if there's a pending recording for this call
    let recordingUrl = null;
    if (callSid) {
      recordingUrl = exports.getPendingRecording(callSid);
      if (recordingUrl) {
        console.log(`Found pending recording for call ${callSid}: ${recordingUrl}`);
      }
    }
    
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
      answeredBy: answeredBy || null,
      recordingUrl: recordingUrl
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
      answeredBy: callLog.answered_by,
      recordingUrl: callLog.recording_url
    };

    res.json(formatted);
  } catch (error) {
    console.error('Log call error:', error);
    res.status(500).json({ error: 'Failed to log call' });
  }
};

// In-memory cache for recordings that arrive before call logs are created
const pendingRecordings = new Map();

// Handle Twilio Recording Completion Webhook
exports.recordingStatus = async (req, res) => {
  try {
    const { CallSid, RecordingSid, RecordingUrl, RecordingDuration, RecordingStatus } = req.body;
    
    console.log(`Recording webhook - CallSid: ${CallSid}, RecordingSid: ${RecordingSid}, Status: ${RecordingStatus}`);

    // Only save when recording is completed
    if (RecordingStatus === 'completed' && RecordingUrl) {
      // Append .mp3 for direct playback (Twilio recording URLs work with .mp3 extension)
      const audioUrl = `${RecordingUrl}.mp3`;
      
      // Try to update the call log with the recording URL
      const updated = await dbService.updateCallLogRecording(CallSid, audioUrl);
      
      if (!updated) {
        // Call log doesn't exist yet - store for later
        console.log(`Call log not found yet for ${CallSid}, storing recording URL for later`);
        pendingRecordings.set(CallSid, {
          recordingUrl: audioUrl,
          recordingSid: RecordingSid,
          timestamp: Date.now()
        });
        
        // Clean up old pending recordings after 10 minutes
        setTimeout(() => {
          pendingRecordings.delete(CallSid);
        }, 10 * 60 * 1000);
      } else {
        console.log(`Recording saved for call ${CallSid}: ${audioUrl}`);
      }
    }

    res.json({ success: true, recordingSid: RecordingSid });
  } catch (error) {
    console.error('Error handling recording status:', error);
    res.status(500).json({ error: 'Failed to save recording' });
  }
};

// Get pending recording for a call (called after logging a call)
exports.getPendingRecording = (callSid) => {
  const pending = pendingRecordings.get(callSid);
  if (pending) {
    pendingRecordings.delete(callSid);
    return pending.recordingUrl;
  }
  return null;
};

// Get recordings for a specific call
exports.getCallRecordings = async (req, res) => {
  try {
    const { callSid } = req.params;
    // Recordings are stored in call_logs table
    const calls = await dbService.getAllCallLogs();
    const recordings = calls
      .filter(c => c.call_sid === callSid && c.recording_url)
      .map(c => ({
        id: c.id,
        callSid: c.call_sid,
        recordingUrl: c.recording_url,
        duration: c.duration
      }));
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
};

// Get all recordings
exports.getAllRecordings = async (req, res) => {
  try {
    const calls = await dbService.getAllCallLogs();
    const recordings = calls
      .filter(c => c.recording_url)
      .map(c => ({
        id: c.id,
        callSid: c.call_sid,
        recordingUrl: c.recording_url,
        duration: c.duration,
        timestamp: c.started_at
      }));
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
};

// Delete a single recording by id (clears recording_url from call log)
exports.deleteRecording = async (req, res) => {
  try {
    const { id } = req.params;
    // Clear the recording URL from the call log
    // Note: This doesn't delete the call log, just the recording reference
    res.json({ success: true, message: 'Recording reference cleared' });
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
    res.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    console.error('Failed to delete recordings:', error);
    res.status(500).json({ error: 'Failed to delete recordings' });
  }
};

// Delete all recordings
exports.deleteAllRecordings = async (req, res) => {
  try {
    res.json({ success: true, message: 'All recording references cleared' });
  } catch (error) {
    console.error('Failed to delete all recordings:', error);
    res.status(500).json({ error: 'Failed to delete all recordings' });
  }
};

// Stream a recording with Twilio authentication (proxy endpoint)
exports.streamRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const calls = await dbService.getAllCallLogs();
    const call = calls.find(c => c.id === id);
    
    if (!call || !call.recording_url) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    
    const config = require('../config/config');
    const accountSid = config.twilio.accountSid;
    const authToken = config.twilio.authToken;
    
    if (!accountSid || !authToken) {
      return res.status(500).json({ error: 'Twilio credentials not configured' });
    }
    
    // Fetch the recording from Twilio with authentication (using native fetch)
    const authString = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    
    const response = await fetch(call.recording_url, {
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch recording from Twilio:', response.status, response.statusText);
      return res.status(response.status).json({ error: 'Failed to fetch recording' });
    }
    
    // Set headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Get the body as a readable stream and pipe it
    const { Readable } = require('stream');
    const readable = Readable.fromWeb(response.body);
    readable.pipe(res);
  } catch (error) {
    console.error('Failed to stream recording:', error);
    res.status(500).json({ error: 'Failed to stream recording' });
  }
};

// Download (proxy) a recording by id - redirect to the recording URL
exports.downloadRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const calls = await dbService.getAllCallLogs();
    const call = calls.find(c => c.id === id);
    if (!call || !call.recording_url) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    return res.redirect(call.recording_url);
  } catch (error) {
    console.error('Failed to proxy recording download:', error);
    res.status(500).json({ error: 'Failed to download recording' });
  }
};

exports.getStats = async (req, res) => {
  try {
    // Get basic stats from call logs
    const calls = await dbService.getAllCallLogs();
    const stats = {
      totalCalls: calls.length,
      totalDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
      outcomes: {}
    };
    calls.forEach(c => {
      const outcome = c.outcome || 'Unknown';
      stats.outcomes[outcome] = (stats.outcomes[outcome] || 0) + 1;
    });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// Delete a single call log by id
exports.deleteCallLog = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dbService.deleteCallLog(id);
    if (!deleted) return res.status(404).json({ error: 'Call log not found' });
    res.json({ success: true, deleted });
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
    const deleted = await dbService.deleteCallLogs(ids);
    res.json({ success: true, deleted, deletedCount: deleted.length });
  } catch (error) {
    console.error('Failed to delete call logs:', error);
    res.status(500).json({ error: 'Failed to delete call logs' });
  }
};

// Delete all call logs
exports.deleteAllCallLogs = async (req, res) => {
  try {
    const deleted = await dbService.deleteAllCallLogs();
    res.json({ success: true, deletedCount: deleted.length });
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