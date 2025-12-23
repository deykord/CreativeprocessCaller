-- Add cost_usd column to call_logs table for Telnyx cost tracking
-- Run this migration: psql -U postgres -d your_database_name -f add_cost_column.sql

-- Add cost column to track Telnyx call costs
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 6) DEFAULT 0;

-- Calculate and update existing call costs
-- Telnyx rates: $0.002/min for calls + $0.002/min for recording
UPDATE call_logs 
SET cost_usd = ROUND((duration / 60.0) * (0.002 + CASE WHEN recording_url IS NOT NULL AND recording_url != '' THEN 0.002 ELSE 0 END), 6)
WHERE cost_usd IS NULL OR cost_usd = 0;

-- Create index for cost queries
CREATE INDEX IF NOT EXISTS idx_call_logs_cost ON call_logs(cost_usd);

-- Verify column added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'call_logs' AND column_name = 'cost_usd';

-- Show total costs
SELECT 
  COUNT(*) as total_calls,
  SUM(cost_usd) as total_cost_usd,
  SUM(duration) as total_duration_seconds
FROM call_logs;
