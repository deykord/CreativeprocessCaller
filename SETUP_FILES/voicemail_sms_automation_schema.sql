/**
 * VOICEMAIL DROP + SMS AUTOMATION SCHEMA
 * 
 * Run this to add the necessary tables for the automation feature:
 * psql -U postgres -d your_database_name -f voicemail_sms_automation_schema.sql
 */

-- SMS Templates table
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automation settings per user
CREATE TABLE IF NOT EXISTS automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  -- Voicemail Drop Settings
  auto_voicemail_drop BOOLEAN DEFAULT false,
  default_voicemail_id UUID REFERENCES voicemails(id) ON DELETE SET NULL,
  -- SMS Follow-up Settings
  auto_sms_followup BOOLEAN DEFAULT false,
  default_sms_template_id UUID REFERENCES sms_templates(id) ON DELETE SET NULL,
  sms_delay_seconds INTEGER DEFAULT 10,
  -- Callback Settings
  auto_schedule_callback BOOLEAN DEFAULT false,
  callback_delay_hours INTEGER DEFAULT 24,
  -- Created/Updated
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMS sent log
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  to_number VARCHAR(20) NOT NULL,
  from_number VARCHAR(20) NOT NULL,
  template_id UUID REFERENCES sms_templates(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'sent',
  telnyx_message_id VARCHAR(100),
  trigger_type VARCHAR(50) DEFAULT 'voicemail_followup', -- 'voicemail_followup', 'manual', 'scheduled'
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voicemail drop log (extends existing functionality)
CREATE TABLE IF NOT EXISTS voicemail_drop_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  voicemail_id UUID REFERENCES voicemails(id) ON DELETE SET NULL,
  call_control_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'dropped',
  duration INTEGER DEFAULT 0,
  sms_sent BOOLEAN DEFAULT false,
  sms_log_id UUID REFERENCES sms_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled callbacks
CREATE TABLE IF NOT EXISTS scheduled_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  original_call_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'cancelled', 'missed'
  reminder_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_templates_user ON sms_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_templates_default ON sms_templates(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_automation_settings_user ON automation_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_user ON sms_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_prospect ON sms_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_voicemail_drop_logs_user ON voicemail_drop_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_drop_logs_created ON voicemail_drop_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_callbacks_user ON scheduled_callbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_callbacks_scheduled ON scheduled_callbacks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_callbacks_status ON scheduled_callbacks(status);

-- Insert default SMS templates (for new users)
-- This is handled in the application when user first accesses the feature

ANALYZE;

-- Verify tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'sms_templates', 
  'automation_settings', 
  'sms_logs', 
  'voicemail_drop_logs',
  'scheduled_callbacks'
) AND table_schema = 'public';
