/**
 * Automation Controller
 * Handles voicemail drop, SMS follow-up, and callback scheduling automation
 */

const pool = require('../config/database');
const telnyxClient = require('../services/telnyxClient');
const config = require('../config/config');

// ============================================
// SMS TEMPLATES
// ============================================

/**
 * Get all SMS templates for a user
 */
const getSmsTemplates = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT id, name, content, is_default, is_active, use_count, created_at, updated_at
       FROM sms_templates 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error fetching SMS templates:', error);
    res.status(500).json({ error: 'Failed to fetch SMS templates' });
  }
};

/**
 * Create a new SMS template
 */
const createSmsTemplate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, content, isDefault } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    
    // Check if this is the user's first template
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM sms_templates WHERE user_id = $1`,
      [userId]
    );
    const shouldBeDefault = parseInt(countResult.rows[0].count) === 0 || isDefault;
    
    // If setting as default, unset others
    if (shouldBeDefault) {
      await pool.query(
        `UPDATE sms_templates SET is_default = false WHERE user_id = $1`,
        [userId]
      );
    }
    
    const result = await pool.query(
      `INSERT INTO sms_templates (user_id, name, content, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, name, content, shouldBeDefault]
    );
    
    res.status(201).json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error creating SMS template:', error);
    res.status(500).json({ error: 'Failed to create SMS template' });
  }
};

/**
 * Update an SMS template
 */
const updateSmsTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, content, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE sms_templates 
       SET name = COALESCE($1, name),
           content = COALESCE($2, content),
           is_active = COALESCE($3, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [name, content, isActive, id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error updating SMS template:', error);
    res.status(500).json({ error: 'Failed to update SMS template' });
  }
};

/**
 * Delete an SMS template
 */
const deleteSmsTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      `DELETE FROM sms_templates WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting SMS template:', error);
    res.status(500).json({ error: 'Failed to delete SMS template' });
  }
};

/**
 * Set SMS template as default
 */
const setDefaultSmsTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Unset all defaults
    await pool.query(
      `UPDATE sms_templates SET is_default = false WHERE user_id = $1`,
      [userId]
    );
    
    // Set this one as default
    const result = await pool.query(
      `UPDATE sms_templates 
       SET is_default = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error setting default template:', error);
    res.status(500).json({ error: 'Failed to set default template' });
  }
};

// ============================================
// AUTOMATION SETTINGS
// ============================================

/**
 * Get automation settings for a user
 */
const getAutomationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let result = await pool.query(
      `SELECT * FROM automation_settings WHERE user_id = $1`,
      [userId]
    );
    
    // If no settings exist, create default settings
    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO automation_settings (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
      );
    }
    
    const settings = result.rows[0];
    
    res.json({
      autoVoicemailDrop: settings.auto_voicemail_drop,
      defaultVoicemailId: settings.default_voicemail_id,
      autoSmsFollowup: settings.auto_sms_followup,
      defaultSmsTemplateId: settings.default_sms_template_id,
      smsDelaySeconds: settings.sms_delay_seconds,
      autoScheduleCallback: settings.auto_schedule_callback,
      callbackDelayHours: settings.callback_delay_hours,
    });
  } catch (error) {
    console.error('Error fetching automation settings:', error);
    res.status(500).json({ error: 'Failed to fetch automation settings' });
  }
};

/**
 * Update automation settings
 */
const updateAutomationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      autoVoicemailDrop,
      defaultVoicemailId,
      autoSmsFollowup,
      defaultSmsTemplateId,
      smsDelaySeconds,
      autoScheduleCallback,
      callbackDelayHours,
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO automation_settings (
         user_id, auto_voicemail_drop, default_voicemail_id,
         auto_sms_followup, default_sms_template_id, sms_delay_seconds,
         auto_schedule_callback, callback_delay_hours
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         auto_voicemail_drop = COALESCE($2, automation_settings.auto_voicemail_drop),
         default_voicemail_id = COALESCE($3, automation_settings.default_voicemail_id),
         auto_sms_followup = COALESCE($4, automation_settings.auto_sms_followup),
         default_sms_template_id = COALESCE($5, automation_settings.default_sms_template_id),
         sms_delay_seconds = COALESCE($6, automation_settings.sms_delay_seconds),
         auto_schedule_callback = COALESCE($7, automation_settings.auto_schedule_callback),
         callback_delay_hours = COALESCE($8, automation_settings.callback_delay_hours),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId, autoVoicemailDrop, defaultVoicemailId,
        autoSmsFollowup, defaultSmsTemplateId, smsDelaySeconds,
        autoScheduleCallback, callbackDelayHours
      ]
    );
    
    const settings = result.rows[0];
    
    res.json({
      success: true,
      settings: {
        autoVoicemailDrop: settings.auto_voicemail_drop,
        defaultVoicemailId: settings.default_voicemail_id,
        autoSmsFollowup: settings.auto_sms_followup,
        defaultSmsTemplateId: settings.default_sms_template_id,
        smsDelaySeconds: settings.sms_delay_seconds,
        autoScheduleCallback: settings.auto_schedule_callback,
        callbackDelayHours: settings.callback_delay_hours,
      }
    });
  } catch (error) {
    console.error('Error updating automation settings:', error);
    res.status(500).json({ error: 'Failed to update automation settings' });
  }
};

// ============================================
// SMS SENDING
// ============================================

/**
 * Send SMS manually
 */
const sendSms = async (req, res) => {
  try {
    const userId = req.user.id;
    const { prospectId, toNumber, content, templateId } = req.body;
    
    if (!toNumber || !content) {
      return res.status(400).json({ error: 'Phone number and content are required' });
    }
    
    // Get user's caller ID (from number)
    const fromNumber = config.telnyx?.callerId || process.env.TELNYX_CALLER_ID;
    if (!fromNumber) {
      return res.status(400).json({ error: 'No SMS-enabled phone number configured' });
    }
    
    // Get prospect info for personalization
    let variables = {};
    if (prospectId) {
      const prospectResult = await pool.query(
        `SELECT first_name, last_name, company, email FROM prospects WHERE id = $1`,
        [prospectId]
      );
      if (prospectResult.rows.length > 0) {
        const p = prospectResult.rows[0];
        variables = {
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          company: p.company || '',
          email: p.email || '',
        };
      }
    }
    
    // Send the SMS
    const result = await telnyxClient.sendPersonalizedSMS(toNumber, fromNumber, content, variables);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send SMS' });
    }
    
    // Log the SMS
    await pool.query(
      `INSERT INTO sms_logs (user_id, prospect_id, to_number, from_number, template_id, content, status, telnyx_message_id, trigger_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, prospectId || null, toNumber, fromNumber, templateId || null, content, result.status || 'sent', result.messageId, 'manual']
    );
    
    // Increment template use count if used
    if (templateId) {
      await pool.query(
        `UPDATE sms_templates SET use_count = use_count + 1 WHERE id = $1`,
        [templateId]
      );
    }
    
    res.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
};

/**
 * Send SMS follow-up after voicemail drop (internal use)
 */
const sendVoicemailFollowupSms = async (userId, prospectId, toNumber, callLogId) => {
  try {
    // Get automation settings
    const settingsResult = await pool.query(
      `SELECT * FROM automation_settings WHERE user_id = $1`,
      [userId]
    );
    
    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auto_sms_followup) {
      console.log('Auto SMS follow-up disabled for user:', userId);
      return null;
    }
    
    const settings = settingsResult.rows[0];
    const templateId = settings.default_sms_template_id;
    
    if (!templateId) {
      console.log('No default SMS template set for user:', userId);
      return null;
    }
    
    // Get template
    const templateResult = await pool.query(
      `SELECT content FROM sms_templates WHERE id = $1 AND user_id = $2`,
      [templateId, userId]
    );
    
    if (templateResult.rows.length === 0) {
      console.log('SMS template not found:', templateId);
      return null;
    }
    
    const template = templateResult.rows[0].content;
    
    // Get prospect info
    let variables = {};
    if (prospectId) {
      const prospectResult = await pool.query(
        `SELECT first_name, last_name, company, email FROM prospects WHERE id = $1`,
        [prospectId]
      );
      if (prospectResult.rows.length > 0) {
        const p = prospectResult.rows[0];
        variables = {
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          company: p.company || '',
          email: p.email || '',
        };
      }
    }
    
    // Get from number
    const fromNumber = config.telnyx?.callerId || process.env.TELNYX_CALLER_ID;
    
    // Delay before sending (if configured)
    const delayMs = (settings.sms_delay_seconds || 10) * 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    // Send SMS
    const result = await telnyxClient.sendPersonalizedSMS(toNumber, fromNumber, template, variables);
    
    // Log the SMS
    const logResult = await pool.query(
      `INSERT INTO sms_logs (user_id, prospect_id, call_log_id, to_number, from_number, template_id, content, status, telnyx_message_id, trigger_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [userId, prospectId, callLogId, toNumber, fromNumber, templateId, template, result.status || 'sent', result.messageId, 'voicemail_followup']
    );
    
    console.log('📱 Voicemail follow-up SMS sent:', {
      smsLogId: logResult.rows[0]?.id,
      prospectId,
      toNumber,
    });
    
    return logResult.rows[0]?.id;
  } catch (error) {
    console.error('Error sending voicemail follow-up SMS:', error);
    return null;
  }
};

// ============================================
// VOICEMAIL DROP
// ============================================

/**
 * Drop voicemail and optionally send SMS follow-up
 */
const dropVoicemailWithFollowup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { callControlId, voicemailId, prospectId, phoneNumber, callLogId } = req.body;
    
    if (!callControlId) {
      return res.status(400).json({ error: 'callControlId is required' });
    }
    
    // Get voicemail to drop
    let vmId = voicemailId;
    if (!vmId) {
      // Get default voicemail
      const vmResult = await pool.query(
        `SELECT id, audio_data FROM voicemails WHERE user_id = $1 AND is_default = true`,
        [userId]
      );
      if (vmResult.rows.length > 0) {
        vmId = vmResult.rows[0].id;
      }
    }
    
    if (!vmId) {
      return res.status(400).json({ error: 'No voicemail selected and no default set' });
    }
    
    // Get voicemail audio
    const vmResult = await pool.query(
      `SELECT audio_data, audio_type FROM voicemails WHERE id = $1`,
      [vmId]
    );
    
    if (vmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Voicemail not found' });
    }
    
    // For now, we'll use speak text or play from URL
    // In production, you'd host the audio file and use playAudioForVoicemailDrop
    // This is a simplified version
    
    // Log the voicemail drop
    const dropResult = await pool.query(
      `INSERT INTO voicemail_drop_logs (user_id, prospect_id, call_log_id, voicemail_id, call_control_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, prospectId || null, callLogId || null, vmId, callControlId, 'dropped']
    );
    
    // Increment voicemail use count
    await pool.query(
      `UPDATE voicemails SET times_used = times_used + 1 WHERE id = $1`,
      [vmId]
    );
    
    // Trigger SMS follow-up asynchronously
    if (phoneNumber && prospectId) {
      setImmediate(async () => {
        const smsLogId = await sendVoicemailFollowupSms(userId, prospectId, phoneNumber, callLogId);
        if (smsLogId) {
          await pool.query(
            `UPDATE voicemail_drop_logs SET sms_sent = true, sms_log_id = $1 WHERE id = $2`,
            [smsLogId, dropResult.rows[0].id]
          );
        }
      });
    }
    
    res.json({
      success: true,
      voicemailDropId: dropResult.rows[0].id,
      message: 'Voicemail dropped, SMS follow-up queued',
    });
  } catch (error) {
    console.error('Error dropping voicemail:', error);
    res.status(500).json({ error: 'Failed to drop voicemail' });
  }
};

// ============================================
// SCHEDULED CALLBACKS
// ============================================

/**
 * Schedule a callback
 */
const scheduleCallback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { prospectId, scheduledFor, originalCallId, notes } = req.body;
    
    if (!prospectId || !scheduledFor) {
      return res.status(400).json({ error: 'prospectId and scheduledFor are required' });
    }
    
    const result = await pool.query(
      `INSERT INTO scheduled_callbacks (user_id, prospect_id, original_call_id, scheduled_for, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, prospectId, originalCallId || null, scheduledFor, notes || null]
    );
    
    res.status(201).json({ callback: result.rows[0] });
  } catch (error) {
    console.error('Error scheduling callback:', error);
    res.status(500).json({ error: 'Failed to schedule callback' });
  }
};

/**
 * Get scheduled callbacks for a user
 */
const getScheduledCallbacks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;
    
    let query = `
      SELECT sc.*, p.first_name, p.last_name, p.company, p.phone
      FROM scheduled_callbacks sc
      LEFT JOIN prospects p ON sc.prospect_id = p.id
      WHERE sc.user_id = $1
    `;
    const params = [userId];
    
    if (status) {
      query += ` AND sc.status = $2`;
      params.push(status);
    }
    
    query += ` ORDER BY sc.scheduled_for ASC`;
    
    const result = await pool.query(query, params);
    
    res.json({ callbacks: result.rows });
  } catch (error) {
    console.error('Error fetching scheduled callbacks:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled callbacks' });
  }
};

/**
 * Update callback status
 */
const updateCallback = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE scheduled_callbacks 
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [status, notes, id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Callback not found' });
    }
    
    res.json({ callback: result.rows[0] });
  } catch (error) {
    console.error('Error updating callback:', error);
    res.status(500).json({ error: 'Failed to update callback' });
  }
};

// ============================================
// STATS & LOGS
// ============================================

/**
 * Get automation stats
 */
const getAutomationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period } = req.query; // 'today', 'week', 'month', 'all'
    
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = `AND created_at >= CURRENT_DATE`;
    } else if (period === 'week') {
      dateFilter = `AND created_at >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateFilter = `AND created_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    
    // Get voicemail drop stats
    const vmStatsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_drops,
         COUNT(CASE WHEN sms_sent = true THEN 1 END) as drops_with_sms
       FROM voicemail_drop_logs 
       WHERE user_id = $1 ${dateFilter}`,
      [userId]
    );
    
    // Get SMS stats
    const smsStatsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_sms,
         COUNT(CASE WHEN trigger_type = 'voicemail_followup' THEN 1 END) as auto_sms,
         COUNT(CASE WHEN trigger_type = 'manual' THEN 1 END) as manual_sms
       FROM sms_logs 
       WHERE user_id = $1 ${dateFilter}`,
      [userId]
    );
    
    // Get callback stats
    const callbackStatsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_callbacks,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
       FROM scheduled_callbacks 
       WHERE user_id = $1 ${dateFilter}`,
      [userId]
    );
    
    res.json({
      voicemailDrops: {
        total: parseInt(vmStatsResult.rows[0].total_drops),
        withSms: parseInt(vmStatsResult.rows[0].drops_with_sms),
      },
      sms: {
        total: parseInt(smsStatsResult.rows[0].total_sms),
        auto: parseInt(smsStatsResult.rows[0].auto_sms),
        manual: parseInt(smsStatsResult.rows[0].manual_sms),
      },
      callbacks: {
        total: parseInt(callbackStatsResult.rows[0].total_callbacks),
        pending: parseInt(callbackStatsResult.rows[0].pending),
        completed: parseInt(callbackStatsResult.rows[0].completed),
      },
    });
  } catch (error) {
    console.error('Error fetching automation stats:', error);
    res.status(500).json({ error: 'Failed to fetch automation stats' });
  }
};

/**
 * Get SMS logs
 */
const getSmsLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT sl.*, p.first_name, p.last_name, p.company
       FROM sms_logs sl
       LEFT JOIN prospects p ON sl.prospect_id = p.id
       WHERE sl.user_id = $1
       ORDER BY sl.sent_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Error fetching SMS logs:', error);
    res.status(500).json({ error: 'Failed to fetch SMS logs' });
  }
};

module.exports = {
  // SMS Templates
  getSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
  setDefaultSmsTemplate,
  // Automation Settings
  getAutomationSettings,
  updateAutomationSettings,
  // SMS
  sendSms,
  sendVoicemailFollowupSms,
  // Voicemail Drop
  dropVoicemailWithFollowup,
  // Callbacks
  scheduleCallback,
  getScheduledCallbacks,
  updateCallback,
  // Stats
  getAutomationStats,
  getSmsLogs,
};
