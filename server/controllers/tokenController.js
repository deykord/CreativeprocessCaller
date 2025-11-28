const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const config = require('../config/config');

exports.generateToken = (req, res) => {
  try {
    const identity = req.body.identity || `agent_${Math.floor(Math.random() * 1000)}`;

    if (!config.twilio.accountSid || !config.twilio.apiKey || !config.twilio.apiSecret) {
      return res.status(500).json({ error: 'Twilio credentials missing in server config' });
    }

    const accessToken = new AccessToken(
      config.twilio.accountSid,
      config.twilio.apiKey,
      config.twilio.apiSecret,
      { identity: identity }
    );

    const grant = new VoiceGrant({
      outgoingApplicationSid: config.twilio.twimlAppSid,
      incomingAllow: true, // Allow incoming calls to browser
    });

    accessToken.addGrant(grant);

    res.json({
      token: accessToken.toJwt(),
      identity: identity
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
};