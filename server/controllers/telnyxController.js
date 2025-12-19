/**
 * Telnyx Voice Webhook Controller
 * Handles Telnyx voice events (call.initiated, call.answered, call.hangup, etc.)
 */

const telnyxClient = require('../services/telnyxClient');
const config = require('../config/config');

// In-memory store for active call statuses (in production, use Redis)
const activeCallStatuses = new Map();

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
    await telnyxClient.startRecording(callControlId, 'dual');
    console.log(`✓ Recording started for call: ${callControlId}`);
  } catch (error) {
    console.error(`✗ Failed to start recording for call ${callControlId}:`, error);
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

  console.log(`Recording saved: ${recordingId} for call ${callControlId}`);
  console.log(`Recording URL: ${recordingUrl}`);

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
        console.warn(`⚠ Call log not found for callControlId ${callControlId}, recording URL not saved to DB`);
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
  const result = payload.result; // 'human', 'machine', 'not_sure'

  console.log(`AMD complete: ${callControlId}, result: ${result}`);

  // Update call status
  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    answeredBy: result,
    updatedAt: new Date().toISOString(),
  });

  // If machine detected, you might want to leave a voicemail
  // if (result === 'machine') {
  //   await telnyxClient.playAudio(callControlId, 'https://yourserver.com/voicemail.mp3');
  // }
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
