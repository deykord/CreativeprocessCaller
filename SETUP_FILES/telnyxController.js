/**
 * TELNYX CONTROLLER
 * Handles all Telnyx webhook events and call operations
 * 
 * Installation:
 * 1. Copy to: server/controllers/telnyxController.js
 * 2. Import in routes: const telnyxController = require('../controllers/telnyxController');
 */

const telnyxClient = require('../services/telnyxClient');
const dbService = require('../services/databaseService');
const config = require('../config/config');

// In-memory store for active calls (use Redis in production)
const activeCallStatuses = new Map();

/**
 * Main webhook handler for all Telnyx events
 */
exports.handleWebhook = async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data in webhook' });
    }

    const eventType = data.event_type;
    console.log(`📞 Webhook received: ${eventType}`);

    switch (eventType) {
      case 'call.initiated':
        await handleCallInitiated(data);
        break;
      case 'call.answered':
        await handleCallAnswered(data);
        break;
      case 'call.hangup':
        await handleCallHangup(data);
        break;
      case 'call.recording.saved':
        await handleRecordingSaved(data);
        break;
      default:
        console.log(`⚠️ Unknown event type: ${eventType}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Handle new incoming call
 */
async function handleCallInitiated(data) {
  const callControlId = data.payload.call_control_id;
  const from = data.payload.from;
  const to = data.payload.to;

  console.log(`📞 Inbound call from ${from} to ${to}`);

  // Store in memory
  activeCallStatuses.set(callControlId, {
    status: 'incoming',
    from,
    to,
    callControlId,
    createdAt: new Date().toISOString(),
  });

  // Save to database
  try {
    await dbService.createInboundCall({
      call_control_id: callControlId,
      from_number: from,
      to_number: to,
      status: 'incoming',
    });
    console.log('✓ Inbound call saved to database');
  } catch (error) {
    console.warn('⚠️ Failed to save to database:', error.message);
  }

  // Start recording immediately
  try {
    await telnyxClient.startRecording(callControlId, 'dual');
    console.log('✓ Recording started');
  } catch (error) {
    console.warn('⚠️ Failed to start recording:', error.message);
  }
}

/**
 * Handle call answered
 */
async function handleCallAnswered(data) {
  const callControlId = data.payload.call_control_id;

  console.log(`✓ Call answered: ${callControlId}`);

  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    status: 'answered',
    answeredAt: new Date().toISOString(),
  });

  try {
    await dbService.updateInboundCall(callControlId, {
      status: 'answered',
      answered_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('⚠️ Failed to update call status:', error.message);
  }
}

/**
 * Handle call hangup
 */
async function handleCallHangup(data) {
  const callControlId = data.payload.call_control_id;

  console.log(`🔴 Call hung up: ${callControlId}`);

  try {
    await dbService.updateInboundCall(callControlId, {
      status: 'ended',
      ended_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('⚠️ Failed to update hangup:', error.message);
  }

  // Remove from memory after 5 minutes
  setTimeout(() => {
    activeCallStatuses.delete(callControlId);
  }, 5 * 60 * 1000);
}

/**
 * Handle recording saved
 */
async function handleRecordingSaved(data) {
  const callControlId = data.payload.call_control_id;
  const recordingUrl = data.payload.recording_urls?.mp3;

  console.log(`📼 Recording saved for call ${callControlId}`);

  if (recordingUrl) {
    try {
      await dbService.updateInboundCall(callControlId, {
        recording_url: recordingUrl,
      });
      console.log('✓ Recording URL saved');
    } catch (error) {
      console.warn('⚠️ Failed to save recording:', error.message);
    }
  }
}

/**
 * Get all pending (unanswered) inbound calls
 */
exports.getPendingInboundCalls = async (req, res) => {
  try {
    const calls = await dbService.getPendingInboundCalls();
    res.json({ success: true, calls });
  } catch (error) {
    console.error('Error getting pending calls:', error);
    res.status(500).json({ error: 'Failed to get pending calls' });
  }
};

/**
 * Answer an inbound call
 */
exports.answerInboundCall = async (req, res) => {
  try {
    const { callControlId } = req.params;
    
    console.log('🟢 Answering call:', callControlId);
    
    const callStatus = activeCallStatuses.get(callControlId);
    if (!callStatus) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    // Try to transfer to WebRTC client
    if (config.telnyx.sipUsername) {
      try {
        const sipUri = `sip:${config.telnyx.sipUsername}@${config.telnyx.sipServer}`;
        console.log('🔄 Transferring to WebRTC:', sipUri);
        
        await telnyxClient.transferCall(callControlId, sipUri);
        console.log('✅ Transferred to WebRTC client');
      } catch (transferError) {
        console.warn('⚠️ Transfer failed, answering directly');
        await telnyxClient.answerCall(callControlId);
      }
    } else {
      await telnyxClient.answerCall(callControlId);
    }
    
    // Update status
    const updated = activeCallStatuses.get(callControlId) || {};
    activeCallStatuses.set(callControlId, {
      ...updated,
      status: 'answered',
      answeredAt: new Date().toISOString(),
      answeredBy: req.user?.id || 'unknown',
    });

    res.json({ 
      success: true, 
      message: 'Call answered',
      callControlId,
    });
  } catch (error) {
    console.error('Error answering call:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * End an inbound call
 */
exports.endInboundCall = async (req, res) => {
  try {
    const { callControlId } = req.params;
    
    console.log('🔴 Ending call:', callControlId);
    
    await telnyxClient.hangupCall(callControlId);

    res.json({ success: true, message: 'Call ended' });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ error: error.message });
  }
};
