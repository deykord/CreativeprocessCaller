const pool = require('../config/database');

// Helper to convert row to camelCase
const formatVoicemail = (row) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  description: row.description || '',
  audioData: row.audio_data,
  audioType: row.audio_type,
  duration: row.duration || 0,
  isDefault: row.is_default || false,
  usageCount: row.times_used || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Get all voicemails for the current user
const getVoicemails = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT id, user_id, name, description, audio_data, audio_type, duration, is_default, times_used, created_at, updated_at
       FROM voicemails 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    
    res.json({ voicemails: result.rows.map(formatVoicemail) });
  } catch (error) {
    console.error('Error fetching voicemails:', error);
    res.status(500).json({ error: 'Failed to fetch voicemails' });
  }
};

// Get a single voicemail with audio data
const getVoicemail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT * FROM voicemails WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voicemail not found' });
    }
    
    res.json({ voicemail: formatVoicemail(result.rows[0]) });
  } catch (error) {
    console.error('Error fetching voicemail:', error);
    res.status(500).json({ error: 'Failed to fetch voicemail' });
  }
};

// Create a new voicemail
const createVoicemail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, audioData, duration } = req.body;
    
    if (!name || !audioData) {
      return res.status(400).json({ error: 'Name and audio data are required' });
    }
    
    // Check if this is the user's first voicemail - if so, make it default
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM voicemails WHERE user_id = $1`,
      [userId]
    );
    const isFirstVoicemail = parseInt(countResult.rows[0].count) === 0;
    
    const result = await pool.query(
      `INSERT INTO voicemails (user_id, name, description, audio_data, audio_type, duration, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, name, description || '', audioData, 'audio/webm', duration || 0, isFirstVoicemail]
    );
    
    res.status(201).json({ voicemail: formatVoicemail(result.rows[0]) });
  } catch (error) {
    console.error('Error creating voicemail:', error);
    res.status(500).json({ error: 'Failed to create voicemail' });
  }
};

// Update a voicemail
const updateVoicemail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, description, audioData, duration } = req.body;
    
    // Check ownership
    const check = await pool.query(
      `SELECT id FROM voicemails WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Voicemail not found' });
    }
    
    const result = await pool.query(
      `UPDATE voicemails 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           audio_data = COALESCE($3, audio_data),
           duration = COALESCE($4, duration),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, description, audioData, duration, id, userId]
    );
    
    res.json({ voicemail: formatVoicemail(result.rows[0]) });
  } catch (error) {
    console.error('Error updating voicemail:', error);
    res.status(500).json({ error: 'Failed to update voicemail' });
  }
};

// Set voicemail as default
const setDefaultVoicemail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check ownership
    const check = await pool.query(
      `SELECT id FROM voicemails WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Voicemail not found' });
    }
    
    // Unset all defaults for this user
    await pool.query(
      `UPDATE voicemails SET is_default = false WHERE user_id = $1`,
      [userId]
    );
    
    // Set this one as default
    const result = await pool.query(
      `UPDATE voicemails 
       SET is_default = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    
    res.json({ voicemail: formatVoicemail(result.rows[0]) });
  } catch (error) {
    console.error('Error setting default voicemail:', error);
    res.status(500).json({ error: 'Failed to set default voicemail' });
  }
};

// Delete a voicemail
const deleteVoicemail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      `DELETE FROM voicemails WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voicemail not found' });
    }
    
    res.json({ success: true, message: 'Voicemail deleted' });
  } catch (error) {
    console.error('Error deleting voicemail:', error);
    res.status(500).json({ error: 'Failed to delete voicemail' });
  }
};

// Drop a voicemail (record that it was used)
const dropVoicemail = async (req, res) => {
  try {
    const { voicemailId, prospectId, callSid } = req.body;
    const userId = req.user.id;
    
    if (!voicemailId || !prospectId) {
      return res.status(400).json({ error: 'voicemailId and prospectId are required' });
    }
    
    // Check ownership and get voicemail
    const voicemail = await pool.query(
      `SELECT id, audio_data, audio_type FROM voicemails WHERE id = $1 AND user_id = $2`,
      [voicemailId, userId]
    );
    
    if (voicemail.rows.length === 0) {
      return res.status(404).json({ error: 'Voicemail not found' });
    }
    
    // Increment usage count
    await pool.query(
      `UPDATE voicemails SET times_used = times_used + 1 WHERE id = $1`,
      [voicemailId]
    );
    
    // Log the drop
    await pool.query(
      `INSERT INTO voicemail_drop_logs (voicemail_id, prospect_id, user_id, call_sid, dropped_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [voicemailId, prospectId, userId, callSid || null]
    );
    
    res.json({ 
      success: true, 
      message: 'Voicemail drop logged'
    });
  } catch (error) {
    console.error('Error dropping voicemail:', error);
    res.status(500).json({ error: 'Failed to log voicemail drop' });
  }
};

// Get voicemail stats for user
const getVoicemailStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get total voicemails and total drops
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM voicemails WHERE user_id = $1`,
      [userId]
    );
    
    const dropResult = await pool.query(
      `SELECT COUNT(*) as total FROM voicemail_drop_logs WHERE user_id = $1`,
      [userId]
    );
    
    // Get recent drops
    const recentDrops = await pool.query(
      `SELECT vdl.dropped_at, v.name as voicemail_name,
              p.first_name || ' ' || p.last_name as prospect_name
       FROM voicemail_drop_logs vdl
       LEFT JOIN voicemails v ON vdl.voicemail_id = v.id
       LEFT JOIN prospects p ON vdl.prospect_id = p.id
       WHERE vdl.user_id = $1
       ORDER BY vdl.dropped_at DESC
       LIMIT 10`,
      [userId]
    );
    
    res.json({
      totalVoicemails: parseInt(countResult.rows[0].total),
      totalDrops: parseInt(dropResult.rows[0].total),
      recentDrops: recentDrops.rows.map(r => ({
        voicemailName: r.voicemail_name,
        prospectName: r.prospect_name,
        droppedAt: r.dropped_at
      }))
    });
  } catch (error) {
    console.error('Error fetching voicemail stats:', error);
    res.status(500).json({ error: 'Failed to fetch voicemail stats' });
  }
};

module.exports = {
  getVoicemails,
  getVoicemail,
  createVoicemail,
  updateVoicemail,
  deleteVoicemail,
  setDefaultVoicemail,
  dropVoicemail,
  getVoicemailStats
};
