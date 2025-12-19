/**
 * DATABASE SCHEMA FOR INBOUND CALLS
 * 
 * Installation:
 * 1. Copy this entire SQL
 * 2. Run: psql -U postgres -d your_database_name -f schema.sql
 * 3. Or paste into PostgreSQL client
 */

-- Create call_logs table
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

-- Create inbound_calls table (tracks incoming calls)
CREATE TABLE IF NOT EXISTS inbound_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_control_id VARCHAR(100) UNIQUE NOT NULL,
  from_number VARCHAR(20),
  to_number VARCHAR(20),
  status VARCHAR(50) DEFAULT 'incoming',
  answered_at TIMESTAMP,
  answered_by UUID REFERENCES users(id),
  ended_at TIMESTAMP,
  recording_url TEXT,
  direction VARCHAR(20) DEFAULT 'inbound',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id ON call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_prospect_id ON call_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone_number ON call_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_sid ON call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_started ON call_logs(caller_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome ON call_logs(outcome);

CREATE INDEX IF NOT EXISTS idx_inbound_calls_control_id ON inbound_calls(call_control_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_from_number ON inbound_calls(from_number);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_status ON inbound_calls(status);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_created_at ON inbound_calls(created_at DESC);

-- Analyze for query optimization
ANALYZE;

-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('call_logs', 'inbound_calls') 
AND table_schema = 'public';
