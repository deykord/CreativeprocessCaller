// Add Twilio Numbers fetcher
const { getTwilioNumbers } = require('../services/twilioNumbers');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const config = require('../config/config');

// Cache for Twilio numbers to avoid repeated API calls
let cachedNumbers = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

    const dial = response.dial({
      callerId: callerId,
      record: 'record-from-answer',
      recordingStatusCallback: `/api/voice/recording`,
      statusCallback: `/api/voice/status`,
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
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const duration = req.body.CallDuration;

  console.log(`Webhook: Call ${callSid} is ${callStatus}`);
  
  // Note: Detailed logging is usually handled by the frontend reporting the outcome 
  // via the /api/calls endpoint after the user selects a disposition.
  // However, this webhook confirms the technical duration/cost.
  
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
