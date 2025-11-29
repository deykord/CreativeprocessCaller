# Database System - CreativeProcess Caller

## Overview
This system provides comprehensive lead management with PostgreSQL, including:
- **Status change logging** - Every status change is automatically tracked
- **Duplicate call prevention** - Prevents calling the same lead multiple times
- **Active call tracking** - Prevents simultaneous calls to the same prospect
- **Call history** - Complete audit trail of all calls
- **Lead assignments** - Track which agent is working which lead

## Features

### 1. Automatic Status Logging
Every time a prospect's status changes, it's automatically logged:
- Old status
- New status  
- Who made the change
- Timestamp

```sql
SELECT * FROM prospect_status_log WHERE prospect_id = 'uuid';
```

### 2. Duplicate Call Prevention
The system prevents:
- **Simultaneous calls**: Only one agent can call a prospect at a time
- **Recent calls**: Minimum 5-minute gap between calls to same prospect
- **Multiple attempts**: Tracks who called and when

```javascript
// Check if prospect can be called
const canCall = await dbService.canCallProspect(prospectId, callerId);
if (!canCall.allowed) {
  console.log(canCall.reason); // "Prospect is currently on another call"
}
```

### 3. Call Flow with Database

```javascript
// 1. Start call (creates active call record)
const { callLogId } = await dbService.startCall(
  prospectId, 
  userId, 
  phoneNumber, 
  fromNumber
);

// 2. During call - prospect is locked (no other agent can call)

// 3. End call (removes lock, logs outcome)
await dbService.endCall(
  prospectId,
  callLogId, 
  outcome,       // "Connected", "Voicemail", etc.
  duration,      // seconds
  notes,
  recordingUrl
);
```

## Setup

### Quick Setup (Automated)
```bash
sudo ./server/database/setup.sh
```

### Manual Setup

1. **Install PostgreSQL**:
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
```

2. **Create Database**:
```bash
sudo -u postgres createdb creativeprocess_caller
```

3. **Configure .env**:
```env
USE_DATABASE=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=creativeprocess_caller
DB_USER=postgres
DB_PASSWORD=your_password
```

4. **Run Migrations**:
```bash
node server/database/migrate.js
```

## Database Schema

### Tables

#### `prospects` - Lead/Contact information
- Stores all prospect data (name, phone, email, company, etc.)
- Unique constraint on `phone` to prevent duplicates
- Auto-tracks `last_call` timestamp

#### `prospect_status_log` - Status change history
- Automatically populated via trigger when status changes
- Tracks: old status → new status, who changed it, when

#### `call_logs` - Complete call history
- Every call attempt is logged
- Includes: outcome, duration, notes, recording URL
- Links to prospect and caller (agent)

#### `active_calls` - Currently active calls
- One row per active call
- UNIQUE constraint on `prospect_id` prevents duplicate calls
- Automatically cleaned up when call ends

#### `lead_assignments` - Agent assignments
- Tracks which agent is working which lead
- Supports temporary assignments (expires_at)
- Can deactivate old assignments

### Key Functions

#### `can_call_prospect(prospect_id, caller_id)`
Returns JSON:
```json
{
  "allowed": false,
  "reason": "Prospect was called recently (within 5 minutes)",
  "last_call_time": "2025-11-29T10:30:00Z",
  "last_caller_id": "uuid"
}
```

Checks:
1. ✅ No active call exists
2. ✅ Last call was > 5 minutes ago
3. ✅ Returns allowed: true if all checks pass

## API Endpoints

### Check if Prospect Can Be Called
```
GET /api/prospects/:id/can-call
```

Response:
```json
{
  "allowed": true
}
```

### Start Call
```
POST /api/prospects/:id/start-call
Body: { "phoneNumber": "...", "fromNumber": "..." }
```

Response:
```json
{
  "activeCallId": "uuid",
  "callLogId": "uuid"
}
```

### End Call
```
POST /api/prospects/:id/end-call
Body: {
  "callLogId": "uuid",
  "outcome": "Connected",
  "duration": 120,
  "notes": "Great conversation",
  "recordingUrl": "https://..."
}
```

### Get Call History
```
GET /api/prospects/:id/call-history
```

### Get Status History
```
GET /api/prospects/:id/status-history
```

### Get Active Calls
```
GET /api/active-calls
```

## Duplicate Prevention Rules

### Rule 1: One Active Call at a Time
When an agent starts a call, a record is created in `active_calls`:
```sql
INSERT INTO active_calls (prospect_id, caller_id, phone_number)
VALUES (:prospect_id, :caller_id, :phone_number);
```

The `UNIQUE(prospect_id)` constraint ensures only ONE active call per prospect.

### Rule 2: Minimum Time Between Calls
Configurable interval (default: 5 minutes):
```sql
SELECT started_at FROM call_logs
WHERE prospect_id = :prospect_id
ORDER BY started_at DESC LIMIT 1;
```

If `started_at > NOW() - INTERVAL '5 minutes'`, call is blocked.

### Rule 3: Persistent State
Even after logout/login:
- All call history persists in `call_logs`
- Status changes persist in `prospect_status_log`
- Assignments persist in `lead_assignments`

## Migration from Mock Database

The migration script automatically:
1. ✅ Creates all tables and triggers
2. ✅ Migrates existing users
3. ✅ Migrates existing prospects (deduplicates by phone)
4. ✅ Migrates call history
5. ✅ Sets up indexes for performance

## Monitoring

### View Active Calls
```sql
SELECT * FROM active_calls;
```

### Check Recent Status Changes
```sql
SELECT * FROM prospect_status_log 
ORDER BY created_at DESC 
LIMIT 20;
```

### Find Prospects Called Multiple Times
```sql
SELECT prospect_id, COUNT(*) as call_count
FROM call_logs
GROUP BY prospect_id
HAVING COUNT(*) > 1
ORDER BY call_count DESC;
```

### Agent Performance
```sql
SELECT 
  u.email,
  COUNT(*) as total_calls,
  AVG(cl.duration) as avg_duration
FROM call_logs cl
JOIN users u ON cl.caller_id = u.id
GROUP BY u.email;
```

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# View logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Clear Active Calls (if stuck)
```sql
DELETE FROM active_calls WHERE started_at < NOW() - INTERVAL '1 hour';
```

### Reset Database (⚠️ DESTROYS ALL DATA)
```bash
sudo -u postgres dropdb creativeprocess_caller
sudo -u postgres createdb creativeprocess_caller
node server/database/migrate.js
```

## Performance Tips

1. **Indexes are automatically created** on:
   - `prospects.phone`, `prospects.status`
   - `call_logs.prospect_id`, `call_logs.caller_id`
   - `active_calls.prospect_id`

2. **Use the view** for reports:
   ```sql
   SELECT * FROM prospects_with_call_info;
   ```

3. **Archive old data** periodically:
   ```sql
   -- Archive calls older than 1 year
   DELETE FROM call_logs WHERE started_at < NOW() - INTERVAL '1 year';
   ```

## Security

- ✅ Passwords are hashed with bcrypt
- ✅ Database credentials in `.env` (not committed)
- ✅ SQL injection protected (parameterized queries)
- ✅ Row-level security can be added for multi-tenant

## Support

For issues or questions:
1. Check logs: `pm2 logs creativeprocess-backend`
2. Check database: `sudo -u postgres psql creativeprocess_caller`
3. Review migration output: `node server/database/migrate.js`
