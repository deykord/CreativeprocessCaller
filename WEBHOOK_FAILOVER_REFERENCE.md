# Telnyx Webhook Failover - Quick Reference

## 📍 Endpoints

| Type | URL | Purpose |
|------|-----|---------|
| **Primary** | `https://salescallagent.my/api/telnyx/voice` | Main webhook for all call events |
| **Failover** | `https://salescallagent.my/api/telnyx/voice/failover` | Backup when primary fails |
| **Health** | `https://salescallagent.my/api/telnyx/voice/health` | Status monitoring |

## 🎯 What Is Failover?

A **backup webhook URL** that Telnyx uses automatically when your primary webhook is:
- Down or unavailable
- Returning errors (5xx)
- Timing out (>3 seconds)
- Having network issues

**Result:** Zero call events lost, even during server issues!

## �� Monitoring Commands

```bash
# View real-time failover events
pm2 logs | grep "FAILOVER"

# Check failover log file
cat logs/webhook_failover.log

# Check webhook health status
curl https://salescallagent.my/api/telnyx/voice/health | jq

# Count failover events today
grep "$(date +%Y-%m-%d)" logs/webhook_failover.log | wc -l
```

## 🚨 What Triggers Failover?

- PM2 restart / deployment
- High server load
- Database connection issues
- Network problems
- Any 5xx error from primary

## ✅ Expected Behavior

**Normal:** Failover triggers RARELY (only during restarts/issues)  
**Warning:** If failover triggers frequently → investigate primary webhook

## 📝 Log Locations

- **Failover events:** `/root/CreativeprocessCaller/logs/webhook_failover.log`
- **All webhooks:** `pm2 logs creativeprocess-backend`

## 🔧 Telnyx Configuration

In your Telnyx portal:
1. Primary Webhook URL: `https://salescallagent.my/api/telnyx/voice`
2. Failover Webhook URL: `https://salescallagent.my/api/telnyx/voice/failover`

Both URLs use the same logic - no call events are lost!

---
*Last Updated: December 22, 2025*
