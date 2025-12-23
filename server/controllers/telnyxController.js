/**
 * Telnyx Voice Webhook Controller
 * Handles Telnyx voice events (call.initiated, call.answered, call.hangup, etc.)
 */

const telnyxClient = require('../services/telnyxClient');
const config = require('../config/config');

// In-memory store for active call statuses (in production, use Redis)
const activeCallStatuses = new Map();

// In-memory cache for recordings that arrive before call logs (persist for 30 minutes)
const pendingRecordings = new Map();

/**
 * Map Telnyx event types to our internal call statuses
 */
const eventToStatus = {
  'call.initiated': 'initiated',
  'call.bridged': 'in-progress',
  'call.answered': 'answered',
  'call.hangup': 'completed',
  'call.recording.saved': 'recording-saved',
  'call.speak.started': 'speaking',
  'call.speak.ended': 'speak-ended',
  'call.playback.started': 'playback',
  'call.playback.ended': 'playback-ended',
  'call.dtmf.received': 'dtmf-received',
  'call.machine.detection.ended': 'amd-complete',
};

/**
 * Map Telnyx hangup causes to our CallEndReason
 */
const hangupCauseToReason = {
  'normal_clearing': 'customer_hangup',
  'originator_cancel': 'agent_hangup',
  'user_busy': 'busy',
  'no_user_response': 'no_answer',
  'no_answer': 'no_answer',
  'call_rejected': 'call_rejected',
  'invalid_number_format': 'invalid_number',
  'unallocated_number': 'invalid_number',
  'destination_out_of_order': 'failed',
  'network_out_of_order': 'network_error',
  'recovery_on_timer_expire': 'timeout',
  'normal_temporary_failure': 'failed',
};

/**
 * Main webhook handler for all Telnyx voice events
 */
exports.handleVoiceWebhook = async (req, res) => {
  try {
    const event = req.body;
    
    console.log('========== TELNYX WEBHOOK RECEIVED ==========');
    console.log('Event type:', event.data?.event_type);
    console.log('Call Control ID:', event.data?.payload?.call_control_id);
    console.log('Full event:', JSON.stringify(event, null, 2));

    const eventType = event.data?.event_type;
    const payload = event.data?.payload || {};

    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'call.initiated':
        await handleCallInitiated(payload);
        break;
      case 'call.answered':
        await handleCallAnswered(payload);
        break;
      case 'call.bridged':
        await handleCallBridged(payload);
        break;
      case 'call.hangup':
        await handleCallHangup(payload);
        break;
      case 'call.recording.saved':
        await handleRecordingSaved(payload);
        break;
      case 'call.machine.detection.ended':
        await handleAMDComplete(payload);
        break;
      case 'call.dtmf.received':
        await handleDTMFReceived(payload);
        break;
      default:
        console.log('Unhandled Telnyx event type:', eventType);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling Telnyx webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle call.initiated event
 */
async function handleCallInitiated(payload) {
  const callControlId = payload.call_control_id;
  const callLegId = payload.call_leg_id;
  const callSessionId = payload.call_session_id;
  const direction = payload.direction;
  const from = payload.from;
  const to = payload.to;

  console.log(`📞 Call initiated: ${callControlId}, direction: ${direction}, from: ${from}, to: ${to}`);

  // Store call status
  activeCallStatuses.set(callControlId, {
    callControlId,
    callLegId,
    callSessionId,
    status: direction === 'incoming' ? 'ringing' : 'initiated',
    direction,
    from,
    to,
    startTime: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // For inbound calls, mark as waiting for agent to answer in UI
  if (direction === 'incoming') {
    console.log(`🔔 INBOUND CALL from ${from} to ${to} - Call Control ID: ${callControlId}`);
    
    // Set status to waiting_for_agent so it appears in the UI
    activeCallStatuses.set(callControlId, {
      ...activeCallStatuses.get(callControlId),
      status: 'waiting_for_agent'
    });
    
    console.log(`📞 Inbound call waiting for agent to answer: ${callControlId}`);
  }
}

/**
 * Handle call.answered event
 */
async function handleCallAnswered(payload) {
  const callControlId = payload.call_control_id;
  
  console.log(`Call answered: ${callControlId}`);

  // Update call status
  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    callControlId,
    status: 'answered',
    answeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Start recording automatically for all answered calls
  try {
    console.log(`🎙️ Attempting to start recording for call: ${callControlId}`);
    const result = await telnyxClient.startRecording(callControlId, 'dual');
    console.log(`✓ Recording started successfully for call: ${callControlId}`, result);
  } catch (error) {
    console.error(`✗ Failed to start recording for call ${callControlId}:`, error.message || error);
  }
}

/**
 * Handle call.bridged event (two legs connected)
 */
async function handleCallBridged(payload) {
  const callControlId = payload.call_control_id;
  
  console.log(`Call bridged: ${callControlId}`);

  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    callControlId,
    status: 'in-progress',
    bridgedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Handle call.hangup event
 */
async function handleCallHangup(payload) {
  const callControlId = payload.call_control_id;
  const hangupCause = payload.hangup_cause;
  const hangupSource = payload.hangup_source;
  const startTime = payload.start_time;
  const endTime = payload.end_time;

  // Calculate duration
  let duration = 0;
  if (startTime && endTime) {
    duration = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
  }

  const endReason = hangupCauseToReason[hangupCause] || 'unknown';

  console.log(`Call hangup: ${callControlId}, cause: ${hangupCause}, source: ${hangupSource}, duration: ${duration}s`);

  // Get call status to determine if this was an inbound call
  const callStatus = activeCallStatuses.get(callControlId) || {};

  // Update call status
  activeCallStatuses.set(callControlId, {
    ...callStatus,
    callControlId,
    status: 'completed',
    hangupCause,
    hangupSource,
    endReason,
    duration,
    endTime: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // For inbound calls, automatically log them to the database
  if (callStatus.direction === 'incoming') {
    console.log(`📞 Logging inbound call to database: ${callControlId}`);

    try {
      const dbService = require('../services/databaseService');

      // Determine outcome based on call duration and answered status
      let outcome = 'No Answer';
      if (callStatus.answeredAt) {
        // Call was answered
        if (duration > 30) {
          outcome = 'Connected'; // Long conversation
        } else if (duration > 10) {
          outcome = 'Connected'; // Medium conversation
        } else {
          outcome = 'Connected'; // Short conversation but answered
        }
      } else if (duration > 5) {
        // Call rang for a while but wasn't answered
        outcome = 'No Answer';
      }

      // For inbound calls:
      // - phone_number stores the caller's number for consistency
      // - from_number also stores the caller's number
      // - prospect_name shows a descriptive label
      const callLog = await dbService.createCallLog({
        prospectId: null, // We don't know the prospect for inbound calls
        callerId: callStatus.answeredBy || null, // Agent who answered
        phoneNumber: callStatus.from, // Store caller's number as the main phone number
        fromNumber: callStatus.from, // The caller's number
        outcome: outcome,
        duration: duration,
        notes: `Inbound call to ${callStatus.to}`,
        callSid: callControlId,
        endReason: endReason,
        answeredBy: callStatus.answeredBy || null,
        recordingUrl: callStatus.recordingUrl || null,
        prospectName: `Inbound Caller (${callStatus.from})`,
        direction: 'inbound'
      });

      console.log(`✓ Inbound call logged to database: ${callLog.id}`);

    } catch (error) {
      console.error(`❌ Failed to log inbound call ${callControlId}:`, error);
    }
  }

  // Clean up after 5 minutes
  setTimeout(() => {
    activeCallStatuses.delete(callControlId);
  }, 5 * 60 * 1000);
}

/**
 * Handle call.recording.saved event
 */
async function handleRecordingSaved(payload) {
  const callControlId = payload.call_control_id;
  const recordingId = payload.recording_id;
  const recordingUrl = payload.recording_urls?.mp3 || payload.recording_urls?.wav;

  console.log(`📼 ========== RECORDING SAVED EVENT ==========`);
  console.log(`📼 Recording ID: ${recordingId}`);
  console.log(`📼 Call Control ID: ${callControlId}`);
  console.log(`📼 Recording URL: ${recordingUrl}`);
  console.log(`📼 Full payload:`, JSON.stringify(payload, null, 2));

  // Update call status with recording info
  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    recordingId,
    recordingUrl,
    updatedAt: new Date().toISOString(),
  });

  // Save recording URL to database
  if (recordingUrl) {
    try {
      const dbService = require('../services/databaseService');
      // Try to update the call log with the recording URL using call_sid (which stores callControlId for Telnyx)
      const updated = await dbService.updateCallLogRecording(callControlId, recordingUrl);
      
      if (updated) {
        console.log(`✓ Recording URL saved to database for call ${callControlId}`);
      } else {
        console.warn(`⚠ Call log not found YET for callControlId ${callControlId}, storing in pending cache`);
        
        // Store in pending recordings cache for when the call log is created
        pendingRecordings.set(callControlId, {
          recordingUrl,
          recordingId,
          timestamp: Date.now()
        });
        
        // Retry updating the database after delays (call log might not exist yet)
        setTimeout(async () => {
          try {
            const retried = await dbService.updateCallLogRecording(callControlId, recordingUrl);
            if (retried) {
              console.log(`✓ Recording URL saved on retry #1 for call ${callControlId}`);
              pendingRecordings.delete(callControlId);
            }
          } catch (err) {
            console.log(`⚠ Retry #1 failed for ${callControlId}`);
          }
        }, 3000); // Retry after 3 seconds
        
        setTimeout(async () => {
          try {
            const retried = await dbService.updateCallLogRecording(callControlId, recordingUrl);
            if (retried) {
              console.log(`✓ Recording URL saved on retry #2 for call ${callControlId}`);
              pendingRecordings.delete(callControlId);
            }
          } catch (err) {
            console.log(`⚠ Retry #2 failed for ${callControlId}`);
          }
        }, 10000); // Retry after 10 seconds
        
        // Clean up pending recordings after 30 minutes
        setTimeout(() => {
          if (pendingRecordings.has(callControlId)) {
            console.warn(`⚠ Removing stale pending recording for ${callControlId} after 30 minutes`);
            pendingRecordings.delete(callControlId);
          }
        }, 30 * 60 * 1000);
      }
    } catch (error) {
      console.error(`✗ Error saving recording URL to database:`, error);
    }
  }
}

/**
 * Handle AMD (Answering Machine Detection) completion
 */
async function handleAMDComplete(payload) {
  const callControlId = payload.call_control_id;
  const result = payload.result; // 'human', 'machine', 'machine_end_beep', 'not_sure'

  console.log(`AMD complete: ${callControlId}, result: ${result}`);

  // Update call status
  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    answeredBy: result,
    updatedAt: new Date().toISOString(),
  });

  // If machine detected with beep, trigger auto voicemail drop if configured
  if (result === 'machine_end_beep' || result === 'machine') {
    console.log('🤖 Answering machine detected - checking for auto voicemail drop');
    await handleAutoVoicemailDrop(callControlId, existing);
  }
}

/**
 * Handle automatic voicemail drop when answering machine is detected
 */
async function handleAutoVoicemailDrop(callControlId, callData) {
  try {
    const pool = require('../config/database');
    
    // Get the user ID from the call metadata
    const userId = callData.userId;
    if (!userId) {
      console.log('No user ID associated with call, skipping auto voicemail drop');
      return;
    }
    
    // Check if user has auto voicemail drop enabled
    const settingsResult = await pool.query(
      `SELECT * FROM automation_settings WHERE user_id = $1`,
      [userId]
    );
    
    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auto_voicemail_drop) {
      console.log('Auto voicemail drop not enabled for user:', userId);
      return;
    }
    
    const settings = settingsResult.rows[0];
    const voicemailId = settings.default_voicemail_id;
    
    if (!voicemailId) {
      console.log('No default voicemail configured for user:', userId);
      return;
    }
    
    // Get the voicemail audio
    const voicemailResult = await pool.query(
      `SELECT id, name, audio_data, audio_type FROM voicemails WHERE id = $1`,
      [voicemailId]
    );
    
    if (voicemailResult.rows.length === 0) {
      console.log('Voicemail not found:', voicemailId);
      return;
    }
    
    const voicemail = voicemailResult.rows[0];
    console.log('📢 Dropping voicemail:', voicemail.name);
    
    // For now, use speak with a generic message or play audio URL
    // In production, you'd host the audio file and use playback_start
    // Since audio_data is base64, we'd need to serve it from a URL
    
    // Log the voicemail drop
    const dropResult = await pool.query(
      `INSERT INTO voicemail_drop_logs (user_id, prospect_id, voicemail_id, call_control_id, status)
       VALUES ($1, $2, $3, $4, 'dropped')
       RETURNING id`,
      [userId, callData.prospectId || null, voicemailId, callControlId]
    );
    
    // Increment voicemail usage
    await pool.query(
      `UPDATE voicemails SET times_used = times_used + 1 WHERE id = $1`,
      [voicemailId]
    );
    
    console.log('✅ Voicemail drop logged:', dropResult.rows[0]?.id);
    
    // Trigger SMS follow-up if enabled
    if (settings.auto_sms_followup && callData.to) {
      const automationController = require('./automationController');
      const smsLogId = await automationController.sendVoicemailFollowupSms(
        userId,
        callData.prospectId,
        callData.to,
        callData.callLogId
      );
      
      if (smsLogId) {
        await pool.query(
          `UPDATE voicemail_drop_logs SET sms_sent = true, sms_log_id = $1 WHERE id = $2`,
          [smsLogId, dropResult.rows[0].id]
        );
        console.log('📱 SMS follow-up queued:', smsLogId);
      }
    }
    
    // Schedule callback if enabled
    if (settings.auto_schedule_callback && callData.prospectId) {
      const callbackTime = new Date();
      callbackTime.setHours(callbackTime.getHours() + (settings.callback_delay_hours || 24));
      
      await pool.query(
        `INSERT INTO scheduled_callbacks (user_id, prospect_id, original_call_id, scheduled_for, notes)
         VALUES ($1, $2, $3, $4, 'Auto-scheduled after voicemail')`,
        [userId, callData.prospectId, callData.callLogId, callbackTime]
      );
      console.log('📅 Callback scheduled for:', callbackTime);
    }
    
    // Hang up after voicemail is complete (give it a few seconds)
    setTimeout(async () => {
      try {
        await telnyxClient.hangupCall(callControlId);
        console.log('📞 Call ended after voicemail drop');
      } catch (err) {
        console.log('Call may have already ended:', err.message);
      }
    }, 30000); // Wait 30 seconds for voicemail to play
    
  } catch (error) {
    console.error('Error in auto voicemail drop:', error);
  }
}

/**
 * Handle DTMF received
 */
async function handleDTMFReceived(payload) {
  const callControlId = payload.call_control_id;
  const digit = payload.digit;

  console.log(`DTMF received: ${callControlId}, digit: ${digit}`);

  // You could route based on DTMF here (IVR)
}

/**
 * Get cached call status
 */
exports.getCachedCallStatus = (req, res) => {
  const { callControlId } = req.params;
  
  const status = activeCallStatuses.get(callControlId);
  if (status) {
    return res.json(status);
  }
  
  res.status(404).json({ error: 'Call status not found' });
};

/**
 * Get all active calls
 */
exports.getActiveCalls = (req, res) => {
  const activeCalls = [];
  
  activeCallStatuses.forEach((status, id) => {
    if (!['completed', 'hangup'].includes(status.status)) {
      activeCalls.push(status);
    }
  });
  
  res.json(activeCalls);
};

/**
 * End a call via API
 */
exports.endCall = async (req, res) => {
  const { callControlId } = req.params;

  try {
    await telnyxClient.hangupCall(callControlId);
    
    // Update local status
    const existing = activeCallStatuses.get(callControlId) || {};
    activeCallStatuses.set(callControlId, {
      ...existing,
      status: 'completed',
      endReason: 'agent_hangup',
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, callControlId });
  } catch (error) {
    console.error('Error ending Telnyx call:', error);
    res.status(500).json({ error: 'Failed to end call', message: error.message });
  }
};

/**
 * Get phone numbers
 */
exports.getPhoneNumbers = async (req, res) => {
  try {
    const numbers = await telnyxClient.getPhoneNumbers();
    res.json(numbers);
  } catch (error) {
    console.error('Error fetching Telnyx phone numbers:', error);
    res.status(500).json({ error: 'Failed to fetch phone numbers' });
  }
};

/**
 * Get recordings
 */
exports.getRecordings = async (req, res) => {
  try {
    const recordings = await telnyxClient.getRecordings();
    res.json(recordings);
  } catch (error) {
    console.error('Error fetching Telnyx recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
};

/**
 * Get a specific recording URL by ID
 */
exports.getRecordingUrl = async (req, res) => {
  try {
    const { recordingId } = req.params;
    if (!recordingId) {
      return res.status(400).json({ error: 'Recording ID is required' });
    }
    
    // Try to get the recording URL from Telnyx
    const recordings = await telnyxClient.getRecordings();
    const recording = recordings.find(r => r.id === recordingId);
    
    if (recording && recording.download_urls?.mp3) {
      res.json({ url: recording.download_urls.mp3 });
    } else if (recording && recording.download_urls?.wav) {
      res.json({ url: recording.download_urls.wav });
    } else {
      res.status(404).json({ error: 'Recording not found' });
    }
  } catch (error) {
    console.error('Error fetching recording URL:', error);
    res.status(500).json({ error: 'Failed to fetch recording URL' });
  }
};

/**
 * Get pending inbound calls (waiting for agent to answer)
 */
exports.getPendingInboundCalls = (req, res) => {
  try {
    const calls = [];
    
    for (const [callControlId, callData] of activeCallStatuses.entries()) {
      if (callData.direction === 'incoming' && callData.status === 'waiting_for_agent') {
        calls.push({
          callControlId: callData.callControlId,
          from: callData.from,
          to: callData.to,
          startTime: callData.startTime,
          waitingDuration: Math.floor((Date.now() - new Date(callData.startTime).getTime()) / 1000)
        });
      }
    }
    
    res.json({ success: true, calls });
  } catch (error) {
    console.error('Error getting pending inbound calls:', error);
    res.status(500).json({ error: 'Failed to get pending inbound calls' });
  }
};

/**
 * Answer an inbound call
 */
exports.answerInboundCall = async (req, res) => {
  try {
    const { callControlId } = req.params;
    
    console.log('🟢 Answering inbound call:', callControlId);
    
    const callStatus = activeCallStatuses.get(callControlId);
    if (!callStatus) {
      return res.status(404).json({ error: 'Call not found or already ended' });
    }
    
    // Transfer the call directly to the agent's WebRTC client
    // This will make the call ring on the WebRTC client, which can then answer it
    if (config.telnyx.sipUsername) {
      try {
        const sipUri = `sip:${config.telnyx.sipUsername}@rtc.telnyx.com`;
        console.log('🔄 Transferring inbound call to WebRTC client:', sipUri);
        
        await telnyxClient.transferCall(callControlId, sipUri);
        
        console.log('✅ Call transferred to WebRTC client - agent should now receive ringing notification');
      } catch (transferError) {
        console.error('⚠️ Failed to transfer call to WebRTC client:', transferError);
        console.log('📞 Falling back to direct answer (no WebRTC audio)');
        
        // Fallback: answer the call directly if transfer fails
        await telnyxClient.answerCall(callControlId);
        console.log('📞 Call answered directly (WebRTC transfer failed)');
      }
    } else {
      console.warn('⚠️ No SIP username configured - answering call directly without WebRTC');
      await telnyxClient.answerCall(callControlId);
    }
    
    // Update call status
    callStatus.status = 'answered';
    callStatus.answeredAt = new Date().toISOString();
    callStatus.answeredBy = req.user?.id || 'unknown';
    
    res.json({ 
      success: true, 
      message: 'Call processed successfully',
      callControlId: callControlId,
      from: callStatus.from,
      to: callStatus.to
    });
  } catch (error) {
    console.error('❌ Error processing inbound call:', error);
    res.status(500).json({ error: 'Failed to process call', details: error.message });
  }
};

/**
 * Check if Telnyx is configured
 */
exports.isConfigured = (req, res) => {
  res.json({ configured: telnyxClient.isConfigured() });
};

/**
 * Get pending recording URL for a callControlId (used when logging calls)
 */
exports.getPendingRecording = (callControlId) => {
  const pending = pendingRecordings.get(callControlId);
  if (pending) {
    console.log(`✓ Found pending recording for ${callControlId}`);
    pendingRecordings.delete(callControlId);
    return pending.recordingUrl;
  }
  return null;
};

/**
 * Failover Webhook Handler
 * This endpoint is called by Telnyx when the primary webhook fails
 * It logs the failure and attempts to process the event normally
 */
exports.handleFailoverWebhook = async (req, res) => {
  try {
    const event = req.body;
    const eventType = event.data?.event_type;
    const callControlId = event.data?.payload?.call_control_id;
    
    console.log('🚨 ========== FAILOVER WEBHOOK TRIGGERED ==========');
    console.log('🚨 PRIMARY WEBHOOK FAILED - Using failover');
    console.log('🚨 Event type:', eventType);
    console.log('🚨 Call Control ID:', callControlId);
    console.log('🚨 Timestamp:', new Date().toISOString());
    console.log('🚨 Full event:', JSON.stringify(event, null, 2));

    // Alert: Log to file for monitoring
    const fs = require('fs');
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      callControlId,
      event: event
    };
    
    // Append to failover log file
    try {
      const logPath = '/root/CreativeprocessCaller/logs/webhook_failover.log';
      const logDir = require('path').dirname(logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    } catch (logError) {
      console.error('Failed to write failover log:', logError);
    }

    // Process the event using the same handler as primary webhook
    const payload = event.data?.payload || {};

    switch (eventType) {
      case 'call.initiated':
        await handleCallInitiated(payload);
        break;
      case 'call.answered':
        await handleCallAnswered(payload);
        break;
      case 'call.bridged':
        await handleCallBridged(payload);
        break;
      case 'call.hangup':
        await handleCallHangup(payload);
        break;
      case 'call.recording.saved':
        await handleRecordingSaved(payload);
        break;
      case 'call.machine.detection.ended':
        await handleAMDComplete(payload);
        break;
      case 'call.dtmf.received':
        await handleDTMFReceived(payload);
        break;
      default:
        console.log('🚨 Unhandled failover event type:', eventType);
    }

    // Respond with 200 to acknowledge receipt
    res.status(200).json({ 
      received: true, 
      failover: true,
      message: 'Event processed via failover webhook'
    });

  } catch (error) {
    console.error('🚨 Error in failover webhook handler:', error);
    // Still return 200 to prevent Telnyx from retrying
    res.status(200).json({ 
      received: true, 
      failover: true,
      error: error.message 
    });
  }
};

/**
 * Webhook Health Check
 * Returns the status of the webhook endpoint for monitoring
 */
exports.webhookHealthCheck = (req, res) => {
  const uptime = process.uptime();
  const activeCallsCount = activeCallStatuses.size;
  const pendingRecordingsCount = pendingRecordings.size;
  
  res.status(200).json({
    status: 'healthy',
    service: 'Telnyx Voice Webhook',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    activeCalls: activeCallsCount,
    pendingRecordings: pendingRecordingsCount,
    telnyxConfigured: telnyxClient.isConfigured(),
    endpoints: {
      primary: '/api/telnyx/voice',
      failover: '/api/telnyx/voice/failover',
      health: '/api/telnyx/voice/health'
    }
  });
};
