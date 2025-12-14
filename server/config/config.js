require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  env: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  serverUrl: process.env.SERVER_URL || 'https://salescallagent.my',
  
  // Voice provider: 'twilio' or 'telnyx'
  voiceProvider: process.env.VOICE_PROVIDER || 'twilio',
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKey: process.env.TWILIO_API_KEY,
    apiSecret: process.env.TWILIO_API_SECRET,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    twimlAppSid: process.env.TWILIO_APP_SID,
    callerId: process.env.TWILIO_CALLER_ID,
  },
  
  telnyx: {
    apiKey: process.env.TELNYX_API_KEY,
    apiSecret: process.env.TELNYX_API_SECRET, // V1 API (if needed)
    connectionId: process.env.TELNYX_CONNECTION_ID, // Voice API Application ID
    callerId: process.env.TELNYX_CALLER_ID,
    sipUsername: process.env.TELNYX_SIP_USERNAME, // For WebRTC
    sipPassword: process.env.TELNYX_SIP_PASSWORD, // For WebRTC
  },
  
  // AI Training Providers
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-realtime-preview-2024-12-17', // Latest realtime model
    voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
  },
  
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
  },
  
  vapi: {
    apiKey: process.env.VAPI_API_KEY,
  },
  
  retell: {
    apiKey: process.env.RETELL_API_KEY,
  },
  
  bland: {
    apiKey: process.env.BLAND_API_KEY,
  },
  
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY,
  }
};