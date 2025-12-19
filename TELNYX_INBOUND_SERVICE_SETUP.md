# Telnyx Inbound Call Service Setup Guide

This guide explains how to implement the Telnyx inbound call service on a new Ubuntu system.

## Overview

The inbound call service handles incoming calls via Telnyx WebRTC, stores call data in PostgreSQL, and provides real-time call status updates to the frontend.

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 12+ database
- Telnyx account with SIP credentials
- Frontend app with React/TypeScript support
- Existing Express.js backend

---

## Step 1: Environment Configuration

Add these variables to your `.env` file:

```bash
# Telnyx Configuration
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_SIP_USERNAME=your_sip_username
TELNYX_SIP_PASSWORD=your_sip_password
TELNYX_SIP_SERVER=rtc.telnyx.com
TELNYX_CALLER_ID=+1234567890

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=postgres
DB_PASSWORD=your_password

# API
API_PORT=3001
API_BASE_URL=http://localhost:3001/api
```

---

## Step 2: Database Schema

Run these SQL commands to set up the required tables:

```sql
-- Create call_logs table for storing inbound and outbound call records
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  caller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20),
  from_number VARCHAR(20),
  outcome VARCHAR(100),
  duration INTEGER DEFAULT 0,
  notes TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  call_sid VARCHAR(100) UNIQUE,
  recording_url TEXT,
  direction VARCHAR(20) DEFAULT 'outbound',
  end_reason VARCHAR(100),
  answered_by VARCHAR(50),
  prospect_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id ON call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_prospect_id ON call_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone_number ON call_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_sid ON call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_started ON call_logs(caller_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome ON call_logs(outcome);

-- Create inbound_calls table for tracking active inbound calls
CREATE TABLE IF NOT EXISTS inbound_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_control_id VARCHAR(100) UNIQUE NOT NULL,
  from_number VARCHAR(20),
  to_number VARCHAR(20),
  status VARCHAR(50) DEFAULT 'incoming',
  answered_at TIMESTAMP,
  answered_by UUID REFERENCES users(id),
  ended_at TIMESTAMP,
  direction VARCHAR(20) DEFAULT 'inbound',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbound_calls_control_id ON inbound_calls(call_control_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_from_number ON inbound_calls(from_number);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_status ON inbound_calls(status);

ANALYZE;
```

---

## Step 3: Backend Service Files

### 3.1 Telnyx Service (server/services/telnyxClient.js)

```javascript
/**
 * Telnyx API Client
 * Handles all Telnyx API operations for call control, recordings, etc.
 */

const https = require('https');
const config = require('../config/config');

const apiKey = config.telnyx.apiKey;

function ensureConfigured() {
  if (!apiKey) {
    throw new Error('Telnyx API key not configured');
  }
}

/**
 * Answer an inbound call
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
        res.on('data', (chunk) => {
          data += chunk;
        });
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
 * Transfer a call to a SIP URI (WebRTC client)
 */
async function transferCall(callControlId, sipUri) {
  ensureConfigured();
  try {
    const url = `https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`;
    
    const postData = JSON.stringify({
      to: sipUri,
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
        res.on('data', (chunk) => {
          data += chunk;
        });
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
        res.on('data', (chunk) => {
          data += chunk;
        });
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

module.exports = {
  answerCall,
  transferCall,
  hangupCall,
  startRecording,
};
```

### 3.2 Telnyx Controller (server/controllers/telnyxController.js)

```javascript
/**
 * Telnyx Controller
 * Handles inbound call webhooks and call operations
 */

const telnyxClient = require('../services/telnyxClient');
const dbService = require('../services/databaseService');
const config = require('../config/config');

// Store active call statuses in memory (use Redis in production)
const activeCallStatuses = new Map();

/**
 * Webhook handler for Telnyx events
 */
exports.handleWebhook = async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data in webhook' });
    }

    const eventType = data.event_type;
    console.log(`📞 Webhook received: ${eventType}`);

    switch (eventType) {
      case 'call.initiated':
        await handleCallInitiated(data);
        break;
      case 'call.answered':
        await handleCallAnswered(data);
        break;
      case 'call.hangup':
        await handleCallHangup(data);
        break;
      case 'call.recording.saved':
        await handleRecordingSaved(data);
        break;
      default:
        console.log(`Unknown event type: ${eventType}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Handle incoming call
 */
async function handleCallInitiated(data) {
  const callControlId = data.payload.call_control_id;
  const from = data.payload.from;
  const to = data.payload.to;

  console.log(`📞 Inbound call from ${from} to ${to}`);

  // Store call status
  activeCallStatuses.set(callControlId, {
    status: 'incoming',
    from,
    to,
    callControlId,
    createdAt: new Date().toISOString(),
  });

  // Save to database
  try {
    await dbService.createInboundCall({
      call_control_id: callControlId,
      from_number: from,
      to_number: to,
      status: 'incoming',
    });
  } catch (error) {
    console.warn('Failed to save inbound call to DB:', error);
  }

  // Start recording immediately
  try {
    await telnyxClient.startRecording(callControlId, 'dual');
    console.log('✓ Recording started for call:', callControlId);
  } catch (error) {
    console.warn('⚠️ Failed to start recording:', error);
  }
}

/**
 * Handle call answer
 */
async function handleCallAnswered(data) {
  const callControlId = data.payload.call_control_id;

  console.log(`📞 Call answered: ${callControlId}`);

  const existing = activeCallStatuses.get(callControlId) || {};
  activeCallStatuses.set(callControlId, {
    ...existing,
    status: 'answered',
    answeredAt: new Date().toISOString(),
  });

  // Update in database
  try {
    await dbService.updateInboundCall(callControlId, {
      status: 'answered',
      answered_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to update inbound call:', error);
  }
}

/**
 * Handle call hangup
 */
async function handleCallHangup(data) {
  const callControlId = data.payload.call_control_id;

  console.log(`📞 Call hung up: ${callControlId}`);

  // Update in database
  try {
    await dbService.updateInboundCall(callControlId, {
      status: 'ended',
      ended_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to update call hangup:', error);
  }

  // Clean up from memory after 5 minutes
  setTimeout(() => {
    activeCallStatuses.delete(callControlId);
  }, 5 * 60 * 1000);
}

/**
 * Handle recording saved
 */
async function handleRecordingSaved(data) {
  const callControlId = data.payload.call_control_id;
  const recordingId = data.payload.recording_id;
  const recordingUrl = data.payload.recording_urls?.mp3;

  console.log(`📼 Recording saved: ${recordingId}`);

  if (recordingUrl) {
    try {
      // Update the inbound call with recording
      await dbService.updateInboundCall(callControlId, {
        recording_url: recordingUrl,
      });
      console.log('✓ Recording URL saved');
    } catch (error) {
      console.warn('Failed to save recording URL:', error);
    }
  }
}

/**
 * Get pending inbound calls (not yet answered)
 */
exports.getPendingInboundCalls = async (req, res) => {
  try {
    const calls = await dbService.getPendingInboundCalls();
    res.json({ success: true, calls });
  } catch (error) {
    console.error('Error getting pending calls:', error);
    res.status(500).json({ error: 'Failed to get pending calls' });
  }
};

/**
 * Answer an inbound call
 */
exports.answerInboundCall = async (req, res) => {
  try {
    const { callControlId } = req.params;
    
    console.log('🟢 Answering inbound call:', callControlId);
    
    const callStatus = activeCallStatuses.get(callControlId);
    if (!callStatus) {
      return res.status(404).json({ error: 'Call not found or already ended' });
    }
    
    // Transfer the call to the agent's WebRTC client
    if (config.telnyx.sipUsername) {
      try {
        const sipUri = `sip:${config.telnyx.sipUsername}@rtc.telnyx.com`;
        console.log('🔄 Transferring call to WebRTC client:', sipUri);
        
        await telnyxClient.transferCall(callControlId, sipUri);
        
        console.log('✅ Call transferred to WebRTC client');
      } catch (transferError) {
        console.error('⚠️ Failed to transfer call:', transferError);
        console.log('📞 Falling back to direct answer');
        
        await telnyxClient.answerCall(callControlId);
      }
    } else {
      console.warn('⚠️ No SIP username configured');
      await telnyxClient.answerCall(callControlId);
    }
    
    // Update call status
    const updated = activeCallStatuses.get(callControlId) || {};
    activeCallStatuses.set(callControlId, {
      ...updated,
      status: 'answered',
      answeredAt: new Date().toISOString(),
      answeredBy: req.user?.id || 'unknown',
    });

    res.json({ 
      success: true, 
      message: 'Call answered',
      callControlId,
    });
  } catch (error) {
    console.error('Error answering call:', error);
    res.status(500).json({ error: 'Failed to answer call' });
  }
};

/**
 * End an inbound call
 */
exports.endInboundCall = async (req, res) => {
  try {
    const { callControlId } = req.params;
    
    console.log('🔴 Ending call:', callControlId);
    
    await telnyxClient.hangupCall(callControlId);

    res.json({ success: true, message: 'Call ended' });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ error: 'Failed to end call' });
  }
};
```

### 3.3 Database Service Methods (add to server/services/databaseService.js)

```javascript
/**
 * Get pending inbound calls (status = incoming)
 */
async getPendingInboundCalls() {
  try {
    const result = await pool.query(
      `SELECT * FROM inbound_calls 
       WHERE status = 'incoming' 
       ORDER BY created_at DESC 
       LIMIT 100`
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting pending inbound calls:', error);
    throw error;
  }
}

/**
 * Create an inbound call record
 */
async createInboundCall(callData) {
  try {
    const {
      call_control_id,
      from_number,
      to_number,
      status,
    } = callData;

    const result = await pool.query(
      `INSERT INTO inbound_calls (call_control_id, from_number, to_number, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [call_control_id, from_number, to_number, status || 'incoming']
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating inbound call:', error);
    throw error;
  }
}

/**
 * Update an inbound call record
 */
async updateInboundCall(callControlId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    values.push(callControlId);

    const query = `
      UPDATE inbound_calls 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE call_control_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating inbound call:', error);
    throw error;
  }
}
```

### 3.4 Routes (server/routes/telnyx.js)

```javascript
const express = require('express');
const router = express.Router();
const telnyxController = require('../controllers/telnyxController');
const authMiddleware = require('../middleware/authMiddleware');

// Webhook endpoint (public, no auth required)
router.post('/webhook', telnyxController.handleWebhook);

// Get pending inbound calls
router.get('/calls/pending', authMiddleware, telnyxController.getPendingInboundCalls);

// Answer a call
router.post('/calls/:callControlId/answer', authMiddleware, telnyxController.answerInboundCall);

// End a call
router.post('/calls/:callControlId/end', authMiddleware, telnyxController.endInboundCall);

module.exports = router;
```

---

## Step 4: Configuration

Update your `server/config/config.js`:

```javascript
module.exports = {
  telnyx: {
    apiKey: process.env.TELNYX_API_KEY,
    sipUsername: process.env.TELNYX_SIP_USERNAME,
    sipPassword: process.env.TELNYX_SIP_PASSWORD,
    sipServer: process.env.TELNYX_SIP_SERVER || 'rtc.telnyx.com',
    callerId: process.env.TELNYX_CALLER_ID,
  },
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
};
```

---

## Step 5: Frontend Integration

### 5.1 React Hook for Inbound Calls

Create `src/hooks/useInboundCalls.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { backendAPI } from '../services/BackendAPI';

interface InboundCall {
  id: string;
  call_control_id: string;
  from_number: string;
  to_number: string;
  status: string;
}

export const useInboundCalls = () => {
  const [incomingCall, setIncomingCall] = useState<InboundCall | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForIncomingCalls = useCallback(async () => {
    try {
      setIsChecking(true);
      const response = await backendAPI.getPendingInboundCalls();
      
      if (response.success && response.calls?.length > 0) {
        setIncomingCall(response.calls[0]);
      } else {
        setIncomingCall(null);
      }
    } catch (error) {
      console.error('Error checking for incoming calls:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Check immediately
    checkForIncomingCalls();

    // Then check every 2 seconds
    const interval = setInterval(checkForIncomingCalls, 2000);

    return () => clearInterval(interval);
  }, [checkForIncomingCalls]);

  const answerCall = async (callControlId: string) => {
    try {
      const response = await backendAPI.answerInboundCall(callControlId);
      if (response.success) {
        setIncomingCall(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error answering call:', error);
      return false;
    }
  };

  return { incomingCall, answerCall, isChecking };
};
```

### 5.2 Backend API Methods (services/BackendAPI.ts)

```typescript
async getPendingInboundCalls(): Promise<{ success: boolean; calls: any[] }> {
  const res = await fetch(`${API_BASE_URL}/telnyx/calls/pending`);
  return res.json();
}

async answerInboundCall(callControlId: string): Promise<{ success: boolean }> {
  const token = localStorage.getItem('authToken');
  const res = await fetch(`${API_BASE_URL}/telnyx/calls/${callControlId}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to answer call: ${res.status}`);
  }
  return res.json();
}

async endInboundCall(callControlId: string): Promise<{ success: boolean }> {
  const token = localStorage.getItem('authToken');
  const res = await fetch(`${API_BASE_URL}/telnyx/calls/${callControlId}/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
    }
  });
  return res.json();
}
```

---

## Step 6: Telnyx Webhook Configuration

1. Log into Telnyx Console: https://portal.telnyx.com
2. Go to **Messaging Profiles** or **Phone Numbers**
3. Set Webhook URL to: `https://yourdomain.com/api/telnyx/webhook`
4. Select events:
   - `call.initiated`
   - `call.answered`
   - `call.hangup`
   - `call.recording.saved`

---

## Step 7: Installation Steps

```bash
# 1. Clone/download your app
cd /path/to/your/app

# 2. Install dependencies (if needed)
npm install

# 3. Copy the service files to your project
cp telnyxClient.js server/services/
cp telnyxController.js server/controllers/
cp telnyx.js server/routes/

# 4. Update your database
psql -U postgres -d your_db_name -f schema.sql

# 5. Update your main app.js/index.js to register routes
const telnyxRoutes = require('./routes/telnyx');
app.use('/api/telnyx', telnyxRoutes);

# 6. Set environment variables
cat >> .env << EOF
TELNYX_API_KEY=your_api_key
TELNYX_SIP_USERNAME=your_sip_user
TELNYX_SIP_PASSWORD=your_sip_password
TELNYX_CALLER_ID=+1234567890
EOF

# 7. Restart your backend
pm2 restart all

# 8. Test webhook
curl -X POST http://localhost:3001/api/telnyx/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "event_type": "call.initiated",
      "payload": {
        "call_control_id": "test-123",
        "from": "+15551234567",
        "to": "+15559876543"
      }
    }
  }'
```

---

## Step 8: Testing

```bash
# Check API endpoint
curl http://localhost:3001/api/telnyx/calls/pending \
  -H "Authorization: Bearer your_auth_token"

# Answer a test call (if you have an active call)
curl -X POST http://localhost:3001/api/telnyx/calls/test-123/answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_auth_token"

# Check database
psql -U postgres -d your_db_name -c "SELECT * FROM inbound_calls;"
```

---

## Step 9: Troubleshooting

### Calls not showing up in UI
- Check that webhook is being received: `pm2 logs | grep "Webhook received"`
- Verify Telnyx webhook URL is publicly accessible
- Check firewall/security groups allow inbound traffic

### Recording not saving
- Ensure `call.recording.saved` event is enabled in Telnyx console
- Check CloudWatch logs for recording service events
- Verify S3 bucket permissions if using S3 storage

### WebRTC connection issues
- Verify SIP credentials are correct
- Check that `rtc.telnyx.com` is accessible from your network
- Enable WebRTC debugging in browser console

### Database errors
- Ensure PostgreSQL is running: `systemctl status postgresql`
- Check user has correct permissions: `psql -U postgres -d your_db -c "SELECT 1;"`
- Verify tables were created: `psql -U postgres -d your_db -c "\dt inbound_calls;"`

---

## Step 10: Production Deployment

For production, consider:

1. **Use Redis instead of in-memory Map** for distributed systems:
   ```javascript
   const redis = require('redis');
   const client = redis.createClient();
   // Store activeCallStatuses in Redis instead
   ```

2. **Add error handling and logging**:
   ```javascript
   const winston = require('winston');
   // Set up structured logging
   ```

3. **Add rate limiting**:
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use('/api/telnyx/webhook', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
   ```

4. **Add monitoring and alerting** with datadog or New Relic

5. **Enable SSL/TLS** for webhook endpoint

6. **Add circuit breaker** for external API calls

---

## File Summary

Copy these files to your project:
- `server/services/telnyxClient.js` - Telnyx API client
- `server/controllers/telnyxController.js` - Webhook and call handlers
- `server/routes/telnyx.js` - API routes
- Database schema (SQL) - Create tables and indexes

Update these files:
- `server/config/config.js` - Add Telnyx configuration
- `server/app.js` or `server/index.js` - Register Telnyx routes
- `.env` - Add Telnyx credentials

---

## Support

For Telnyx API documentation: https://developers.telnyx.com/docs/v2/api
For issues contact Telnyx support or check their API reference.

Last updated: December 2025
