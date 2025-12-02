-- CreativeProcess Caller Database Schema
-- This schema includes lead management, status logging, and duplicate call prevention

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (agents/callers)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'agent',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prospects/Leads table
CREATE TABLE IF NOT EXISTS prospects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    title VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'New',
    timezone VARCHAR(100),
    notes TEXT,
    last_call TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone) -- Prevent duplicate phone numbers
);

-- Status change log - tracks every status change with timestamp
CREATE TABLE IF NOT EXISTS prospect_status_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lead Activity Log - comprehensive audit trail for everything done to a lead
CREATE TABLE IF NOT EXISTS lead_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL, -- 'call', 'status_change', 'note_added', 'note_edited', 'field_updated', 'created', 'assigned', 'list_added', 'list_removed'
    action_description TEXT NOT NULL, -- Human readable description
    old_value TEXT, -- Previous value (for edits)
    new_value TEXT, -- New value (for edits)
    field_name VARCHAR(100), -- Which field was changed (for field_updated)
    metadata JSONB, -- Additional context (call duration, disposition, etc.)
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast activity log queries
CREATE INDEX IF NOT EXISTS idx_lead_activity_prospect ON lead_activity_log(prospect_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_user ON lead_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_type ON lead_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_lead_activity_created ON lead_activity_log(created_at DESC);

-- Call logs - tracks all call attempts
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE, -- Nullable to allow orphan call logs
    caller_id UUID REFERENCES users(id), -- Nullable to allow anonymous calls
    phone_number VARCHAR(50) NOT NULL,
    from_number VARCHAR(50),
    outcome VARCHAR(100),
    duration INTEGER DEFAULT 0, -- in seconds
    notes TEXT,
    recording_url VARCHAR(500),
    call_sid VARCHAR(100), -- Twilio Call SID for tracking
    end_reason VARCHAR(50), -- How the call ended: customer_hangup, agent_hangup, voicemail, no_answer, busy, failed, canceled, etc.
    answered_by VARCHAR(20), -- 'human', 'machine', or 'unknown' (AMD result)
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active calls - prevents duplicate simultaneous calls to the same prospect
CREATE TABLE IF NOT EXISTS active_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    caller_id UUID NOT NULL REFERENCES users(id),
    phone_number VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(prospect_id) -- Only one active call per prospect at a time
);

-- Lead assignments - track which agent is working which lead
CREATE TABLE IF NOT EXISTS lead_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES users(id),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional: assignment can expire
    is_active BOOLEAN DEFAULT true,
    UNIQUE(prospect_id, assigned_to) -- Prevent duplicate assignments
);

-- Lead lists (campaigns/queues)
CREATE TABLE IF NOT EXISTS lead_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lead list members - many-to-many relationship
CREATE TABLE IF NOT EXISTS lead_list_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES lead_lists(id) ON DELETE CASCADE,
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(list_id, prospect_id)
);

-- Lead list shares - controls which users can access which lists
-- By default, only admins can see all lists. Agents can only see lists shared with them.
CREATE TABLE IF NOT EXISTS lead_list_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES lead_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT false,
    shared_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(list_id, user_id)
);

-- Index for fast share lookups
CREATE INDEX IF NOT EXISTS idx_lead_list_shares_list ON lead_list_shares(list_id);
CREATE INDEX IF NOT EXISTS idx_lead_list_shares_user ON lead_list_shares(user_id);

-- Lead list audit log - tracks all changes to lead lists (imports, edits, deletes)
CREATE TABLE IF NOT EXISTS lead_list_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES lead_lists(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL, -- 'created', 'imported', 'updated', 'deleted', 'lead_added', 'lead_removed', 'shared'
    action_description TEXT NOT NULL, -- Human readable description
    prospect_count INTEGER, -- Number of prospects in the list at this action
    old_value TEXT, -- Previous value (for edits)
    new_value TEXT, -- New value (for edits)
    metadata JSONB, -- Additional context (file name, number of leads imported, etc.)
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast audit log queries
CREATE INDEX IF NOT EXISTS idx_lead_list_audit_list ON lead_list_audit_log(list_id);
CREATE INDEX IF NOT EXISTS idx_lead_list_audit_user ON lead_list_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_list_audit_action ON lead_list_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_lead_list_audit_created ON lead_list_audit_log(created_at DESC);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_phone ON prospects(phone);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects(created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_prospect ON call_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started ON call_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_status_log_prospect ON prospect_status_log(prospect_id);
CREATE INDEX IF NOT EXISTS idx_status_log_created ON prospect_status_log(created_at);
CREATE INDEX IF NOT EXISTS idx_active_calls_prospect ON active_calls(prospect_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_prospect ON lead_assignments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_assigned ON lead_assignments(assigned_to);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_lists_updated_at BEFORE UPDATE ON lead_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log status changes automatically
CREATE OR REPLACE FUNCTION log_prospect_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO prospect_status_log (prospect_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically log status changes
CREATE TRIGGER prospect_status_change_trigger AFTER UPDATE ON prospects
    FOR EACH ROW EXECUTE FUNCTION log_prospect_status_change();

-- View for getting prospect with last call info
CREATE OR REPLACE VIEW prospects_with_call_info AS
SELECT 
    p.*,
    cl.started_at as last_call_time,
    cl.outcome as last_call_outcome,
    cl.caller_id as last_caller_id,
    u.first_name as last_caller_first_name,
    u.last_name as last_caller_last_name,
    (SELECT COUNT(*) FROM call_logs WHERE prospect_id = p.id) as total_calls,
    (SELECT started_at FROM call_logs WHERE prospect_id = p.id ORDER BY started_at DESC LIMIT 1) as most_recent_call
FROM prospects p
LEFT JOIN LATERAL (
    SELECT * FROM call_logs 
    WHERE prospect_id = p.id 
    ORDER BY started_at DESC 
    LIMIT 1
) cl ON true
LEFT JOIN users u ON cl.caller_id = u.id;

-- Function to check if prospect can be called (prevents duplicates)
CREATE OR REPLACE FUNCTION can_call_prospect(
    p_prospect_id UUID,
    p_caller_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_active_call_exists BOOLEAN;
    v_recent_call_time TIMESTAMP;
    v_recent_caller_id UUID;
    v_min_call_interval INTERVAL := '5 minutes'; -- Minimum time between calls to same prospect
BEGIN
    -- Check if there's already an active call to this prospect
    SELECT EXISTS(
        SELECT 1 FROM active_calls WHERE prospect_id = p_prospect_id
    ) INTO v_active_call_exists;
    
    IF v_active_call_exists THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Prospect is currently on another call'
        );
    END IF;
    
    -- Check for recent calls to this prospect
    SELECT started_at, caller_id INTO v_recent_call_time, v_recent_caller_id
    FROM call_logs
    WHERE prospect_id = p_prospect_id
    ORDER BY started_at DESC
    LIMIT 1;
    
    IF v_recent_call_time IS NOT NULL AND 
       v_recent_call_time > CURRENT_TIMESTAMP - v_min_call_interval THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Prospect was called recently (within 5 minutes)',
            'last_call_time', v_recent_call_time,
            'last_caller_id', v_recent_caller_id
        );
    END IF;
    
    -- All checks passed
    RETURN jsonb_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql;

-- Insert default admin user (password: admin123 - should be hashed in production)
INSERT INTO users (email, password, first_name, last_name, role)
VALUES ('admin@creativeprocess.io', '$2b$10$rZJ3qGHCpXBXXOw8QE3Ziu9WXMhvVv5P0zK3qKqWqXQbXqXqXqXq', 'Admin', 'User', 'admin')
ON CONFLICT (email) DO NOTHING;
