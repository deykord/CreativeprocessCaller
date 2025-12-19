# Telnyx Inbound Service - Quick Start Installation Guide

## Overview
This guide helps you set up the Telnyx inbound calling service on a new Ubuntu system. All necessary files are included in the `SETUP_FILES/` folder.

## Files Provided

| File | Purpose |
|------|---------|
| `schema.sql` | Database tables and indexes |
| `telnyxClient.js` | REST API client for Telnyx |
| `telnyxController.js` | Webhook and call handlers |
| `telnyxRoutes.js` | Express route definitions |
| `databaseServiceMethods.js` | Database query methods |
| `.env.example` | Environment variables template |

## Installation Steps

### 1. Clone/Setup Your Project
```bash
cd /your/project
npm install
```

### 2. Set Up Database

#### Option A: Using PostgreSQL directly
```bash
# Copy the schema
psql -U postgres -d your_database_name -f SETUP_FILES/schema.sql

# Verify tables created
psql -U postgres -d your_database_name -c "\dt inbound_calls call_logs"
```

#### Option B: Using psql interactive
```bash
psql -U postgres -d your_database_name
# Paste contents of schema.sql file
# Press Ctrl+D to exit
```

### 3. Copy Server Files

```bash
# Copy Telnyx client
cp SETUP_FILES/telnyxClient.js server/services/

# Copy controller
cp SETUP_FILES/telnyxController.js server/controllers/

# Copy routes
cp SETUP_FILES/telnyxRoutes.js server/routes/telnyx.js

# Merge database service methods into your existing databaseService.js
# (Copy the 4 functions from SETUP_FILES/databaseServiceMethods.js)
```

### 4. Update Main App File (server/app.js or server/index.js)

Add the Telnyx routes:
```javascript
// Near your other route definitions
const telnyxRoutes = require('./routes/telnyx');
app.use('/api/telnyx', telnyxRoutes);
```

### 5. Configure Environment Variables

```bash
# Copy template
cp SETUP_FILES/.env.example .env

# Edit .env with your values
nano .env
```

Required values to fill in:
```
TELNYX_API_KEY=your_key_from_telnyx_portal
TELNYX_SIP_USERNAME=your_sip_username
TELNYX_SIP_PASSWORD=your_sip_password
DB_HOST=your_database_host
DB_NAME=your_database_name
DB_USER=postgres
DB_PASSWORD=your_password
```

### 6. Get Telnyx Credentials

1. Go to https://portal.telnyx.com
2. Sign in or create account
3. Navigate to "API Credentials" section
4. Copy your API Key
5. Go to "SIP Credentials" section
6. Create or copy SIP username/password

### 7. Configure Telnyx Webhook

1. In Telnyx Dashboard: https://portal.telnyx.com
2. Find "Webhooks" or "Event Webhooks" section
3. Set webhook URL to: `https://yourdomain.com/api/telnyx/webhook`
   - Replace `yourdomain.com` with your actual domain
   - Must be HTTPS
   - Must be publicly accessible
4. Select events:
   - `call.initiated`
   - `call.answered`
   - `call.hangup`
   - `call.recording.saved`
5. Save

### 8. Test the Setup

```bash
# Restart your backend
npm run dev  # or your start script

# Check if routes are loaded
curl http://localhost:3001/api/telnyx/calls/pending \
  -H "Authorization: Bearer your_jwt_token"

# Should return: { "success": true, "calls": [] }
```

### 9. Test Incoming Call (from another phone)

```bash
# 1. Call your Telnyx phone number
# 2. Backend should log: "📞 Webhook received: call.initiated"
# 3. Database should create inbound_calls record
# 4. Recording should start automatically

# Check database
psql -U postgres -d your_database_name
SELECT * FROM inbound_calls ORDER BY created_at DESC LIMIT 5;
```

## Troubleshooting

### Webhook Not Reaching Backend
- Check: Is domain HTTPS and publicly accessible?
- Check: Is firewall allowing port 443?
- Test: `curl -X POST https://yourdomain.com/api/telnyx/webhook -d '{}' -H 'Content-Type: application/json'`

### "API key not configured" Error
- Verify TELNYX_API_KEY in .env
- Restart backend: `pm2 restart all`
- Check: `grep TELNYX .env`

### Database Connection Failed
- Verify DB credentials in .env
- Test: `psql -U postgres -d your_database_name -c "SELECT 1"`
- Check: PostgreSQL running? `pg_isready`

### Recording Not Saving
- Check Telnyx account has recording permission
- Verify webhook reaching backend
- Check logs: `pm2 logs`

### WebRTC Transfer Not Working
- Verify TELNYX_SIP_USERNAME and TELNYX_SIP_PASSWORD
- Check if WebRTC client is configured in your frontend
- Fallback to direct answer (no transfer) will still work

## Production Deployment

### Additional Recommendations

```bash
# 1. Use environment manager (PM2)
npm install -g pm2
pm2 start server.js --name "telnyx-backend"
pm2 save
pm2 startup

# 2. Use Redis for distributed call tracking (optional)
npm install redis
# Set REDIS_URL in .env

# 3. Set up monitoring
npm install winston  # for structured logging
npm install sentry  # for error tracking

# 4. Enable HTTPS/SSL
# Use Let's Encrypt or your certificate provider
# Update webhook URL to use HTTPS

# 5. Add rate limiting
npm install express-rate-limit
```

### Nginx Configuration (if using Nginx)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.crt;
    ssl_certificate_key /path/to/key.key;

    location /api/telnyx/webhook {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

## API Endpoints

Once running, these endpoints are available:

```bash
# Get pending (unanswered) calls
GET /api/telnyx/calls/pending

# Answer a call
POST /api/telnyx/calls/:callControlId/answer

# End a call
POST /api/telnyx/calls/:callControlId/end

# Webhook (Telnyx → Your Backend)
POST /api/telnyx/webhook
```

## Frontend Integration

Your React frontend needs to:

1. Poll `/api/telnyx/calls/pending` every 1-2 seconds
2. Show incoming call notification
3. Call `/api/telnyx/calls/:callControlId/answer` when user clicks answer
4. Transfer to WebRTC client (if configured)
5. Show active call UI with hangup button

See [TELNYX_INBOUND_SERVICE_SETUP.md](TELNYX_INBOUND_SERVICE_SETUP.md) for frontend code examples.

## Next Steps

1. Deploy to your server
2. Test incoming call from real phone
3. Verify recording saved to database
4. Add monitoring and alerting
5. Configure backups

## Support

If issues occur:
- Check `/pm2 logs` for backend errors
- Check browser console for frontend errors
- Verify webhook is reaching your domain (check Telnyx dashboard)
- Ensure all `.env` values are correct
- Verify database tables exist: `\dt inbound_calls`

---

**Last Updated:** Dec 19, 2025  
**Created for:** Telnyx WebRTC Inbound Calling Service
