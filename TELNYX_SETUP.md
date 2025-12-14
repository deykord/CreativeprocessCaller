# Telnyx Integration Setup Guide

This application supports **dual voice providers**: Twilio (default) and Telnyx. You can switch between them by setting the `VOICE_PROVIDER` environment variable.

---

## Prerequisites

1. **Telnyx Account**: Sign up at [telnyx.com](https://telnyx.com)
2. **Phone Number**: Purchase a phone number with voice capabilities
3. **SIP Connection**: Create a Credential Connection for WebRTC

---

## Step 1: Get Telnyx Credentials

### API Key
1. Go to **Auth** → **API Keys** in Telnyx Portal
2. Create a new API key or use existing one
3. Copy the key (starts with `KEY...`)

### Connection ID
1. Go to **SIP Connections** → **Credential Connections**
2. Create a new Credential Connection:
   - Name: `CreativeProcess WebRTC`
   - Choose **Credential Authentication**
3. Note the **Connection ID** (UUID format)

### SIP Credentials
1. In your Credential Connection, go to **Credentials** tab
2. Create a new credential:
   - **SIP Username**: e.g., `creativeprocess_agent`
   - **SIP Password**: Generate a strong password
3. Save these credentials

### Caller ID
1. Go to **Numbers** → **My Numbers**
2. Copy a phone number you own (E.164 format: `+1XXXXXXXXXX`)

---

## Step 2: Configure Environment Variables

Add to your `.env` file in the project root:

```env
# Voice Provider Selection (default: twilio)
VOICE_PROVIDER=telnyx

# Telnyx Configuration
TELNYX_API_KEY=KEYxxxxxxxxxxxxxxxxxxxxxxxx
TELNYX_CONNECTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TELNYX_CALLER_ID=+11234567890
TELNYX_SIP_USERNAME=your_sip_username
TELNYX_SIP_PASSWORD=your_sip_password
```

---

## Step 3: Configure Webhooks

### Voice Webhook
1. Go to **Messaging** → **Call Control** → **Outbound Voice Profiles**
2. Create or edit a profile
3. Set webhook URL:
   ```
   https://salescallagent.my/api/telnyx/voice
   ```
4. Set webhook method: `POST`
5. Assign this profile to your Connection

### Alternative: Per-Connection Webhooks
1. Go to your Credential Connection
2. Under **Webhooks**, set:
   - **Webhook URL**: `https://salescallagent.my/api/telnyx/voice`
   - **Webhook Method**: `POST`

---

## Step 4: Restart the Backend

After updating your `.env`:

```bash
pm2 restart all
```

Verify Telnyx is configured:
```bash
curl https://salescallagent.my/api/telnyx/configured
```

Expected response:
```json
{"configured": true, "provider": "telnyx"}
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telnyx/configured` | GET | Check if Telnyx is configured |
| `/api/telnyx/numbers` | GET | List available Telnyx phone numbers |
| `/api/telnyx/recordings` | GET | List call recordings |
| `/api/telnyx/calls/active` | GET | Get active call statuses |
| `/api/telnyx/voice` | POST | Telnyx webhook endpoint (receives events) |

---

## Switching Providers

### Use Twilio (Default)
```env
VOICE_PROVIDER=twilio
```

### Use Telnyx
```env
VOICE_PROVIDER=telnyx
```

After changing, restart: `pm2 restart all`

---

## Troubleshooting

### "Telnyx not configured" error
- Check `TELNYX_API_KEY` is set correctly
- Ensure the key has proper permissions

### Calls not connecting
- Verify `TELNYX_CONNECTION_ID` matches your Credential Connection
- Check SIP credentials are correct
- Ensure phone number has outbound voice enabled

### Webhooks not receiving events
- Verify webhook URL is publicly accessible
- Check Telnyx Portal for webhook delivery logs
- Ensure SSL certificate is valid (required for HTTPS)

### No audio
- Check microphone permissions in browser
- Verify SIP credentials match the Credential Connection

---

## Cost Comparison (Approximate)

| Feature | Twilio | Telnyx |
|---------|--------|--------|
| Outbound calls | $0.014/min | $0.007/min |
| Inbound calls | $0.0085/min | $0.0035/min |
| Phone numbers | $1.15/mo | $1.00/mo |
| Recordings | $0.0025/min | $0.003/min |

*Telnyx typically offers 30-50% cost savings on voice.*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   VoiceService.ts                     │   │
│  │           (Unified abstraction layer)                 │   │
│  └─────────────┬─────────────────────┬──────────────────┘   │
│                │                     │                       │
│    ┌───────────▼───────────┐  ┌─────▼────────────────┐      │
│    │  LiveTwilioService.ts │  │  TelnyxService.ts    │      │
│    │  (@twilio/voice-sdk)  │  │  (@telnyx/webrtc)    │      │
│    └───────────────────────┘  └──────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 /api/voice/* (Twilio)                 │   │
│  │                 /api/telnyx/* (Telnyx)                │   │
│  └──────────────────────────────────────────────────────┘   │
│                │                     │                       │
│    ┌───────────▼───────────┐  ┌─────▼────────────────┐      │
│    │   twilioClient.js     │  │  telnyxClient.js     │      │
│    └───────────────────────┘  └──────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

*Last Updated: December 2025*
