-- Add indexes to call_logs table for better performance
-- This will significantly speed up call history queries

-- Index on started_at for sorting (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at DESC);

-- Index on caller_id for filtering by agent
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id ON call_logs(caller_id);

-- Index on prospect_id for prospect-specific queries
CREATE INDEX IF NOT EXISTS idx_call_logs_prospect_id ON call_logs(prospect_id);

-- Index on phone_number for phone number lookups
CREATE INDEX IF NOT EXISTS idx_call_logs_phone_number ON call_logs(phone_number);

-- Index on call_sid for webhook lookups when saving recordings
CREATE INDEX IF NOT EXISTS idx_call_logs_call_sid ON call_logs(call_sid);

-- Composite index for common query pattern: caller + date range
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_started ON call_logs(caller_id, started_at DESC);

-- Index on outcome for filtering
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome ON call_logs(outcome);

ANALYZE call_logs;
