/**
 * Telnyx API Client
 * Handle all Telnyx REST API calls for inbound/outbound call control
 * 
 * Installation:
 * 1. Copy this file to: server/services/telnyxClient.js
 * 2. Update .env with Telnyx credentials
 * 3. Require in controller: const telnyxClient = require('../services/telnyxClient');
 */

const https = require('https');
const config = require('../config/config');

const apiKey = config.telnyx.apiKey;

function ensureConfigured() {
  if (!apiKey) {
    throw new Error('Telnyx API key not configured. Set TELNYX_API_KEY in .env');
  }
}

/**
 * Answer an inbound call
 * @param {string} callControlId - The call control ID from webhook
 */
async function answerCall(callControlId) {
  ensureConfigured();
  try {
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`;
    
    const postData = JSON.stringify({});

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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('✓ Call answered:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Error answering call:', error);
    throw error;
  }
}

/**
 * Transfer a call to a SIP URI (for WebRTC client)
 * @param {string} callControlId - The call control ID
 * @param {string} sipUri - SIP URI to transfer to (e.g., sip:username@rtc.telnyx.com)
 */
async function transferCall(callControlId, sipUri) {
  ensureConfigured();
  try {
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`;
    
    const postData = JSON.stringify({ to: sipUri });

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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('✓ Call transferred to:', sipUri);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Error transferring call:', error);
    throw error;
  }
}

/**
 * Reject/hangup a call
 * @param {string} callControlId - The call control ID
 */
async function hangupCall(callControlId) {
  ensureConfigured();
  try {
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`;
    
    const postData = JSON.stringify({});

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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('✓ Call hung up:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Error hanging up call:', error);
    throw error;
  }
}

/**
 * Start recording a call
 * @param {string} callControlId - The call control ID
 * @param {string} channels - 'single' or 'dual' (default: 'dual')
 */
async function startRecording(callControlId, channels = 'dual') {
  ensureConfigured();
  try {
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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('✓ Recording started:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
}

/**
 * Stop recording a call
 * @param {string} callControlId - The call control ID
 */
async function stopRecording(callControlId) {
  ensureConfigured();
  try {
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/record_stop`;
    
    const postData = JSON.stringify({});

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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('✓ Recording stopped:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Error stopping recording:', error);
    throw error;
  }
}

/**
 * Put a call on hold
 * @param {string} callControlId - The call control ID
 */
async function holdCall(callControlId) {
  ensureConfigured();
  try {
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/hold`;
    
    const postData = JSON.stringify({});

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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('✓ Call held:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Error holding call:', error);
    throw error;
  }
}

/**
 * Resume a held call
 * @param {string} callControlId - The call control ID
 */
async function unholdCall(callControlId) {
  ensureConfigured();
  try {
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/unhold`;
    
    const postData = JSON.stringify({});

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
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('✓ Call resumed:', callControlId);
            resolve({ success: true, data: response });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Error resuming call:', error);
    throw error;
  }
}

module.exports = {
  answerCall,
  transferCall,
  hangupCall,
  startRecording,
  stopRecording,
  holdCall,
  unholdCall,
};
