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

      return result.rows[0];
    } catch (error) {
      console.error('Error creating prospect:', error);
      throw error;
    }
  }

  /**
   * Update prospect and log status change
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

      const oldStatus = current.rows[0].status;

      // Build update query dynamically
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      });

      if (fields.length === 0) {
        await client.query('COMMIT');
        return current.rows[0];
      }

      values.push(id);
      const updateQuery = `
        UPDATE prospects 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      // Log status change if status was updated
      if (updates.status && updates.status !== oldStatus) {
        await client.query(
          `INSERT INTO prospect_status_log (prospect_id, old_status, new_status, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [id, oldStatus, updates.status, updatedBy]
        );
      }

      await client.query('COMMIT');
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
               p.first_name as prospect_first_name, 
               p.last_name as prospect_last_name,
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
}

module.exports = new DatabaseService();
