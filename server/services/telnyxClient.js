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
    // Use REST API directly to hang up the call
    const https = require('https');
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Telnyx call hung up:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error hanging up Telnyx call:', error);
        reject(error);
      });

      req.end();
    });
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
    // Use REST API directly to answer the call
    const https = require('https');
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`;

    const postData = JSON.stringify({
      webhook_url: webhookUrl || `${config.serverUrl}/api/telnyx/voice`,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Telnyx call answered:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error answering Telnyx call:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
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
    // Use REST API directly to transfer the call
    const https = require('https');
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`;

    const postData = JSON.stringify({ to });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Telnyx call transferred:', callControlId, 'to', to);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error transferring Telnyx call:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
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
    // Use REST API directly to start recording
    const https = require('https');
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/record_start`;

    const postData = JSON.stringify({
      channels,
      format: 'mp3',
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Telnyx recording started:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error starting Telnyx recording:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
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
    // Use REST API directly to stop recording
    const https = require('https');
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/record_stop`;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Telnyx recording stopped:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error stopping Telnyx recording:', error);
        reject(error);
      });

      req.end();
    });
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
    // Use REST API directly to play audio
    const https = require('https');
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/playback_start`;

    const postData = JSON.stringify({
      audio_url: audioUrl,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Telnyx audio playback started:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error playing audio on Telnyx call:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
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
    // Use REST API directly to speak text
    const https = require('https');
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`;

    const postData = JSON.stringify({
      payload: text,
      voice,
      language,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Telnyx TTS started:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error speaking on Telnyx call:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
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
    // Use REST API directly to send DTMF
    const https = require('https');
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/send_dtmf`;

    const postData = JSON.stringify({
      digits,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('Telnyx DTMF sent:', callControlId, digits);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error sending DTMF on Telnyx call:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
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
