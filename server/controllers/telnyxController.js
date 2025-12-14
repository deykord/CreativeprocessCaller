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

  console.log(`Call initiated: ${callControlId}, direction: ${direction}, from: ${from}, to: ${to}`);

  // Store call status
  activeCallStatuses.set(callControlId, {
    callControlId,
    callLegId,
    callSessionId,
    status: 'initiated',
    direction,
    from,
    to,
    startTime: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // For inbound calls, you might want to auto-answer here
  // or send to an IVR, etc.
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

  // Optionally start recording
  // await telnyxClient.startRecording(callControlId);
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

  // Update call status
  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    callControlId,
    status: 'completed',
    hangupCause,
    hangupSource,
    endReason,
    duration,
    endTime: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

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
  const recordingUrl = payload.recording_urls?.mp3;

  console.log(`Recording saved: ${recordingId} for call ${callControlId}`);

  // Update call status with recording info
  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    recordingId,
    recordingUrl,
    updatedAt: new Date().toISOString(),
  });

  // You could also save to database here
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
 * Check if Telnyx is configured
 */
exports.isConfigured = (req, res) => {
  res.json({ configured: telnyxClient.isConfigured() });
};
