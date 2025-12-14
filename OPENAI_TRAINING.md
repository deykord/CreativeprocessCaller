# OpenAI Training Integration

## Overview

The OpenAI integration uses GPT-4o Realtime API to power AI training calls. This allows sales reps to practice their skills with realistic AI-powered prospects.

## Configuration

### Environment Variables

The following environment variable is required in your `.env` file:

```env
OPENAI_API_KEY=sk-proj-...your-key...
```

### API Configuration

Located in `server/config/config.js`:

```javascript
openai: {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-realtime-preview-2024-12-17',
  voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
}
```

## Testing

Run the test script to verify your OpenAI integration:

```bash
node server/test-openai.js
```

Expected output:
- ✅ API Key configured
- ✅ API connection successful
- ✅ Session created successfully

## Usage

### Backend API

#### Start Training Session

```javascript
POST /api/training/sessions/start
Authorization: Bearer <token>

{
  "providerId": "openai",
  "scenarioId": "cold-interested",
  "feedbackOptions": {
    "customInstructions": "Focus on objection handling"
  }
}
```

Response:
```javascript
{
  "id": "training-1234567890",
  "agentId": 1,
  "providerId": "openai",
  "scenarioId": "cold-interested",
  "status": "active",
  "aiSession": {
    "sessionId": "sess_...",
    "clientSecret": "ek_...",
    "expiresAt": 1234567890,
    "instructions": "..."
  }
}
```

#### Test Provider Connection

```javascript
GET /api/training/providers/openai/test
Authorization: Bearer <token>
```

Response:
```javascript
{
  "configured": true,
  "connected": true
}
```

### Frontend Integration

The frontend receives a `clientSecret` that can be used to establish a WebRTC connection:

```javascript
// Connect to OpenAI Realtime API
const pc = new RTCPeerConnection();

// Add audio track
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// Exchange SDP with OpenAI
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const response = await fetch('https://api.openai.com/v1/realtime', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${clientSecret}`,
    'Content-Type': 'application/sdp'
  },
  body: offer.sdp
});

const answer = await response.text();
await pc.setRemoteDescription({ type: 'answer', sdp: answer });
```

## Available Scenarios

The system supports multiple training scenarios with tailored AI responses:

### Cold Call Scenarios
- `cold-interested` - Interested Prospect
- `cold-skeptical` - Skeptical Prospect  
- `cold-busy` - Busy Executive
- `cold-not-interested` - Not Interested

### Gatekeeper Scenarios
- `gk-helpful` - Helpful Gatekeeper
- `gk-blocking` - Blocking Gatekeeper
- `gk-voicemail` - Voicemail Only

### Objection Handling
- `obj-price` - Price Objection
- `obj-timing` - Timing Objection
- `obj-competitor` - Already Have Solution
- `obj-authority` - No Decision Authority
- `obj-stall` - Send Me Info

## Pricing

OpenAI Realtime API costs **$0.06 per minute** of audio.

The system automatically tracks:
- Session duration
- Total cost per session
- Aggregate costs by agent and time period

## Features

### Real-time Voice
- Low-latency bidirectional audio
- Server-side Voice Activity Detection (VAD)
- Automatic turn detection
- 16-bit PCM audio format

### Transcription
- Automatic transcription using Whisper-1
- Both agent and AI responses captured
- Available for review and analysis

### Feedback Generation
- AI analyzes the full conversation
- Scores performance across multiple categories
- Identifies strengths and areas for improvement
- Provides actionable coaching tips

## Architecture

```
Frontend (React/Vite)
  ↓ Start Session Request
Backend (Express/Node.js)
  ↓ Create Session
OpenAI Realtime API
  ↓ Return Client Secret
Frontend
  ↓ WebRTC Connection
OpenAI (Direct connection)
  ↔ Real-time audio exchange
```

## Error Handling

The service includes comprehensive error handling:

- Invalid/missing API key
- API connection failures
- Session creation errors
- Network timeouts
- Quota/billing issues

All errors are logged and returned to the frontend for user notification.

## Security

- API keys stored in environment variables
- Ephemeral session tokens (expire after use)
- No API keys exposed to frontend
- WebRTC connections are encrypted

## Monitoring

Track usage and costs:

```javascript
GET /api/training/costs
Authorization: Bearer <token>
```

Returns:
```javascript
{
  "today": 2.40,
  "thisWeek": 15.30,
  "thisMonth": 48.60,
  "allTime": 156.90,
  "byProvider": {
    "openai": 48.60
  },
  "byAgent": {
    "1": 24.30,
    "2": 24.30
  }
}
```

## Next Steps

1. ✅ OpenAI integration configured
2. 🔄 Test first training call from frontend
3. ⏭️ Add feedback analysis with GPT-4
4. ⏭️ Implement call recording/playback
5. ⏭️ Add additional providers (ElevenLabs, Vapi, etc.)
