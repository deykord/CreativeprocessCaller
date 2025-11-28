const VoiceResponse = require('twilio').twiml.VoiceResponse;
const config = require('../config/config');
const db = require('../services/mockDatabase');

exports.handleVoiceRequest = (req, res) => {
  const To = req.body.To;
  // const From = req.body.From; 

  const response = new VoiceResponse();

  if (To) {
    // This is an outbound call from the browser to a phone number
    const dial = response.dial({
      callerId: config.twilio.callerId,
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
