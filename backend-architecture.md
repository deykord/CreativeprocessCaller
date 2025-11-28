# VelocityDialer Backend Architecture & Implementation Guide

This document outlines the backend requirements to make the React frontend fully functional with real telephony.

## 1. High-Level Architecture

The system uses a standard client-server architecture with Twilio as the telephony provider.

*   **Frontend (React):** 
    *   Uses `@twilio/voice-sdk` to turn the browser into a softphone.
    *   Fetches ephemeral access tokens from the backend.
    *   Sends call instructions to Twilio via the backend.
*   **Backend (Node.js/Express):**
    *   **Auth Service:** Generates Twilio Capability Tokens (JWTs) for the frontend.
    *   **Voice Endpoint (/voice):** A webhook that returns TwiML (Twilio Markup Language) instructions when the browser initiates a call.
    *   **Database:** Stores Prospect data and Call Logs (PostgreSQL or MongoDB recommended).
*   **Twilio Cloud:**
    *   Handles PSTN connectivity.
    *   Executes TwiML instructions.
    *   Manages phone numbers.

## 2. Prerequisites
1.  **Twilio Account:** Sign up at twilio.com.
2.  **Phone Number:** Buy a voice-capable number.
3.  **TwiML App:** Create a TwiML App in the Twilio Console. This acts as a container for your Voice Request URL.

## 3. Implementation Code Snippets

### A. Setup
Install dependencies:
```bash
npm install express twilio dotenv cors
```

### B. Access Token Generation (POST /api/token)
The frontend needs this token to initialize the `Device`.

```javascript
// server.js
const express = require('express');
const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(express.json());

app.post('/api/token', (req, res) => {
  const identity = req.body.identity || 'agent_1';

  const accessToken = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity: identity }
  );

  const grant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: true, // Allow incoming calls to browser
  });

  accessToken.addGrant(grant);

  res.send({
    token: accessToken.toJwt(),
    identity: identity
  });
});
```

### C. Voice Logic / TwiML (POST /api/voice)
When the browser initiates a call, Twilio hits this webhook to ask "What do I do?".

```javascript
const VoiceResponse = require('twilio').twiml.VoiceResponse;

app.post('/api/voice', (req, res) => {
  const To = req.body.To;
  const response = new VoiceResponse();

  if (To) {
    // This is an outbound call to a prospect
    const dial = response.dial({
      callerId: process.env.TWILIO_CALLER_ID, // Your purchased Twilio Number
      record: 'record-from-answer', // Enable call recording
      statusCallback: '/api/call-status', // Webhook for call events
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });
    
    // Check if we are calling a client browser or a real phone number
    // For this example, we assume PSTN (real phone)
    dial.number(To);
  } else {
    response.say('Thanks for using Velocity Dialer.');
  }

  res.type('text/xml');
  res.send(response.toString());
});
```

## 4. Configuring Twilio

1.  **Buy a Number:** Go to Phone Numbers > Manage > Buy a number.
2.  **Create TwiML App:**
    *   Go to Voice > TwiML > TwiML Apps > Create new TwiML App.
    *   Set the **Voice Request URL** to your backend's public URL: `https://your-server.com/api/voice`.
    *   Save the SID (starts with `AP...`). Put this in your `.env` as `TWILIO_TWIML_APP_SID`.
3.  **Link Number:** Not strictly necessary for outbound-only from browser, but good practice to verify caller ID.

## 5. Deployment Considerations

*   **SSL:** WebRTC (browser calling) *requires* HTTPS.
*   **Websockets:** Ensure your firewall allows outbound UDP traffic on ports required by Twilio (typically 10000-60000) if running on strict corporate networks.
