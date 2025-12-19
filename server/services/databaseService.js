const pool = require('../config/database');

/**
 * Database service for managing prospects/leads with duplicate prevention
 */
class DatabaseService {
  /**
   * Get all prospects with call information
   */
  async getProspects(filters = {}) {
    try {
      let query = 'SELECT * FROM prospects_with_call_info WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (filters.status) {
        query += ` AND status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      if (filters.assignedTo) {
        query += ` AND id IN (SELECT prospect_id FROM lead_assignments WHERE assigned_to = $${paramCount} AND is_active = true)`;
        params.push(filters.assignedTo);
        paramCount++;
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting prospects:', error);
      throw error;
    }
  }

  /**
   * Get a single prospect by ID
   */
  async getProspectById(id) {
    try {
      const result = await pool.query(
        'SELECT * FROM prospects_with_call_info WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error getting prospect:', error);
      throw error;
    }
  }

  /**
   * Create a new prospect
   */
  async createProspect(prospectData, createdBy = null) {
    try {
      const {
        firstName,
        lastName,
        company,
        title,
        phone,
        email,
        status = 'New',
        timezone,
        notes
      } = prospectData;

      // Check if prospect with this phone already exists
      const existing = await pool.query(
        'SELECT id FROM prospects WHERE phone = $1',
        [phone]
      );

      if (existing.rows.length > 0) {
        throw new Error('Prospect with this phone number already exists');
      }

      const result = await pool.query(
        `INSERT INTO prospects 
        (first_name, last_name, company, title, phone, email, status, timezone, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [firstName, lastName, company, title, phone, email, status, timezone, notes, createdBy]
      );

      const newProspect = result.rows[0];

      // Log prospect creation in activity log
      try {
        await this.logProspectCreation(newProspect.id, createdBy, {
          firstName, lastName, company, title, phone, email, status, timezone
        });
      } catch (logError) {
        console.warn('Failed to log prospect creation:', logError);
      }

      return newProspect;
    } catch (error) {
      console.error('Error creating prospect:', error);
      throw error;
    }
  }

  /**
   * Update prospect and log all changes
   */
  async updateProspect(id, updates, updatedBy = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current prospect data
      const current = await client.query('SELECT * FROM prospects WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        throw new Error('Prospect not found');
      }

      const currentData = current.rows[0];
      const oldStatus = currentData.status;

      // Build update query dynamically
      const fields = [];
      const values = [];
      let paramCount = 1;
      const changedFields = [];

      // Map frontend field names to database field names
      const fieldMapping = {
        firstName: 'first_name',
        lastName: 'last_name',
        company: 'company',
        title: 'title',
        phone: 'phone',
        email: 'email',
        status: 'status',
        timezone: 'timezone',
        notes: 'notes',
        lastCall: 'last_call'
      };

      Object.keys(updates).forEach(key => {
        const dbKey = fieldMapping[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
        const oldValue = currentData[dbKey];
        const newValue = updates[key];
        
        // Track changed fields for activity log
        if (oldValue !== newValue) {
          changedFields.push({ field: key, dbField: dbKey, oldValue, newValue });
        }
        
        fields.push(`${dbKey} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      });

      if (fields.length === 0) {
        await client.query('COMMIT');
        return currentData;
      }

      values.push(id);
      const updateQuery = `
        UPDATE prospects 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      // Log status change if status was updated (legacy table)
      if (updates.status && updates.status !== oldStatus) {
        // Check if updatedBy user exists in DB, if not, set to null
        let validUserId = null;
        if (updatedBy) {
          try {
            const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [updatedBy]);
            if (userCheck.rows.length > 0) {
              validUserId = updatedBy;
            }
          } catch (e) {
            // User doesn't exist, leave as null
          }
        }
        
        await client.query(
          `INSERT INTO prospect_status_log (prospect_id, old_status, new_status, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [id, oldStatus, updates.status, validUserId]
        );
      }

      await client.query('COMMIT');

      // Log all field changes to activity log (after commit so main operation succeeds)
      for (const change of changedFields) {
        try {
          if (change.field === 'status') {
            await this.logStatusChange(id, updatedBy, change.oldValue, change.newValue);
          } else if (change.field === 'notes') {
            await this.logNoteChange(id, updatedBy, change.oldValue, change.newValue);
          } else {
            await this.logFieldUpdate(id, updatedBy, change.field, change.oldValue, change.newValue);
          }
        } catch (logError) {
          console.warn('Failed to log field change:', logError);
        }
      }

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating prospect:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete prospect
   */
  async deleteProspect(id) {
    try {
      const result = await pool.query(
        'DELETE FROM prospects WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting prospect:', error);
      throw error;
    }
  }

  /**
   * Check if a prospect can be called (duplicate prevention)
   */
  async canCallProspect(prospectId, callerId) {
    try {
      const result = await pool.query(
        'SELECT can_call_prospect($1, $2) as result',
        [prospectId, callerId]
      );
      return result.rows[0].result;
    } catch (error) {
      console.error('Error checking if can call prospect:', error);
      throw error;
    }
  }

  /**
   * Start a call (create active call record)
   */
  async startCall(prospectId, callerId, phoneNumber, fromNumber) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if call is allowed
      const canCall = await this.canCallProspect(prospectId, callerId);
      if (!canCall.allowed) {
        throw new Error(canCall.reason);
      }

      // Create active call record
      const activeCall = await client.query(
        `INSERT INTO active_calls (prospect_id, caller_id, phone_number)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [prospectId, callerId, phoneNumber]
      );

      // Create call log
      const callLog = await client.query(
        `INSERT INTO call_logs (prospect_id, caller_id, phone_number, from_number, started_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [prospectId, callerId, phoneNumber, fromNumber]
      );

      await client.query('COMMIT');
      return {
        activeCallId: activeCall.rows[0].id,
        callLogId: callLog.rows[0].id
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error starting call:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * End a call (remove from active calls, update call log)
   */
  async endCall(prospectId, callLogId, outcome, duration, notes, recordingUrl = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove from active calls
      await client.query(
        'DELETE FROM active_calls WHERE prospect_id = $1',
        [prospectId]
      );

      // Update call log
      await client.query(
        `UPDATE call_logs 
         SET outcome = $1, duration = $2, notes = $3, recording_url = $4, ended_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [outcome, duration, notes, recordingUrl, callLogId]
      );

      // Update prospect last_call timestamp
      await client.query(
        'UPDATE prospects SET last_call = CURRENT_TIMESTAMP WHERE id = $1',
        [prospectId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error ending call:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get call history for a prospect
   */
  async getProspectCallHistory(prospectId) {
    try {
      const result = await pool.query(
        `SELECT cl.*, u.first_name as caller_first_name, u.last_name as caller_last_name, u.email as caller_email
         FROM call_logs cl
         LEFT JOIN users u ON cl.caller_id = u.id
         WHERE cl.prospect_id = $1
         ORDER BY cl.started_at DESC`,
        [prospectId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting prospect call history:', error);
      throw error;
    }
  }

  /**
   * Get all call logs for a user
   */
  async getCallLogs(callerId = null, limit = 100) {
    try {
      let query = `
        SELECT cl.*, 
               COALESCE(p.first_name, '') as prospect_first_name, 
               COALESCE(p.last_name, '') as prospect_last_name,
               COALESCE(
                 NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
                 cl.prospect_name,
                 'Unknown'
               ) as resolved_prospect_name,
               u.first_name as caller_first_name,
               u.last_name as caller_last_name
        FROM call_logs cl
        LEFT JOIN prospects p ON cl.prospect_id = p.id
        LEFT JOIN users u ON cl.caller_id = u.id
      `;
      const params = [];

      if (callerId) {
        query += ' WHERE cl.caller_id = $1';
        params.push(callerId);
      }

      query += ' ORDER BY cl.started_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting call logs:', error);
      throw error;
    }
  }

  /**
   * Get prospect status history
   */
  async getProspectStatusHistory(prospectId) {
    try {
      const result = await pool.query(
        `SELECT psl.*, u.first_name as changed_by_first_name, u.last_name as changed_by_last_name
         FROM prospect_status_log psl
         LEFT JOIN users u ON psl.changed_by = u.id
         WHERE psl.prospect_id = $1
         ORDER BY psl.created_at DESC`,
        [prospectId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting status history:', error);
      throw error;
    }
  }

  /**
   * Assign lead to an agent
   */
  async assignLead(prospectId, assignedTo, assignedBy, expiresAt = null) {
    try {
      // Deactivate any existing assignments
      await pool.query(
        'UPDATE lead_assignments SET is_active = false WHERE prospect_id = $1',
        [prospectId]
      );

      // Create new assignment
      const result = await pool.query(
        `INSERT INTO lead_assignments (prospect_id, assigned_to, assigned_by, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (prospect_id, assigned_to) 
         DO UPDATE SET is_active = true, assigned_at = CURRENT_TIMESTAMP, expires_at = $4
         RETURNING *`,
        [prospectId, assignedTo, assignedBy, expiresAt]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error assigning lead:', error);
      throw error;
    }
  }

  /**
   * Get currently active calls
   */
  async getActiveCalls() {
    try {
      const result = await pool.query(
        `SELECT ac.*, 
                p.first_name as prospect_first_name, 
                p.last_name as prospect_last_name,
                p.phone as prospect_phone,
                u.first_name as caller_first_name,
                u.last_name as caller_last_name
         FROM active_calls ac
         LEFT JOIN prospects p ON ac.prospect_id = p.id
         LEFT JOIN users u ON ac.caller_id = u.id
         ORDER BY ac.started_at DESC`
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting active calls:', error);
      throw error;
    }
  }

  /**
   * Initialize database schema
   */
  async initializeSchema() {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Error initializing schema:', error);
      throw error;
    }
  }
  /**
   * Get all call logs (alias for getCallLogs with no filter)
   */
  async getAllCallLogs() {
    return this.getCallLogs(null, 500); // Reduced from 5000 to 500 for better performance
  }

  /**
   * Get unique callers/agents from call logs
   */
  async getUniqueCallers() {
    try {
      const result = await pool.query(`
        SELECT DISTINCT u.id, u.first_name, u.last_name, COUNT(cl.id) as call_count
        FROM call_logs cl
        INNER JOIN users u ON cl.caller_id = u.id
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY call_count DESC
      `);
      return result.rows.map(r => ({
        id: r.id,
        name: `${r.first_name} ${r.last_name}`,
        callCount: parseInt(r.call_count)
      }));
    } catch (error) {
      console.error('Error getting unique callers:', error);
      throw error;
    }
  }

  /**
   * Update call log with recording URL (called from Twilio recording webhook)
   */
  async updateCallLogRecording(callSid, recordingUrl) {
    try {
      const result = await pool.query(
        `UPDATE call_logs 
         SET recording_url = $1
         WHERE call_sid = $2
         RETURNING *`,
        [recordingUrl, callSid]
      );
      
      if (result.rows.length === 0) {
        console.log(`No call log found for CallSid: ${callSid}`);
        return null;
      }
      
      console.log(`Recording URL saved for call ${callSid}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error saving recording URL:', error);
      throw error;
    }
  }

  /**
   * Create a new call log entry
   */
  async createCallLog(callData) {
    try {
      const {
        prospectId,
        userId,
        callerId,
        phoneNumber,
        fromNumber,
        outcome,
        duration,
        notes,
        recordingUrl,
        disposition,
        callSid,
        endReason,
        answeredBy,
        prospectName
      } = callData;

      let actualCallerId = callerId || userId || null;
      
      // Verify caller exists in DB, if not, set to null
      if (actualCallerId) {
        try {
          const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [actualCallerId]);
          if (userCheck.rows.length === 0) {
            console.log(`Caller ID ${actualCallerId} not found in DB, setting to null`);
            actualCallerId = null;
          }
        } catch (e) {
          actualCallerId = null;
        }
      }

      // Determine direction: if fromNumber is provided and different from phoneNumber, it's inbound
      const direction = callData.direction || 
        (fromNumber && fromNumber !== phoneNumber ? 'inbound' : 'outbound');

      const result = await pool.query(
        `INSERT INTO call_logs 
         (prospect_id, caller_id, phone_number, from_number, outcome, duration, notes, recording_url, call_sid, end_reason, answered_by, prospect_name, direction, ended_at, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         RETURNING *`,
        [
          prospectId || null,
          actualCallerId,
          phoneNumber,
          fromNumber,
          outcome || disposition || 'No Answer',
          duration || 0,
          notes || '',
          recordingUrl || null,
          callSid || null,
          endReason || null,
          answeredBy || null,
          prospectName || null,
          direction
        ]
      );

      // Log the call activity with end reason
      if (prospectId) {
        const endReasonText = endReason ? ` (${endReason})` : '';
        await this.logActivity(prospectId, actualCallerId, 'call', 
          `Called prospect - Outcome: ${outcome || disposition || 'No Answer'}${endReasonText}, Duration: ${duration || 0}s`,
          null, outcome || disposition || 'No Answer', null,
          { phoneNumber, fromNumber, duration, outcome: outcome || disposition, notes, callLogId: result.rows[0].id, callSid, endReason, answeredBy }
        );
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error creating call log:', error);
      throw error;
    }
  }

  /**
   * Log an activity for a lead
   */
  async logActivity(prospectId, userId, actionType, description, oldValue = null, newValue = null, fieldName = null, metadata = null) {
    try {
      const result = await pool.query(
        `INSERT INTO lead_activity_log 
         (prospect_id, user_id, action_type, action_description, old_value, new_value, field_name, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [prospectId, userId, actionType, description, oldValue, newValue, fieldName, metadata ? JSON.stringify(metadata) : null]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw - activity logging should not break main operations
      return null;
    }
  }

  /**
   * Get activity log for a prospect
   */
  async getProspectActivityLog(prospectId, limit = 100) {
    try {
      const result = await pool.query(
        `SELECT 
           al.*,
           u.first_name as user_first_name,
           u.last_name as user_last_name,
           u.email as user_email
         FROM lead_activity_log al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.prospect_id = $1
         ORDER BY al.created_at DESC
         LIMIT $2`,
        [prospectId, limit]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting activity log:', error);
      throw error;
    }
  }

  /**
   * Get phone number change history for a prospect
   */
  async getPhoneNumberHistory(prospectId) {
    try {
      const result = await pool.query(
        `SELECT 
           al.*,
           u.first_name as user_first_name,
           u.last_name as user_last_name,
           u.email as user_email
         FROM lead_activity_log al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.prospect_id = $1 
           AND al.action_type = 'field_updated'
           AND al.field_name = 'phone'
         ORDER BY al.created_at DESC`,
        [prospectId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting phone number history:', error);
      throw error;
    }
  }

  /**
   * Log prospect creation
   */
  async logProspectCreation(prospectId, userId, prospectData) {
    return this.logActivity(
      prospectId, 
      userId, 
      'created',
      `Lead created: ${prospectData.firstName} ${prospectData.lastName}`,
      null,
      JSON.stringify(prospectData),
      null,
      { source: 'manual', ...prospectData }
    );
  }

  /**
   * Log status change
   */
  async logStatusChange(prospectId, userId, oldStatus, newStatus, reason = null) {
    return this.logActivity(
      prospectId,
      userId,
      'status_change',
      `Status changed from "${oldStatus || 'None'}" to "${newStatus}"${reason ? `: ${reason}` : ''}`,
      oldStatus,
      newStatus,
      'status',
      { reason }
    );
  }

  /**
   * Log field update
   */
  async logFieldUpdate(prospectId, userId, fieldName, oldValue, newValue) {
    return this.logActivity(
      prospectId,
      userId,
      'field_updated',
      `${fieldName} updated from "${oldValue || 'empty'}" to "${newValue}"`,
      oldValue,
      newValue,
      fieldName,
      null
    );
  }

  /**
   * Log note added/edited
   */
  async logNoteChange(prospectId, userId, oldNote, newNote) {
    const actionType = oldNote ? 'note_edited' : 'note_added';
    const description = oldNote 
      ? `Note edited` 
      : `Note added: "${(newNote || '').substring(0, 100)}${(newNote || '').length > 100 ? '...' : ''}"`;
    
    return this.logActivity(
      prospectId,
      userId,
      actionType,
      description,
      oldNote,
      newNote,
      'notes',
      null
    );
  }

  /**
   * Delete a single call log by ID
   */
  async deleteCallLog(id) {
    try {
      const result = await pool.query(
        'DELETE FROM call_logs WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error deleting call log:', error);
      throw error;
    }
  }

  /**
   * Delete multiple call logs by IDs
   */
  async deleteCallLogs(ids) {
    try {
      if (!ids || ids.length === 0) return [];
      const result = await pool.query(
        'DELETE FROM call_logs WHERE id = ANY($1) RETURNING *',
        [ids]
      );
      return result.rows;
    } catch (error) {
      console.error('Error deleting call logs:', error);
      throw error;
    }
  }

  /**
   * Delete all call logs
   */
  async deleteAllCallLogs() {
    try {
      const result = await pool.query('DELETE FROM call_logs RETURNING *');
      return result.rows;
    } catch (error) {
      console.error('Error deleting all call logs:', error);
      throw error;
    }
  }

  /**
   * Lead List Management
   */
  async createLeadList(name, description, prospectIds, createdBy) {
    try {
      const result = await pool.query(
        `INSERT INTO lead_lists (name, description, created_by)
        VALUES ($1, $2, $3)
        RETURNING *`,
        [name, description || '', createdBy]
      );

      const list = result.rows[0];

      // Add prospects to the list
      if (prospectIds && prospectIds.length > 0) {
        for (const prospectId of prospectIds) {
          try {
            await pool.query(
              `INSERT INTO lead_list_members (list_id, prospect_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING`,
              [list.id, prospectId]
            );
          } catch (e) {
            console.warn(`Failed to add prospect ${prospectId} to list:`, e);
          }
        }
      }

      // Log the list creation
      await this.logLeadListAudit(list.id, createdBy, 'created', 
        `Created lead list "${name}" with ${prospectIds?.length || 0} prospects`,
        prospectIds?.length || 0,
        { fileName: 'manual' }
      );

      return {
        ...list,
        prospectIds,
        prospectCount: prospectIds?.length || 0
      };
    } catch (error) {
      console.error('Error creating lead list:', error);
      throw error;
    }
  }

  async getLeadLists(userId) {
    try {
      // First, get the user's role
      const userResult = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
      );
      
      const userRole = userResult.rows[0]?.role || 'agent';
      const isAdmin = userRole === 'admin';

      let result;
      
      if (isAdmin) {
        // Admins can see ALL lead lists
        result = await pool.query(
          `SELECT l.*, 
                  COUNT(DISTINCT lm.prospect_id) as prospect_count,
                  CASE WHEN l.created_by = $1 THEN true ELSE false END as is_owner,
                  u.first_name as creator_first_name,
                  u.last_name as creator_last_name,
                  true as can_view,
                  true as can_edit
          FROM lead_lists l
          LEFT JOIN lead_list_members lm ON l.id = lm.list_id
          LEFT JOIN users u ON l.created_by = u.id
          GROUP BY l.id, u.first_name, u.last_name
          ORDER BY l.created_at DESC`,
          [userId]
        );
      } else {
        // Non-admins can only see:
        // 1. Lists they created
        // 2. Lists shared with them
        result = await pool.query(
          `SELECT l.*, 
                  COUNT(DISTINCT lm.prospect_id) as prospect_count,
                  CASE WHEN l.created_by = $1 THEN true ELSE false END as is_owner,
                  u.first_name as creator_first_name,
                  u.last_name as creator_last_name,
                  COALESCE(s.can_view, l.created_by = $1) as can_view,
                  COALESCE(s.can_edit, l.created_by = $1) as can_edit
          FROM lead_lists l
          LEFT JOIN lead_list_members lm ON l.id = lm.list_id
          LEFT JOIN users u ON l.created_by = u.id
          LEFT JOIN lead_list_shares s ON l.id = s.list_id AND s.user_id = $1
          WHERE l.created_by = $1 OR s.user_id = $1
          GROUP BY l.id, u.first_name, u.last_name, s.can_view, s.can_edit
          ORDER BY l.created_at DESC`,
          [userId]
        );
      }

      // Fetch prospects for each list in a single query
      const listIds = result.rows.map(l => l.id);
      
      let prospectMap = {};
      if (listIds.length > 0) {
        const prospectResult = await pool.query(
          `SELECT list_id, prospect_id FROM lead_list_members WHERE list_id = ANY($1)`,
          [listIds]
        );
        
        // Group prospect IDs by list ID
        prospectResult.rows.forEach(row => {
          if (!prospectMap[row.list_id]) {
            prospectMap[row.list_id] = [];
          }
          prospectMap[row.list_id].push(row.prospect_id);
        });
      }
      
      // Map results with prospect IDs
      const lists = result.rows.map(list => ({
        ...list,
        prospectIds: prospectMap[list.id] || [],
        isOwner: list.is_owner,
        canView: list.can_view !== false,
        canEdit: list.can_edit === true || list.is_owner,
        creatorName: list.creator_first_name && list.creator_last_name 
          ? `${list.creator_first_name} ${list.creator_last_name}`
          : 'Unknown'
      }));

      return lists;
    } catch (error) {
      console.error('Error getting lead lists:', error);
      throw error;
    }
  }

  async getLeadList(id) {
    try {
      const listResult = await pool.query(
        'SELECT * FROM lead_lists WHERE id = $1',
        [id]
      );

      if (listResult.rows.length === 0) {
        return null;
      }

      const list = listResult.rows[0];

      const prospectResult = await pool.query(
        `SELECT prospect_id FROM lead_list_members WHERE list_id = $1`,
        [id]
      );

      return {
        id: list.id,
        name: list.name,
        description: list.description,
        createdBy: list.created_by, // Convert snake_case to camelCase
        createdAt: list.created_at,
        updatedAt: list.updated_at,
        prospectIds: prospectResult.rows.map(r => r.prospect_id),
        prospectCount: prospectResult.rows.length
      };
    } catch (error) {
      console.error('Error getting lead list:', error);
      throw error;
    }
  }

  async updateLeadList(id, updates, userId) {
    try {
      const list = await this.getLeadList(id);
      if (!list) {
        throw new Error('Lead list not found');
      }

      const { name, description, prospectIds } = updates;

      // Update list metadata
      if (name || description !== undefined) {
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (name) {
          updateFields.push(`name = $${paramCount}`);
          updateValues.push(name);
          paramCount++;
        }
        if (description !== undefined) {
          updateFields.push(`description = $${paramCount}`);
          updateValues.push(description);
          paramCount++;
        }

        updateValues.push(id);

        await pool.query(
          `UPDATE lead_lists SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount}`,
          updateValues
        );
      }

      // Update prospects if provided
      if (prospectIds) {
        // Remove old members
        await pool.query(
          'DELETE FROM lead_list_members WHERE list_id = $1',
          [id]
        );

        // Add new members
        for (const prospectId of prospectIds) {
          try {
            await pool.query(
              `INSERT INTO lead_list_members (list_id, prospect_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING`,
              [id, prospectId]
            );
          } catch (e) {
            console.warn(`Failed to add prospect ${prospectId} to list:`, e);
          }
        }

        // Log the update
        await this.logLeadListAudit(id, userId, 'updated', 
          `Updated lead list with ${prospectIds.length} prospects`,
          prospectIds.length
        );
      }

      return this.getLeadList(id);
    } catch (error) {
      console.error('Error updating lead list:', error);
      throw error;
    }
  }

  async deleteLeadList(id) {
    try {
      // Log the deletion before deleting
      const list = await this.getLeadList(id);
      if (list) {
        await this.logLeadListAudit(id, null, 'deleted', 
          `Deleted lead list "${list.name}" with ${list.prospectCount} prospects`,
          list.prospectCount
        );
      }

      const result = await pool.query(
        'DELETE FROM lead_lists WHERE id = $1 RETURNING *',
        [id]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error deleting lead list:', error);
      throw error;
    }
  }

  /**
   * Lead List Audit Logging
   */
  async logLeadListAudit(listId, userId, actionType, actionDescription, prospectCount = 0, metadata = {}) {
    try {
      await pool.query(
        `INSERT INTO lead_list_audit_log 
        (list_id, user_id, action_type, action_description, prospect_count, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [listId, userId, actionType, actionDescription, prospectCount, JSON.stringify(metadata)]
      );
    } catch (error) {
      console.error('Error logging lead list audit:', error);
      // Don't throw - audit logging shouldn't break the main operation
    }
  }

  async getLeadListAuditLog(listId, limit = 50) {
    try {
      const result = await pool.query(
        `SELECT al.*, u.first_name, u.last_name, u.email
        FROM lead_list_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.list_id = $1
        ORDER BY al.created_at DESC
        LIMIT $2`,
        [listId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting lead list audit log:', error);
      throw error;
    }
  }

  /**
   * Check if a user can access a lead list
   */
  async checkUserListAccess(userId, listId) {
    try {
      // Check if user is the creator
      const list = await this.getLeadList(listId);
      if (list && list.createdBy === userId) {
        return { hasAccess: true, canEdit: true, isOwner: true };
      }
      
      // Check for explicit share permissions
      const result = await pool.query(
        `SELECT can_view, can_edit FROM lead_list_shares 
         WHERE list_id = $1 AND user_id = $2`,
        [listId, userId]
      );
      
      if (result.rows.length > 0) {
        const perm = result.rows[0];
        return { 
          hasAccess: perm.can_view, 
          canEdit: perm.can_edit, 
          isOwner: false 
        };
      }
      
      return { hasAccess: false, canEdit: false, isOwner: false };
    } catch (error) {
      console.error('Error checking user list access:', error);
      return { hasAccess: false, canEdit: false, isOwner: false };
    }
  }

  /**
   * Share a lead list with a user
   */
  async shareLeadList(listId, targetUserId, sharedBy, canView = true, canEdit = false) {
    try {
      const result = await pool.query(
        `INSERT INTO lead_list_shares (list_id, user_id, can_view, can_edit, shared_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (list_id, user_id) 
         DO UPDATE SET can_view = $3, can_edit = $4
         RETURNING *`,
        [listId, targetUserId, canView, canEdit, sharedBy]
      );

      // Log the share action
      await this.logLeadListAudit(listId, sharedBy, 'shared', 
        `Shared list with user ${targetUserId}`,
        0,
        { targetUserId, canView, canEdit }
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error sharing lead list:', error);
      throw error;
    }
  }

  /**
   * Remove sharing for a lead list
   */
  async unshareLeadList(listId, targetUserId, removedBy) {
    try {
      const result = await pool.query(
        `DELETE FROM lead_list_shares 
         WHERE list_id = $1 AND user_id = $2
         RETURNING *`,
        [listId, targetUserId]
      );

      // Log the unshare action
      await this.logLeadListAudit(listId, removedBy, 'unshared', 
        `Removed sharing with user ${targetUserId}`,
        0,
        { targetUserId }
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error unsharing lead list:', error);
      throw error;
    }
  }

  /**
   * Get all shares for a lead list
   */
  async getLeadListShares(listId) {
    try {
      const result = await pool.query(
        `SELECT s.*, u.first_name, u.last_name, u.email
         FROM lead_list_shares s
         JOIN users u ON s.user_id = u.id
         WHERE s.list_id = $1
         ORDER BY s.created_at DESC`,
        [listId]
      );

      return result.rows.map(row => ({
        id: row.id,
        listId: row.list_id,
        userId: row.user_id,
        canView: row.can_view,
        canEdit: row.can_edit,
        sharedBy: row.shared_by,
        createdAt: row.created_at,
        user: {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email
        }
      }));
    } catch (error) {
      console.error('Error getting lead list shares:', error);
      throw error;
    }
  }

  /**
   * Delete multiple prospects from a lead list
   */
  async removeProspectsFromList(listId, prospectIds, userId) {
    try {
      const result = await pool.query(
        `DELETE FROM lead_list_members 
         WHERE list_id = $1 AND prospect_id = ANY($2)
         RETURNING prospect_id`,
        [listId, prospectIds]
      );

      // Log the removal
      await this.logLeadListAudit(listId, userId, 'leads_removed', 
        `Removed ${result.rowCount} leads from list`,
        result.rowCount,
        { removedProspectIds: prospectIds }
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error removing prospects from list:', error);
      throw error;
    }
  }

  // ==================== USER MANAGEMENT ====================

  /**
   * Create a new user
   */
  async createUser(email, firstName, lastName, role = 'agent', hashedPassword) {
    try {
      // Check if user already exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        throw new Error('User already exists with this email');
      }

      // Password should already be hashed by authService
      if (!hashedPassword) {
        throw new Error('Hashed password is required');
      }

      const result = await pool.query(
        `INSERT INTO users (email, password, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [email, hashedPassword, firstName, lastName, role]
      );

      console.log(`User created: ${email}`);
      return this._sanitizeUser(result.rows[0]);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this._sanitizeUser(result.rows[0]);
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  /**
   * Get all users
   */
  async getAllUsers() {
    try {
      const result = await pool.query(
        'SELECT * FROM users ORDER BY created_at DESC'
      );
      
      return result.rows.map(u => this._sanitizeUser(u));
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, updates) {
    try {
      const current = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (current.rows.length === 0) {
        return null;
      }

      const fieldMapping = {
        firstName: 'first_name',
        lastName: 'last_name',
        email: 'email',
        role: 'role',
        password: 'password',
        bio: 'bio',
        profilePicture: 'profile_picture',
        isActive: 'is_active'
      };

      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          const dbKey = fieldMapping[key] || key;
          fields.push(`${dbKey} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (fields.length === 0) {
        return this._sanitizeUser(current.rows[0]);
      }

      values.push(userId);
      const result = await pool.query(
        `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      return this._sanitizeUser(result.rows[0]);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    try {
      const result = await pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING *',
        [userId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Remove sensitive data from user object
   */
  _sanitizeUser(user) {
    if (!user) return null;
    const { password, ...sanitized } = user;
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role || 'agent',
      bio: user.bio,
      profilePicture: user.profile_picture,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }

  /**
   * Get dashboard stats - real data from database
   * @param {string} userId - Optional user ID to filter by
   * @param {string} period - 'today', 'week', 'month', 'all'
   */
  async getDashboardStats(userId = null, period = 'today') {
    try {
      let dateFilter = '';
      switch (period) {
        case 'today':
          dateFilter = "AND cl.started_at >= CURRENT_DATE";
          break;
        case 'week':
          dateFilter = "AND cl.started_at >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          dateFilter = "AND cl.started_at >= CURRENT_DATE - INTERVAL '30 days'";
          break;
        default:
          dateFilter = '';
      }

      const userFilter = userId ? 'AND cl.caller_id = $1' : '';
      const params = userId ? [userId] : [];

      // Get call stats
      const callStatsQuery = `
        SELECT 
          COUNT(*) as total_calls,
          COUNT(CASE WHEN cl.outcome IN ('Connected', 'Appointment Set', 'Callback Scheduled', 'Interested') THEN 1 END) as connections,
          COUNT(CASE WHEN cl.outcome = 'Appointment Set' THEN 1 END) as appointments,
          COALESCE(SUM(cl.duration), 0) as total_duration_seconds
        FROM call_logs cl
        WHERE 1=1 ${dateFilter} ${userFilter}
      `;
      
      const callStats = await pool.query(callStatsQuery, params);
      const stats = callStats.rows[0];

      // Get prospect stats
      const prospectStatsQuery = `
        SELECT 
          COUNT(*) as total_prospects,
          COUNT(CASE WHEN status = 'New' THEN 1 END) as new_leads,
          COUNT(CASE WHEN status = 'Contacted' THEN 1 END) as contacted,
          COUNT(CASE WHEN status = 'Qualified' THEN 1 END) as qualified,
          COUNT(CASE WHEN status = 'Lost' THEN 1 END) as lost
        FROM prospects
      `;
      const prospectStats = await pool.query(prospectStatsQuery);
      const prospects = prospectStats.rows[0];

      // Get recent calls
      const recentCallsQuery = `
        SELECT 
          cl.id,
          cl.prospect_id,
          cl.outcome,
          cl.duration,
          cl.started_at,
          cl.notes,
          COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') as prospect_name,
          p.company
        FROM call_logs cl
        LEFT JOIN prospects p ON cl.prospect_id = p.id
        WHERE 1=1 ${dateFilter} ${userFilter}
        ORDER BY cl.started_at DESC
        LIMIT 10
      `;
      const recentCalls = await pool.query(recentCallsQuery, params);

      // Calculate talk time in minutes
      const talkTimeMinutes = Math.round(parseInt(stats.total_duration_seconds || 0) / 60);

      return {
        callsMade: parseInt(stats.total_calls) || 0,
        connections: parseInt(stats.connections) || 0,
        appointmentsSet: parseInt(stats.appointments) || 0,
        talkTime: talkTimeMinutes,
        prospects: {
          total: parseInt(prospects.total_prospects) || 0,
          new: parseInt(prospects.new_leads) || 0,
          contacted: parseInt(prospects.contacted) || 0,
          qualified: parseInt(prospects.qualified) || 0,
          lost: parseInt(prospects.lost) || 0
        },
        recentCalls: recentCalls.rows.map(call => ({
          id: call.id,
          prospectId: call.prospect_id,
          prospectName: call.prospect_name,
          company: call.company,
          outcome: call.outcome,
          duration: call.duration || 0,
          timestamp: call.started_at,
          notes: call.notes
        }))
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Initialize default admin user if none exists
   */
  async ensureAdminUser() {
    try {
      const adminEmail = 'admin@creativeprocess.io';
      const existing = await this.getUserByEmail(adminEmail);
      
      if (!existing) {
        await pool.query(
          `INSERT INTO users (email, password, first_name, last_name, role)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (email) DO NOTHING`,
          [adminEmail, 'admin123', 'Admin', 'User', 'admin']
        );
        console.log('Default admin user created:');
        console.log('  Email:', adminEmail);
        console.log('  Password: admin123');
      }
    } catch (error) {
      console.error('Error ensuring admin user:', error);
      // Don't throw - this is initialization code
    }
  }

  // ========================
  // TRAINING SESSIONS
  // ========================

  /**
   * Get all training sessions
   */
  async getTrainingSessions() {
    try {
      const result = await pool.query(
        `SELECT * FROM training_sessions ORDER BY start_time DESC LIMIT 100`
      );
      return result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        providerId: row.provider_id,
        scenarioId: row.scenario_id,
        scenarioName: row.scenario_name,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        cost: parseFloat(row.cost) || 0,
        score: row.score,
        feedback: row.feedback ? JSON.parse(row.feedback) : null,
        recordingUrl: row.recording_url,
        status: row.status
      }));
    } catch (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        console.log('Training sessions table does not exist yet');
        return [];
      }
      console.error('Error getting training sessions:', error);
      throw error;
    }
  }

  /**
   * Get a single training session by ID
   */
  async getTrainingSession(id) {
    try {
      const result = await pool.query(
        `SELECT * FROM training_sessions WHERE id = $1`,
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error getting training session:', error);
      throw error;
    }
  }

  /**
   * Create a new training session
   */
  async createTrainingSession(session) {
    try {
      // Ensure table exists
      await this.ensureTrainingSessionsTable();
      
      const result = await pool.query(
        `INSERT INTO training_sessions 
        (id, agent_id, agent_name, provider_id, scenario_id, scenario_name, start_time, status, feedback_options)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          session.id,
          session.agentId,
          session.agentName,
          session.providerId,
          session.scenarioId,
          session.scenarioName,
          session.startTime,
          session.status || 'active',
          JSON.stringify(session.feedbackOptions || {})
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating training session:', error);
      throw error;
    }
  }

  /**
   * Update a training session
   */
  async updateTrainingSession(id, updates) {
    try {
      const result = await pool.query(
        `UPDATE training_sessions 
        SET end_time = $2, duration = $3, cost = $4, score = $5, feedback = $6, status = $7
        WHERE id = $1
        RETURNING *`,
        [
          id,
          updates.endTime,
          updates.duration,
          updates.cost,
          updates.score,
          updates.feedback,
          updates.status
        ]
      );
      
      const row = result.rows[0];
      return {
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        providerId: row.provider_id,
        scenarioId: row.scenario_id,
        scenarioName: row.scenario_name,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        cost: parseFloat(row.cost) || 0,
        score: row.score,
        feedback: row.feedback ? JSON.parse(row.feedback) : null,
        status: row.status
      };
    } catch (error) {
      console.error('Error updating training session:', error);
      throw error;
    }
  }

  /**
   * Get training costs summary
   */
  async getTrainingCosts() {
    try {
      // Ensure table exists
      await this.ensureTrainingSessionsTable();
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const result = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN start_time >= $1 THEN cost ELSE 0 END), 0) as today,
          COALESCE(SUM(CASE WHEN start_time >= $2 THEN cost ELSE 0 END), 0) as this_week,
          COALESCE(SUM(CASE WHEN start_time >= $3 THEN cost ELSE 0 END), 0) as this_month,
          COALESCE(SUM(cost), 0) as all_time
        FROM training_sessions
        WHERE status = 'completed'
      `, [startOfDay, startOfWeek, startOfMonth]);

      // Get costs by provider
      const byProviderResult = await pool.query(`
        SELECT provider_id, COALESCE(SUM(cost), 0) as total
        FROM training_sessions
        WHERE status = 'completed'
        GROUP BY provider_id
      `);

      // Get costs by agent
      const byAgentResult = await pool.query(`
        SELECT agent_name, COALESCE(SUM(cost), 0) as total
        FROM training_sessions
        WHERE status = 'completed'
        GROUP BY agent_name
      `);

      const byProvider = {};
      byProviderResult.rows.forEach(row => {
        byProvider[row.provider_id] = parseFloat(row.total) || 0;
      });

      const byAgent = {};
      byAgentResult.rows.forEach(row => {
        byAgent[row.agent_name] = parseFloat(row.total) || 0;
      });

      return {
        today: parseFloat(result.rows[0].today) || 0,
        thisWeek: parseFloat(result.rows[0].this_week) || 0,
        thisMonth: parseFloat(result.rows[0].this_month) || 0,
        allTime: parseFloat(result.rows[0].all_time) || 0,
        byProvider,
        byAgent
      };
    } catch (error) {
      // If table doesn't exist, return zeros
      if (error.code === '42P01') {
        return {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          allTime: 0,
          byProvider: {},
          byAgent: {}
        };
      }
      console.error('Error getting training costs:', error);
      throw error;
    }
  }

  /**
   * Ensure training_sessions table exists
   */
  async ensureTrainingSessionsTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS training_sessions (
          id VARCHAR(255) PRIMARY KEY,
          agent_id VARCHAR(255),
          agent_name VARCHAR(255),
          provider_id VARCHAR(100),
          scenario_id VARCHAR(100),
          scenario_name VARCHAR(255),
          start_time TIMESTAMP WITH TIME ZONE,
          end_time TIMESTAMP WITH TIME ZONE,
          duration INTEGER DEFAULT 0,
          cost DECIMAL(10, 4) DEFAULT 0,
          score INTEGER,
          feedback TEXT,
          recording_url TEXT,
          status VARCHAR(50) DEFAULT 'active',
          feedback_options TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
    } catch (error) {
      console.error('Error creating training_sessions table:', error);
    }
  }
}

module.exports = new DatabaseService();
