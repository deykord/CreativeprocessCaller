const config = require('../config/config');

exports.generateToken = (req, res) => {
  try {
    // Twilio is disabled - using Telnyx only
    console.log('Token generation requested but Twilio is disabled (using Telnyx)');
    return res.status(501).json({ 
      error: 'Twilio is not configured. This system uses Telnyx for voice services.',
      provider: 'telnyx'
    });

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