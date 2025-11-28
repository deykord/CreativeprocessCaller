const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const config = require('../config/config');

exports.generateToken = (req, res) => {
  try {
    const identity = req.body.identity || `agent_${Math.floor(Math.random() * 1000)}`;

    // Validate all required credentials
    if (!config.twilio.accountSid) {
      console.error('Missing TWILIO_ACCOUNT_SID');
      return res.status(500).json({ error: 'TWILIO_ACCOUNT_SID missing' });
    }
    if (!config.twilio.apiKey) {
      console.error('Missing TWILIO_API_KEY');
      return res.status(500).json({ error: 'TWILIO_API_KEY missing' });
    }
    if (!config.twilio.apiSecret) {
      console.error('Missing TWILIO_API_SECRET');
      return res.status(500).json({ error: 'TWILIO_API_SECRET missing' });
    }
    if (!config.twilio.twimlAppSid) {
      console.error('Missing TWILIO_APP_SID');
      return res.status(500).json({ error: 'TWILIO_APP_SID missing' });
    }

    console.log('Generating token with:');
    console.log('- Account SID:', config.twilio.accountSid);
    console.log('- API Key:', config.twilio.apiKey.substring(0, 5) + '...');
    console.log('- TwiML App SID:', config.twilio.twimlAppSid);

    // Generate AccessToken with extended TTL (24 hours = 86400 seconds)
    const accessToken = new AccessToken(
      config.twilio.accountSid,
      config.twilio.apiKey,
      config.twilio.apiSecret,
      { 
        identity: identity,
        ttl: 3600  // Start with 1 hour TTL for testing
      }
    );

    const grant = new VoiceGrant({
      outgoingApplicationSid: config.twilio.twimlAppSid,
      incomingAllow: true,
    });

    accessToken.addGrant(grant);

    const token = accessToken.toJwt();
    console.log('Token generated successfully for identity:', identity);
    console.log('Token starts with:', token.substring(0, 20) + '...');

    res.json({
      token: token,
      identity: identity,
      ttl: 3600
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token: ' + error.message });
  }
};