# CreativeProcess.io - AI Development Context

> **Purpose**: This file provides AI coding assistants with complete codebase context for faster, more accurate development assistance.

---

## 🏗️ Project Overview

**CreativeProcess.io** is a **full-stack sales dialer application** similar to Orum/Nooks, enabling sales teams to make outbound calls via Twilio, manage leads, and track call performance.

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript, Vite 7, Tailwind CSS, React Router v6 |
| **Backend** | Node.js + Express.js |
| **Database** | PostgreSQL (with mock fallback) |
| **Voice/Calls** | Twilio Voice SDK (`@twilio/voice-sdk` v2.16) |
| **Icons** | Lucide React |
| **Process Manager** | PM2 |
| **Web Server** | Nginx |

### Deployment URLs
- **Production**: `https://salescallagent.my` (branch: `pr`, port: 3001)
- **Development**: `https://salescallagent.my/dev/` (branch: `dev`, port: 3002)

---

## 📁 Directory Structure

```
/root/CreativeprocessCaller/
├── App.tsx                 # Main app with routing, navigation, state management
├── index.tsx               # React entry point
├── types.ts                # TypeScript interfaces (Prospect, CallState, User, etc.)
├── constants.ts            # Initial data, mock prospects
├── vite.config.ts          # Vite config (base: /dev/ for dev builds)
├── deploy.sh               # Multi-branch deploy script
├── ecosystem.config.cjs    # PM2 configuration
│
├── components/             # React components
│   ├── PowerDialer.tsx     # Main power dialer (Orum-style) - ~2200 lines
│   ├── ActiveCallInterface.tsx  # Call bar with disposition
│   ├── ProspectTable.tsx   # Lead table with CRUD
│   ├── Header.tsx          # Top navigation bar
│   ├── LeadListManager.tsx # Lead list CRUD & CSV import
│   ├── CallHistoryAdvanced.tsx # Call logs with recordings
│   ├── Settings.tsx        # Twilio number selector
│   ├── SalesFloor.tsx      # Team activity dashboard
│   ├── TeamManagement.tsx  # Admin user management
│   ├── Login.tsx / Signup.tsx # Authentication
│   ├── UserProfile.tsx     # User profile editor
│   ├── ManualDialer.tsx    # Manual phone entry dialer
│   ├── VoicemailManager.tsx # Pre-recorded voicemail drops
│   └── ActivityLog.tsx     # Prospect activity timeline
│
├── services/               # Frontend services
│   ├── BackendAPI.ts       # All backend API calls (fetch wrapper)
│   ├── LiveTwilioService.ts # Twilio Voice SDK wrapper
│   └── mockTwilio.ts       # Mock for local dev without Twilio
│
├── server/                 # Backend (Express)
│   ├── server.js           # Server entry point
│   ├── app.js              # Express app setup
│   ├── config/
│   │   ├── config.js       # Environment config (Twilio keys, ports)
│   │   └── database.js     # PostgreSQL connection
│   │
│   ├── routes/             # API route definitions
│   │   ├── auth.js         # /api/auth/*
│   │   ├── prospects.js    # /api/prospects/*
│   │   ├── calls.js        # /api/calls/*
│   │   ├── voice.js        # /api/voice/* (Twilio TwiML)
│   │   ├── leadLists.js    # /api/lead-lists/*
│   │   ├── salesFloor.js   # /api/sales-floor/*
│   │   ├── voicemails.js   # /api/voicemails/*
│   │   ├── messages.js     # /api/messages/*
│   │   └── token.js        # /api/token (Twilio capability token)
│   │
│   ├── controllers/        # Route handlers
│   │   ├── authController.js
│   │   ├── prospectController.js
│   │   ├── callController.js
│   │   ├── voiceController.js
│   │   ├── leadListController.js
│   │   ├── salesFloorController.js
│   │   └── voicemailController.js
│   │
│   ├── services/           # Backend services
│   │   ├── authService.js      # JWT auth, bcrypt
│   │   ├── databaseService.js  # PostgreSQL queries
│   │   ├── mockDatabase.js     # In-memory fallback
│   │   ├── twilioClient.js     # Twilio REST API client
│   │   └── twilioNumbers.js    # Fetch available numbers
│   │
│   ├── middleware/
│   │   └── authMiddleware.js   # JWT verification
│   │
│   └── database/
│       ├── schema.sql          # Full PostgreSQL schema
│       └── migrate.js          # Database migrations
│
└── styles/
    └── Auth.css            # Login/signup styles
```

---

## 🔑 Key Types (`types.ts`)

```typescript
// Core prospect/lead type
interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Do Not Call';
  lastCall?: string;
  notes?: string;
  timezone: string;
  totalCalls?: number;
  statusHistory?: StatusChange[];
  callHistory?: ProspectCallLog[];
}

// Call lifecycle states
enum CallState {
  IDLE, DIALING, QUEUED, RINGING, IN_PROGRESS, 
  CONNECTED, COMPLETED, BUSY, NO_ANSWER, FAILED, 
  CANCELED, WRAP_UP
}

// Why a call ended
enum CallEndReason {
  CUSTOMER_HANGUP, AGENT_HANGUP, VOICEMAIL, NO_ANSWER,
  BUSY, FAILED, CANCELED, MACHINE_DETECTED, 
  CALL_REJECTED, INVALID_NUMBER, NETWORK_ERROR, TIMEOUT
}

// User/agent authentication
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'agent' | 'manager';
  permissions?: UserPermissions;
}

// Lead list/campaign
interface LeadList {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  prospectIds: string[];
  prospectCount: number;
}
```

---

## 🧩 Key Components

### `PowerDialer.tsx` (Main Dialer)
- **Location**: `/components/PowerDialer.tsx` (~2200 lines)
- **Purpose**: Orum-style power dialer with automatic call progression
- **Key Features**:
  - Start Session → Grant Mic Permission → Start Calling flow
  - Audio device selector dropdown (mic/speaker) with test buttons
  - Lead list selector with CSV import
  - Real-time call status tracking via Twilio webhooks
  - Quick dispositions (Voicemail, No Answer, Connected, etc.)
  - Voicemail drop functionality
  - Expandable rows with prospect details
  - Phone history per prospect
  - Automatic advance to next lead after disposition
- **Key State**:
  ```typescript
  const [isActive, setIsActive] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [callStatus, setCallStatus] = useState<'idle'|'dialing'|'connected'|'ended'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queue, setQueue] = useState<Prospect[]>([]);
  ```

### `App.tsx` (Main App)
- **Location**: `/App.tsx`
- **Purpose**: Root component with routing and global state
- **Navigation Views**: dashboard, prospects, power-dialer, manual-dialer, history, settings, team-management, lead-lists, sales-floor, profile
- **Key Props to PowerDialer**:
  ```typescript
  <PowerDialer 
    queue={powerDialerQueue}      // Prospects to dial
    onCall={handleCall}           // Initiate call callback
    disabled={!isTwilioReady}
    dispositionSaved={...}        // Triggers advance to next
    onDeleteProspect={...}
    onUpdateProspect={...}
    powerDialerPaused={...}       // Pause from wrap-up UI
  />
  ```

### `ActiveCallInterface.tsx`
- **Purpose**: Floating call bar (outside PowerDialer view)
- **Features**: Call duration timer, mute, disposition form, recording

### `BackendAPI.ts` (Frontend Service)
- **Location**: `/services/BackendAPI.ts`
- **Purpose**: All HTTP requests to backend
- **Key Methods**:
  ```typescript
  backendAPI.login(email, password)
  backendAPI.getProspects()
  backendAPI.createProspect(data)
  backendAPI.getCallHistory()
  backendAPI.logCall(callData)
  backendAPI.getLeadLists()
  backendAPI.getTwilioNumbers()
  backendAPI.getCallStatus(callSid)
  backendAPI.getVoicemails()
  ```

### `LiveTwilioService.ts` (Twilio SDK Wrapper)
- **Location**: `/services/LiveTwilioService.ts`
- **Purpose**: Wraps `@twilio/voice-sdk` Device
- **Key Methods**:
  ```typescript
  liveTwilioService.initialize(token)
  liveTwilioService.connect(phoneNumber, fromNumber)
  liveTwilioService.disconnect()
  liveTwilioService.mute(shouldMute)
  liveTwilioService.registerStatusCallback(cb)
  liveTwilioService.getCurrentCallSid()
  ```

---

## 🗄️ Database Schema (PostgreSQL)

**Key Tables**:
| Table | Purpose |
|-------|---------|
| `users` | Agents/admins with roles |
| `prospects` | Leads with phone, status, notes |
| `prospect_status_log` | Status change audit trail |
| `lead_activity_log` | Full audit log (calls, edits, etc.) |
| `call_logs` | Call history with outcomes |
| `active_calls` | Prevents duplicate concurrent calls |
| `lead_lists` | Named lead lists/campaigns |
| `lead_list_members` | Many-to-many leads ↔ lists |

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/create-user` | Admin creates new user |
| GET | `/api/auth/profile` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| GET | `/api/auth/team-members` | List all team members |

### Prospects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prospects` | List all prospects |
| POST | `/api/prospects` | Create prospect |
| PATCH | `/api/prospects/:id` | Update prospect |
| DELETE | `/api/prospects/:id` | Delete prospect |
| GET | `/api/prospects/:id/status-history` | Status change log |
| GET | `/api/prospects/:id/call-history` | Call history |
| GET | `/api/prospects/:id/activity-log` | Full activity log |

### Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calls` | Get call history |
| POST | `/api/calls` | Log a call |
| GET | `/api/calls/recordings` | List recordings |
| DELETE | `/api/calls/logs/:id` | Delete call log |

### Voice (Twilio)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice` | TwiML voice webhook |
| POST | `/api/voice/status` | Call status webhook |
| GET | `/api/voice/numbers` | List Twilio numbers |
| GET | `/api/voice/calls/:callSid/status` | Get call status |
| POST | `/api/voice/calls/:callSid/end` | End call |

### Lead Lists
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lead-lists` | List all lists |
| POST | `/api/lead-lists` | Create list |
| PATCH | `/api/lead-lists/:id` | Update list |
| DELETE | `/api/lead-lists/:id` | Delete list |

### Voicemails
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/voicemails` | List voicemails |
| POST | `/api/voicemails` | Create voicemail |
| PATCH | `/api/voicemails/:id` | Update voicemail |
| DELETE | `/api/voicemails/:id` | Delete voicemail |
| POST | `/api/voicemails/:id/default` | Set as default |

---

## 🚀 Build & Deploy

### Quick Commands
```bash
# Development build to /dev
npm run build && cp -r dist/* /var/www/salescallagent.my/dev/

# Full deploy script
./deploy.sh --dev    # Deploy dev branch
./deploy.sh --pr     # Deploy production
./deploy.sh --both   # Deploy both

# PM2 management
pm2 restart all
pm2 logs
pm2 status
```

### Vite Configuration
- **Base path**: `/dev/` for dev builds, `/` for production
- **Build output**: `/dist/`
- **Deployment target**: `/var/www/salescallagent.my/dev/`

### PM2 Services
| Service | Port | Purpose |
|---------|------|---------|
| `creativeprocess-backend` | 3001 | Production backend |
| `creativeprocess-backend-dev` | 3002 | Development backend |

---

## 🔧 Environment Variables

Create `.env` in project root:
```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_API_KEY=SKxxxx
TWILIO_API_SECRET=xxxx
TWILIO_APP_SID=APxxxx
TWILIO_CALLER_ID=+1234567890

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/creativeprocess_caller

# Server
PORT=3001
NODE_ENV=production
```

---

## 📋 Common Development Tasks

### Adding a New Component
1. Create in `/components/NewComponent.tsx`
2. Import in `App.tsx`
3. Add navigation item if needed (NavItem in sidebar)
4. Add new view type to `type View = ...`

### Adding a New API Endpoint
1. Create/update controller in `/server/controllers/`
2. Add route in `/server/routes/`
3. Register route in `/server/routes/index.js`
4. Add frontend method in `/services/BackendAPI.ts`

### Modifying PowerDialer
- Main state is in first ~150 lines
- Session flow: `handleStart` → `handleRequestMicPermission` → `handleStartCalling`
- Call progression: `advanceToNextLead` function
- Disposition: `handleQuickDisposition`, `handleSaveCurrentCall`

### Database Changes
1. Update `/server/database/schema.sql`
2. Run migration: `psql -d creativeprocess_caller -f schema.sql`
3. Update `/services/databaseService.js`
4. Update types in `/types.ts`

---

## ⚠️ Important Notes

1. **PowerDialer is the main complex component** (~2200 lines) - contains Orum-style UI, call management, lead lists, dispositions
2. **Two backend ports**: 3001 (production), 3002 (dev)
3. **Vite base path**: Must be `/dev/` for dev deployment
4. **Twilio webhooks** expect public URL - configure in Twilio console
5. **Mock database** is available when PostgreSQL is unavailable
6. **Auth tokens** stored in `localStorage` as `authToken`
7. **Dark mode** supported via Tailwind `dark:` classes

---

## 🎯 Current Features

✅ Power dialer with automatic call progression  
✅ Real-time Twilio call tracking  
✅ Lead list management with CSV import  
✅ Voicemail drop functionality  
✅ Call recordings  
✅ Team management (admin only)  
✅ Sales floor activity dashboard  
✅ Prospect status history & activity log  
✅ Audio device selection with test functionality  
✅ Dark mode support  

---

*Last Updated: December 2025*
