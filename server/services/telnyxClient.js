/**
 * Telnyx Server-Side Client
 * Handles Telnyx API calls for call control, phone numbers, recordings, etc.
 */

const config = require('../config/config');

// Initialize Telnyx client only if API key is available
let telnyx = null;
const apiKey = config.telnyx?.apiKey || process.env.TELNYX_API_KEY;

if (apiKey) {
  const Telnyx = require('telnyx');
  telnyx = Telnyx(apiKey);
  console.log('Telnyx client initialized successfully');
} else {
  console.log('Telnyx not configured - TELNYX_API_KEY not set');
}

/**
 * Check if Telnyx is configured
 */
function isConfigured() {
  return telnyx !== null;
}

/**
 * Ensure Telnyx is configured before making API calls
 */
function ensureConfigured() {
  if (!telnyx) {
    throw new Error('Telnyx is not configured. Please set TELNYX_API_KEY environment variable.');
  }
}

/**
 * Make an outbound call via Telnyx Voice API
 */
async function makeCall(to, from, connectionId, webhookUrl) {
  ensureConfigured();
  try {
    const call = await telnyx.calls.create({
      connection_id: connectionId || config.telnyx?.connectionId,
      to: to,
      from: from || config.telnyx?.callerId,
      webhook_url: webhookUrl || `${config.serverUrl}/api/telnyx/voice`,
      webhook_url_method: 'POST',
      record: 'record-from-answer',
    });
    
    console.log('Telnyx call initiated:', call.data.call_control_id);
    return call.data;
  } catch (error) {
    console.error('Error making Telnyx call:', error);
    throw error;
  }
}

/**
 * Hang up a call
 */
async function hangupCall(callControlId) {
  ensureConfigured();
  try {
    const call = new telnyx.Call({ call_control_id: callControlId });
    await call.hangup();
    console.log('Telnyx call hung up:', callControlId);
    return { success: true };
  } catch (error) {
    console.error('Error hanging up Telnyx call:', error);
    throw error;
  }
}

/**
 * Answer an incoming call
 */
async function answerCall(callControlId, webhookUrl) {
  ensureConfigured();
  try {
    const call = new telnyx.Call({ call_control_id: callControlId });
    await call.answer({
      webhook_url: webhookUrl || `${config.serverUrl}/api/telnyx/voice`,
    });
    console.log('Telnyx call answered:', callControlId);
    return { success: true };
  } catch (error) {
    console.error('Error answering Telnyx call:', error);
    throw error;
  }
}

/**
 * Transfer a call
 */
async function transferCall(callControlId, to) {
  ensureConfigured();
  try {
    const call = new telnyx.Call({ call_control_id: callControlId });
    await call.transfer({ to });
    console.log('Telnyx call transferred:', callControlId, 'to', to);
    return { success: true };
  } catch (error) {
    console.error('Error transferring Telnyx call:', error);
    throw error;
  }
}

/**
 * Start recording a call
 */
async function startRecording(callControlId, channels = 'dual') {
  ensureConfigured();
  try {
    const call = new telnyx.Call({ call_control_id: callControlId });
    await call.record_start({
      channels,
      format: 'mp3',
    });
    console.log('Telnyx recording started:', callControlId);
    return { success: true };
  } catch (error) {
    console.error('Error starting Telnyx recording:', error);
    throw error;
  }
}

/**
 * Stop recording a call
 */
async function stopRecording(callControlId) {
  ensureConfigured();
  try {
    const call = new telnyx.Call({ call_control_id: callControlId });
    await call.record_stop();
    console.log('Telnyx recording stopped:', callControlId);
    return { success: true };
  } catch (error) {
    console.error('Error stopping Telnyx recording:', error);
    throw error;
  }
}

/**
 * Play audio or TTS to a call
 */
async function playAudio(callControlId, audioUrl) {
  ensureConfigured();
  try {
    const call = new telnyx.Call({ call_control_id: callControlId });
    await call.playback_start({
      audio_url: audioUrl,
    });
    console.log('Telnyx audio playback started:', callControlId);
    return { success: true };
  } catch (error) {
    console.error('Error playing audio on Telnyx call:', error);
    throw error;
  }
}

/**
 * Speak text (TTS) on a call
 */
async function speakText(callControlId, text, voice = 'female', language = 'en-US') {
  ensureConfigured();
  try {
    const call = new telnyx.Call({ call_control_id: callControlId });
    await call.speak({
      payload: text,
      voice,
      language,
    });
    console.log('Telnyx TTS started:', callControlId);
    return { success: true };
  } catch (error) {
    console.error('Error speaking on Telnyx call:', error);
    throw error;
  }
}

/**
 * Send DTMF digits
 */
async function sendDTMF(callControlId, digits) {
  ensureConfigured();
  try {
    const call = new telnyx.Call({ call_control_id: callControlId });
    await call.send_dtmf({
      digits,
    });
    console.log('Telnyx DTMF sent:', callControlId, digits);
    return { success: true };
  } catch (error) {
    console.error('Error sending DTMF on Telnyx call:', error);
    throw error;
  }
}

/**
 * Get available phone numbers from Telnyx account
 */
async function getPhoneNumbers() {
  ensureConfigured();
  try {
    const response = await telnyx.phoneNumbers.list({
      page: { size: 100 },
      filter: { status: 'active' },
    });
    
    return response.data.map(number => ({
      id: number.id,
      phoneNumber: number.phone_number,
      friendlyName: number.phone_number,
      status: number.status,
      connectionId: number.connection_id,
      capabilities: {
        voice: true,
        sms: number.messaging_profile_id ? true : false,
      },
    }));
  } catch (error) {
    console.error('Error fetching Telnyx phone numbers:', error);
    throw error;
  }
}

/**
 * Get call recordings
 */
async function getRecordings(pageSize = 20) {
  ensureConfigured();
  try {
    const response = await telnyx.recordings.list({
      page: { size: pageSize },
    });
    
    return response.data.map(recording => ({
      id: recording.id,
      callControlId: recording.call_control_id,
      callSessionId: recording.call_session_id,
      status: recording.status,
      channels: recording.channels,
      duration: recording.duration_millis ? recording.duration_millis / 1000 : 0,
      createdAt: recording.created_at,
      downloadUrl: recording.download_urls?.mp3,
    }));
  } catch (error) {
    console.error('Error fetching Telnyx recordings:', error);
    throw error;
  }
}

/**
 * Get a specific recording
 */
async function getRecording(recordingId) {
  ensureConfigured();
  try {
    const response = await telnyx.recordings.retrieve(recordingId);
    return {
      id: response.data.id,
      callControlId: response.data.call_control_id,
      status: response.data.status,
      duration: response.data.duration_millis ? response.data.duration_millis / 1000 : 0,
      downloadUrl: response.data.download_urls?.mp3,
    };
  } catch (error) {
    console.error('Error fetching Telnyx recording:', error);
    throw error;
  }
}

/**
 * Get SIP credentials for WebRTC
 */
async function getSIPCredentials() {
  ensureConfigured();
  try {
    const response = await telnyx.credentialConnections.list({
      page: { size: 10 },
    });
    
    return response.data.map(cred => ({
      id: cred.id,
      name: cred.connection_name,
      username: cred.sip_uri_calling_preference,
      active: cred.active,
    }));
  } catch (error) {
    console.error('Error fetching Telnyx SIP credentials:', error);
    throw error;
  }
}

/**
 * Get call details/status
 */
async function getCallStatus(callControlId) {
  // Note: Telnyx doesn't have a direct "get call" API like Twilio
  // Call status is typically tracked via webhooks
  // This is a placeholder - you'd track status in your database
  return {
    callControlId,
    status: 'unknown',
    message: 'Use webhooks to track call status in real-time',
  };
}

module.exports = {
  telnyx,
  makeCall,
  hangupCall,
  answerCall,
  transferCall,
  startRecording,
  stopRecording,
  playAudio,
  speakText,
  sendDTMF,
  getPhoneNumbers,
  getRecordings,
  getRecording,
  getSIPCredentials,
  getCallStatus,
  isConfigured,
};
