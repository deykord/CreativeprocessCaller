// Add Twilio Numbers fetcher
const { getTwilioNumbers } = require('../services/twilioNumbers');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const config = require('../config/config');
const { client: twilioClient } = require('../services/twilioClient');

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

    // Fetch fresh numbers
    cachedNumbers = await getTwilioNumbers();
    cacheTimestamp = Date.now();

    if (cachedNumbers.length > 0) {
      console.log('Default Caller ID set to:', cachedNumbers[0].phoneNumber);
      return cachedNumbers[0].phoneNumber;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting default Caller ID:', error);
    return null;
  }
}

exports.handleTwilioNumbers = async (req, res) => {
  try {
    const numbers = await getTwilioNumbers();
    cachedNumbers = numbers;
    cacheTimestamp = Date.now();
    res.json(numbers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Twilio numbers' });
  }
};

exports.handleVoiceRequest = async (req, res) => {
  const To = req.body.To;
  const callIdFromRequest = req.body.callerId; // May be passed from browser
  // const From = req.body.From; 

  const response = new VoiceResponse();

  if (To) {
    // This is an outbound call from the browser to a phone number
    // Priority: 1) callerId from request, 2) env variable, 3) fetch default
    let callerId = callIdFromRequest || config.twilio.callerId;
    
    if (!callerId) {
      callerId = await getDefaultCallerId();
    }
    
    if (!callerId) {
      console.error('ERROR: No Caller ID available (TWILIO_CALLER_ID not set and no phone numbers in account)');
      res.type('text/xml');
      res.send(new VoiceResponse().say('Error: Caller ID is not configured. Please configure Twilio phone numbers.').toString());
      return;
    }

    console.log('Making outbound call with Caller ID:', callerId, 'To:', To);

    // Use absolute URLs for Twilio webhooks
    const serverUrl = config.serverUrl || 'https://salescallagent.my';
    
    const dial = response.dial({
      callerId: callerId,
      record: 'record-from-answer',
      recordingStatusCallback: `${serverUrl}/api/voice/recording`,
      recordingStatusCallbackEvent: ['completed'],
      statusCallback: `${serverUrl}/api/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    // Check if 'To' is a phone number (simple regex for E.164 or US formats)
    if (/^[\d\+\-\(\) ]+$/.test(To)) {
      dial.number(To);
    } else {
      // If it's not a number, assume it's a client name (Agent-to-Agent)
      dial.client(To);
    }
  } else {
    // Inbound call to the Twilio Number
    response.say('Thank you for calling Creative Process IO. Connecting you to an agent.');
    const dial = response.dial();
    dial.client('agent_1'); // Hardcoded for demo, normally dynamic based on availability
  }

  res.type('text/xml');
  res.send(response.toString());
};

exports.handleCallStatus = async (req, res) => {
  const {
    CallSid,
    CallStatus,
    CallDuration,
    From,
    To,
    Direction,
    Timestamp,
    AnsweredBy,
    SipResponseCode,
    CalledVia
  } = req.body;

  console.log(`Webhook: Call ${CallSid} status=${CallStatus}, duration=${CallDuration}, answeredBy=${AnsweredBy}`);
  
  // Determine call end reason
  const endReason = getCallEndReason(CallStatus, parseInt(SipResponseCode) || null, AnsweredBy);
  
  // Store the call status
  const callData = {
    callSid: CallSid,
    status: CallStatus,
    duration: parseInt(CallDuration) || 0,
    from: From,
    to: To,
    direction: Direction?.toLowerCase() || 'outbound',
    timestamp: Timestamp || new Date().toISOString(),
    answeredBy: AnsweredBy || null,
    sipResponseCode: parseInt(SipResponseCode) || null,
    endReason: endReason,
    updatedAt: new Date().toISOString()
  };
  
  activeCallStatuses.set(CallSid, callData);
  
  // Clean up completed calls after 5 minutes
  if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(CallStatus)) {
    setTimeout(() => {
      activeCallStatuses.delete(CallSid);
    }, 5 * 60 * 1000);
  }
  
  res.sendStatus(200);
};

exports.handleIncomingNumbers = async (req, res) => {
    // This endpoint proxies the request to Twilio to list available numbers
    // This allows the frontend to show numbers without exposing keys
    const twilioService = require('../services/twilioClient');
    try {
        const numbers = await twilioService.getIncomingNumbers();
        res.json(numbers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch numbers' });
    }
};

// Get real-time call status from Twilio
exports.getCallStatus = async (req, res) => {
  const { callSid } = req.params;
  
  if (!callSid) {
    return res.status(400).json({ error: 'callSid is required' });
  }
  
  try {
    // First check our in-memory cache (updated by webhooks)
    const cachedStatus = activeCallStatuses.get(callSid);
    
    // Also fetch fresh status from Twilio API
    const call = await twilioClient.calls(callSid).fetch();
    
    const endReason = getCallEndReason(call.status, null, call.answeredBy);
    
    const status = {
      callSid: call.sid,
      status: call.status,
      direction: call.direction,
      from: call.from,
      to: call.to,
      duration: parseInt(call.duration) || 0,
      startTime: call.startTime,
      endTime: call.endTime,
      answeredBy: call.answeredBy || cachedStatus?.answeredBy || null,
      endReason: cachedStatus?.endReason || endReason,
      sipResponseCode: cachedStatus?.sipResponseCode || null,
      price: call.price,
      priceUnit: call.priceUnit
    };
    
    // Update cache with fresh data
    activeCallStatuses.set(callSid, { ...cachedStatus, ...status, updatedAt: new Date().toISOString() });
    
    res.json(status);
  } catch (error) {
    console.error('Error fetching call status:', error);
    
    // If Twilio API fails, return cached status if available
    const cachedStatus = activeCallStatuses.get(callSid);
    if (cachedStatus) {
      return res.json(cachedStatus);
    }
    
    res.status(500).json({ error: 'Failed to fetch call status', message: error.message });
  }
};

// Get all active calls status
exports.getActiveCalls = async (req, res) => {
  try {
    // Fetch active calls from Twilio
    const calls = await twilioClient.calls.list({
      status: 'in-progress',
      limit: 50
    });
    
    const activeCalls = calls.map(call => ({
      callSid: call.sid,
      status: call.status,
      direction: call.direction,
      from: call.from,
      to: call.to,
      duration: parseInt(call.duration) || 0,
      startTime: call.startTime,
      answeredBy: call.answeredBy || null
    }));
    
    res.json(activeCalls);
  } catch (error) {
    console.error('Error fetching active calls:', error);
    res.status(500).json({ error: 'Failed to fetch active calls' });
  }
};

// End a call (hangup from agent side)
exports.endCall = async (req, res) => {
  const { callSid } = req.params;
  
  if (!callSid) {
    return res.status(400).json({ error: 'callSid is required' });
  }
  
  try {
    // Update call status in cache to mark agent hangup
    const cachedStatus = activeCallStatuses.get(callSid);
    if (cachedStatus) {
      cachedStatus.endReason = 'agent_hangup';
      activeCallStatuses.set(callSid, cachedStatus);
    }
    
    // End the call via Twilio API
    const call = await twilioClient.calls(callSid).update({ status: 'completed' });
    
    res.json({
      callSid: call.sid,
      status: call.status,
      endReason: 'agent_hangup',
      duration: parseInt(call.duration) || 0
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
