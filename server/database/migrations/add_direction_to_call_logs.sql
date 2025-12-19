-- Add direction column to call_logs table to track inbound vs outbound calls
ALTER TABLE call_logs 
ADD COLUMN IF NOT EXISTS direction VARCHAR(20) DEFAULT 'outbound';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON call_logs(direction);

-- Update existing records: if from_number is null or empty, it's likely outbound
-- If from_number is present, it could be inbound
UPDATE call_logs 
SET direction = CASE 
  WHEN from_number IS NOT NULL AND from_number != '' AND from_number != phone_number THEN 'inbound'
  ELSE 'outbound'
END
WHERE direction IS NULL OR direction = 'outbound';

COMMENT ON COLUMN call_logs.direction IS 'Call direction: inbound or outbound';
