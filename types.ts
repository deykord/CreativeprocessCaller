export interface StatusChange {
  id: string;
  oldStatus: string | null;
  newStatus: string;
  changedBy: string | null;
  changedByName?: string;
  reason?: string;
  createdAt: string;
}

export interface ProspectCallLog {
  id: string;
  callerId: string;
  callerName?: string;
  phoneNumber: string;
  fromNumber?: string;
  outcome: string;
  duration: number;
  notes?: string;
  recordingUrl?: string;
  startedAt: string;
  endedAt?: string;
}

export interface LeadActivityLog {
  id: string;
  prospectId: string;
  userId: string | null;
  userName: string;
  actionType: 'call' | 'status_change' | 'note_added' | 'note_edited' | 'field_updated' | 'created' | 'assigned' | 'list_added' | 'list_removed';
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  fieldName?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Prospect {
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
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export enum CallState {
  IDLE = 'IDLE',
  DIALING = 'DIALING',
  QUEUED = 'QUEUED',
  RINGING = 'RINGING',
  IN_PROGRESS = 'IN_PROGRESS',
  CONNECTED = 'CONNECTED',
  COMPLETED = 'COMPLETED',
  BUSY = 'BUSY',
  NO_ANSWER = 'NO_ANSWER',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  WRAP_UP = 'WRAP_UP',
}

// Call end reasons - identifies how/why the call ended
export enum CallEndReason {
  CUSTOMER_HANGUP = 'customer_hangup',       // Customer hung up
  AGENT_HANGUP = 'agent_hangup',             // Agent/client ended the call
  VOICEMAIL = 'voicemail',                   // Call went to voicemail
  NO_ANSWER = 'no_answer',                   // No one answered
  BUSY = 'busy',                             // Line was busy  
  FAILED = 'failed',                         // Call failed to connect
  CANCELED = 'canceled',                     // Call was canceled before connecting
  MACHINE_DETECTED = 'machine_detected',     // Answering machine detected
  CALL_REJECTED = 'call_rejected',           // Call was rejected
  INVALID_NUMBER = 'invalid_number',         // Invalid phone number
  NETWORK_ERROR = 'network_error',           // Network/carrier issue
  TIMEOUT = 'timeout',                       // Call timed out
  UNKNOWN = 'unknown',                       // Unknown reason
}

// Real-time call status from Twilio
export interface TwilioCallStatus {
  callSid: string;
  status: string;                            // Twilio status: queued, ringing, in-progress, completed, busy, no-answer, canceled, failed
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  duration?: number;                         // Duration in seconds (only when completed)
  startTime?: string;
  endTime?: string;
  answeredBy?: 'human' | 'machine' | 'unknown';  // AMD result
  endReason?: CallEndReason;
  sipResponseCode?: number;                  // SIP response code for failed calls
}

export interface CallLog {
  id: string;
  prospectId?: string;
  prospectName: string;
  phoneNumber: string;
  duration: number; // in seconds
  outcome: 'Connected' | 'Voicemail' | 'Busy' | 'No Answer' | 'Meeting Set' | 'Not Interested' | 'Wrong Number' | 'Callback';
  timestamp: string;
  note: string;
  fromNumber: string;
  endReason?: CallEndReason;
  callSid?: string;
}

export interface AgentStats {
  callsMade: number;
  connections: number;
  appointmentsSet: number;
  talkTime: number; // in minutes
}

export interface TwilioPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

// Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'agent' | 'manager';
  permissions?: UserPermissions;
  profilePicture?: string;
  bio?: string;
  workHours?: WorkHours;
  createdAt: string;
  updatedAt?: string;
}

export interface UserPermissions {
  canDeleteLeads?: boolean;
  canEditLeads?: boolean;
  canExportData?: boolean;
  canManageTeam?: boolean;
}

export interface WorkHours {
  monday?: { start: string; end: string };
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string };
  sunday?: { start: string; end: string };
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface LeadList {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  prospectIds: string[];
  prospectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListPermission {
  id: string;
  listId: string;
  userId: string;
  canView: boolean;
  canEdit: boolean;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}
