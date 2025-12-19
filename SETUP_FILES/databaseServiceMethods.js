/**
 * DATABASE SERVICE METHODS FOR INBOUND CALLS
 * 
 * Add these methods to your existing databaseService.js file
 */

/**
 * Get pending inbound calls (status = incoming)
 */
async getPendingInboundCalls() {
  try {
    const result = await pool.query(
      `SELECT id, call_control_id, from_number, to_number, status, created_at
       FROM inbound_calls 
       WHERE status = 'incoming' 
       ORDER BY created_at DESC 
       LIMIT 100`
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting pending calls:', error);
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
       ON CONFLICT (call_control_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
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

    // Build dynamic UPDATE SET clause
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    // Add callControlId as last parameter
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

/**
 * Get call history with recording URLs
 */
async getCallHistory(limit = 500) {
  try {
    const result = await pool.query(
      `SELECT cl.*, 
              COALESCE(p.first_name, '') as prospect_first_name,
              COALESCE(p.last_name, '') as prospect_last_name,
              u.first_name as caller_first_name,
              u.last_name as caller_last_name
       FROM call_logs cl
       LEFT JOIN prospects p ON cl.prospect_id = p.id
       LEFT JOIN users u ON cl.caller_id = u.id
       ORDER BY cl.started_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting call history:', error);
    throw error;
  }
}

/**
 * Log a call (for both inbound and outbound)
 */
async createCallLog(callData) {
  try {
    const {
      prospectId,
      callerId,
      phoneNumber,
      fromNumber,
      outcome,
      duration,
      notes,
      callSid,
      recordingUrl,
      direction,
      endReason,
      answeredBy,
      prospectName,
    } = callData;

    const result = await pool.query(
      `INSERT INTO call_logs (
        prospect_id, caller_id, phone_number, from_number, outcome, duration,
        notes, call_sid, recording_url, direction, end_reason, answered_by, prospect_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        prospectId || null,
        callerId || null,
        phoneNumber,
        fromNumber,
        outcome,
        duration || 0,
        notes || null,
        callSid || null,
        recordingUrl || null,
        direction || 'outbound',
        endReason || null,
        answeredBy || null,
        prospectName || null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating call log:', error);
    throw error;
  }
}
