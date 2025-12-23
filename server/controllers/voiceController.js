// Telnyx-only voice controller
const config = require('../config/config');
const telnyxClient = require('../services/telnyxClient');

// Cache for Twilio numbers to avoid repeated API calls
let cachedNumbers = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// In-memory store for active call statuses (in production, use Redis)
const activeCallStatuses = new Map();

// Call end reason mapping from Twilio status
const getCallEndReason = (status, sipResponseCode, answeredBy) => {
  if (answeredBy === 'machine') return 'machine_detected';
  
  switch (status) {
    case 'completed':
      return 'customer_hangup'; // Default assumption, updated by webhook
    case 'busy':
      return 'busy';
    case 'no-answer':
      return 'no_answer';
    case 'failed':
      if (sipResponseCode === 404) return 'invalid_number';
      if (sipResponseCode >= 500) return 'network_error';
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return 'unknown';
  }
};

async function getDefaultCallerId() {
  try {
    // Check if cache is still valid
    if (cachedNumbers && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
      if (cachedNumbers.length > 0) {
        return cachedNumbers[0].phoneNumber;
      }
    }

    // Fetch fresh numbers from Telnyx
    cachedNumbers = await telnyxClient.getPhoneNumbers();
    cacheTimestamp = Date.now();

    if (cachedNumbers.length > 0) {
      console.log('Default Caller ID set to:', cachedNumbers[0].phoneNumber);
      return cachedNumbers[0].phoneNumber;
    }
    
    // Fallback to config
    return config.telnyx.callerId || null;
  } catch (error) {
    console.error('Error getting default Caller ID:', error);
    return config.telnyx.callerId || null;
  }
}

exports.handleTwilioNumbers = async (req, res) => {
  try {
    // Return Telnyx numbers instead
    const numbers = await telnyxClient.getPhoneNumbers();
    cachedNumbers = numbers;
    cacheTimestamp = Date.now();
    res.json(numbers);
  } catch (err) {
    console.error('Error fetching Telnyx numbers:', err);
    res.status(500).json({ error: 'Failed to fetch phone numbers' });
  }
};

exports.handleVoiceRequest = async (req, res) => {
  // Twilio voice requests are disabled - using Telnyx
  console.log('Voice request received but Twilio is disabled (using Telnyx)');
  res.status(501).json({ 
    error: 'Twilio voice is not configured. This system uses Telnyx.',
    provider: 'telnyx' 
  });
};

// Disabled - legacy Twilio voice handling
// All voice functions now use Telnyx

exports.handleCallStatus = async (req, res) => {
  console.log('========== STATUS WEBHOOK RECEIVED (Legacy Twilio - Disabled) ==========');
  console.log('This endpoint is disabled. Use Telnyx webhooks instead.');
  res.sendStatus(200);
};

exports.handleIncomingNumbers = async (req, res) => {
    // Return Telnyx numbers
    try {
        const numbers = await telnyxClient.getPhoneNumbers();
        res.json(numbers);
    } catch (error) {
        console.error('Error fetching Telnyx numbers:', error);
        res.status(500).json({ error: 'Failed to fetch numbers' });
    }
};

// Get real-time call status (Telnyx)
exports.getCallStatus = async (req, res) => {
  const { callSid } = req.params;
  
  if (!callSid) {
    return res.status(400).json({ error: 'callSid/callControlId is required' });
  }
  
  try {
    // Check our in-memory cache (updated by Telnyx webhooks)
    const cachedStatus = activeCallStatuses.get(callSid);
    
    if (cachedStatus) {
      return res.json(cachedStatus);
    }
    
    // If not in cache, return a basic response
    res.status(404).json({ error: 'Call status not found', callSid });
  } catch (error) {
    console.error('Error fetching call status:', error);
    res.status(500).json({ error: 'Failed to fetch call status', message: error.message });
  }
};

// Get all active calls status
exports.getActiveCalls = async (req, res) => {
  try {
    // Return calls from our cache
    const activeCalls = [];
    activeCallStatuses.forEach((status, callSid) => {
      if (status.status === 'in-progress' || status.status === 'ringing') {
        activeCalls.push({
          callSid: callSid,
          status: status.status,
          direction: status.direction,
          from: status.from,
          to: status.to,
          duration: status.duration || 0,
          startTime: status.startTime
        });
      }
    });
    
    res.json(activeCalls);
  } catch (error) {
    console.error('Error fetching active calls:', error);
    res.status(500).json({ error: 'Failed to fetch active calls' });
  }
};

// End a call (hangup from agent side) - Telnyx
exports.endCall = async (req, res) => {
  const { callSid } = req.params;
  
  if (!callSid) {
    return res.status(400).json({ error: 'callSid/callControlId is required' });
  }
  
  try {
    // Update call status in cache
    const cachedStatus = activeCallStatuses.get(callSid);
    if (cachedStatus) {
      cachedStatus.endReason = 'agent_hangup';
      activeCallStatuses.set(callSid, cachedStatus);
    }
    
    // End the call via Telnyx
    await telnyxClient.hangupCall(callSid);
    
    res.json({
      callSid: callSid,
      status: 'completed',
      endReason: 'agent_hangup'
    });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ error: 'Failed to end call', message: error.message });
  }
};

// Get cached call status (from webhook updates - faster than API)
exports.getCachedCallStatus = async (req, res) => {
  const { callSid } = req.params;
  
  const cachedStatus = activeCallStatuses.get(callSid);
  if (cachedStatus) {
    return res.json(cachedStatus);
  }
  
  res.status(404).json({ error: 'Call status not found in cache' });
};

// Get voice provider configuration for frontend
exports.getVoiceConfig = async (req, res) => {
  try {
    const provider = config.voiceProvider || 'twilio';
    
    if (provider === 'telnyx') {
      // Return Telnyx SIP credentials for WebRTC
      res.json({
        provider: 'telnyx',
        telnyx: {
          sipUsername: config.telnyx?.sipUsername || '',
          sipPassword: config.telnyx?.sipPassword || '',
          callerId: config.telnyx?.callerId || '',
          // Don't expose API key or connection ID to frontend
        }
      });
    } else {
      // Return Twilio config indicator (token fetched separately)
      res.json({
        provider: 'twilio',
        twilio: {
          // Token is fetched via /api/token endpoint
        }
      });
    }
  } catch (error) {
    console.error('Error getting voice config:', error);
    res.status(500).json({ error: 'Failed to get voice config' });
  }
};
