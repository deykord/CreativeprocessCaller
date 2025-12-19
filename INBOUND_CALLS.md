# Inbound Call System Setup

## Overview
The inbound call system allows you to receive and answer incoming calls directly in the application when someone calls your Telnyx number (+15878643991).

## How It Works

### 1. Call Detection
When someone calls your number:
- Telnyx sends a webhook event to `/api/telnyx/voice` with `direction: 'incoming'`
- The `handleCallInitiated()` function detects it's an inbound call
- The call details are stored in the `activeInboundCalls` Map with:
  - `callControlId`: Unique identifier for the call
  - `from`: Caller's phone number
  - `to`: Your Telnyx number
  - `startTime`: Timestamp when call was received

### 2. Frontend Notification
The `IncomingCallNotification` component:
- Polls `/api/telnyx/calls/inbound/pending` every 2 seconds
- When a pending call is detected, displays a modal with:
  - Caller's phone number
  - Time of the call
  - Answer and Decline buttons
  - Animated ringing indicator

### 3. Answering the Call
When you click "Answer":
- Frontend sends POST to `/api/telnyx/calls/:callControlId/answer`
- Backend calls `telnyxClient.answerCall(callControlId)`
- Telnyx connects the call
- Call is removed from the pending calls list

### 4. Rejecting the Call
When you click "Decline":
- Frontend sends POST to `/api/telnyx/calls/:callControlId/end`
- Backend calls `telnyxClient.hangupCall(callControlId)`
- Call is terminated
- Call is removed from the pending calls list

## API Endpoints

### GET /api/telnyx/calls/inbound/pending
Returns list of pending inbound calls waiting to be answered.

**Response:**
```json
{
  "success": true,
  "calls": [
    {
      "callControlId": "v3:...",
      "from": "+1234567890",
      "to": "+15878643991",
      "startTime": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### POST /api/telnyx/calls/:callControlId/answer
Answers an incoming call.

**Response:**
```json
{
  "success": true
}
```

### POST /api/telnyx/calls/:callControlId/end
Rejects/ends a call.

**Response:**
```json
{
  "success": true
}
```

## Files Modified

### Backend
1. **server/controllers/telnyxController.js**
   - `handleCallInitiated()`: Detects and stores inbound calls
   - `getPendingInboundCalls()`: Returns pending calls array
   - `answerInboundCall()`: Answers a specific call

2. **server/routes/telnyx.js**
   - Added route: `GET /calls/inbound/pending`
   - Added route: `POST /calls/:callControlId/answer`

3. **server/services/telnyxClient.js**
   - `answerCall()`: Already existed, answers call via Telnyx API

### Frontend
1. **components/IncomingCallNotification.tsx**
   - New component for displaying incoming call modal
   - Polls for pending calls every 2 seconds
   - Handles answer/reject actions

2. **services/BackendAPI.ts**
   - `getPendingInboundCalls()`: Fetch pending calls
   - `answerInboundCall()`: Answer a call
   - Updated `endCall()`: Use Telnyx endpoint

3. **App.tsx**
   - Imported and rendered `IncomingCallNotification` component
   - Component is global (not tied to specific route)

## Next Steps (Optional Enhancements)

### 1. WebRTC Audio Connection
Currently, the call is answered but audio connection needs to be established:
- When call is answered, establish WebRTC session
- Connect to Telnyx client device
- Enable two-way audio

### 2. WebSocket for Real-Time Notifications
Replace polling with WebSocket for instant notifications:
- Set up Socket.io on backend
- Emit 'inbound_call' event when call is detected
- Frontend listens for events instead of polling

### 3. Call Recording
Automatically start recording when inbound call is answered:
- Add recording start in `answerInboundCall()` controller
- Similar to outbound call recording logic

### 4. Call Transfer
Add ability to transfer inbound calls:
- Transfer to another agent
- Transfer to voicemail
- Transfer to external number

### 5. Call Queue
Handle multiple simultaneous inbound calls:
- Show list of waiting calls
- Priority queue management
- Automatic distribution to available agents

## Testing

To test the inbound call system:
1. Call your Telnyx number: +15878643991
2. The incoming call notification should appear in the app within 2 seconds
3. Click "Answer" to accept the call
4. Click "Decline" to reject the call

## Current Status & Known Limitations

### ⚠️ Audio Not Connected (In Progress)
The current implementation successfully:
- ✅ Detects incoming calls via Telnyx webhook
- ✅ Shows notification in the UI
- ✅ Answers the call on Telnyx telephony side
- ❌ **Does NOT establish WebRTC audio connection**

**Why no audio?**
When you answer an inbound call through the Telnyx API (`answerCall()`), it only answers the call on the telephony network. For the agent to actually hear and speak, we need to:

1. **Bridge the call to a SIP/WebRTC endpoint**
   - Option A: Use Telnyx's `bridge` command to connect the call to an agent's registered WebRTC client
   - Option B: Use Telnyx's `transfer` command to send the call to a SIP URI
   
2. **Agent WebRTC Registration**
   - Each agent needs to register with Telnyx WebRTC using SIP credentials
   - The call can then be routed to that registered client
   - This enables two-way audio in the browser

**Recommended Solution:**
Use Telnyx Call Control's `transfer` command to bridge the inbound call to the agent's WebRTC client when they click "Answer":

```javascript
// In answerInboundCall endpoint
await telnyxClient.transferCall(callControlId, {
  to: `sip:${agentUsername}@rtc.telnyx.com` // Agent's SIP URI
});
```

This requires:
1. Agent logs in → Initialize Telnyx WebRTC client with their credentials
2. Inbound call arrives → Shows notification
3. Agent clicks "Answer" → Backend transfers call to agent's SIP URI
4. WebRTC client receives call → Audio connected

## Troubleshooting

### Notification doesn't appear
- Check webhook is configured correctly in Telnyx
- Verify `/api/telnyx/voice` endpoint is receiving webhooks
- Check console logs for "📞 INBOUND CALL DETECTED"
- Verify call direction is set to 'incoming'

### Answer button doesn't work
- Check network tab for POST request to `/answer`
- Verify authentication token is valid
- Check backend logs for errors
- Verify call is still active (not already ended)

### No audio after answering
- **Expected behavior currently** - WebRTC audio bridge not implemented yet
- Call is answered on Telnyx side but not connected to agent
- Need to implement SIP transfer to agent's WebRTC client
- See "Current Status & Known Limitations" above for solution
