# Database Setup Guide

## Quick Start (Recommended)

Run this single command to set up everything:

```bash
sudo /root/CreativeprocessCaller/server/database/setup.sh
```

This will:
1. ✅ Install PostgreSQL (if needed)
2. ✅ Create the database
3. ✅ Run all migrations
4. ✅ Migrate existing data from memory to database

## Manual Installation

If you prefer to do it step-by-step:

### 1. Install PostgreSQL
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database
```bash
sudo -u postgres psql <<EOF
CREATE DATABASE creativeprocess_caller;
\c creativeprocess_caller
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
```

### 3. Install Node Dependencies
```bash
cd /root/CreativeprocessCaller/server
npm install pg bcrypt
```

### 4. Configure Environment
The `.env` file already has the database configuration:
```env
USE_DATABASE=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=creativeprocess_caller
DB_USER=postgres
DB_PASSWORD=postgres
```

### 5. Run Migration
```bash
cd /root/CreativeprocessCaller
node server/database/migrate.js
```

## Restart Server

After setup, restart the server:

```bash
pm2 restart all
# or
pm2 restart creativeprocess-backend
```

## Verify Installation

Check if database is working:

```bash
# Connect to database
sudo -u postgres psql creativeprocess_caller

# Run some queries
\dt                              -- List all tables
SELECT COUNT(*) FROM prospects; -- Count prospects
SELECT COUNT(*) FROM users;     -- Count users
\q                              -- Exit
```

## Test Duplicate Prevention

1. Start Power Dialer
2. Call a lead
3. Try to call the same lead again immediately → Should be blocked
4. Check active calls: 
   ```bash
   sudo -u postgres psql creativeprocess_caller -c "SELECT * FROM active_calls;"
   ```

## Monitoring

### View Recent Calls
```sql
SELECT 
  p.first_name || ' ' || p.last_name as prospect,
  cl.outcome,
  cl.duration,
  cl.started_at
FROM call_logs cl
JOIN prospects p ON cl.prospect_id = p.id
ORDER BY cl.started_at DESC
LIMIT 10;
```

### View Status Changes
```sql
SELECT 
  p.first_name || ' ' || p.last_name as prospect,
  psl.old_status,
  psl.new_status,
  psl.created_at
FROM prospect_status_log psl
JOIN prospects p ON psl.prospect_id = p.id
ORDER BY psl.created_at DESC
LIMIT 10;
```

### Check Active Calls
```sql
SELECT 
  p.first_name || ' ' || p.last_name as prospect,
  u.email as caller,
  ac.started_at
FROM active_calls ac
JOIN prospects p ON ac.prospect_id = p.id
JOIN users u ON ac.caller_id = u.id;
```

## Troubleshooting

### Database connection errors

Check PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

Restart if needed:
```bash
sudo systemctl restart postgresql
```

### Clear stuck active calls

If calls get stuck (shouldn't happen, but just in case):
```bash
sudo -u postgres psql creativeprocess_caller -c "DELETE FROM active_calls WHERE started_at < NOW() - INTERVAL '1 hour';"
```

### Reset everything (⚠️ DELETES ALL DATA)

```bash
sudo -u postgres dropdb creativeprocess_caller
sudo /root/CreativeprocessCaller/server/database/setup.sh
```

## What the Database Provides

✅ **Duplicate Call Prevention**
- Same prospect can't be called by 2 agents at once
- Minimum 5-minute gap between calls
- Works across user sessions

✅ **Status Change Logging**
- Every status change is automatically logged
- Shows: old status → new status, who changed it, when
- View history: `GET /api/prospects/:id/status-history`

✅ **Call History**
- Complete record of every call
- Includes: outcome, duration, notes, recording URL
- View history: `GET /api/prospects/:id/call-history`

✅ **Persistence**
- Data survives server restarts
- Data survives user logout/login
- Full audit trail

## Support

For detailed information, see:
- `/root/CreativeprocessCaller/DATABASE.md` - Full documentation
- `/root/CreativeprocessCaller/server/database/schema.sql` - Database schema
