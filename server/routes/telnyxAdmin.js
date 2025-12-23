/**
 * Telnyx Management API Routes
 * Comprehensive endpoints for managing Telnyx settings from the admin dashboard
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const config = require('../config/config');

const TELNYX_API_URL = 'https://api.telnyx.com/v2';

// Get API key from config
const getApiKey = () => config.telnyx?.apiKey || process.env.TELNYX_API_KEY;

// Helper to make Telnyx API requests
const telnyxRequest = async (endpoint, options = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Telnyx API key not configured');
  }

  const response = await fetch(`${TELNYX_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.errors?.[0]?.detail || error.message || `Telnyx API error: ${response.status}`);
  }

  return response.json();
};

// ==================== STATUS & ACCOUNT ====================

// Check Telnyx configuration status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.json({
        configured: false,
        message: 'Telnyx API key not configured'
      });
    }

    // Verify API key by fetching balance
    const balanceData = await telnyxRequest('/balance');
    
    res.json({
      configured: true,
      balance: {
        balance: balanceData.data?.balance || '0.00',
        currency: balanceData.data?.currency || 'USD',
        creditLimit: balanceData.data?.credit_limit || '0.00',
        availableCredit: balanceData.data?.available_credit || '0.00'
      },
      connectionId: config.telnyx?.connectionId || process.env.TELNYX_CONNECTION_ID,
      callerId: config.telnyx?.callerId || process.env.TELNYX_CALLER_ID
    });
  } catch (error) {
    console.error('Telnyx status check error:', error);
    res.json({
      configured: false,
      error: error.message
    });
  }
});

// Get account balance
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/balance');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PHONE NUMBERS ====================

// Get all phone numbers
router.get('/phone-numbers', authMiddleware, async (req, res) => {
  try {
    const { page_size = 50 } = req.query;
    const data = await telnyxRequest(`/phone_numbers?page[size]=${page_size}`);
    
    const numbers = (data.data || []).map(num => ({
      id: num.id,
      phone_number: num.phone_number,
      status: num.status,
      connection_id: num.connection_id,
      connection_name: num.connection_name,
      billing_group_id: num.billing_group_id,
      emergency_enabled: num.emergency_enabled,
      call_forwarding_enabled: num.call_forwarding_enabled,
      cnam_listing_enabled: num.cnam_listing_enabled,
      call_recording_enabled: num.call_recording?.inbound_call_recording_enabled || false,
      created_at: num.created_at,
      purchased_at: num.purchased_at,
      tags: num.tags || []
    }));

    res.json({
      phoneNumbers: numbers,
      meta: data.meta
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get phone number details
router.get('/phone-numbers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await telnyxRequest(`/phone_numbers/${id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update phone number settings
router.patch('/phone-numbers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await telnyxRequest(`/phone_numbers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MESSAGING ====================

// Get phone numbers with messaging settings
router.get('/messaging/phone-numbers', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/phone_numbers/messaging');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messaging profiles
router.get('/messaging/profiles', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/messaging_profiles');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update phone number messaging settings
router.patch('/messaging/phone-numbers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await telnyxRequest(`/phone_numbers/${id}/messaging`, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONNECTIONS ====================

// Get all connections
router.get('/connections', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/credential_connections');
    
    const connections = (data.data || []).map(conn => ({
      id: conn.id,
      connection_name: conn.connection_name,
      active: conn.active,
      webhook_url: conn.webhook_event_url,
      created_at: conn.created_at,
      updated_at: conn.updated_at,
      sip_uri_calling_preference: conn.sip_uri_calling_preference,
      record_type: conn.record_type
    }));

    res.json({
      connections: connections,
      meta: data.meta
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get connection details
router.get('/connections/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await telnyxRequest(`/credential_connections/${id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update connection settings
router.patch('/connections/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await telnyxRequest(`/credential_connections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CALL CONTROL ====================

// Get outbound voice profiles
router.get('/outbound-voice-profiles', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/outbound_voice_profiles');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get call control applications
router.get('/call-control-applications', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/call_control_applications');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific call control application
router.get('/call-control-applications/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await telnyxRequest(`/call_control_applications/${id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update call control application
router.patch('/call-control-applications/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await telnyxRequest(`/call_control_applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== RECORDINGS ====================

// Get recordings list
router.get('/recordings', authMiddleware, async (req, res) => {
  try {
    const { limit = 25 } = req.query;
    const data = await telnyxRequest(`/recordings?page[size]=${limit}`);
    
    const recordings = (data.data || []).map(rec => ({
      id: rec.id,
      call_leg_id: rec.call_leg_id,
      call_session_id: rec.call_session_id,
      status: rec.status,
      duration_millis: rec.duration_millis,
      download_urls: rec.download_urls,
      channels: rec.channels,
      source: rec.source,
      created_at: rec.created_at
    }));

    res.json({
      recordings: recordings,
      meta: data.meta
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recording details
router.get('/recordings/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await telnyxRequest(`/recordings/${id}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete recording
router.delete('/recordings/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await telnyxRequest(`/recordings/${id}`, { method: 'DELETE' });
    res.json({ success: true, message: 'Recording deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BILLING ====================

// Get billing groups
router.get('/billing-groups', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/billing_groups');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== NUMBER SEARCH & ORDERING ====================

// Search available numbers
router.get('/available-numbers', authMiddleware, async (req, res) => {
  try {
    const { country_code = 'US', locality, area_code, limit = 10 } = req.query;
    let url = `/available_phone_numbers?filter[country_code]=${country_code}&filter[limit]=${limit}`;
    if (locality) url += `&filter[locality]=${locality}`;
    if (area_code) url += `&filter[national_destination_code]=${area_code}`;
    
    const data = await telnyxRequest(url);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Order phone numbers
router.post('/number-orders', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/number_orders', {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get number orders
router.get('/number-orders', authMiddleware, async (req, res) => {
  try {
    const data = await telnyxRequest('/number_orders');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== USAGE & REPORTS ====================

// Get call events (recent calls)
router.get('/call-events', authMiddleware, async (req, res) => {
  try {
    const { page_size = 25, created_at_gte } = req.query;
    let url = `/call_events?page[size]=${page_size}`;
    if (created_at_gte) url += `&filter[created_at][gte]=${created_at_gte}`;
    
    const data = await telnyxRequest(url);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== WEBHOOKS ====================

// Get webhook configurations
router.get('/webhooks', authMiddleware, async (req, res) => {
  try {
    // Webhooks are configured per connection/application
    // Return current configuration from env
    res.json({
      primary: process.env.TELNYX_WEBHOOK_URL || 'https://salescallagent.my/api/telnyx/voice',
      failover: process.env.TELNYX_WEBHOOK_FAILOVER_URL || 'https://salescallagent.my/api/telnyx/voice/failover',
      connectionId: config.telnyx?.connectionId || process.env.TELNYX_CONNECTION_ID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SUMMARY STATS ====================

// Get comprehensive Telnyx statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [balanceRes, numbersRes, connectionsRes, recordingsRes] = await Promise.all([
      telnyxRequest('/balance').catch(() => null),
      telnyxRequest('/phone_numbers?page[size]=100').catch(() => null),
      telnyxRequest('/connections').catch(() => null),
      telnyxRequest('/recordings?page[size]=100').catch(() => null)
    ]);

    res.json({
      balance: balanceRes?.data || null,
      phoneNumbers: {
        total: numbersRes?.data?.length || 0,
        active: numbersRes?.data?.filter(n => n.status === 'active')?.length || 0
      },
      connections: {
        total: connectionsRes?.data?.length || 0
      },
      recordings: {
        total: recordingsRes?.meta?.total_results || recordingsRes?.data?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
